import axios from 'axios';
import { logger } from '../../config/logger.js';
import { elaraAuthService } from './elara-auth.service.js';

/**
 * Profile Checker Service for WhatsApp
 *
 * Analyzes social media profile URLs sent via WhatsApp
 */
class ProfileCheckerService {
  private readonly elaraApiBaseUrl: string;

  constructor() {
    this.elaraApiBaseUrl = process.env.ELARA_API_BASE_URL || 'https://elara-backend-64tf.onrender.com/api';
  }

  /**
   * Extract social media URLs from text
   */
  public extractProfileUrls(text: string): string[] {
    const urls: string[] = [];

    // Regex patterns for social media platforms
    const patterns = [
      // Facebook
      /https?:\/\/(www\.)?(facebook|fb)\.com\/[a-zA-Z0-9._-]+/gi,
      // Instagram
      /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._-]+/gi,
      // Twitter/X
      /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/gi,
      // LinkedIn
      /https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9_-]+/gi,
      // Telegram
      /https?:\/\/(www\.)?(t\.me|telegram\.me)\/[a-zA-Z0-9_]+/gi,
      // TikTok
      /https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/gi
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        urls.push(...matches);
      }
    }

    // Remove duplicates
    return [...new Set(urls)];
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): string {
    if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('t.me') || url.includes('telegram.me')) return 'telegram';
    if (url.includes('tiktok.com')) return 'tiktok';
    return 'other';
  }

  /**
   * Check if text requests profile analysis
   */
  public shouldCheckProfile(text: string): boolean {
    const keywords = [
      'profile',
      'account',
      'scammer',
      'fake account',
      'is this real',
      'who is this',
      'check this person',
      'suspicious profile',
      'legit?',
      'trustworthy'
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Analyze social media profile using Elara API
   */
  public async analyzeProfile(profileUrl: string): Promise<any> {
    try {
      logger.info('[ProfileChecker] Analyzing profile:', profileUrl);

      // Get authentication token
      const token = await elaraAuthService.getToken();

      // Detect platform
      const platform = this.detectPlatform(profileUrl);

      // Call Elara profile analyzer API
      const response = await axios.post(
        `${this.elaraApiBaseUrl}/v2/analyze/profile`,
        {
          profileUrl,
          platform
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 45000 // 45 seconds for profile analysis
        }
      );

      logger.info('[ProfileChecker] Profile analysis complete:', {
        profileUrl,
        riskScore: response.data.data?.riskScore,
        verdict: response.data.data?.verdict
      });

      return {
        success: true,
        profileUrl,
        platform,
        riskScore: response.data.data?.riskScore || 0,
        verdict: response.data.data?.verdict || 'Unknown',
        riskLevel: response.data.data?.riskLevel || 'unknown',
        simpleView: response.data.data?.simpleView || {},
        technicalView: response.data.data?.technicalView || {},
        profileData: response.data.data?.profileData || {}
      };
    } catch (error: any) {
      logger.error('[ProfileChecker] Profile analysis failed:', {
        profileUrl,
        error: error.message
      });

      return {
        success: false,
        profileUrl,
        platform: this.detectPlatform(profileUrl),
        error: error.message,
        riskLevel: 'error',
        riskScore: 0
      };
    }
  }

  /**
   * Analyze multiple profiles
   */
  public async analyzeMultipleProfiles(profileUrls: string[]): Promise<any[]> {
    // Limit to 3 profiles max to avoid timeout
    const urlsToCheck = profileUrls.slice(0, 3);

    logger.info('[ProfileChecker] Analyzing multiple profiles:', {
      total: profileUrls.length,
      analyzing: urlsToCheck.length
    });

    // Analyze in parallel
    const results = await Promise.all(
      urlsToCheck.map(url => this.analyzeProfile(url))
    );

    return results;
  }
}

export const profileCheckerService = new ProfileCheckerService();
