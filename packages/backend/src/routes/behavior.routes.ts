/**
 * BEHAVIORAL ANALYSIS API ROUTES
 *
 * Routes for behavioral biometrics and scam behavior detection
 */

import { Router } from 'express';
import { behaviorController } from '../controllers/behavior.controller.js';

const router: any = Router();

// POST /api/v2/behavior/report - Receive behavior report from browser extension
router.post('/report', (req, res) => behaviorController.reportBehavior(req, res));

// GET /api/v2/behavior/stats/:domain - Get aggregated behavior stats for a domain
router.get('/stats/:domain', (req, res) => behaviorController.getDomainBehaviorStats(req, res));

export default router;
