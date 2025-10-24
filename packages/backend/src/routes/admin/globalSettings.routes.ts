/**
 * GLOBAL SETTINGS ADMIN ROUTES
 *
 * Routes for managing global settings via admin panel
 */

import { Router } from 'express';
import {
  getAllSettings,
  getSetting,
  upsertSetting,
  updateSetting,
  deleteSetting,
  testConnection,
  getCategories,
  clearCache,
  getCacheStats
} from '../../controllers/admin/globalSettings.controller.js';

const router: any = Router();

// Get all settings (with optional category filter)
router.get('/', getAllSettings);

// Get setting categories
router.get('/categories', getCategories);

// Cache management
router.post('/cache/clear', clearCache);
router.get('/cache/stats', getCacheStats);

// Get single setting
router.get('/:key', getSetting);

// Create or update setting
router.post('/', upsertSetting);

// Update setting
router.put('/:key', updateSetting);

// Delete setting
router.delete('/:key', deleteSetting);

// Test connection (for API keys)
router.post('/:key/test', testConnection);

export default router;
