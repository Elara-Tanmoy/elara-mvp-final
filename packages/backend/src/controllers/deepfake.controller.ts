/**
 * DEEPFAKE & AI CONTENT DETECTION API CONTROLLER
 *
 * Provides REST API endpoints for AI-generated content detection
 */

import { Request, Response } from 'express';
import { deepfakeDetector } from '../services/ai/deepfakeDetector.js';
import { logger } from '../config/logger.js';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  storage: multer.memoryStorage(),
});

export class DeepfakeController {
  /**
   * POST /api/v2/ai/detect-deepfake
   * Analyze image or video for deepfake/AI generation
   */
  async detectDeepfake(req: Request, res: Response): Promise<void> {
    try {
      const { imageUrl, textContent } = req.body;

      if (!imageUrl && !textContent) {
        res.status(400).json({
          success: false,
          error: 'Either imageUrl or textContent is required',
        });
        return;
      }

      logger.info(`[DeepfakeAPI] Analysis requested - Image: ${!!imageUrl}, Text: ${!!textContent}`);

      // Run deepfake analysis
      const analysis = await deepfakeDetector.analyzeContent({
        imageUrls: imageUrl ? [imageUrl] : undefined,
        textContent,
      });

      res.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[DeepfakeAPI] Detection failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze content',
        details: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v2/ai/analyze-image
   * Analyze image specifically for AI generation
   */
  async analyzeImage(req: Request, res: Response): Promise<void> {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json({
          success: false,
          error: 'imageUrl is required',
        });
        return;
      }

      logger.info(`[DeepfakeAPI] Image analysis requested: ${imageUrl}`);

      const analysis = await deepfakeDetector.analyzeImage(imageUrl);

      res.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[DeepfakeAPI] Image analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze image',
        details: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v2/ai/analyze-text
   * Analyze text for GPT generation
   */
  async analyzeText(req: Request, res: Response): Promise<void> {
    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          success: false,
          error: 'text parameter is required',
        });
        return;
      }

      if (text.length < 50) {
        res.status(400).json({
          success: false,
          error: 'Text must be at least 50 characters for reliable analysis',
        });
        return;
      }

      logger.info(`[DeepfakeAPI] Text analysis requested (${text.length} characters)`);

      const analysis = await deepfakeDetector.analyzeText(text);

      res.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[DeepfakeAPI] Text analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze text',
        details: (error as Error).message,
      });
    }
  }
}

export const deepfakeController = new DeepfakeController();
export { upload };
