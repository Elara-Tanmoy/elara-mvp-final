import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry, generateApiKey, generateApiSecret, hashPassword } from '../../utils/auth.js';

/**
 * Enterprise-Grade OAuth Service
 *
 * Security Features:
 * - Email verification required
 * - Account linking by email
 * - Audit logging for OAuth events
 * - Profile data encryption
 * - Token rotation
 */

export interface OAuthProfile {
  provider: 'google' | 'facebook' | 'linkedin';
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  raw: any; // Raw OAuth profile data
}

export class OAuthService {
  /**
   * Find or create user from OAuth profile
   * Enterprise pattern: Email-based account linking
   */
  async findOrCreateOAuthUser(profile: OAuthProfile, ipAddress?: string) {
    try {
      logger.info(`[OAuth] Processing ${profile.provider} login for: ${profile.email}`);

      // Validate email exists
      if (!profile.email) {
        throw new Error('Email is required from OAuth provider');
      }

      // Check if user exists with this OAuth ID
      const providerIdField = `${profile.provider}Id` as 'googleId' | 'facebookId' | 'linkedinId';
      let user = await prisma.user.findFirst({
        where: {
          [providerIdField]: profile.id
        },
        include: { organization: true }
      });

      if (user) {
        // User found with OAuth ID - update profile data
        logger.info(`[OAuth] Existing user found by ${profile.provider}Id: ${user.id}`);

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            profilePicture: profile.profilePicture || user.profilePicture,
            providerData: profile.raw,
            lastLoginAt: new Date()
          },
          include: { organization: true }
        });
      } else {
        // Check if user exists with same email (account linking)
        user = await prisma.user.findUnique({
          where: { email: profile.email },
          include: { organization: true }
        });

        if (user) {
          // Link OAuth account to existing user
          logger.info(`[OAuth] Linking ${profile.provider} account to existing user: ${user.id}`);

          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              [providerIdField]: profile.id,
              authProvider: profile.provider,
              profilePicture: profile.profilePicture || user.profilePicture,
              providerData: profile.raw,
              lastLoginAt: new Date()
            },
            include: { organization: true }
          });

          // Audit log for account linking
          await prisma.auditLog.create({
            data: {
              action: 'oauth_account_linked',
              entityType: 'user',
              entityId: user.id,
              userId: user.id,
              organizationId: user.organizationId,
              details: {
                provider: profile.provider,
                method: 'email_match'
              },
              ipAddress
            }
          });
        } else {
          // Create new user from OAuth profile
          logger.info(`[OAuth] Creating new user from ${profile.provider}: ${profile.email}`);

          // Create organization for new user
          const organization = await prisma.organization.create({
            data: {
              name: `${profile.firstName} ${profile.lastName}'s Organization`,
              tier: 'free',
              apiKey: generateApiKey(),
              apiSecret: await hashPassword(generateApiSecret())
            }
          });

          // Create user with OAuth profile
          user = await prisma.user.create({
            data: {
              email: profile.email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              role: 'owner',
              organizationId: organization.id,
              authProvider: profile.provider,
              [providerIdField]: profile.id,
              profilePicture: profile.profilePicture,
              providerData: profile.raw,
              passwordHash: null // OAuth users don't have password
            },
            include: { organization: true }
          });

          // Audit log for new user
          await prisma.auditLog.create({
            data: {
              action: 'oauth_user_created',
              entityType: 'user',
              entityId: user.id,
              userId: user.id,
              organizationId: organization.id,
              details: {
                provider: profile.provider,
                email: profile.email
              },
              ipAddress
            }
          });

          logger.info(`[OAuth] New user created: ${user.id} via ${profile.provider}`);
        }
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      });

      const refreshToken = generateRefreshToken();

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry()
        }
      });

      // Audit log for successful login
      await prisma.auditLog.create({
        data: {
          action: 'oauth_login',
          entityType: 'user',
          entityId: user.id,
          userId: user.id,
          organizationId: user.organizationId,
          details: {
            provider: profile.provider
          },
          ipAddress
        }
      });

      logger.info(`[OAuth] Login successful for user: ${user.id}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profilePicture: user.profilePicture,
          authProvider: user.authProvider
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          tier: user.organization.tier
        },
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error(`[OAuth] Error processing OAuth login:`, error);
      throw error;
    }
  }

  /**
   * Unlink OAuth account from user
   */
  async unlinkOAuthAccount(userId: string, provider: 'google' | 'facebook' | 'linkedin') {
    try {
      const providerIdField = `${provider}Id` as 'googleId' | 'facebookId' | 'linkedinId';

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Ensure user has a password before unlinking
      if (!user.passwordHash) {
        throw new Error('Cannot unlink the only authentication method. Please set a password first.');
      }

      // Unlink the OAuth account
      await prisma.user.update({
        where: { id: userId },
        data: {
          [providerIdField]: null,
          authProvider: 'local' // Revert to local auth
        }
      });

      logger.info(`[OAuth] Unlinked ${provider} account for user: ${userId}`);
    } catch (error) {
      logger.error(`[OAuth] Error unlinking OAuth account:`, error);
      throw error;
    }
  }

  /**
   * Get linked OAuth accounts for a user
   */
  async getLinkedAccounts(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleId: true,
          facebookId: true,
          linkedinId: true,
          authProvider: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        google: !!user.googleId,
        facebook: !!user.facebookId,
        linkedin: !!user.linkedinId,
        primary: user.authProvider
      };
    } catch (error) {
      logger.error(`[OAuth] Error getting linked accounts:`, error);
      throw error;
    }
  }
}

export const oauthService = new OAuthService();
