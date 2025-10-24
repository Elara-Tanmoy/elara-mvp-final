import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  generateApiKey,
  generateApiSecret
} from '../utils/auth.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator.js';
import { oauthService, OAuthProfile } from '../services/auth/oauth.service.js';
import { FRONTEND_URL } from '../config/oauth.config.js';
import { syncRegistrationToStaging } from '../utils/database-sync.js';
import crypto from 'crypto';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });

      if (existingUser) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }

      // Create organization
      const organization = await prisma.organization.create({
        data: {
          name: validatedData.organizationName,
          tier: 'free',
          apiKey: generateApiKey(),
          apiSecret: await hashPassword(generateApiSecret())
        }
      });

      // Create user
      const hashedPassword = await hashPassword(validatedData.password);

      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          passwordHash: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: 'owner',
          organizationId: organization.id
        }
      });

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      });

      const refreshToken = generateRefreshToken();

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry()
        }
      });

      // Sync to staging database immediately (non-blocking)
      syncRegistrationToStaging(
        {
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        {
          id: organization.id,
          name: organization.name,
          tier: organization.tier,
          apiKey: organization.apiKey,
          apiSecret: organization.apiSecret,
          isActive: organization.isActive,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt
        }
      ).catch(err => {
        // Don't fail registration if staging sync fails
        logger.error(`[Registration] Staging sync failed but continuing: ${err.message}`);
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'user_register',
          entityType: 'user',
          entityId: user.id,
          userId: user.id,
          organizationId: organization.id,
          details: { email: user.email },
          ipAddress: req.ip
        }
      });

      logger.info(`New user registered: ${user.email}`);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        organization: {
          id: organization.id,
          name: organization.name,
          tier: organization.tier
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      logger.debug(`[AUTH] Login attempt - Email: ${req.body.email}, IP: ${req.ip}`);

      const validatedData = loginSchema.parse(req.body);
      logger.debug(`[AUTH] Validation passed for email: ${validatedData.email}`);

      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
        include: { organization: true }
      });

      logger.debug(`[AUTH] User lookup result - Found: ${!!user}, Active: ${user?.isActive}, Has org: ${!!user?.organization}`);

      if (!user || !user.isActive) {
        logger.warn(`[AUTH] Login failed - User not found or inactive: ${validatedData.email}`);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      logger.debug(`[AUTH] Verifying password for user: ${user.id}`);
      const isValidPassword = await verifyPassword(
        validatedData.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        logger.warn(`[AUTH] Login failed - Invalid password for user: ${user.email}`);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      logger.debug(`[AUTH] Password verified, generating tokens for user: ${user.id}`);

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      });

      const refreshToken = generateRefreshToken();
      logger.debug(`[AUTH] Tokens generated, saving refresh token to database`);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry()
        }
      });

      logger.debug(`[AUTH] Updating last login timestamp`);
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      logger.debug(`[AUTH] Creating audit log entry`);
      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'user_login',
          entityType: 'user',
          entityId: user.id,
          userId: user.id,
          organizationId: user.organizationId,
          ipAddress: req.ip
        }
      });

      logger.info(`[AUTH] ✓ User logged in successfully: ${user.email}`);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          tier: user.organization.tier
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error(`[AUTH] Validation error:`, error.errors);
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('========================================');
      logger.error('[AUTH] LOGIN ERROR - DETAILED DEBUG INFO');
      logger.error('========================================');
      logger.error('[AUTH] Error type:', error?.constructor?.name);
      logger.error('[AUTH] Error message:', error instanceof Error ? error.message : String(error));
      logger.error('[AUTH] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      logger.error('[AUTH] Request body keys:', Object.keys(req.body));
      logger.error('[AUTH] Request IP:', req.ip);
      logger.error('[AUTH] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      logger.error('========================================');

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = refreshTokenSchema.parse(req.body);

      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: validatedData.refreshToken },
        include: { user: true }
      });

      if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: tokenRecord.user.id,
        email: tokenRecord.user.email,
        role: tokenRecord.user.role,
        organizationId: tokenRecord.user.organizationId
      });

      res.json({ accessToken });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { revokedAt: new Date() }
        });
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get current user profile
   * Used by OAuth callback to fetch user data after receiving tokens
   */
  async getCurrentUser(req: any, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true }
      });

      if (!user || !user.isActive) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
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
        }
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * OAuth Callback Handler
   * This handles the callback from OAuth providers after user authorization
   */
  async handleOAuthCallback(req: Request, res: Response, profile: OAuthProfile): Promise<void> {
    try {
      // Process OAuth login
      const result = await oauthService.findOrCreateOAuthUser(profile, req.ip);

      // Redirect to frontend with tokens
      const redirectUrl = new URL(FRONTEND_URL);
      redirectUrl.searchParams.set('access_token', result.accessToken);
      redirectUrl.searchParams.set('refresh_token', result.refreshToken);
      redirectUrl.searchParams.set('oauth_success', 'true');

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('[OAuth] Callback error:', error);

      // Redirect to frontend with error
      const redirectUrl = new URL(FRONTEND_URL);
      redirectUrl.searchParams.set('oauth_error', 'authentication_failed');
      res.redirect(redirectUrl.toString());
    }
  }

  /**
   * Get linked OAuth accounts for current user
   */
  async getLinkedAccounts(req: any, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const accounts = await oauthService.getLinkedAccounts(userId);
      res.json({ success: true, data: accounts });
    } catch (error) {
      logger.error('[OAuth] Error getting linked accounts:', error);
      res.status(500).json({ error: 'Failed to get linked accounts' });
    }
  }

  /**
   * Unlink OAuth account
   */
  async unlinkOAuthAccount(req: any, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { provider } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!['google', 'facebook', 'linkedin'].includes(provider)) {
        res.status(400).json({ error: 'Invalid provider' });
        return;
      }

      await oauthService.unlinkOAuthAccount(userId, provider as any);
      res.json({ success: true, message: `${provider} account unlinked successfully` });
    } catch (error: any) {
      logger.error('[OAuth] Error unlinking account:', error);
      res.status(500).json({ error: error.message || 'Failed to unlink account' });
    }
  }
}

export const authController = new AuthController();
