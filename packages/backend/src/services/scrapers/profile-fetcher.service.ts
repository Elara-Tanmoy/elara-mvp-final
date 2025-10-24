import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';

/**
 * Real Profile Fetcher Service
 * Fetches actual profile data from social media platforms
 * Uses web scraping and public APIs
 */

export interface FetchedProfileData {
  platform: string;
  username: string;
  displayName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  verified: boolean;
  profilePhotoUrl: string | null;
  accountAge: string;
  recentPosts: Array<{
    content: string;
    likes: number;
    comments: number;
    timestamp: Date;
  }>;
}

export class ProfileFetcherService {
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Fetch profile data from URL
   */
  async fetchProfile(url: string, platform?: string): Promise<FetchedProfileData> {
    try {
      logger.info(`[Profile Fetcher] Fetching profile from: ${url}`);

      // Detect platform if not provided
      const detectedPlatform = platform || this.detectPlatform(url);
      logger.info(`[Profile Fetcher] Platform: ${detectedPlatform}`);

      // Route to appropriate fetcher
      switch (detectedPlatform) {
        case 'twitter':
          return await this.fetchTwitterProfile(url);
        case 'instagram':
          return await this.fetchInstagramProfile(url);
        case 'facebook':
          return await this.fetchFacebookProfile(url);
        case 'linkedin':
          return await this.fetchLinkedInProfile(url);
        case 'telegram':
          return await this.fetchTelegramProfile(url);
        default:
          return await this.fetchGenericProfile(url);
      }
    } catch (error) {
      logger.error('[Profile Fetcher] Error:', error);
      throw new Error(`Failed to fetch profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): string {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('facebook.com')) return 'facebook';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('t.me') || urlLower.includes('telegram')) return 'telegram';
    return 'unknown';
  }

  /**
   * Fetch Twitter/X profile using nitter.net (Twitter scraping proxy)
   */
  private async fetchTwitterProfile(url: string): Promise<FetchedProfileData> {
    try {
      const username = this.extractUsername(url);

      // Use nitter.net as scraping proxy (Twitter blocks direct scraping)
      const nitterUrl = `https://nitter.net/${username}`;

      const response = await axios.get(nitterUrl, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      // Extract data from nitter HTML
      const displayName = $('.profile-card-fullname').text().trim() || username;
      const bio = $('.profile-bio').text().trim();
      const stats = $('.profile-stat-num');

      const posts = parseInt($(stats[0]).text().replace(/,/g, '')) || 0;
      const following = parseInt($(stats[1]).text().replace(/,/g, '')) || 0;
      const followers = parseInt($(stats[2]).text().replace(/,/g, '')) || 0;

      const verified = $('.verified-icon').length > 0;
      const profilePhotoUrl = $('.profile-card-avatar').attr('src') || null;

      // Extract recent tweets
      const recentPosts: any[] = [];
      $('.timeline-item').slice(0, 10).each((i, elem) => {
        const content = $(elem).find('.tweet-content').text().trim();
        const statsText = $(elem).find('.tweet-stats').text();
        recentPosts.push({
          content: content.substring(0, 280),
          likes: this.parseNumber(statsText.match(/(\d+)\s*likes?/i)?.[1] || '0'),
          comments: this.parseNumber(statsText.match(/(\d+)\s*replies/i)?.[1] || '0'),
          timestamp: new Date()
        });
      });

      // Estimate account age (nitter doesn't show this directly)
      const accountAge = this.estimateAccountAge(posts, followers);

      return {
        platform: 'twitter',
        username,
        displayName,
        bio,
        followerCount: followers,
        followingCount: following,
        postCount: posts,
        verified,
        profilePhotoUrl,
        accountAge,
        recentPosts
      };
    } catch (error) {
      logger.error('[Twitter Fetch] Error:', error);
      throw new Error('Failed to fetch Twitter profile');
    }
  }

  /**
   * Fetch Instagram profile using public scraping
   */
  private async fetchInstagramProfile(url: string): Promise<FetchedProfileData> {
    try {
      const username = this.extractUsername(url);

      // Instagram public profile URL
      const profileUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;

      const response = await axios.get(profileUrl, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const data = response.data;
      const user = data?.graphql?.user || data?.user;

      if (!user) {
        throw new Error('Profile not found or rate limited');
      }

      const displayName = user.full_name || username;
      const bio = user.biography || '';
      const followers = user.edge_followed_by?.count || 0;
      const following = user.edge_follow?.count || 0;
      const posts = user.edge_owner_to_timeline_media?.count || 0;
      const verified = user.is_verified || false;
      const profilePhotoUrl = user.profile_pic_url_hd || user.profile_pic_url || null;

      // Extract recent posts
      const recentPosts: any[] = [];
      const edges = user.edge_owner_to_timeline_media?.edges || [];

      edges.slice(0, 10).forEach((edge: any) => {
        const node = edge.node;
        recentPosts.push({
          content: node.edge_media_to_caption?.edges[0]?.node?.text?.substring(0, 500) || '',
          likes: node.edge_liked_by?.count || 0,
          comments: node.edge_media_to_comment?.count || 0,
          timestamp: new Date(node.taken_at_timestamp * 1000)
        });
      });

      const accountAge = this.estimateAccountAge(posts, followers);

      return {
        platform: 'instagram',
        username,
        displayName,
        bio,
        followerCount: followers,
        followingCount: following,
        postCount: posts,
        verified,
        profilePhotoUrl,
        accountAge,
        recentPosts
      };
    } catch (error) {
      logger.error('[Instagram Fetch] Error:', error);
      throw new Error('Failed to fetch Instagram profile - may require login or is rate limited');
    }
  }

  /**
   * Fetch Facebook profile (limited public data)
   */
  private async fetchFacebookProfile(url: string): Promise<FetchedProfileData> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const username = this.extractUsername(url);

      // Facebook heavily restricts scraping, can only get limited data
      const displayName = $('meta[property="og:title"]').attr('content') || username;
      const bio = $('meta[property="og:description"]').attr('content') || '';
      const profilePhotoUrl = $('meta[property="og:image"]').attr('content') || null;

      // Facebook doesn't show counts publicly anymore
      return {
        platform: 'facebook',
        username,
        displayName,
        bio,
        followerCount: 0, // Not publicly available
        followingCount: 0,
        postCount: 0,
        verified: bio.includes('Verified') || bio.includes('Official'),
        profilePhotoUrl,
        accountAge: 'unknown',
        recentPosts: []
      };
    } catch (error) {
      logger.error('[Facebook Fetch] Error:', error);
      throw new Error('Failed to fetch Facebook profile - most data requires login');
    }
  }

  /**
   * Fetch LinkedIn profile
   */
  private async fetchLinkedInProfile(url: string): Promise<FetchedProfileData> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const username = this.extractUsername(url);

      // LinkedIn public profile scraping
      const displayName = $('h1.text-heading-xlarge').first().text().trim() ||
                         $('meta[property="og:title"]').attr('content') ||
                         username;

      const bio = $('.text-body-medium').first().text().trim() ||
                  $('meta[property="og:description"]').attr('content') || '';

      const profilePhotoUrl = $('meta[property="og:image"]').attr('content') || null;

      const connectionsText = $('.text-body-small').text();
      const connectionMatch = connectionsText.match(/(\d+[\d,]*)\s*connections?/i);
      const followers = connectionMatch ? this.parseNumber(connectionMatch[1]) : 0;

      return {
        platform: 'linkedin',
        username,
        displayName,
        bio,
        followerCount: followers,
        followingCount: 0,
        postCount: 0,
        verified: displayName.includes('LinkedIn') || displayName.includes('Official'),
        profilePhotoUrl,
        accountAge: 'unknown',
        recentPosts: []
      };
    } catch (error) {
      logger.error('[LinkedIn Fetch] Error:', error);
      throw new Error('Failed to fetch LinkedIn profile - most data requires login');
    }
  }

  /**
   * Fetch Telegram profile (very limited public data)
   */
  private async fetchTelegramProfile(url: string): Promise<FetchedProfileData> {
    try {
      const username = this.extractUsername(url);

      // Telegram public preview
      const response = await axios.get(`https://t.me/${username}`, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      const displayName = $('.tgme_page_title').text().trim() || username;
      const bio = $('.tgme_page_description').text().trim();
      const memberText = $('.tgme_page_extra').text();
      const memberMatch = memberText.match(/(\d+[\d,]*)\s*members?/i);
      const followers = memberMatch ? this.parseNumber(memberMatch[1]) : 0;

      const profilePhotoUrl = $('.tgme_page_photo_image').attr('src') || null;

      return {
        platform: 'telegram',
        username,
        displayName,
        bio,
        followerCount: followers,
        followingCount: 0,
        postCount: 0,
        verified: $('.tgme_page_verified').length > 0,
        profilePhotoUrl,
        accountAge: 'unknown',
        recentPosts: []
      };
    } catch (error) {
      logger.error('[Telegram Fetch] Error:', error);
      throw new Error('Failed to fetch Telegram profile');
    }
  }

  /**
   * Generic profile fetcher using meta tags
   */
  private async fetchGenericProfile(url: string): Promise<FetchedProfileData> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const username = this.extractUsername(url);

      return {
        platform: 'unknown',
        username,
        displayName: $('meta[property="og:title"]').attr('content') || username,
        bio: $('meta[property="og:description"]').attr('content') || '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        verified: false,
        profilePhotoUrl: $('meta[property="og:image"]').attr('content') || null,
        accountAge: 'unknown',
        recentPosts: []
      };
    } catch (error) {
      logger.error('[Generic Fetch] Error:', error);
      throw new Error('Failed to fetch profile from unknown platform');
    }
  }

  /**
   * Extract username from URL
   */
  private extractUsername(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

      // Handle LinkedIn's /in/ pattern
      if (url.includes('linkedin.com/in/')) {
        const inIndex = pathParts.indexOf('in');
        return pathParts[inIndex + 1] || pathParts[pathParts.length - 1];
      }

      return pathParts[0] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Parse number from string (handles 1.2M, 500K, etc.)
   */
  private parseNumber(str: string): number {
    const cleaned = str.replace(/,/g, '').trim();

    if (cleaned.toLowerCase().includes('m')) {
      return parseFloat(cleaned) * 1000000;
    }
    if (cleaned.toLowerCase().includes('k')) {
      return parseFloat(cleaned) * 1000;
    }

    return parseInt(cleaned) || 0;
  }

  /**
   * Estimate account age based on activity
   */
  private estimateAccountAge(posts: number, followers: number): string {
    // Very rough estimation
    if (posts > 10000 && followers > 100000) return '5+ years';
    if (posts > 5000 && followers > 50000) return '3-5 years';
    if (posts > 1000 && followers > 10000) return '1-3 years';
    if (posts > 100 && followers > 1000) return '6-12 months';
    if (posts > 10) return '1-6 months';
    return '0-30 days';
  }
}

export const profileFetcherService = new ProfileFetcherService();
