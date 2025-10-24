/**
 * RIOT Feed Checker
 *
 * RIOT (Routing for Internet Open Transit) is a feed of known good IP addresses
 * maintained by Cloudflare. It contains IP ranges for legitimate services like:
 * - Google services
 * - Apple services
 * - Facebook/Meta
 * - Microsoft services
 * - CDN providers
 * - Other well-known internet services
 *
 * IPs in RIOT are considered legitimate and reduce false positive risk
 */

import { logger } from '../../../config/logger.js';

export interface RIOTCheckResult {
  isRIOT: boolean;
  category?: string;
  description?: string;
  confidence: number;
}

export class RIOTChecker {
  // Major service providers in RIOT feed
  // In production, this would be populated from Cloudflare's RIOT API or feed
  // For now, we'll use well-known IP ranges and patterns

  private static readonly KNOWN_LEGITIMATE_SERVICES = [
    // Google
    { name: 'Google', category: 'search_engine', ipRanges: ['8.8.8.0/24', '8.8.4.0/24'], confidence: 100 },
    { name: 'Google Cloud', category: 'cloud_provider', ipRanges: ['35.0.0.0/8', '34.0.0.0/8'], confidence: 95 },

    // Microsoft
    { name: 'Microsoft Azure', category: 'cloud_provider', ipRanges: ['40.0.0.0/8', '52.0.0.0/8'], confidence: 95 },
    { name: 'Microsoft 365', category: 'saas', ipRanges: ['13.107.0.0/16'], confidence: 95 },

    // Amazon AWS
    { name: 'Amazon AWS', category: 'cloud_provider', ipRanges: ['52.0.0.0/8', '54.0.0.0/8'], confidence: 95 },

    // Facebook/Meta
    { name: 'Facebook', category: 'social_media', ipRanges: ['31.13.0.0/16', '157.240.0.0/16'], confidence: 100 },

    // Apple
    { name: 'Apple Services', category: 'technology', ipRanges: ['17.0.0.0/8'], confidence: 100 },

    // Cloudflare (itself)
    { name: 'Cloudflare', category: 'cdn', ipRanges: ['1.1.1.0/24', '1.0.0.0/24'], confidence: 100 },

    // Akamai
    { name: 'Akamai CDN', category: 'cdn', ipRanges: ['23.0.0.0/8'], confidence: 95 },
  ];

  private static readonly RIOT_CATEGORIES = {
    search_engine: { name: 'Search Engine', trustScore: 100 },
    social_media: { name: 'Social Media', trustScore: 95 },
    cloud_provider: { name: 'Cloud Provider', trustScore: 90 },
    cdn: { name: 'CDN Provider', trustScore: 95 },
    saas: { name: 'SaaS Provider', trustScore: 90 },
    technology: { name: 'Technology Company', trustScore: 95 },
    email_provider: { name: 'Email Provider', trustScore: 90 },
  };

  /**
   * Check if IP belongs to RIOT feed
   */
  async check(ip: string): Promise<RIOTCheckResult> {
    logger.debug(`[RIOT Checker] Checking IP: ${ip}`);

    // In production, this would query Cloudflare's RIOT API:
    // https://www.cloudflare.com/ips-v4/riot/
    // For now, we'll do pattern matching

    // Check against known legitimate services
    for (const service of RIOTChecker.KNOWN_LEGITIMATE_SERVICES) {
      if (this.ipMatchesRanges(ip, service.ipRanges)) {
        logger.info(`[RIOT Checker] IP ${ip} belongs to ${service.name} (${service.category})`);

        return {
          isRIOT: true,
          category: service.category,
          description: `IP belongs to ${service.name}`,
          confidence: service.confidence
        };
      }
    }

    logger.debug(`[RIOT Checker] IP ${ip} not in RIOT feed`);

    return {
      isRIOT: false,
      confidence: 0
    };
  }

  /**
   * Simple IP range matching (simplified)
   * In production, use proper CIDR matching library
   */
  private ipMatchesRanges(ip: string, ranges: string[]): boolean {
    // Very simplified - just checks first octet
    // Real implementation would use proper CIDR matching
    const ipParts = ip.split('.');
    const firstOctet = parseInt(ipParts[0]);

    for (const range of ranges) {
      const rangeParts = range.split('/')[0].split('.');
      const rangeFirstOctet = parseInt(rangeParts[0]);

      // Simple first octet match for demo
      if (firstOctet === rangeFirstOctet) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if domain belongs to a known legitimate service
   */
  async checkDomain(domain: string): Promise<RIOTCheckResult> {
    logger.debug(`[RIOT Checker] Checking domain: ${domain}`);

    // Well-known legitimate domains
    const legitimateDomains = [
      { pattern: /^(www\.)?google\.com$/i, name: 'Google', category: 'search_engine', confidence: 100 },
      { pattern: /^(www\.)?microsoft\.com$/i, name: 'Microsoft', category: 'technology', confidence: 100 },
      { pattern: /^(www\.)?apple\.com$/i, name: 'Apple', category: 'technology', confidence: 100 },
      { pattern: /^(www\.)?facebook\.com$/i, name: 'Facebook', category: 'social_media', confidence: 100 },
      { pattern: /^(www\.)?amazon\.com$/i, name: 'Amazon', category: 'ecommerce', confidence: 100 },
      { pattern: /^(www\.)?twitter\.com$/i, name: 'Twitter', category: 'social_media', confidence: 100 },
      { pattern: /^(www\.)?linkedin\.com$/i, name: 'LinkedIn', category: 'social_media', confidence: 100 },
      { pattern: /^(www\.)?github\.com$/i, name: 'GitHub', category: 'saas', confidence: 100 },
      { pattern: /^(www\.)?stackoverflow\.com$/i, name: 'Stack Overflow', category: 'technology', confidence: 100 },
    ];

    for (const { pattern, name, category, confidence } of legitimateDomains) {
      if (pattern.test(domain)) {
        logger.info(`[RIOT Checker] Domain ${domain} is legitimate service: ${name}`);

        return {
          isRIOT: true,
          category,
          description: `Domain belongs to ${name}`,
          confidence
        };
      }
    }

    return {
      isRIOT: false,
      confidence: 0
    };
  }

  /**
   * Get RIOT category trust score
   */
  static getCategoryTrustScore(category: string): number {
    const categoryInfo = RIOTChecker.RIOT_CATEGORIES[category as keyof typeof RIOTChecker.RIOT_CATEGORIES];
    return categoryInfo?.trustScore || 0;
  }

  /**
   * Get list of supported RIOT categories
   */
  static getCategories(): string[] {
    return Object.keys(RIOTChecker.RIOT_CATEGORIES);
  }
}
