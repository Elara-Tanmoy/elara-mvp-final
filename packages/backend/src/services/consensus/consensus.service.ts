/**
 * Consensus Service for V2 Scanning
 *
 * Provides unified consensus and explanation for scan results.
 * Integrates:
 * - V2 scan engine verdicts
 * - Gemini-based explanations
 * - Multi-module analysis (deepfake, profile, fact-check)
 * - Decision graph generation
 * - Recommended actions
 */

import { getGeminiRouter, TaskComplexity } from '../ai/geminiRouter.service';
import type { EnhancedScanResult } from '../../scanners/url-scanner-v2/types';

/**
 * Consensus request
 */
export interface ConsensusRequest {
  scanId: string;
  scanResult: EnhancedScanResult;
  includeModules?: {
    deepfake?: boolean;
    profileAnalysis?: boolean;
    factCheck?: boolean;
  };
  userContext?: {
    location?: string;
    language?: string;
    technicalLevel?: 'basic' | 'intermediate' | 'advanced';
  };
}

/**
 * Consensus response
 */
export interface ConsensusResponse {
  scanId: string;
  url: string;
  timestamp: Date;

  // Core verdict
  verdict: {
    riskLevel: string;
    riskScore: number;
    probability: number;
    confidenceInterval: {
      lower: number;
      upper: number;
      width: number;
    };
  };

  // Human-readable explanation
  summary: string;
  detailedExplanation: string;

  // Evidence highlights
  keyFindings: Array<{
    category: string;
    finding: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    impact: string;
  }>;

  // Decision breakdown
  decisionBreakdown: {
    modelContributions: {
      stage1: number;
      stage2?: number;
      causalSignals: number;
    };
    topFactors: Array<{
      factor: string;
      contribution: number;
      explanation: string;
    }>;
  };

  // Recommended actions
  recommendedActions: {
    immediate: string[];
    preventive: string[];
    educational: string[];
  };

  // Additional module results (if requested)
  modules?: {
    deepfake?: any;
    profileAnalysis?: any;
    factCheck?: any;
  };

  // Metadata
  metadata: {
    scanVersion: string;
    processingTime: number;
    geminiModel: 'flash' | 'pro';
    cached: boolean;
  };
}

/**
 * Consensus Service
 */
export class ConsensusService {
  /**
   * Generate consensus from scan result
   */
  async generateConsensus(request: ConsensusRequest): Promise<ConsensusResponse> {
    const startTime = Date.now();
    const { scanResult, userContext } = request;

    // Generate explanations using Gemini
    const summaryPromise = this.generateSummary(scanResult, userContext);
    const detailedPromise = this.generateDetailedExplanation(scanResult, userContext);

    const [summary, detailedExplanation] = await Promise.all([
      summaryPromise,
      detailedPromise
    ]);

    // Extract key findings
    const keyFindings = this.extractKeyFindings(scanResult);

    // Build decision breakdown
    const decisionBreakdown = this.buildDecisionBreakdown(scanResult);

    // Categorize recommended actions
    const recommendedActions = this.categorizeActions(scanResult);

    // Run additional modules if requested
    const modules = await this.runAdditionalModules(
      scanResult.url,
      request.includeModules
    );

    const processingTime = Date.now() - startTime;

    return {
      scanId: request.scanId,
      url: scanResult.url,
      timestamp: new Date(),

      verdict: {
        riskLevel: scanResult.riskLevel,
        riskScore: scanResult.riskScore,
        probability: scanResult.probability,
        confidenceInterval: scanResult.confidenceInterval
      },

      summary: summary.text,
      detailedExplanation: detailedExplanation.text,

      keyFindings,
      decisionBreakdown,
      recommendedActions,

      modules,

      metadata: {
        scanVersion: 'v2',
        processingTime,
        geminiModel: detailedExplanation.model,
        cached: summary.cached || detailedExplanation.cached
      }
    };
  }

  /**
   * Generate summary using Gemini
   */
  private async generateSummary(
    scanResult: EnhancedScanResult,
    userContext?: ConsensusRequest['userContext']
  ) {
    const gemini = getGeminiRouter();

    const technicalLevel = userContext?.technicalLevel || 'basic';
    const language = userContext?.language || 'English';

    let complexityInstruction = '';
    if (technicalLevel === 'basic') {
      complexityInstruction = 'Use simple, non-technical language suitable for a general audience.';
    } else if (technicalLevel === 'intermediate') {
      complexityInstruction = 'Use moderately technical language with some cybersecurity terminology.';
    } else {
      complexityInstruction = 'Use technical language and include specific cybersecurity details.';
    }

    const prompt = `Summarize this URL scan result in 2-3 sentences in ${language}:

URL: ${scanResult.url}
Risk Level: ${scanResult.riskLevel} (${scanResult.riskScore}/100)
Reachability: ${scanResult.reachability}
Domain Age: ${scanResult.evidenceSummary.domainAge} days
TLS Valid: ${scanResult.evidenceSummary.tlsValid ? 'Yes' : 'No'}
TI Hits: ${scanResult.evidenceSummary.tiHits}

Top Recommendations:
${scanResult.recommendedActions.slice(0, 3).join('\n')}

${complexityInstruction}
Focus on what this means for the user and what they should do.`;

    return gemini.generate({
      prompt,
      complexity: TaskComplexity.SIMPLE,
      maxTokens: 300,
      temperature: 0.4,
      cacheKey: `summary-${scanResult.scanId}`
    });
  }

  /**
   * Generate detailed explanation using Gemini
   */
  private async generateDetailedExplanation(
    scanResult: EnhancedScanResult,
    userContext?: ConsensusRequest['userContext']
  ) {
    const gemini = getGeminiRouter();

    const technicalLevel = userContext?.technicalLevel || 'intermediate';

    const prompt = `Provide a detailed explanation of this URL scan result:

**Scan Details:**
- URL: ${scanResult.url}
- Risk Level: ${scanResult.riskLevel}
- Risk Score: ${scanResult.riskScore}/100
- Probability: ${(scanResult.probability * 100).toFixed(1)}%
- Confidence Interval: [${(scanResult.confidenceInterval.lower * 100).toFixed(1)}%, ${(scanResult.confidenceInterval.upper * 100).toFixed(1)}%]

**Evidence:**
- Reachability: ${scanResult.reachability}
- Domain Age: ${scanResult.evidenceSummary.domainAge} days
- TLS Valid: ${scanResult.evidenceSummary.tlsValid ? 'Yes' : 'No'}
- Threat Intel Hits: ${scanResult.evidenceSummary.tiHits}
- Login Form Detected: ${scanResult.evidenceSummary.hasLoginForm ? 'Yes' : 'No'}
- Auto-Download: ${scanResult.evidenceSummary.autoDownload ? 'Yes' : 'No'}

**Model Predictions:**
- Stage-1 Probability: ${(scanResult.stage1.combined.probability * 100).toFixed(1)}%
- Stage-1 Confidence: ${(scanResult.stage1.combined.confidence * 100).toFixed(1)}%
${scanResult.stage2 ? `- Stage-2 Probability: ${(scanResult.stage2.combined.probability * 100).toFixed(1)}%` : '- Stage-2: Skipped (high Stage-1 confidence)'}

**Policy Override:**
${scanResult.policyOverride ? `- Override Applied: ${scanResult.policyOverride.reason}` : '- No policy override'}

Please explain:
1. **Risk Assessment**: How was the risk level determined? What were the key factors?
2. **Evidence Analysis**: What evidence supports this assessment?
3. **Model Reasoning**: How did the ML models contribute to the decision?
4. **Confidence Level**: What does the confidence interval tell us?
5. **User Guidance**: What should the user do?

Technical Level: ${technicalLevel}
Structure your response with clear sections and bullet points where appropriate.`;

    return gemini.generate({
      prompt,
      complexity: TaskComplexity.COMPLEX,
      maxTokens: 2000,
      temperature: 0.5,
      contextLength: prompt.length,
      cacheKey: `detailed-${scanResult.scanId}`
    });
  }

  /**
   * Extract key findings from scan result
   */
  private extractKeyFindings(scanResult: EnhancedScanResult): Array<{
    category: string;
    finding: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    impact: string;
  }> {
    const findings: any[] = [];

    // Domain age
    if (scanResult.evidenceSummary.domainAge < 7) {
      findings.push({
        category: 'Domain',
        finding: `Domain registered ${scanResult.evidenceSummary.domainAge} days ago`,
        severity: 'critical',
        impact: 'Newly registered domains are commonly used in phishing attacks'
      });
    } else if (scanResult.evidenceSummary.domainAge < 30) {
      findings.push({
        category: 'Domain',
        finding: `Domain registered ${scanResult.evidenceSummary.domainAge} days ago`,
        severity: 'high',
        impact: 'Recently registered domain - higher risk'
      });
    }

    // TLS
    if (!scanResult.evidenceSummary.tlsValid) {
      findings.push({
        category: 'Security',
        finding: 'Invalid or missing TLS certificate',
        severity: 'high',
        impact: 'Connection is not secure - data may be intercepted'
      });
    }

    // TI hits
    if (scanResult.evidenceSummary.tiHits > 0) {
      findings.push({
        category: 'Threat Intelligence',
        finding: `Flagged by ${scanResult.evidenceSummary.tiHits} threat intelligence sources`,
        severity: scanResult.evidenceSummary.tiHits >= 2 ? 'critical' : 'high',
        impact: 'Known malicious URL - high confidence of threat'
      });
    }

    // Login form
    if (scanResult.evidenceSummary.hasLoginForm) {
      findings.push({
        category: 'Content',
        finding: 'Login form detected',
        severity: scanResult.probability > 0.7 ? 'high' : 'medium',
        impact: 'May attempt to steal credentials'
      });
    }

    // Auto-download
    if (scanResult.evidenceSummary.autoDownload) {
      findings.push({
        category: 'Behavior',
        finding: 'Automatic file download detected',
        severity: 'critical',
        impact: 'May download malware or ransomware'
      });
    }

    // Policy override
    if (scanResult.policyOverride) {
      findings.push({
        category: 'Policy',
        finding: scanResult.policyOverride.reason || 'Policy rule triggered',
        severity: 'critical',
        impact: 'Deterministic rule - high confidence'
      });
    }

    return findings;
  }

  /**
   * Build decision breakdown
   */
  private buildDecisionBreakdown(scanResult: EnhancedScanResult) {
    // Extract top contributing factors from decision graph
    const topFactors: Array<{
      factor: string;
      contribution: number;
      explanation: string;
    }> = [];

    for (const node of scanResult.decisionGraph) {
      if (node.contribution > 0.1) {
        topFactors.push({
          factor: node.component,
          contribution: node.contribution,
          explanation: this.explainDecisionNode(node)
        });
      }
    }

    // Sort by contribution
    topFactors.sort((a, b) => b.contribution - a.contribution);

    return {
      modelContributions: {
        stage1: scanResult.stage1.combined.probability,
        stage2: scanResult.stage2?.combined.probability,
        causalSignals: topFactors
          .filter(f => f.factor.includes('Causal'))
          .reduce((sum, f) => sum + f.contribution, 0)
      },
      topFactors: topFactors.slice(0, 5) // Top 5 factors
    };
  }

  /**
   * Explain decision node
   */
  private explainDecisionNode(node: any): string {
    switch (node.component) {
      case 'Stage-1 Models':
        return 'Lightweight ML models analyzed URL patterns and metadata';
      case 'Stage-2 Deep Analysis':
        return 'Advanced models performed content and visual analysis';
      case 'Causal Signals':
        return 'Hard rules detected suspicious patterns';
      case 'Branch Correction':
        return `Adjusted for ${node.input.branch} reachability status`;
      case 'Conformal Calibration':
        return 'Calibrated probability with confidence interval';
      case 'Policy Override':
        return 'Deterministic rule triggered automatic action';
      default:
        return node.component;
    }
  }

  /**
   * Categorize recommended actions
   */
  private categorizeActions(scanResult: EnhancedScanResult) {
    const immediate: string[] = [];
    const preventive: string[] = [];
    const educational: string[] = [];

    for (const action of scanResult.recommendedActions) {
      if (action.includes('⛔') || action.includes('Block') || action.includes('BLOCK')) {
        immediate.push(action);
      } else if (action.includes('⚠️') || action.includes('caution') || action.includes('verify')) {
        preventive.push(action);
      } else if (action.includes('ℹ️') || action.includes('understand') || action.includes('learn')) {
        educational.push(action);
      } else {
        preventive.push(action);
      }
    }

    // Add default actions if empty
    if (immediate.length === 0 && scanResult.probability > 0.8) {
      immediate.push('⛔ Do not access this URL');
      immediate.push('📢 Report this URL to your security team');
    }

    if (preventive.length === 0) {
      preventive.push('🔒 Only visit websites you trust');
      preventive.push('✅ Verify URL authenticity before entering sensitive information');
    }

    if (educational.length === 0) {
      educational.push('📚 Learn about phishing tactics');
      educational.push('🛡️ Enable two-factor authentication on important accounts');
    }

    return { immediate, preventive, educational };
  }

  /**
   * Run additional analysis modules
   * TODO: Integrate with actual module services
   */
  private async runAdditionalModules(
    url: string,
    modules?: ConsensusRequest['includeModules']
  ): Promise<any> {
    if (!modules) return undefined;

    const results: any = {};

    // Placeholder - would call actual services
    if (modules.deepfake) {
      results.deepfake = {
        analyzed: false,
        reason: 'Not implemented yet'
      };
    }

    if (modules.profileAnalysis) {
      results.profileAnalysis = {
        analyzed: false,
        reason: 'Not implemented yet'
      };
    }

    if (modules.factCheck) {
      results.factCheck = {
        analyzed: false,
        reason: 'Not implemented yet'
      };
    }

    return Object.keys(results).length > 0 ? results : undefined;
  }
}

/**
 * Singleton instance
 */
let consensusServiceInstance: ConsensusService | null = null;

/**
 * Get Consensus Service instance
 */
export function getConsensusService(): ConsensusService {
  if (!consensusServiceInstance) {
    consensusServiceInstance = new ConsensusService();
  }
  return consensusServiceInstance;
}

/**
 * Helper: Quick consensus generation
 */
export async function generateQuickConsensus(
  scanResult: EnhancedScanResult
): Promise<ConsensusResponse> {
  const service = getConsensusService();
  return service.generateConsensus({
    scanId: scanResult.scanId,
    scanResult,
    userContext: {
      technicalLevel: 'basic'
    }
  });
}
