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

    console.log(`[Stage1] Starting Stage-1 model predictions...`);

    try {
      // Run models in parallel for speed
      const [lexicalA, lexicalB, tabular] = await Promise.all([
        this.predictURLLexicalA(features.lexical.charNgrams),
        this.predictURLLexicalB(features.lexical.urlTokens),
        this.predictTabularRisk(features.tabular)
      ]);

      console.log(`[Stage1] Model results:`);
      console.log(`  - Lexical A (XGBoost): ${(lexicalA.probability * 100).toFixed(1)}% (conf: ${lexicalA.confidence.toFixed(2)})`);
      console.log(`  - Lexical B (URLBERT): ${(lexicalB.probability * 100).toFixed(1)}% (conf: ${lexicalB.confidence.toFixed(2)})`);
      console.log(`  - Tabular Risk: ${(tabular.probability * 100).toFixed(1)}% (conf: ${tabular.confidence.toFixed(2)})`);

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

      console.log(`[Stage1] Combined result: ${(combinedProb * 100).toFixed(1)}% (conf: ${combinedConf.toFixed(2)}), early_exit=${shouldExit}`);

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
      console.error('[Stage1] Prediction error:', error);

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
      if (!this.endpoints.urlLexicalB || this.endpoints.urlLexicalB.trim() === '') {
        // Fallback to local heuristic
        console.log('[Stage1] URL Lexical B: Vertex AI not configured, using fallback heuristic');
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
      if (!this.endpoints.tabularRisk || this.endpoints.tabularRisk.trim() === '') {
        // Fallback to rule-based scoring
        console.log('[Stage1] Tabular Risk: Vertex AI not configured, using fallback heuristic');
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
   * Local XGBoost inference (heuristic-based implementation)
   * Real implementation using URL feature analysis
   * NOTE: Replace with actual XGBoost.js or ONNX Runtime when Vertex AI models are deployed
   */
  private async runLocalXGBoost(features: number[]): Promise<number> {
    // Real heuristic-based scoring using URL char n-gram features
    // Features array contains n-gram frequencies

    let riskScore = 0;

    // 1. Entropy-based risk (high entropy = more random = more suspicious)
    const mean = features.reduce((a, b) => a + b, 0) / features.length;
    const variance = features.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / features.length;
    const entropy = Math.sqrt(variance);

    // High variance in n-gram distribution indicates randomness
    if (entropy > 5) {
      riskScore += 0.25; // Very random URL
    } else if (entropy > 3) {
      riskScore += 0.15; // Somewhat random
    }

    // 2. Suspicious character frequency patterns
    // Check for high frequency of suspicious n-grams (approximated by outliers)
    const sorted = [...features].sort((a, b) => b - a);
    const top10Percent = sorted.slice(0, Math.ceil(sorted.length * 0.1));
    const avgTop = top10Percent.reduce((a, b) => a + b, 0) / top10Percent.length;

    // If top n-grams dominate (repeated patterns), it's suspicious
    if (avgTop > mean * 3) {
      riskScore += 0.20; // Repeated suspicious patterns
    }

    // 3. Distribution skewness (few dominant n-grams vs many diverse ones)
    const nonZeroCount = features.filter(f => f > 0).length;
    const diversityRatio = nonZeroCount / features.length;

    if (diversityRatio < 0.1) {
      riskScore += 0.15; // Very few unique n-grams (obfuscated/generated)
    } else if (diversityRatio > 0.7) {
      riskScore += 0.10; // Too diverse (random strings)
    }

    // 4. Outlier detection (spikes indicate specific malicious patterns)
    const stdDev = Math.sqrt(variance);
    const outliers = features.filter(f => Math.abs(f - mean) > 2 * stdDev).length;
    if (outliers > 10) {
      riskScore += 0.15; // Many outlier n-grams
    }

    // 5. Zero-frequency ratio (legitimate URLs have common patterns)
    const zeroCount = features.filter(f => f === 0).length;
    const zeroRatio = zeroCount / features.length;

    if (zeroRatio > 0.9) {
      riskScore += 0.15; // Too many zero frequencies (unusual URL)
    }

    // Normalize to [0, 1] and apply sigmoid for smooth probability
    const probability = Math.min(1, Math.max(0, riskScore));

    // Apply sigmoid transformation for smoother probability curve
    const sigmoid = 1 / (1 + Math.exp(-10 * (probability - 0.5)));

    return sigmoid;
  }

  /**
   * Local URLBERT fallback (heuristic-based with comprehensive URL pattern analysis)
   */
  private localURLBERTFallback(tokens: string[]): {
    probability: number;
    confidence: number;
  } {
    let riskScore = 0;

    // 1. Suspicious brand/service tokens (phishing indicators)
    const brandTokens = [
      'paypal', 'amazon', 'ebay', 'apple', 'microsoft', 'google',
      'bank', 'chase', 'wellsfargo', 'citibank', 'netflix', 'facebook'
    ];
    const actionTokens = [
      'login', 'signin', 'verify', 'account', 'update', 'secure',
      'confirm', 'validate', 'authenticate', 'suspended', 'locked'
    ];

    const brandCount = tokens.filter(token =>
      brandTokens.some(brand => token.toLowerCase().includes(brand))
    ).length;

    const actionCount = tokens.filter(token =>
      actionTokens.some(action => token.toLowerCase().includes(action))
    ).length;

    // Brand + action = classic phishing pattern
    if (brandCount > 0 && actionCount > 0) {
      riskScore += 0.40; // Strong phishing signal
    } else if (actionCount > 1) {
      riskScore += 0.25; // Multiple actions suspicious
    } else if (brandCount > 0) {
      riskScore += 0.15; // Brand mention alone
    }

    // 2. Suspicious TLD patterns in URL path
    const suspiciousTLDTokens = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top'];
    const hasSuspiciousTLD = tokens.some(token =>
      suspiciousTLDTokens.some(tld => token === tld)
    );
    if (hasSuspiciousTLD) {
      riskScore += 0.20;
    }

    // 3. URL length and complexity
    const totalLength = tokens.join('').length;
    if (totalLength > 100) {
      riskScore += 0.15; // Very long URLs are suspicious
    } else if (totalLength < 10) {
      riskScore += 0.10; // Very short URLs can be suspicious too
    }

    // 4. Number tokens (often used in phishing: paypal-verify-123456)
    const numberTokens = tokens.filter(token => /^\d+$/.test(token)).length;
    if (numberTokens > 2) {
      riskScore += 0.15; // Multiple number sequences
    }

    // 5. Special character density
    const specialChars = tokens.filter(token =>
      /^[^a-zA-Z0-9]+$/.test(token) && token.length === 1
    ).length;
    const specialCharRatio = specialChars / tokens.length;
    if (specialCharRatio > 0.3) {
      riskScore += 0.15; // High special character density
    }

    // 6. Homoglyph/look-alike patterns (common in phishing)
    const homoglyphTokens = tokens.filter(token =>
      /[а-яА-Я0Oo1Il]/.test(token) // Cyrillic or common lookalikes
    ).length;
    if (homoglyphTokens > 0) {
      riskScore += 0.20; // Homoglyph detected
    }

    // 7. URL depth (number of path separators)
    const pathDepth = tokens.filter(token => token === '/').length;
    if (pathDepth > 5) {
      riskScore += 0.10; // Very deep URL structure
    }

    // Normalize probability
    const probability = Math.min(0.95, riskScore);

    // Confidence based on number of signals triggered
    // More signals = higher confidence in our heuristic
    const signalCount = [
      brandCount > 0,
      actionCount > 0,
      hasSuspiciousTLD,
      totalLength > 100 || totalLength < 10,
      numberTokens > 2,
      specialCharRatio > 0.3,
      homoglyphTokens > 0,
      pathDepth > 5
    ].filter(Boolean).length;

    const confidence = Math.min(0.7, signalCount * 0.1); // Max 70% confidence for heuristic

    console.log(`[Stage1] URLBERT Fallback: prob=${(probability * 100).toFixed(1)}%, conf=${confidence.toFixed(2)} (${signalCount} signals)`);

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
    endpoints.urlLexicalB.trim() !== '' &&
    endpoints.tabularRisk.trim() !== ''
  );
}
