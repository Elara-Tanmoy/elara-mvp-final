import axios from 'axios';
import { logger } from '../../config/logger.js';

/**
 * Scam Database Service
 * Checks profiles against known scam/fraud databases and blacklists
 */

export interface ScamDatabaseResult {
  isKnownScammer: boolean;
  matchedLists: string[];
  confidence: number;
  details: string;
  sources: string[];
}

export class ScamDatabaseService {
  // Known scam patterns database (expandable)
  private readonly SCAM_PATTERNS = {
    // Common scam username patterns
    suspiciousUsernames: [
      /.*_official$/i,
      /.*_real$/i,
      /.*_verified$/i,
      /^official_.*$/i,
      /.*support.*\d{3,}$/i,
      /.*admin.*\d{3,}$/i,
      /.*customer.*service.*\d+$/i,
      /^[\d]+[a-z]{2,5}[\d]+$/i, // Random number-letter combos
    ],

    // Disposable email domains
    disposableEmailDomains: [
      'tempmail.com',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
      'temp-mail.org',
      'fakeinbox.com',
      'yopmail.com'
    ],

    // Known scam keywords in bios
    scamBioKeywords: [
      'recovery expert',
      'funds recovery',
      'binary options expert',
      'forex mentor',
      'trading guru',
      'crypto expert guaranteed',
      'investment advisor dm',
      'passive income system',
      'get rich quick',
      'financial freedom coach'
    ],

    // Suspicious external domains
    suspiciousDomains: [
      '.tk',
      '.ml',
      '.ga',
      '.cf',
      '.gq', // Free domains often used by scammers
      'bit.ly',
      'tinyurl.com',
      'shorturl.at' // URL shorteners (can hide malicious sites)
    ]
  };

  /**
   * Check if profile matches known scam patterns
   */
  async checkScamDatabase(profileData: {
    username: string;
    displayName: string;
    bio: string;
    externalLinks: string[];
    email?: string;
  }): Promise<ScamDatabaseResult> {
    try {
      logger.info(`[Scam Database] Checking profile: ${profileData.username}`);

      const matchedLists: string[] = [];
      let confidenceScore = 0;
      const sources: string[] = [];

      // Check username patterns
      const usernameScore = this.checkUsernamePattern(profileData.username);
      if (usernameScore > 0) {
        matchedLists.push('Suspicious Username Pattern');
        confidenceScore += usernameScore;
      }

      // Check bio for scam keywords
      const bioScore = this.checkBioKeywords(profileData.bio);
      if (bioScore > 0) {
        matchedLists.push('Scam Keywords in Bio');
        confidenceScore += bioScore;
        sources.push('Scam keyword database');
      }

      // Check external links for suspicious domains
      const linkScore = this.checkSuspiciousLinks(profileData.externalLinks);
      if (linkScore > 0) {
        matchedLists.push('Suspicious External Links');
        confidenceScore += linkScore;
        sources.push('Malicious domain database');
      }

      // Check email domain if provided
      if (profileData.email) {
        const emailScore = this.checkDisposableEmail(profileData.email);
        if (emailScore > 0) {
          matchedLists.push('Disposable Email Service');
          confidenceScore += emailScore;
          sources.push('Disposable email database');
        }
      }

      // Try to check online scam databases
      const onlineCheck = await this.checkOnlineScamDatabases(profileData.username);
      if (onlineCheck.found) {
        matchedLists.push('Known Scammer Database');
        confidenceScore += 50;
        sources.push(...onlineCheck.sources);
      }

      // Normalize confidence to 0-100
      const confidence = Math.min(confidenceScore, 100);
      const isKnownScammer = confidence >= 60 || matchedLists.length >= 3;

      let details = '';
      if (isKnownScammer) {
        details = `Profile matches ${matchedLists.length} scam indicators with ${confidence}% confidence. `;
        details += matchedLists.join(', ') + '.';
      } else if (matchedLists.length > 0) {
        details = `Profile shows some concerning patterns: ${matchedLists.join(', ')}.`;
      } else {
        details = 'No matches found in known scam databases.';
      }

      logger.info(`[Scam Database] Check complete: ${isKnownScammer ? 'SCAMMER' : 'CLEAN'} (${confidence}% confidence)`);

      return {
        isKnownScammer,
        matchedLists,
        confidence,
        details,
        sources: [...new Set(sources)]
      };
    } catch (error) {
      logger.error('[Scam Database] Error:', error);
      return {
        isKnownScammer: false,
        matchedLists: [],
        confidence: 0,
        details: 'Unable to check scam databases',
        sources: []
      };
    }
  }

  /**
   * Check username against suspicious patterns
   */
  private checkUsernamePattern(username: string): number {
    let score = 0;

    this.SCAM_PATTERNS.suspiciousUsernames.forEach(pattern => {
      if (pattern.test(username)) {
        score += 15;
      }
    });

    // Check for excessive numbers
    const numberCount = (username.match(/\d/g) || []).length;
    const numberRatio = numberCount / username.length;
    if (numberRatio > 0.5) {
      score += 10;
    }

    // Check for random character sequences
    if (this.isRandomSequence(username)) {
      score += 20;
    }

    return Math.min(score, 50);
  }

  /**
   * Detect random character sequences
   */
  private isRandomSequence(text: string): boolean {
    // Remove numbers and special chars
    const letters = text.replace(/[^a-z]/gi, '').toLowerCase();
    if (letters.length < 5) return false;

    // Check for lack of vowels (random sequences often have few vowels)
    const vowels = (letters.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowels / letters.length;

    return vowelRatio < 0.15; // Less than 15% vowels = likely random
  }

  /**
   * Check bio for scam keywords
   */
  private checkBioKeywords(bio: string): number {
    let score = 0;
    const bioLower = bio.toLowerCase();

    this.SCAM_PATTERNS.scamBioKeywords.forEach(keyword => {
      if (bioLower.includes(keyword)) {
        score += 15;
      }
    });

    return Math.min(score, 50);
  }

  /**
   * Check for suspicious external links
   */
  private checkSuspiciousLinks(links: string[]): number {
    let score = 0;

    links.forEach(link => {
      const linkLower = link.toLowerCase();

      // Check for suspicious TLDs and domains
      this.SCAM_PATTERNS.suspiciousDomains.forEach(domain => {
        if (linkLower.includes(domain)) {
          score += 10;
        }
      });

      // Check for IP addresses in URLs (suspicious)
      if (/https?:\/\/\d+\.\d+\.\d+\.\d+/.test(link)) {
        score += 15;
      }
    });

    return Math.min(score, 40);
  }

  /**
   * Check if email uses disposable service
   */
  private checkDisposableEmail(email: string): number {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return 0;

    return this.SCAM_PATTERNS.disposableEmailDomains.includes(domain) ? 20 : 0;
  }

  /**
   * Check online scam databases (GitHub repos, public APIs)
   */
  private async checkOnlineScamDatabases(username: string): Promise<{
    found: boolean;
    sources: string[];
  }> {
    try {
      // Check PhishTank-like databases (using public GitHub repos)
      const sources: string[] = [];

      // Example: Check a public scammer list on GitHub
      // This is a placeholder - in production, use actual scam databases
      const publicScamLists = [
        'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt',
        // Add more public scam databases here
      ];

      // For now, return false (no online check)
      // In production, fetch these lists and check username/domain
      return {
        found: false,
        sources: []
      };
    } catch (error) {
      logger.error('[Online Scam Check] Error:', error);
      return {
        found: false,
        sources: []
      };
    }
  }

  /**
   * Calculate username pattern score (0-100)
   */
  calculateUsernamePatternScore(username: string): number {
    let score = 0;

    // Length check
    if (username.length < 3) score += 20;
    else if (username.length > 25) score += 10;

    // Number ratio
    const numbers = (username.match(/\d/g) || []).length;
    const numberRatio = numbers / username.length;
    if (numberRatio > 0.6) score += 25;
    else if (numberRatio > 0.4) score += 15;

    // Special characters
    const specialChars = (username.match(/[^a-zA-Z0-9_]/g) || []).length;
    if (specialChars > 2) score += 15;

    // Suspicious suffixes
    if (/_official$|_real$|_verified$/i.test(username)) score += 20;

    // Random sequence detection
    if (this.isRandomSequence(username)) score += 25;

    return Math.min(score, 100);
  }
}

export const scamDatabaseService = new ScamDatabaseService();
