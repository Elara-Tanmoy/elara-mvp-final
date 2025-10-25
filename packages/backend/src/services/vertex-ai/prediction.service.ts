/**
 * Vertex AI Prediction Service
 *
 * Handles predictions from deployed Vertex AI models:
 * - Stage-1 models (URL Lexical B, Tabular Risk)
 * - Stage-2 models (Text Persuasion, Screenshot CNN)
 * - Batch predictions for training
 * - Model health monitoring
 */

import { logger } from '../../config/logger.js';
import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos.js';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';

export interface PredictionRequest {
  modelEndpoint: string;
  instances: any[];
  parameters?: Record<string, any>;
}

export interface PredictionResponse {
  predictions: number[];
  deployedModelId?: string;
  modelVersion?: string;
  latency: number;
}

export interface ModelEndpoints {
  urlLexicalB: string;
  tabularRisk: string;
  textPersuasion: string;
  screenshotCnn: string;
}

class VertexAIPredictionService {
  private client: PredictionServiceClient;
  private endpoints: ModelEndpoints;

  constructor() {
    this.client = new PredictionServiceClient({
      apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`
    });

    // Load endpoint IDs from environment
    this.endpoints = {
      urlLexicalB: process.env.VERTEX_ENDPOINT_URL_LEXICAL_B || '',
      tabularRisk: process.env.VERTEX_ENDPOINT_TABULAR_RISK || '',
      textPersuasion: process.env.VERTEX_ENDPOINT_TEXT_PERSUASION || '',
      screenshotCnn: process.env.VERTEX_ENDPOINT_SCREENSHOT_CNN || ''
    };
  }

  /**
   * Predict using URL Lexical B model (PhishBERT)
   */
  async predictURLLexicalB(urlTokens: number[]): Promise<number> {
    try {
      const startTime = Date.now();

      if (!this.endpoints.urlLexicalB) {
        logger.warn('[Vertex AI] URL Lexical B endpoint not configured, using fallback');
        return this.fallbackURLLexical(urlTokens);
      }

      const endpoint = this.getEndpointPath(this.endpoints.urlLexicalB);

      const [response] = await this.client.predict({
        endpoint,
        instances: [{ input_ids: urlTokens }]
      });

      const latency = Date.now() - startTime;

      const prediction = response.predictions?.[0];
      const probability = typeof prediction === 'number' ? prediction : (prediction as any)?.probability || 0.5;

      logger.debug(`[Vertex AI] URL Lexical B prediction: ${probability} (${latency}ms)`);

      return probability;
    } catch (error) {
      logger.error('[Vertex AI] Error in URL Lexical B prediction:', error);
      return this.fallbackURLLexical(urlTokens);
    }
  }

  /**
   * Predict using Tabular Risk model
   */
  async predictTabularRisk(features: Record<string, number>): Promise<number> {
    try {
      const startTime = Date.now();

      if (!this.endpoints.tabularRisk) {
        logger.warn('[Vertex AI] Tabular Risk endpoint not configured, using fallback');
        return this.fallbackTabularRisk(features);
      }

      const endpoint = this.getEndpointPath(this.endpoints.tabularRisk);

      // Convert features to array in expected order
      const featureArray = [
        features.domainAge || 0,
        features.tldRisk || 0,
        features.tiHitCount || 0,
        features.tier1Hits || 0,
        features.tlsScore || 0,
        features.dnsHealthScore || 0,
        features.certAge || 0,
        features.redirectCount || 0,
        features.externalDomainCount || 0,
        features.formCount || 0
      ];

      const [response] = await this.client.predict({
        endpoint,
        instances: [{ features: featureArray }]
      });

      const latency = Date.now() - startTime;

      const prediction = response.predictions?.[0];
      const probability = typeof prediction === 'number' ? prediction : (prediction as any)?.probability || 0.5;

      logger.debug(`[Vertex AI] Tabular Risk prediction: ${probability} (${latency}ms)`);

      return probability;
    } catch (error) {
      logger.error('[Vertex AI] Error in Tabular Risk prediction:', error);
      return this.fallbackTabularRisk(features);
    }
  }

  /**
   * Predict using Text Persuasion model (Gemma/Mixtral)
   */
  async predictTextPersuasion(text: string): Promise<number> {
    try {
      const startTime = Date.now();

      if (!this.endpoints.textPersuasion) {
        logger.warn('[Vertex AI] Text Persuasion endpoint not configured, using fallback');
        return this.fallbackTextPersuasion(text);
      }

      const endpoint = this.getEndpointPath(this.endpoints.textPersuasion);

      const [response] = await this.client.predict({
        endpoint,
        instances: [{ text }]
      });

      const latency = Date.now() - startTime;

      const prediction = response.predictions?.[0];
      const probability = typeof prediction === 'number' ? prediction : (prediction as any)?.probability || 0.5;

      logger.debug(`[Vertex AI] Text Persuasion prediction: ${probability} (${latency}ms)`);

      return probability;
    } catch (error) {
      logger.error('[Vertex AI] Error in Text Persuasion prediction:', error);
      return this.fallbackTextPersuasion(text);
    }
  }

  /**
   * Predict using Screenshot CNN model
   */
  async predictScreenshotCNN(imageBase64: string): Promise<number> {
    try {
      const startTime = Date.now();

      if (!this.endpoints.screenshotCnn) {
        logger.warn('[Vertex AI] Screenshot CNN endpoint not configured, using fallback');
        return 0.5; // Neutral fallback
      }

      const endpoint = this.getEndpointPath(this.endpoints.screenshotCnn);

      const [response] = await this.client.predict({
        endpoint,
        instances: [{ image: imageBase64 }]
      });

      const latency = Date.now() - startTime;

      const prediction = response.predictions?.[0];
      const probability = typeof prediction === 'number' ? prediction : (prediction as any)?.probability || 0.5;

      logger.debug(`[Vertex AI] Screenshot CNN prediction: ${probability} (${latency}ms)`);

      return probability;
    } catch (error) {
      logger.error('[Vertex AI] Error in Screenshot CNN prediction:', error);
      return 0.5;
    }
  }

  /**
   * Generic predict method
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      const endpoint = this.getEndpointPath(request.modelEndpoint);

      const [response] = await this.client.predict({
        endpoint,
        instances: request.instances,
        parameters: request.parameters as any
      });

      const predictions = response.predictions?.map((p: any) =>
        typeof p === 'number' ? p : p?.probability || 0.5
      ) || [];

      const latency = Date.now() - startTime;

      return {
        predictions,
        deployedModelId: response.deployedModelId,
        modelVersion: response.modelVersionId,
        latency
      };
    } catch (error) {
      logger.error('[Vertex AI] Prediction error:', error);
      throw error;
    }
  }

  /**
   * Batch predictions (for training evaluation)
   */
  async batchPredict(
    modelEndpoint: string,
    instances: any[],
    batchSize: number = 100
  ): Promise<number[]> {
    const predictions: number[] = [];

    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize);

      const response = await this.predict({
        modelEndpoint,
        instances: batch
      });

      predictions.push(...response.predictions);

      logger.debug(`[Vertex AI] Batch predict: ${i + batch.length}/${instances.length}`);
    }

    return predictions;
  }

  /**
   * Check model health
   */
  async checkHealth(endpointId: string): Promise<{
    isHealthy: boolean;
    latency: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      const endpoint = this.getEndpointPath(endpointId);

      // Send test prediction
      await this.client.predict({
        endpoint,
        instances: [{ test: true }]
      });

      const latency = Date.now() - startTime;

      return {
        isHealthy: true,
        latency
      };
    } catch (error: any) {
      return {
        isHealthy: false,
        latency: -1,
        error: error.message
      };
    }
  }

  /**
   * Get full endpoint path
   */
  private getEndpointPath(endpointId: string): string {
    return `projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${endpointId}`;
  }

  /**
   * Fallback for URL Lexical B (simple heuristic)
   */
  private fallbackURLLexical(urlTokens: number[]): number {
    // Simple heuristic based on URL length and character distribution
    const avgToken = urlTokens.reduce((a, b) => a + b, 0) / (urlTokens.length || 1);

    if (avgToken < 10) return 0.3; // Short URLs often benign
    if (avgToken > 50) return 0.7; // Very long URLs suspicious

    return 0.5; // Neutral
  }

  /**
   * Fallback for Tabular Risk (weighted heuristic)
   */
  private fallbackTabularRisk(features: Record<string, number>): number {
    let score = 0.5;

    // Domain age (younger = riskier)
    if (features.domainAge !== undefined) {
      if (features.domainAge < 30) score += 0.2;
      else if (features.domainAge > 365) score -= 0.1;
    }

    // TI hits
    if (features.tiHitCount && features.tiHitCount > 0) {
      score += Math.min(features.tiHitCount * 0.1, 0.3);
    }

    // Tier-1 hits
    if (features.tier1Hits && features.tier1Hits > 0) {
      score += 0.2;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Fallback for Text Persuasion (keyword-based)
   */
  private fallbackTextPersuasion(text: string): number {
    const lowerText = text.toLowerCase();

    const suspiciousKeywords = [
      'urgent', 'act now', 'verify your account', 'suspended', 'locked',
      'click here', 'confirm your identity', 'unusual activity',
      'limited time', 'expire', 'update payment'
    ];

    let matches = 0;
    for (const keyword of suspiciousKeywords) {
      if (lowerText.includes(keyword)) {
        matches++;
      }
    }

    // More matches = higher probability
    return Math.min(matches * 0.15, 0.9);
  }

  /**
   * Update endpoints configuration
   */
  updateEndpoints(endpoints: Partial<ModelEndpoints>): void {
    this.endpoints = { ...this.endpoints, ...endpoints };
    logger.info('[Vertex AI] Updated endpoints:', this.endpoints);
  }

  /**
   * Get current endpoints
   */
  getEndpoints(): ModelEndpoints {
    return { ...this.endpoints };
  }
}

export const vertexAIPredictionService = new VertexAIPredictionService();
export default vertexAIPredictionService;
