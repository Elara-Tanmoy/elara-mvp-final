/**
 * AI Consensus Types
 *
 * Type definitions for the AI consensus engine
 */

import { CategoryResult, TISourceResult } from '../types.js';

/**
 * Input data provided to each AI model
 */
export interface AIConsensusInput {
  url: string;
  urlComponents: {
    protocol: string;
    hostname: string;
    domain: string;
    tld: string;
    path: string;
    query: string;
    subdomain?: string;
  };
  reachabilityState: string;
  pipelineUsed: string;
  baseScore: number;
  activeMaxScore: number;
  riskLevel: string;
  riskPercentage: number;

  // Top category findings (max 10)
  topFindings: {
    categoryName: string;
    severity: string;
    checkId: string;
    message: string;
    points: number;
  }[];

  // TI results summary
  tiSummary: {
    maliciousCount: number;
    suspiciousCount: number;
    safeCount: number;
    errorCount: number;
    maliciousSources: string[];
  };

  // Category scores summary
  categorySummary: {
    categoryName: string;
    score: number;
    maxWeight: number;
    percentage: number;
  }[];
}

/**
 * Response from a single AI model
 */
export interface AIModelResponse {
  modelName: string;
  modelVersion: string;
  riskAssessment: number;      // 0-100 (AI's view of risk)
  suggestedMultiplier: number;  // 0.7-1.3
  confidence: number;           // 0-100 (how confident the model is)
  reasoning: string;            // Explanation of the assessment
  keyFactors: string[];         // Top factors influencing decision
  duration: number;             // Time taken in ms
  error?: string;               // Error message if failed
}

/**
 * Weighted consensus result
 */
export interface AIConsensusResult {
  models: AIModelResponse[];
  finalMultiplier: number;      // Weighted average (0.7-1.3)
  agreementRate: number;        // % of models within 0.1 of each other
  averageConfidence: number;    // Mean confidence across models
  consensusVerdict: string;     // 'safe' | 'low' | 'medium' | 'high' | 'critical'
  totalDuration: number;        // Total time for all models
  metadata: {
    modelsExecuted: number;
    modelsFailed: number;
    weightsUsed: Record<string, number>;
  };
}

/**
 * Configuration for AI consensus engine
 */
export interface AIConsensusConfig {
  models: {
    claude: {
      enabled: boolean;
      model: string;
      weight: number;
      timeout: number;
    };
    gpt4: {
      enabled: boolean;
      model: string;
      weight: number;
      timeout: number;
    };
    gemini: {
      enabled: boolean;
      model: string;
      weight: number;
      timeout: number;
    };
  };
  multiplierRange: {
    min: number;  // 0.7
    max: number;  // 1.3
  };
  fallbackMultiplier: number;  // 1.0 if all models fail
}
