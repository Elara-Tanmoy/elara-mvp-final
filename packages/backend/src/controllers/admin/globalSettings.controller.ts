/**
 * GLOBAL SETTINGS ADMIN CONTROLLER
 *
 * Manages global settings via admin API:
 * - List all settings
 * - Get setting by key
 * - Update setting
 * - Create setting
 * - Delete setting
 * - Test connection (for API keys)
 */

import { Request, Response } from 'express';
import { settingsService } from '../../services/config/settings.service.js';
import { logger } from '../../config/logger.js';

/**
 * GET /api/v2/admin/global-settings
 * List all settings (admin only)
 */
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const { category, includeValues } = req.query;

    let settings;
    if (category) {
      const categorySettings = await settingsService.getByCategory(category as string);
      settings = Object.entries(categorySettings).map(([key, value]) => ({
        key,
        value: includeValues === 'true' ? value : undefined
      }));
    } else {
      settings = await settingsService.getAll(includeValues === 'true');
    }

    res.json({
      success: true,
      data: settings,
      count: settings.length
    });

  } catch (error) {
    logger.error('[Admin] Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
};

/**
 * GET /api/v2/admin/global-settings/:key
 * Get single setting by key
 */
export const getSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const value = await settingsService.get(key);

    if (value === undefined || value === null) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }

    res.json({
      success: true,
      data: { key, value }
    });

  } catch (error) {
    logger.error(`[Admin] Error getting setting ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve setting'
    });
  }
};

/**
 * POST /api/v2/admin/global-settings
 * Create or update a setting
 */
export const upsertSetting = async (req: Request, res: Response) => {
  try {
    const {
      key,
      value,
      category,
      isSensitive,
      description,
      required,
      environment
    } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Key is required'
      });
    }

    const userId = (req as any).user?.id || 'admin';

    const success = await settingsService.set(key, value, {
      category,
      isSensitive,
      description,
      required,
      environment,
      updatedBy: userId
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save setting'
      });
    }

    res.json({
      success: true,
      message: `Setting ${key} updated successfully`
    });

  } catch (error) {
    logger.error('[Admin] Error upserting setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save setting'
    });
  }
};

/**
 * PUT /api/v2/admin/global-settings/:key
 * Update existing setting
 */
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, ...options } = req.body;

    const userId = (req as any).user?.id || 'admin';

    const success = await settingsService.set(key, value, {
      ...options,
      updatedBy: userId
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update setting'
      });
    }

    res.json({
      success: true,
      message: `Setting ${key} updated successfully`
    });

  } catch (error) {
    logger.error(`[Admin] Error updating setting ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting'
    });
  }
};

/**
 * DELETE /api/v2/admin/global-settings/:key
 * Delete (deactivate) a setting
 */
export const deleteSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const success = await settingsService.delete(key);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete setting'
      });
    }

    res.json({
      success: true,
      message: `Setting ${key} deleted successfully`
    });

  } catch (error) {
    logger.error(`[Admin] Error deleting setting ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete setting'
    });
  }
};

/**
 * POST /api/v2/admin/global-settings/:key/test
 * Test a connection (for API keys)
 */
export const testConnection = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const result = await settingsService.testConnection(key);

    res.json({
      success: result.success,
      data: result
    });

  } catch (error) {
    logger.error(`[Admin] Error testing connection for ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/v2/admin/global-settings/categories
 * Get list of all categories
 */
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = [
      { id: 'api_keys', name: 'API Keys', icon: 'Key', description: 'Third-party API keys' },
      { id: 'database', name: 'Database', icon: 'Database', description: 'Database connections' },
      { id: 'security', name: 'Security', icon: 'Shield', description: 'Security settings' },
      { id: 'services', name: 'External Services', icon: 'Cloud', description: 'Third-party services' },
      { id: 'performance', name: 'Performance', icon: 'Zap', description: 'Performance tuning' },
      { id: 'features', name: 'Feature Flags', icon: 'Flag', description: 'Feature toggles' },
      { id: 'application', name: 'Application', icon: 'Settings', description: 'Core application settings' }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    logger.error('[Admin] Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories'
    });
  }
};

/**
 * POST /api/v2/admin/global-settings/cache/clear
 * Clear settings cache
 */
export const clearCache = async (req: Request, res: Response) => {
  try {
    settingsService.clearCache();

    res.json({
      success: true,
      message: 'Settings cache cleared'
    });

  } catch (error) {
    logger.error('[Admin] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
};

/**
 * GET /api/v2/admin/global-settings/cache/stats
 * Get cache statistics
 */
export const getCacheStats = async (req: Request, res: Response) => {
  try {
    const stats = settingsService.getCacheStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('[Admin] Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache stats'
    });
  }
};
