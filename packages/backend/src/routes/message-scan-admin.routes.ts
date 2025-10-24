/**
 * Message Scan Admin Routes
 *
 * Admin panel API routes for Message Scan configuration:
 * - Configuration management
 * - AI model configuration
 * - Detection rules
 * - Threat intelligence
 * - Performance tuning
 * - Real-time testing
 * - Presets management
 * - Export/Import configurations
 */

import { Router } from 'express';
import { messageScanAdminController } from '../controllers/admin/message-scan-admin.controller.js';

const router = Router();

// ========================================
// Configuration Management Routes
// ========================================

// Configuration CRUD
router.get('/configs', (req, res) => messageScanAdminController.getAllConfigurations(req, res));
router.get('/config/active', (req, res) => messageScanAdminController.getActiveConfiguration(req, res));
router.get('/config/:id', (req, res) => messageScanAdminController.getConfiguration(req, res));
router.post('/config', (req, res) => messageScanAdminController.createConfiguration(req, res));
router.put('/config/:id', (req, res) => messageScanAdminController.updateConfiguration(req, res));
router.patch('/config/:id/activate', (req, res) => messageScanAdminController.activateConfiguration(req, res));
router.delete('/config/:id', (req, res) => messageScanAdminController.deleteConfiguration(req, res));

// ========================================
// Testing & Management
// ========================================

// Real-time testing
router.post('/test', (req, res) => messageScanAdminController.testConfiguration(req, res));

// ========================================
// Presets Management
// ========================================

// Presets
router.get('/presets', (req, res) => messageScanAdminController.getPresets(req, res));
router.post('/preset/:presetName/apply', (req, res) => messageScanAdminController.applyPreset(req, res));

// ========================================
// Configuration Management
// ========================================

// Export/Import
router.get('/config/:id/export', (req, res) => messageScanAdminController.exportConfiguration(req, res));
router.post('/config/import', (req, res) => messageScanAdminController.importConfiguration(req, res));

export default router;
