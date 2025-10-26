/**
 * Gemini AI Scan Summarizer
 * Generates human-readable explanations for V2 scan results using Gemini AI
 */

import { getGeminiRouter } from './geminiRouter.service.js';
import { logger } from '../../config/logger.js';
import type { EnhancedScanResult } from '../../scanners/url-scanner-v2/types';

export interface ScanSummary {
  explanation: string;
  keyFindings: string[];
  riskAssessment: string;
  recommendedActions: string[];
  technicalDetails?: string;
}

export class GeminiScanSummarizerService {
  /**
   * Generate comprehensive summary for V2 scan result
   */
  async summarizeScan(scanResult: EnhancedScanResult): Promise<ScanSummary> {
    try {
      // Build context for AI
      const context = this.buildScanContext(scanResult);

      // Choose appropriate prompt complexity
      const useProModel = this.shouldUseProModel(scanResult);

      // Generate summary using Gemini
      const prompt = this.buildSummarizationPrompt(scanResult, context);
      const response = await getGeminiRouter().generate(prompt, {
        useProModel,
        temperature: 0.3, // Lower temperature for more consistent results
        maxTokens: 1000
      });

      // Parse and structure the response
      const summary = this.parseAIResponse(response, scanResult);

      return summary;

    } catch (error: any) {
      logger.error('[GeminiSummarizer] Failed to generate summary:', error.message);

      // Return fallback summary
      return this.generateFallbackSummary(scanResult);
    }
  }

  /**
   * Generate verdict explanation
   */
  async explainVerdict(scanResult: EnhancedScanResult): Promise<string> {
    try {
      const prompt = `
Explain in 2-3 sentences why this URL was classified as ${scanResult.riskLevel} risk (${scanResult.riskScore}% probability):

URL: ${scanResult.url}
Risk Level: ${scanResult.riskLevel}
Probability: ${scanResult.probability.toFixed(3)}
Confidence Interval: [${scanResult.confidenceInterval.lower.toFixed(3)}, ${scanResult.confidenceInterval.upper.toFixed(3)}]

Key Evidence:
- Domain Age: ${scanResult.evidenceSummary.domainAge} days
- TLS Valid: ${scanResult.evidenceSummary.tlsValid}
- TI Hits: ${scanResult.evidenceSummary.tiHits}
- Login Form: ${scanResult.evidenceSummary.hasLoginForm}
- Auto Download: ${scanResult.evidenceSummary.autoDownload}

Stage-1 Confidence: ${scanResult.stage1.combined.confidence.toFixed(3)}
${scanResult.stage2 ? `Stage-2 Confidence: ${scanResult.stage2.combined.confidence.toFixed(3)}` : 'Stage-2 skipped (high Stage-1 confidence)'}

Provide a clear, non-technical explanation suitable for end users.
`;

      const response = await getGeminiRouter().generate(prompt, {
        useProModel: false, // Use Flash for simple explanations
        temperature: 0.4,
        maxTokens: 200
      });

      return response.trim();

    } catch (error: any) {
      logger.error('[GeminiSummarizer] Failed to explain verdict:', error.message);
      return this.getFallbackVerdictExplanation(scanResult);
    }
  }

  /**
   * Build scan context for AI
   */
  private buildScanContext(scanResult: EnhancedScanResult): string {
    const parts: string[] = [];

    // Basic info
    parts.push(`URL: ${scanResult.url}`);
    parts.push(`Scan ID: ${scanResult.scanId}`);
    parts.push(`Timestamp: ${scanResult.timestamp.toISOString()}`);
    parts.push(`Reachability: ${scanResult.reachability}`);
    parts.push('');

    // Risk assessment
    parts.push('Risk Assessment:');
    parts.push(`- Risk Level: ${scanResult.riskLevel}`);
    parts.push(`- Risk Score: ${scanResult.riskScore}%`);
    parts.push(`- Probability: ${scanResult.probability.toFixed(4)}`);
    parts.push(`- Confidence Interval: [${scanResult.confidenceInterval.lower.toFixed(4)}, ${scanResult.confidenceInterval.upper.toFixed(4)}] (width: ${scanResult.confidenceInterval.width.toFixed(4)})`);
    parts.push('');

    // Evidence summary
    parts.push('Evidence:');
    parts.push(`- Domain Age: ${scanResult.evidenceSummary.domainAge} days`);
    parts.push(`- TLS Valid: ${scanResult.evidenceSummary.tlsValid}`);
    parts.push(`- Threat Intelligence Hits: ${scanResult.evidenceSummary.tiHits}`);
    parts.push(`- Has Login Form: ${scanResult.evidenceSummary.hasLoginForm}`);
    parts.push(`- Auto Download Detected: ${scanResult.evidenceSummary.autoDownload}`);
    parts.push('');

    // Model predictions
    parts.push('Stage-1 Model Predictions:');
    parts.push(`- URL Lexical A: ${(scanResult.stage1.urlLexicalA.probability * 100).toFixed(2)}% (confidence: ${scanResult.stage1.urlLexicalA.confidence.toFixed(3)})`);
    parts.push(`- URL Lexical B: ${(scanResult.stage1.urlLexicalB.probability * 100).toFixed(2)}% (confidence: ${scanResult.stage1.urlLexicalB.confidence.toFixed(3)})`);
    parts.push(`- Tabular Risk: ${(scanResult.stage1.tabularRisk.probability * 100).toFixed(2)}% (confidence: ${scanResult.stage1.tabularRisk.confidence.toFixed(3)})`);
    parts.push(`- Combined: ${(scanResult.stage1.combined.probability * 100).toFixed(2)}% (confidence: ${scanResult.stage1.combined.confidence.toFixed(3)})`);
    parts.push('');

    if (scanResult.stage2) {
      parts.push('Stage-2 Model Predictions:');
      parts.push(`- Text Persuasion: ${(scanResult.stage2.textPersuasion.probability * 100).toFixed(2)}% (confidence: ${scanResult.stage2.textPersuasion.confidence.toFixed(3)})`);
      if (scanResult.stage2.textPersuasion.persuasionTactics.length > 0) {
        parts.push(`  Persuasion Tactics: ${scanResult.stage2.textPersuasion.persuasionTactics.join(', ')}`);
      }
      parts.push(`- Screenshot CNN: ${(scanResult.stage2.screenshotCnn.probability * 100).toFixed(2)}% (confidence: ${scanResult.stage2.screenshotCnn.confidence.toFixed(3)})`);
      if (scanResult.stage2.screenshotCnn.detectedBrands.length > 0) {
        parts.push(`  Detected Brands: ${scanResult.stage2.screenshotCnn.detectedBrands.join(', ')}`);
      }
      parts.push(`  Fake Login Detected: ${scanResult.stage2.screenshotCnn.isFakeLogin}`);
      parts.push('');
    }

    // External API results
    if (scanResult.externalAPIs) {
      if (scanResult.externalAPIs.virusTotal) {
        parts.push('VirusTotal Results:');
        parts.push(`- Detected: ${scanResult.externalAPIs.virusTotal.detected}`);
        parts.push(`- Positives: ${scanResult.externalAPIs.virusTotal.positives}/${scanResult.externalAPIs.virusTotal.total}`);
        if (scanResult.externalAPIs.virusTotal.permalink) {
          parts.push(`- Report: ${scanResult.externalAPIs.virusTotal.permalink}`);
        }
        parts.push('');
      }

      if (scanResult.externalAPIs.scamAdviser) {
        parts.push('ScamAdviser Results:');
        parts.push(`- Trust Score: ${scanResult.externalAPIs.scamAdviser.trustScore}/100`);
        parts.push(`- Risk Level: ${scanResult.externalAPIs.scamAdviser.riskLevel}`);
        if (scanResult.externalAPIs.scamAdviser.warnings && scanResult.externalAPIs.scamAdviser.warnings.length > 0) {
          parts.push(`- Warnings: ${scanResult.externalAPIs.scamAdviser.warnings.join(', ')}`);
        }
        parts.push('');
      }
    }

    // Policy override
    if (scanResult.policyOverride?.overridden) {
      parts.push('Policy Override:');
      parts.push(`- Action: ${scanResult.policyOverride.action}`);
      parts.push(`- Reason: ${scanResult.policyOverride.reason}`);
      parts.push(`- Rule: ${scanResult.policyOverride.rule}`);
      parts.push('');
    }

    // Performance
    parts.push('Performance:');
    parts.push(`- Total Latency: ${scanResult.latency.total}ms`);
    parts.push(`- Reachability: ${scanResult.latency.reachability}ms`);
    parts.push(`- Evidence Collection: ${scanResult.latency.evidence}ms`);
    parts.push(`- Stage-1: ${scanResult.latency.stage1}ms`);
    if (scanResult.latency.stage2) {
      parts.push(`- Stage-2: ${scanResult.latency.stage2}ms`);
    }

    return parts.join('\n');
  }

  /**
   * Build summarization prompt
   */
  private buildSummarizationPrompt(scanResult: EnhancedScanResult, context: string): string {
    return `
You are a cybersecurity expert analyzing URL scan results from Elara's V2 scanner.

Analyze the following scan results and provide a comprehensive summary:

${context}

Provide a structured summary with the following sections:

1. **Executive Summary** (2-3 sentences): High-level verdict and key risk factors
2. **Key Findings** (3-5 bullet points): Most important discoveries from the scan
3. **Risk Assessment** (1 paragraph): Detailed explanation of why this risk level was assigned
4. **Technical Details** (1 paragraph): Technical evidence supporting the verdict
5. **Recommended Actions** (3-5 bullet points): What the user should do

Format your response as JSON:
{
  "explanation": "executive summary here",
  "keyFindings": ["finding 1", "finding 2", ...],
  "riskAssessment": "risk assessment paragraph",
  "technicalDetails": "technical details paragraph",
  "recommendedActions": ["action 1", "action 2", ...]
}

Be clear, concise, and non-technical where possible. Focus on actionable insights.
`;
  }

  /**
   * Parse AI response into structured summary
   */
  private parseAIResponse(response: string, scanResult: EnhancedScanResult): ScanSummary {
    try {
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          explanation: parsed.explanation || '',
          keyFindings: parsed.keyFindings || [],
          riskAssessment: parsed.riskAssessment || '',
          recommendedActions: parsed.recommendedActions || scanResult.recommendedActions,
          technicalDetails: parsed.technicalDetails
        };
      }

      // Fallback: parse as plain text
      return this.generateFallbackSummary(scanResult);

    } catch (error) {
      logger.warn('[GeminiSummarizer] Failed to parse AI response, using fallback');
      return this.generateFallbackSummary(scanResult);
    }
  }

  /**
   * Determine if Pro model should be used
   */
  private shouldUseProModel(scanResult: EnhancedScanResult): boolean {
    // Use Pro model for:
    // 1. Stage-2 scans (more complex)
    // 2. Low confidence results (need better explanation)
    // 3. Policy overrides (complex decision)

    if (scanResult.stage2) return true;
    if (scanResult.confidenceInterval.width > 0.4) return true;
    if (scanResult.policyOverride?.overridden) return true;

    return false;
  }

  /**
   * Generate fallback summary when AI fails
   */
  private generateFallbackSummary(scanResult: EnhancedScanResult): ScanSummary {
    const riskLevelDesc = this.getRiskLevelDescription(scanResult.riskLevel);

    return {
      explanation: `This URL was classified as ${riskLevelDesc} with a ${scanResult.riskScore}% risk score. The assessment is based on multiple factors including domain age, threat intelligence, and content analysis.`,

      keyFindings: [
        `Risk Level: ${scanResult.riskLevel} (${scanResult.riskScore}%)`,
        `Domain Age: ${scanResult.evidenceSummary.domainAge} days`,
        `Threat Intelligence Hits: ${scanResult.evidenceSummary.tiHits}`,
        `TLS Certificate: ${scanResult.evidenceSummary.tlsValid ? 'Valid' : 'Invalid or Missing'}`,
        scanResult.evidenceSummary.hasLoginForm ? 'Login form detected on page' : 'No login form detected'
      ],

      riskAssessment: `Based on comprehensive analysis using Elara's V2 scanner, this URL presents a ${riskLevelDesc} threat. The probability score of ${(scanResult.probability * 100).toFixed(1)}% was calculated using a two-stage machine learning pipeline with ${scanResult.stage2 ? 'deep content analysis' : 'lexical and metadata analysis'}.`,

      recommendedActions: scanResult.recommendedActions,

      technicalDetails: `Scan completed in ${scanResult.latency.total}ms using ${scanResult.stage2 ? 'Stage-1 + Stage-2' : 'Stage-1 only'} analysis. Confidence interval: [${(scanResult.confidenceInterval.lower * 100).toFixed(1)}%, ${(scanResult.confidenceInterval.upper * 100).toFixed(1)}%].`
    };
  }

  /**
   * Get fallback verdict explanation
   */
  private getFallbackVerdictExplanation(scanResult: EnhancedScanResult): string {
    const riskDesc = this.getRiskLevelDescription(scanResult.riskLevel);

    return `This URL was classified as ${riskDesc} based on analysis of domain characteristics, threat intelligence feeds, and content examination. The ${scanResult.riskScore}% risk score indicates ${this.getConfidenceDescription(scanResult.confidenceInterval.width)} certainty in this assessment.`;
  }

  /**
   * Get risk level description
   */
  private getRiskLevelDescription(riskLevel: string): string {
    const descriptions: Record<string, string> = {
      'A': 'SAFE',
      'B': 'LOW RISK',
      'C': 'MEDIUM RISK',
      'D': 'HIGH RISK',
      'E': 'CRITICAL',
      'F': 'MALICIOUS'
    };
    return descriptions[riskLevel] || 'UNKNOWN RISK';
  }

  /**
   * Get confidence description
   */
  private getConfidenceDescription(width: number): string {
    if (width < 0.2) return 'high';
    if (width < 0.4) return 'moderate';
    return 'low';
  }
}

export const geminiScanSummarizerService = new GeminiScanSummarizerService();
