/**
 * V2 Presets Controller
 *
 * Manages V2 scanner configuration presets (strict, balanced, lenient, custom).
 * Allows admins to create, apply, and manage preset configurations.
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { getV2ScannerConfigService } from '../../services/config/v2-scanner-config.service.js';

export class V2PresetsController {
  /**
   * GET /api/admin/v2-presets
   * List all presets
   */
  async getPresets(req: Request, res: Response) {
    try {
      const { category } = req.query;

      const where: any = {};
      if (category) where.category = category as string;

      const presets = await prisma.v2Preset.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { category: 'asc' }, { name: 'asc' }]
      });

      logger.info(`[V2 Presets] Retrieved ${presets.length} presets`);

      res.json({
        success: true,
        data: presets,
        total: presets.length
      });
    } catch (error) {
      logger.error('[V2 Presets] Error getting presets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get presets'
      });
    }
  }

  /**
   * GET /api/admin/v2-presets/:id
   * Get single preset
   */
  async getPreset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const preset = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      logger.info(`[V2 Presets] Retrieved preset: ${preset.name}`);

      res.json({
        success: true,
        data: preset
      });
    } catch (error) {
      logger.error('[V2 Presets] Error getting preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get preset'
      });
    }
  }

  /**
   * POST /api/admin/v2-presets
   * Create new custom preset
   */
  async createPreset(req: Request, res: Response) {
    try {
      const presetData = req.body;

      // Validate required fields
      const required = ['name', 'displayName', 'config', 'branchThresholds', 'stage1Weights', 'stage2Weights'];
      const missing = required.filter(field => !presetData[field]);
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        });
      }

      // Check for duplicate name
      const existing = await prisma.v2Preset.findUnique({
        where: { name: presetData.name }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Preset with name '${presetData.name}' already exists`
        });
      }

      const preset = await prisma.v2Preset.create({
        data: {
          ...presetData,
          category: presetData.category || 'custom',
          isSystem: false, // Custom presets are not system presets
          isDefault: false
        }
      });

      logger.info(`[V2 Presets] Created preset: ${preset.name}`);

      res.status(201).json({
        success: true,
        data: preset,
        message: 'Preset created successfully'
      });
    } catch (error) {
      logger.error('[V2 Presets] Error creating preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create preset'
      });
    }
  }

  /**
   * PUT /api/admin/v2-presets/:id
   * Update preset
   */
  async updatePreset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      // Prevent modifying system presets' core properties
      if (existing.isSystem && (updates.name || updates.isSystem !== undefined)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot modify name or system status of system presets'
        });
      }

      const preset = await prisma.v2Preset.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      logger.info(`[V2 Presets] Updated preset: ${preset.name}`);

      res.json({
        success: true,
        data: preset,
        message: 'Preset updated successfully'
      });
    } catch (error) {
      logger.error('[V2 Presets] Error updating preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preset'
      });
    }
  }

  /**
   * DELETE /api/admin/v2-presets/:id
   * Delete preset (only custom presets)
   */
  async deletePreset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const preset = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      if (preset.isSystem) {
        return res.status(403).json({
          success: false,
          error: 'Cannot delete system presets'
        });
      }

      await prisma.v2Preset.delete({
        where: { id }
      });

      logger.info(`[V2 Presets] Deleted preset: ${preset.name}`);

      res.json({
        success: true,
        message: 'Preset deleted successfully'
      });
    } catch (error) {
      logger.error('[V2 Presets] Error deleting preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete preset'
      });
    }
  }

  /**
   * POST /api/admin/v2-presets/:id/apply
   * Apply preset to active V2 configuration
   */
  async applyPreset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const preset = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      // Get active V2 config
      const config = await prisma.v2ScannerConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No active V2 configuration found'
        });
      }

      // Apply preset configuration
      const presetConfig = preset.config as any;

      await prisma.v2ScannerConfig.update({
        where: { id: config.id },
        data: {
          // Apply preset settings
          ...(presetConfig.rolloutPercentage !== undefined && { rolloutPercentage: presetConfig.rolloutPercentage }),
          ...(presetConfig.shadowMode !== undefined && { shadowMode: presetConfig.shadowMode }),
          ...(presetConfig.stage2ConfidenceThreshold !== undefined && { stage2ConfidenceThreshold: presetConfig.stage2ConfidenceThreshold }),

          // Apply thresholds and weights
          branchThresholds: preset.branchThresholds,
          stage1Weights: preset.stage1Weights,
          stage2Weights: preset.stage2Weights,

          updatedAt: new Date()
        }
      });

      // Apply check overrides if any
      if (preset.checkOverrides && Array.isArray(preset.checkOverrides)) {
        const overrides = preset.checkOverrides as any[];
        for (const override of overrides) {
          if (override.checkId) {
            await prisma.v2CheckDefinition.update({
              where: { id: override.checkId },
              data: {
                ...(override.enabled !== undefined && { enabled: override.enabled }),
                ...(override.weight !== undefined && { weight: override.weight }),
                ...(override.threshold !== undefined && { threshold: override.threshold }),
                updatedAt: new Date()
              }
            }).catch(() => {}); // Ignore errors for missing checks
          }
        }
      }

      // Increment usage counter
      await prisma.v2Preset.update({
        where: { id },
        data: { timesUsed: preset.timesUsed + 1 }
      });

      // Clear config cache
      const v2ConfigService = getV2ScannerConfigService();
      v2ConfigService.clearCache();

      logger.info(`[V2 Presets] Applied preset ${preset.name} to active config`);

      res.json({
        success: true,
        message: `Preset '${preset.displayName}' applied successfully`
      });
    } catch (error) {
      logger.error('[V2 Presets] Error applying preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply preset'
      });
    }
  }

  /**
   * POST /api/admin/v2-presets/:id/clone
   * Clone preset to create a custom one
   */
  async clonePreset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, displayName } = req.body;

      if (!name || !displayName) {
        return res.status(400).json({
          success: false,
          error: 'name and displayName are required'
        });
      }

      const source = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!source) {
        return res.status(404).json({
          success: false,
          error: 'Source preset not found'
        });
      }

      // Check for duplicate name
      const existing = await prisma.v2Preset.findUnique({
        where: { name }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Preset with name '${name}' already exists`
        });
      }

      const clone = await prisma.v2Preset.create({
        data: {
          name,
          displayName,
          description: `Cloned from ${source.displayName}`,
          category: 'custom',
          config: source.config,
          checkOverrides: source.checkOverrides,
          branchThresholds: source.branchThresholds,
          stage1Weights: source.stage1Weights,
          stage2Weights: source.stage2Weights,
          isDefault: false,
          isSystem: false,
          timesUsed: 0
        }
      });

      logger.info(`[V2 Presets] Cloned preset ${source.name} to ${clone.name}`);

      res.status(201).json({
        success: true,
        data: clone,
        message: 'Preset cloned successfully'
      });
    } catch (error) {
      logger.error('[V2 Presets] Error cloning preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clone preset'
      });
    }
  }

  /**
   * POST /api/admin/v2-presets/:id/set-default
   * Set preset as default
   */
  async setDefaultPreset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const preset = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      // Unset all other defaults
      await prisma.v2Preset.updateMany({
        where: { isDefault: true },
        data: { isDefault: false, updatedAt: new Date() }
      });

      // Set this one as default
      await prisma.v2Preset.update({
        where: { id },
        data: { isDefault: true, updatedAt: new Date() }
      });

      logger.info(`[V2 Presets] Set ${preset.name} as default preset`);

      res.json({
        success: true,
        message: `Preset '${preset.displayName}' set as default`
      });
    } catch (error) {
      logger.error('[V2 Presets] Error setting default preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set default preset'
      });
    }
  }

  /**
   * GET /api/admin/v2-presets/export/:id
   * Export preset as JSON
   */
  async exportPreset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const preset = await prisma.v2Preset.findUnique({
        where: { id }
      });

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      // Remove IDs and timestamps for portability
      const exported = {
        name: preset.name,
        displayName: preset.displayName,
        description: preset.description,
        category: preset.category,
        config: preset.config,
        checkOverrides: preset.checkOverrides,
        branchThresholds: preset.branchThresholds,
        stage1Weights: preset.stage1Weights,
        stage2Weights: preset.stage2Weights
      };

      logger.info(`[V2 Presets] Exported preset: ${preset.name}`);

      res.json({
        success: true,
        data: exported
      });
    } catch (error) {
      logger.error('[V2 Presets] Error exporting preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export preset'
      });
    }
  }

  /**
   * POST /api/admin/v2-presets/import
   * Import preset from JSON
   */
  async importPreset(req: Request, res: Response) {
    try {
      const presetData = req.body;

      if (!presetData.name || !presetData.displayName) {
        return res.status(400).json({
          success: false,
          error: 'name and displayName are required'
        });
      }

      // Check for duplicate
      const existing = await prisma.v2Preset.findUnique({
        where: { name: presetData.name }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Preset with name '${presetData.name}' already exists`
        });
      }

      const preset = await prisma.v2Preset.create({
        data: {
          ...presetData,
          isSystem: false,
          isDefault: false,
          timesUsed: 0
        }
      });

      logger.info(`[V2 Presets] Imported preset: ${preset.name}`);

      res.status(201).json({
        success: true,
        data: preset,
        message: 'Preset imported successfully'
      });
    } catch (error) {
      logger.error('[V2 Presets] Error importing preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import preset'
      });
    }
  }
}

export const v2PresetsController = new V2PresetsController();
