/**
 * V2 AI API Routes - Central AI API for B2B Partners
 */

import express from 'express';
import { v2AIController } from '../controllers/v2/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { createTierBasedRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();
const rateLimiter = createTierBasedRateLimiter();

/**
 * All V2 AI routes require authentication
 * Rate limiting is applied per organization tier
 */

// AI Analysis endpoint
router.post(
  '/ai/analyze',
  authenticate,
  rateLimiter,
  (req, res) => v2AIController.analyze(req, res)
);

// AI Chat endpoint
router.post(
  '/ai/chat',
  authenticate,
  rateLimiter,
  (req, res) => v2AIController.chat(req, res)
);

// URL Scan endpoint
router.post(
  '/scan/uri',
  authenticate,
  rateLimiter,
  (req, res) => v2AIController.scanUri(req, res)
);

// Model information endpoint
router.get(
  '/ai/models',
  authenticate,
  (req, res) => v2AIController.listModels(req, res)
);

// Usage statistics endpoint
router.get(
  '/ai/usage',
  authenticate,
  (req, res) => v2AIController.getUsage(req, res)
);

export default router;
