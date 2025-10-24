import { logger } from '../../config/logger.js';
import { imageReverseSearchService } from './image-reverse-search.service.js';
import { contentAnalyzerService } from './content-analyzer.service.js';
import { scamDatabaseService } from './scam-database.service.js';
import { profileRiskScorerService, type RiskFactors } from './profile-risk-scorer.service.js';
import { aiService } from '../ai/ai.service.js';

/**
 * Enhanced Profile Analyzer Service
 * Combines all analysis services + AI for comprehensive profile safety check
 */

export interface EnhancedProfileAnalysisResult {
  // Core Assessment
  riskScore: number; // 0-100
  verdict: 'SAFE' | 'CAUTION' | 'DANGER';
  confidenceLevel: 'High' | 'Medium' | 'Low';
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';

  // Simple View (Elderly-Friendly)
  simpleView: {
    verdict: 'SAFE' | 'CAUTION' | 'DANGER';
    riskPercentage: number;
    headline: string;
    summary: string;
    warningList: Array<{
      icon: string;
      title: string;
      description: string;
      whyItMatters: string;
    }>;
    positiveList: Array<{
      icon: string;
      description: string;
    }>;
    advice: {
      doNot: string[];
      safeActions: string[];
    };
  };

  // Technical View (Detailed)
  technicalView: {
    dataSourcesChecked: string[];
    redFlags: Array<{
      severity: 'Severe' | 'Moderate' | 'Minor';
      category: string;
      finding: string;
      evidence: string;
      riskContribution: number;
    }>;
    positiveIndicators: string[];
    detailedMetrics: {
      accountInfo: any;
      audienceMetrics: any;
      contentAnalysis: any;
      imageForensics: any;
      crossPlatform: any;
    };
    fraudPatterns: Array<{
      pattern: string;
      matchPercentage: number;
    }>;
    investigationSteps: string[];
    aiAnalysis: {
      fullAnalysis: string;
      keyFindings: string[];
      recommendations: string[];
    };
  };

  // Raw Data
  rawData: {
    imageSearch: any;
    contentAnalysis: any;
    scamDatabase: any;
    riskBreakdown: any;
  };
}

export class EnhancedProfileAnalyzerService {
  /**
   * Comprehensive profile analysis combining all data sources
   */
  async analyzeProfileComprehensive(profileData: {
    platform: string;
    username: string;
    displayName: string;
    bio: string;
    verified: boolean;
    accountAge: string;
    followerCount: number;
    followingCount: number;
    postCount: number;
    profilePhotoUrl: string | null;
    recentPosts: Array<{
      content: string;
      likes: number;
      comments: number;
      timestamp: Date;
    }>;
    externalLinks?: string[];
  }): Promise<EnhancedProfileAnalysisResult> {
    try {
      logger.info(`[Enhanced Analyzer] Starting comprehensive analysis for @${profileData.username}`);

      const dataSourcesChecked: string[] = [];

      // 1. Image Reverse Search
      logger.info('[Enhanced Analyzer] Running image reverse search...');
      let imageSearchResult = {
        totalMatches: 0,
        results: [],
        summary: 'No profile photo available'
      };

      if (profileData.profilePhotoUrl) {
        imageSearchResult = await imageReverseSearchService.searchImage(profileData.profilePhotoUrl);
        dataSourcesChecked.push('Image Reverse Search (Google & TinEye)');
      }

      // 2. Content Analysis
      logger.info('[Enhanced Analyzer] Analyzing content patterns...');
      const contentAnalysis = contentAnalyzerService.analyzeContent(profileData.recentPosts || []);
      dataSourcesChecked.push('Content Pattern Analysis');

      // 3. Scam Database Check
      logger.info('[Enhanced Analyzer] Checking scam databases...');
      const scamDbResult = await scamDatabaseService.checkScamDatabase({
        username: profileData.username,
        displayName: profileData.displayName,
        bio: profileData.bio,
        externalLinks: profileData.externalLinks || contentAnalysis.externalLinks
      });
      dataSourcesChecked.push('Scam Database Verification');

      // 4. Username Pattern Analysis
      logger.info('[Enhanced Analyzer] Analyzing username patterns...');
      const usernamePatternScore = scamDatabaseService.calculateUsernamePatternScore(profileData.username);
      dataSourcesChecked.push('Username Pattern Detection');

      // 5. Calculate Account Age in Days
      const accountAgeDays = this.parseAccountAgeToDays(profileData.accountAge);
      dataSourcesChecked.push('Account Metadata Extraction');

      // 6. Calculate Profile Completeness
      const profileCompleteness = profileRiskScorerService.calculateProfileCompleteness({
        displayName: profileData.displayName,
        bio: profileData.bio,
        profilePhotoUrl: profileData.profilePhotoUrl,
        verified: profileData.verified,
        followerCount: profileData.followerCount,
        postCount: profileData.postCount,
        externalLinks: contentAnalysis.externalLinks
      });

      // 7. Calculate Engagement Rate
      const engagementRate = this.calculateEngagementRate(profileData.recentPosts, profileData.followerCount);

      // 8. Build Risk Factors
      const riskFactors: RiskFactors = {
        accountAgeDays,
        imageReverseSearchHits: imageSearchResult.totalMatches,
        suspiciousKeywordCount: contentAnalysis.suspiciousKeywordCount,
        followerFollowingRatio: profileData.followingCount > 0
          ? profileData.followerCount / profileData.followingCount
          : profileData.followerCount > 0 ? 999 : 0,
        engagementRate,
        verificationStatus: profileData.verified,
        profileCompleteness,
        scamDatabaseMatch: scamDbResult.isKnownScammer,
        usernamePatternScore,
        contentRiskScore: contentAnalysis.riskScore,
        hasExternalLinks: contentAnalysis.externalLinkCount > 0,
        externalLinkCount: contentAnalysis.externalLinkCount,
        followerCount: profileData.followerCount,
        postCount: profileData.postCount
      };

      // 9. Calculate Risk Score
      logger.info('[Enhanced Analyzer] Calculating risk score...');
      const riskScore = profileRiskScorerService.calculateRiskScore(riskFactors);
      dataSourcesChecked.push('Risk Scoring Algorithm');

      // 10. AI Analysis
      logger.info('[Enhanced Analyzer] Generating AI analysis...');
      const aiAnalysis = await this.generateAIAnalysis({
        profileData,
        riskScore,
        imageSearchResult,
        contentAnalysis,
        scamDbResult,
        usernamePatternScore
      });
      dataSourcesChecked.push('AI Analysis (Claude)');

      // 11. Build Simple View (Elderly-Friendly)
      const simpleView = this.buildSimpleView(riskScore, aiAnalysis, profileData);

      // 12. Build Technical View (Detailed)
      const technicalView = this.buildTechnicalView({
        dataSourcesChecked,
        riskScore,
        profileData,
        imageSearchResult,
        contentAnalysis,
        scamDbResult,
        usernamePatternScore,
        aiAnalysis
      });

      logger.info(`[Enhanced Analyzer] Analysis complete: ${riskScore.verdict} (${riskScore.totalRiskScore}/100)`);

      return {
        riskScore: riskScore.totalRiskScore,
        verdict: riskScore.verdict,
        confidenceLevel: riskScore.confidenceLevel,
        riskLevel: riskScore.riskLevel,
        simpleView,
        technicalView,
        rawData: {
          imageSearch: imageSearchResult,
          contentAnalysis,
          scamDatabase: scamDbResult,
          riskBreakdown: riskScore.breakdown
        }
      };
    } catch (error) {
      logger.error('[Enhanced Analyzer] Error:', error);
      throw error;
    }
  }

  /**
   * Generate AI analysis with technical and user-friendly outputs
   */
  private async generateAIAnalysis(data: any): Promise<any> {
    try {
      const prompt = `You are a cybersecurity expert analyzing a social media profile for potential scam/spam/fake account indicators.

PROFILE DATA SUMMARY:
Platform: ${data.profileData.platform}
Username: @${data.profileData.username}
Display Name: ${data.profileData.displayName}
Bio: ${data.profileData.bio}
Verified: ${data.profileData.verified}
Account Age: ${data.profileData.accountAge}
Followers: ${data.profileData.followerCount}
Following: ${data.profileData.followingCount}
Posts: ${data.profileData.postCount}

IMAGE SEARCH RESULTS:
${data.imageSearchResult.summary}
Total Matches: ${data.imageSearchResult.totalMatches}

CONTENT ANALYSIS:
${data.contentAnalysis.summary}
Suspicious Keywords Found: ${data.contentAnalysis.suspiciousKeywords.join(', ')}
Financial Terms: ${data.contentAnalysis.financialTerms.join(', ')}
Urgency Phrases: ${data.contentAnalysis.urgencyPhrases.join(', ')}
External Links: ${data.contentAnalysis.externalLinkCount}

SCAM DATABASE:
${data.scamDbResult.details}
Confidence: ${data.scamDbResult.confidence}%

RISK SCORE: ${data.riskScore.totalRiskScore}/100
VERDICT: ${data.riskScore.verdict}

Provide your analysis in JSON format:
{
  "simpleExplanation": "2-3 sentence simple explanation for non-technical users",
  "concerns": ["List 3-5 main concerns in simple language"],
  "positives": ["List 2-3 positive things found"],
  "advice": ["3-5 clear action items"],
  "technicalAnalysis": "Detailed technical analysis",
  "keyFindings": ["List technical findings"],
  "fraudPatterns": [{"pattern": "name", "match": 0-100}],
  "recommendations": ["Investigation steps"]
}

Use simple language for non-technical sections. Be direct and clear.`;

      const response = await aiService.query({
        query: prompt,
        model: 'claude',
        useRAG: false
      });

      // Parse JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback if JSON parsing fails
      return {
        simpleExplanation: data.riskScore.summary,
        concerns: ['Unable to generate detailed analysis'],
        positives: ['Account exists'],
        advice: ['Exercise caution when interacting'],
        technicalAnalysis: 'AI analysis unavailable',
        keyFindings: [],
        fraudPatterns: [],
        recommendations: []
      };
    } catch (error) {
      logger.error('[AI Analysis] Error:', error);
      return {
        simpleExplanation: 'Analysis completed with some limitations',
        concerns: ['Unable to generate AI analysis'],
        positives: [],
        advice: ['Verify identity through official channels'],
        technicalAnalysis: 'AI analysis failed',
        keyFindings: [],
        fraudPatterns: [],
        recommendations: []
      };
    }
  }

  /**
   * Build simple view for elderly users
   */
  private buildSimpleView(riskScore: any, aiAnalysis: any, profileData: any): any {
    const warningList: any[] = [];
    const positiveList: any[] = [];

    // Convert technical red flags to simple warnings
    riskScore.breakdown.forEach((item: any) => {
      if (item.score > 0) {
        warningList.push({
          icon: item.severity === 'Severe' ? '🔴' : item.severity === 'Moderate' ? '⚠️' : '🟡',
          title: item.category,
          description: item.description,
          whyItMatters: this.explainWhyItMatters(item.category)
        });
      } else {
        positiveList.push({
          icon: '✓',
          description: item.description
        });
      }
    });

    let headline = '';
    if (riskScore.verdict === 'SAFE') {
      headline = 'This profile appears safe';
    } else if (riskScore.verdict === 'CAUTION') {
      headline = 'Be careful with this profile';
    } else {
      headline = 'This profile is dangerous - stay away';
    }

    return {
      verdict: riskScore.verdict,
      riskPercentage: riskScore.totalRiskScore,
      headline,
      summary: aiAnalysis.simpleExplanation || riskScore.summary,
      warningList: warningList.slice(0, 6), // Top 6 warnings
      positiveList: positiveList.slice(0, 3), // Top 3 positives
      advice: {
        doNot: [
          'Send money to this person',
          'Share personal information',
          'Click links they send you',
          'Trust investment advice from them'
        ],
        safeActions: [
          'Ask someone you trust for advice',
          'Report profile if they contact you',
          'Block if you feel uncomfortable',
          'Verify identity through official channels'
        ]
      }
    };
  }

  /**
   * Build technical view for detailed analysis
   */
  private buildTechnicalView(data: any): any {
    const redFlags: any[] = [];
    const positiveIndicators: string[] = [];

    data.riskScore.breakdown.forEach((item: any) => {
      if (item.score > 0) {
        redFlags.push({
          severity: item.severity,
          category: item.category,
          finding: item.description,
          evidence: `Score: ${item.score}/${item.maxScore} points`,
          riskContribution: item.score
        });
      } else {
        positiveIndicators.push(item.description);
      }
    });

    return {
      dataSourcesChecked: data.dataSourcesChecked,
      redFlags: redFlags.sort((a: any, b: any) => b.riskContribution - a.riskContribution),
      positiveIndicators,
      detailedMetrics: {
        accountInfo: {
          username: data.profileData.username,
          displayName: data.profileData.displayName,
          platform: data.profileData.platform,
          verified: data.profileData.verified,
          accountAge: data.profileData.accountAge
        },
        audienceMetrics: {
          followers: data.profileData.followerCount,
          following: data.profileData.followingCount,
          posts: data.profileData.postCount,
          ratio: (data.profileData.followingCount > 0
            ? data.profileData.followerCount / data.profileData.followingCount
            : 0).toFixed(2)
        },
        contentAnalysis: {
          postsAnalyzed: data.profileData.recentPosts?.length || 0,
          suspiciousKeywords: data.contentAnalysis.suspiciousKeywordCount,
          externalLinks: data.contentAnalysis.externalLinkCount,
          financialTerms: data.contentAnalysis.financialTerms.length,
          urgencyPhrases: data.contentAnalysis.urgencyPhrases.length
        },
        imageForensics: {
          reverseSearchHits: data.imageSearchResult.totalMatches,
          summary: data.imageSearchResult.summary
        },
        crossPlatform: {
          platform: data.profileData.platform,
          otherPlatformsChecked: 0
        }
      },
      fraudPatterns: data.aiAnalysis.fraudPatterns || [],
      investigationSteps: data.aiAnalysis.recommendations || [],
      aiAnalysis: {
        fullAnalysis: data.aiAnalysis.technicalAnalysis || '',
        keyFindings: data.aiAnalysis.keyFindings || [],
        recommendations: data.aiAnalysis.recommendations || []
      }
    };
  }

  /**
   * Explain why a red flag matters in simple terms
   */
  private explainWhyItMatters(category: string): string {
    const explanations: Record<string, string> = {
      'Account Age': 'Scammers often create new accounts to avoid detection',
      'Profile Photo Authenticity': 'Real people use unique photos, scammers steal images',
      'Suspicious Content': 'These words are commonly used in scams',
      'Follower/Following Ratio': 'Unusual patterns suggest fake or bot activity',
      'Verification Status': 'Verified accounts have proven their identity',
      'Profile Completeness': 'Scammers often skip profile details',
      'Scam Database Check': 'This pattern matches known scammers',
      'Username Pattern': 'Random usernames are often bots or scams',
      'Engagement Rate': 'Low engagement suggests fake followers'
    };

    return explanations[category] || 'This is a common indicator of suspicious accounts';
  }

  /**
   * Parse account age to days
   */
  private parseAccountAgeToDays(accountAge: string): number | null {
    if (!accountAge || accountAge === 'unknown') return null;

    // Handle ranges like "1-3 years" (take lower bound)
    const rangeMatch = accountAge.match(/(\d+)-\d+\s*(year|month|day)/i);
    if (rangeMatch) {
      const value = parseInt(rangeMatch[1]);
      const unit = rangeMatch[2].toLowerCase();

      if (unit.startsWith('year')) return value * 365;
      if (unit.startsWith('month')) return value * 30;
      if (unit.startsWith('day')) return value;
    }

    // Handle single values like "2 years"
    const singleMatch = accountAge.match(/(\d+)\s*(year|month|day|week)/i);
    if (singleMatch) {
      const value = parseInt(singleMatch[1]);
      const unit = singleMatch[2].toLowerCase();

      if (unit.startsWith('year')) return value * 365;
      if (unit.startsWith('month')) return value * 30;
      if (unit.startsWith('week')) return value * 7;
      if (unit.startsWith('day')) return value;
    }

    // Handle "5+" years
    const plusMatch = accountAge.match(/(\d+)\+\s*(year|month)/i);
    if (plusMatch) {
      const value = parseInt(plusMatch[1]);
      const unit = plusMatch[2].toLowerCase();

      if (unit.startsWith('year')) return value * 365;
      if (unit.startsWith('month')) return value * 30;
    }

    return null;
  }

  /**
   * Calculate engagement rate from posts
   */
  private calculateEngagementRate(
    posts: Array<{ likes: number; comments: number }>,
    followers: number
  ): number {
    if (!posts || posts.length === 0 || followers === 0) return 0;

    const totalEngagement = posts.reduce((sum, post) => sum + post.likes + post.comments, 0);
    const avgEngagement = totalEngagement / posts.length;

    return (avgEngagement / followers) * 100;
  }
}

export const enhancedProfileAnalyzerService = new EnhancedProfileAnalyzerService();
