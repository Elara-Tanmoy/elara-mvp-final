/**
 * TRUST GRAPH API ROUTES
 *
 * Routes for the Trust Graph network analysis feature
 */

import { Router } from 'express';
import { graphController } from '../controllers/graph.controller.js';

const router = Router();

// GET /api/v2/graph/entity/:domain - Get entity information for a domain (alias for network)
router.get('/entity/:domain', (req, res) => graphController.getNetworkAnalysis(req, res));

// GET /api/v2/graph/network/:domain - Get network analysis for a domain
router.get('/network/:domain', (req, res) => graphController.getNetworkAnalysis(req, res));

// GET /api/v2/graph/visualization/:domain - Get graph visualization data
router.get('/visualization/:domain', (req, res) => graphController.getGraphVisualization(req, res));

// GET /api/v2/graph/bulk-registration/:registrar - Detect bulk registration patterns
router.get('/bulk-registration/:registrar', (req, res) => graphController.getBulkRegistration(req, res));

// POST /api/v2/graph/build - Manually trigger graph build for a domain
router.post('/build', (req, res) => graphController.buildDomainGraph(req, res));

export default router;
