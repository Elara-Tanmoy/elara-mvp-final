/**
 * AI MODELS SERVICE
 *
 * Loads AI model configurations from database with decrypted API keys
 * Provides configuration for AI Consensus Orchestrator
 */

import { PrismaClient } from '@prisma/client';
import { apiKeyEncryption } from '../apiKeyEncryption.service.js';
import { logger } from '../../config/logger.js';

const prisma = new PrismaClient();

interface AIModelConfig {
  modelId: string;
  provider: string;
  apiKey?: string;
  weight: number;
  enabled: boolean;
  timeout: number;
}

interface AIModelsConfig {
  claude?: AIModelConfig;
  gpt4?: AIModelConfig;
  gemini?: AIModelConfig;
}

class AIModelsService {
  private cache: AIModelsConfig | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL = 60000; // 1 minute cache

  /**
   * Load all AI models from database with decrypted API keys
   */
  async loadModels(): Promise<AIModelsConfig> {
    try {
      // Check cache first
      if (this.cache && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
        logger.debug('[AI Models Service] Returning cached models');
        return this.cache;
      }

      logger.info('[AI Models Service] Loading AI models from database...');

      const models = await prisma.aIModelDefinition.findMany({
        where: { isActive: true },
        orderBy: { rank: 'asc' }
      });

      if (models.length === 0) {
        logger.warn('[AI Models Service] No AI models found in database, using environment fallback');
        return this.getFallbackConfig();
      }

      const config: AIModelsConfig = {};

      for (const model of models) {
        // Decrypt API key if present
        let decryptedKey: string | undefined;
        if (model.apiKey) {
          try {
            decryptedKey = apiKeyEncryption.decrypt(model.apiKey);
          } catch (error) {
            logger.error(`[AI Models Service] Failed to decrypt API key for ${model.provider}:`, error);
            continue;
          }
        }

        // Map provider to config key
        const configKey = this.getConfigKey(model.provider);
        if (!configKey) {
          logger.warn(`[AI Models Service] Unknown provider: ${model.provider}`);
          continue;
        }

        config[configKey] = {
          modelId: model.modelId,
          provider: model.provider,
          apiKey: decryptedKey,
          weight: model.weight,
          enabled: model.enabled,
          timeout: model.timeout || 10000
        };

        logger.info(`[AI Models Service] Loaded ${model.provider}: ${model.modelId} (weight: ${model.weight}, enabled: ${model.enabled})`);
      }

      // Update cache
      this.cache = config;
      this.cacheTimestamp = Date.now();

      return config;

    } catch (error) {
      logger.error('[AI Models Service] Error loading AI models from database:', error);
      logger.warn('[AI Models Service] Falling back to environment variables');
      return this.getFallbackConfig();
    }
  }

  /**
   * Get config for AI Orchestrator format
   */
  async getOrchestratorConfig() {
    const models = await this.loadModels();

    return {
      models: {
        claude: {
          enabled: models.claude?.enabled ?? true,
          model: models.claude?.modelId || 'claude-sonnet-4-20250514',
          weight: models.claude?.weight ?? 0.35,
          timeout: models.claude?.timeout ?? 10000,
          apiKey: models.claude?.apiKey
        },
        gpt4: {
          enabled: models.gpt4?.enabled ?? true,
          model: models.gpt4?.modelId || 'gpt-4',
          weight: models.gpt4?.weight ?? 0.35,
          timeout: models.gpt4?.timeout ?? 10000,
          apiKey: models.gpt4?.apiKey
        },
        gemini: {
          enabled: models.gemini?.enabled ?? true,
          model: models.gemini?.modelId || 'gemini-1.5-flash',
          weight: models.gemini?.weight ?? 0.30,
          timeout: models.gemini?.timeout ?? 10000,
          apiKey: models.gemini?.apiKey
        }
      },
      multiplierRange: {
        min: 0.7,
        max: 1.3
      },
      fallbackMultiplier: 1.0
    };
  }

  /**
   * Map provider name to config key
   */
  private getConfigKey(provider: string): keyof AIModelsConfig | null {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return 'claude';
      case 'openai':
        return 'gpt4';
      case 'google':
        return 'gemini';
      default:
        return null;
    }
  }

  /**
   * Fallback config using environment variables
   */
  private getFallbackConfig(): AIModelsConfig {
    logger.info('[AI Models Service] Using environment variable fallback');

    return {
      claude: {
        modelId: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        weight: 0.35,
        enabled: !!process.env.ANTHROPIC_API_KEY,
        timeout: 10000
      },
      gpt4: {
        modelId: 'gpt-4',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        weight: 0.35,
        enabled: !!process.env.OPENAI_API_KEY,
        timeout: 10000
      },
      gemini: {
        modelId: 'gemini-1.5-flash',
        provider: 'google',
        apiKey: process.env.GOOGLE_AI_API_KEY,
        weight: 0.30,
        enabled: !!process.env.GOOGLE_AI_API_KEY,
        timeout: 10000
      }
    };
  }

  /**
   * Clear cache to force reload from database
   */
  clearCache() {
    this.cache = null;
    this.cacheTimestamp = 0;
    logger.info('[AI Models Service] Cache cleared');
  }
}

export const aiModelsService = new AIModelsService();
