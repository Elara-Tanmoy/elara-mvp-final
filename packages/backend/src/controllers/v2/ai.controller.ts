/**
 * V2 AI API Controller - Central AI API for B2B Partners
 * Provides AI-powered analysis endpoints for external partners
 */

import { Request, Response } from 'express';
import { geminiRouterService } from '../../services/ai/geminiRouter.service.js';
import { geminiScanSummarizerService } from '../../services/ai/gemini-scan-summarizer.service.js';
import { createURLScannerV2, getDefaultV2Config } from '../../scanners/url-scanner-v2/index.js';
import { logger } from '../../config/logger.js';
import { z } from 'zod';

// Request validation schemas
const analyzeSchema = z.object({
  content: z.string().min(1).max(50000),
  type: z.enum(['url', 'text', 'html', 'email']).optional(),
  context: z.string().optional()
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  context: z.any().optional()
});

const scanUriSchema = z.object({
  url: z.string().url(),
  options: z.object({
    skipScreenshot: z.boolean().optional(),
    skipTLS: z.boolean().optional(),
    skipWHOIS: z.boolean().optional(),
    skipStage2: z.boolean().optional()
  }).optional()
});

/**
 * V2 AI Controller class
 */
export class V2AIController {
  /**
   * POST /api/v2/ai/analyze
   * Analyze content using Gemini AI
   */
  async analyze(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validated = analyzeSchema.parse(req.body);

      // Build analysis prompt based on content type
      const prompt = this.buildAnalysisPrompt(
        validated.content,
        validated.type || 'text',
        validated.context
      );

      // Determine complexity for model selection
      const useProModel = validated.content.length > 5000 || validated.type === 'html';

      // Generate analysis
      const analysis = await geminiRouterService.generateContent(prompt, {
        useProModel,
        temperature: 0.3,
        maxTokens: 2000
      });

      // Parse response
      const result = this.parseAnalysisResponse(analysis, validated.type || 'text');

      // Log usage for billing
      await this.logAPIUsage(req, 'analyze', {
        contentLength: validated.content.length,
        modelUsed: useProModel ? 'gemini-pro' : 'gemini-flash'
      });

      res.json({
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          modelUsed: useProModel ? 'gemini-pro' : 'gemini-flash',
          contentType: validated.type || 'text'
        }
      });

    } catch (error: any) {
      logger.error('[V2AI] Analyze error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Analysis failed',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v2/ai/chat
   * Conversational AI chatbot endpoint
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validated = chatSchema.parse(req.body);

      // Build chat prompt with context
      const prompt = this.buildChatPrompt(
        validated.message,
        validated.context
      );

      // Generate response using Flash (faster for chat)
      const response = await geminiRouterService.generateContent(prompt, {
        useProModel: false,
        temperature: 0.7, // Higher temperature for more natural conversation
        maxTokens: 500
      });

      // Log usage
      await this.logAPIUsage(req, 'chat', {
        messageLength: validated.message.length,
        conversationId: validated.conversationId
      });

      res.json({
        success: true,
        data: {
          response: response.trim(),
          conversationId: validated.conversationId || this.generateConversationId()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          modelUsed: 'gemini-flash'
        }
      });

    } catch (error: any) {
      logger.error('[V2AI] Chat error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Chat failed',
        message: error.message
      });
    }
  }

  /**
   * POST /api/v2/scan/uri
   * V2 URL scanner endpoint for B2B partners
   */
  async scanUri(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validated = scanUriSchema.parse(req.body);

      // Get V2 scanner config
      const config = getDefaultV2Config();
      const scanner = createURLScannerV2(config);

      // Perform scan
      const scanResult = await scanner.scan(validated.url, validated.options || {});

      // Log usage
      await this.logAPIUsage(req, 'scan', {
        url: validated.url,
        scanId: scanResult.scanId
      });

      res.json({
        success: true,
        data: scanResult,
        metadata: {
          timestamp: new Date().toISOString(),
          version: 'v2',
          latency: scanResult.latency.total
        }
      });

    } catch (error: any) {
      logger.error('[V2AI] Scan URI error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Scan failed',
        message: error.message
      });
    }
  }

  /**
   * GET /api/v2/ai/models
   * List available AI models and their capabilities
   */
  async listModels(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        models: [
          {
            id: 'gemini-flash',
            name: 'Gemini Flash',
            description: 'Fast, efficient model for simple tasks',
            capabilities: ['analysis', 'chat', 'summarization'],
            maxTokens: 8192,
            costPerRequest: 0.001
          },
          {
            id: 'gemini-pro',
            name: 'Gemini Pro',
            description: 'Advanced model for complex reasoning',
            capabilities: ['deep-analysis', 'complex-reasoning', 'detailed-explanations'],
            maxTokens: 32768,
            costPerRequest: 0.005
          }
        ],
        endpoints: [
          {
            path: '/api/v2/ai/analyze',
            method: 'POST',
            description: 'Analyze content using AI',
            models: ['gemini-flash', 'gemini-pro']
          },
          {
            path: '/api/v2/ai/chat',
            method: 'POST',
            description: 'Conversational AI interface',
            models: ['gemini-flash']
          },
          {
            path: '/api/v2/scan/uri',
            method: 'POST',
            description: 'Scan URLs with V2 scanner',
            models: ['all-v2-models']
          }
        ]
      }
    });
  }

  /**
   * GET /api/v2/ai/usage
   * Get API usage statistics for the authenticated tenant
   */
  async getUsage(req: Request, res: Response): Promise<void> {
    try {
      // Get tenant/org from authenticated request
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Organization ID required'
        });
        return;
      }

      // TODO: Fetch usage stats from database
      // For now, return mock data
      res.json({
        success: true,
        data: {
          organizationId,
          period: 'current_month',
          usage: {
            analyze: {
              requests: 0,
              tokensUsed: 0,
              cost: 0
            },
            chat: {
              requests: 0,
              tokensUsed: 0,
              cost: 0
            },
            scan: {
              requests: 0,
              cost: 0
            },
            total: {
              requests: 0,
              cost: 0
            }
          },
          limits: {
            maxRequestsPerMonth: 10000,
            maxCostPerMonth: 100
          }
        }
      });

    } catch (error: any) {
      logger.error('[V2AI] Get usage error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch usage',
        message: error.message
      });
    }
  }

  /**
   * Build analysis prompt based on content type
   */
  private buildAnalysisPrompt(content: string, type: string, context?: string): string {
    let prompt = `Analyze the following ${type}:\n\n`;

    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    prompt += `${type.toUpperCase()}:\n${content}\n\n`;

    prompt += `Provide a structured analysis including:
1. **Summary**: Brief overview (2-3 sentences)
2. **Key Points**: Main takeaways (3-5 bullet points)
3. **Risk Assessment**: Identify any security concerns or suspicious patterns
4. **Recommendations**: Actionable next steps

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "riskAssessment": {
    "level": "low|medium|high",
    "concerns": ["...", "..."]
  },
  "recommendations": ["...", "..."]
}`;

    return prompt;
  }

  /**
   * Parse analysis response
   */
  private parseAnalysisResponse(response: string, type: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('[V2AI] Failed to parse analysis as JSON');
    }

    // Fallback: return raw response
    return {
      summary: response.substring(0, 500),
      keyPoints: [],
      riskAssessment: { level: 'unknown', concerns: [] },
      recommendations: []
    };
  }

  /**
   * Build chat prompt
   */
  private buildChatPrompt(message: string, context?: any): string {
    let prompt = 'You are Elara AI, a helpful cybersecurity assistant.\n\n';

    if (context) {
      prompt += `Context from previous conversation:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += `User: ${message}\n\nElara AI:`;

    return prompt;
  }

  /**
   * Generate conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log API usage for billing
   */
  private async logAPIUsage(req: Request, endpoint: string, metadata: any): Promise<void> {
    try {
      const organizationId = (req as any).user?.organizationId || 'anonymous';

      // TODO: Store in database for billing
      logger.info('[V2AI] API Usage', {
        organizationId,
        endpoint,
        metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[V2AI] Failed to log usage:', error);
      // Don't fail the request if logging fails
    }
  }
}

export const v2AIController = new V2AIController();
