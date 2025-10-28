/**
 * V2 Gemini AI Summarizer Service
 *
 * Generates human-readable summaries using Gemini 1.5 Pro
 */

import { VertexAI } from '@google-cloud/vertexai';
import type { EnhancedScanResult } from '../../scanners/url-scanner-v2/types';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp-13082025-u1';
const LOCATION = 'us-central1';

export class V2GeminiSummarizer {
  private vertexAI: VertexAI;
  private model: any;

  constructor() {
    this.vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
    this.model = this.vertexAI.preview.getGenerativeModel({
      model: 'gemini-1.5-pro-002',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.4,
        topP: 0.95,
      },
    });
  }

  async generateSummary(result: EnhancedScanResult): Promise<{
    explanation: string;
    keyFindings: string[];
    riskAssessment: string;
    recommendedActions: string[];
    technicalDetails?: string;
  }> {
    try {
      const prompt = this.buildPrompt(result);
      const response = await this.model.generateContent(prompt);
      const text = response.response.candidates[0].content.parts[0].text;

      return this.parseResponse(text);
    } catch (error) {
      console.warn('[Gemini] Failed to generate summary, using fallback:', error);
      return this.generateFallbackSummary(result);
    }
  }

  private buildPrompt(result: EnhancedScanResult): string {
    return `You are a cybersecurity analyst. Analyze this URL scan result and provide a clear, actionable summary.

URL: ${result.url}
Risk Level: ${result.riskLevel} (${Math.round(result.probability * 100)}% probability)
Reachability: ${result.reachability}
Domain Age: ${result.evidenceSummary.domainAge} days
TLS Valid: ${result.evidenceSummary.tlsValid}
TI Hits: ${result.evidenceSummary.tiHits}
Has Login Form: ${result.evidenceSummary.hasLoginForm}
Policy Override: ${result.policyOverride ? result.policyOverride.reason : 'None'}

Provide:
1. EXPLANATION (2-3 sentences): What this site is and the risk level
2. KEY_FINDINGS (3-5 bullet points): Concerning indicators
3. RISK_ASSESSMENT: Why this risk level was assigned
4. RECOMMENDED_ACTIONS (3-5 items): What the user should do
5. TECHNICAL_DETAILS (optional): For analysts

Format as JSON:
{
  "explanation": "...",
  "keyFindings": ["...", "..."],
  "riskAssessment": "...",
  "recommendedActions": ["...", "..."],
  "technicalDetails": "..."
}`;
  }

  private parseResponse(text: string): any {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      return JSON.parse(jsonText);
    } catch (error) {
      // Fallback parsing
      return {
        explanation: text.substring(0, 500),
        keyFindings: ['Auto-generated summary failed'],
        riskAssessment: 'See detailed report',
        recommendedActions: ['Review scan results manually'],
        technicalDetails: text
      };
    }
  }

  private generateFallbackSummary(result: EnhancedScanResult): any {
    const riskMap: Record<string, string> = {
      F: 'Confirmed threat - do not visit',
      E: 'Critical threat - high risk',
      D: 'Likely fraudulent',
      C: 'Suspicious indicators',
      B: 'Low risk',
      A: 'Safe'
    };

    // Extract key findings from granular checks
    const failedChecks = result.granularChecks?.filter(c => c.status === 'FAIL') || [];
    const topIssues = failedChecks.slice(0, 5).map(c => c.description);

    // Generate detailed summary from scan data
    const domainAgeDays = result.evidenceSummary.domainAge;
    const domainAgeText = domainAgeDays < 30
      ? `very new domain (${domainAgeDays} days old - high phishing risk)`
      : domainAgeDays < 365
      ? `relatively new domain (${domainAgeDays} days old)`
      : `established domain (${Math.floor(domainAgeDays / 365)} years old)`;

    const keyFindings: string[] = [];

    // Add domain age finding
    if (domainAgeDays < 30) {
      keyFindings.push(`Domain registered ${domainAgeDays} days ago (very new - suspicious)`);
    } else if (domainAgeDays < 365) {
      keyFindings.push(`Domain age: ${domainAgeDays} days (less than 1 year)`);
    }

    // Add TLS finding
    if (!result.evidenceSummary.tlsValid) {
      keyFindings.push('Invalid or missing SSL certificate');
    }

    // Add threat intelligence findings
    if (result.evidenceSummary.tiHits > 0) {
      keyFindings.push(`Flagged by ${result.evidenceSummary.tiHits} threat intelligence source(s)`);
    }

    // Add login form finding
    if (result.evidenceSummary.hasLoginForm) {
      keyFindings.push('Password form detected on page');
    }

    // Add top failed checks
    topIssues.slice(0, 3).forEach(issue => keyFindings.push(issue));

    // Generate recommendation
    const recommendation = result.riskLevel === 'F' || result.riskLevel === 'E'
      ? 'BLOCK: Do not visit this website. It has been identified as a severe security threat.'
      : result.riskLevel === 'D'
      ? 'HIGH RISK: Avoid visiting unless absolutely necessary. Strong indicators of malicious intent.'
      : result.riskLevel === 'C'
      ? 'CAUTION: Proceed with caution. Multiple warning signs detected.'
      : result.riskLevel === 'B'
      ? 'LOW RISK: Generally safe but minor concerns identified.'
      : 'SAFE: No significant security concerns detected.';

    const summary = `Security scan detected ${failedChecks.length} security issue(s) with a final risk score of ${Math.round(result.probability * 100)}%. The website is a ${domainAgeText}. ${topIssues.length > 0 ? 'Key concerns: ' + topIssues.slice(0, 2).join('; ') + '.' : 'No critical issues found.'} Recommendation: ${recommendation}`;

    return {
      explanation: summary,
      keyFindings: keyFindings.length > 0 ? keyFindings : [
        `Domain age: ${result.evidenceSummary.domainAge} days`,
        `TLS certificate: ${result.evidenceSummary.tlsValid ? 'Valid' : 'Invalid'}`,
        `Threat intelligence hits: ${result.evidenceSummary.tiHits}`
      ],
      riskAssessment: `Risk level ${result.riskLevel} (${riskMap[result.riskLevel]}) assigned with ${Math.round(result.probability * 100)}% risk score. Analyzed ${result.granularChecks?.length || 0} security checks across multiple categories. Confidence interval: ${Math.round((result.confidenceInterval?.lower || 0) * 100)}%-${Math.round((result.confidenceInterval?.upper || 0) * 100)}%.`,
      recommendedActions: result.recommendedActions || [
        recommendation,
        'Review detailed scan report for full analysis',
        'Check transparency section for complete breakdown'
      ],
      technicalDetails: `Reachability: ${result.reachability}. Stage-1 Models: ${result.stage1 ? 'executed' : 'skipped'}. Stage-2 Models: ${result.stage2 ? 'executed' : 'skipped'}. Granular Checks: ${result.granularChecks?.length || 0} executed. Scan ID: ${result.scanId}.`
    };
  }
}
