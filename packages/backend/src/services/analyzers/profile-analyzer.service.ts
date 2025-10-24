import axios from 'axios';
import { logger } from '../../config/logger.js';

/**
 * Social Profile Analyzer Service
 * Analyzes social media profiles for authenticity and scam indicators
 */

export interface AccountMetrics {
  followers: number;
  following: number;
  posts: number;
  followerFollowingRatio: number;
  accountAge: string;
  accountAgeNumeric: number; // days
}

export interface ProfilePhoto {
  imageUrl: string | null;
  reverseSearchHits: number;
  perceptualHash: string | null;
  stolenPhotoConfidence: number;
}

export interface BehaviorPattern {
  postingFrequency: string; // "every_5_minutes" | "daily" | "weekly"
  activityPattern: "automated" | "human" | "suspicious";
  engagementRate: number; // likes/comments per follower
}

export interface ImpersonationAnalysis {
  isImpersonating: boolean;
  targetPerson: string | null;
  confidence: number;
  visualSimilarity: number;
  nameSimilarity: number;
  hasVerificationBadge: boolean;
}

export interface ProfileData {
  platform: "facebook" | "instagram" | "linkedin" | "twitter" | "telegram" | "unknown";
  handle: string;
  displayName: string;
  profileUrl: string;
  bio: string;
  accountMetrics: AccountMetrics;
  profilePhoto: ProfilePhoto;
  behaviorPattern: BehaviorPattern;
  impersonationAnalysis: ImpersonationAnalysis;
  accountAgeNumeric: number;
}

export interface ProfileAnalysisResult {
  authenticityScore: number; // 0-100
  verdict: "authentic" | "suspicious" | "likely_scam" | "confirmed_scam";
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  impersonating: string | null;
  confidence: number;
  redFlags: string[];
  recommendation: string;
  profileData: ProfileData;
}

export class ProfileAnalyzerService {
  private readonly scamKeywords = [
    "crypto", "investment", "DM", "giveaway", "bitcoin",
    "forex", "trading", "profit", "guaranteed", "returns",
    "financial freedom", "passive income", "make money fast"
  ];

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): ProfileData['platform'] {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('facebook.com') || urlLower.includes('fb.com')) return 'facebook';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('t.me') || urlLower.includes('telegram')) return 'telegram';

    return 'unknown';
  }

  /**
   * Extract handle from URL
   */
  extractHandle(url: string, platform: ProfileData['platform']): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Remove leading/trailing slashes and extract username
      const parts = pathname.split('/').filter(p => p.length > 0);

      if (platform === 'twitter' || platform === 'instagram') {
        return parts[0] || 'unknown';
      }

      if (platform === 'facebook') {
        return parts[0] || 'unknown';
      }

      if (platform === 'linkedin') {
        const inIndex = parts.indexOf('in');
        if (inIndex >= 0 && parts.length > inIndex + 1) {
          return parts[inIndex + 1];
        }
      }

      if (platform === 'telegram') {
        return parts[0] || 'unknown';
      }

      return parts[0] || 'unknown';
    } catch (error) {
      logger.error('Handle extraction error:', error);
      return 'unknown';
    }
  }

  /**
   * Calculate Levenshtein distance for name similarity
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate name similarity score (0-1)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1.0;

    const distance = this.levenshteinDistance(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);

    return 1 - (distance / maxLen);
  }

  /**
   * Detect impersonation of known public figures
   */
  private async detectImpersonation(
    displayName: string,
    profilePhotoUrl: string | null,
    hasVerificationBadge: boolean
  ): Promise<ImpersonationAnalysis> {
    // List of commonly impersonated figures
    const publicFigures = [
      'elon musk', 'jeff bezos', 'bill gates', 'warren buffett',
      'donald trump', 'joe biden', 'mark zuckerberg', 'tim cook',
      'sundar pichai', 'satya nadella', 'jack dorsey', 'cathie wood'
    ];

    const nameLower = displayName.toLowerCase();

    for (const figure of publicFigures) {
      const similarity = this.calculateNameSimilarity(nameLower, figure);

      if (similarity > 0.7) {
        // Likely impersonation if similar name but no verification badge
        const isImpersonating = !hasVerificationBadge && similarity > 0.8;

        return {
          isImpersonating,
          targetPerson: figure,
          confidence: similarity,
          visualSimilarity: 0, // Would require image comparison API
          nameSimilarity: similarity,
          hasVerificationBadge
        };
      }
    }

    return {
      isImpersonating: false,
      targetPerson: null,
      confidence: 0,
      visualSimilarity: 0,
      nameSimilarity: 0,
      hasVerificationBadge
    };
  }

  /**
   * Calculate authenticity score based on profile data
   */
  calculateAuthenticityScore(profile: ProfileData): number {
    let score = 100; // Start at 100 (authentic)

    // Account age penalty
    if (profile.accountAgeNumeric < 7) {
      score -= 30;
    } else if (profile.accountAgeNumeric < 30) {
      score -= 15;
    }

    // Follower ratio penalty
    if (profile.accountMetrics.followerFollowingRatio < 0.1) {
      score -= 25;
    }

    // Engagement rate penalty
    if (profile.behaviorPattern.engagementRate < 0.01) {
      score -= 20;
    }

    // Profile photo penalties
    if (profile.profilePhoto.reverseSearchHits > 100) {
      score -= 30;
    }
    if (!profile.profilePhoto.imageUrl) {
      score -= 10;
    }

    // Bio keyword penalties
    const bioLower = profile.bio.toLowerCase();
    const keywordCount = this.scamKeywords.filter(kw => bioLower.includes(kw)).length;
    score -= (keywordCount * 10);

    // Impersonation penalty
    if (profile.impersonationAnalysis.confidence > 0.8) {
      score -= 40;
    }

    // Automated behavior penalty
    if (profile.behaviorPattern.activityPattern === 'automated') {
      score -= 25;
    } else if (profile.behaviorPattern.activityPattern === 'suspicious') {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score)); // Clamp between 0-100
  }

  /**
   * Determine verdict based on authenticity score
   */
  private determineVerdict(score: number): ProfileAnalysisResult['verdict'] {
    if (score >= 80) return 'authentic';
    if (score >= 60) return 'suspicious';
    if (score >= 30) return 'likely_scam';
    return 'confirmed_scam';
  }

  /**
   * Determine risk level based on authenticity score
   */
  private determineRiskLevel(score: number): ProfileAnalysisResult['riskLevel'] {
    if (score >= 80) return 'safe';
    if (score >= 60) return 'low';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'high';
    return 'critical';
  }

  /**
   * Generate red flags list
   */
  private generateRedFlags(profile: ProfileData, score: number): string[] {
    const flags: string[] = [];

    if (profile.accountAgeNumeric < 7) {
      flags.push(`Account age: ${profile.accountMetrics.accountAge} (Very new account)`);
    } else if (profile.accountAgeNumeric < 30) {
      flags.push(`Account age: ${profile.accountMetrics.accountAge} (Recent account)`);
    }

    if (profile.accountMetrics.followerFollowingRatio < 0.1) {
      flags.push(`Follower/following ratio: ${profile.accountMetrics.followerFollowingRatio.toFixed(2)} (Suspicious ratio)`);
    }

    if (profile.profilePhoto.reverseSearchHits > 100) {
      flags.push(`Profile photo stolen (${profile.profilePhoto.reverseSearchHits} reverse search hits)`);
    }

    if (!profile.profilePhoto.imageUrl) {
      flags.push('No profile photo');
    }

    const bioLower = profile.bio.toLowerCase();
    const foundKeywords = this.scamKeywords.filter(kw => bioLower.includes(kw));
    if (foundKeywords.length > 0) {
      flags.push(`Bio contains scam keywords: ${foundKeywords.join(', ')}`);
    }

    if (profile.impersonationAnalysis.isImpersonating) {
      flags.push(`Impersonating ${profile.impersonationAnalysis.targetPerson}`);
    }

    if (profile.behaviorPattern.activityPattern === 'automated') {
      flags.push('Automated posting behavior detected');
    }

    if (profile.behaviorPattern.engagementRate < 0.01) {
      flags.push(`Low engagement rate: ${(profile.behaviorPattern.engagementRate * 100).toFixed(2)}%`);
    }

    return flags;
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    verdict: ProfileAnalysisResult['verdict'],
    riskLevel: ProfileAnalysisResult['riskLevel'],
    isImpersonating: boolean
  ): string {
    if (isImpersonating) {
      return 'DO NOT INTERACT - Confirmed impersonation account. This is a scam.';
    }

    if (riskLevel === 'critical' || verdict === 'confirmed_scam') {
      return 'DANGER - High probability of scam. Do not engage or send money.';
    }

    if (riskLevel === 'high' || verdict === 'likely_scam') {
      return 'WARNING - Multiple red flags detected. Exercise extreme caution.';
    }

    if (riskLevel === 'medium' || verdict === 'suspicious') {
      return 'CAUTION - Some suspicious indicators. Verify identity before engaging.';
    }

    if (riskLevel === 'low') {
      return 'Low risk but remain vigilant. Verify claims independently.';
    }

    return 'Profile appears authentic but always verify important claims.';
  }

  /**
   * Analyze social media profile
   * Main entry point for profile analysis - accepts structured profile data from controller
   */
  async analyzeProfile(profileInput: any): Promise<ProfileAnalysisResult> {
    try {
      logger.info(`Starting profile analysis for: ${profileInput.username}`);

      // Convert controller's data structure to our ProfileData structure
      const accountAgeNumeric = this.parseAccountAge(profileInput.accountAge);

      const profileData: ProfileData = {
        platform: profileInput.platform || 'unknown',
        handle: profileInput.username || 'unknown',
        displayName: profileInput.displayName || profileInput.username || 'unknown',
        profileUrl: '', // Not provided in controller input
        bio: profileInput.bio || '',
        accountMetrics: {
          followers: profileInput.accountMetrics?.followerCount || 0,
          following: profileInput.accountMetrics?.followingCount || 0,
          posts: profileInput.accountMetrics?.postCount || 0,
          followerFollowingRatio: profileInput.accountMetrics?.followerFollowingRatio || 0,
          accountAge: profileInput.accountAge || '0 days',
          accountAgeNumeric
        },
        profilePhoto: {
          imageUrl: profileInput.profilePhoto?.imageUrl || null,
          reverseSearchHits: profileInput.profilePhoto?.reverseSearchHits || 0,
          perceptualHash: null,
          stolenPhotoConfidence: 0
        },
        behaviorPattern: {
          postingFrequency: this.analyzePostFrequency(profileInput.behaviorPattern?.postFrequency || 0),
          activityPattern: profileInput.behaviorPattern?.contentTypes?.includes('automated') ? 'automated' : 'human',
          engagementRate: profileInput.behaviorPattern?.engagementRate || 0
        },
        impersonationAnalysis: await this.detectImpersonation(
          profileInput.displayName || profileInput.username || '',
          profileInput.profilePhoto?.imageUrl || null,
          profileInput.verified || false
        ),
        accountAgeNumeric
      };

      const authenticityScore = this.calculateAuthenticityScore(profileData);
      const verdict = this.determineVerdict(authenticityScore);
      const riskLevel = this.determineRiskLevel(authenticityScore);
      const redFlags = this.generateRedFlags(profileData, authenticityScore);
      const recommendation = this.generateRecommendation(
        verdict,
        riskLevel,
        profileData.impersonationAnalysis.isImpersonating
      );

      const result: ProfileAnalysisResult = {
        authenticityScore,
        verdict,
        riskLevel,
        impersonating: profileData.impersonationAnalysis.targetPerson,
        confidence: profileData.impersonationAnalysis.confidence,
        redFlags,
        recommendation,
        profileData
      };

      logger.info(`Profile analysis complete: ${verdict} (${authenticityScore}/100)`);
      return result;

    } catch (error) {
      logger.error('Profile analysis error:', error);
      throw error;
    }
  }

  /**
   * Parse account age string to days
   */
  private parseAccountAge(accountAge: string): number {
    if (!accountAge || accountAge === 'unknown') return 0;

    const ageMatch = accountAge.match(/(\d+)\s*(year|month|day|week)/i);
    if (!ageMatch) return 0;

    const value = parseInt(ageMatch[1]);
    const unit = ageMatch[2].toLowerCase();

    if (unit.startsWith('year')) return value * 365;
    if (unit.startsWith('month')) return value * 30;
    if (unit.startsWith('week')) return value * 7;
    if (unit.startsWith('day')) return value;

    return 0;
  }

  /**
   * Analyze post frequency pattern
   */
  private analyzePostFrequency(postsPerDay: number): string {
    if (postsPerDay > 24) return 'every_hour'; // More than 1 per hour
    if (postsPerDay > 5) return 'multiple_daily';
    if (postsPerDay >= 0.5) return 'daily';
    if (postsPerDay >= 0.14) return 'weekly'; // ~1 per week
    return 'occasional';
  }
}

export const profileAnalyzerService = new ProfileAnalyzerService();
