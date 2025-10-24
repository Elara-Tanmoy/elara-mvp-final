import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';
import { aiService } from '../services/ai/ai.service.js';
import { aiQuerySchema } from '../validators/dataset.validator.js';

export class AIController {
  async query(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = aiQuerySchema.parse(req.body);

      const result = await aiService.query({
        query: validatedData.query,
        useRAG: validatedData.useRAG,
        model: validatedData.model
      });

      logger.info(`AI query processed for user ${req.user!.userId}`);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('AI query error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const aiController = new AIController();
