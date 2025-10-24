import { logger } from '../../config/logger.js';

/**
 * Content Analyzer Service
 * Analyzes post content for suspicious patterns, keywords, and scam indicators
 */

export interface ContentAnalysisResult {
  suspiciousKeywords: string[];
  suspiciousKeywordCount: number;
  financialTerms: string[];
  urgencyPhrases: string[];
  externalLinks: string[];
  externalLinkCount: number;
  callToActionCount: number;
  patternMatches: {
    financialScam: number;
    urgencyTactics: number;
    poorGrammar: number;
    excessiveEmojis: number;
    allCaps: number;
  };
  riskScore: number;
  summary: string;
}

export class ContentAnalyzerService {
  // Suspicious keywords dictionary
  private readonly FINANCIAL_SCAM_KEYWORDS = [
    'investment opportunity',
    'guaranteed returns',
    'make money fast',
    'earn from home',
    'financial freedom',
    'passive income',
    'get rich',
    'double your money',
    'risk free',
    'limited spots',
    'act now',
    'wire transfer',
    'send money',
    'bitcoin investment',
    'crypto profit',
    'trading signals',
    'forex trading',
    'binary options',
    'pyramid scheme',
    'multi-level marketing',
    'mlm',
    'network marketing',
    'be your own boss'
  ];

  private readonly URGENCY_PHRASES = [
    'urgent',
    'hurry',
    'limited time',
    'expires soon',
    'act now',
    'dont miss',
    'last chance',
    'only today',
    'right now',
    'immediate',
    'asap',
    'time sensitive',
    'before its too late',
    'going fast',
    'selling out'
  ];

  private readonly CALL_TO_ACTION_PHRASES = [
    'click here',
    'dm me',
    'send message',
    'contact me',
    'whatsapp me',
    'email me',
    'call me',
    'text me',
    'inbox me',
    'link in bio',
    'swipe up',
    'tap link',
    'follow link',
    'visit site'
  ];

  /**
   * Analyze content from posts
   */
  analyzeContent(posts: Array<{ content: string; likes?: number; comments?: number }>): ContentAnalysisResult {
    try {
      logger.info(`[Content Analyzer] Analyzing ${posts.length} posts`);

      const allContent = posts.map(p => p.content).join(' ').toLowerCase();

      // Find suspicious keywords
      const suspiciousKeywords: string[] = [];
      this.FINANCIAL_SCAM_KEYWORDS.forEach(keyword => {
        if (allContent.includes(keyword.toLowerCase())) {
          suspiciousKeywords.push(keyword);
        }
      });

      // Find urgency phrases
      const urgencyPhrases: string[] = [];
      this.URGENCY_PHRASES.forEach(phrase => {
        if (allContent.includes(phrase.toLowerCase())) {
          urgencyPhrases.push(phrase);
        }
      });

      // Extract external links
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const externalLinks: string[] = [];
      posts.forEach(post => {
        const matches = post.content.match(urlRegex);
        if (matches) {
          externalLinks.push(...matches);
        }
      });

      // Count call-to-action phrases
      let callToActionCount = 0;
      this.CALL_TO_ACTION_PHRASES.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/\s/g, '\\s*'), 'gi');
        const matches = allContent.match(regex);
        if (matches) {
          callToActionCount += matches.length;
        }
      });

      // Extract financial terms
      const financialTerms: string[] = [];
      const financialKeywords = ['investment', 'profit', 'earnings', 'income', 'money', 'bitcoin', 'crypto', 'trading'];
      financialKeywords.forEach(term => {
        const regex = new RegExp(`\\b${term}\\w*\\b`, 'gi');
        const matches = allContent.match(regex);
        if (matches) {
          financialTerms.push(...matches.slice(0, 5)); // Limit to 5 per term
        }
      });

      // Pattern analysis
      const patternMatches = {
        financialScam: this.scoreFinancialScamPattern(allContent),
        urgencyTactics: urgencyPhrases.length,
        poorGrammar: this.detectPoorGrammar(allContent),
        excessiveEmojis: this.countEmojis(allContent),
        allCaps: this.countAllCapsWords(allContent)
      };

      // Calculate content risk score (0-100)
      let riskScore = 0;

      // Suspicious keywords (max 30 points)
      riskScore += Math.min(suspiciousKeywords.length * 3, 30);

      // Urgency tactics (max 20 points)
      riskScore += Math.min(urgencyPhrases.length * 4, 20);

      // External links (max 15 points)
      const linkRatio = externalLinks.length / Math.max(posts.length, 1);
      if (linkRatio > 0.8) riskScore += 15;
      else if (linkRatio > 0.5) riskScore += 10;
      else if (linkRatio > 0.3) riskScore += 5;

      // Call-to-action spam (max 15 points)
      riskScore += Math.min(callToActionCount * 2, 15);

      // Poor grammar (max 10 points)
      riskScore += Math.min(patternMatches.poorGrammar, 10);

      // Excessive emojis (max 10 points)
      if (patternMatches.excessiveEmojis > 50) riskScore += 10;
      else if (patternMatches.excessiveEmojis > 30) riskScore += 7;
      else if (patternMatches.excessiveEmojis > 15) riskScore += 4;

      riskScore = Math.min(riskScore, 100);

      // Generate summary
      let summary = '';
      if (riskScore < 20) {
        summary = 'Content appears normal with no major red flags';
      } else if (riskScore < 40) {
        summary = 'Some promotional content detected, minor concerns';
      } else if (riskScore < 60) {
        summary = 'Multiple suspicious patterns found - potential scam indicators';
      } else {
        summary = 'High-risk content with strong scam/spam indicators';
      }

      logger.info(`[Content Analyzer] Risk score: ${riskScore}/100`);

      return {
        suspiciousKeywords: [...new Set(suspiciousKeywords)],
        suspiciousKeywordCount: suspiciousKeywords.length,
        financialTerms: [...new Set(financialTerms)].slice(0, 10),
        urgencyPhrases: [...new Set(urgencyPhrases)],
        externalLinks: [...new Set(externalLinks)].slice(0, 20),
        externalLinkCount: externalLinks.length,
        callToActionCount,
        patternMatches,
        riskScore,
        summary
      };
    } catch (error) {
      logger.error('[Content Analyzer] Error:', error);
      return {
        suspiciousKeywords: [],
        suspiciousKeywordCount: 0,
        financialTerms: [],
        urgencyPhrases: [],
        externalLinks: [],
        externalLinkCount: 0,
        callToActionCount: 0,
        patternMatches: {
          financialScam: 0,
          urgencyTactics: 0,
          poorGrammar: 0,
          excessiveEmojis: 0,
          allCaps: 0
        },
        riskScore: 0,
        summary: 'Unable to analyze content'
      };
    }
  }

  /**
   * Score financial scam pattern (0-100)
   */
  private scoreFinancialScamPattern(text: string): number {
    let score = 0;

    // Check for common scam combinations
    if (text.includes('guaranteed') && text.includes('profit')) score += 20;
    if (text.includes('investment') && text.includes('risk free')) score += 25;
    if (text.includes('make money') && text.includes('fast')) score += 15;
    if (text.includes('crypto') && text.includes('double')) score += 20;
    if (text.includes('passive income') && text.includes('easy')) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Detect poor grammar indicators
   */
  private detectPoorGrammar(text: string): number {
    let score = 0;

    // Multiple exclamation marks
    const multiExclaim = (text.match(/!{2,}/g) || []).length;
    score += multiExclaim * 2;

    // Multiple question marks
    const multiQuestion = (text.match(/\?{2,}/g) || []).length;
    score += multiQuestion * 2;

    // Excessive punctuation
    const excessivePunct = (text.match(/[!?.]{4,}/g) || []).length;
    score += excessivePunct * 3;

    // Common typos/errors (simplified check)
    const commonErrors = ['recieve', 'occured', 'untill', 'thier', 'freind'];
    commonErrors.forEach(error => {
      if (text.includes(error)) score += 3;
    });

    return score;
  }

  /**
   * Count emojis in text
   */
  private countEmojis(text: string): number {
    // Unicode emoji ranges (simplified)
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.length : 0;
  }

  /**
   * Count words in ALL CAPS
   */
  private countAllCapsWords(text: string): number {
    const words = text.split(/\s+/);
    let capsCount = 0;

    words.forEach(word => {
      // Remove punctuation
      const cleaned = word.replace(/[^a-zA-Z]/g, '');
      // Check if all uppercase and at least 3 letters
      if (cleaned.length >= 3 && cleaned === cleaned.toUpperCase()) {
        capsCount++;
      }
    });

    return capsCount;
  }
}

export const contentAnalyzerService = new ContentAnalyzerService();
