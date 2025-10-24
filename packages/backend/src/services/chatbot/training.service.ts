import { Pool } from 'pg';
import { parse as parseCSV } from 'csv-parse/sync';
import { logger } from '../../config/logger.js';
import { knowledgeBaseService } from './knowledge-base.service.js';

/**
 * Chatbot Training Service
 * Handles data ingestion from various sources (CSV, text, JSON, PDF)
 */

export interface TrainingData {
  id: string;
  dataType: string;
  fileName: string;
  fileSize: number;
  processedEntries: number;
  totalEntries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

export class TrainingService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    logger.info('[Training Service] Initialized');
  }

  /**
   * Process CSV training data
   * Expected columns: title, content, category (optional)
   */
  async processCSV(params: {
    content: string;
    fileName: string;
    userId?: string;
  }): Promise<{ trainingId: string; totalEntries: number }> {
    const { content, fileName, userId } = params;
    let trainingId: string | null = null;

    try {
      logger.info(`[Training] Processing CSV file: ${fileName}`);

      // Create training record
      const trainingResult = await this.pool.query(`
        INSERT INTO chatbot_training_data (
          id, data_type, file_name, file_size, status, uploaded_by
        ) VALUES (gen_random_uuid(), $1, $2, $3, 'processing', $4)
        RETURNING id
      `, ['csv', fileName, content.length, userId]);

      trainingId = trainingResult.rows[0].id;

      // Parse CSV
      const records = parseCSV(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      logger.info(`[Training] Parsed ${records.length} records from CSV`);

      // Update total entries
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET total_entries = $1
        WHERE id = $2
      `, [records.length, trainingId]);

      // Process each record
      let processedCount = 0;
      for (const record of records) {
        try {
          const title = record.title || record.Title || record.question || 'Untitled';
          const contentText = record.content || record.Content || record.answer || record.text || '';
          const category = record.category || record.Category || 'general';

          if (!contentText || contentText.trim().length === 0) {
            logger.warn(`[Training] Skipping empty content for: ${title}`);
            continue;
          }

          await knowledgeBaseService.addKnowledge({
            title,
            content: contentText,
            contentType: 'csv',
            source: fileName,
            category,
            userId
          });

          processedCount++;

          // Update progress
          if (processedCount % 10 === 0) {
            await this.pool.query(`
              UPDATE chatbot_training_data
              SET processed_entries = $1
              WHERE id = $2
            `, [processedCount, trainingId]);

            logger.info(`[Training] Processed ${processedCount}/${records.length} entries`);
          }
        } catch (error) {
          logger.error(`[Training] Error processing record:`, error);
          // Continue with next record
        }
      }

      // Mark as completed
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET status = 'completed', processed_entries = $1, processed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [processedCount, trainingId]);

      logger.info(`[Training] Completed CSV processing: ${processedCount}/${records.length} entries`);

      return {
        trainingId,
        totalEntries: processedCount
      };
    } catch (error) {
      logger.error('[Training] Error processing CSV:', error);

      // Mark as failed
      if (trainingId) {
        await this.pool.query(`
          UPDATE chatbot_training_data
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error instanceof Error ? error.message : 'Unknown error', trainingId]);
      }

      throw error;
    }
  }

  /**
   * Process plain text training data
   * Splits into paragraphs or sections
   */
  async processText(params: {
    content: string;
    fileName: string;
    title?: string;
    category?: string;
    userId?: string;
  }): Promise<{ trainingId: string; totalEntries: number }> {
    const { content, fileName, title, category, userId } = params;
    let trainingId: string | null = null;

    try {
      logger.info(`[Training] Processing text file: ${fileName}`);

      // Create training record
      const trainingResult = await this.pool.query(`
        INSERT INTO chatbot_training_data (
          id, data_type, file_name, file_size, status, uploaded_by
        ) VALUES (gen_random_uuid(), $1, $2, $3, 'processing', $4)
        RETURNING id
      `, ['text', fileName, content.length, userId]);

      trainingId = trainingResult.rows[0].id;

      // Split into paragraphs (separated by double newlines or headings)
      const sections = content.split(/\n\n+|\n#+\s/).filter(s => s.trim().length > 50);

      logger.info(`[Training] Split text into ${sections.length} sections`);

      // Update total entries
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET total_entries = $1
        WHERE id = $2
      `, [sections.length, trainingId]);

      // Process each section
      let processedCount = 0;
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();

        try {
          // Try to extract title from first line if it looks like a heading
          let sectionTitle = title || `${fileName} - Section ${i + 1}`;
          const firstLine = section.split('\n')[0];

          if (firstLine.length < 100 && (
            firstLine.endsWith(':') ||
            firstLine.endsWith('?') ||
            /^[A-Z]/.test(firstLine)
          )) {
            sectionTitle = firstLine.replace(/^#+\s*/, '').trim();
          }

          await knowledgeBaseService.addKnowledge({
            title: sectionTitle,
            content: section,
            contentType: 'text',
            source: fileName,
            category: category || 'general',
            userId
          });

          processedCount++;

          // Update progress
          if (processedCount % 5 === 0) {
            await this.pool.query(`
              UPDATE chatbot_training_data
              SET processed_entries = $1
              WHERE id = $2
            `, [processedCount, trainingId]);
          }
        } catch (error) {
          logger.error(`[Training] Error processing section ${i}:`, error);
        }
      }

      // Mark as completed
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET status = 'completed', processed_entries = $1, processed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [processedCount, trainingId]);

      logger.info(`[Training] Completed text processing: ${processedCount} entries`);

      return {
        trainingId,
        totalEntries: processedCount
      };
    } catch (error) {
      logger.error('[Training] Error processing text:', error);

      if (trainingId) {
        await this.pool.query(`
          UPDATE chatbot_training_data
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error instanceof Error ? error.message : 'Unknown error', trainingId]);
      }

      throw error;
    }
  }

  /**
   * Process JSON training data
   * Expected format: Array of { title, content, category? }
   */
  async processJSON(params: {
    content: string;
    fileName: string;
    userId?: string;
  }): Promise<{ trainingId: string; totalEntries: number }> {
    const { content, fileName, userId } = params;
    let trainingId: string | null = null;

    try {
      logger.info(`[Training] Processing JSON file: ${fileName}`);

      // Create training record
      const trainingResult = await this.pool.query(`
        INSERT INTO chatbot_training_data (
          id, data_type, file_name, file_size, status, uploaded_by
        ) VALUES (gen_random_uuid(), $1, $2, $3, 'processing', $4)
        RETURNING id
      `, ['json', fileName, content.length, userId]);

      trainingId = trainingResult.rows[0].id;

      // Parse JSON
      const data = JSON.parse(content);
      const entries = Array.isArray(data) ? data : [data];

      logger.info(`[Training] Parsed ${entries.length} entries from JSON`);

      // Update total entries
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET total_entries = $1
        WHERE id = $2
      `, [entries.length, trainingId]);

      // Process each entry
      let processedCount = 0;
      for (const entry of entries) {
        try {
          const title = entry.title || entry.question || entry.heading || 'Untitled';
          const contentText = entry.content || entry.answer || entry.text || entry.body || '';
          const category = entry.category || entry.topic || 'general';

          if (!contentText || contentText.trim().length === 0) {
            continue;
          }

          await knowledgeBaseService.addKnowledge({
            title,
            content: contentText,
            contentType: 'json',
            source: fileName,
            category,
            metadata: entry.metadata || {},
            userId
          });

          processedCount++;

          // Update progress
          if (processedCount % 10 === 0) {
            await this.pool.query(`
              UPDATE chatbot_training_data
              SET processed_entries = $1
              WHERE id = $2
            `, [processedCount, trainingId]);
          }
        } catch (error) {
          logger.error(`[Training] Error processing JSON entry:`, error);
        }
      }

      // Mark as completed
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET status = 'completed', processed_entries = $1, processed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [processedCount, trainingId]);

      logger.info(`[Training] Completed JSON processing: ${processedCount} entries`);

      return {
        trainingId,
        totalEntries: processedCount
      };
    } catch (error) {
      logger.error('[Training] Error processing JSON:', error);

      if (trainingId) {
        await this.pool.query(`
          UPDATE chatbot_training_data
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error instanceof Error ? error.message : 'Unknown error', trainingId]);
      }

      throw error;
    }
  }

  /**
   * Process conversation history for training
   */
  async processConversation(params: {
    conversations: Array<{ question: string; answer: string }>;
    fileName: string;
    category?: string;
    userId?: string;
  }): Promise<{ trainingId: string; totalEntries: number }> {
    const { conversations, fileName, category, userId } = params;
    let trainingId: string | null = null;

    try {
      logger.info(`[Training] Processing conversation data: ${fileName}`);

      // Create training record
      const trainingResult = await this.pool.query(`
        INSERT INTO chatbot_training_data (
          id, data_type, file_name, file_size, status, uploaded_by
        ) VALUES (gen_random_uuid(), $1, $2, $3, 'processing', $4)
        RETURNING id
      `, ['conversation', fileName, 0, userId]);

      trainingId = trainingResult.rows[0].id;

      // Update total entries
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET total_entries = $1
        WHERE id = $2
      `, [conversations.length, trainingId]);

      // Process each conversation
      let processedCount = 0;
      for (const conv of conversations) {
        try {
          const title = conv.question.substring(0, 100) + '...';
          const content = `Question: ${conv.question}\n\nAnswer: ${conv.answer}`;

          await knowledgeBaseService.addKnowledge({
            title,
            content,
            contentType: 'conversation',
            source: fileName,
            category: category || 'general',
            userId
          });

          processedCount++;

          // Update progress
          if (processedCount % 10 === 0) {
            await this.pool.query(`
              UPDATE chatbot_training_data
              SET processed_entries = $1
              WHERE id = $2
            `, [processedCount, trainingId]);
          }
        } catch (error) {
          logger.error(`[Training] Error processing conversation:`, error);
        }
      }

      // Mark as completed
      await this.pool.query(`
        UPDATE chatbot_training_data
        SET status = 'completed', processed_entries = $1, processed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [processedCount, trainingId]);

      logger.info(`[Training] Completed conversation processing: ${processedCount} entries`);

      return {
        trainingId,
        totalEntries: processedCount
      };
    } catch (error) {
      logger.error('[Training] Error processing conversation:', error);

      if (trainingId) {
        await this.pool.query(`
          UPDATE chatbot_training_data
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [error instanceof Error ? error.message : 'Unknown error', trainingId]);
      }

      throw error;
    }
  }

  /**
   * Get training data status
   */
  async getTrainingStatus(trainingId: string): Promise<TrainingData> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM chatbot_training_data WHERE id = $1
      `, [trainingId]);

      if (result.rows.length === 0) {
        throw new Error('Training data not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        dataType: row.data_type,
        fileName: row.file_name,
        fileSize: row.file_size,
        processedEntries: row.processed_entries,
        totalEntries: row.total_entries,
        status: row.status,
        errorMessage: row.error_message,
        createdAt: row.created_at
      };
    } catch (error) {
      logger.error('[Training] Error getting training status:', error);
      throw error;
    }
  }

  /**
   * Get all training history
   */
  async getTrainingHistory(limit: number = 20): Promise<TrainingData[]> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM chatbot_training_data
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        id: row.id,
        dataType: row.data_type,
        fileName: row.file_name,
        fileSize: row.file_size,
        processedEntries: row.processed_entries,
        totalEntries: row.total_entries,
        status: row.status,
        errorMessage: row.error_message,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('[Training] Error getting training history:', error);
      throw error;
    }
  }
}

export const trainingService = new TrainingService();
