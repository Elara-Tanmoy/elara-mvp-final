import express from 'express';
import { proxyController } from '../controllers/proxy.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { createTierBasedRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router: any = express.Router();
const rateLimiter = createTierBasedRateLimiter();

// All proxy routes require authentication
// Premium feature - free users may have limited access

/**
 * Health check for proxy feature
 * GET /api/v2/proxy/health
 */
router.get('/health', authenticate, proxyController.healthCheck.bind(proxyController));

/**
 * Create a new proxy session
 * POST /api/v2/proxy/session
 */
router.post('/session', authenticate, rateLimiter, proxyController.createSession.bind(proxyController));

/**
 * Get session details
 * GET /api/v2/proxy/session/:sessionToken
 */
router.get('/session/:sessionToken', authenticate, proxyController.getSession.bind(proxyController));

/**
 * Make a proxied request
 * POST /api/v2/proxy/request
 */
router.post('/request', authenticate, rateLimiter, proxyController.makeRequest.bind(proxyController));

/**
 * Disconnect a session
 * POST /api/v2/proxy/session/:sessionToken/disconnect
 */
router.post('/session/:sessionToken/disconnect', authenticate, proxyController.disconnectSession.bind(proxyController));

/**
 * Get user's session history
 * GET /api/v2/proxy/sessions
 */
router.get('/sessions', authenticate, proxyController.getSessions.bind(proxyController));

/**
 * Get statistics for a session
 * GET /api/v2/proxy/session/:sessionToken/stats
 */
router.get('/session/:sessionToken/stats', authenticate, proxyController.getSessionStats.bind(proxyController));

/**
 * Disconnect all active sessions
 * POST /api/v2/proxy/disconnect-all
 */
router.post('/disconnect-all', authenticate, proxyController.disconnectAllSessions.bind(proxyController));

export default router;
