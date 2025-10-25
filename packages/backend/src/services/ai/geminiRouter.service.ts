/**
 * Gemini Router Service
 *
 * Provides smart routing between Gemini 1.5 Flash and Gemini 1.5 Pro models via Vertex AI.
 * Features:
 * - Smart routing based on task complexity
 * - Response caching to reduce costs
 * - Fallback to direct Gemini API if Vertex fails
 * - Cost tracking and optimization
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import crypto from 'crypto';
import NodeCache from 'node-cache';

/**
 * Task complexity level
 */
export enum TaskComplexity {
  SIMPLE = 'simple',       // Use Flash
  MODERATE = 'moderate',   // Use Flash or Pro based on context length
  COMPLEX = 'complex'      // Use Pro
}

/**
 * Gemini Router configuration
 */
export interface GeminiRouterConfig {
  vertexProjectId: string;
  vertexLocation: string;
  vertexAccessToken?: string;
  geminiApiKey: string;
  cacheTTL: number; // seconds
  enableCaching: boolean;
  enableCostTracking: boolean;
}

/**
 * Gemini request
 */
export interface GeminiRequest {
  prompt: string;
  complexity?: TaskComplexity;
  maxTokens?: number;
  temperature?: number;
  contextLength?: number; // Approximate input length
  systemInstruction?: string;
  cacheKey?: string; // Optional custom cache key
}

/**
 * Gemini response
 */
export interface GeminiResponse {
  text: string;
  model: 'flash' | 'pro';
  cached: boolean;
  cost: number; // Estimated cost in USD
  latency: number; // ms
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Cost tracking
 */
interface CostTracker {
  totalRequests: number;
  flashRequests: number;
  proRequests: number;
  cachedRequests: number;
  totalCost: number;
  estimatedSavings: number; // From caching
}

/**
 * Gemini Router Service
 */
export class GeminiRouterService {
  private config: GeminiRouterConfig;
  private cache: NodeCache;
  private costTracker: CostTracker;
  private geminiClient: GoogleGenerativeAI;

  // Vertex AI model endpoints
  private flashModel: string;
  private proModel: string;

  // Pricing (per 1k tokens, approximate as of 2024)
  private readonly PRICING = {
    flash: {
      input: 0.00001,   // $0.01 per 1M tokens
      output: 0.00003   // $0.03 per 1M tokens
    },
    pro: {
      input: 0.000125,  // $0.125 per 1M tokens
      output: 0.000375  // $0.375 per 1M tokens
    }
  };

  constructor(config: GeminiRouterConfig) {
    this.config = config;
    this.cache = new NodeCache({
      stdTTL: config.cacheTTL,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false  // Don't clone objects (faster)
    });

    this.costTracker = {
      totalRequests: 0,
      flashRequests: 0,
      proRequests: 0,
      cachedRequests: 0,
      totalCost: 0,
      estimatedSavings: 0
    };

    this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey);

    // Vertex AI model paths
    this.flashModel = `projects/${config.vertexProjectId}/locations/${config.vertexLocation}/publishers/google/models/gemini-1.5-flash`;
    this.proModel = `projects/${config.vertexProjectId}/locations/${config.vertexLocation}/publishers/google/models/gemini-1.5-pro`;
  }

  /**
   * Generate response with smart routing
   */
  async generate(request: GeminiRequest): Promise<GeminiResponse> {
    const startTime = Date.now();

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.checkCache(request);
      if (cached) {
        this.costTracker.cachedRequests++;
        this.costTracker.totalRequests++;

        // Calculate savings (assume average pro model cost)
        const estimatedInputTokens = Math.ceil((request.contextLength || request.prompt.length) / 4);
        const estimatedOutputTokens = Math.ceil((cached.text.length) / 4);
        const savedCost = this.calculateCost('pro', estimatedInputTokens, estimatedOutputTokens);
        this.costTracker.estimatedSavings += savedCost;

        return {
          ...cached,
          cached: true,
          latency: Date.now() - startTime
        };
      }
    }

    // Determine which model to use
    const modelChoice = this.selectModel(request);

    try {
      // Try Vertex AI first
      const response = await this.callVertexAI(request, modelChoice);

      // Cache the response
      if (this.config.enableCaching) {
        this.cacheResponse(request, response);
      }

      // Update cost tracking
      this.updateCostTracking(modelChoice, response);

      response.latency = Date.now() - startTime;
      return response;

    } catch (vertexError) {
      console.warn('Vertex AI call failed, falling back to direct Gemini API:', vertexError);

      // Fallback to direct Gemini API
      const response = await this.callGeminiDirect(request, modelChoice);

      // Cache the response
      if (this.config.enableCaching) {
        this.cacheResponse(request, response);
      }

      // Update cost tracking
      this.updateCostTracking(modelChoice, response);

      response.latency = Date.now() - startTime;
      return response;
    }
  }

  /**
   * Select which model to use based on task complexity
   */
  private selectModel(request: GeminiRequest): 'flash' | 'pro' {
    // If complexity explicitly specified
    if (request.complexity) {
      if (request.complexity === TaskComplexity.SIMPLE) return 'flash';
      if (request.complexity === TaskComplexity.COMPLEX) return 'pro';
    }

    // Auto-detect based on heuristics
    const promptLength = request.prompt.length;
    const contextLength = request.contextLength || 0;

    // Use Pro if:
    // 1. Very long context (> 20k chars)
    // 2. Multi-step reasoning keywords detected
    // 3. Complex analysis requested

    if (contextLength > 20000) return 'pro';

    const complexityKeywords = [
      'analyze', 'explain', 'compare', 'evaluate',
      'reasoning', 'multi-step', 'detailed',
      'comprehensive', 'in-depth'
    ];

    const hasComplexity = complexityKeywords.some(kw =>
      request.prompt.toLowerCase().includes(kw)
    );

    if (hasComplexity && contextLength > 5000) return 'pro';

    // Default to Flash for simple tasks
    return 'flash';
  }

  /**
   * Call Vertex AI
   */
  private async callVertexAI(
    request: GeminiRequest,
    model: 'flash' | 'pro'
  ): Promise<GeminiResponse> {
    const endpoint = model === 'flash' ? this.flashModel : this.proModel;
    const url = `https://${this.config.vertexLocation}-aiplatform.googleapis.com/v1/${endpoint}:generateContent`;

    const payload = {
      contents: [{
        role: 'user',
        parts: [{
          text: request.prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
        topP: 0.95,
        topK: 40
      }
    };

    if (request.systemInstruction) {
      (payload as any).systemInstruction = {
        parts: [{ text: request.systemInstruction }]
      };
    }

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.config.vertexAccessToken || await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const text = response.data.candidates[0].content.parts[0].text;
    const usage = response.data.usageMetadata || {};

    return {
      text,
      model,
      cached: false,
      cost: this.calculateCost(model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0),
      latency: 0, // Will be set by caller
      tokensUsed: {
        input: usage.promptTokenCount || 0,
        output: usage.candidatesTokenCount || 0,
        total: usage.totalTokenCount || 0
      }
    };
  }

  /**
   * Call Gemini API directly (fallback)
   */
  private async callGeminiDirect(
    request: GeminiRequest,
    model: 'flash' | 'pro'
  ): Promise<GeminiResponse> {
    const modelName = model === 'flash' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
    const geminiModel = this.geminiClient.getGenerativeModel({ model: modelName });

    const result = await geminiModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: request.prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7
      }
    });

    const text = result.response.text();

    // Estimate token usage (approximate)
    const inputTokens = Math.ceil(request.prompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);

    return {
      text,
      model,
      cached: false,
      cost: this.calculateCost(model, inputTokens, outputTokens),
      latency: 0,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      }
    };
  }

  /**
   * Calculate cost
   */
  private calculateCost(model: 'flash' | 'pro', inputTokens: number, outputTokens: number): number {
    const pricing = this.PRICING[model];
    return (inputTokens * pricing.input / 1000) + (outputTokens * pricing.output / 1000);
  }

  /**
   * Check cache
   */
  private checkCache(request: GeminiRequest): GeminiResponse | null {
    const cacheKey = request.cacheKey || this.generateCacheKey(request.prompt);
    const cached = this.cache.get<GeminiResponse>(cacheKey);

    if (cached) {
      console.log('Cache hit for Gemini request');
    }

    return cached || null;
  }

  /**
   * Cache response
   */
  private cacheResponse(request: GeminiRequest, response: GeminiResponse): void {
    const cacheKey = request.cacheKey || this.generateCacheKey(request.prompt);
    this.cache.set(cacheKey, response);
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(prompt: string): string {
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  /**
   * Update cost tracking
   */
  private updateCostTracking(model: 'flash' | 'pro', response: GeminiResponse): void {
    if (!this.config.enableCostTracking) return;

    this.costTracker.totalRequests++;
    if (model === 'flash') {
      this.costTracker.flashRequests++;
    } else {
      this.costTracker.proRequests++;
    }
    this.costTracker.totalCost += response.cost;
  }

  /**
   * Get access token for Vertex AI
   * In production, this would use service account credentials
   */
  private async getAccessToken(): Promise<string> {
    // Placeholder - in production, use Google Auth Library
    // For now, return from config or environment
    return this.config.vertexAccessToken || process.env.VERTEX_ACCESS_TOKEN || '';
  }

  /**
   * Get cost statistics
   */
  getCostStats(): CostTracker {
    return { ...this.costTracker };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

/**
 * Singleton instance
 */
let geminiRouterInstance: GeminiRouterService | null = null;

/**
 * Initialize Gemini Router
 */
export function initializeGeminiRouter(config: GeminiRouterConfig): GeminiRouterService {
  geminiRouterInstance = new GeminiRouterService(config);
  return geminiRouterInstance;
}

/**
 * Get Gemini Router instance
 */
export function getGeminiRouter(): GeminiRouterService {
  if (!geminiRouterInstance) {
    // Initialize with default config
    const config: GeminiRouterConfig = {
      vertexProjectId: process.env.GCP_PROJECT_ID || 'elara-mvp-13082025-u1',
      vertexLocation: process.env.VERTEX_LOCATION || 'us-central1',
      vertexAccessToken: process.env.VERTEX_ACCESS_TOKEN,
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      cacheTTL: 3600, // 1 hour
      enableCaching: true,
      enableCostTracking: true
    };

    geminiRouterInstance = new GeminiRouterService(config);
  }

  return geminiRouterInstance;
}

/**
 * Helper: Summarize scan result
 */
export async function summarizeScanResult(scanResult: any): Promise<string> {
  const router = getGeminiRouter();

  const prompt = `Summarize this URL scan result in 2-3 sentences for a non-technical user:

Risk Level: ${scanResult.riskLevel}
Risk Score: ${scanResult.riskScore}/100
Verdict: ${scanResult.verdict}
Domain Age: ${scanResult.evidenceSummary?.domainAge || 'unknown'} days
TLS Valid: ${scanResult.evidenceSummary?.tlsValid ? 'Yes' : 'No'}

Key Findings:
${scanResult.recommendedActions?.slice(0, 3).join('\n') || 'None'}

Provide a clear, concise explanation.`;

  const response = await router.generate({
    prompt,
    complexity: TaskComplexity.SIMPLE,
    maxTokens: 200,
    temperature: 0.3 // Low temperature for consistent summaries
  });

  return response.text;
}

/**
 * Helper: Generate detailed explanation
 */
export async function explainScanDetails(scanResult: any): Promise<string> {
  const router = getGeminiRouter();

  const prompt = `Provide a detailed explanation of this URL scan result for a technical user:

URL: ${scanResult.url}
Risk Level: ${scanResult.riskLevel}
Probability: ${scanResult.probability}
Confidence Interval: [${scanResult.confidenceInterval?.lower}, ${scanResult.confidenceInterval?.upper}]

Evidence:
- Reachability: ${scanResult.reachability}
- Domain Age: ${scanResult.evidenceSummary?.domainAge || 'unknown'} days
- TLS Valid: ${scanResult.evidenceSummary?.tlsValid ? 'Yes' : 'No'}
- TI Hits: ${scanResult.evidenceSummary?.tiHits || 0}
- Has Login Form: ${scanResult.evidenceSummary?.hasLoginForm ? 'Yes' : 'No'}

Decision Graph:
${JSON.stringify(scanResult.decisionGraph, null, 2)}

Explain:
1. How the risk score was calculated
2. What evidence contributed most to the decision
3. Why this risk level was assigned
4. What the user should do

Be technical and thorough.`;

  const response = await router.generate({
    prompt,
    complexity: TaskComplexity.COMPLEX,
    maxTokens: 1000,
    temperature: 0.5,
    contextLength: prompt.length
  });

  return response.text;
}
