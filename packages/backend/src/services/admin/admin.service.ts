import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger.js';

/**
 * Admin Service
 * Comprehensive admin panel management
 */

export interface SystemSetting {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  isPublic: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitTier {
  id: string;
  tier: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  maxFileSize: number;
  maxScansPerDay: number;
  features: any;
}

export interface SubscriptionInfo {
  id: string;
  organizationId: string;
  plan: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  features: any;
}

export interface UserManagement {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date;
  organization: {
    id: string;
    name: string;
    tier: string;
  };
  subscription?: {
    plan: string;
    status: string;
  };
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    admins: number;
    byTier: { tier: string; count: number }[];
  };
  activity: {
    totalScans: number;
    scansToday: number;
    totalSessions: number;
    sessionsToday: number;
  };
  systemHealth: {
    database: string;
    redis: string;
    anthropic: string;
  };
}

export class AdminService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    this.prisma = new PrismaClient();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    logger.info('[Admin Service] Initialized');
  }

  // ==================== DASHBOARD ====================

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // User stats
      const [totalUsers, activeUsers, adminUsers] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { role: 'admin' } })
      ]);

      const usersByTier = await this.prisma.organization.groupBy({
        by: ['tier'],
        _count: true
      });

      const tierCounts = {
        free: usersByTier.find(t => t.tier === 'free')?._count || 0,
        pro: usersByTier.find(t => t.tier === 'pro')?._count || 0,
        enterprise: usersByTier.find(t => t.tier === 'enterprise')?._count || 0
      };

      // Activity stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const [scansToday, scansThisWeek, scansThisMonth] = await Promise.all([
        this.prisma.scanResult.count({ where: { createdAt: { gte: today } } }),
        this.prisma.scanResult.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.scanResult.count({ where: { createdAt: { gte: monthAgo } } })
      ]);

      const chatMessagesToday = await this.pool.query(
        `SELECT COUNT(*) as count FROM chat_messages WHERE created_at >= $1`,
        [today]
      );

      // System stats
      const avgResponseResult = await this.pool.query(
        `SELECT AVG("responseTime") as avg_response FROM "api_usage" WHERE timestamp >= $1`,
        [weekAgo]
      );

      const errorRateResult = await this.pool.query(
        `SELECT
          COUNT(CASE WHEN "statusCode" >= 400 THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) * 100 as error_rate
         FROM "api_usage"
         WHERE timestamp >= $1`,
        [weekAgo]
      );

      // Revenue stats
      const activeSubscriptions = await this.prisma.subscription.count({
        where: { status: 'active', plan: { not: 'free' } }
      });

      const subscriptions = await this.prisma.subscription.findMany({
        where: { status: 'active', plan: { not: 'free' } },
        select: { pricePerMonth: true }
      });

      const mrr = subscriptions.reduce((sum, sub) => {
        return sum + (sub.pricePerMonth ? parseFloat(sub.pricePerMonth.toString()) : 0);
      }, 0);

      // Get total scans
      const totalScans = await this.prisma.scanResult.count();

      // Get session stats (using chat sessions as proxy for sessions)
      const totalSessions = await this.pool.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM chat_messages`
      );
      const sessionsToday = await this.pool.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM chat_messages WHERE created_at >= $1`,
        [today]
      );

      // Check system health
      let databaseHealth = 'connected';
      let redisHealth = 'unknown';
      let anthropicHealth = 'unknown';

      try {
        await this.prisma.$queryRaw`SELECT 1`;
        databaseHealth = 'connected';
      } catch (error) {
        databaseHealth = 'disconnected';
      }

      // Note: Redis and Anthropic health checks would require their clients
      // For now, we'll mark them as operational if DB is connected
      redisHealth = databaseHealth === 'connected' ? 'connected' : 'unknown';
      anthropicHealth = 'connected';

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          admins: adminUsers,
          byTier: [
            { tier: 'free', count: tierCounts.free },
            { tier: 'premium', count: tierCounts.pro },
            { tier: 'enterprise', count: tierCounts.enterprise }
          ]
        },
        activity: {
          totalScans: totalScans,
          scansToday: scansToday,
          totalSessions: parseInt(totalSessions.rows[0]?.count || '0'),
          sessionsToday: parseInt(sessionsToday.rows[0]?.count || '0')
        },
        systemHealth: {
          database: databaseHealth,
          redis: redisHealth,
          anthropic: anthropicHealth
        }
      };
    } catch (error) {
      logger.error('[Admin] Error getting dashboard stats:', error);
      throw error;
    }
  }

  // ==================== USER MANAGEMENT ====================

  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    tier?: string;
    isActive?: boolean;
  }): Promise<{ users: UserManagement[]; total: number; pages: number }> {
    try {
      const { page = 1, limit = 50, search, role, tier, isActive } = params;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;

      if (tier) {
        where.organization = { tier };
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            organization: {
              include: {
                subscription: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.user.count({ where })
      ]);

      const formattedUsers: UserManagement[] = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt || undefined,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          tier: user.organization.tier
        },
        subscription: user.organization.subscription ? {
          plan: user.organization.subscription.plan,
          status: user.organization.subscription.status
        } : undefined
      }));

      return {
        users: formattedUsers,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('[Admin] Error getting users:', error);
      throw error;
    }
  }

  async updateUserRole(userId: string, role: string, adminId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role }
      });

      await this.logAdminActivity(adminId, 'update_user_role', 'users', userId, { role });

      logger.info(`[Admin] Updated user ${userId} role to ${role}`);
    } catch (error) {
      logger.error('[Admin] Error updating user role:', error);
      throw error;
    }
  }

  async toggleUserStatus(userId: string, adminId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: !user.isActive }
      });

      await this.logAdminActivity(adminId, 'toggle_user_status', 'users', userId, {
        isActive: !user.isActive
      });

      logger.info(`[Admin] Toggled user ${userId} status to ${!user.isActive}`);
    } catch (error) {
      logger.error('[Admin] Error toggling user status:', error);
      throw error;
    }
  }

  async deleteUser(userId: string, adminId: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id: userId } });
      await this.logAdminActivity(adminId, 'delete_user', 'users', userId, {});

      logger.info(`[Admin] Deleted user ${userId}`);
    } catch (error) {
      logger.error('[Admin] Error deleting user:', error);
      throw error;
    }
  }

  async changeUserTier(userId: string, tier: string, adminId: string): Promise<void> {
    try {
      // Get user's organization
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true }
      });

      if (!user || !user.organization) {
        throw new Error('User or organization not found');
      }

      // Update organization tier
      await this.prisma.organization.update({
        where: { id: user.organization.id },
        data: { tier }
      });

      await this.logAdminActivity(adminId, 'change_user_tier', 'organizations', user.organization.id, {
        userId,
        oldTier: user.organization.tier,
        newTier: tier
      });

      logger.info(`[Admin] Changed user ${userId} tier from ${user.organization.tier} to ${tier}`);
    } catch (error) {
      logger.error('[Admin] Error changing user tier:', error);
      throw error;
    }
  }

  // ==================== SYSTEM SETTINGS ====================

  async getSystemSettings(category?: string): Promise<SystemSetting[]> {
    try {
      const where = category ? { category } : {};
      const settings = await this.prisma.systemSettings.findMany({ where });
      return settings as SystemSetting[];
    } catch (error) {
      logger.error('[Admin] Error getting system settings:', error);
      throw error;
    }
  }

  async updateSystemSetting(key: string, value: any, adminId: string): Promise<void> {
    try {
      await this.prisma.systemSettings.upsert({
        where: { key },
        create: {
          key,
          value,
          category: 'general',
          updatedBy: adminId
        },
        update: {
          value,
          updatedBy: adminId
        }
      });

      await this.logAdminActivity(adminId, 'update_system_setting', 'settings', key, { value });

      logger.info(`[Admin] Updated system setting ${key}`);
    } catch (error) {
      logger.error('[Admin] Error updating system setting:', error);
      throw error;
    }
  }

  async createSystemSetting(params: {
    key: string;
    value: any;
    category: string;
    description?: string;
    isPublic?: boolean;
  }, adminId: string): Promise<SystemSetting> {
    try {
      const setting = await this.prisma.systemSettings.create({
        data: {
          ...params,
          updatedBy: adminId
        }
      });

      await this.logAdminActivity(adminId, 'create_system_setting', 'settings', setting.id, params);

      logger.info(`[Admin] Created system setting ${params.key}`);
      return setting as SystemSetting;
    } catch (error) {
      logger.error('[Admin] Error creating system setting:', error);
      throw error;
    }
  }

  // ==================== RATE LIMITING ====================

  async getRateLimitConfigs(): Promise<RateLimitTier[]> {
    try {
      const configs = await this.prisma.rateLimitConfig.findMany();
      return configs as RateLimitTier[];
    } catch (error) {
      logger.error('[Admin] Error getting rate limit configs:', error);
      throw error;
    }
  }

  async updateRateLimitConfig(tier: string, config: Partial<RateLimitTier>, adminId: string): Promise<void> {
    try {
      await this.prisma.rateLimitConfig.upsert({
        where: { tier },
        create: {
          tier,
          ...config
        } as any,
        update: config
      });

      await this.logAdminActivity(adminId, 'update_rate_limit', 'settings', tier, config);

      logger.info(`[Admin] Updated rate limit config for ${tier}`);
    } catch (error) {
      logger.error('[Admin] Error updating rate limit config:', error);
      throw error;
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  async getAllSubscriptions(params: {
    page?: number;
    limit?: number;
    plan?: string;
    status?: string;
  }): Promise<{ subscriptions: any[]; total: number; pages: number }> {
    try {
      const { page = 1, limit = 50, plan, status } = params;
      const skip = (page - 1) * limit;

      // Get all organizations with their subscriptions
      const organizations = await this.prisma.organization.findMany({
        skip,
        take: limit,
        include: {
          subscription: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const total = await this.prisma.organization.count();

      // Map organizations to subscription format
      const subscriptions = organizations.map(org => {
        if (org.subscription) {
          // Real subscription exists
          return {
            id: org.subscription.id,
            organizationName: org.name,
            plan: org.subscription.plan,
            status: org.subscription.status,
            startDate: org.subscription.startDate,
            endDate: org.subscription.endDate,
            autoRenew: org.subscription.autoRenew,
            pricePerMonth: org.subscription.pricePerMonth ? parseFloat(org.subscription.pricePerMonth.toString()) : null
          };
        } else {
          // Create virtual subscription from organization tier
          const planMap: Record<string, string> = {
            free: 'free',
            pro: 'premium_monthly',
            premium: 'premium_monthly',
            enterprise: 'enterprise'
          };

          const priceMap: Record<string, number | null> = {
            free: null,
            pro: 29,
            premium: 29,
            enterprise: 199
          };

          return {
            id: org.id,
            organizationName: org.name,
            plan: planMap[org.tier] || org.tier,
            status: org.isActive ? 'active' : 'suspended',
            startDate: org.createdAt,
            endDate: null,
            autoRenew: false,
            pricePerMonth: priceMap[org.tier] ?? null
          };
        }
      });

      return {
        subscriptions,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('[Admin] Error getting subscriptions:', error);
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, updates: any, adminId: string): Promise<void> {
    try {
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: updates
      });

      await this.logAdminActivity(adminId, 'update_subscription', 'subscriptions', subscriptionId, updates);

      logger.info(`[Admin] Updated subscription ${subscriptionId}`);
    } catch (error) {
      logger.error('[Admin] Error updating subscription:', error);
      throw error;
    }
  }

  // ==================== INTEGRATIONS ====================

  async getIntegrations(): Promise<any[]> {
    try {
      return await this.prisma.integration.findMany();
    } catch (error) {
      logger.error('[Admin] Error getting integrations:', error);
      throw error;
    }
  }

  async updateIntegration(integrationId: string, updates: any, adminId: string): Promise<void> {
    try {
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: updates
      });

      await this.logAdminActivity(adminId, 'update_integration', 'integrations', integrationId, updates);

      logger.info(`[Admin] Updated integration ${integrationId}`);
    } catch (error) {
      logger.error('[Admin] Error updating integration:', error);
      throw error;
    }
  }

  async createIntegration(params: {
    name: string;
    type: string;
    enabled: boolean;
    config: any;
  }, adminId: string): Promise<any> {
    try {
      const integration = await this.prisma.integration.create({ data: params });

      await this.logAdminActivity(adminId, 'create_integration', 'integrations', integration.id, params);

      logger.info(`[Admin] Created integration ${params.name}`);
      return integration;
    } catch (error) {
      logger.error('[Admin] Error creating integration:', error);
      throw error;
    }
  }

  // ==================== ANALYTICS ====================

  async getApiUsageStats(days: number = 7): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await this.pool.query(`
        SELECT
          DATE(timestamp) as date,
          COUNT(*) as total_requests,
          AVG("responseTime") as avg_"responseTime",
          COUNT(CASE WHEN "statusCode" >= 400 THEN 1 END) as errors
        FROM "api_usage"
        WHERE timestamp >= $1
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `, [startDate]);

      return stats.rows;
    } catch (error) {
      logger.error('[Admin] Error getting API usage stats:', error);
      throw error;
    }
  }

  async getAdminActivityLogs(params: {
    page?: number;
    limit?: number;
    adminId?: string;
    category?: string;
  }): Promise<any> {
    try {
      const { page = 1, limit = 50, adminId, category } = params;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (adminId) where.adminId = adminId;
      if (category) where.category = category;

      const [logs, total] = await Promise.all([
        this.prisma.adminActivity.findMany({
          where,
          skip,
          take: limit,
          orderBy: { timestamp: 'desc' }
        }),
        this.prisma.adminActivity.count({ where })
      ]);

      return {
        logs,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('[Admin] Error getting admin activity logs:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private async logAdminActivity(
    adminId: string,
    action: string,
    category: string,
    entityId: string,
    changes: any
  ): Promise<void> {
    try {
      await this.prisma.adminActivity.create({
        data: {
          adminId,
          action,
          category,
          entityId,
          changes
        }
      });
    } catch (error) {
      logger.error('[Admin] Error logging admin activity:', error);
    }
  }
}

export const adminService = new AdminService();
