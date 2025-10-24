/**
 * THREAT INTELLIGENCE ROUTES
 *
 * Admin-only routes for managing threat intelligence
 */

import { Router } from 'express';
import { threatIntelController } from '../controllers/threatIntel.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';

const router: any = Router();

// All routes require admin access
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v2/threat-intel/stats - Get statistics
router.get('/stats', (req, res) => threatIntelController.getStats(req, res));

// GET /api/v2/threat-intel/sources - Get all sources
router.get('/sources', (req, res) => threatIntelController.getSources(req, res));

// POST /api/v2/threat-intel/sync - Trigger manual sync
router.post('/sync', (req, res) => threatIntelController.triggerSync(req, res));

// GET /api/v2/threat-intel/indicators - Get indicators
router.get('/indicators', (req, res) => threatIntelController.getIndicators(req, res));

// POST /api/v2/threat-intel/check - Check URL against threat database
router.post('/check', (req, res) => threatIntelController.checkURL(req, res));

// GET /api/v2/threat-intel/sync-history - Get sync history
router.get('/sync-history', (req, res) => threatIntelController.getSyncHistory(req, res));

// PATCH /api/v2/threat-intel/sources/:id - Update source
router.patch('/sources/:id', (req, res) => threatIntelController.updateSource(req, res));

// GET /api/v2/threat-intel/sources/:id/config - Get source configuration
router.get('/sources/:id/config', (req, res) => threatIntelController.getSourceConfig(req, res));

// PATCH /api/v2/threat-intel/sources/:id/config - Update source configuration
router.patch('/sources/:id/config', (req, res) => threatIntelController.updateSourceConfig(req, res));

// POST /api/v2/threat-intel/sources/:id/test - Test source connection
router.post('/sources/:id/test', (req, res) => threatIntelController.testSourceConnection(req, res));

export default router;
