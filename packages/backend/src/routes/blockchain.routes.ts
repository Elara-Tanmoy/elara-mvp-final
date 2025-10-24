/**
 * BLOCKCHAIN API ROUTES
 * Routes for blockchain-based scam reporting and rewards
 */

import { Router } from 'express';
import { blockchainController } from '../controllers/blockchain.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { createTierBasedRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();
const rateLimiter = createTierBasedRateLimiter();

/**
 * PUBLIC ROUTES
 */

// GET /api/v2/blockchain/gas-price - Get current gas price
router.get('/gas-price', (req, res) => blockchainController.getGasPrice(req, res));

// GET /api/v2/blockchain/reports/:domain - Get blockchain reports for a domain
router.get('/reports/:domain', (req, res) => blockchainController.getDomainReports(req, res));

// GET /api/v2/blockchain/profile/:address - Get reporter profile
router.get('/profile/:address', (req, res) => blockchainController.getReporterProfile(req, res));

// GET /api/v2/blockchain/rewards/:address - Get user rewards
router.get('/rewards/:address', (req, res) => blockchainController.getUserRewards(req, res));

// GET /api/v2/blockchain/badges/:address - Get user badges
router.get('/badges/:address', (req, res) => blockchainController.getUserBadges(req, res));

/**
 * AUTHENTICATED USER ROUTES
 */

// POST /api/v2/blockchain/report - Submit scam report (requires wallet)
router.post('/report', rateLimiter, (req, res) => blockchainController.submitReport(req, res));

// POST /api/v2/blockchain/vote - Vote on report (requires wallet)
router.post('/vote', rateLimiter, (req, res) => blockchainController.voteOnReport(req, res));

/**
 * ADMIN-ONLY ROUTES
 */

// POST /api/v2/blockchain/admin/distribute-reward - Distribute ELARA tokens
router.post('/admin/distribute-reward', requireAdmin, (req, res) =>
  blockchainController.distributeReward(req, res)
);

// POST /api/v2/blockchain/admin/batch-rewards - Batch distribute rewards
router.post('/admin/batch-rewards', requireAdmin, (req, res) =>
  blockchainController.batchDistributeRewards(req, res)
);

// POST /api/v2/blockchain/admin/mint-badge - Mint reputation badge
router.post('/admin/mint-badge', requireAdmin, (req, res) =>
  blockchainController.mintBadge(req, res)
);

export default router;
