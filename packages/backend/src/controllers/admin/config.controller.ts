/**
 * Admin Configuration Controller
 *
 * Manages scan engine configurations:
 * - List all configurations
 * - Get active configuration
 * - Create new configuration
 * - Update configuration
 * - Activate/deactivate configuration
 * - Delete configuration
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export class AdminConfigController {
  /**
   * GET /api/admin/config
   * List all scan configurations
   */
  async listConfigurations(req: Request, res: Response) {
    try {
      const configs = await prisma.adminScanConfig.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          maxScore: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { scans: true }
          }
        }
      });

      logger.info('[Admin Config] Listed configurations:', configs.length);

      res.json({
        success: true,
        data: configs,
        total: configs.length
      });
    } catch (error) {
      logger.error('[Admin Config] Error listing configurations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list configurations'
      });
    }
  }

  /**
   * GET /api/admin/config/active
   * Get currently active configuration
   */
  async getActiveConfiguration(req: Request, res: Response) {
    try {
      const activeConfig = await prisma.adminScanConfig.findFirst({
        where: { isActive: true }
      });

      if (!activeConfig) {
        return res.status(404).json({
          success: false,
          error: 'No active configuration found'
        });
      }

      logger.info('[Admin Config] Retrieved active config:', activeConfig.id);

      res.json({
        success: true,
        data: activeConfig
      });
    } catch (error) {
      logger.error('[Admin Config] Error getting active configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active configuration'
      });
    }
  }

  /**
   * GET /api/admin/config/:id
   * Get specific configuration by ID
   */
  async getConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const config = await prisma.adminScanConfig.findUnique({
        where: { id },
        include: {
          _count: {
            select: { scans: true }
          }
        }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      logger.info('[Admin Config] Retrieved config:', id);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[Admin Config] Error getting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get configuration'
      });
    }
  }

  /**
   * POST /api/admin/config
   * Create new configuration
   */
  async createConfiguration(req: Request, res: Response) {
    try {
      const {
        name,
        maxScore = 570,
        categoryWeights,
        checkWeights = {},
        algorithmConfig,
        aiModelConfig
      } = req.body;

      // Validate required fields
      if (!name || !categoryWeights || !algorithmConfig) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, categoryWeights, algorithmConfig'
        });
      }

      const config = await prisma.adminScanConfig.create({
        data: {
          name,
          maxScore,
          categoryWeights,
          checkWeights,
          algorithmConfig,
          aiModelConfig: aiModelConfig || {
            models: ['claude-sonnet-4.5', 'gpt-4', 'gemini-1.5-flash'],
            consensusWeights: { claude: 0.35, gpt4: 0.35, gemini: 0.30 }
          },
          isActive: false
        }
      });

      logger.info('[Admin Config] Created new configuration:', config.id);

      res.status(201).json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[Admin Config] Error creating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create configuration'
      });
    }
  }

  /**
   * PUT /api/admin/config/:id
   * Update configuration
   */
  async updateConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Don't allow updating isActive through this endpoint
      delete updates.isActive;

      const config = await prisma.adminScanConfig.update({
        where: { id },
        data: updates
      });

      logger.info('[Admin Config] Updated configuration:', id);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[Admin Config] Error updating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration'
      });
    }
  }

  /**
   * POST /api/admin/config/:id/activate
   * Activate configuration (deactivates others)
   */
  async activateConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Deactivate all configurations
      await prisma.adminScanConfig.updateMany({
        data: { isActive: false }
      });

      // Activate the specified configuration
      const config = await prisma.adminScanConfig.update({
        where: { id },
        data: { isActive: true }
      });

      logger.info('[Admin Config] Activated configuration:', id);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[Admin Config] Error activating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to activate configuration'
      });
    }
  }

  /**
   * DELETE /api/admin/config/:id
   * Delete configuration (only if not active and has no scans)
   */
  async deleteConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const config = await prisma.adminScanConfig.findUnique({
        where: { id },
        include: {
          _count: { select: { scans: true } }
        }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      if (config.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete active configuration'
        });
      }

      if (config._count.scans > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete configuration with ${config._count.scans} scans`
        });
      }

      await prisma.adminScanConfig.delete({
        where: { id }
      });

      logger.info('[Admin Config] Deleted configuration:', id);

      res.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    } catch (error) {
      logger.error('[Admin Config] Error deleting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete configuration'
      });
    }
  }

  /**
   * GET /api/admin/config/default
   * Get default configuration template
   */
  async getDefaultConfiguration(req: Request, res: Response) {
    const defaultConfig = {
      name: 'New Configuration',
      maxScore: 570,
      categoryWeights: {
        domainAnalysis: 40,
        sslSecurity: 45,
        contentAnalysis: 40,
        phishingPatterns: 50,
        malwareDetection: 45,
        behavioralJS: 25,
        socialEngineering: 30,
        financialFraud: 25,
        identityTheft: 20,
        technicalExploits: 15,
        brandImpersonation: 20,
        trustGraph: 30,
        dataProtection: 50,
        emailSecurity: 25,
        legalCompliance: 35,
        securityHeaders: 25,
        redirectChain: 15,
        threatIntelligence: 55
      },
      checkWeights: {},
      algorithmConfig: {
        scoringMethod: 'contextual',
        enableDynamicScaling: true,
        riskThresholds: {
          safe: 15,
          low: 30,
          medium: 60,
          high: 80,
          critical: 100
        }
      },
      aiModelConfig: {
        models: ['claude-sonnet-4.5', 'gpt-4', 'gemini-1.5-flash'],
        consensusWeights: { claude: 0.35, gpt4: 0.35, gemini: 0.30 }
      }
    };

    res.json({
      success: true,
      data: defaultConfig
    });
  }
}
