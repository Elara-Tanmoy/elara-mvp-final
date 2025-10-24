/**
 * AI Consensus Orchestrator
 *
 * Coordinates 3 LLM models for risk assessment consensus:
 * - Claude Sonnet 4.5 (35% weight)
 * - GPT-4 (35% weight)
 * - Gemini 1.5 Flash (30% weight)
 *
 * Output: AI multiplier (0.7-1.3×) applied to base score
 */

import {
  AIConsensusInput,
  AIConsensusResult,
  AIConsensusConfig,
  AIModelResponse
} from './types.js';
import { logger } from '../../../config/logger.js';
import { ClaudeAnalyzer } from './claudeAnalyzer.js';
import { GPTAnalyzer } from './gptAnalyzer.js';
import { GeminiAnalyzer } from './geminiAnalyzer.js';

export class AIOrchestrator {
  private claudeAnalyzer: ClaudeAnalyzer;
  private gptAnalyzer: GPTAnalyzer;
  private geminiAnalyzer: GeminiAnalyzer;
  private config: AIConsensusConfig;

  constructor(config?: Partial<AIConsensusConfig>) {
    // Default configuration
    this.config = {
      models: {
        claude: {
          enabled: true,
          model: 'claude-sonnet-4-20250514',
          weight: 0.35,
          timeout: 10000
        },
        gpt4: {
          enabled: true,
          model: 'gpt-4',
          weight: 0.35,
          timeout: 10000
        },
        gemini: {
          enabled: true,
          model: 'gemini-1.5-flash',
          weight: 0.30,
          timeout: 10000
        }
      },
      multiplierRange: {
        min: 0.7,
        max: 1.3
      },
      fallbackMultiplier: 1.0,
      ...config
    };

    // Initialize analyzers
    this.claudeAnalyzer = new ClaudeAnalyzer(this.config.models.claude);
    this.gptAnalyzer = new GPTAnalyzer(this.config.models.gpt4);
    this.geminiAnalyzer = new GeminiAnalyzer(this.config.models.gemini);

    logger.info('[AI Orchestrator] Initialized with models:', {
      claude: this.config.models.claude.enabled ? '35%' : 'disabled',
      gpt4: this.config.models.gpt4.enabled ? '35%' : 'disabled',
      gemini: this.config.models.gemini.enabled ? '30%' : 'disabled'
    });
  }

  /**
   * Execute AI consensus analysis
   */
  async execute(input: AIConsensusInput): Promise<AIConsensusResult> {
    const startTime = Date.now();

    logger.info(`[AI Orchestrator] Starting consensus for: ${input.url}`);
    logger.debug(`[AI Orchestrator] Base score: ${input.baseScore}/${input.activeMaxScore} (${input.riskLevel})`);

    // Execute all enabled models in parallel
    const modelPromises: Promise<AIModelResponse>[] = [];

    if (this.config.models.claude.enabled) {
      modelPromises.push(this.executeModel('claude', () => this.claudeAnalyzer.analyze(input)));
    }

    if (this.config.models.gpt4.enabled) {
      modelPromises.push(this.executeModel('gpt4', () => this.gptAnalyzer.analyze(input)));
    }

    if (this.config.models.gemini.enabled) {
      modelPromises.push(this.executeModel('gemini', () => this.geminiAnalyzer.analyze(input)));
    }

    // Wait for all models
    const results = await Promise.all(modelPromises);

    // Calculate consensus
    const consensus = this.calculateConsensus(results);

    const totalDuration = Date.now() - startTime;

    logger.info(`[AI Orchestrator] Consensus complete: ${consensus.finalMultiplier.toFixed(2)}× (${totalDuration}ms)`);
    logger.info(`[AI Orchestrator] Agreement: ${consensus.agreementRate.toFixed(1)}%, Confidence: ${consensus.averageConfidence.toFixed(1)}%`);

    return {
      ...consensus,
      models: results,
      totalDuration
    };
  }

  /**
   * Execute a single model with error handling
   */
  private async executeModel(
    modelName: string,
    analyzeFn: () => Promise<AIModelResponse>
  ): Promise<AIModelResponse> {
    const startTime = Date.now();

    try {
      const result = await analyzeFn();
      logger.info(`[AI Orchestrator] ${modelName}: ${result.suggestedMultiplier.toFixed(2)}× (confidence: ${result.confidence}%, ${result.duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[AI Orchestrator] ${modelName} failed:`, error);

      // Return error response with fallback multiplier
      return {
        modelName,
        modelVersion: 'error',
        riskAssessment: 50,
        suggestedMultiplier: this.config.fallbackMultiplier,
        confidence: 0,
        reasoning: 'Model execution failed',
        keyFactors: [],
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate weighted consensus from model responses
   */
  private calculateConsensus(results: AIModelResponse[]): Omit<AIConsensusResult, 'models' | 'totalDuration'> {
    // Filter out failed models
    const successfulResults = results.filter(r => !r.error);
    const failedCount = results.length - successfulResults.length;

    if (successfulResults.length === 0) {
      logger.warn('[AI Orchestrator] All models failed, using fallback multiplier');
      return {
        finalMultiplier: this.config.fallbackMultiplier,
        agreementRate: 0,
        averageConfidence: 0,
        consensusVerdict: 'pending',
        metadata: {
          modelsExecuted: results.length,
          modelsFailed: failedCount,
          weightsUsed: {}
        }
      };
    }

    // Recalculate weights for successful models only
    const weights = this.recalculateWeights(successfulResults);

    // Calculate weighted multiplier
    let finalMultiplier = 0;
    for (const result of successfulResults) {
      const weight = weights[result.modelName];
      finalMultiplier += result.suggestedMultiplier * weight;
    }

    // Clamp to valid range
    finalMultiplier = Math.max(
      this.config.multiplierRange.min,
      Math.min(this.config.multiplierRange.max, finalMultiplier)
    );

    // Calculate agreement rate (% of models within 0.1 of final)
    const agreementThreshold = 0.1;
    const agreeingModels = successfulResults.filter(
      r => Math.abs(r.suggestedMultiplier - finalMultiplier) <= agreementThreshold
    ).length;
    const agreementRate = (agreeingModels / successfulResults.length) * 100;

    // Calculate average confidence
    const averageConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;

    // Determine consensus verdict based on final multiplier
    const consensusVerdict = this.getConsensusVerdict(finalMultiplier);

    return {
      finalMultiplier,
      agreementRate,
      averageConfidence,
      consensusVerdict,
      metadata: {
        modelsExecuted: results.length,
        modelsFailed: failedCount,
        weightsUsed: weights
      }
    };
  }

  /**
   * Recalculate weights when some models fail
   */
  private recalculateWeights(successfulResults: AIModelResponse[]): Record<string, number> {
    const weights: Record<string, number> = {};
    let totalWeight = 0;

    for (const result of successfulResults) {
      const modelName = result.modelName;
      const originalWeight = this.getOriginalWeight(modelName);
      weights[modelName] = originalWeight;
      totalWeight += originalWeight;
    }

    // Normalize weights to sum to 1.0
    for (const modelName in weights) {
      weights[modelName] /= totalWeight;
    }

    return weights;
  }

  /**
   * Get original configured weight for a model
   */
  private getOriginalWeight(modelName: string): number {
    switch (modelName) {
      case 'claude':
        return this.config.models.claude.weight;
      case 'gpt4':
        return this.config.models.gpt4.weight;
      case 'gemini':
        return this.config.models.gemini.weight;
      default:
        return 0;
    }
  }

  /**
   * Determine consensus verdict from multiplier
   */
  private getConsensusVerdict(multiplier: number): string {
    if (multiplier >= 1.2) return 'critical';  // Increase risk significantly
    if (multiplier >= 1.1) return 'high';      // Increase risk moderately
    if (multiplier >= 0.9) return 'medium';    // Neutral
    if (multiplier >= 0.8) return 'low';       // Decrease risk moderately
    return 'safe';                              // Decrease risk significantly
  }
}
