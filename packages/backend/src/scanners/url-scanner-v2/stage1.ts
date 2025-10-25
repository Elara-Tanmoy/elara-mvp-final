/**
 * Stage-1 Models for URL Scanner V2
 *
 * Implements lightweight models for fast initial assessment:
 * - urlLexicalA: XGBoost model on char n-grams
 * - urlLexicalB: URLBERT/PhishBERT transformer
 * - tabularRisk: Monotonic XGBoost on tabular features
 *
 * Target latency: <100ms combined
 * Early exit: If combined confidence > threshold, skip Stage-2
 */

import axios from 'axios';
import type {
  ExtractedFeatures,
  Stage1Predictions,
  VertexAIEndpoints
} from './types';

/**
 * Stage-1 Model Runner
 */
export class Stage1ModelRunner {
  private endpoints: VertexAIEndpoints;
  private confidenceThreshold: number;
  private timeout: number;

  constructor(
    endpoints: VertexAIEndpoints,
    confidenceThreshold: number = 0.85,
    timeoutMs: number = 5000
  ) {
    this.endpoints = endpoints;
    this.confidenceThreshold = confidenceThreshold;
    this.timeout = timeoutMs;
  }

  /**
   * Run all Stage-1 models
   */
  async predict(features: ExtractedFeatures): Promise<Stage1Predictions> {
    const startTime = Date.now();

    try {
      // Run models in parallel for speed
      const [lexicalA, lexicalB, tabular] = await Promise.all([
        this.predictURLLexicalA(features.lexical.charNgrams),
        this.predictURLLexicalB(features.lexical.urlTokens),
        this.predictTabularRisk(features.tabular)
      ]);

      // Combine predictions using weighted average
      const combinedProb = this.combinePredictions(
        lexicalA.probability,
        lexicalB.probability,
        tabular.probability
      );

      const combinedConf = Math.min(
        lexicalA.confidence,
        lexicalB.confidence,
        tabular.confidence
      );

      // Determine if we should early exit
      const shouldExit = combinedConf >= this.confidenceThreshold;

      const latency = Date.now() - startTime;

      return {
        urlLexicalA: lexicalA,
        urlLexicalB: lexicalB,
        tabularRisk: tabular,
        combined: {
          probability: combinedProb,
          confidence: combinedConf
        },
        shouldExit,
        latency
      };

    } catch (error) {
      console.error('Stage-1 prediction error:', error);

      // Return conservative prediction on error
      return this.getDefaultPrediction();
    }
  }

  /**
   * URL Lexical Model A (XGBoost on char n-grams)
   */
  private async predictURLLexicalA(charNgrams: number[]): Promise<{
    probability: number;
    confidence: number;
  }> {
    try {
      // Local XGBoost inference (fast, <20ms)
      const probability = await this.runLocalXGBoost(charNgrams);

      // Confidence from probability distance from 0.5
      const confidence = Math.abs(probability - 0.5) * 2;

      return { probability, confidence };

    } catch (error) {
      console.error('URL Lexical A error:', error);
      return { probability: 0.5, confidence: 0.0 };
    }
  }

  /**
   * URL Lexical Model B (URLBERT/PhishBERT)
   */
  private async predictURLLexicalB(urlTokens: string[]): Promise<{
    probability: number;
    confidence: number;
  }> {
    try {
      // Check if Vertex AI endpoint is configured
      if (!this.endpoints.urlLexicalB || this.endpoints.urlLexicalB === 'placeholder') {
        // Fallback to local heuristic
        return this.localURLBERTFallback(urlTokens);
      }

      // Call Vertex AI endpoint
      const response = await axios.post(
        this.endpoints.urlLexicalB,
        {
          instances: [{
            tokens: urlTokens.slice(0, 128) // BERT max length
          }]
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const prediction = response.data.predictions[0];
      const probability = prediction.probability || prediction[0]; // Handle different formats
      const confidence = Math.abs(probability - 0.5) * 2;

      return { probability, confidence };

    } catch (error) {
      console.error('URL Lexical B error:', error);
      return this.localURLBERTFallback(urlTokens);
    }
  }

  /**
   * Tabular Risk Model (Monotonic XGBoost)
   */
  private async predictTabularRisk(tabular: ExtractedFeatures['tabular']): Promise<{
    probability: number;
    confidence: number;
    featureImportance: Record<string, number>;
  }> {
    try {
      // Check if Vertex AI endpoint is configured
      if (!this.endpoints.tabularRisk || this.endpoints.tabularRisk === 'placeholder') {
        // Fallback to rule-based scoring
        return this.localTabularFallback(tabular);
      }

      // Call Vertex AI endpoint
      const response = await axios.post(
        this.endpoints.tabularRisk,
        {
          instances: [{
            domain_age: tabular.domainAge,
            tld_risk: tabular.tldRiskScore,
            asn_reputation: tabular.asnReputation,
            ti_hits: tabular.tiHitCount,
            ti_tier1: tabular.tiTier1Hits,
            tls_score: tabular.tlsScore,
            dns_health: tabular.dnsHealthScore,
            cert_age: tabular.certificateAge,
            redirect_count: tabular.redirectCount,
            external_domains: tabular.externalDomainCount
          }]
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const prediction = response.data.predictions[0];
      const probability = prediction.probability || prediction[0];
      const confidence = Math.abs(probability - 0.5) * 2;
      const featureImportance = prediction.feature_importance || {};

      return { probability, confidence, featureImportance };

    } catch (error) {
      console.error('Tabular Risk error:', error);
      return this.localTabularFallback(tabular);
    }
  }

  /**
   * Local XGBoost inference (simplified placeholder)
   * TODO: Implement with actual XGBoost.js or ONNX Runtime
   */
  private async runLocalXGBoost(features: number[]): Promise<number> {
    // Placeholder: Simple heuristic until actual model is loaded
    // In production, this would load the XGBoost model and run inference

    // For now, use a simple statistical approach
    const mean = features.reduce((a, b) => a + b, 0) / features.length;
    const variance = features.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / features.length;

    // Normalize to [0, 1]
    const normalized = Math.min(1, Math.max(0, variance / 100));

    return normalized;
  }

  /**
   * Local URLBERT fallback (heuristic-based)
   */
  private localURLBERTFallback(tokens: string[]): {
    probability: number;
    confidence: number;
  } {
    // Count suspicious tokens
    const suspiciousTokens = [
      'login', 'verify', 'account', 'update', 'secure',
      'paypal', 'bank', 'password', 'confirm'
    ];

    const suspiciousCount = tokens.filter(token =>
      suspiciousTokens.some(sus => token.includes(sus))
    ).length;

    // Simple probability based on suspicious token ratio
    const probability = Math.min(0.9, suspiciousCount / tokens.length * 5);
    const confidence = 0.3; // Low confidence for fallback

    return { probability, confidence };
  }

  /**
   * Local tabular fallback (rule-based)
   */
  private localTabularFallback(tabular: ExtractedFeatures['tabular']): {
    probability: number;
    confidence: number;
    featureImportance: Record<string, number>;
  } {
    let riskScore = 0;
    const weights: Record<string, number> = {};

    // Domain age (younger = riskier)
    if (tabular.domainAge < 7) {
      riskScore += 40;
      weights.domainAge = 40;
    } else if (tabular.domainAge < 30) {
      riskScore += 25;
      weights.domainAge = 25;
    } else if (tabular.domainAge < 90) {
      riskScore += 10;
      weights.domainAge = 10;
    }

    // TLD risk
    riskScore += tabular.tldRiskScore * 0.15;
    weights.tldRisk = tabular.tldRiskScore * 0.15;

    // TI hits
    riskScore += tabular.tiHitCount * 10;
    weights.tiHits = tabular.tiHitCount * 10;

    // Tier-1 TI hits (critical)
    if (tabular.tiTier1Hits >= 2) {
      riskScore += 50;
      weights.tiTier1 = 50;
    }

    // TLS issues
    if (tabular.tlsScore < 50) {
      riskScore += 20;
      weights.tlsScore = 20;
    }

    // DNS issues
    if (tabular.dnsHealthScore < 50) {
      riskScore += 15;
      weights.dnsHealth = 15;
    }

    // External domains (too many is suspicious)
    if (tabular.externalDomainCount > 20) {
      riskScore += 10;
      weights.externalDomains = 10;
    }

    // Redirects (multiple redirects are suspicious)
    if (tabular.redirectCount > 2) {
      riskScore += 10;
      weights.redirects = 10;
    }

    // Normalize to [0, 1]
    const probability = Math.min(1, riskScore / 100);
    const confidence = 0.5; // Medium confidence for heuristic

    return {
      probability,
      confidence,
      featureImportance: weights
    };
  }

  /**
   * Combine predictions from multiple models
   */
  private combinePredictions(
    lexicalA: number,
    lexicalB: number,
    tabular: number
  ): number {
    // Weighted average (can be tuned)
    const weights = {
      lexicalA: 0.25,
      lexicalB: 0.35,
      tabular: 0.40  // Tabular gets highest weight
    };

    return (
      lexicalA * weights.lexicalA +
      lexicalB * weights.lexicalB +
      tabular * weights.tabular
    );
  }

  /**
   * Get default prediction on error
   */
  private getDefaultPrediction(): Stage1Predictions {
    return {
      urlLexicalA: { probability: 0.5, confidence: 0.0 },
      urlLexicalB: { probability: 0.5, confidence: 0.0 },
      tabularRisk: {
        probability: 0.5,
        confidence: 0.0,
        featureImportance: {}
      },
      combined: { probability: 0.5, confidence: 0.0 },
      shouldExit: false,
      latency: 0
    };
  }
}

/**
 * Factory function
 */
export function createStage1Runner(
  endpoints: VertexAIEndpoints,
  confidenceThreshold?: number,
  timeoutMs?: number
): Stage1ModelRunner {
  return new Stage1ModelRunner(endpoints, confidenceThreshold, timeoutMs);
}

/**
 * Utility: Check if Vertex AI endpoints are configured
 */
export function hasVertexAIConfigured(endpoints: VertexAIEndpoints): boolean {
  return !!(
    endpoints.urlLexicalB &&
    endpoints.tabularRisk &&
    endpoints.urlLexicalB !== 'placeholder' &&
    endpoints.tabularRisk !== 'placeholder'
  );
}
