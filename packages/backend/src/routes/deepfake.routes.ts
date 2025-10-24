/**
 * DEEPFAKE & AI CONTENT DETECTION API ROUTES
 *
 * Routes for AI-generated content detection features
 */

import { Router } from 'express';
import { deepfakeController } from '../controllers/deepfake.controller.js';

const router = Router();

// POST /api/v2/ai/detect-deepfake - Comprehensive deepfake analysis
router.post('/detect-deepfake', (req, res) => deepfakeController.detectDeepfake(req, res));

// POST /api/v2/ai/analyze-image - Image-specific analysis
router.post('/analyze-image', (req, res) => deepfakeController.analyzeImage(req, res));

// POST /api/v2/ai/analyze-text - Text-specific GPT detection
router.post('/analyze-text', (req, res) => deepfakeController.analyzeText(req, res));

export default router;
