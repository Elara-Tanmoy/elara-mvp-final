/**
 * DATA INTELLIGENCE API ROUTES
 *
 * Admin-only routes for accessing captured intelligence data
 * Used for LLM training, analytics, and research
 *
 * SECURITY: All routes require admin role (owner or admin)
 */

import { Router } from 'express';
import { intelligenceController } from '../controllers/intelligence.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';

const router: any = Router();

// Apply authentication and admin-only access to all routes
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v2/intelligence/stats - Get dataset statistics
router.get('/stats', (req, res) => intelligenceController.getStats(req, res));

// GET /api/v2/intelligence/events - Get recent events with filtering
router.get('/events', (req, res) => intelligenceController.getEvents(req, res));

// POST /api/v2/intelligence/search - Search events with complex queries
router.post('/search', (req, res) => intelligenceController.searchEvents(req, res));

// POST /api/v2/intelligence/query - Advanced query builder (SQL-like)
router.post('/query', (req, res) => intelligenceController.customQuery(req, res));

// GET /api/v2/intelligence/export - Export dataset for LLM training
router.get('/export', (req, res) => intelligenceController.exportDataset(req, res));

// GET /api/v2/intelligence/analytics - Get analytics and insights
router.get('/analytics', (req, res) => intelligenceController.getAnalytics(req, res));

// DELETE /api/v2/intelligence/cleanup - Clean old data (retention policy)
router.delete('/cleanup', (req, res) => intelligenceController.cleanupOldData(req, res));

export default router;
