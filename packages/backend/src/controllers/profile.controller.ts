import { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { profileAnalyzerService } from '../services/analyzers/profile-analyzer.service.js';
import { enhancedProfileAnalyzerService } from '../services/analyzers/enhanced-profile-analyzer.service.js';
import { bigQueryLoggerService } from '../services/logging/bigquery-logger.service.js';
import { profileFetcherService } from '../services/scrapers/profile-fetcher.service.js';

/**
 * Profile Analyzer Controller
 * Handles social media profile analysis requests
 */

export interface ProfileAnalysisRequest {
  profileUrl?: string;
  platform?: 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'telegram' | 'other';
  username?: string;
  displayName?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  accountAge?: string;
  verified?: boolean;
  profilePhotoUrl?: string;
  recentPosts?: Array<{
    content: string;
    likes: number;
    comments: number;
    timestamp: Date;
  }>;
}

export class ProfileController {
  /**
   * Analyze social media profile
   * POST /api/v2/analyze/profile
   */
  async analyzeProfile(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const requestData: ProfileAnalysisRequest = req.body;

      // Validate request
      if (!requestData.profileUrl && !requestData.username) {
        res.status(400).json({
          success: false,
          error: 'Either profileUrl or username is required'
        });
        return;
      }

      logger.info(`Profile analysis requested by user ${userId} for URL: ${requestData.profileUrl || requestData.username}`);

      let profileData: any;
      let platform: string;

      // If URL is provided, FETCH REAL DATA from the platform
      if (requestData.profileUrl) {
        try {
          logger.info(`[Profile Controller] Fetching real profile data from URL...`);
          const fetchedData = await profileFetcherService.fetchProfile(requestData.profileUrl, requestData.platform);

          logger.info(`[Profile Controller] Successfully fetched profile data:`, {
            platform: fetchedData.platform,
            username: fetchedData.username,
            followers: fetchedData.followerCount,
            posts: fetchedData.postCount
          });

          platform = fetchedData.platform;

          // Build profile data from fetched information
          profileData = {
            platform: fetchedData.platform,
            username: fetchedData.username,
            displayName: fetchedData.displayName,
            bio: fetchedData.bio,
            verified: fetchedData.verified,
            accountAge: fetchedData.accountAge,

            accountMetrics: {
              followerCount: fetchedData.followerCount,
              followingCount: fetchedData.followingCount,
              postCount: fetchedData.postCount,
              followerFollowingRatio: this.calculateFollowerRatio(
                fetchedData.followerCount,
                fetchedData.followingCount
              )
            },

            profilePhoto: {
              imageUrl: fetchedData.profilePhotoUrl,
              reverseSearchHits: 0,
              matchedProfiles: []
            },

            behaviorPattern: {
              postFrequency: this.calculatePostFrequency(
                fetchedData.postCount,
                fetchedData.accountAge
              ),
              engagementRate: this.calculateEngagementRate(fetchedData.recentPosts),
              contentTypes: this.analyzeContentTypes(fetchedData.recentPosts),
              activityTimes: []
            },

            impersonationAnalysis: {
              claimedIdentity: fetchedData.displayName,
              verifiedCelebrity: null,
              similarityScore: 0,
              confidence: 0
            },

            recentPosts: fetchedData.recentPosts || []
          };
        } catch (fetchError) {
          logger.error(`[Profile Controller] Failed to fetch real profile data:`, fetchError);
          // Fall back to manual data if fetch fails
          logger.warn(`[Profile Controller] Falling back to manual data entry`);

          platform = requestData.platform || 'unknown';
          const username = requestData.username || this.extractUsernameFromUrl(requestData.profileUrl || '');

          profileData = {
            platform: platform || 'other',
            username: username || 'unknown',
            displayName: requestData.displayName || username || '',
            bio: requestData.bio || '',
            verified: requestData.verified || false,
            accountAge: requestData.accountAge || 'unknown',

            accountMetrics: {
              followerCount: requestData.followerCount || 0,
              followingCount: requestData.followingCount || 0,
              postCount: requestData.postCount || 0,
              followerFollowingRatio: this.calculateFollowerRatio(
                requestData.followerCount || 0,
                requestData.followingCount || 0
              )
            },

            profilePhoto: {
              imageUrl: requestData.profilePhotoUrl || null,
              reverseSearchHits: 0,
              matchedProfiles: []
            },

            behaviorPattern: {
              postFrequency: this.calculatePostFrequency(
                requestData.postCount || 0,
                requestData.accountAge || 'unknown'
              ),
              engagementRate: this.calculateEngagementRate(requestData.recentPosts || []),
              contentTypes: this.analyzeContentTypes(requestData.recentPosts || []),
              activityTimes: []
            },

            impersonationAnalysis: {
              claimedIdentity: requestData.displayName || username || '',
              verifiedCelebrity: null,
              similarityScore: 0,
              confidence: 0
            },

            recentPosts: requestData.recentPosts || []
          };
        }
      } else {
        // Manual data entry (no URL provided)
        logger.info(`[Profile Controller] Using manually entered profile data`);

        platform = requestData.platform || 'other';
        const username = requestData.username || 'unknown';

        profileData = {
          platform,
          username,
          displayName: requestData.displayName || username,
          bio: requestData.bio || '',
          verified: requestData.verified || false,
          accountAge: requestData.accountAge || 'unknown',

          accountMetrics: {
            followerCount: requestData.followerCount || 0,
            followingCount: requestData.followingCount || 0,
            postCount: requestData.postCount || 0,
            followerFollowingRatio: this.calculateFollowerRatio(
              requestData.followerCount || 0,
              requestData.followingCount || 0
            )
          },

          profilePhoto: {
            imageUrl: requestData.profilePhotoUrl || null,
            reverseSearchHits: 0,
            matchedProfiles: []
          },

          behaviorPattern: {
            postFrequency: this.calculatePostFrequency(
              requestData.postCount || 0,
              requestData.accountAge || 'unknown'
            ),
            engagementRate: this.calculateEngagementRate(requestData.recentPosts || []),
            contentTypes: this.analyzeContentTypes(requestData.recentPosts || []),
            activityTimes: []
          },

          impersonationAnalysis: {
            claimedIdentity: requestData.displayName || username,
            verifiedCelebrity: null,
            similarityScore: 0,
            confidence: 0
          },

          recentPosts: requestData.recentPosts || []
        };
      }

      logger.info(`Built profile data for analysis:`, {
        platform: profileData.platform,
        username: profileData.username,
        hasMetrics: profileData.accountMetrics.followerCount > 0
      });

      // Use ENHANCED analyzer for comprehensive analysis
      logger.info(`[Profile Controller] Using ENHANCED analyzer with 7+ data sources...`);
      const enhancedAnalysis = await enhancedProfileAnalyzerService.analyzeProfileComprehensive({
        platform: profileData.platform,
        username: profileData.username,
        displayName: profileData.displayName,
        bio: profileData.bio,
        verified: profileData.verified,
        accountAge: profileData.accountAge,
        followerCount: profileData.accountMetrics.followerCount,
        followingCount: profileData.accountMetrics.followingCount,
        postCount: profileData.accountMetrics.postCount,
        profilePhotoUrl: profileData.profilePhoto.imageUrl,
        recentPosts: profileData.recentPosts || [],
        externalLinks: []
      });

      logger.info(`[Profile Controller] Enhanced analysis complete: ${enhancedAnalysis.verdict} (${enhancedAnalysis.riskScore}/100)`);

      // Calculate latency
      const latency = Date.now() - startTime;

      // Log to BigQuery for ML training (async, don't await)
      bigQueryLoggerService.logAnalysis({
        userId,
        type: 'profile',
        input: {
          text: `${profileData.displayName} (${profileData.username}) - ${profileData.bio}`,
          type: 'profile_analysis',
          length: profileData.bio.length,
          metadata: {
            platform: profileData.platform,
            followerCount: profileData.accountMetrics.followerCount,
            verified: profileData.verified
          }
        },
        verdict: enhancedAnalysis.riskLevel,
        specificData: {
          riskScore: enhancedAnalysis.riskScore,
          verdict: enhancedAnalysis.verdict,
          redFlags: enhancedAnalysis.technicalView.redFlags.length,
          platform: profileData.platform
        },
        latency,
        cost: 0.001, // Minimal cost for AI analysis
        timestamp: new Date()
      }).catch(err => logger.error('BigQuery logging failed:', err));

      // Return DUAL-VIEW response (Simple + Technical)
      res.status(200).json({
        success: true,
        data: {
          // Core assessment
          riskScore: enhancedAnalysis.riskScore,
          verdict: enhancedAnalysis.verdict,
          confidenceLevel: enhancedAnalysis.confidenceLevel,
          riskLevel: enhancedAnalysis.riskLevel,

          // Simple view (elderly-friendly)
          simpleView: enhancedAnalysis.simpleView,

          // Technical view (detailed)
          technicalView: enhancedAnalysis.technicalView,

          // Profile data for display
          profileData: {
            platform: profileData.platform,
            username: profileData.username,
            displayName: profileData.displayName,
            bio: profileData.bio,
            verified: profileData.verified,
            accountAge: profileData.accountAge,
            profilePhotoUrl: profileData.profilePhoto.imageUrl,
            followers: profileData.accountMetrics.followerCount,
            following: profileData.accountMetrics.followingCount,
            posts: profileData.accountMetrics.postCount
          },

          // Metadata
          analysisMetadata: {
            analyzedAt: new Date().toISOString(),
            latency,
            platform: profileData.platform,
            dataSource: requestData.profileUrl ? 'url' : 'manual',
            dataSourcesChecked: enhancedAnalysis.technicalView.dataSourcesChecked.length,
            aiPowered: true
          }
        }
      });

    } catch (error) {
      logger.error('Profile analysis error:', error);

      res.status(500).json({
        success: false,
        error: 'Profile analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get supported platforms
   * GET /api/v2/analyze/profile/platforms
   */
  async getSupportedPlatforms(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          platforms: [
            { id: 'facebook', name: 'Facebook', icon: '📘' },
            { id: 'instagram', name: 'Instagram', icon: '📷' },
            { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
            { id: 'twitter', name: 'Twitter/X', icon: '🐦' },
            { id: 'telegram', name: 'Telegram', icon: '✈️' },
            { id: 'other', name: 'Other', icon: '🌐' }
          ]
        }
      });
    } catch (error) {
      logger.error('Get platforms error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch platforms' });
    }
  }

  /**
   * Helper: Extract username from profile URL
   */
  private extractUsernameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

      // Common patterns: /username, /profile/username, /u/username
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1];
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Helper: Calculate follower ratio
   */
  private calculateFollowerRatio(followers: number, following: number): number {
    if (following === 0) return followers > 0 ? 999 : 0;
    return followers / following;
  }

  /**
   * Helper: Calculate post frequency
   */
  private calculatePostFrequency(postCount: number, accountAge: string): number {
    // Parse account age (e.g., "2 years", "6 months", "30 days")
    const ageMatch = accountAge.match(/(\d+)\s*(year|month|day)/i);
    if (!ageMatch) return 0;

    const value = parseInt(ageMatch[1]);
    const unit = ageMatch[2].toLowerCase();

    let daysOld = 0;
    if (unit.startsWith('year')) daysOld = value * 365;
    else if (unit.startsWith('month')) daysOld = value * 30;
    else if (unit.startsWith('day')) daysOld = value;

    if (daysOld === 0) return 0;

    // Posts per day
    return postCount / daysOld;
  }

  /**
   * Helper: Calculate engagement rate
   */
  private calculateEngagementRate(recentPosts: ProfileAnalysisRequest['recentPosts']): number {
    if (!recentPosts || recentPosts.length === 0) return 0;

    const totalEngagement = recentPosts.reduce((sum, post) => {
      return sum + post.likes + post.comments;
    }, 0);

    return totalEngagement / recentPosts.length;
  }

  /**
   * Helper: Analyze content types
   */
  private analyzeContentTypes(recentPosts: ProfileAnalysisRequest['recentPosts']): string[] {
    if (!recentPosts || recentPosts.length === 0) return [];

    const types: string[] = [];

    for (const post of recentPosts) {
      const content = post.content.toLowerCase();

      if (/crypto|bitcoin|investment|trading/i.test(content)) {
        types.push('financial');
      }
      if (/giveaway|contest|win|prize/i.test(content)) {
        types.push('promotional');
      }
      if (/dm me|send message|click link/i.test(content)) {
        types.push('solicitation');
      }
      if (content.length < 50) {
        types.push('short_text');
      }
    }

    return [...new Set(types)]; // Remove duplicates
  }
}

export const profileController = new ProfileController();
