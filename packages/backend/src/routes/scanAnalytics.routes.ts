/**
 * SCAN ANALYTICS ROUTES
 *
 * Admin-only routes for scan data analytics and visualization
 */

import { Router } from 'express';
import { scanAnalyticsController } from '../controllers/scanAnalytics.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';

const router: any = Router();

// Apply authentication and admin-only access to all routes
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v2/analytics/scans/overview - Comprehensive analytics overview
router.get('/overview', (req, res) => scanAnalyticsController.getOverview(req, res));

// GET /api/v2/analytics/scans/detailed - Detailed scan data with filters
router.get('/detailed', (req, res) => scanAnalyticsController.getDetailedScans(req, res));

// GET /api/v2/analytics/scans/raw/:id - Get raw scan data for specific scan
router.get('/raw/:id', (req, res) => scanAnalyticsController.getRawScanData(req, res));

// GET /api/v2/analytics/scans/threats - Threat analysis and insights
router.get('/threats', (req, res) => scanAnalyticsController.getThreatAnalysis(req, res));

// GET /api/v2/analytics/scans/performance - Scan performance metrics
router.get('/performance', (req, res) => scanAnalyticsController.getPerformanceMetrics(req, res));

// GET /api/v2/analytics/scans/export - Export scan analytics data
router.get('/export', (req, res) => scanAnalyticsController.exportAnalytics(req, res));

// GET /api/v2/analytics/scans/realtime - Real-time metrics (last 5 minutes)
router.get('/realtime', (req, res) => scanAnalyticsController.getRealtimeMetrics(req, res));

export default router;
