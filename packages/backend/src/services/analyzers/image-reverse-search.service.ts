import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';

/**
 * Image Reverse Search Service
 * Searches for profile images across the web using Google Images and TinEye
 */

export interface ImageSearchResult {
  source: 'google' | 'tineye';
  matchCount: number;
  firstSeenDate: string | null;
  duplicateProfiles: string[];
  similarImageUrls: string[];
  possibleStockPhoto: boolean;
}

export class ImageReverseSearchService {
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  /**
   * Search for image across multiple reverse image search engines
   */
  async searchImage(imageUrl: string): Promise<{
    totalMatches: number;
    results: ImageSearchResult[];
    summary: string;
  }> {
    try {
      logger.info(`[Image Search] Searching for image: ${imageUrl.substring(0, 100)}`);

      const results: ImageSearchResult[] = [];

      // Run searches in parallel
      const [googleResult, tineyeResult] = await Promise.allSettled([
        this.searchGoogleImages(imageUrl),
        this.searchTinEye(imageUrl)
      ]);

      if (googleResult.status === 'fulfilled') {
        results.push(googleResult.value);
      }

      if (tineyeResult.status === 'fulfilled') {
        results.push(tineyeResult.value);
      }

      const totalMatches = results.reduce((sum, r) => sum + r.matchCount, 0);
      const possibleStock = results.some(r => r.possibleStockPhoto);

      let summary = '';
      if (totalMatches === 0) {
        summary = 'Profile photo appears unique - not found elsewhere on the web';
      } else if (totalMatches < 5) {
        summary = `Profile photo found on ${totalMatches} other websites - likely legitimate`;
      } else if (totalMatches < 10) {
        summary = `Profile photo found on ${totalMatches} websites - possible stock photo or reused image`;
      } else {
        summary = `Profile photo found on ${totalMatches}+ websites - likely stock photo or stolen image`;
      }

      if (possibleStock) {
        summary += ' (matches stock photo characteristics)';
      }

      logger.info(`[Image Search] Complete: ${totalMatches} matches found`);

      return {
        totalMatches,
        results,
        summary
      };
    } catch (error) {
      logger.error('[Image Search] Error:', error);
      return {
        totalMatches: 0,
        results: [],
        summary: 'Unable to perform image search'
      };
    }
  }

  /**
   * Search Google Images (via scraping)
   */
  private async searchGoogleImages(imageUrl: string): Promise<ImageSearchResult> {
    try {
      // Google reverse image search URL
      const searchUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);

      // Try to extract match count from results
      const resultStats = $('#result-stats').text();
      const matchCountText = resultStats.match(/About ([\d,]+) results/i);
      const matchCount = matchCountText ? parseInt(matchCountText[1].replace(/,/g, '')) : 0;

      // Extract URLs from search results
      const duplicateProfiles: string[] = [];
      const similarImageUrls: string[] = [];

      $('a[href^="http"]').each((i, elem) => {
        if (i >= 20) return; // Limit to first 20
        const url = $(elem).attr('href') || '';

        // Check if it's a social media profile
        if (this.isSocialMediaUrl(url)) {
          duplicateProfiles.push(url);
        }
      });

      // Check for stock photo indicators
      const pageText = $('body').text().toLowerCase();
      const possibleStockPhoto =
        pageText.includes('stock photo') ||
        pageText.includes('shutterstock') ||
        pageText.includes('getty images') ||
        pageText.includes('istockphoto') ||
        pageText.includes('adobe stock');

      return {
        source: 'google',
        matchCount: Math.min(matchCount, 999),
        firstSeenDate: null, // Google doesn't provide this easily
        duplicateProfiles: [...new Set(duplicateProfiles)].slice(0, 10),
        similarImageUrls: [...new Set(similarImageUrls)].slice(0, 10),
        possibleStockPhoto
      };
    } catch (error) {
      logger.error('[Google Image Search] Error:', error);
      return {
        source: 'google',
        matchCount: 0,
        firstSeenDate: null,
        duplicateProfiles: [],
        similarImageUrls: [],
        possibleStockPhoto: false
      };
    }
  }

  /**
   * Search TinEye (via public API/scraping)
   */
  private async searchTinEye(imageUrl: string): Promise<ImageSearchResult> {
    try {
      // TinEye search URL
      const searchUrl = `https://tineye.com/search?url=${encodeURIComponent(imageUrl)}`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      // Extract match count
      const matchText = $('.matches-count').first().text();
      const matchCount = parseInt(matchText.match(/\d+/)?.[0] || '0');

      // Extract first seen date
      let firstSeenDate: string | null = null;
      const oldestMatch = $('.match-row').last();
      if (oldestMatch.length) {
        const dateText = oldestMatch.find('.match-date').text();
        firstSeenDate = this.parseDate(dateText);
      }

      // Extract duplicate URLs
      const duplicateProfiles: string[] = [];
      $('.match-row').slice(0, 10).each((i, elem) => {
        const url = $(elem).find('a.match-thumb').attr('href') || '';
        if (url && this.isSocialMediaUrl(url)) {
          duplicateProfiles.push(url);
        }
      });

      return {
        source: 'tineye',
        matchCount,
        firstSeenDate,
        duplicateProfiles: [...new Set(duplicateProfiles)],
        similarImageUrls: [],
        possibleStockPhoto: false
      };
    } catch (error) {
      logger.error('[TinEye Search] Error:', error);
      return {
        source: 'tineye',
        matchCount: 0,
        firstSeenDate: null,
        duplicateProfiles: [],
        similarImageUrls: [],
        possibleStockPhoto: false
      };
    }
  }

  /**
   * Check if URL is a social media platform
   */
  private isSocialMediaUrl(url: string): boolean {
    const socialPlatforms = [
      'facebook.com',
      'instagram.com',
      'twitter.com',
      'x.com',
      'linkedin.com',
      'tiktok.com',
      'youtube.com',
      'pinterest.com',
      'snapchat.com'
    ];

    return socialPlatforms.some(platform => url.includes(platform));
  }

  /**
   * Parse date string to ISO format
   */
  private parseDate(dateText: string): string | null {
    try {
      // Handle various date formats
      const date = new Date(dateText);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const imageReverseSearchService = new ImageReverseSearchService();
