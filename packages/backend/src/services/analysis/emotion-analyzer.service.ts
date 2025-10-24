import { aiService } from '../ai/ai.service.js';
import { logger } from '../../config/logger.js';

export interface EmotionAnalysis {
  primaryEmotion: string;
  emotions: {
    urgency: number;
    fear: number;
    greed: number;
    trust: number;
    excitement: number;
    anxiety: number;
  };
  manipulationTactics: string[];
  sentimentScore: number; // -1 to 1
  psychologicalTriggers: string[];
  riskIndicators: {
    scamPhrases: string[];
    urgencyWords: string[];
    emotionalManipulation: string[];
  };
  overallManipulationScore: number; // 0-100
}

export class EmotionAnalyzer {
  private readonly SCAM_PHRASES = [
    'act now', 'limited time', 'urgent', 'immediate action required',
    'verify account', 'suspended', 'unusual activity', 'confirm identity',
    'claim prize', 'you\'ve won', 'congratulations', 'selected winner',
    'update payment', 'billing problem', 'account locked', 'verify information',
    'click here immediately', 'download now', 'install update', 'security alert'
  ];

  private readonly URGENCY_WORDS = [
    'urgent', 'immediately', 'now', 'hurry', 'quick', 'asap', 'expire',
    'deadline', 'last chance', 'final notice', 'time sensitive', 'act fast'
  ];

  private readonly EMOTIONAL_MANIPULATION = [
    'don\'t miss out', 'exclusive offer', 'only for you', 'special deal',
    'congratulations', 'you deserve', 'limited spots', 'act before it\'s too late',
    'your account will be closed', 'avoid penalties', 'serious consequences'
  ];

  async analyzeText(text: string): Promise<EmotionAnalysis> {
    const textLower = text.toLowerCase();

    // Detect scam phrases
    const scamPhrases = this.SCAM_PHRASES.filter(phrase =>
      textLower.includes(phrase.toLowerCase())
    );

    // Detect urgency words
    const urgencyWords = this.URGENCY_WORDS.filter(word =>
      textLower.includes(word.toLowerCase())
    );

    // Detect emotional manipulation
    const emotionalManipulation = this.EMOTIONAL_MANIPULATION.filter(phrase =>
      textLower.includes(phrase.toLowerCase())
    );

    // Calculate emotion scores
    const emotions = {
      urgency: this.calculateUrgencyScore(text, urgencyWords),
      fear: this.calculateFearScore(text),
      greed: this.calculateGreedScore(text),
      trust: this.calculateTrustScore(text),
      excitement: this.calculateExcitementScore(text),
      anxiety: this.calculateAnxietyScore(text)
    };

    // Identify manipulation tactics
    const manipulationTactics = this.identifyManipulationTactics(text, {
      scamPhrases,
      urgencyWords,
      emotionalManipulation
    });

    // Calculate sentiment
    const sentimentScore = await this.calculateSentiment(text);

    // Identify psychological triggers
    const psychologicalTriggers = this.identifyPsychologicalTriggers(text);

    // Calculate overall manipulation score
    const overallManipulationScore = this.calculateManipulationScore({
      scamPhrases,
      urgencyWords,
      emotionalManipulation,
      emotions
    });

    // Determine primary emotion
    const primaryEmotion = this.getPrimaryEmotion(emotions);

    return {
      primaryEmotion,
      emotions,
      manipulationTactics,
      sentimentScore,
      psychologicalTriggers,
      riskIndicators: {
        scamPhrases,
        urgencyWords,
        emotionalManipulation
      },
      overallManipulationScore
    };
  }

  private calculateUrgencyScore(text: string, urgencyWords: string[]): number {
    let score = 0;

    // Base score from urgency words
    score += urgencyWords.length * 15;

    // Check for time-related pressure
    if (/\d+\s*(hour|minute|day|second)s?/i.test(text)) {
      score += 20;
    }

    // Check for deadline mentions
    if (/deadline|expires?|ending soon/i.test(text)) {
      score += 15;
    }

    // Check for exclamation marks (urgency indicator)
    const exclamations = (text.match(/!/g) || []).length;
    score += Math.min(exclamations * 5, 25);

    return Math.min(score, 100);
  }

  private calculateFearScore(text: string): number {
    let score = 0;
    const textLower = text.toLowerCase();

    const fearWords = [
      'warning', 'alert', 'suspended', 'locked', 'blocked', 'terminated',
      'consequences', 'legal action', 'penalty', 'frozen', 'compromised',
      'hacked', 'unauthorized', 'fraudulent', 'suspicious'
    ];

    fearWords.forEach(word => {
      if (textLower.includes(word)) score += 10;
    });

    // Account closure threats
    if (/account\s+(will be|has been)\s+(closed|terminated|suspended)/i.test(text)) {
      score += 25;
    }

    // Security threats
    if (/security\s+(breach|threat|risk|issue)/i.test(text)) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private calculateGreedScore(text: string): number {
    let score = 0;
    const textLower = text.toLowerCase();

    const greedWords = [
      'free', 'prize', 'won', 'winner', 'reward', 'bonus', 'cash',
      'money', 'profit', 'earn', 'income', 'guarantee', 'exclusive',
      'discount', 'offer', 'deal', 'save'
    ];

    greedWords.forEach(word => {
      if (textLower.includes(word)) score += 8;
    });

    // Money amounts
    if (/\$\d+|\d+\s*(dollar|USD|EUR|GBP)/i.test(text)) {
      score += 15;
    }

    // Percentage discounts
    if (/\d+%\s*off/i.test(text)) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private calculateTrustScore(text: string): number {
    let score = 100; // Start high, reduce for suspicious elements
    const textLower = text.toLowerCase();

    // Reduce for impersonation attempts
    if (/official|verified|trusted|certified|authorized/i.test(text)) {
      score -= 20; // Ironically, claiming trust is suspicious
    }

    // Reduce for fake authority
    if (/(government|bank|IRS|FBI|police)\s+(needs|requires|requests)/i.test(text)) {
      score -= 30;
    }

    // Reduce for spelling errors
    const spellingErrors = this.detectCommonMisspellings(text);
    score -= spellingErrors * 10;

    return Math.max(score, 0);
  }

  private calculateExcitementScore(text: string): number {
    let score = 0;

    // Exclamation marks
    const exclamations = (text.match(/!/g) || []).length;
    score += Math.min(exclamations * 10, 40);

    // ALL CAPS words
    const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
    score += Math.min(capsWords.length * 8, 30);

    // Excitement words
    const excitementWords = ['amazing', 'incredible', 'fantastic', 'awesome', 'unbelievable'];
    excitementWords.forEach(word => {
      if (text.toLowerCase().includes(word)) score += 10;
    });

    return Math.min(score, 100);
  }

  private calculateAnxietyScore(text: string): number {
    return (this.calculateFearScore(text) + this.calculateUrgencyScore(text, [])) / 2;
  }

  private async calculateSentiment(text: string): Promise<number> {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return 0;
      }

      // Use AI for accurate sentiment analysis
      const response = await aiService.query({
        query: `Analyze the sentiment of this text and respond with ONLY a number between -1 (very negative) and 1 (very positive): "${text.substring(0, 1000)}"`,
        model: 'claude',
        useRAG: false
      });

      // Fix: response has 'response' property, not 'text'
      const sentiment = parseFloat(response.response?.trim() || '0');
      return isNaN(sentiment) ? 0 : Math.max(-1, Math.min(1, sentiment));
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);

      // Fallback to basic sentiment
      const positiveWords = ['good', 'great', 'excellent', 'happy', 'wonderful'];
      const negativeWords = ['bad', 'terrible', 'awful', 'poor', 'horrible', 'warning', 'suspended'];

      let score = 0;
      const textLower = text.toLowerCase();

      positiveWords.forEach(word => {
        if (textLower.includes(word)) score += 0.2;
      });

      negativeWords.forEach(word => {
        if (textLower.includes(word)) score -= 0.2;
      });

      return Math.max(-1, Math.min(1, score));
    }
  }

  private identifyManipulationTactics(
    text: string,
    indicators: { scamPhrases: string[]; urgencyWords: string[]; emotionalManipulation: string[] }
  ): string[] {
    const tactics: string[] = [];

    if (indicators.urgencyWords.length > 0) {
      tactics.push('Time Pressure - Creating artificial urgency to prevent careful consideration');
    }

    if (indicators.scamPhrases.length > 0) {
      tactics.push('Common Scam Language - Using known phishing/scam phrases');
    }

    if (indicators.emotionalManipulation.length > 0) {
      tactics.push('Emotional Manipulation - Targeting emotional responses over logical thinking');
    }

    if (/click (here|now|this link)/i.test(text)) {
      tactics.push('Call-to-Action Manipulation - Pressuring immediate action');
    }

    if (/verify|confirm|update|validate/i.test(text)) {
      tactics.push('False Authority - Impersonating legitimate organizations');
    }

    if (/prize|won|selected|winner/i.test(text)) {
      tactics.push('Too Good to Be True - Unrealistic promises or rewards');
    }

    if (/personal information|ssn|social security|credit card|password/i.test(text)) {
      tactics.push('Information Harvesting - Requesting sensitive personal data');
    }

    return tactics;
  }

  private identifyPsychologicalTriggers(text: string): string[] {
    const triggers: string[] = [];
    const textLower = text.toLowerCase();

    if (/urgent|immediately|now|hurry/i.test(text)) {
      triggers.push('Urgency - Bypasses rational decision-making');
    }

    if (/limited|exclusive|only|special/i.test(text)) {
      triggers.push('Scarcity - Fear of missing out (FOMO)');
    }

    if (/warning|alert|suspended|locked/i.test(text)) {
      triggers.push('Fear - Triggers panic and hasty decisions');
    }

    if (/free|prize|win|reward/i.test(text)) {
      triggers.push('Greed - Exploits desire for financial gain');
    }

    if (/trusted|official|verified|certified/i.test(text)) {
      triggers.push('Authority - Fake credibility to gain trust');
    }

    if (/everyone|most people|thousands/i.test(text)) {
      triggers.push('Social Proof - Pressure to conform');
    }

    return triggers;
  }

  private calculateManipulationScore(data: {
    scamPhrases: string[];
    urgencyWords: string[];
    emotionalManipulation: string[];
    emotions: any;
  }): number {
    let score = 0;

    // Scam phrases (most important)
    score += data.scamPhrases.length * 15;

    // Urgency words
    score += data.urgencyWords.length * 10;

    // Emotional manipulation phrases
    score += data.emotionalManipulation.length * 12;

    // High urgency emotion
    if (data.emotions.urgency > 60) score += 20;

    // High fear emotion
    if (data.emotions.fear > 60) score += 20;

    // High greed emotion
    if (data.emotions.greed > 60) score += 15;

    // Low trust score
    if (data.emotions.trust < 40) score += 10;

    return Math.min(score, 100);
  }

  private getPrimaryEmotion(emotions: any): string {
    const entries = Object.entries(emotions) as [string, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][0].charAt(0).toUpperCase() + sorted[0][0].slice(1);
  }

  private detectCommonMisspellings(text: string): number {
    const common = [
      /seperate/i, // should be "separate"
      /recieve/i,  // should be "receive"
      /occured/i,  // should be "occurred"
      /untill/i,   // should be "until"
      /updat$/i,   // missing 'e' in update
    ];

    return common.filter(pattern => pattern.test(text)).length;
  }
}

export const emotionAnalyzer = new EmotionAnalyzer();
