import { logger } from '../../config/logger.js';
import { aiService } from '../ai/ai.service.js';

/**
 * Intent Analyzer Service
 * Analyzes extracted text from screenshots/files to detect:
 * - Romance scams
 * - Fake job offers
 * - Investment fraud
 * - Emotional manipulation
 * - Social engineering tactics
 * - Financial solicitation patterns
 */

export interface IntentAnalysisResult {
  primaryIntent: string; // romance_scam, fake_job, investment_fraud, etc.
  confidence: number; // 0-100
  emotionalManipulation: {
    detected: boolean;
    tactics: string[]; // love_bombing, urgency, sympathy, etc.
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    score: number;
  };
  sentimentAnalysis: {
    overall: 'positive' | 'neutral' | 'negative' | 'manipulative';
    emotionalTone: string[]; // romantic, urgent, fearful, greedy, etc.
    persuasionTactics: string[];
  };
  scamIndicators: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence: string;
  }>;
  financialSolicitation: {
    detected: boolean;
    type: string; // direct_request, investment_pitch, fee_request, etc.
    amount?: string;
    method?: string; // cryptocurrency, wire_transfer, gift_card, etc.
    urgency: 'none' | 'low' | 'medium' | 'high';
  };
  riskScore: number; // 0-100
}

export class IntentAnalyzerService {
  // Romance scam patterns
  private readonly romanceKeywords = [
    'love you', 'miss you', 'baby', 'honey', 'sweetie', 'destiny',
    'soul mate', 'meant to be', 'never felt this way', 'special connection',
    'widower', 'military', 'oil rig', 'engineer overseas'
  ];

  // Fake job scam patterns
  private readonly fakeJobKeywords = [
    'easy money', 'work from home', 'no experience', 'flexible hours',
    'earn \\$\\d+', 'hiring immediately', 'personal assistant',
    'package forwarding', 'data entry', 'guaranteed income',
    'training provided', 'limited positions'
  ];

  // Investment fraud patterns
  private readonly investmentFraudKeywords = [
    'guaranteed returns', 'risk-free', 'double your money',
    'forex', 'crypto trading', 'binary options', 'high yield',
    'investment opportunity', 'insider', 'exclusive', 'limited time',
    'passive income', 'financial freedom'
  ];

  // Emotional manipulation tactics
  private readonly manipulationTactics = [
    { pattern: /(emergency|urgent|immediately|right now|asap)/i, type: 'urgency' },
    { pattern: /(trust me|believe me|i promise|i swear)/i, type: 'trust_appeal' },
    { pattern: /(love|care|feel|heart|soul)/i, type: 'emotional_appeal' },
    { pattern: /(sick|hospital|accident|dying|funeral)/i, type: 'sympathy_play' },
    { pattern: /(opportunity|chance|lucky|fortune|destiny)/i, type: 'fomo' },
    { pattern: /(secret|confidential|dont tell|between us)/i, type: 'secrecy' },
    { pattern: /(family|children|mother|father|sick)/i, type: 'family_manipulation' }
  ];

  // Financial request patterns
  private readonly financialPatterns = [
    { pattern: /send.*?(\$|usd|money|cash|bitcoin|btc)/i, type: 'direct_money_request' },
    { pattern: /(gift card|steam|itunes|amazon card)/i, type: 'gift_card_scam' },
    { pattern: /(wire transfer|western union|moneygram)/i, type: 'wire_transfer' },
    { pattern: /(cryptocurrency|bitcoin|ethereum|wallet address)/i, type: 'crypto_request' },
    { pattern: /(investment|deposit|initial fee|processing fee)/i, type: 'fee_fraud' },
    { pattern: /(\$\d+|\d+\s*dollars|\d+\s*usd)/i, type: 'specific_amount' }
  ];

  /**
   * Analyze intent from extracted text
   */
  async analyzeIntent(text: string): Promise<IntentAnalysisResult> {
    try {
      logger.info('Starting intent analysis...');

      const textLower = text.toLowerCase();

      // Detect emotional manipulation
      const emotionalManipulation = this.detectEmotionalManipulation(text);

      // Detect sentiment and persuasion tactics
      const sentimentAnalysis = this.analyzeSentiment(text);

      // Detect financial solicitation
      const financialSolicitation = this.detectFinancialSolicitation(text);

      // Detect scam type
      const scamIndicators = this.detectScamIndicators(text);

      // Determine primary intent
      const { primaryIntent, confidence } = this.determinePrimaryIntent(
        scamIndicators,
        emotionalManipulation,
        financialSolicitation
      );

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore({
        emotionalManipulation,
        scamIndicators,
        financialSolicitation
      });

      // Use AI for deeper analysis if available
      let aiEnhancedAnalysis;
      try {
        aiEnhancedAnalysis = await this.getAIAnalysis(text, {
          primaryIntent,
          scamIndicators: scamIndicators.slice(0, 3) // Top 3 indicators
        });
      } catch (error) {
        logger.debug('AI analysis skipped:', error);
      }

      return {
        primaryIntent,
        confidence,
        emotionalManipulation,
        sentimentAnalysis,
        scamIndicators,
        financialSolicitation,
        riskScore
      };
    } catch (error) {
      logger.error('Intent analysis error:', error);
      throw error;
    }
  }

  /**
   * Detect emotional manipulation tactics
   */
  private detectEmotionalManipulation(text: string): IntentAnalysisResult['emotionalManipulation'] {
    const tactics: string[] = [];
    let score = 0;

    for (const { pattern, type } of this.manipulationTactics) {
      if (pattern.test(text)) {
        tactics.push(type);
        score += 15;
      }
    }

    // Love bombing detection
    const loveBombingCount = (text.match(/(love|miss|care|beautiful|special|amazing)/gi) || []).length;
    if (loveBombingCount > 5) {
      tactics.push('love_bombing');
      score += 25;
    }

    // Multiple question marks or exclamation marks (urgency)
    if (/[!?]{2,}/.test(text)) {
      tactics.push('excessive_punctuation');
      score += 10;
    }

    const severity = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : score > 0 ? 'low' : 'none';

    return {
      detected: tactics.length > 0,
      tactics,
      severity,
      score
    };
  }

  /**
   * Analyze sentiment and emotional tone
   */
  private analyzeSentiment(text: string): IntentAnalysisResult['sentimentAnalysis'] {
    const emotionalTone: string[] = [];
    const persuasionTactics: string[] = [];

    // Romantic language
    if (/(love|romantic|heart|soul|beautiful|gorgeous)/i.test(text)) {
      emotionalTone.push('romantic');
    }

    // Urgent language
    if (/(urgent|emergency|immediately|hurry|asap)/i.test(text)) {
      emotionalTone.push('urgent');
      persuasionTactics.push('urgency');
    }

    // Fearful/threatening
    if (/(danger|risk|lose|miss out|problem|trouble)/i.test(text)) {
      emotionalTone.push('fearful');
      persuasionTactics.push('fear_appeal');
    }

    // Greedy/opportunistic
    if (/(money|profit|rich|wealthy|earn|investment)/i.test(text)) {
      emotionalTone.push('greedy');
      persuasionTactics.push('financial_incentive');
    }

    // Sympathetic
    if (/(help|please|sick|hospital|need|desperate)/i.test(text)) {
      emotionalTone.push('sympathetic');
      persuasionTactics.push('sympathy_play');
    }

    // Exclusive/FOMO
    if (/(exclusive|limited|special|only you|chosen)/i.test(text)) {
      persuasionTactics.push('exclusivity');
    }

    // Determine overall sentiment
    let overall: IntentAnalysisResult['sentimentAnalysis']['overall'] = 'neutral';
    if (emotionalTone.includes('romantic') && emotionalTone.includes('urgent')) {
      overall = 'manipulative';
    } else if (emotionalTone.length > 2) {
      overall = 'manipulative';
    } else if (emotionalTone.includes('romantic')) {
      overall = 'positive';
    } else if (emotionalTone.includes('fearful')) {
      overall = 'negative';
    }

    return {
      overall,
      emotionalTone,
      persuasionTactics
    };
  }

  /**
   * Detect financial solicitation
   */
  private detectFinancialSolicitation(text: string): IntentAnalysisResult['financialSolicitation'] {
    let detected = false;
    let type = 'none';
    let amount: string | undefined;
    let method: string | undefined;
    let urgency: IntentAnalysisResult['financialSolicitation']['urgency'] = 'none';

    for (const { pattern, type: patternType } of this.financialPatterns) {
      const match = text.match(pattern);
      if (match) {
        detected = true;
        type = patternType;

        // Extract amount if present
        const amountMatch = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (amountMatch) {
          amount = amountMatch[0];
        }

        // Detect method
        if (/bitcoin|btc|ethereum|crypto/i.test(text)) method = 'cryptocurrency';
        else if (/wire|western union|moneygram/i.test(text)) method = 'wire_transfer';
        else if (/gift card|steam|itunes/i.test(text)) method = 'gift_card';
        else if (/paypal|venmo|cashapp/i.test(text)) method = 'payment_app';

        break;
      }
    }

    // Detect urgency
    if (/(urgent|emergency|immediately|today|now)/i.test(text)) {
      urgency = 'high';
    } else if (/(soon|this week|asap)/i.test(text)) {
      urgency = 'medium';
    } else if (/(eventually|sometime|when you can)/i.test(text)) {
      urgency = 'low';
    }

    return {
      detected,
      type,
      amount,
      method,
      urgency
    };
  }

  /**
   * Detect specific scam indicators
   */
  private detectScamIndicators(text: string): IntentAnalysisResult['scamIndicators'] {
    const indicators: IntentAnalysisResult['scamIndicators'] = [];

    // Romance scam indicators
    if (this.romanceKeywords.some(kw => new RegExp(kw, 'i').test(text))) {
      const matches = this.romanceKeywords.filter(kw => new RegExp(kw, 'i').test(text));
      indicators.push({
        type: 'romance_scam',
        description: `Romance scam language detected: ${matches.slice(0, 3).join(', ')}`,
        severity: matches.length > 3 ? 'high' : 'medium',
        evidence: matches.join(', ')
      });
    }

    // Fake job indicators
    if (this.fakeJobKeywords.some(kw => new RegExp(kw, 'i').test(text))) {
      const matches = this.fakeJobKeywords.filter(kw => new RegExp(kw, 'i').test(text));
      indicators.push({
        type: 'fake_job',
        description: `Fake job offer indicators: ${matches.slice(0, 3).join(', ')}`,
        severity: matches.length > 3 ? 'high' : 'medium',
        evidence: matches.join(', ')
      });
    }

    // Investment fraud indicators
    if (this.investmentFraudKeywords.some(kw => new RegExp(kw, 'i').test(text))) {
      const matches = this.investmentFraudKeywords.filter(kw => new RegExp(kw, 'i').test(text));
      indicators.push({
        type: 'investment_fraud',
        description: `Investment fraud pattern: ${matches.slice(0, 3).join(', ')}`,
        severity: 'high',
        evidence: matches.join(', ')
      });
    }

    // Impersonation (claims to be official/authority)
    if (/(government|police|irs|fbi|customs|bank official)/i.test(text)) {
      indicators.push({
        type: 'authority_impersonation',
        description: 'Claims to be authority figure or official',
        severity: 'critical',
        evidence: 'Authority impersonation detected'
      });
    }

    // Advance fee fraud
    if (/(processing fee|clearance fee|tax payment|deposit required)/i.test(text)) {
      indicators.push({
        type: 'advance_fee_fraud',
        description: 'Requests upfront payment for promised service/money',
        severity: 'high',
        evidence: 'Advance fee request detected'
      });
    }

    return indicators;
  }

  /**
   * Determine primary intent from all indicators
   */
  private determinePrimaryIntent(
    scamIndicators: IntentAnalysisResult['scamIndicators'],
    emotionalManipulation: IntentAnalysisResult['emotionalManipulation'],
    financialSolicitation: IntentAnalysisResult['financialSolicitation']
  ): { primaryIntent: string; confidence: number } {
    if (scamIndicators.length === 0) {
      return { primaryIntent: 'unknown', confidence: 0 };
    }

    // Find highest severity indicator
    const criticalIndicators = scamIndicators.filter(i => i.severity === 'critical');
    const highIndicators = scamIndicators.filter(i => i.severity === 'high');

    let primaryIntent = 'general_scam';
    let confidence = 50;

    if (criticalIndicators.length > 0) {
      primaryIntent = criticalIndicators[0].type;
      confidence = 95;
    } else if (highIndicators.length > 0) {
      primaryIntent = highIndicators[0].type;
      confidence = 80;
    } else if (scamIndicators.length > 0) {
      primaryIntent = scamIndicators[0].type;
      confidence = 60;
    }

    // Boost confidence if multiple indicators align
    if (emotionalManipulation.detected && financialSolicitation.detected) {
      confidence = Math.min(100, confidence + 15);
    }

    return { primaryIntent, confidence };
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(data: {
    emotionalManipulation: IntentAnalysisResult['emotionalManipulation'];
    scamIndicators: IntentAnalysisResult['scamIndicators'];
    financialSolicitation: IntentAnalysisResult['financialSolicitation'];
  }): number {
    let score = 0;

    // Emotional manipulation score
    score += data.emotionalManipulation.score;

    // Scam indicators score
    for (const indicator of data.scamIndicators) {
      if (indicator.severity === 'critical') score += 30;
      else if (indicator.severity === 'high') score += 20;
      else if (indicator.severity === 'medium') score += 10;
      else score += 5;
    }

    // Financial solicitation score
    if (data.financialSolicitation.detected) {
      score += 25;
      if (data.financialSolicitation.urgency === 'high') score += 15;
      else if (data.financialSolicitation.urgency === 'medium') score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Get AI-enhanced analysis using Claude
   */
  private async getAIAnalysis(text: string, context: any): Promise<any> {
    const prompt = `Analyze this text for scam intent. Context: ${JSON.stringify(context)}

Text:
${text.substring(0, 2000)}

Provide:
1. Scam type classification
2. Confidence level (0-100)
3. Key red flags
4. Manipulation tactics used`;

    const response = await aiService.query({
      query: prompt,
      useRAG: false,
      model: 'claude'
    });

    return response;
  }
}

export const intentAnalyzerService = new IntentAnalyzerService();
