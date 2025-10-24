/**
 * FEDERATED LEARNING API ROUTES
 * Privacy-preserving collaborative machine learning
 */

import { Router } from 'express';
import { federatedLearningController } from '../controllers/federatedLearning.controller.js';
import { globalRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

/**
 * PUBLIC ROUTES (no authentication required - privacy-preserving)
 */

// GET /api/v2/federated/model - Download global model
router.get('/model', globalRateLimiter, (req, res) =>
  federatedLearningController.getGlobalModel(req, res)
);

// POST /api/v2/federated/submit-gradients - Submit gradients (anonymous)
router.post('/submit-gradients', globalRateLimiter, (req, res) =>
  federatedLearningController.submitGradients(req, res)
);

// GET /api/v2/federated/round - Get current round status
router.get('/round', globalRateLimiter, (req, res) =>
  federatedLearningController.getCurrentRound(req, res)
);

// GET /api/v2/federated/stats - Get training statistics
router.get('/stats', (req, res) => federatedLearningController.getStats(req, res));

// POST /api/v2/federated/predict - Server-side prediction (testing)
router.post('/predict', globalRateLimiter, (req, res) =>
  federatedLearningController.predict(req, res)
);

export default router;
