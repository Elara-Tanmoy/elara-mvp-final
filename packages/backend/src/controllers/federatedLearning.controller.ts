/**
 * FEDERATED LEARNING CONTROLLER
 * API endpoints for privacy-preserving collaborative learning
 */

import { Request, Response } from 'express';
import { federatedLearningService } from '../services/ml/federatedLearning.service.js';
import { logger } from '../config/logger.js';

export class FederatedLearningController {
  /**
   * GET /api/v2/federated/model
   * Download current global model
   */
  async getGlobalModel(req: Request, res: Response): Promise<void> {
    try {
      const model = await federatedLearningService.getGlobalModel();

      res.json({
        success: true,
        data: model,
      });
    } catch (error: any) {
      logger.error('Error getting global model:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get global model',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/v2/federated/submit-gradients
   * Submit client gradients for aggregation
   */
  async submitGradients(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, modelVersion, gradients, sampleCount, trainingMetrics, timestamp } =
        req.body;

      // Validation
      if (!clientId || !gradients || !sampleCount || !trainingMetrics) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: clientId, gradients, sampleCount, trainingMetrics',
        });
        return;
      }

      if (modelVersion === undefined) {
        res.status(400).json({
          success: false,
          error: 'Model version required',
        });
        return;
      }

      // Submit to federated learning service
      const result = await federatedLearningService.submitGradients({
        clientId,
        modelVersion,
        gradients,
        sampleCount,
        trainingMetrics,
        timestamp: timestamp || Date.now(),
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.message,
        });
        return;
      }

      logger.info(`Received gradients from client ${clientId} for model v${modelVersion}`);

      res.json({
        success: true,
        message: result.message,
        ...(result.nextRoundStartsAt && { nextRoundStartsAt: result.nextRoundStartsAt }),
      });
    } catch (error: any) {
      logger.error('Error submitting gradients:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit gradients',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/federated/round
   * Get current federated learning round status
   */
  async getCurrentRound(req: Request, res: Response): Promise<void> {
    try {
      const round = federatedLearningService.getCurrentRound();

      if (!round) {
        res.json({
          success: true,
          data: {
            active: false,
            message: 'No active round',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          active: true,
          round,
        },
      });
    } catch (error: any) {
      logger.error('Error getting current round:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current round',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/federated/stats
   * Get federated learning statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = federatedLearningService.getTrainingStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting federated learning stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/v2/federated/predict
   * Server-side prediction using global model (for testing)
   */
  async predict(req: Request, res: Response): Promise<void> {
    try {
      const { features } = req.body;

      if (!features || !Array.isArray(features)) {
        res.status(400).json({
          success: false,
          error: 'Features array required',
        });
        return;
      }

      const prediction = await federatedLearningService.predict(features);

      res.json({
        success: true,
        data: {
          prediction,
          verdict: prediction.scam > prediction.safe ? 'scam' : 'safe',
          confidence: Math.max(prediction.scam, prediction.safe),
        },
      });
    } catch (error: any) {
      logger.error('Error making prediction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to make prediction',
        details: error.message,
      });
    }
  }
}

export const federatedLearningController = new FederatedLearningController();
