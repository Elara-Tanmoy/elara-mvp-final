import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { chromaClient } from '../../config/chromadb.js';
import { logger } from '../../config/logger.js';

export interface AIQueryOptions {
  query: string;
  useRAG?: boolean;
  model?: 'claude' | 'gpt4' | 'gemini';
  context?: any;
}

export interface AIResponse {
  response: string;
  model: string;
  ragResults?: any[];
  confidence?: number;
}

class AIService {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private datasetsCollection: any;
  private threatsCollection: any;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    this.initializeCollections();
  }

  private async initializeCollections() {
    try {
      this.datasetsCollection = await chromaClient.getOrCreateCollection({
        name: 'elara_datasets'
      });

      this.threatsCollection = await chromaClient.getOrCreateCollection({
        name: 'elara_threats'
      });

      logger.info('AI service collections initialized');
    } catch (error) {
      logger.error('Failed to initialize AI service collections:', error);
    }
  }

  async query(options: AIQueryOptions): Promise<AIResponse> {
    const { query, useRAG = true, model = 'claude', context } = options;

    try {
      let ragContext = '';
      let ragResults: any[] = [];

      if (useRAG) {
        const vectorResults = await this.performRAGQuery(query);
        ragResults = vectorResults;

        if (vectorResults.length > 0) {
          ragContext = this.formatRAGContext(vectorResults);
        }
      }

      const prompt = this.buildPrompt(query, ragContext, context);

      let response: AIResponse;

      if (model === 'claude') {
        response = await this.queryClaude(prompt);
      } else if (model === 'gpt4') {
        response = await this.queryGPT4(prompt);
      } else {
        response = await this.queryGemini(prompt);
      }

      if (ragResults.length > 0) {
        response.ragResults = ragResults;
      }

      return response;
    } catch (error) {
      logger.error('AI query error:', error);
      throw error;
    }
  }

  async queryConfiguredModel(modelConfig: any, prompt: string): Promise<AIResponse> {
    const { provider, modelId, apiKey } = modelConfig;

    switch (provider.toLowerCase()) {
      case 'anthropic':
        return this.queryClaude(prompt, modelId, apiKey);
      case 'openai':
        return this.queryGPT4(prompt, modelId, apiKey);
      case 'google':
        return this.queryGemini(prompt, modelId, apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  async analyzeThreat(scanResult: any): Promise<any> {
    try {
      const prompt = `Analyze the following threat scan result and provide:
1. A clear explanation of the identified threats
2. Risk justification based on the findings
3. Detailed recommendations for mitigation
4. Assessment of the overall severity

Scan Result:
Type: ${scanResult.scanType}
Risk Score: ${scanResult.riskScore}/350
Risk Level: ${scanResult.riskLevel}

Findings:
${JSON.stringify(scanResult.findings, null, 2)}

Categories:
${JSON.stringify(scanResult.categories, null, 2)}

Provide a comprehensive analysis in a structured format.`;

      const response = await this.queryClaude(prompt);

      return {
        explanation: this.extractSection(response.response, 'explanation'),
        justification: this.extractSection(response.response, 'justification'),
        recommendations: this.extractSection(response.response, 'recommendations'),
        severity: this.extractSection(response.response, 'severity'),
        fullAnalysis: response.response
      };
    } catch (error) {
      logger.error('Threat analysis error:', error);
      return {
        explanation: 'AI analysis temporarily unavailable',
        justification: 'Based on automated threat detection algorithms',
        recommendations: ['Review the scan findings manually', 'Contact security team if needed'],
        severity: scanResult.riskLevel
      };
    }
  }

  private async performRAGQuery(query: string): Promise<any[]> {
    try {
      if (!this.datasetsCollection) {
        return [];
      }

      const results = await this.datasetsCollection.query({
        queryTexts: [query],
        nResults: 5
      });

      if (results.documents && results.documents[0]) {
        return results.documents[0].map((doc: any, idx: number) => ({
          content: doc,
          distance: results.distances?.[0]?.[idx] || 0,
          metadata: results.metadatas?.[0]?.[idx] || {}
        }));
      }

      return [];
    } catch (error) {
      logger.error('RAG query error:', error);
      return [];
    }
  }

  private formatRAGContext(results: any[]): string {
    if (results.length === 0) return '';

    let context = '\n\nRelevant context from threat intelligence database:\n';

    results.forEach((result, idx) => {
      context += `\n${idx + 1}. ${result.content}`;
      if (result.metadata) {
        context += ` (Source: ${result.metadata.source || 'Unknown'})`;
      }
    });

    return context;
  }

  private buildPrompt(query: string, ragContext: string, additionalContext?: any): string {
    let prompt = `You are an expert cybersecurity analyst for Elara, an enterprise threat detection platform. `;

    if (ragContext) {
      prompt += `Use the following threat intelligence data to inform your response:${ragContext}\n\n`;
    }

    if (additionalContext) {
      prompt += `Additional context:\n${JSON.stringify(additionalContext, null, 2)}\n\n`;
    }

    prompt += `User query: ${query}\n\n`;
    prompt += `Provide a detailed, accurate, and actionable response.`;

    return prompt;
  }

  private async queryClaude(prompt: string, modelId = 'claude-sonnet-4-20250514', apiKey?: string): Promise<AIResponse> {
    try {
      const anthropic = apiKey ? new Anthropic({ apiKey }) : this.anthropic;
      const message = await anthropic.messages.create({
        model: modelId,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      return {
        response: responseText,
        model: modelId,
        confidence: 0.95
      };
    } catch (error) {
      logger.error('Claude API error:', error);

      logger.info('Falling back to GPT-4...');
      return this.queryGPT4(prompt);
    }
  }

  private async queryGPT4(prompt: string, modelId = 'gpt-4-turbo-preview', apiKey?: string): Promise<AIResponse> {
    try {
      const openai = apiKey ? new OpenAI({ apiKey }) : this.openai;
      const completion = await openai.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: 'You are an expert cybersecurity analyst specializing in threat detection and analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.7
      });

      return {
        response: completion.choices[0]?.message?.content || '',
        model: modelId,
        confidence: 0.90
      };
    } catch (error) {
      logger.error('GPT-4 API error:', error);
      throw new Error('All AI services unavailable');
    }
  }

  private async queryGemini(prompt: string, modelId = 'gemini-2.5-flash', apiKey?: string): Promise<AIResponse> {
    try {
      const key = apiKey || process.env.GOOGLE_AI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }],
              role: 'user'
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        response: text,
        model: modelId,
        confidence: 0.90
      };
    } catch (error) {
      logger.error('Gemini query error:', error);
      // Fallback to GPT-4
      logger.info('Falling back to GPT-4...');
      return this.queryGPT4(prompt);
    }
  }

  private extractSection(text: string, section: string): any {
    const sectionMap: Record<string, string> = {
      explanation: 'explanation|overview|summary',
      justification: 'justification|reasoning|rationale',
      recommendations: 'recommendations|mitigation|actions',
      severity: 'severity|assessment|level'
    };

    const pattern = sectionMap[section];
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})[:\s]+([^\n]+(?:\n(?!\d+\.|[A-Z][a-z]+:)[^\n]+)*)`, 'i');
    const match = text.match(regex);

    if (match && match[2]) {
      return match[2].trim();
    }

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (new RegExp(pattern, 'i').test(lines[i])) {
        return lines.slice(i + 1, i + 5).join('\n').trim();
      }
    }

    return section === 'recommendations' ? [] : text.substring(0, 200);
  }

  async vectorizeContent(content: string, metadata: any = {}): Promise<string> {
    try {
      if (!this.datasetsCollection) {
        throw new Error('Datasets collection not initialized');
      }

      const id = `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.datasetsCollection.add({
        ids: [id],
        documents: [content],
        metadatas: [metadata]
      });

      logger.info(`Content vectorized with ID: ${id}`);
      return id;
    } catch (error) {
      logger.error('Vectorization error:', error);
      throw error;
    }
  }

  async vectorizeDataset(entries: Array<{ content: string; metadata: any }>): Promise<string[]> {
    try {
      if (!this.datasetsCollection) {
        throw new Error('Datasets collection not initialized');
      }

      const ids = entries.map(() =>
        `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );
      const documents = entries.map(e => e.content);
      const metadatas = entries.map(e => e.metadata);

      await this.datasetsCollection.add({
        ids,
        documents,
        metadatas
      });

      logger.info(`Vectorized ${entries.length} dataset entries`);
      return ids;
    } catch (error) {
      logger.error('Dataset vectorization error:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();
export default aiService;