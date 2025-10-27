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

    return {
      explanation: `This website has been classified as ${riskMap[result.riskLevel]} based on security analysis.`,
      keyFindings: [
        `Domain age: ${result.evidenceSummary.domainAge} days`,
        `TLS certificate: ${result.evidenceSummary.tlsValid ? 'Valid' : 'Invalid'}`,
        `Threat intelligence hits: ${result.evidenceSummary.tiHits}`,
        `Login form detected: ${result.evidenceSummary.hasLoginForm ? 'Yes' : 'No'}`
      ],
      riskAssessment: `Risk level ${result.riskLevel} assigned with ${Math.round(result.probability * 100)}% confidence.`,
      recommendedActions: result.recommendedActions || ['Review detailed scan report'],
      technicalDetails: `Reachability: ${result.reachability}. Scan ID: ${result.scanId}`
    };
  }
}
