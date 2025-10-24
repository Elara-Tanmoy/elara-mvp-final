import OpenAI from 'openai';
import { logger } from '../../config/logger.js';

/**
 * Embeddings Service
 * Generates vector embeddings for text using OpenAI
 */

export class EmbeddingsService {
  private openai: OpenAI;
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly EMBEDDING_DIMENSION = 1536;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.openai = new OpenAI({ apiKey });
    logger.info('[Embeddings Service] Initialized with OpenAI');
  }

  /**
   * Generate embedding for single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      // Truncate if too long (OpenAI has 8191 token limit)
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      const response = await this.openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: truncatedText,
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;

      logger.info(`[Embeddings] Generated embedding for text (${text.length} chars)`);
      return embedding;
    } catch (error) {
      logger.error('[Embeddings] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (!texts || texts.length === 0) {
        return [];
      }

      // Process in batches of 100 (OpenAI limit)
      const batchSize = 100;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        // Truncate each text
        const truncatedBatch = batch.map(text =>
          text.length > 8000 ? text.substring(0, 8000) : text
        );

        const response = await this.openai.embeddings.create({
          model: this.EMBEDDING_MODEL,
          input: truncatedBatch,
          encoding_format: 'float'
        });

        const embeddings = response.data.map(item => item.embedding);
        results.push(...embeddings);

        logger.info(`[Embeddings] Generated ${embeddings.length} embeddings (batch ${Math.floor(i / batchSize) + 1})`);
      }

      return results;
    } catch (error) {
      logger.error('[Embeddings] Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Chunk large text into smaller pieces for embedding
   */
  chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + maxChunkSize, text.length);
      const chunk = text.substring(startIndex, endIndex);
      chunks.push(chunk);

      // Move to next chunk with overlap
      startIndex += maxChunkSize - overlap;
    }

    logger.info(`[Embeddings] Chunked text into ${chunks.length} pieces (${text.length} chars total)`);
    return chunks;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    return this.EMBEDDING_DIMENSION;
  }
}

export const embeddingsService = new EmbeddingsService();
