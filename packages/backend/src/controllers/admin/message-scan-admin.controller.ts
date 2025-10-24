/**
 * Message Scan Admin Controller
 * Comprehensive admin interface for message scanning configuration
 *
 * Features:
 * - Scan configuration management (CRUD)
 * - AI model configuration
 * - Detection rules management
 * - Threat intelligence configuration
 * - Performance tuning
 * - Real-time testing
 * - Presets management
 * - Export/Import configurations
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export class MessageScanAdminController {
  /**
   * Get all message scan configurations
   * GET /api/v2/admin/message-scan/configs
   */
  async getAllConfigurations(req: Request, res: Response) {
    try {
      const configs = await prisma.messageScanConfig.findMany({
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: configs });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error fetching configurations:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch configurations' });
    }
  }

  /**
   * Get active configuration
   * GET /api/v2/admin/message-scan/config/active
   */
  async getActiveConfiguration(req: Request, res: Response) {
    try {
      const activeConfig = await prisma.messageScanConfig.findFirst({
        where: { isActive: true }
      });

      if (!activeConfig) {
        return res.json({
          success: true,
          data: this.getDefaultConfiguration(),
          isDefault: true
        });
      }

      res.json({ success: true, data: activeConfig, isDefault: false });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error fetching active configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch active configuration' });
    }
  }

  /**
   * Get single configuration by ID
   * GET /api/v2/admin/message-scan/config/:id
   */
  async getConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const config = await prisma.messageScanConfig.findUnique({ where: { id } });

      if (!config) {
        return res.status(404).json({ success: false, error: 'Configuration not found' });
      }

      res.json({ success: true, data: config });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error fetching configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch configuration' });
    }
  }

  /**
   * Create new configuration
   * POST /api/v2/admin/message-scan/config
   */
  async createConfiguration(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const configData = req.body;

      const config = await prisma.messageScanConfig.create({
        data: {
          ...configData,
          createdBy: userId
        }
      });

      logger.info(`[MessageScanAdmin] Created configuration: ${config.id} by user ${userId}`);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error creating configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to create configuration' });
    }
  }

  /**
   * Update configuration
   * PUT /api/v2/admin/message-scan/config/:id
   */
  async updateConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const updateData = req.body;

      const updated = await prisma.messageScanConfig.update({
        where: { id },
        data: {
          ...updateData,
          lastEditedBy: userId
        }
      });

      logger.info(`[MessageScanAdmin] Updated configuration: ${id} by user ${userId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error updating configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
  }

  /**
   * Activate configuration
   * PATCH /api/v2/admin/message-scan/config/:id/activate
   */
  async activateConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      // Deactivate all others
      await prisma.messageScanConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Activate this one
      const activated = await prisma.messageScanConfig.update({
        where: { id },
        data: { isActive: true }
      });

      logger.info(`[MessageScanAdmin] Activated configuration: ${id} by user ${userId}`);
      res.json({ success: true, data: activated });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error activating configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to activate configuration' });
    }
  }

  /**
   * Delete configuration
   * DELETE /api/v2/admin/message-scan/config/:id
   */
  async deleteConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const config = await prisma.messageScanConfig.findUnique({ where: { id } });
      if (config?.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete active configuration'
        });
      }

      await prisma.messageScanConfig.delete({ where: { id } });

      logger.info(`[MessageScanAdmin] Deleted configuration: ${id} by user ${userId}`);
      res.json({ success: true, message: 'Configuration deleted successfully' });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error deleting configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to delete configuration' });
    }
  }

  /**
   * Test message scan with specific configuration
   * POST /api/v2/admin/message-scan/test
   */
  async testConfiguration(req: Request, res: Response) {
    try {
      const { message, configurationId } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      // Get configuration
      let config;
      if (configurationId) {
        config = await prisma.messageScanConfig.findUnique({ where: { id: configurationId } });
      } else {
        config = await prisma.messageScanConfig.findFirst({ where: { isActive: true } });
      }

      if (!config) {
        config = this.getDefaultConfiguration();
      }

      // TODO: Implement actual message scanning logic
      const testResult = {
        message,
        configurationUsed: {
          id: config.id || 'default',
          name: config.name
        },
        result: {
          isThreat: false,
          confidence: 0.8,
          threatType: null,
          detectedPatterns: [],
          aiAnalysis: {
            models: [],
            consensus: 'safe'
          }
        },
        timestamp: new Date()
      };

      res.json({ success: true, data: testResult });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error testing configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to test configuration' });
    }
  }

  /**
   * Get presets
   * GET /api/v2/admin/message-scan/presets
   */
  async getPresets(req: Request, res: Response) {
    try {
      const presets = this.getPresetsList();
      res.json({ success: true, data: presets });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error fetching presets:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch presets' });
    }
  }

  /**
   * Apply preset
   * POST /api/v2/admin/message-scan/preset/:presetName/apply
   */
  async applyPreset(req: Request, res: Response) {
    try {
      const { presetName } = req.params;
      const { name, description } = req.body;
      const userId = (req as any).user?.id;

      const presets = this.getPresetsList();
      const preset = presets.find((p: any) => p.id === presetName);

      if (!preset) {
        return res.status(404).json({ success: false, error: 'Preset not found' });
      }

      const config = await prisma.messageScanConfig.create({
        data: {
          ...preset.config,
          createdBy: userId
        }
      });

      logger.info(`[MessageScanAdmin] Applied preset ${presetName} as config ${config.id}`);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error applying preset:', error);
      res.status(500).json({ success: false, error: 'Failed to apply preset' });
    }
  }

  /**
   * Export configuration
   * GET /api/v2/admin/message-scan/config/:id/export
   */
  async exportConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const config = await prisma.messageScanConfig.findUnique({ where: { id } });

      if (!config) {
        return res.status(404).json({ success: false, error: 'Configuration not found' });
      }

      const exportData = {
        ...config,
        exportedAt: new Date(),
        exportedFrom: 'Elara Message Scan Admin'
      };

      res.json({ success: true, data: exportData });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error exporting configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to export configuration' });
    }
  }

  /**
   * Import configuration
   * POST /api/v2/admin/message-scan/config/import
   */
  async importConfiguration(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const importData = req.body;

      const config = await prisma.messageScanConfig.create({
        data: {
          ...importData,
          name: `${importData.name} (Imported)`,
          isActive: false,
          createdBy: userId
        }
      });

      logger.info(`[MessageScanAdmin] Imported configuration: ${config.id}`);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      logger.error('[MessageScanAdmin] Error importing configuration:', error);
      res.status(500).json({ success: false, error: 'Failed to import configuration' });
    }
  }

  /**
   * Helper: Get default configuration
   */
  private getDefaultConfiguration() {
    return {
      name: 'Default Message Scan Configuration',
      description: 'Standard balanced configuration for message scanning',
      isActive: true,

      // Detection Parameters
      maxMessageLength: 10000,
      minConfidence: 0.7,
      languageDetection: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko'],

      // AI Models
      models: ['claude-sonnet-4.5', 'gpt-4', 'gemini-1.5-flash'],
      modelWeights: {
        claude: 0.35,
        gpt4: 0.35,
        gemini: 0.30
      },

      // Detection Rules
      keywordRules: {
        urgencyKeywords: ['urgent', 'immediate', 'act now', 'limited time'],
        scamKeywords: ['free money', 'prize winner', 'click here now'],
        phishingKeywords: ['verify account', 'confirm identity', 'update payment']
      },

      regexPatterns: {
        phoneNumbers: '\\+?[1-9]\\d{1,14}',
        urls: 'https?://[\\w\\-]+(\\.[\\w\\-]+)+[/#?]?.*$',
        emails: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'
      },

      // Threat Intelligence
      threatIntelEnabled: true,
      knownScamDatabaseEnabled: true,

      // Performance
      timeout: 30000,
      cacheEnabled: true,
      cacheDuration: 3600,
      asyncProcessing: true,

      // Rate Limiting
      rateLimits: {
        free: 100,
        basic: 500,
        premium: 2000,
        enterprise: 10000
      }
    };
  }

  /**
   * Helper: Get presets list
   */
  private getPresetsList() {
    return [
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Standard configuration for general use',
        config: this.getDefaultConfiguration()
      },
      {
        id: 'strict',
        name: 'Strict Security',
        description: 'Maximum security with low false negative rate',
        config: {
          ...this.getDefaultConfiguration(),
          minConfidence: 0.5,
          keywordRules: {
            urgencyKeywords: ['urgent', 'immediate', 'act now', 'limited time', 'hurry', 'fast'],
            scamKeywords: ['free', 'prize', 'winner', 'congratulations', 'claim'],
            phishingKeywords: ['verify', 'confirm', 'update', 'secure', 'account']
          }
        }
      },
      {
        id: 'permissive',
        name: 'Permissive',
        description: 'Lower false positives for trusted environments',
        config: {
          ...this.getDefaultConfiguration(),
          minConfidence: 0.85
        }
      }
    ];
  }
}

export const messageScanAdminController = new MessageScanAdminController();
