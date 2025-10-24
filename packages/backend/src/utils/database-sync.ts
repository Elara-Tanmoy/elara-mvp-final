import { prismaStaging } from '../config/database.js';
import { logger } from '../config/logger.js';

interface UserData {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  organizationId: string;
  isActive?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  authProvider?: string | null;
  profilePicture?: string | null;
}

interface OrganizationData {
  id: string;
  name: string;
  tier: string;
  apiKey: string;
  apiSecret: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  domain?: string | null;
}

/**
 * Syncs user data to staging database
 * This runs in production to keep staging in sync with prod registrations
 */
export async function syncUserToStaging(user: UserData): Promise<void> {
  if (!prismaStaging) {
    logger.debug('[DB Sync] Staging database not configured, skipping user sync');
    return;
  }

  try {
    await prismaStaging.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        passwordHash: user.passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isActive: user.isActive ?? true,
        emailVerified: user.emailVerified ?? false,
        lastLoginAt: user.lastLoginAt,
        updatedAt: user.updatedAt ?? new Date(),
        authProvider: user.authProvider,
        profilePicture: user.profilePicture
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isActive: user.isActive ?? true,
        emailVerified: user.emailVerified ?? false,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
        authProvider: user.authProvider,
        profilePicture: user.profilePicture
      }
    });

    logger.info(`[DB Sync] ✓ User synced to staging: ${user.email}`);
  } catch (error) {
    // Non-blocking: Don't fail production registration if staging sync fails
    logger.error(`[DB Sync] Failed to sync user to staging: ${user.email}`, error);
  }
}

/**
 * Syncs organization data to staging database
 * This runs in production to keep staging in sync with prod registrations
 */
export async function syncOrganizationToStaging(org: OrganizationData): Promise<void> {
  if (!prismaStaging) {
    logger.debug('[DB Sync] Staging database not configured, skipping org sync');
    return;
  }

  try {
    await prismaStaging.organization.upsert({
      where: { id: org.id },
      update: {
        name: org.name,
        tier: org.tier,
        apiKey: org.apiKey,
        apiSecret: org.apiSecret,
        isActive: org.isActive ?? true,
        updatedAt: org.updatedAt ?? new Date(),
        domain: org.domain
      },
      create: {
        id: org.id,
        name: org.name,
        tier: org.tier,
        apiKey: org.apiKey,
        apiSecret: org.apiSecret,
        isActive: org.isActive ?? true,
        createdAt: org.createdAt ?? new Date(),
        updatedAt: org.updatedAt ?? new Date(),
        domain: org.domain
      }
    });

    logger.info(`[DB Sync] ✓ Organization synced to staging: ${org.name}`);
  } catch (error) {
    // Non-blocking: Don't fail production registration if staging sync fails
    logger.error(`[DB Sync] Failed to sync organization to staging: ${org.name}`, error);
  }
}

/**
 * Syncs both user and organization to staging
 * Called during registration to immediately replicate data
 */
export async function syncRegistrationToStaging(
  user: UserData,
  organization: OrganizationData
): Promise<void> {
  if (!prismaStaging) {
    logger.debug('[DB Sync] Staging database not configured, skipping registration sync');
    return;
  }

  logger.info(`[DB Sync] Starting immediate sync for registration: ${user.email}`);

  // Sync organization first (user has FK to organization)
  await syncOrganizationToStaging(organization);

  // Then sync user
  await syncUserToStaging(user);

  logger.info(`[DB Sync] ✓ Registration sync completed for: ${user.email}`);
}
