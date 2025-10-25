/**
 * V2 Scanner Configuration Controller
 *
 * Manages V2 scan engine configurations:
 * - Get/Update V2 configuration
 * - Enable/Disable V2 globally
 * - Set rollout percentage
 * - Enable/Disable for specific organizations
 * - Shadow mode toggle
 * - Update Vertex AI endpoints
 * - Update thresholds and weights
 * - Get V2 statistics
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { getV2ScannerConfigService } from '../../services/config/v2-scanner-config.service.js';
import { getV2TIService } from '../../services/threat-intel/v2-ti-integration.service.js';

export class V2ConfigController {
  /**
   * GET /api/admin/v2-config
   * Get current V2 configuration
   */
  async getConfig(req: Request, res: Response) {
    try {
      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true },
        orderBy: { updatedAt: 'desc' }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No V2 configuration found'
        });
      }

      logger.info('[V2 Admin] Retrieved V2 config:', config.id);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[V2 Admin] Error getting V2 config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get V2 configuration'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config
   * Update V2 configuration
   */
  async updateConfig(req: Request, res: Response) {
    try {
      const updates = req.body;

      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No V2 configuration found'
        });
      }

      const updatedConfig = await prisma.v2ScannerConfig.update({
        where: { id: config.id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      // Clear config cache
      const v2ConfigService = getV2ScannerConfigService();
      v2ConfigService.clearCache();

      logger.info('[V2 Admin] Updated V2 config:', updatedConfig.id);

      res.json({
        success: true,
        data: updatedConfig,
        message: 'V2 configuration updated successfully'
      });
    } catch (error) {
      logger.error('[V2 Admin] Error updating V2 config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update V2 configuration'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config/enabled
   * Enable/Disable V2 globally
   */
  async setEnabled(req: Request, res: Response) {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled must be a boolean'
        });
      }

      const v2ConfigService = getV2ScannerConfigService();
      await v2ConfigService.setEnabled(enabled);

      logger.info(`[V2 Admin] V2 scanner ${enabled ? 'enabled' : 'disabled'} globally`);

      res.json({
        success: true,
        message: `V2 scanner ${enabled ? 'enabled' : 'disabled'} globally`
      });
    } catch (error) {
      logger.error('[V2 Admin] Error setting V2 enabled state:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update V2 enabled state'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config/rollout
   * Set rollout percentage (0-100)
   */
  async setRollout(req: Request, res: Response) {
    try {
      const { percentage } = req.body;

      if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          success: false,
          error: 'percentage must be a number between 0 and 100'
        });
      }

      const v2ConfigService = getV2ScannerConfigService();
      await v2ConfigService.setRolloutPercentage(percentage);

      logger.info(`[V2 Admin] V2 rollout set to ${percentage}%`);

      res.json({
        success: true,
        message: `V2 rollout set to ${percentage}%`
      });
    } catch (error) {
      logger.error('[V2 Admin] Error setting V2 rollout:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set V2 rollout percentage'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config/shadow-mode
   * Enable/Disable shadow mode
   */
  async setShadowMode(req: Request, res: Response) {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled must be a boolean'
        });
      }

      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No V2 configuration found'
        });
      }

      await prisma.v2ScannerConfig.update({
        where: { id: config.id },
        data: { shadowMode: enabled, updatedAt: new Date() }
      });

      // Clear cache
      const v2ConfigService = getV2ScannerConfigService();
      v2ConfigService.clearCache();

      logger.info(`[V2 Admin] Shadow mode ${enabled ? 'enabled' : 'disabled'}`);

      res.json({
        success: true,
        message: `Shadow mode ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      logger.error('[V2 Admin] Error setting shadow mode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update shadow mode'
      });
    }
  }

  /**
   * POST /api/admin/v2-config/organizations/:orgId/enable
   * Enable V2 for specific organization
   */
  async enableForOrganization(req: Request, res: Response) {
    try {
      const { orgId } = req.params;

      const v2ConfigService = getV2ScannerConfigService();
      await v2ConfigService.enableForOrganization(orgId);

      logger.info(`[V2 Admin] V2 enabled for organization: ${orgId}`);

      res.json({
        success: true,
        message: `V2 enabled for organization ${orgId}`
      });
    } catch (error) {
      logger.error('[V2 Admin] Error enabling V2 for organization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enable V2 for organization'
      });
    }
  }

  /**
   * POST /api/admin/v2-config/organizations/:orgId/disable
   * Disable V2 for specific organization
   */
  async disableForOrganization(req: Request, res: Response) {
    try {
      const { orgId } = req.params;

      const v2ConfigService = getV2ScannerConfigService();
      await v2ConfigService.disableForOrganization(orgId);

      logger.info(`[V2 Admin] V2 disabled for organization: ${orgId}`);

      res.json({
        success: true,
        message: `V2 disabled for organization ${orgId}`
      });
    } catch (error) {
      logger.error('[V2 Admin] Error disabling V2 for organization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable V2 for organization'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config/endpoints
   * Update Vertex AI model endpoints
   */
  async updateEndpoints(req: Request, res: Response) {
    try {
      const {
        urlLexicalBEndpoint,
        tabularRiskEndpoint,
        textPersuasionEndpoint,
        screenshotCnnEndpoint,
        combinerEndpoint
      } = req.body;

      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No V2 configuration found'
        });
      }

      await prisma.v2ScannerConfig.update({
        where: { id: config.id },
        data: {
          urlLexicalBEndpoint,
          tabularRiskEndpoint,
          textPersuasionEndpoint,
          screenshotCnnEndpoint,
          combinerEndpoint,
          updatedAt: new Date()
        }
      });

      // Clear cache
      const v2ConfigService = getV2ScannerConfigService();
      v2ConfigService.clearCache();

      logger.info('[V2 Admin] Updated Vertex AI endpoints');

      res.json({
        success: true,
        message: 'Vertex AI endpoints updated successfully'
      });
    } catch (error) {
      logger.error('[V2 Admin] Error updating endpoints:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update Vertex AI endpoints'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config/thresholds
   * Update branch thresholds and stage thresholds
   */
  async updateThresholds(req: Request, res: Response) {
    try {
      const {
        branchThresholds,
        stage2ConfidenceThreshold
      } = req.body;

      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No V2 configuration found'
        });
      }

      await prisma.v2ScannerConfig.update({
        where: { id: config.id },
        data: {
          branchThresholds: branchThresholds || config.branchThresholds,
          stage2ConfidenceThreshold: stage2ConfidenceThreshold || config.stage2ConfidenceThreshold,
          updatedAt: new Date()
        }
      });

      // Clear cache
      const v2ConfigService = getV2ScannerConfigService();
      v2ConfigService.clearCache();

      logger.info('[V2 Admin] Updated thresholds');

      res.json({
        success: true,
        message: 'Thresholds updated successfully'
      });
    } catch (error) {
      logger.error('[V2 Admin] Error updating thresholds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update thresholds'
      });
    }
  }

  /**
   * PUT /api/admin/v2-config/weights
   * Update model weights (stage1 and stage2)
   */
  async updateWeights(req: Request, res: Response) {
    try {
      const {
        stage1Weights,
        stage2Weights
      } = req.body;

      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No V2 configuration found'
        });
      }

      await prisma.v2ScannerConfig.update({
        where: { id: config.id },
        data: {
          stage1Weights: stage1Weights || config.stage1Weights,
          stage2Weights: stage2Weights || config.stage2Weights,
          updatedAt: new Date()
        }
      });

      // Clear cache
      const v2ConfigService = getV2ScannerConfigService();
      v2ConfigService.clearCache();

      logger.info('[V2 Admin] Updated model weights');

      res.json({
        success: true,
        message: 'Model weights updated successfully'
      });
    } catch (error) {
      logger.error('[V2 Admin] Error updating weights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update model weights'
      });
    }
  }

  /**
   * GET /api/admin/v2-config/stats
   * Get V2 statistics (scan counts, enabled orgs, etc.)
   */
  async getStats(req: Request, res: Response) {
    try {
      const v2ConfigService = getV2ScannerConfigService();
      const stats = await v2ConfigService.getStats();

      // Get TI stats
      const v2TIService = getV2TIService();
      const tiStats = await v2TIService.getStats();

      logger.info('[V2 Admin] Retrieved V2 statistics');

      res.json({
        success: true,
        data: {
          scanner: stats,
          threatIntel: tiStats
        }
      });
    } catch (error) {
      logger.error('[V2 Admin] Error getting V2 stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get V2 statistics'
      });
    }
  }

  /**
   * GET /api/admin/v2-config/models
   * Get deployed model registry
   */
  async getModels(req: Request, res: Response) {
    try {
      const models = await prisma.v2ModelRegistry.findMany({
        orderBy: { updatedAt: 'desc' }
      });

      logger.info('[V2 Admin] Retrieved model registry:', models.length);

      res.json({
        success: true,
        data: models,
        total: models.length
      });
    } catch (error) {
      logger.error('[V2 Admin] Error getting models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get model registry'
      });
    }
  }

  /**
   * GET /api/admin/v2-config/training-datasets
   * Get training datasets
   */
  async getTrainingDatasets(req: Request, res: Response) {
    try {
      const datasets = await prisma.v2TrainingDataset.findMany({
        orderBy: { createdAt: 'desc' }
      });

      logger.info('[V2 Admin] Retrieved training datasets:', datasets.length);

      res.json({
        success: true,
        data: datasets,
        total: datasets.length
      });
    } catch (error) {
      logger.error('[V2 Admin] Error getting training datasets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get training datasets'
      });
    }
  }

  /**
   * POST /api/admin/v2-config/compare
   * Compare V1 vs V2 results for a URL (shadow testing)
   */
  async compareResults(req: Request, res: Response) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      logger.info(`[V2 Admin] Running V1 vs V2 comparison for: ${url}`);

      // Import scanners
      const { enhancedScanURL } = await import('../../scanners/url-scanner/index.js');
      const { createURLScannerV2 } = await import('../../scanners/url-scanner-v2/index.js');

      // Run V1
      const v1StartTime = Date.now();
      const v1Result = await enhancedScanURL(url);
      const v1Duration = Date.now() - v1StartTime;

      // Run V2
      const v2ConfigService = getV2ScannerConfigService();
      const v2Config = await v2ConfigService.getActiveConfig();
      const v2Scanner = createURLScannerV2(v2Config);

      const v2StartTime = Date.now();
      const v2Result = await v2Scanner.scan(url);
      const v2Duration = Date.now() - v2StartTime;

      // Comparison
      const comparison = {
        url,
        v1: {
          riskScore: v1Result.riskScore,
          riskLevel: v1Result.riskLevel,
          verdict: v1Result.verdict,
          duration: v1Duration
        },
        v2: {
          riskScore: v2Result.riskScore,
          riskLevel: v2Result.riskLevel,
          verdict: v2Result.verdict,
          probability: v2Result.probability,
          confidenceInterval: v2Result.confidenceInterval,
          duration: v2Duration
        },
        agreement: {
          riskLevelMatch: v1Result.riskLevel === v2Result.riskLevel,
          scoreDifference: Math.abs((v1Result.riskScore || 0) - v2Result.riskScore),
          durationImprovement: v1Duration - v2Duration
        }
      };

      logger.info(`[V2 Admin] Comparison completed - Agreement: ${comparison.agreement.riskLevelMatch}`);

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      logger.error('[V2 Admin] Error comparing results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare V1 vs V2 results'
      });
    }
  }
}

export const v2ConfigController = new V2ConfigController();
