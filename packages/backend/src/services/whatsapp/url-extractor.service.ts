import { logger } from '../../config/logger.js';

/**
 * URL Extractor Service
 *
 * Extracts and validates URLs from WhatsApp messages.
 * Handles shortened URLs, deduplication, and validation.
 */
class URLExtractorService {
  // Comprehensive URL regex pattern
  private readonly urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

  // Common URL shortener domains
  private readonly shortenerDomains = [
    'bit.ly',
    'tinyurl.com',
    't.co',
    'goo.gl',
    'ow.ly',
    'short.link',
    'tiny.cc',
    'is.gd',
    'buff.ly',
    'adf.ly'
  ];

  /**
   * Extract all URLs from message text
   * Returns array of unique, validated URLs (max 5)
   */
  public extractURLs(messageText: string): string[] {
    if (!messageText || typeof messageText !== 'string') {
      return [];
    }

    try {
      // Extract all URLs using regex
      const matches = messageText.match(this.urlRegex) || [];

      if (matches.length === 0) {
        logger.debug('[URLExtractor] No URLs found in message');
        return [];
      }

      // Deduplicate and normalize URLs
      const uniqueUrls = [...new Set(matches.map(url => this.normalizeURL(url)))];

      // Validate each URL
      const validUrls = uniqueUrls.filter(url => this.isValidURL(url));

      // Limit to max 5 URLs to prevent abuse
      const limitedUrls = validUrls.slice(0, 5);

      if (limitedUrls.length < validUrls.length) {
        logger.warn('[URLExtractor] Too many URLs in message, limited to 5', {
          totalFound: validUrls.length,
          returned: limitedUrls.length
        });
      }

      logger.info('[URLExtractor] URLs extracted from message', {
        totalMatches: matches.length,
        uniqueUrls: uniqueUrls.length,
        validUrls: validUrls.length,
        returnedUrls: limitedUrls.length,
        urls: limitedUrls
      });

      return limitedUrls;
    } catch (error) {
      logger.error('[URLExtractor] Error extracting URLs', { error, messageText });
      return [];
    }
  }

  /**
   * Normalize URL (trim, lowercase domain, etc.)
   */
  private normalizeURL(url: string): string {
    try {
      // Trim whitespace
      let normalized = url.trim();

      // Parse URL
      const parsed = new URL(normalized);

      // Lowercase the hostname
      parsed.hostname = parsed.hostname.toLowerCase();

      return parsed.toString();
    } catch (error) {
      // If parsing fails, return original trimmed URL
      return url.trim();
    }
  }

  /**
   * Validate if string is a properly formatted URL
   */
  private isValidURL(urlString: string): boolean {
    try {
      const url = new URL(urlString);

      // Must be http or https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }

      // Must have a hostname
      if (!url.hostname || url.hostname.length === 0) {
        return false;
      }

      // Hostname must have at least one dot (e.g., example.com)
      if (!url.hostname.includes('.')) {
        return false;
      }

      // Reject localhost and private IPs (security measure)
      if (this.isLocalOrPrivateHost(url.hostname)) {
        logger.warn('[URLExtractor] Rejected local/private URL', { url: urlString });
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if hostname is localhost or private IP
   */
  private isLocalOrPrivateHost(hostname: string): boolean {
    // Check for localhost
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return true;
    }

    // Check for 127.0.0.1
    if (hostname.startsWith('127.')) {
      return true;
    }

    // Check for private IP ranges
    if (hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.2') ||
        hostname.startsWith('172.3')) {
      return true;
    }

    return false;
  }

  /**
   * Check if URL is from a URL shortener service
   */
  public isShortenerURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.shortenerDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Get domain from URL
   */
  public getDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if message contains any URLs
   */
  public hasURLs(messageText: string): boolean {
    if (!messageText || typeof messageText !== 'string') {
      return false;
    }
    return this.urlRegex.test(messageText);
  }

  /**
   * Count URLs in message
   */
  public countURLs(messageText: string): number {
    const urls = this.extractURLs(messageText);
    return urls.length;
  }

  /**
   * Get URL analysis summary
   */
  public analyzeURLs(messageText: string): {
    hasURLs: boolean;
    count: number;
    urls: string[];
    hasShorteners: boolean;
    shortenerURLs: string[];
  } {
    const urls = this.extractURLs(messageText);
    const shortenerURLs = urls.filter(url => this.isShortenerURL(url));

    return {
      hasURLs: urls.length > 0,
      count: urls.length,
      urls,
      hasShorteners: shortenerURLs.length > 0,
      shortenerURLs
    };
  }
}

// Export singleton instance
export const urlExtractor = new URLExtractorService();
