/**
 * Claude Sonnet 4.5 Analyzer
 *
 * Uses Claude Sonnet 4.5 to analyze scan results and suggest risk multiplier
 * Weight: 35% in final consensus
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIConsensusInput, AIModelResponse } from './types.js';
import { logger } from '../../../config/logger.js';

export class ClaudeAnalyzer {
  private client: Anthropic;
  private config: {
    model: string;
    timeout: number;
    apiKey?: string;
  };

  constructor(config: { model: string; timeout: number; apiKey?: string }) {
    this.config = config;

    // Use provided API key (from database) or fallback to env variable
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured (neither in config nor env)');
    }

    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze scan results using Claude Sonnet 4.5
   */
  async analyze(input: AIConsensusInput): Promise<AIModelResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(input);

      logger.debug('[Claude] Sending analysis request...');

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;

      // Parse Claude's response
      const content = response.content[0];
      const text = content.type === 'text' ? content.text : '';

      logger.debug('[Claude] Raw response:', text);

      const parsed = this.parseResponse(text);

      return {
        modelName: 'claude',
        modelVersion: this.config.model,
        riskAssessment: parsed.riskAssessment,
        suggestedMultiplier: parsed.multiplier,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        keyFactors: parsed.keyFactors,
        duration
      };
    } catch (error) {
      logger.error('[Claude] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Build analysis prompt for Claude
   */
  private buildPrompt(input: AIConsensusInput): string {
    return `You are an expert cybersecurity analyst reviewing a URL scan result. Your task is to assess the risk level and suggest a risk multiplier.

# SCAN DATA

**URL:** ${input.url}
**Domain:** ${input.urlComponents.domain}
**Subdomain:** ${input.urlComponents.subdomain || 'none'}
**Path:** ${input.urlComponents.path || '/'}
**Query:** ${input.urlComponents.query || 'none'}

**Reachability:** ${input.reachabilityState}
**Pipeline:** ${input.pipelineUsed}

**Base Score:** ${input.baseScore}/${input.activeMaxScore} (${input.riskPercentage.toFixed(1)}%)
**Preliminary Risk Level:** ${input.riskLevel.toUpperCase()}

# TOP FINDINGS

${input.topFindings.map(f => `- [${f.severity.toUpperCase()}] ${f.categoryName}: ${f.message} (${f.points} pts)`).join('\n')}

# THREAT INTELLIGENCE SUMMARY

- Malicious sources: ${input.tiSummary.maliciousCount}
- Suspicious sources: ${input.tiSummary.suspiciousCount}
- Safe sources: ${input.tiSummary.safeCount}
- Failed checks: ${input.tiSummary.errorCount}

${input.tiSummary.maliciousSources.length > 0 ? `**Flagged by:** ${input.tiSummary.maliciousSources.join(', ')}` : ''}

# CATEGORY BREAKDOWN

${input.categorySummary.slice(0, 5).map(c => `- ${c.categoryName}: ${c.score}/${c.maxWeight} (${c.percentage.toFixed(0)}%)`).join('\n')}

# YOUR TASK

Based on this scan data, provide:

1. **Risk Assessment (0-100):** Your independent assessment of the URL's risk level (0 = completely safe, 100 = definitely malicious)

2. **Suggested Multiplier (0.7-1.3):**
   - Use 0.7-0.8 if you believe the base score OVERESTIMATES risk (false positive indicators)
   - Use 0.9-1.0 if you agree with the base score (neutral)
   - Use 1.1-1.3 if you believe the base score UNDERESTIMATES risk (additional context suggests higher risk)

3. **Confidence (0-100):** How confident are you in this assessment?

4. **Reasoning:** Brief explanation (2-3 sentences) of your assessment

5. **Key Factors:** Top 3 factors that influenced your decision

# RESPONSE FORMAT

Respond in this EXACT JSON format (no markdown, no code blocks):

{
  "riskAssessment": <number 0-100>,
  "multiplier": <number 0.7-1.3>,
  "confidence": <number 0-100>,
  "reasoning": "<string>",
  "keyFactors": ["<factor1>", "<factor2>", "<factor3>"]
}

Your response:`;
  }

  /**
   * Parse Claude's JSON response
   */
  private parseResponse(text: string): {
    riskAssessment: number;
    multiplier: number;
    confidence: number;
    reasoning: string;
    keyFactors: string[];
  } {
    try {
      // Remove markdown code blocks if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\s*/g, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate and clamp values
      return {
        riskAssessment: Math.max(0, Math.min(100, parsed.riskAssessment || 50)),
        multiplier: Math.max(0.7, Math.min(1.3, parsed.multiplier || 1.0)),
        confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.slice(0, 3) : []
      };
    } catch (error) {
      logger.error('[Claude] Failed to parse response:', error);
      logger.debug('[Claude] Raw text:', text);

      // Return fallback values
      return {
        riskAssessment: 50,
        multiplier: 1.0,
        confidence: 0,
        reasoning: 'Failed to parse Claude response',
        keyFactors: []
      };
    }
  }
}
