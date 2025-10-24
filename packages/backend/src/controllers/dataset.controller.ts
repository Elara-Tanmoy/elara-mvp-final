import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';
import { datasetService } from '../services/dataset/dataset.service.js';
import { datasetUploadSchema, datasetQuerySchema } from '../validators/dataset.validator.js';
import multer from 'multer';

const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

export class DatasetController {
  async uploadDataset(req: AuthRequest, res: Response): Promise<void> {
    upload.single('file')(req, res, async (err) => {
      try {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        const validatedData = datasetUploadSchema.parse(req.body);

        const result = await datasetService.uploadDataset(
          req.file.path,
          req.file.originalname,
          req.file.size,
          req.user!.organizationId,
          validatedData.name,
          validatedData.description
        );

        logger.info(`Dataset uploaded: ${result.datasetId}`);

        res.status(202).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation failed', details: error.errors });
          return;
        }

        logger.error('Dataset upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  async getDatasets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const query = datasetQuerySchema.parse(req.query);

      const result = await datasetService.getDatasets(
        req.user!.organizationId,
        query.page,
        query.limit,
        query.status,
        query.vectorized
      );

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('Get datasets error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDataset(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const dataset = await datasetService.getDataset(id, req.user!.organizationId);

      res.json(dataset);
    } catch (error: any) {
      if (error.message === 'Dataset not found') {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      logger.error('Get dataset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteDataset(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await datasetService.deleteDataset(id, req.user!.organizationId);

      res.json({ message: 'Dataset deleted successfully' });
    } catch (error: any) {
      if (error.message === 'Dataset not found') {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      logger.error('Delete dataset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const datasetController = new DatasetController();
