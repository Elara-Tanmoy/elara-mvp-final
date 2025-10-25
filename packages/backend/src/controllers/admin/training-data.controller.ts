/**
 * Training Data Controller
 *
 * Manages training data uploads and dataset management for V2 scanner.
 * Supports CSV, XLSX, JSON, SQL uploads to BigQuery.
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger.js';
import { dataUploadService } from '../../services/training/data-upload.service.js';
import { dataValidationService } from '../../services/training/data-validation.service.js';

export class TrainingDataController {
  /**
   * POST /api/admin/training-data/upload
   * Upload training data file
   */
  async uploadData(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { name, source, description } = req.body;

      if (!name || !source) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, source'
        });
      }

      logger.info(`[Training Data] Uploading file: ${req.file.originalname} (${req.file.size} bytes)`);

      // Upload and process
      const dataset = await dataUploadService.uploadTrainingData(req.file, {
        name,
        source,
        description
      });

      logger.info(`[Training Data] Successfully uploaded dataset: ${dataset.id}`);

      res.status(201).json({
        success: true,
        data: dataset,
        message: `Successfully uploaded ${dataset.recordCount} records`
      });
    } catch (error) {
      logger.error('[Training Data] Upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload training data'
      });
    }
  }

  /**
   * GET /api/admin/training-data
   * List all uploaded datasets
   */
  async listDatasets(req: Request, res: Response) {
    try {
      const { format, source, status } = req.query;

      const datasets = await dataUploadService.listDatasets({
        format: format as string,
        source: source as string,
        status: status as string
      });

      logger.info(`[Training Data] Retrieved ${datasets.length} datasets`);

      res.json({
        success: true,
        data: datasets,
        total: datasets.length
      });
    } catch (error) {
      logger.error('[Training Data] List error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list datasets'
      });
    }
  }

  /**
   * DELETE /api/admin/training-data/:id
   * Delete a dataset
   */
  async deleteDataset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await dataUploadService.deleteDataset(id);

      logger.info(`[Training Data] Deleted dataset: ${id}`);

      res.json({
        success: true,
        message: 'Dataset deleted successfully'
      });
    } catch (error) {
      logger.error('[Training Data] Delete error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete dataset'
      });
    }
  }

  /**
   * POST /api/admin/training-data/validate
   * Validate training data before upload
   */
  async validateData(req: Request, res: Response) {
    try {
      const { records } = req.body;

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Records must be a non-empty array'
        });
      }

      // Validate records
      const validationResult = dataValidationService.validate(records);

      // Calculate quality metrics
      const qualityMetrics = dataValidationService.calculateQualityMetrics(records);

      logger.info(`[Training Data] Validated ${records.length} records`);

      res.json({
        success: true,
        data: {
          validation: validationResult,
          quality: qualityMetrics
        }
      });
    } catch (error) {
      logger.error('[Training Data] Validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate data'
      });
    }
  }

  /**
   * GET /api/admin/training-data/stats
   * Get training data statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const datasets = await dataUploadService.listDatasets();

      const stats = {
        totalDatasets: datasets.length,
        totalRecords: datasets.reduce((sum, d) => sum + d.recordCount, 0),
        byFormat: {
          csv: datasets.filter(d => d.format === 'csv').length,
          xlsx: datasets.filter(d => d.format === 'xlsx').length,
          json: datasets.filter(d => d.format === 'json').length,
          sql: datasets.filter(d => d.format === 'sql').length
        },
        byStatus: {
          uploaded: datasets.filter(d => d.status === 'uploaded').length,
          processing: datasets.filter(d => d.status === 'processing').length,
          completed: datasets.filter(d => d.status === 'completed').length,
          failed: datasets.filter(d => d.status === 'failed').length
        },
        recentUploads: datasets.slice(0, 5)
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('[Training Data] Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  }

  /**
   * POST /api/admin/training-data/:id/download
   * Download a dataset
   */
  async downloadDataset(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // TODO: Implement download from GCS
      res.status(501).json({
        success: false,
        error: 'Download functionality not yet implemented'
      });
    } catch (error) {
      logger.error('[Training Data] Download error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download dataset'
      });
    }
  }
}

export const trainingDataController = new TrainingDataController();
