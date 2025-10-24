import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../config/logger.js';
import { knowledgeBaseService, type RetrievedSource } from './knowledge-base.service.js';

/**
 * Ask Elara Chatbot Service
 * Main conversational AI service for cybersecurity assistance
 */

export interface ChatbotConfig {
  id: string;
  name: string;
  systemPrompt: string;
  customInstructions?: string;
  temperature: number;
  maxTokens: number;
  model: string;
  enableRag: boolean;
  enableConversationMemory: boolean;
  maxConversationHistory: number;
  responseStyle: string;
  enabled: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  retrievedSources?: RetrievedSource[];
  tokensUsed?: number;
  latency?: number;
  confidence?: number;
}

export interface ChatResponse {
  message: string;
  sources?: RetrievedSource[];
  sessionId: string;
  confidence: number;
  tokensUsed: number;
  latency: number;
}

export class ChatbotService {
  private pool: Pool;
  private anthropic: Anthropic;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    this.anthropic = new Anthropic({ apiKey });
    logger.info('[Chatbot Service] Initialized with Claude Sonnet 4.5');
  }

  /**
   * Get active chatbot configuration
   */
  async getConfig(): Promise<ChatbotConfig> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM chatbot_config
        WHERE enabled = true
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        throw new Error('No active chatbot configuration found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        systemPrompt: row.system_prompt,
        customInstructions: row.custom_instructions,
        temperature: parseFloat(row.temperature),
        maxTokens: row.max_tokens,
        model: row.model,
        enableRag: row.enable_rag,
        enableConversationMemory: row.enable_conversation_memory,
        maxConversationHistory: row.max_conversation_history,
        responseStyle: row.response_style,
        enabled: row.enabled
      };
    } catch (error) {
      logger.error('[Chatbot] Error getting config:', error);
      throw error;
    }
  }

  /**
   * Chat with the bot
   */
  async chat(params: {
    message: string;
    sessionId?: string;
    userId?: string;
    category?: string;
  }): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const { message, sessionId, userId, category } = params;

      logger.info(`[Chatbot] Processing message: "${message.substring(0, 100)}..."`);

      // Get configuration
      const config = await this.getConfig();

      // Get or create session
      const session = sessionId
        ? await this.getSession(sessionId)
        : await this.createSession(userId);

      // Get conversation history if enabled
      let conversationHistory: ChatMessage[] = [];
      if (config.enableConversationMemory) {
        conversationHistory = await this.getConversationHistory(
          session.sessionId,
          config.maxConversationHistory
        );
      }

      // Retrieve relevant knowledge if RAG enabled
      let retrievedSources: RetrievedSource[] = [];
      let ragContext = '';

      if (config.enableRag) {
        retrievedSources = await knowledgeBaseService.searchKnowledge(message, 5, category);

        if (retrievedSources.length > 0) {
          ragContext = knowledgeBaseService.buildRAGContext(retrievedSources);
          logger.info(`[Chatbot] Retrieved ${retrievedSources.length} knowledge sources`);
        }
      }

      // Build system prompt
      let systemPrompt = config.systemPrompt || 'You are a helpful cybersecurity assistant.';

      if (config.customInstructions) {
        systemPrompt += `\n\n${config.customInstructions}`;
      }

      if (ragContext) {
        systemPrompt += `\n\nRELEVANT KNOWLEDGE FROM DATABASE:\n${ragContext}\n\nUse this information to provide accurate, detailed answers. Cite sources when relevant.`;
      }

      // Build messages for Claude
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      // Add conversation history
      for (const msg of conversationHistory) {
        if (msg.role !== 'system') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }

      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      // Call Claude API
      logger.info('[Chatbot] Calling Claude Sonnet 4.5...');
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: config.maxTokens || 2000,
        temperature: Number(config.temperature) || 0.7,
        system: [{ type: 'text', text: systemPrompt }],
        messages
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      const latency = Date.now() - startTime;

      // Calculate confidence based on sources and response
      const confidence = this.calculateConfidence(retrievedSources, assistantMessage);

      // Save messages to database
      await this.saveMessage({
        sessionId: session.sessionId,
        role: 'user',
        content: message
      });

      await this.saveMessage({
        sessionId: session.sessionId,
        role: 'assistant',
        content: assistantMessage,
        retrievedSources,
        tokensUsed,
        latency,
        confidence,
        model: config.model
      });

      // Update session activity
      await this.updateSessionActivity(session.sessionId);

      logger.info(`[Chatbot] Response generated (${latency}ms, ${tokensUsed} tokens)`);

      return {
        message: assistantMessage,
        sources: retrievedSources.length > 0 ? retrievedSources : undefined,
        sessionId: session.sessionId,
        confidence,
        tokensUsed,
        latency
      };
    } catch (error) {
      logger.error('[Chatbot] Error processing chat:', error);
      throw error;
    }
  }

  /**
   * Create new chat session
   */
  private async createSession(userId?: string): Promise<{ sessionId: string; sessionToken: string }> {
    try {
      const sessionToken = this.generateSessionToken();

      const result = await this.pool.query(`
        INSERT INTO chat_sessions (id, user_id, session_token, context, metadata)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING id, session_token
      `, [userId, sessionToken, JSON.stringify({}), JSON.stringify({})]);

      const row = result.rows[0];
      logger.info(`[Chatbot] Created new session: ${row.session_token}`);

      return {
        sessionId: row.id,
        sessionToken: row.session_token
      };
    } catch (error) {
      logger.error('[Chatbot] Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get existing session
   */
  private async getSession(sessionId: string): Promise<{ sessionId: string; sessionToken: string }> {
    try {
      const result = await this.pool.query(`
        SELECT id, session_token FROM chat_sessions
        WHERE id::text = $1 OR session_token = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        throw new Error('Session not found');
      }

      return {
        sessionId: result.rows[0].id,
        sessionToken: result.rows[0].session_token
      };
    } catch (error) {
      logger.error('[Chatbot] Error getting session:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(sessionId: string, limit: number): Promise<ChatMessage[]> {
    try {
      const result = await this.pool.query(`
        SELECT role, content, retrieved_sources, tokens_used, latency, confidence
        FROM chat_messages
        WHERE session_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT $2
      `, [sessionId, limit]);

      // Reverse to get chronological order
      return result.rows.reverse().map(row => ({
        role: row.role,
        content: row.content,
        retrievedSources: row.retrieved_sources,
        tokensUsed: row.tokens_used,
        latency: row.latency,
        confidence: row.confidence ? parseFloat(row.confidence) : undefined
      }));
    } catch (error) {
      logger.error('[Chatbot] Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Save message to database
   */
  private async saveMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    retrievedSources?: RetrievedSource[];
    tokensUsed?: number;
    latency?: number;
    confidence?: number;
    model?: string;
  }): Promise<void> {
    try {
      const { sessionId, role, content, retrievedSources, tokensUsed, latency, confidence, model } = params;

      await this.pool.query(`
        INSERT INTO chat_messages (
          id, session_id, role, content, retrieved_sources,
          model, tokens_used, latency, confidence
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        sessionId,
        role,
        content,
        retrievedSources ? JSON.stringify(retrievedSources) : null,
        model,
        tokensUsed,
        latency,
        confidence
      ]);
    } catch (error) {
      logger.error('[Chatbot] Error saving message:', error);
      throw error;
    }
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE chat_sessions
        SET last_activity = CURRENT_TIMESTAMP,
            message_count = message_count + 1
        WHERE id = $1::uuid
      `, [sessionId]);
    } catch (error) {
      logger.error('[Chatbot] Error updating session:', error);
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(sources: RetrievedSource[], response: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have relevant sources
    if (sources.length > 0) {
      const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
      confidence += avgSimilarity * 0.3;
    }

    // Increase confidence if response is detailed
    if (response.length > 200) {
      confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate session token
   */
  private generateSessionToken(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(sessionId: string): Promise<{
    messageCount: number;
    duration: number;
    avgTokens: number;
    avgLatency: number;
  }> {
    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as message_count,
          EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as duration,
          AVG(tokens_used) as avg_tokens,
          AVG(latency) as avg_latency
        FROM chat_messages
        WHERE session_id = $1::uuid
      `, [sessionId]);

      const row = result.rows[0];
      return {
        messageCount: parseInt(row.message_count),
        duration: parseFloat(row.duration) || 0,
        avgTokens: parseFloat(row.avg_tokens) || 0,
        avgLatency: parseFloat(row.avg_latency) || 0
      };
    } catch (error) {
      logger.error('[Chatbot] Error getting session statistics:', error);
      throw error;
    }
  }

  /**
   * End session and collect feedback
   */
  async endSession(sessionId: string, rating?: number, feedback?: string): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE chat_sessions
        SET ended_at = CURRENT_TIMESTAMP, rating = $2, feedback = $3
        WHERE id = $1::uuid
      `, [sessionId, rating, feedback]);

      logger.info(`[Chatbot] Session ended: ${sessionId}`);
    } catch (error) {
      logger.error('[Chatbot] Error ending session:', error);
      throw error;
    }
  }
}

export const chatbotService = new ChatbotService();
