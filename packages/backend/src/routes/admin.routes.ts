/**
 * Admin Routes
 *
 * Admin panel API routes for:
 * - Configuration management
 * - Scan history
 * - Analytics & reporting
 * - System health
 */

import { Router } from 'express';
import { AdminConfigController } from '../controllers/admin/config.controller.js';
import { AdminScansController } from '../controllers/admin/scans.controller.js';
import { AdminAnalyticsController } from '../controllers/admin/analytics.controller.js';
import { AdminHealthController } from '../controllers/admin/health.controller.js';
import { scanConfigAdminController } from '../controllers/scan-config-admin.controller.js';
import { v2ConfigController } from '../controllers/admin/v2-config.controller.js';

const router = Router();

// Initialize controllers
const configController = new AdminConfigController();
const scansController = new AdminScansController();
const analyticsController = new AdminAnalyticsController();
const healthController = new AdminHealthController();

// ========================================
// Configuration Management Routes
// ========================================
// Get complete schema (categories, checks, TI sources, defaults)
router.get('/schema', (req, res) => scanConfigAdminController.getSchema(req, res));

// Configuration CRUD
router.get('/config', (req, res) => scanConfigAdminController.getAllConfigurations(req, res));
router.get('/config/active', (req, res) => scanConfigAdminController.getActiveConfiguration(req, res));
router.get('/config/:id', (req, res) => scanConfigAdminController.getConfiguration(req, res));
router.post('/config', (req, res) => scanConfigAdminController.createConfiguration(req, res));
router.put('/config/:id', (req, res) => scanConfigAdminController.updateConfiguration(req, res));
router.patch('/config/:id/activate', (req, res) => scanConfigAdminController.activateConfiguration(req, res));
router.delete('/config/:id', (req, res) => scanConfigAdminController.deleteConfiguration(req, res));

// Configuration Management
router.get('/config/:id/export', (req, res) => scanConfigAdminController.exportConfiguration(req, res));
router.post('/config/import', (req, res) => scanConfigAdminController.importConfiguration(req, res));
router.post('/config/:id/clone', (req, res) => scanConfigAdminController.cloneConfiguration(req, res));
router.get('/config/:id/history', (req, res) => scanConfigAdminController.getConfigurationHistory(req, res));

// Calibration & Testing
router.post('/calibrate', (req, res) => scanConfigAdminController.calibrateScan(req, res));
router.post('/calibrate/compare', (req, res) => scanConfigAdminController.compareConfigurations(req, res));

// Presets
router.get('/presets', (req, res) => scanConfigAdminController.getPresets(req, res));
router.post('/preset/:presetName/apply', (req, res) => scanConfigAdminController.applyPreset(req, res));

// Statistics
router.get('/stats', (req, res) => scanConfigAdminController.getScanStatistics(req, res));

// ========================================
// V2 Scanner Configuration Routes
// ========================================
// Get/Update V2 Configuration
router.get('/v2-config', (req, res) => v2ConfigController.getConfig(req, res));
router.put('/v2-config', (req, res) => v2ConfigController.updateConfig(req, res));

// Enable/Disable & Rollout
router.put('/v2-config/enabled', (req, res) => v2ConfigController.setEnabled(req, res));
router.put('/v2-config/rollout', (req, res) => v2ConfigController.setRollout(req, res));
router.put('/v2-config/shadow-mode', (req, res) => v2ConfigController.setShadowMode(req, res));

// Organization Management
router.post('/v2-config/organizations/:orgId/enable', (req, res) => v2ConfigController.enableForOrganization(req, res));
router.post('/v2-config/organizations/:orgId/disable', (req, res) => v2ConfigController.disableForOrganization(req, res));

// Vertex AI Endpoints & Configuration
router.put('/v2-config/endpoints', (req, res) => v2ConfigController.updateEndpoints(req, res));
router.put('/v2-config/thresholds', (req, res) => v2ConfigController.updateThresholds(req, res));
router.put('/v2-config/weights', (req, res) => v2ConfigController.updateWeights(req, res));

// Statistics & Monitoring
router.get('/v2-config/stats', (req, res) => v2ConfigController.getStats(req, res));
router.get('/v2-config/models', (req, res) => v2ConfigController.getModels(req, res));
router.get('/v2-config/training-datasets', (req, res) => v2ConfigController.getTrainingDatasets(req, res));

// V1 vs V2 Comparison (Shadow Testing)
router.post('/v2-config/compare', (req, res) => v2ConfigController.compareResults(req, res));

// ========================================
// PHASE 1: Enterprise Features - Check Definition Management
// ========================================
router.get('/checks', (req, res) => scanConfigAdminController.getCheckDefinitions(req, res));
router.post('/checks', (req, res) => scanConfigAdminController.createCheckDefinition(req, res));
router.put('/checks/:id', (req, res) => scanConfigAdminController.updateCheckDefinition(req, res));
router.delete('/checks/:id', (req, res) => scanConfigAdminController.deleteCheckDefinition(req, res));
router.post('/checks/:id/toggle', (req, res) => scanConfigAdminController.toggleCheckDefinition(req, res));
router.post('/checks/:id/test', (req, res) => scanConfigAdminController.testCheckConnection(req, res));

// ========================================
// PHASE 1: Enterprise Features - AI Model Management
// ========================================
router.get('/ai-models', (req, res) => scanConfigAdminController.getAIModels(req, res));
router.post('/ai-models', (req, res) => scanConfigAdminController.createAIModel(req, res));
router.put('/ai-models/:id', (req, res) => scanConfigAdminController.updateAIModel(req, res));
router.delete('/ai-models/:id', (req, res) => scanConfigAdminController.deleteAIModel(req, res));
router.post('/ai-models/:id/test', (req, res) => scanConfigAdminController.testAIModel(req, res));

// ========================================
// PHASE 1: Enterprise Features - TI Source Management
// ========================================
router.get('/ti-sources', (req, res) => scanConfigAdminController.getTISources(req, res));
router.post('/ti-sources', (req, res) => scanConfigAdminController.createTISource(req, res));
router.put('/ti-sources/:id', (req, res) => scanConfigAdminController.updateTISource(req, res));
router.delete('/ti-sources/:id', (req, res) => scanConfigAdminController.deleteTISource(req, res));
router.post('/ti-sources/:id/test', (req, res) => scanConfigAdminController.testTISource(req, res));

// ========================================
// PHASE 1: Enterprise Features - AI Consensus Configuration
// ========================================
router.get('/consensus-configs', (req, res) => scanConfigAdminController.getConsensusConfigs(req, res));
router.post('/consensus-configs', (req, res) => scanConfigAdminController.createConsensusConfig(req, res));
router.put('/consensus-configs/:id', (req, res) => scanConfigAdminController.updateConsensusConfig(req, res));
router.delete('/consensus-configs/:id', (req, res) => scanConfigAdminController.deleteConsensusConfig(req, res));
router.post('/consensus-configs/:id/activate', (req, res) => scanConfigAdminController.activateConsensusConfig(req, res));

// ========================================
// Scan History Routes
// ========================================
router.get('/scans', (req, res) => scansController.listScans(req, res));
router.get('/scans/stats', (req, res) => scansController.getStats(req, res));
router.get('/scans/recent', (req, res) => scansController.getRecentScans(req, res));
router.get('/scans/:id', (req, res) => scansController.getScan(req, res));
router.delete('/scans/:id', (req, res) => scansController.deleteScan(req, res));
router.post('/scans/bulk-delete', (req, res) => scansController.bulkDeleteScans(req, res));

// ========================================
// Analytics & Reporting Routes
// ========================================
router.get('/analytics/overview', (req, res) => analyticsController.getOverview(req, res));
router.get('/analytics/timeseries', (req, res) => analyticsController.getTimeSeries(req, res));
router.get('/analytics/categories', (req, res) => analyticsController.getCategoryAnalytics(req, res));
router.get('/analytics/ti-sources', (req, res) => analyticsController.getTISourceAnalytics(req, res));
router.get('/analytics/ai-consensus', (req, res) => analyticsController.getAIConsensusAnalytics(req, res));

// ========================================
// System Health Routes
// ========================================
router.get('/health', (req, res) => healthController.getSystemHealth(req, res));
router.get('/health/database', (req, res) => healthController.getDatabaseHealth(req, res));
router.get('/health/performance', (req, res) => healthController.getPerformanceMetrics(req, res));
router.get('/health/ti-sources', (req, res) => healthController.getTISourceHealth(req, res));
router.get('/health/realtime', (req, res) => healthController.getRealtimeStats(req, res));

export default router;
