/**
 * V2 Scanner Admin Routes
 *
 * All admin endpoints for managing V2 scanner configuration
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import * as v2AdminController from '../controllers/admin/v2-admin.controller.js';

const router = Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticate);
router.use(requireRole(['admin', 'owner']));

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY CONFIG ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/v2-admin/configs - Get all category configs
router.get('/configs', v2AdminController.getAllCategoryConfigs);

// GET /api/v2-admin/configs/active - Get active config
router.get('/configs/active', v2AdminController.getActiveCategoryConfig);

// GET /api/v2-admin/configs/:id - Get config by ID
router.get('/configs/:id', v2AdminController.getCategoryConfigById);

// POST /api/v2-admin/configs - Create new config
router.post('/configs', v2AdminController.createCategoryConfig);

// PUT /api/v2-admin/configs/:id - Update config
router.put('/configs/:id', v2AdminController.updateCategoryConfig);

// POST /api/v2-admin/configs/:id/activate - Activate config
router.post('/configs/:id/activate', v2AdminController.activateCategoryConfig);

// POST /api/v2-admin/configs/:id/duplicate - Duplicate config
router.post('/configs/:id/duplicate', v2AdminController.duplicateCategoryConfig);

// DELETE /api/v2-admin/configs/:id - Delete config
router.delete('/configs/:id', v2AdminController.deleteCategoryConfig);

// ═══════════════════════════════════════════════════════════════════════════
// CHECK CONFIG ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/v2-admin/configs/:configId/checks - Get all checks for config
router.get('/configs/:configId/checks', v2AdminController.getChecksByConfigId);

// GET /api/v2-admin/configs/:configId/checks/stats - Get check stats
router.get('/configs/:configId/checks/stats', v2AdminController.getCheckStats);

// GET /api/v2-admin/checks/:id - Get check by ID
router.get('/checks/:id', v2AdminController.getCheckById);

// POST /api/v2-admin/checks - Create new check
router.post('/checks', v2AdminController.createCheck);

// PUT /api/v2-admin/checks/:id - Update check
router.put('/checks/:id', v2AdminController.updateCheck);

// POST /api/v2-admin/checks/:id/toggle - Toggle check enabled status
router.post('/checks/:id/toggle', v2AdminController.toggleCheck);

// POST /api/v2-admin/checks/:id/reset - Reset check points to default
router.post('/checks/:id/reset', v2AdminController.resetCheckPoints);

// POST /api/v2-admin/configs/:configId/checks/reset-all - Reset all checks
router.post('/configs/:configId/checks/reset-all', v2AdminController.resetAllChecks);

// POST /api/v2-admin/checks/bulk-update - Bulk update checks
router.post('/checks/bulk-update', v2AdminController.bulkUpdateChecks);

// DELETE /api/v2-admin/checks/:id - Delete check
router.delete('/checks/:id', v2AdminController.deleteCheck);

// ═══════════════════════════════════════════════════════════════════════════
// POLICY RULE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/v2-admin/policy-rules - Get all policy rules
router.get('/policy-rules', v2AdminController.getAllPolicyRules);

// GET /api/v2-admin/policy-rules/enabled - Get enabled policy rules
router.get('/policy-rules/enabled', v2AdminController.getEnabledPolicyRules);

// GET /api/v2-admin/policy-rules/stats - Get policy rule stats
router.get('/policy-rules/stats', v2AdminController.getPolicyRuleStats);

// GET /api/v2-admin/policy-rules/:id - Get policy rule by ID
router.get('/policy-rules/:id', v2AdminController.getPolicyRuleById);

// POST /api/v2-admin/policy-rules - Create new policy rule
router.post('/policy-rules', v2AdminController.createPolicyRule);

// PUT /api/v2-admin/policy-rules/:id - Update policy rule
router.put('/policy-rules/:id', v2AdminController.updatePolicyRule);

// POST /api/v2-admin/policy-rules/:id/toggle - Toggle policy rule
router.post('/policy-rules/:id/toggle', v2AdminController.togglePolicyRule);

// POST /api/v2-admin/policy-rules/:id/test - Test policy rule
router.post('/policy-rules/:id/test', v2AdminController.testPolicyRule);

// POST /api/v2-admin/policy-rules/reorder - Reorder policy rules
router.post('/policy-rules/reorder', v2AdminController.reorderPolicyRules);

// DELETE /api/v2-admin/policy-rules/:id - Delete policy rule
router.delete('/policy-rules/:id', v2AdminController.deletePolicyRule);

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH THRESHOLD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/v2-admin/configs/:configId/thresholds - Get all thresholds
router.get('/configs/:configId/thresholds', v2AdminController.getThresholdsByConfigId);

// GET /api/v2-admin/configs/:configId/thresholds/summary - Get threshold summary
router.get('/configs/:configId/thresholds/summary', v2AdminController.getThresholdSummary);

// GET /api/v2-admin/configs/:configId/thresholds/:branch - Get threshold by branch
router.get('/configs/:configId/thresholds/:branch', v2AdminController.getThresholdByBranch);

// POST /api/v2-admin/thresholds - Create new threshold
router.post('/thresholds', v2AdminController.createThreshold);

// PUT /api/v2-admin/thresholds/:id - Update threshold
router.put('/thresholds/:id', v2AdminController.updateThreshold);

// POST /api/v2-admin/configs/:configId/thresholds/bulk-update - Bulk update thresholds
router.post('/configs/:configId/thresholds/bulk-update', v2AdminController.bulkUpdateThresholds);

// DELETE /api/v2-admin/thresholds/:id - Delete threshold
router.delete('/thresholds/:id', v2AdminController.deleteThreshold);

// ═══════════════════════════════════════════════════════════════════════════
// TEST & CALIBRATE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/v2-admin/test/scan - Run test scan
router.post('/test/scan', v2AdminController.testScan);

// POST /api/v2-admin/test/batch - Run batch test
router.post('/test/batch', v2AdminController.batchTest);

// POST /api/v2-admin/test/compare - Compare two configs
router.post('/test/compare', v2AdminController.compareConfigs);

// POST /api/v2-admin/test/calibrate - Calibrate thresholds
router.post('/test/calibrate', v2AdminController.calibrateThresholds);

// POST /api/v2-admin/test/ab-test - Run A/B test
router.post('/test/ab-test', v2AdminController.simulateABTest);

// ═══════════════════════════════════════════════════════════════════════════
// AI SUMMARY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/v2-admin/ai/summary - Generate AI summary
router.post('/ai/summary', v2AdminController.generateAISummary);

export default router;
