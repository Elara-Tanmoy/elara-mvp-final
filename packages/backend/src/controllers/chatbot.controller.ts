import { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { chatbotService } from '../services/chatbot/chatbot.service.js';
import { knowledgeBaseService } from '../services/chatbot/knowledge-base.service.js';
import { trainingService } from '../services/chatbot/training.service.js';
import { Pool } from 'pg';

/**
 * Ask Elara Chatbot Controller
 * Handles all chatbot-related API endpoints
 */

export class ChatbotController {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Chat with the bot
   * POST /api/v2/chatbot/chat
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, sessionId, category } = req.body;
      const userId = (req.user as any)?.userId || undefined;

      if (!message || message.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Message is required'
        });
        return;
      }

      logger.info(`[Chatbot API] Chat request from user ${userId || 'anonymous'}`);

      const response = await chatbotService.chat({
        message,
        sessionId,
        userId,
        category
      });

      res.status(200).json({
        success: true,
        data: response
      });
    } catch (error) {
      logger.error('[Chatbot API] Chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process chat message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get session details
   * GET /api/v2/chatbot/session/:id
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const stats = await chatbotService.getSessionStatistics(id);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('[Chatbot API] Get session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * End session with rating
   * POST /api/v2/chatbot/session/end
   */
  async endSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, rating, feedback } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      await chatbotService.endSession(sessionId, rating, feedback);

      res.status(200).json({
        success: true,
        message: 'Session ended successfully'
      });
    } catch (error) {
      logger.error('[Chatbot API] End session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to end session'
      });
    }
  }

  /**
   * Get chatbot configuration
   * GET /api/v2/chatbot/config
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = await chatbotService.getConfig();

      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('[Chatbot API] Get config error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get configuration'
      });
    }
  }

  /**
   * Update chatbot configuration
   * PUT /api/v2/chatbot/config
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const {
        systemPrompt,
        customInstructions,
        temperature,
        maxTokens,
        enableRag,
        enableConversationMemory,
        maxConversationHistory,
        model,
        responseStyle
      } = req.body;

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (systemPrompt !== undefined) {
        updates.push(`system_prompt = $${paramIndex++}`);
        values.push(systemPrompt);
      }

      if (customInstructions !== undefined) {
        updates.push(`custom_instructions = $${paramIndex++}`);
        values.push(customInstructions);
      }

      if (temperature !== undefined) {
        updates.push(`temperature = $${paramIndex++}`);
        values.push(temperature);
      }

      if (maxTokens !== undefined) {
        updates.push(`max_tokens = $${paramIndex++}`);
        values.push(maxTokens);
      }

      if (enableRag !== undefined) {
        updates.push(`enable_rag = $${paramIndex++}`);
        values.push(enableRag);
      }

      if (enableConversationMemory !== undefined) {
        updates.push(`enable_conversation_memory = $${paramIndex++}`);
        values.push(enableConversationMemory);
      }

      if (maxConversationHistory !== undefined) {
        updates.push(`max_conversation_history = $${paramIndex++}`);
        values.push(maxConversationHistory);
      }

      if (model !== undefined) {
        updates.push(`model = $${paramIndex++}`);
        values.push(model);
      }

      if (responseStyle !== undefined) {
        updates.push(`response_style = $${paramIndex++}`);
        values.push(responseStyle);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
        return;
      }

      const result = await this.pool.query(`
        UPDATE chatbot_config
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE enabled = true
      `, values);

      if (result.rowCount === 0) {
        res.status(404).json({
          success: false,
          error: 'No enabled chatbot configuration found. Please run SETUP_ADMIN_CONFIG.sql first.'
        });
        return;
      }

      logger.info('[Chatbot API] Configuration updated');

      res.status(200).json({
        success: true,
        message: 'Configuration updated successfully'
      });
    } catch (error) {
      logger.error('[Chatbot API] Update config error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration'
      });
    }
  }

  /**
   * Add knowledge entry
   * POST /api/v2/chatbot/knowledge
   */
  async addKnowledge(req: Request, res: Response): Promise<void> {
    try {
      const { title, content, category, source } = req.body;
      const userId = (req.user as any)?.userId || undefined;

      if (!title || !content) {
        res.status(400).json({
          success: false,
          error: 'Title and content are required'
        });
        return;
      }

      const id = await knowledgeBaseService.addKnowledge({
        title,
        content,
        category,
        source,
        userId
      });

      logger.info(`[Chatbot API] Knowledge added: ${id}`);

      res.status(201).json({
        success: true,
        data: { id },
        message: 'Knowledge added successfully'
      });
    } catch (error) {
      logger.error('[Chatbot API] Add knowledge error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add knowledge'
      });
    }
  }

  /**
   * Search knowledge base
   * GET /api/v2/chatbot/knowledge/search?q=query&category=cat&limit=5
   */
  async searchKnowledge(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const category = req.query.category as string | undefined;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
        return;
      }

      const results = await knowledgeBaseService.searchKnowledge(query, limit, category);

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('[Chatbot API] Search knowledge error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search knowledge'
      });
    }
  }

  /**
   * Get knowledge base statistics
   * GET /api/v2/chatbot/knowledge/stats
   */
  async getKnowledgeStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await knowledgeBaseService.getStatistics();
      const categories = await knowledgeBaseService.getCategories();

      res.status(200).json({
        success: true,
        data: {
          ...stats,
          categoryBreakdown: categories
        }
      });
    } catch (error) {
      logger.error('[Chatbot API] Get knowledge stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  }

  /**
   * Delete knowledge entry
   * DELETE /api/v2/chatbot/knowledge/:id
   */
  async deleteKnowledge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await knowledgeBaseService.deleteKnowledge(id);

      logger.info(`[Chatbot API] Knowledge deleted: ${id}`);

      res.status(200).json({
        success: true,
        message: 'Knowledge deleted successfully'
      });
    } catch (error) {
      logger.error('[Chatbot API] Delete knowledge error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete knowledge'
      });
    }
  }

  /**
   * Upload CSV training data
   * POST /api/v2/chatbot/training/csv
   */
  async uploadCSV(req: Request, res: Response): Promise<void> {
    try {
      const { content, fileName } = req.body;
      const userId = (req.user as any)?.userId || undefined;

      if (!content || !fileName) {
        res.status(400).json({
          success: false,
          error: 'Content and fileName are required'
        });
        return;
      }

      const result = await trainingService.processCSV({
        content,
        fileName,
        userId
      });

      logger.info(`[Chatbot API] CSV uploaded: ${fileName} (${result.totalEntries} entries)`);

      res.status(200).json({
        success: true,
        data: result,
        message: `Processed ${result.totalEntries} entries`
      });
    } catch (error) {
      logger.error('[Chatbot API] Upload CSV error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process CSV',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Upload text training data
   * POST /api/v2/chatbot/training/text
   */
  async uploadText(req: Request, res: Response): Promise<void> {
    try {
      const { content, fileName, title, category } = req.body;
      const userId = (req.user as any)?.userId || undefined;

      if (!content || !fileName) {
        res.status(400).json({
          success: false,
          error: 'Content and fileName are required'
        });
        return;
      }

      const result = await trainingService.processText({
        content,
        fileName,
        title,
        category,
        userId
      });

      logger.info(`[Chatbot API] Text uploaded: ${fileName} (${result.totalEntries} entries)`);

      res.status(200).json({
        success: true,
        data: result,
        message: `Processed ${result.totalEntries} entries`
      });
    } catch (error) {
      logger.error('[Chatbot API] Upload text error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process text'
      });
    }
  }

  /**
   * Upload JSON training data
   * POST /api/v2/chatbot/training/json
   */
  async uploadJSON(req: Request, res: Response): Promise<void> {
    try {
      const { content, fileName } = req.body;
      const userId = (req.user as any)?.userId || undefined;

      if (!content || !fileName) {
        res.status(400).json({
          success: false,
          error: 'Content and fileName are required'
        });
        return;
      }

      const result = await trainingService.processJSON({
        content,
        fileName,
        userId
      });

      logger.info(`[Chatbot API] JSON uploaded: ${fileName} (${result.totalEntries} entries)`);

      res.status(200).json({
        success: true,
        data: result,
        message: `Processed ${result.totalEntries} entries`
      });
    } catch (error) {
      logger.error('[Chatbot API] Upload JSON error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process JSON'
      });
    }
  }

  /**
   * Get training status
   * GET /api/v2/chatbot/training/:id
   */
  async getTrainingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const status = await trainingService.getTrainingStatus(id);

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('[Chatbot API] Get training status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get training status'
      });
    }
  }

  /**
   * Get training history
   * GET /api/v2/chatbot/training/history
   */
  async getTrainingHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await trainingService.getTrainingHistory(limit);

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('[Chatbot API] Get training history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get training history'
      });
    }
  }

  /**
   * Get analytics
   * GET /api/v2/chatbot/analytics
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 7;

      const result = await this.pool.query(`
        SELECT
          date,
          total_messages,
          total_sessions,
          unique_users,
          avg_response_time,
          avg_rating,
          successful_responses,
          failed_responses
        FROM chatbot_analytics
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `);

      res.status(200).json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('[Chatbot API] Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics'
      });
    }
  }
}

export const chatbotController = new ChatbotController();
