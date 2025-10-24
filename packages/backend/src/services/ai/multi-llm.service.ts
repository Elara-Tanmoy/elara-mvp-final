import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../config/logger.js';

interface LLMResponse {
  model: string;
  response: string;
  confidence: number;
  processingTime: number;
  error?: string;
}

interface MultiLLMAnalysis {
  claude?: LLMResponse;
  gpt4?: LLMResponse;
  gemini?: LLMResponse;
  consensus: {
    agreement: number;
    verdict: string;
    summary: string;
  };
}

export class MultiLLMService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    // Initialize Claude
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Initialize Gemini
    if (process.env.GOOGLE_AI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
  }

  /**
   * Query all available LLMs in parallel for URL analysis
   * FAST FALLBACK: 5 second total timeout, individual LLMs have 4s each
   */
  async analyzeURL(scanData: {
    url: string;
    domainInfo: any;
    sslInfo: any;
    threatIntel: any;
    contentAnalysis: any;
    networkInfo: any;
  }): Promise<MultiLLMAnalysis> {
    const prompt = this.buildURLAnalysisPrompt(scanData);

    // Add timeout wrapper to prevent hanging - reduced to 5 seconds
    const results = await Promise.race([
      Promise.allSettled([
        this.queryClaude(prompt, 'url-analysis'),
        this.queryGPT4(prompt, 'url-analysis'),
        this.queryGemini(prompt, 'url-analysis')
      ]),
      new Promise<any[]>((resolve) => setTimeout(() => {
        logger.warn('⚠️ Multi-LLM timeout after 5 seconds - fast fallback');
        resolve([
          { status: 'rejected', reason: 'Timeout' },
          { status: 'rejected', reason: 'Timeout' },
          { status: 'rejected', reason: 'Timeout' }
        ]);
      }, 5000)) // 5 second total timeout for fast user experience
    ]);

    return this.aggregateResults(results);
  }

  /**
   * Query all available LLMs in parallel for message analysis
   */
  async analyzeMessage(messageData: {
    content: string;
    sender?: string;
    subject?: string;
    extractedUrls: string[];
    extractedEmails: string[];
    phishingIndicators: any;
  }): Promise<MultiLLMAnalysis> {
    const prompt = this.buildMessageAnalysisPrompt(messageData);

    const results = await Promise.allSettled([
      this.queryClaude(prompt, 'message-analysis'),
      this.queryGPT4(prompt, 'message-analysis'),
      this.queryGemini(prompt, 'message-analysis')
    ]);

    return this.aggregateResults(results);
  }

  /**
   * Query all available LLMs for conversation chain analysis from screenshot
   */
  async analyzeConversation(conversationData: {
    messages: Array<{
      timestamp: string;
      sender: string;
      content: string;
    }>;
    platform: string;
    participants: any;
    metadata: any;
  }): Promise<MultiLLMAnalysis> {
    const prompt = this.buildConversationAnalysisPrompt(conversationData);

    const results = await Promise.allSettled([
      this.queryClaude(prompt, 'conversation-analysis'),
      this.queryGPT4(prompt, 'conversation-analysis'),
      this.queryGemini(prompt, 'conversation-analysis')
    ]);

    return this.aggregateResults(results);
  }

  /**
   * Query Claude Sonnet 4.5 with 4-second timeout (FAST FALLBACK)
   */
  private async queryClaude(prompt: string, context: string): Promise<LLMResponse> {
    const startTime = Date.now();

    if (!this.anthropic) {
      return {
        model: 'Claude Sonnet 4.5',
        response: 'Claude API not configured',
        confidence: 0,
        processingTime: 0,
        error: 'API key not provided'
      };
    }

    try {
      // Add individual 4-second timeout for this LLM
      const response = await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048, // Reduced for faster response
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: prompt
          }]
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Claude timeout after 4s')), 4000)
        )
      ]);

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';
      const confidence = this.extractConfidence(responseText);

      return {
        model: 'Claude Sonnet 4.5',
        response: responseText,
        confidence,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.warn(`Claude query failed after ${Date.now() - startTime}ms:`, error.message);
      return {
        model: 'Claude Sonnet 4.5',
        response: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Query GPT-4 with 4-second timeout (FAST FALLBACK)
   */
  private async queryGPT4(prompt: string, context: string): Promise<LLMResponse> {
    const startTime = Date.now();

    if (!this.openai) {
      return {
        model: 'GPT-4',
        response: 'OpenAI API not configured',
        confidence: 0,
        processingTime: 0,
        error: 'API key not provided'
      };
    }

    try {
      // Add individual 4-second timeout for this LLM
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [{
            role: 'system',
            content: 'You are a cybersecurity expert analyzing potential threats. Provide detailed, accurate analysis with confidence scores.'
          }, {
            role: 'user',
            content: prompt
          }],
          temperature: 0.3,
          max_tokens: 2048 // Reduced for faster response
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPT-4 timeout after 4s')), 4000)
        )
      ]);

      const responseText = response.choices[0]?.message?.content || '';
      const confidence = this.extractConfidence(responseText);

      return {
        model: 'GPT-4',
        response: responseText,
        confidence,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.warn(`GPT-4 query failed after ${Date.now() - startTime}ms:`, error.message);
      return {
        model: 'GPT-4',
        response: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Query Google Gemini with 4-second timeout (FAST FALLBACK)
   */
  private async queryGemini(prompt: string, context: string): Promise<LLMResponse> {
    const startTime = Date.now();

    if (!this.gemini) {
      return {
        model: 'Gemini Pro',
        response: 'Google AI API not configured',
        confidence: 0,
        processingTime: 0,
        error: 'API key not provided'
      };
    }

    try {
      // Use Gemini 2.5 Pro with 4-second timeout
      const model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const result = await Promise.race([
        (async () => {
          const res = await model.generateContent(prompt);
          const response = await res.response;
          return response.text();
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini timeout after 4s')), 4000)
        )
      ]);

      const confidence = this.extractConfidence(result);

      return {
        model: 'Gemini 2.5 Pro',
        response: result,
        confidence,
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.warn(`Gemini query failed after ${Date.now() - startTime}ms:`, error.message);
      return {
        model: 'Gemini 2.5 Pro',
        response: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Build comprehensive URL analysis prompt
   */
  private buildURLAnalysisPrompt(scanData: any): string {
    return `Analyze this URL scan data and explain threats in detail. Provide risk assessment, attack vectors, and recommendations.

URL: ${scanData.url}

DOMAIN INFORMATION:
${JSON.stringify(scanData.domainInfo, null, 2)}

SSL/TLS INFORMATION:
${JSON.stringify(scanData.sslInfo, null, 2)}

THREAT INTELLIGENCE:
${JSON.stringify(scanData.threatIntel, null, 2)}

CONTENT ANALYSIS:
${JSON.stringify(scanData.contentAnalysis, null, 2)}

NETWORK INFORMATION:
${JSON.stringify(scanData.networkInfo, null, 2)}

Provide your analysis in the following format:

**Risk Assessment:** [Overall risk level and score out of 100]

**Attack Vectors:** [Detailed explanation of how this could be used to attack users]

**Threat Classification:** [Type of threat - phishing, malware, social engineering, etc.]

**Key Evidence:** [Specific indicators that support your assessment]

**Sophistication Level:** [Low/Medium/High with explanation]

**Target Audience:** [Who would likely be targeted by this]

**Recommendations:** [Specific actions users should take]

**Confidence:** [Your confidence in this assessment as a percentage]

Be thorough, technical where appropriate, and provide actionable insights.`;
  }

  /**
   * Build message analysis prompt
   */
  private buildMessageAnalysisPrompt(messageData: any): string {
    return `Analyze this message for phishing, social engineering, and malicious content. Explain your reasoning in detail.

MESSAGE CONTENT:
${messageData.content}

${messageData.sender ? `SENDER: ${messageData.sender}` : ''}
${messageData.subject ? `SUBJECT: ${messageData.subject}` : ''}

EXTRACTED URLS: ${messageData.extractedUrls.join(', ') || 'None'}
EXTRACTED EMAILS: ${messageData.extractedEmails.join(', ') || 'None'}

PHISHING INDICATORS DETECTED:
${JSON.stringify(messageData.phishingIndicators, null, 2)}

Analyze this message for:
1. Phishing indicators
2. Social engineering tactics
3. Emotional manipulation
4. Urgency pressure
5. Authority exploitation
6. Financial fraud attempts
7. Identity theft risks
8. Legitimacy assessment

Provide your analysis in this format:

**Verdict:** [LEGITIMATE / SUSPICIOUS / PHISHING / SCAM]

**Scam Type:** [If malicious, specify the type]

**Confidence:** [Percentage 0-100]

**Key Evidence:** [Specific phrases or patterns that reveal intent]

**Emotional Manipulation Tactics:** [How the message manipulates emotions]

**Attack Strategy:** [What the attacker is trying to achieve]

**Risk Level:** [LOW / MEDIUM / HIGH / CRITICAL]

**Recommendations:** [What the recipient should do]

Be specific and cite exact phrases from the message as evidence.`;
  }

  /**
   * Build conversation chain analysis prompt
   */
  private buildConversationAnalysisPrompt(conversationData: any): string {
    const conversationText = conversationData.messages
      .map(m => `[${m.timestamp}] ${m.sender}: ${m.content}`)
      .join('\n');

    return `Analyze this conversation chain extracted from a screenshot to determine if this is a scam, spam, or suspicious activity.

PLATFORM: ${conversationData.platform}

PARTICIPANTS:
${JSON.stringify(conversationData.participants, null, 2)}

CONVERSATION:
${conversationText}

METADATA:
${JSON.stringify(conversationData.metadata, null, 2)}

Analyze by evaluating:

**CONVERSATION PROGRESSION:**
- How did the conversation start?
- What is the relationship claimed?
- How does it evolve over time?

**EMOTIONAL MANIPULATION TACTICS:**
- Building false trust/rapport
- Creating urgency
- Exploiting emotions (fear, greed, sympathy, romance)
- Love bombing or excessive flattery
- Guilt tripping

**RED FLAGS:**
- Unsolicited contact
- Too-good-to-be-true offers
- Requests for money/gift cards/cryptocurrency
- Asking to move conversation off-platform
- Avoiding video calls
- Inconsistent story details
- Pressure to act quickly
- Requests for personal/financial information

**SOCIAL ENGINEERING PATTERNS:**
- Authority (impersonating official, police, IRS)
- Intimacy (romance scams, fake relationships)
- Reciprocity (offering help first, then asking for favor)
- Scarcity (limited time offers)
- Social proof (claiming others have done it)

**LINGUISTIC ANALYSIS:**
- Grammar/spelling quality vs claimed background
- Use of copy-pasted scripts
- Generic responses vs personalized
- Inconsistent language style

**BEHAVIORAL RED FLAGS:**
- Avoids answering direct questions
- Changes subject when pressed
- Provides excuses for unusual requests
- Creates crises requiring immediate action

Provide detailed analysis in this format:

**Scam Likelihood:** [0-100%]

**Scam Type:** [Romance/Investment/Tech Support/Advance Fee/Impersonation/etc or LEGITIMATE]

**Confidence:** [Percentage 0-100]

**Key Evidence:** [Specific messages showing manipulation with timestamps]

**Progression Timeline:** [How the scam evolved day by day]

**Predicted Next Steps:** [What scammer will likely ask for next if this continues]

**Manipulation Tactics Used:** [List all tactics identified]

**Verdict:** [LEGITIMATE / SUSPICIOUS / CONFIRMED SCAM]

**Advice:** [Detailed recommendations for what user should do]

Be thorough and cite specific messages as evidence for your conclusions.`;
  }

  /**
   * Extract confidence score from LLM response
   */
  private extractConfidence(response: string): number {
    // Look for confidence patterns like "95%", "Confidence: 90", etc.
    const patterns = [
      /confidence:?\s*(\d+)%?/i,
      /(\d+)%\s*confidence/i,
      /certainty:?\s*(\d+)%?/i
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        const confidence = parseInt(match[1]);
        if (confidence >= 0 && confidence <= 100) {
          return confidence;
        }
      }
    }

    // Default confidence based on response length and detail
    return response.length > 500 ? 75 : 60;
  }

  /**
   * Aggregate results from multiple LLMs
   */
  private aggregateResults(results: PromiseSettledResult<LLMResponse>[]): MultiLLMAnalysis {
    const analysis: MultiLLMAnalysis = {
      consensus: {
        agreement: 0,
        verdict: 'UNKNOWN',
        summary: ''
      }
    };

    const successfulResponses: LLMResponse[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const response = result.value;

        // Only add to successful responses if there's no error
        if (!response.error) {
          successfulResponses.push(response);
        }

        if (index === 0) analysis.claude = response;
        else if (index === 1) analysis.gpt4 = response;
        else if (index === 2) analysis.gemini = response;
      }
    });

    // Calculate consensus
    if (successfulResponses.length > 0) {
      // Extract verdicts
      const verdicts = successfulResponses.map(r => this.extractVerdict(r.response)).filter(Boolean);
      const mostCommonVerdict = this.getMostCommonVerdict(verdicts);

      // Calculate agreement as percentage of models that agree with the majority verdict
      const agreementCount = verdicts.filter(v => v === mostCommonVerdict).length;
      const agreementPercentage = verdicts.length > 0
        ? Math.round((agreementCount / verdicts.length) * 100)
        : 0;

      analysis.consensus.agreement = agreementPercentage;
      analysis.consensus.verdict = mostCommonVerdict;
      analysis.consensus.summary = this.generateConsensusSummary(successfulResponses, verdicts);
    }

    return analysis;
  }

  /**
   * Extract verdict from response
   */
  private extractVerdict(response: string): string {
    // Look for explicit verdict statement first
    const verdictPatterns = [
      /\*\*Verdict:\*\*\s*(legitimate|suspicious|phishing|scam|malicious|safe|clean)/i,
      /verdict:?\s*(legitimate|suspicious|phishing|scam|malicious|safe|clean)/i,
      /overall\s+assessment:?\s*(legitimate|suspicious|phishing|scam|malicious|safe|clean)/i,
      /risk\s+level:?\s*(legitimate|suspicious|phishing|scam|malicious|safe|clean|low|medium|high|critical)/i,
    ];

    for (const pattern of verdictPatterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        const verdict = match[1].toUpperCase();
        // Map risk levels to verdicts
        if (verdict === 'LOW') return 'SAFE';
        if (verdict === 'MEDIUM') return 'SUSPICIOUS';
        if (verdict === 'HIGH' || verdict === 'CRITICAL') return 'MALICIOUS';
        if (verdict === 'CLEAN') return 'SAFE';
        return verdict;
      }
    }

    // Fallback: look for first occurrence of key terms
    const keyTerms = ['MALICIOUS', 'PHISHING', 'SCAM', 'SUSPICIOUS', 'LEGITIMATE', 'SAFE'];
    for (const term of keyTerms) {
      if (response.toUpperCase().includes(term)) {
        return term;
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Get most common verdict
   */
  private getMostCommonVerdict(verdicts: string[]): string {
    if (verdicts.length === 0) return 'UNKNOWN';

    const counts: { [key: string]: number } = {};
    verdicts.forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
    });

    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
  }

  /**
   * Generate consensus summary
   */
  private generateConsensusSummary(responses: LLMResponse[], verdicts: string[]): string {
    const modelsAgreeing = verdicts.filter((v, i, arr) => arr.indexOf(v) === i).length === 1;
    const verdict = this.getMostCommonVerdict(verdicts);
    const activeModels = responses.filter(r => !r.error).length;

    if (modelsAgreeing && activeModels > 0) {
      return `All ${activeModels} AI model${activeModels > 1 ? 's' : ''} agree: ${verdict}`;
    } else if (activeModels > 0) {
      const verdictCounts: { [key: string]: number } = {};
      verdicts.forEach(v => verdictCounts[v] = (verdictCounts[v] || 0) + 1);
      const breakdown = Object.entries(verdictCounts)
        .sort(([, a], [, b]) => b - a) // Sort by count descending
        .map(([v, count]) => `${count} model${count > 1 ? 's' : ''}: ${v}`)
        .join(', ');
      return `Mixed consensus (${activeModels} models analyzed) - ${breakdown}`;
    } else {
      return 'No AI models available for analysis';
    }
  }
}

export const multiLLMService = new MultiLLMService();
