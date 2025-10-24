import { logger } from '../../config/logger.js';
import crypto from 'crypto';

/**
 * BigQuery Logging Service
 * Logs comprehensive analysis data for ML training
 *
 * NOTE: Requires Google Cloud BigQuery setup
 * This is production-ready and will work once credentials are configured
 */

export interface ComprehensiveAnalysisData {
  userId: string;
  type: 'url' | 'message' | 'file' | 'profile' | 'fact' | 'literacy' | 'recovery';
  input: {
    text: string;
    type: string;
    length: number;
    metadata?: Record<string, any>;
  };
  verdict: string;
  specificData: Record<string, any>;
  latency: number; // ms
  cost?: number; // USD
  timestamp: Date;
}

export interface MLDatasetRow {
  analysisId: string;
  userIdHash: string; // Hashed for privacy
  timestamp: string;
  analysisType: string;

  // Input data
  inputText: string;
  inputType: string;
  inputLength: number;
  inputMetadata: string; // JSON

  // Analysis results
  verdict: string;
  confidence?: number;
  riskScore?: number;

  // Type-specific data
  urlData?: string; // JSON
  messageData?: string; // JSON
  fileData?: string; // JSON
  profileData?: string; // JSON
  factData?: string; // JSON
  literacyData?: string; // JSON
  recoveryData?: string; // JSON

  // Performance metrics
  totalLatency: number;
  totalCost: number;

  // Privacy
  piiRemoved: boolean;
  dataRetentionDays: number;
}

export class BigQueryLoggerService {
  private bigqueryClient: any; // BigQuery client (loaded dynamically)
  private datasetId = 'elara_ml_dataset';
  private tableId = 'all_analyses';
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    // DO NOT call async methods in constructor - causes unhandled promise rejections
    // Initialization happens lazily on first use
  }

  /**
   * Initialize BigQuery client (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeBigQueryClient();
    await this.initPromise;
    this.isInitialized = true;
  }

  /**
   * Initialize BigQuery client
   */
  private async initializeBigQueryClient() {
    try {
      // Dynamically import BigQuery client
      const { BigQuery } = await import('@google-cloud/bigquery').catch(() => {
        logger.warn('Google BigQuery not available. Install with: npm install @google-cloud/bigquery');
        return { BigQuery: null };
      });

      if (BigQuery) {
        this.bigqueryClient = new BigQuery();
        logger.info('BigQuery client initialized');
        await this.ensureDatasetAndTable();
      }
    } catch (error) {
      logger.error('Failed to initialize BigQuery client:', error);
    }
  }

  /**
   * Ensure dataset and table exist
   */
  private async ensureDatasetAndTable() {
    if (!this.bigqueryClient) return;

    try {
      // Create dataset if it doesn't exist
      const [datasets] = await this.bigqueryClient.getDatasets();
      const datasetExists = datasets.some((ds: any) => ds.id === this.datasetId);

      if (!datasetExists) {
        await this.bigqueryClient.createDataset(this.datasetId, {
          location: 'US'
        });
        logger.info(`Created BigQuery dataset: ${this.datasetId}`);
      }

      const dataset = this.bigqueryClient.dataset(this.datasetId);

      // Define table schema
      const schema = [
        { name: 'analysisId', type: 'STRING', mode: 'REQUIRED' },
        { name: 'userIdHash', type: 'STRING', mode: 'REQUIRED' },
        { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'analysisType', type: 'STRING', mode: 'REQUIRED' },

        // Input data
        { name: 'inputText', type: 'STRING', mode: 'NULLABLE' },
        { name: 'inputType', type: 'STRING', mode: 'NULLABLE' },
        { name: 'inputLength', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'inputMetadata', type: 'JSON', mode: 'NULLABLE' },

        // Results
        { name: 'verdict', type: 'STRING', mode: 'NULLABLE' },
        { name: 'confidence', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'riskScore', type: 'INTEGER', mode: 'NULLABLE' },

        // Type-specific data
        { name: 'urlData', type: 'JSON', mode: 'NULLABLE' },
        { name: 'messageData', type: 'JSON', mode: 'NULLABLE' },
        { name: 'fileData', type: 'JSON', mode: 'NULLABLE' },
        { name: 'profileData', type: 'JSON', mode: 'NULLABLE' },
        { name: 'factData', type: 'JSON', mode: 'NULLABLE' },
        { name: 'literacyData', type: 'JSON', mode: 'NULLABLE' },
        { name: 'recoveryData', type: 'JSON', mode: 'NULLABLE' },

        // Metrics
        { name: 'totalLatency', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'totalCost', type: 'FLOAT', mode: 'NULLABLE' },

        // Privacy
        { name: 'piiRemoved', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'dataRetentionDays', type: 'INTEGER', mode: 'REQUIRED' }
      ];

      // Create table if it doesn't exist
      const [tables] = await dataset.getTables();
      const tableExists = tables.some((t: any) => t.id === this.tableId);

      if (!tableExists) {
        await dataset.createTable(this.tableId, { schema });
        logger.info(`Created BigQuery table: ${this.tableId}`);
      }

    } catch (error) {
      logger.error('BigQuery setup error:', error);
    }
  }

  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    return crypto
      .createHash('sha256')
      .update(userId + process.env.HASH_SALT || 'elara-privacy-salt')
      .digest('hex');
  }

  /**
   * Remove PII from text
   */
  private removePII(text: string): string {
    let cleaned = text;

    // Remove email addresses
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

    // Remove phone numbers (various formats)
    cleaned = cleaned.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');

    // Remove SSN
    cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

    // Remove credit card numbers
    cleaned = cleaned.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

    // Remove URLs (but keep domain for analysis)
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, (match) => {
      try {
        const url = new URL(match);
        return `[URL:${url.hostname}]`;
      } catch {
        return '[URL]';
      }
    });

    return cleaned;
  }

  /**
   * Log comprehensive analysis data
   */
  async logAnalysis(data: ComprehensiveAnalysisData): Promise<void> {
    try {
      // Lazy initialization - only initialize when first used
      await this.ensureInitialized();

      // If BigQuery not available, log locally
      if (!this.bigqueryClient) {
        this.logToFile(data);
        return;
      }

      const dataset = this.bigqueryClient.dataset(this.datasetId);
      const table = dataset.table(this.tableId);

      // Generate unique analysis ID
      const analysisId = `${data.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Hash user ID for privacy
      const userIdHash = this.hashUserId(data.userId);

      // Remove PII from input text
      const cleanedText = this.removePII(data.input.text);

      // Build row data
      const row: MLDatasetRow = {
        analysisId,
        userIdHash,
        timestamp: data.timestamp.toISOString(),
        analysisType: data.type,

        inputText: cleanedText.substring(0, 10000), // Limit to 10k chars
        inputType: data.input.type,
        inputLength: data.input.length,
        inputMetadata: JSON.stringify(data.input.metadata || {}),

        verdict: data.verdict,
        confidence: data.specificData.confidence,
        riskScore: data.specificData.riskScore || data.specificData.authenticityScore,

        totalLatency: data.latency,
        totalCost: data.cost || 0,

        piiRemoved: true,
        dataRetentionDays: 365 // 1 year retention
      };

      // Add type-specific data
      switch (data.type) {
        case 'url':
          row.urlData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
        case 'message':
          row.messageData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
        case 'file':
          row.fileData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
        case 'profile':
          row.profileData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
        case 'fact':
          row.factData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
        case 'literacy':
          row.literacyData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
        case 'recovery':
          row.recoveryData = JSON.stringify(this.sanitizeData(data.specificData));
          break;
      }

      // Insert row into BigQuery
      await table.insert([row]);

      logger.info(`Logged analysis to BigQuery: ${analysisId}`);

    } catch (error) {
      logger.error('BigQuery logging error:', error);
      // Fallback to file logging
      this.logToFile(data);
    }
  }

  /**
   * Sanitize data by removing sensitive fields
   */
  private sanitizeData(data: any): any {
    const sanitized = { ...data };

    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'apiKey', 'secret', 'privateKey',
      'creditCard', 'ssn', 'dob', 'fullName', 'address'
    ];

    const recursiveSanitize = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return obj;

      if (Array.isArray(obj)) {
        return obj.map(recursiveSanitize);
      }

      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        if (sensitiveFields.some(field => keyLower.includes(field))) {
          cleaned[key] = '[REDACTED]';
        } else {
          cleaned[key] = recursiveSanitize(value);
        }
      }
      return cleaned;
    };

    return recursiveSanitize(sanitized);
  }

  /**
   * Fallback: Log to file when BigQuery not available
   */
  private async logToFile(data: ComprehensiveAnalysisData): Promise<void> {
    try {
      const { promises: fs } = await import('fs');
      const path = await import('path');

      const logDir = path.join(process.cwd(), 'logs', 'ml-dataset');
      const logFile = path.join(logDir, `${data.type}-${new Date().toISOString().split('T')[0]}.jsonl`);

      const logEntry = {
        timestamp: data.timestamp.toISOString(),
        type: data.type,
        userIdHash: this.hashUserId(data.userId),
        inputLength: data.input.length,
        verdict: data.verdict,
        latency: data.latency,
        cost: data.cost || 0
      };

      // Ensure directory exists and append log
      await fs.mkdir(logDir, { recursive: true });
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (err) {
      logger.error('File logging error:', err);
    }
  }

  /**
   * Query analysis data for ML training
   */
  async queryAnalysisData(options: {
    analysisType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    if (!this.bigqueryClient) {
      logger.warn('BigQuery not available for querying');
      return [];
    }

    try {
      let query = `
        SELECT *
        FROM \`${this.datasetId}.${this.tableId}\`
        WHERE 1=1
      `;

      if (options.analysisType) {
        query += ` AND analysisType = @analysisType`;
      }

      if (options.startDate) {
        query += ` AND timestamp >= @startDate`;
      }

      if (options.endDate) {
        query += ` AND timestamp <= @endDate`;
      }

      query += ` ORDER BY timestamp DESC`;

      if (options.limit) {
        query += ` LIMIT @limit`;
      }

      const [rows] = await this.bigqueryClient.query({
        query,
        params: {
          analysisType: options.analysisType,
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString(),
          limit: options.limit || 1000
        }
      });

      return rows;

    } catch (error) {
      logger.error('BigQuery query error:', error);
      return [];
    }
  }

  /**
   * Get dataset statistics
   */
  async getDatasetStats(): Promise<{
    totalAnalyses: number;
    byType: Record<string, number>;
    averageLatency: number;
    totalCost: number;
  }> {
    if (!this.bigqueryClient) {
      return {
        totalAnalyses: 0,
        byType: {},
        averageLatency: 0,
        totalCost: 0
      };
    }

    try {
      const query = `
        SELECT
          COUNT(*) as totalAnalyses,
          AVG(totalLatency) as averageLatency,
          SUM(totalCost) as totalCost,
          analysisType,
          COUNT(*) as typeCount
        FROM \`${this.datasetId}.${this.tableId}\`
        GROUP BY analysisType
      `;

      const [rows] = await this.bigqueryClient.query(query);

      const stats = {
        totalAnalyses: 0,
        byType: {} as Record<string, number>,
        averageLatency: 0,
        totalCost: 0
      };

      rows.forEach((row: any) => {
        stats.totalAnalyses += row.typeCount;
        stats.byType[row.analysisType] = row.typeCount;
        stats.averageLatency += row.averageLatency * row.typeCount;
        stats.totalCost += row.totalCost || 0;
      });

      if (stats.totalAnalyses > 0) {
        stats.averageLatency /= stats.totalAnalyses;
      }

      return stats;

    } catch (error) {
      logger.error('Stats query error:', error);
      return {
        totalAnalyses: 0,
        byType: {},
        averageLatency: 0,
        totalCost: 0
      };
    }
  }

  /**
   * Delete old data (GDPR compliance)
   */
  async deleteOldData(retentionDays: number = 365): Promise<number> {
    if (!this.bigqueryClient) {
      logger.warn('BigQuery not available for deletion');
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const query = `
        DELETE FROM \`${this.datasetId}.${this.tableId}\`
        WHERE timestamp < @cutoffDate
      `;

      const [job] = await this.bigqueryClient.createQueryJob({
        query,
        params: {
          cutoffDate: cutoffDate.toISOString()
        }
      });

      const [rows] = await job.getQueryResults();
      const deletedCount = rows.length;

      logger.info(`Deleted ${deletedCount} rows older than ${retentionDays} days`);
      return deletedCount;

    } catch (error) {
      logger.error('Data deletion error:', error);
      return 0;
    }
  }
}

export const bigQueryLoggerService = new BigQueryLoggerService();
