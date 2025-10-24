/**
 * GPT-4 Analyzer
 *
 * Uses GPT-4 to analyze scan results and suggest risk multiplier
 * Weight: 35% in final consensus
 */

import OpenAI from 'openai';
import { AIConsensusInput, AIModelResponse } from './types.js';
import { logger } from '../../../config/logger.js';

export class GPTAnalyzer {
  private client: OpenAI;
  private config: {
    model: string;
    timeout: number;
    apiKey?: string;
  };

  constructor(config: { model: string; timeout: number; apiKey?: string }) {
    this.config = config;

    // Use provided API key (from database) or fallback to env variable
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured (neither in config nor env)');
    }

    this.client = new OpenAI({ apiKey });
  }

  /**
   * Analyze scan results using GPT-4
   */
  async analyze(input: AIConsensusInput): Promise<AIModelResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(input);

      logger.debug('[GPT-4] Sending analysis request...');

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert cybersecurity analyst specializing in URL threat assessment. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0,
        response_format: { type: 'json_object' }
      });

      const duration = Date.now() - startTime;

      // Parse GPT-4's response
      const content = response.choices[0]?.message?.content || '{}';

      logger.debug('[GPT-4] Raw response:', content);

      const parsed = this.parseResponse(content);

      return {
        modelName: 'gpt4',
        modelVersion: this.config.model,
        riskAssessment: parsed.riskAssessment,
        suggestedMultiplier: parsed.multiplier,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        keyFactors: parsed.keyFactors,
        duration
      };
    } catch (error) {
      logger.error('[GPT-4] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Build analysis prompt for GPT-4
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

Respond with this JSON structure:

{
  "riskAssessment": <number 0-100>,
  "multiplier": <number 0.7-1.3>,
  "confidence": <number 0-100>,
  "reasoning": "<string>",
  "keyFactors": ["<factor1>", "<factor2>", "<factor3>"]
}`;
  }

  /**
   * Parse GPT-4's JSON response
   */
  private parseResponse(text: string): {
    riskAssessment: number;
    multiplier: number;
    confidence: number;
    reasoning: string;
    keyFactors: string[];
  } {
    try {
      const parsed = JSON.parse(text);

      // Validate and clamp values
      return {
        riskAssessment: Math.max(0, Math.min(100, parsed.riskAssessment || 50)),
        multiplier: Math.max(0.7, Math.min(1.3, parsed.multiplier || 1.0)),
        confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.slice(0, 3) : []
      };
    } catch (error) {
      logger.error('[GPT-4] Failed to parse response:', error);
      logger.debug('[GPT-4] Raw text:', text);

      // Return fallback values
      return {
        riskAssessment: 50,
        multiplier: 1.0,
        confidence: 0,
        reasoning: 'Failed to parse GPT-4 response',
        keyFactors: []
      };
    }
  }
}
