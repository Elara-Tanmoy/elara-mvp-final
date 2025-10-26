/**
 * V2 Scanner Configuration Routes
 */

import { Router } from 'express';
import {
  getV2Config,
  updateV2Config,
  getV2Presets,
  applyV2Preset,
  testV2Config
} from '../controllers/v2-config.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// All V2 config routes require authentication and admin privileges
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/v2-config
 * Get current V2 scanner configuration
 */
router.get('/', getV2Config);

/**
 * PUT /api/v2-config
 * Update V2 scanner configuration
 */
router.put('/', updateV2Config);

/**
 * GET /api/v2-config/presets
 * Get available configuration presets
 */
router.get('/presets', getV2Presets);

/**
 * POST /api/v2-config/preset
 * Apply a configuration preset
 */
router.post('/preset', applyV2Preset);

/**
 * POST /api/v2-config/test
 * Test URL with custom configuration
 */
router.post('/test', testV2Config);

export default router;
