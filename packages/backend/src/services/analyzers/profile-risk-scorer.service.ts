import { logger } from '../../config/logger.js';

/**
 * Profile Risk Scorer Service
 * Calculates comprehensive risk score based on multiple factors
 */

export interface RiskFactors {
  accountAgeDays: number | null;
  imageReverseSearchHits: number;
  suspiciousKeywordCount: number;
  followerFollowingRatio: number;
  engagementRate: number;
  verificationStatus: boolean;
  profileCompleteness: number;
  scamDatabaseMatch: boolean;
  usernamePatternScore: number;
  contentRiskScore: number;
  hasExternalLinks: boolean;
  externalLinkCount: number;
  followerCount: number;
  postCount: number;
}

export interface RiskScoreResult {
  totalRiskScore: number;
  verdict: 'SAFE' | 'CAUTION' | 'DANGER';
  confidenceLevel: 'High' | 'Medium' | 'Low';
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  breakdown: {
    category: string;
    score: number;
    maxScore: number;
    severity: 'None' | 'Minor' | 'Moderate' | 'Severe';
    description: string;
  }[];
  summary: string;
}

export class ProfileRiskScorerService {
  /**
   * Calculate comprehensive risk score using the specified algorithm
   */
  calculateRiskScore(data: RiskFactors): RiskScoreResult {
    try {
      logger.info('[Risk Scorer] Calculating risk score...');

      let riskScore = 0;
      const breakdown: RiskScoreResult['breakdown'] = [];

      // 1. Account Age (max 25 points risk)
      let accountAgeScore = 0;
      let accountAgeSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' = 'None';
      let accountAgeDesc = '';

      if (data.accountAgeDays === null) {
        accountAgeScore = 15;
        accountAgeSeverity = 'Moderate';
        accountAgeDesc = 'Account age unknown - unable to verify account history';
      } else if (data.accountAgeDays < 30) {
        accountAgeScore = 25;
        accountAgeSeverity = 'Severe';
        accountAgeDesc = `Very new account (${data.accountAgeDays} days) - scammers often use fresh accounts`;
      } else if (data.accountAgeDays < 90) {
        accountAgeScore = 15;
        accountAgeSeverity = 'Moderate';
        accountAgeDesc = `Account is ${data.accountAgeDays} days old - relatively new`;
      } else if (data.accountAgeDays < 365) {
        accountAgeScore = 5;
        accountAgeSeverity = 'Minor';
        accountAgeDesc = `Account is ${data.accountAgeDays} days old - somewhat established`;
      } else {
        accountAgeDesc = `Account is ${Math.floor(data.accountAgeDays / 365)} years old - well established`;
      }

      riskScore += accountAgeScore;
      breakdown.push({
        category: 'Account Age',
        score: accountAgeScore,
        maxScore: 25,
        severity: accountAgeSeverity,
        description: accountAgeDesc
      });

      // 2. Image Reverse Search (max 30 points risk)
      let imageScore = 0;
      let imageSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' = 'None';
      let imageDesc = '';

      if (data.imageReverseSearchHits > 20) {
        imageScore = 30;
        imageSeverity = 'Severe';
        imageDesc = `Profile photo found on ${data.imageReverseSearchHits}+ websites - likely stolen or stock image`;
      } else if (data.imageReverseSearchHits > 10) {
        imageScore = 20;
        imageSeverity = 'Severe';
        imageDesc = `Profile photo found on ${data.imageReverseSearchHits} websites - possibly stock photo`;
      } else if (data.imageReverseSearchHits > 5) {
        imageScore = 10;
        imageSeverity = 'Moderate';
        imageDesc = `Profile photo found on ${data.imageReverseSearchHits} websites - some reuse detected`;
      } else if (data.imageReverseSearchHits > 0) {
        imageSeverity = 'Minor';
        imageDesc = `Profile photo found on ${data.imageReverseSearchHits} website(s) - minimal reuse`;
      } else {
        imageDesc = 'Profile photo appears unique - not found elsewhere online';
      }

      riskScore += imageScore;
      breakdown.push({
        category: 'Profile Photo Authenticity',
        score: imageScore,
        maxScore: 30,
        severity: imageSeverity,
        description: imageDesc
      });

      // 3. Suspicious Keywords (max 20 points risk)
      let keywordScore = 0;
      let keywordSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' = 'None';
      let keywordDesc = '';

      if (data.suspiciousKeywordCount > 10) {
        keywordScore = 20;
        keywordSeverity = 'Severe';
        keywordDesc = `Found ${data.suspiciousKeywordCount} suspicious keywords - strong scam indicators`;
      } else if (data.suspiciousKeywordCount > 5) {
        keywordScore = 15;
        keywordSeverity = 'Severe';
        keywordDesc = `Found ${data.suspiciousKeywordCount} suspicious keywords - multiple red flags`;
      } else if (data.suspiciousKeywordCount > 2) {
        keywordScore = 10;
        keywordSeverity = 'Moderate';
        keywordDesc = `Found ${data.suspiciousKeywordCount} suspicious keywords - some concerns`;
      } else if (data.suspiciousKeywordCount > 0) {
        keywordSeverity = 'Minor';
        keywordDesc = `Found ${data.suspiciousKeywordCount} suspicious keyword(s)`;
      } else {
        keywordDesc = 'No suspicious keywords detected in content';
      }

      riskScore += keywordScore;
      breakdown.push({
        category: 'Suspicious Content',
        score: keywordScore,
        maxScore: 20,
        severity: keywordSeverity,
        description: keywordDesc
      });

      // 4. Follower/Following Ratio (max 15 points risk)
      let ratioScore = 0;
      let ratioSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' = 'None';
      let ratioDesc = '';

      if (data.followerFollowingRatio < 0.1) {
        ratioScore = 15;
        ratioSeverity = 'Moderate';
        ratioDesc = `Following ${Math.round(1 / data.followerFollowingRatio)}x more accounts than followers - suspicious growth pattern`;
      } else if (data.followerFollowingRatio > 100) {
        ratioScore = 10;
        ratioSeverity = 'Moderate';
        ratioDesc = `Unusually high follower ratio (${Math.round(data.followerFollowingRatio)}:1) - possible fake followers`;
      } else if (data.followerFollowingRatio < 0.3) {
        ratioScore = 5;
        ratioSeverity = 'Minor';
        ratioDesc = 'Following more accounts than have followers - common in new accounts';
      } else {
        ratioDesc = `Follower/following ratio appears normal (${data.followerFollowingRatio.toFixed(2)}:1)`;
      }

      riskScore += ratioScore;
      breakdown.push({
        category: 'Follower/Following Ratio',
        score: ratioScore,
        maxScore: 15,
        severity: ratioSeverity,
        description: ratioDesc
      });

      // 5. Verification Status (max 10 points risk)
      let verificationScore = 0;
      let verificationDesc = '';

      if (!data.verificationStatus) {
        verificationScore = 10;
        verificationDesc = 'Account not verified - no platform authentication';
      } else {
        verificationDesc = 'Account is verified by platform - authenticated identity';
      }

      riskScore += verificationScore;
      breakdown.push({
        category: 'Verification Status',
        score: verificationScore,
        maxScore: 10,
        severity: data.verificationStatus ? 'None' : 'Minor',
        description: verificationDesc
      });

      // 6. Profile Completeness (max 10 points risk)
      let completenessScore = 0;
      let completenessSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' = 'None';
      let completenessDesc = '';

      if (data.profileCompleteness < 30) {
        completenessScore = 10;
        completenessSeverity = 'Moderate';
        completenessDesc = `Profile ${data.profileCompleteness}% complete - missing important information`;
      } else if (data.profileCompleteness < 60) {
        completenessScore = 5;
        completenessSeverity = 'Minor';
        completenessDesc = `Profile ${data.profileCompleteness}% complete - some information missing`;
      } else {
        completenessDesc = `Profile ${data.profileCompleteness}% complete - well-filled profile`;
      }

      riskScore += completenessScore;
      breakdown.push({
        category: 'Profile Completeness',
        score: completenessScore,
        maxScore: 10,
        severity: completenessSeverity,
        description: completenessDesc
      });

      // 7. Scam Database Match (instant 40 points)
      let scamDbScore = 0;
      let scamDbDesc = '';

      if (data.scamDatabaseMatch) {
        scamDbScore = 40;
        scamDbDesc = 'Profile matches known scam patterns or databases - HIGH RISK';
      } else {
        scamDbDesc = 'No matches in known scam databases';
      }

      riskScore += scamDbScore;
      breakdown.push({
        category: 'Scam Database Check',
        score: scamDbScore,
        maxScore: 40,
        severity: data.scamDatabaseMatch ? 'Severe' : 'None',
        description: scamDbDesc
      });

      // 8. Username Pattern (max 15 points risk)
      const usernameScore = Math.min(Math.round(data.usernamePatternScore * 0.15), 15);
      let usernameSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' = 'None';
      let usernameDesc = '';

      if (usernameScore >= 12) {
        usernameSeverity = 'Severe';
        usernameDesc = 'Username follows suspicious patterns - likely bot or scam account';
      } else if (usernameScore >= 8) {
        usernameSeverity = 'Moderate';
        usernameDesc = 'Username has some unusual characteristics';
      } else if (usernameScore >= 4) {
        usernameSeverity = 'Minor';
        usernameDesc = 'Username shows minor irregularities';
      } else {
        usernameDesc = 'Username appears normal';
      }

      riskScore += usernameScore;
      breakdown.push({
        category: 'Username Pattern',
        score: usernameScore,
        maxScore: 15,
        severity: usernameSeverity,
        description: usernameDesc
      });

      // 9. Low Engagement (max 10 points risk)
      let engagementScore = 0;
      let engagementDesc = '';

      if (data.engagementRate < 0.5 && data.followerCount > 100) {
        engagementScore = 10;
        engagementDesc = `Very low engagement rate (${data.engagementRate.toFixed(1)}%) - possible fake followers`;
      } else if (data.engagementRate < 1.0 && data.followerCount > 1000) {
        engagementScore = 5;
        engagementDesc = `Low engagement rate (${data.engagementRate.toFixed(1)}%) for follower count`;
      } else {
        engagementDesc = `Engagement rate appears normal (${data.engagementRate.toFixed(1)}%)`;
      }

      riskScore += engagementScore;
      breakdown.push({
        category: 'Engagement Rate',
        score: engagementScore,
        maxScore: 10,
        severity: engagementScore >= 8 ? 'Moderate' : engagementScore > 0 ? 'Minor' : 'None',
        description: engagementDesc
      });

      // Cap at 100
      riskScore = Math.min(riskScore, 100);

      // Determine verdict and risk level
      let verdict: 'SAFE' | 'CAUTION' | 'DANGER';
      let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
      let confidenceLevel: 'High' | 'Medium' | 'Low';

      if (riskScore >= 70) {
        verdict = 'DANGER';
        riskLevel = 'critical';
        confidenceLevel = 'High';
      } else if (riskScore >= 50) {
        verdict = 'DANGER';
        riskLevel = 'high';
        confidenceLevel = 'High';
      } else if (riskScore >= 30) {
        verdict = 'CAUTION';
        riskLevel = 'medium';
        confidenceLevel = 'High';
      } else if (riskScore >= 15) {
        verdict = 'CAUTION';
        riskLevel = 'low';
        confidenceLevel = 'Medium';
      } else {
        verdict = 'SAFE';
        riskLevel = 'safe';
        confidenceLevel = data.accountAgeDays === null ? 'Medium' : 'High';
      }

      // Generate summary
      let summary = '';
      if (verdict === 'SAFE') {
        summary = 'This profile appears legitimate with minimal risk indicators.';
      } else if (verdict === 'CAUTION') {
        summary = 'This profile shows some warning signs. Exercise caution when interacting.';
      } else {
        summary = 'This profile shows strong indicators of scam/spam activity. High risk - avoid interaction.';
      }

      logger.info(`[Risk Scorer] Final score: ${riskScore}/100 - Verdict: ${verdict}`);

      return {
        totalRiskScore: riskScore,
        verdict,
        confidenceLevel,
        riskLevel,
        breakdown,
        summary
      };
    } catch (error) {
      logger.error('[Risk Scorer] Error:', error);
      return {
        totalRiskScore: 50,
        verdict: 'CAUTION',
        confidenceLevel: 'Low',
        riskLevel: 'medium',
        breakdown: [],
        summary: 'Unable to calculate accurate risk score - exercise caution'
      };
    }
  }

  /**
   * Calculate profile completeness score (0-100)
   */
  calculateProfileCompleteness(profileData: {
    displayName?: string;
    bio?: string;
    profilePhotoUrl?: string | null;
    verified?: boolean;
    followerCount?: number;
    postCount?: number;
    externalLinks?: string[];
  }): number {
    let score = 0;

    // Display name (15 points)
    if (profileData.displayName && profileData.displayName.length > 2) {
      score += 15;
    }

    // Bio (25 points)
    if (profileData.bio && profileData.bio.length > 20) {
      score += 25;
    } else if (profileData.bio && profileData.bio.length > 0) {
      score += 10;
    }

    // Profile photo (20 points)
    if (profileData.profilePhotoUrl) {
      score += 20;
    }

    // Verification (15 points)
    if (profileData.verified) {
      score += 15;
    }

    // Has followers (10 points)
    if (profileData.followerCount && profileData.followerCount > 0) {
      score += 10;
    }

    // Has posts (10 points)
    if (profileData.postCount && profileData.postCount > 0) {
      score += 10;
    }

    // Has external links (5 points)
    if (profileData.externalLinks && profileData.externalLinks.length > 0) {
      score += 5;
    }

    return Math.min(score, 100);
  }
}

export const profileRiskScorerService = new ProfileRiskScorerService();
