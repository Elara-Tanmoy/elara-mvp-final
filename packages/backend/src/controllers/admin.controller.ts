import { Request, Response } from 'express';
import { adminService } from '../services/admin/admin.service.js';
import { analyticsService } from '../services/admin/analytics.service.js';
import { apiKeyService } from '../services/admin/api-key.service.js';
import { logger } from '../config/logger.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    organizationId: string;
  };
  organization?: any;
}

export class AdminController {
  // ==================== DASHBOARD ====================

  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const stats = await adminService.getDashboardStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('[Admin Controller] Error getting dashboard stats:', error);

      // Provide fallback empty stats if service unavailable
      const fallbackStats = {
        totalUsers: 0,
        activeUsers: 0,
        totalScans: 0,
        totalRevenue: 0,
        recentUsers: [],
        recentScans: [],
        recentActivity: [],
        systemHealth: {
          database: 'unknown',
          redis: 'unknown',
          services: []
        },
        error: 'Some admin services are not fully configured. This is normal for MVP deployment.'
      };

      // Return fallback data instead of 500 error
      res.json({
        success: true,
        data: fallbackStats,
        warning: 'Using fallback data - admin services may not be fully configured'
      });
    }
  }

  // ==================== USER MANAGEMENT ====================

  async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const { page, limit, search, role, tier, isActive } = req.query;

      const result = await adminService.getAllUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        role: role as string,
        tier: tier as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get users'
      });
    }
  }

  async updateUserRole(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminId = req.user!.userId;

      if (!['user', 'admin', 'owner'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
      }

      await adminService.updateUserRole(userId, role, adminId);

      res.json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error updating user role:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user role'
      });
    }
  }

  async toggleUserStatus(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const adminId = req.user!.userId;

      await adminService.toggleUserStatus(userId, adminId);

      res.json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error toggling user status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle user status'
      });
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const adminId = req.user!.userId;

      await adminService.deleteUser(userId, adminId);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error deleting user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      });
    }
  }

  async changeUserTier(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { tier } = req.body;
      const adminId = req.user!.userId;

      await adminService.changeUserTier(userId, tier, adminId);

      res.json({
        success: true,
        message: 'User tier updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error changing user tier:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change user tier'
      });
    }
  }

  // ==================== SYSTEM SETTINGS ====================

  async getSystemSettings(req: AuthRequest, res: Response) {
    try {
      const { category } = req.query;

      const settings = await adminService.getSystemSettings(category as string);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting system settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system settings'
      });
    }
  }

  async updateSystemSetting(req: AuthRequest, res: Response) {
    try {
      const { key, value } = req.body;
      const adminId = req.user!.userId;

      await adminService.updateSystemSetting(key, value, adminId);

      res.json({
        success: true,
        message: 'System setting updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error updating system setting:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update system setting'
      });
    }
  }

  async createSystemSetting(req: AuthRequest, res: Response) {
    try {
      const { key, value, category, description, isPublic } = req.body;
      const adminId = req.user!.userId;

      const setting = await adminService.createSystemSetting({
        key,
        value,
        category,
        description,
        isPublic
      }, adminId);

      res.json({
        success: true,
        data: setting
      });
    } catch (error) {
      logger.error('[Admin Controller] Error creating system setting:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create system setting'
      });
    }
  }

  // ==================== RATE LIMITING ====================

  async getRateLimitConfigs(req: AuthRequest, res: Response) {
    try {
      const configs = await adminService.getRateLimitConfigs();

      res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting rate limit configs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit configs'
      });
    }
  }

  async updateRateLimitConfig(req: AuthRequest, res: Response) {
    try {
      const { tier } = req.params;
      const config = req.body;
      const adminId = req.user!.userId;

      await adminService.updateRateLimitConfig(tier, config, adminId);

      res.json({
        success: true,
        message: 'Rate limit config updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error updating rate limit config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update rate limit config'
      });
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  async getAllSubscriptions(req: AuthRequest, res: Response) {
    try {
      const { page, limit, plan, status } = req.query;

      const result = await adminService.getAllSubscriptions({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        plan: plan as string,
        status: status as string
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting subscriptions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get subscriptions'
      });
    }
  }

  async updateSubscription(req: AuthRequest, res: Response) {
    try {
      const { subscriptionId } = req.params;
      const updates = req.body;
      const adminId = req.user!.userId;

      await adminService.updateSubscription(subscriptionId, updates, adminId);

      res.json({
        success: true,
        message: 'Subscription updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error updating subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update subscription'
      });
    }
  }

  // ==================== INTEGRATIONS ====================

  async getIntegrations(req: AuthRequest, res: Response) {
    try {
      const integrations = await adminService.getIntegrations();

      res.json({
        success: true,
        data: integrations
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting integrations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get integrations'
      });
    }
  }

  async updateIntegration(req: AuthRequest, res: Response) {
    try {
      const { integrationId } = req.params;
      const updates = req.body;
      const adminId = req.user!.userId;

      await adminService.updateIntegration(integrationId, updates, adminId);

      res.json({
        success: true,
        message: 'Integration updated successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error updating integration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update integration'
      });
    }
  }

  async createIntegration(req: AuthRequest, res: Response) {
    try {
      const { name, type, enabled, config } = req.body;
      const adminId = req.user!.userId;

      const integration = await adminService.createIntegration({
        name,
        type,
        enabled,
        config
      }, adminId);

      res.json({
        success: true,
        data: integration
      });
    } catch (error) {
      logger.error('[Admin Controller] Error creating integration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create integration'
      });
    }
  }

  // ==================== ANALYTICS ====================

  async getApiUsageStats(req: AuthRequest, res: Response) {
    try {
      const { days = 7 } = req.query;

      const stats = await adminService.getApiUsageStats(parseInt(days as string));

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting API usage stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get API usage stats'
      });
    }
  }

  async getAdminActivityLogs(req: AuthRequest, res: Response) {
    try {
      const { page, limit, adminId, category } = req.query;

      const result = await adminService.getAdminActivityLogs({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        adminId: adminId as string,
        category: category as string
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting admin activity logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get admin activity logs'
      });
    }
  }

  // ==================== ADVANCED ANALYTICS ====================

  async getUserAnalytics(req: AuthRequest, res: Response) {
    try {
      const { days = 30 } = req.query;
      const analytics = await analyticsService.getUserAnalytics(parseInt(days as string));

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting user analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user analytics'
      });
    }
  }

  async getUsageAnalytics(req: AuthRequest, res: Response) {
    try {
      const { days = 30 } = req.query;
      const analytics = await analyticsService.getUsageAnalytics(parseInt(days as string));

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting usage analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get usage analytics'
      });
    }
  }

  async getRevenueAnalytics(req: AuthRequest, res: Response) {
    try {
      const { days = 30 } = req.query;
      const analytics = await analyticsService.getRevenueAnalytics(parseInt(days as string));

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting revenue analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get revenue analytics'
      });
    }
  }

  async getSystemAnalytics(req: AuthRequest, res: Response) {
    try {
      const analytics = await analyticsService.getSystemAnalytics();

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting system analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system analytics'
      });
    }
  }

  async getRealtimeMetrics(req: AuthRequest, res: Response) {
    try {
      const metrics = await analyticsService.getRealtimeMetrics();

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting realtime metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get realtime metrics'
      });
    }
  }

  async exportAnalytics(req: AuthRequest, res: Response) {
    try {
      const { type, format = 'json', days = 30 } = req.query;

      if (!['users', 'usage', 'revenue', 'system'].includes(type as string)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid export type'
        });
      }

      const data = await analyticsService.exportData(
        type as 'users' | 'usage' | 'revenue' | 'system',
        { format: format as 'csv' | 'json' | 'pdf' }
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-analytics.csv"`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-analytics.json"`);
      }

      res.send(data);
    } catch (error) {
      logger.error('[Admin Controller] Error exporting analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export analytics'
      });
    }
  }

  // ==================== API KEY MANAGEMENT ====================

  async generateApiKey(req: AuthRequest, res: Response) {
    try {
      const { name, permissions, rateLimit, expiresInDays } = req.body;
      const organizationId = req.user!.organizationId;
      const createdBy = req.user!.userId;

      const result = await apiKeyService.generateApiKey({
        name,
        organizationId,
        permissions: permissions || ['read'],
        rateLimit,
        expiresInDays,
        createdBy
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('[Admin Controller] Error generating API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate API key'
      });
    }
  }

  async listApiKeys(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const apiKeys = await apiKeyService.listApiKeys(organizationId);

      res.json({
        success: true,
        data: apiKeys
      });
    } catch (error) {
      logger.error('[Admin Controller] Error listing API keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list API keys'
      });
    }
  }

  async revokeApiKey(req: AuthRequest, res: Response) {
    try {
      const { keyId } = req.params;
      const organizationId = req.user!.organizationId;

      await apiKeyService.revokeApiKey(keyId, organizationId);

      res.json({
        success: true,
        message: 'API key revoked successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error revoking API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke API key'
      });
    }
  }

  async getApiKeyUsage(req: AuthRequest, res: Response) {
    try {
      const { keyId } = req.params;
      const { days = 30 } = req.query;

      const usage = await apiKeyService.getApiKeyUsage(keyId, parseInt(days as string));

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting API key usage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get API key usage'
      });
    }
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  async createWebhook(req: AuthRequest, res: Response) {
    try {
      const { name, url, events, headers, maxRetries, retryDelay } = req.body;
      const organizationId = req.user!.organizationId;

      const webhook = await apiKeyService.createWebhook({
        name,
        url,
        events,
        organizationId,
        headers,
        maxRetries,
        retryDelay
      });

      res.json({
        success: true,
        data: webhook
      });
    } catch (error) {
      logger.error('[Admin Controller] Error creating webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create webhook'
      });
    }
  }

  async listWebhooks(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const webhooks = await apiKeyService.listWebhooks(organizationId);

      res.json({
        success: true,
        data: webhooks
      });
    } catch (error) {
      logger.error('[Admin Controller] Error listing webhooks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list webhooks'
      });
    }
  }

  async deleteWebhook(req: AuthRequest, res: Response) {
    try {
      const { webhookId } = req.params;
      const organizationId = req.user!.organizationId;

      await apiKeyService.deleteWebhook(webhookId, organizationId);

      res.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    } catch (error) {
      logger.error('[Admin Controller] Error deleting webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete webhook'
      });
    }
  }

  async testWebhook(req: AuthRequest, res: Response) {
    try {
      const { webhookId } = req.params;
      const { event, payload } = req.body;

      const success = await apiKeyService.triggerWebhook(webhookId, event, payload);

      res.json({
        success: true,
        data: { triggered: success }
      });
    } catch (error) {
      logger.error('[Admin Controller] Error testing webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test webhook'
      });
    }
  }

  // ==================== KNOWLEDGE BASE MANAGEMENT ====================

  /**
   * Populate knowledge base with all threat intelligence data
   */
  async populateKnowledgeFromThreats(req: AuthRequest, res: Response) {
    try {
      logger.info('[Admin Controller] Starting threat intelligence to knowledge base population...');

      const { threatIntelToKnowledgeService } = await import('../services/chatbot/threat-intel-to-knowledge.service.js');

      const result = await threatIntelToKnowledgeService.populateFromThreatIntel();

      res.json({
        success: true,
        data: result,
        message: `Successfully populated ${result.added} threat intelligence entries to knowledge base`
      });
    } catch (error) {
      logger.error('[Admin Controller] Error populating knowledge base from threats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to populate knowledge base from threat intelligence'
      });
    }
  }

  /**
   * Populate knowledge base with recent threats (default: last 30 days)
   */
  async populateKnowledgeRecentThreats(req: AuthRequest, res: Response) {
    try {
      const { days = 30 } = req.query;
      logger.info(`[Admin Controller] Populating knowledge base with threats from last ${days} days...`);

      const { threatIntelToKnowledgeService } = await import('../services/chatbot/threat-intel-to-knowledge.service.js');

      const result = await threatIntelToKnowledgeService.populateRecentThreats(parseInt(days as string));

      res.json({
        success: true,
        data: result,
        message: `Successfully populated ${result.added} recent threat entries to knowledge base`
      });
    } catch (error) {
      logger.error('[Admin Controller] Error populating recent threats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to populate knowledge base with recent threats'
      });
    }
  }

  /**
   * Populate knowledge base with high-severity threats only
   */
  async populateKnowledgeHighSeverityThreats(req: AuthRequest, res: Response) {
    try {
      logger.info('[Admin Controller] Populating knowledge base with high-severity threats...');

      const { threatIntelToKnowledgeService } = await import('../services/chatbot/threat-intel-to-knowledge.service.js');

      const result = await threatIntelToKnowledgeService.populateHighSeverityThreats();

      res.json({
        success: true,
        data: result,
        message: `Successfully populated ${result.added} high-severity threat entries to knowledge base`
      });
    } catch (error) {
      logger.error('[Admin Controller] Error populating high-severity threats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to populate knowledge base with high-severity threats'
      });
    }
  }

  /**
   * Get knowledge base population statistics
   */
  async getKnowledgePopulationStats(req: AuthRequest, res: Response) {
    try {
      const { threatIntelToKnowledgeService } = await import('../services/chatbot/threat-intel-to-knowledge.service.js');

      const stats = await threatIntelToKnowledgeService.getPopulationStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('[Admin Controller] Error getting knowledge population stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get knowledge base population statistics'
      });
    }
  }

  /**
   * Clear all threat intelligence entries from knowledge base
   */
  async clearThreatIntelKnowledge(req: AuthRequest, res: Response) {
    try {
      logger.info('[Admin Controller] Clearing threat intelligence knowledge...');

      const { threatIntelToKnowledgeService } = await import('../services/chatbot/threat-intel-to-knowledge.service.js');

      const deletedCount = await threatIntelToKnowledgeService.clearThreatIntelKnowledge();

      res.json({
        success: true,
        data: { deletedCount },
        message: `Successfully cleared ${deletedCount} threat intelligence entries from knowledge base`
      });
    } catch (error) {
      logger.error('[Admin Controller] Error clearing threat intelligence knowledge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear threat intelligence knowledge'
      });
    }
  }
}

export const adminController = new AdminController();
