import { Pool } from 'pg';
import { logger } from '../../config/logger.js';
import { embeddingsService } from '../ai/embeddings.service.js';

/**
 * Knowledge Base Service
 * Handles RAG (Retrieval Augmented Generation) for chatbot
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  contentType: string;
  source?: string;
  category?: string;
  embedding?: number[];
  metadata?: any;
  chunkIndex: number;
  totalChunks: number;
  indexed: boolean;
  createdAt: Date;
}

export interface RetrievedSource {
  id: string;
  title: string;
  content: string;
  similarity: number;
  category?: string;
  source?: string;
}

export class KnowledgeBaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    logger.info('[Knowledge Base] Service initialized');
  }

  /**
   * Add knowledge entry to database
   */
  async addKnowledge(params: {
    title: string;
    content: string;
    contentType?: string;
    source?: string;
    category?: string;
    metadata?: any;
    userId?: string;
  }): Promise<string> {
    try {
      const { title, content, contentType = 'text', source, category, metadata, userId } = params;

      // Chunk large content
      const chunks = embeddingsService.chunkText(content);
      const knowledgeIds: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Generate embedding
        logger.info(`[Knowledge Base] Generating embedding for chunk ${i + 1}/${chunks.length}`);
        const embedding = await embeddingsService.generateEmbedding(chunk);

        // Convert embedding to PostgreSQL vector format
        const embeddingStr = `[${embedding.join(',')}]`;

        // Insert into database
        const result = await this.pool.query(`
          INSERT INTO knowledge_base (
            id, title, content, content_type, source, category,
            embedding, metadata, chunk_index, total_chunks,
            indexed, created_by
          ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
          RETURNING id
        `, [
          i === 0 ? title : `${title} (Part ${i + 1})`,
          chunk,
          contentType,
          source,
          category,
          embeddingStr,
          JSON.stringify(metadata || {}),
          i,
          chunks.length,
          userId
        ]);

        knowledgeIds.push(result.rows[0].id);
      }

      logger.info(`[Knowledge Base] Added ${chunks.length} knowledge chunks for: ${title}`);
      return knowledgeIds[0]; // Return first chunk ID
    } catch (error) {
      logger.error('[Knowledge Base] Error adding knowledge:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base using vector similarity
   */
  async searchKnowledge(query: string, limit: number = 5, category?: string): Promise<RetrievedSource[]> {
    try {
      // Generate embedding for query
      logger.info(`[Knowledge Base] Searching for: "${query.substring(0, 100)}..."`);
      const queryEmbedding = await embeddingsService.generateEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Build query with optional category filter
      let sqlQuery = `
        SELECT
          id,
          title,
          content,
          category,
          source,
          1 - (embedding <=> $1::vector) as similarity
        FROM knowledge_base
        WHERE indexed = true
      `;

      const params: any[] = [embeddingStr];

      if (category) {
        sqlQuery += ' AND category = $2';
        params.push(category);
      }

      sqlQuery += `
        ORDER BY embedding <=> $1::vector
        LIMIT ${limit}
      `;

      const result = await this.pool.query(sqlQuery, params);

      const sources: RetrievedSource[] = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        similarity: parseFloat(row.similarity),
        category: row.category,
        source: row.source
      }));

      logger.info(`[Knowledge Base] Found ${sources.length} relevant sources`);
      return sources;
    } catch (error) {
      logger.error('[Knowledge Base] Error searching knowledge:', error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    try {
      const result = await this.pool.query(`
        SELECT category, COUNT(*) as count
        FROM knowledge_base
        WHERE category IS NOT NULL AND indexed = true
        GROUP BY category
        ORDER BY count DESC
      `);

      return result.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('[Knowledge Base] Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStatistics(): Promise<{
    totalEntries: number;
    indexedEntries: number;
    categories: number;
    totalChunks: number;
  }> {
    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total_entries,
          SUM(CASE WHEN indexed = true THEN 1 ELSE 0 END) as indexed_entries,
          COUNT(DISTINCT category) as categories,
          SUM(total_chunks) as total_chunks
        FROM knowledge_base
      `);

      const row = result.rows[0];
      return {
        totalEntries: parseInt(row.total_entries),
        indexedEntries: parseInt(row.indexed_entries),
        categories: parseInt(row.categories),
        totalChunks: parseInt(row.total_chunks) || 0
      };
    } catch (error) {
      logger.error('[Knowledge Base] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Delete knowledge entry
   */
  async deleteKnowledge(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM knowledge_base WHERE id = $1::uuid', [id]);
      logger.info(`[Knowledge Base] Deleted entry: ${id}`);
    } catch (error) {
      logger.error('[Knowledge Base] Error deleting knowledge:', error);
      throw error;
    }
  }

  /**
   * Update knowledge entry
   */
  async updateKnowledge(id: string, params: {
    title?: string;
    content?: string;
    category?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      const { title, content, category, metadata } = params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (title) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }

      if (content) {
        updates.push(`content = $${paramIndex++}`);
        values.push(content);

        // Regenerate embedding if content changed
        const embedding = await embeddingsService.generateEmbedding(content);
        const embeddingStr = `[${embedding.join(',')}]`;
        updates.push(`embedding = $${paramIndex++}::vector`);
        values.push(embeddingStr);
      }

      if (category) {
        updates.push(`category = $${paramIndex++}`);
        values.push(category);
      }

      if (metadata) {
        updates.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(metadata));
      }

      if (updates.length === 0) {
        return;
      }

      values.push(id);
      await this.pool.query(`
        UPDATE knowledge_base
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}::uuid
      `, values);

      logger.info(`[Knowledge Base] Updated entry: ${id}`);
    } catch (error) {
      logger.error('[Knowledge Base] Error updating knowledge:', error);
      throw error;
    }
  }

  /**
   * Build context from retrieved sources
   */
  buildRAGContext(sources: RetrievedSource[], maxLength: number = 3000): string {
    let context = '';
    let currentLength = 0;

    for (const source of sources) {
      const sourceText = `[Source: ${source.title}${source.category ? ` (${source.category})` : ''}]\n${source.content}\n\n`;

      if (currentLength + sourceText.length > maxLength) {
        break;
      }

      context += sourceText;
      currentLength += sourceText.length;
    }

    return context.trim();
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
