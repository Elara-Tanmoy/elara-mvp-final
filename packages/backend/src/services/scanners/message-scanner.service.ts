/**
 * Enhanced Message Scanner with Multi-LLM Analysis and Phishing Detection
 *
 * PHASE 1 (IMPLEMENTED):
 * - Multi-AI consensus analysis (Claude, GPT-4, Gemini)
 * - Enhanced emotional manipulation detection
 * - Phishing pattern recognition
 * - URL extraction and analysis
 * - Sentiment analysis
 * - Comprehensive risk scoring
 *
 * PHASE 2 (PENDING - See PENDING_FEATURES.md):
 * - Header analysis (email routing, SPF/DKIM verification)
 * - Domain reputation checks
 * - Reply-to mismatch detection
 * - Timing analysis (sent during off-hours)
 * - Advanced grammar/spelling analysis
 * - Chain email detection
 * - Business Email Compromise (BEC) patterns
 */

import { aiService } from '../ai/ai.service.js';
import { logger } from '../../config/logger.js';
import { urlScanner } from './url-scanner.service.js';
// PHASE 1: Import Multi-LLM service for comprehensive analysis
import { multiLLMService } from '../ai/multi-llm.service.js';
// PHASE 1: Import emotion analyzer for detailed psychological analysis
import { emotionAnalyzer } from '../analysis/emotion-analyzer.service.js';

export interface MessageScanResult {
  content: string;
  riskScore: number;
  riskLevel: string;
  findings: Finding[];
  urls: URLAnalysis[];
  sentiment: SentimentAnalysis;
  language: string;
  aiAnalysis: any;
  // PHASE 1: Multi-LLM consensus analysis
  multiLLMAnalysis?: {
    claude?: any;
    gpt4?: any;
    gemini?: any;
    consensus: {
      agreement: number;
      verdict: string;
      summary: string;
    };
  };
  // PHASE 1: Detailed emotion and manipulation analysis
  emotionAnalysis?: {
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
    sentimentScore: number;
    psychologicalTriggers: string[];
    riskIndicators: any;
    overallManipulationScore: number;
  };
  // PHASE 1: Extracted email addresses and phone numbers
  extractedData?: {
    emails: string[];
    phoneNumbers: string[];
  };
  scanDuration: number;
}

interface Finding {
  type: string;
  severity: string;
  message: string;
  points: number;
  details?: any;
}

interface URLAnalysis {
  url: string;
  riskScore: number;
  riskLevel: string;
}

interface SentimentAnalysis {
  score: number;
  urgency: number;
  manipulation: number;
  authority: number;
}

export class MessageScanner {
  async scanMessage(
    content: string,
    sender?: string,
    subject?: string,
    language: string = 'en'
  ): Promise<MessageScanResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    let riskScore = 0;

    try {
      // Extract and analyze URLs
      const urls = await this.extractAndAnalyzeURLs(content);
      urls.forEach(urlAnalysis => {
        riskScore += Math.floor(urlAnalysis.riskScore * 0.3);
        if (urlAnalysis.riskScore > 100) {
          findings.push({
            type: 'malicious_url',
            severity: 'critical',
            message: `Malicious URL detected: ${urlAnalysis.url}`,
            points: Math.floor(urlAnalysis.riskScore * 0.3),
            details: urlAnalysis
          });
        }
      });

      // Phishing pattern detection
      const phishingScore = this.detectPhishingPatterns(content, sender, subject);
      riskScore += phishingScore.score;
      findings.push(...phishingScore.findings);

      // Sentiment analysis
      const sentiment = this.analyzeSentiment(content);
      const sentimentScore = (sentiment.urgency + sentiment.manipulation + sentiment.authority) * 2;
      riskScore += sentimentScore;

      if (sentiment.urgency > 7) {
        findings.push({
          type: 'urgency_manipulation',
          severity: 'medium',
          message: 'High urgency manipulation detected',
          points: 15
        });
      }

      // Attachment indicators
      const attachmentScore = this.analyzeAttachmentIndicators(content);
      riskScore += attachmentScore.score;
      findings.push(...attachmentScore.findings);

      // Request for sensitive information
      const sensitiveInfoScore = this.detectSensitiveInfoRequests(content);
      riskScore += sensitiveInfoScore.score;
      findings.push(...sensitiveInfoScore.findings);

      // Get AI analysis (original single AI for backward compatibility)
      const aiAnalysis = await this.getAIAnalysis(content, findings, language);

      // PHASE 1: Get Multi-LLM consensus analysis
      // Queries Claude, GPT-4, and Gemini for comprehensive threat assessment
      const multiLLMAnalysis = await this.getMultiLLMAnalysis(content, sender, subject, urls, findings);

      // PHASE 1: Get detailed emotion and manipulation analysis
      // Provides psychological analysis of manipulation tactics
      const emotionAnalysis = await emotionAnalyzer.analyzeText(content);

      // PHASE 1: Extract email addresses and phone numbers
      const extractedData = this.extractContactInfo(content);

      const riskLevel = this.determineRiskLevel(riskScore);

      return {
        content,
        riskScore: Math.min(riskScore, 350),
        riskLevel,
        findings,
        urls,
        sentiment,
        language,
        aiAnalysis, // Original AI analysis (backward compatibility)
        multiLLMAnalysis, // PHASE 1: Multi-AI consensus
        emotionAnalysis, // PHASE 1: Detailed psychological analysis
        extractedData, // PHASE 1: Extracted contact information
        scanDuration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Message scan error:', error);
      throw error;
    }
  }

  private async extractAndAnalyzeURLs(content: string): Promise<URLAnalysis[]> {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    const matches = content.match(urlRegex) || [];

    const uniqueURLs = [...new Set(matches)];
    const analyses: URLAnalysis[] = [];

    for (const url of uniqueURLs.slice(0, 10)) {
      try {
        const result = await urlScanner.scanURL(url);
        analyses.push({
          url,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel
        });
      } catch (error) {
        logger.debug(`Failed to analyze URL ${url}:`, error);
      }
    }

    return analyses;
  }

  private detectPhishingPatterns(
    content: string,
    sender?: string,
    subject?: string
  ): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    const lowerContent = content.toLowerCase();
    const fullText = `${subject || ''} ${content} ${sender || ''}`.toLowerCase();

    // Common phishing keywords
    const phishingKeywords = {
      account: ['suspended', 'verify', 'confirm', 'update', 'locked'],
      urgency: ['immediately', 'urgent', 'expire', 'asap', 'act now'],
      security: ['security alert', 'unusual activity', 'suspicious', 'breach'],
      financial: ['refund', 'payment', 'billing', 'invoice', 'transfer']
    };

    for (const [category, keywords] of Object.entries(phishingKeywords)) {
      const matches = keywords.filter(kw => fullText.includes(kw));
      if (matches.length > 0) {
        const points = matches.length * 10;
        score += points;
        findings.push({
          type: `phishing_${category}`,
          severity: matches.length > 2 ? 'high' : 'medium',
          message: `Phishing indicators detected: ${matches.join(', ')}`,
          points,
          details: { keywords: matches }
        });
      }
    }

    // Sender spoofing detection
    if (sender) {
      const commonSpoofs = ['noreply', 'support', 'security', 'admin', 'service'];
      const senderLower = sender.toLowerCase();

      if (commonSpoofs.some(term => senderLower.includes(term))) {
        score += 15;
        findings.push({
          type: 'sender_spoofing',
          severity: 'high',
          message: 'Potentially spoofed sender address',
          points: 15,
          details: { sender }
        });
      }
    }

    // Credential harvesting
    const credentialWords = ['password', 'login', 'username', 'credential', 'pin'];
    const credentialMatches = credentialWords.filter(w => lowerContent.includes(w));

    if (credentialMatches.length > 0) {
      score += 20;
      findings.push({
        type: 'credential_harvesting',
        severity: 'critical',
        message: 'Requests for credentials detected',
        points: 20,
        details: { terms: credentialMatches }
      });
    }

    return { score, findings };
  }

  private analyzeSentiment(content: string): SentimentAnalysis {
    const lowerContent = content.toLowerCase();

    // Urgency score
    const urgencyWords = ['urgent', 'immediately', 'now', 'asap', 'quick', 'hurry', 'expire'];
    const urgency = urgencyWords.filter(w => lowerContent.includes(w)).length;

    // Manipulation score
    const manipulationWords = ['limited', 'exclusive', 'special', 'winner', 'free', 'guaranteed'];
    const manipulation = manipulationWords.filter(w => lowerContent.includes(w)).length;

    // Authority score
    const authorityWords = ['official', 'government', 'bank', 'administrator', 'security team'];
    const authority = authorityWords.filter(w => lowerContent.includes(w)).length;

    return {
      score: (urgency + manipulation + authority) / 3,
      urgency: Math.min(urgency * 2, 10),
      manipulation: Math.min(manipulation * 2, 10),
      authority: Math.min(authority * 2, 10)
    };
  }

  private analyzeAttachmentIndicators(content: string): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    const lowerContent = content.toLowerCase();
    const suspiciousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.vbs', '.js', '.jar'];

    for (const ext of suspiciousExtensions) {
      if (lowerContent.includes(ext)) {
        score += 25;
        findings.push({
          type: 'suspicious_attachment',
          severity: 'critical',
          message: `Reference to suspicious file type: ${ext}`,
          points: 25,
          details: { extension: ext }
        });
        break;
      }
    }

    const attachmentWords = ['attachment', 'attached', 'file', 'document', 'download'];
    const hasAttachmentRef = attachmentWords.some(w => lowerContent.includes(w));

    if (hasAttachmentRef && lowerContent.includes('click')) {
      score += 10;
      findings.push({
        type: 'attachment_click_request',
        severity: 'medium',
        message: 'Requests to click on attachment',
        points: 10
      });
    }

    return { score, findings };
  }

  private detectSensitiveInfoRequests(content: string): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    const lowerContent = content.toLowerCase();

    const sensitiveTerms = {
      'social security': 30,
      'ssn': 30,
      'credit card': 25,
      'bank account': 25,
      'routing number': 25,
      'passport': 20,
      'driver license': 20,
      'date of birth': 15,
      'birthdate': 15
    };

    for (const [term, points] of Object.entries(sensitiveTerms)) {
      if (lowerContent.includes(term)) {
        score += points;
        findings.push({
          type: 'sensitive_info_request',
          severity: 'critical',
          message: `Requests sensitive information: ${term}`,
          points,
          details: { term }
        });
      }
    }

    return { score, findings };
  }

  private async getAIAnalysis(
    content: string,
    findings: Finding[],
    language: string
  ): Promise<any> {
    try {
      const prompt = `Analyze this ${language} message for phishing and social engineering tactics:

Message: "${content}"

Detected findings: ${JSON.stringify(findings, null, 2)}

Provide:
1. Brief explanation of threats
2. Social engineering tactics used
3. Recommendations for the recipient`;

      const response = await aiService.query({
        query: prompt,
        useRAG: true,
        model: 'claude'
      });

      return {
        explanation: response.response,
        model: response.model
      };
    } catch (error) {
      logger.error('AI analysis failed for message:', error);
      return {
        explanation: 'AI analysis temporarily unavailable',
        model: 'none'
      };
    }
  }

  private determineRiskLevel(score: number): string {
    if (score >= 200) return 'critical';
    if (score >= 120) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 20) return 'low';
    return 'safe';
  }

  /**
   * PHASE 1: Get Multi-LLM consensus analysis for message
   * Queries Claude, GPT-4, and Gemini in parallel for comprehensive threat assessment
   *
   * @param content - Message text content
   * @param sender - Sender email/identifier
   * @param subject - Email subject line
   * @param urls - Extracted URLs
   * @param findings - Technical findings from pattern analysis
   * @returns Multi-LLM consensus analysis
   */
  private async getMultiLLMAnalysis(
    content: string,
    sender?: string,
    subject?: string,
    urls?: URLAnalysis[],
    findings?: Finding[]
  ): Promise<any> {
    try {
      // Extract emails and phone numbers for AI context
      const extractedData = this.extractContactInfo(content);

      // Prepare comprehensive message data for AI analysis
      const messageData = {
        content,
        sender,
        subject,
        extractedUrls: urls?.map(u => u.url) || [],
        extractedEmails: extractedData.emails,
        phishingIndicators: {
          findings: findings?.map(f => ({
            type: f.type,
            severity: f.severity,
            message: f.message
          })) || [],
          suspiciousUrls: urls?.filter(u => u.riskScore > 50) || []
        }
      };

      // Query all AI models in parallel
      // Each model has different training and may catch different threats
      const multiLLMResult = await multiLLMService.analyzeMessage(messageData);

      return multiLLMResult;
    } catch (error) {
      logger.error('Multi-LLM message analysis failed:', error);
      return undefined;
    }
  }

  /**
   * PHASE 1: Extract email addresses and phone numbers from message content
   * Used for AI context and to identify potential scam contact information
   *
   * @param content - Message text content
   * @returns Extracted emails and phone numbers
   */
  private extractContactInfo(content: string): { emails: string[]; phoneNumbers: string[] } {
    // Email pattern: standard email format
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern) || [];

    // Phone number patterns: various formats
    const phonePatterns = [
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // 123-456-7890 or 123.456.7890 or 123 456 7890
      /\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g, // (123) 456-7890
      /\b\+\d{1,3}\s?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g // +1 123-456-7890
    ];

    const phoneNumbers: string[] = [];
    phonePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        phoneNumbers.push(...matches);
      }
    });

    // Remove duplicates
    return {
      emails: Array.from(new Set(emails)),
      phoneNumbers: Array.from(new Set(phoneNumbers))
    };
  }
}

export const messageScanner = new MessageScanner();
