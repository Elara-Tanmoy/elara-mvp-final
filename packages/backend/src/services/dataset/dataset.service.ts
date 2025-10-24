import Papa from 'papaparse';
import fs from 'fs/promises';
import { prisma } from '../../config/database.js';
import { aiService } from '../ai/ai.service.js';
import { logger } from '../../config/logger.js';
import { scanQueue } from '../queue/scan.queue.js';

export interface DatasetUploadResult {
  datasetId: string;
  name: string;
  rowCount: number;
  columnCount: number;
  status: string;
}

export class DatasetService {
  async uploadDataset(
    filePath: string,
    fileName: string,
    fileSize: number,
    organizationId: string,
    name: string,
    description?: string
  ): Promise<DatasetUploadResult> {
    try {
      // Create dataset record
      const dataset = await prisma.dataset.create({
        data: {
          name,
          description,
          fileName,
          fileUrl: filePath,
          fileSize,
          organizationId,
          status: 'processing'
        }
      });

      // Queue for processing
      await scanQueue.add('process-dataset', {
        datasetId: dataset.id,
        filePath
      });

      logger.info(`Dataset ${dataset.id} queued for processing`);

      return {
        datasetId: dataset.id,
        name: dataset.name,
        rowCount: 0,
        columnCount: 0,
        status: 'processing'
      };
    } catch (error) {
      logger.error('Dataset upload error:', error);
      throw error;
    }
  }

  async processDataset(datasetId: string, filePath: string): Promise<void> {
    try {
      logger.info(`Processing dataset ${datasetId}`);

      // Read and parse CSV
      const fileContent = await fs.readFile(filePath, 'utf-8');

      const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject
        });
      });

      if (parseResult.errors.length > 0) {
        logger.error('CSV parsing errors:', parseResult.errors);
        await prisma.dataset.update({
          where: { id: datasetId },
          data: { status: 'failed' }
        });
        return;
      }

      const rows = parseResult.data;
      const columnCount = parseResult.meta.fields?.length || 0;

      logger.info(`Parsed ${rows.length} rows with ${columnCount} columns`);

      // Create dataset entries
      const entries = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const content = Object.values(row).filter(Boolean).join(' ');

        entries.push({
          datasetId,
          content,
          metadata: row,
          rowNumber: i + 1
        });
      }

      // Batch insert entries
      await prisma.datasetEntry.createMany({
        data: entries
      });

      // Update dataset
      await prisma.dataset.update({
        where: { id: datasetId },
        data: {
          rowCount: rows.length,
          columnCount,
          status: 'ready',
          processedAt: new Date()
        }
      });

      // Queue for vectorization
      await scanQueue.add('vectorize-dataset', { datasetId });

      logger.info(`Dataset ${datasetId} processed successfully`);
    } catch (error) {
      logger.error(`Dataset processing error for ${datasetId}:`, error);

      await prisma.dataset.update({
        where: { id: datasetId },
        data: { status: 'failed' }
      });

      throw error;
    }
  }

  async vectorizeDataset(datasetId: string): Promise<void> {
    try {
      logger.info(`Vectorizing dataset ${datasetId}`);

      const entries = await prisma.datasetEntry.findMany({
        where: { datasetId },
        select: { id: true, content: true, metadata: true }
      });

      if (entries.length === 0) {
        logger.warn(`No entries found for dataset ${datasetId}`);
        return;
      }

      // Vectorize in batches
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        const vectorIds = await aiService.vectorizeDataset(
          batch.map(entry => ({
            content: entry.content,
            metadata: {
              ...entry.metadata as object,
              datasetId,
              entryId: entry.id
            }
          }))
        );

        // Update entries with vector IDs
        for (let j = 0; j < batch.length; j++) {
          await prisma.datasetEntry.update({
            where: { id: batch[j].id },
            data: { vectorId: vectorIds[j] }
          });
        }

        logger.info(`Vectorized batch ${Math.floor(i / batchSize) + 1}`);
      }

      // Mark dataset as vectorized
      await prisma.dataset.update({
        where: { id: datasetId },
        data: { vectorized: true }
      });

      logger.info(`Dataset ${datasetId} vectorized successfully`);
    } catch (error) {
      logger.error(`Dataset vectorization error for ${datasetId}:`, error);
      throw error;
    }
  }

  async getDatasets(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    vectorized?: boolean
  ): Promise<{ datasets: any[]; total: number; page: number; totalPages: number }> {
    const where: any = { organizationId };

    if (status) {
      where.status = status;
    }

    if (vectorized !== undefined) {
      where.vectorized = vectorized;
    }

    const [datasets, total] = await Promise.all([
      prisma.dataset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { entries: true }
          }
        }
      }),
      prisma.dataset.count({ where })
    ]);

    return {
      datasets,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getDataset(datasetId: string, organizationId: string): Promise<any> {
    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, organizationId },
      include: {
        _count: {
          select: { entries: true }
        }
      }
    });

    if (!dataset) {
      throw new Error('Dataset not found');
    }

    return dataset;
  }

  async deleteDataset(datasetId: string, organizationId: string): Promise<void> {
    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, organizationId }
    });

    if (!dataset) {
      throw new Error('Dataset not found');
    }

    // Delete file
    try {
      await fs.unlink(dataset.fileUrl);
    } catch (error) {
      logger.warn(`Failed to delete file ${dataset.fileUrl}:`, error);
    }

    // Delete from database (cascade will delete entries)
    await prisma.dataset.delete({
      where: { id: datasetId }
    });

    logger.info(`Dataset ${datasetId} deleted`);
  }
}

export const datasetService = new DatasetService();
