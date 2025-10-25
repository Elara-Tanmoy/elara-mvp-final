/**
 * Training Data Upload Service
 *
 * Handles multi-format training data uploads (CSV, XLSX, JSON, SQL) and ingestion into BigQuery.
 * Supports:
 * - CSV: Standard comma-separated values
 * - XLSX: Excel spreadsheets
 * - JSON: Array of objects or JSONL
 * - SQL: SQL dump files (INSERT statements)
 */

import { logger } from '../../config/logger.js';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import * as XLSX from 'xlsx';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { prisma } from '../../config/database.js';

export interface UploadedDataset {
  id: string;
  name: string;
  format: 'csv' | 'xlsx' | 'json' | 'sql';
  recordCount: number;
  schema: Record<string, string>;
  gcsPath: string;
  bigQueryTable: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface TrainingRecord {
  url: string;
  label: 'phishing' | 'benign' | 'suspicious';
  confidence?: number;
  source: string;
  timestamp?: Date;
  features?: Record<string, any>;
  metadata?: Record<string, any>;
}

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp';
const BUCKET_NAME = `${PROJECT_ID}-training-data`;
const DATASET_NAME = 'elara_training_data_v2';

class DataUploadService {
  private bigquery: BigQuery;
  private storage: Storage;

  constructor() {
    this.bigquery = new BigQuery({ projectId: PROJECT_ID });
    this.storage = new Storage({ projectId: PROJECT_ID });
  }

  /**
   * Upload and process training data file
   */
  async uploadTrainingData(
    file: Express.Multer.File,
    metadata: {
      name: string;
      source: string;
      description?: string;
    }
  ): Promise<UploadedDataset> {
    try {
      logger.info(`[Data Upload] Processing file: ${file.originalname}`);

      // Detect format from file extension
      const format = this.detectFormat(file.originalname);

      if (!format) {
        throw new Error(`Unsupported file format: ${file.originalname}`);
      }

      // Create dataset record
      const dataset = await prisma.v2TrainingDataset.create({
        data: {
          name: metadata.name,
          description: metadata.description || `Uploaded from ${file.originalname}`,
          source: metadata.source,
          format,
          schema: {} as any,
          recordCount: 0,
          status: 'uploaded'
        }
      });

      // Upload to GCS
      const gcsPath = await this.uploadToGCS(file, dataset.id, format);

      // Parse and validate data
      const records = await this.parseFile(file.buffer, format);

      logger.info(`[Data Upload] Parsed ${records.length} records from ${format} file`);

      // Validate records
      const validRecords = await this.validateRecords(records);

      logger.info(`[Data Upload] ${validRecords.length}/${records.length} records are valid`);

      // Ingest to BigQuery
      const tableName = await this.ingestToBigQuery(validRecords, format);

      // Update dataset record
      const updatedDataset = await prisma.v2TrainingDataset.update({
        where: { id: dataset.id },
        data: {
          recordCount: validRecords.length,
          schema: this.extractSchema(validRecords[0]) as any,
          status: 'completed'
        }
      });

      logger.info(`[Data Upload] Successfully uploaded dataset ${dataset.id}`);

      return {
        id: updatedDataset.id,
        name: updatedDataset.name,
        format: updatedDataset.format as any,
        recordCount: updatedDataset.recordCount,
        schema: updatedDataset.schema as any,
        gcsPath,
        bigQueryTable: tableName,
        status: 'completed'
      };

    } catch (error) {
      logger.error('[Data Upload] Error uploading training data:', error);
      throw error;
    }
  }

  /**
   * Parse file based on format
   */
  private async parseFile(buffer: Buffer, format: string): Promise<TrainingRecord[]> {
    switch (format) {
      case 'csv':
        return await this.parseCSV(buffer);
      case 'xlsx':
        return await this.parseXLSX(buffer);
      case 'json':
        return await this.parseJSON(buffer);
      case 'sql':
        return await this.parseSQL(buffer);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Parse CSV file
   */
  private async parseCSV(buffer: Buffer): Promise<TrainingRecord[]> {
    return new Promise((resolve, reject) => {
      const records: TrainingRecord[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(csvParser({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on('data', (row: any) => {
          const record: TrainingRecord = {
            url: row.url || row.uri || row.link,
            label: this.normalizeLabel(row.label || row.type || row.classification),
            confidence: row.confidence ? parseFloat(row.confidence) : undefined,
            source: row.source || 'uploaded-csv',
            timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
            features: row.features ? JSON.parse(row.features) : undefined,
            metadata: { ...row }
          };
          records.push(record);
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  /**
   * Parse XLSX file
   */
  private async parseXLSX(buffer: Buffer): Promise<TrainingRecord[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet);

    return rows.map((row: any) => ({
      url: row.url || row.URL || row.uri || row.URI,
      label: this.normalizeLabel(row.label || row.Label || row.type || row.Type),
      confidence: row.confidence || row.Confidence ? parseFloat(row.confidence || row.Confidence) : undefined,
      source: row.source || row.Source || 'uploaded-xlsx',
      timestamp: row.timestamp || row.Timestamp ? new Date(row.timestamp || row.Timestamp) : new Date(),
      features: row.features ? JSON.parse(row.features) : undefined,
      metadata: { ...row }
    }));
  }

  /**
   * Parse JSON file (array or JSONL)
   */
  private async parseJSON(buffer: Buffer): Promise<TrainingRecord[]> {
    const content = buffer.toString('utf-8');

    // Try parsing as JSON array
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return data.map(row => ({
          url: row.url || row.uri,
          label: this.normalizeLabel(row.label || row.type),
          confidence: row.confidence ? parseFloat(row.confidence) : undefined,
          source: row.source || 'uploaded-json',
          timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
          features: row.features,
          metadata: { ...row }
        }));
      }
    } catch (e) {
      // Not a JSON array, try JSONL
    }

    // Parse as JSONL (one JSON object per line)
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const row = JSON.parse(line);
      return {
        url: row.url || row.uri,
        label: this.normalizeLabel(row.label || row.type),
        confidence: row.confidence ? parseFloat(row.confidence) : undefined,
        source: row.source || 'uploaded-jsonl',
        timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
        features: row.features,
        metadata: { ...row }
      };
    });
  }

  /**
   * Parse SQL file (basic INSERT statement parsing)
   */
  private async parseSQL(buffer: Buffer): Promise<TrainingRecord[]> {
    const sql = buffer.toString('utf-8');
    const records: TrainingRecord[] = [];

    // Extract INSERT statements
    const insertRegex = /INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;
    let match;

    while ((match = insertRegex.exec(sql)) !== null) {
      const columns = match[1].split(',').map(c => c.trim().replace(/[`'"]/g, ''));
      const values = match[2].split(',').map(v => v.trim().replace(/['"]/g, ''));

      const row: any = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx];
      });

      records.push({
        url: row.url || row.uri,
        label: this.normalizeLabel(row.label || row.type),
        confidence: row.confidence ? parseFloat(row.confidence) : undefined,
        source: row.source || 'uploaded-sql',
        timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
        metadata: row
      });
    }

    return records;
  }

  /**
   * Normalize label to standard values
   */
  private normalizeLabel(label: string): 'phishing' | 'benign' | 'suspicious' {
    const normalized = label.toLowerCase().trim();

    if (['phishing', 'phish', 'malicious', 'bad', '1', 'true'].includes(normalized)) {
      return 'phishing';
    }

    if (['benign', 'safe', 'good', 'legitimate', '0', 'false'].includes(normalized)) {
      return 'benign';
    }

    return 'suspicious';
  }

  /**
   * Validate training records
   */
  private async validateRecords(records: TrainingRecord[]): Promise<TrainingRecord[]> {
    const valid: TrainingRecord[] = [];

    for (const record of records) {
      // Required fields
      if (!record.url || !record.label) {
        logger.debug(`[Data Upload] Skipping invalid record: missing url or label`);
        continue;
      }

      // URL format validation
      try {
        new URL(record.url);
      } catch {
        logger.debug(`[Data Upload] Skipping invalid URL: ${record.url}`);
        continue;
      }

      // Label validation
      if (!['phishing', 'benign', 'suspicious'].includes(record.label)) {
        logger.debug(`[Data Upload] Skipping invalid label: ${record.label}`);
        continue;
      }

      valid.push(record);
    }

    return valid;
  }

  /**
   * Upload file to Google Cloud Storage
   */
  private async uploadToGCS(file: Express.Multer.File, datasetId: string, format: string): Promise<string> {
    const bucket = this.storage.bucket(BUCKET_NAME);
    const filename = `${datasetId}/${Date.now()}-${file.originalname}`;
    const blob = bucket.file(filename);

    await blob.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          datasetId,
          format,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info(`[Data Upload] Uploaded to GCS: gs://${BUCKET_NAME}/${filename}`);

    return `gs://${BUCKET_NAME}/${filename}`;
  }

  /**
   * Ingest records to BigQuery
   */
  private async ingestToBigQuery(records: TrainingRecord[], format: string): Promise<string> {
    const tableName = format === 'csv' || format === 'xlsx' || format === 'json'
      ? records[0].label === 'phishing' ? 'phishing_urls' : 'benign_urls'
      : 'uploaded_training_data';

    const dataset = this.bigquery.dataset(DATASET_NAME);
    const table = dataset.table(tableName);

    // Transform records to BigQuery format
    const bqRecords = records.map(record => ({
      url: record.url,
      label: record.label,
      confidence: record.confidence || 1.0,
      source: record.source,
      timestamp: record.timestamp || new Date(),
      features: JSON.stringify(record.features || {}),
      metadata: JSON.stringify(record.metadata || {})
    }));

    // Insert records
    await table.insert(bqRecords);

    logger.info(`[Data Upload] Inserted ${bqRecords.length} records into BigQuery table ${tableName}`);

    return `${DATASET_NAME}.${tableName}`;
  }

  /**
   * Detect file format from filename
   */
  private detectFormat(filename: string): 'csv' | 'xlsx' | 'json' | 'sql' | null {
    const ext = filename.toLowerCase().split('.').pop();

    switch (ext) {
      case 'csv':
        return 'csv';
      case 'xlsx':
      case 'xls':
        return 'xlsx';
      case 'json':
      case 'jsonl':
        return 'json';
      case 'sql':
        return 'sql';
      default:
        return null;
    }
  }

  /**
   * Extract schema from first record
   */
  private extractSchema(record: TrainingRecord): Record<string, string> {
    const schema: Record<string, string> = {
      url: 'STRING',
      label: 'STRING',
      source: 'STRING',
      timestamp: 'TIMESTAMP'
    };

    if (record.confidence !== undefined) {
      schema.confidence = 'FLOAT';
    }

    if (record.features) {
      schema.features = 'JSON';
    }

    if (record.metadata) {
      schema.metadata = 'JSON';
    }

    return schema;
  }

  /**
   * Delete dataset
   */
  async deleteDataset(datasetId: string): Promise<void> {
    await prisma.v2TrainingDataset.delete({
      where: { id: datasetId }
    });

    logger.info(`[Data Upload] Deleted dataset ${datasetId}`);
  }

  /**
   * List all datasets
   */
  async listDatasets(filters?: {
    format?: string;
    source?: string;
    status?: string;
  }): Promise<UploadedDataset[]> {
    const where: any = {};

    if (filters?.format) where.format = filters.format;
    if (filters?.source) where.source = { contains: filters.source };
    if (filters?.status) where.status = filters.status;

    const datasets = await prisma.v2TrainingDataset.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return datasets.map(d => ({
      id: d.id,
      name: d.name,
      format: d.format as any,
      recordCount: d.recordCount,
      schema: d.schema as any,
      gcsPath: '',
      bigQueryTable: `${DATASET_NAME}.${d.format === 'csv' ? 'uploaded_training_data' : 'uploaded_training_data'}`,
      status: d.status as any
    }));
  }
}

export const dataUploadService = new DataUploadService();
export default dataUploadService;
