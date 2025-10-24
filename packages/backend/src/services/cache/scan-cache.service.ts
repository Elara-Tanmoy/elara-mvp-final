/**
 * Scan Result Caching Service
 * Caches scan results for well-known reputable sites to improve response times
 *
 * Features:
 * - Automatic caching for well-known domains (Google, Microsoft, etc.)
 * - 24-hour cache for safe sites
 * - 1-hour cache for medium/low risk sites
 * - No caching for high/critical risk sites
 */

import NodeCache from 'node-cache';
import { logger } from '../../config/logger.js';
import crypto from 'crypto';

interface CachedScanResult {
  url: string;
  riskScore: number;
  riskLevel: string;
  cachedAt: Date;
  expiresAt: Date;
  scanResult: any;
}

class ScanCacheService {
  private cache: NodeCache;

  // Well-known reputable domains that are safe to cache for longer periods
  private readonly WELL_KNOWN_SAFE_DOMAINS = [
    'google.com', 'youtube.com', 'facebook.com', 'amazon.com', 'microsoft.com',
    'apple.com', 'netflix.com', 'linkedin.com', 'twitter.com', 'instagram.com',
    'reddit.com', 'wikipedia.org', 'github.com', 'stackoverflow.com', 'cloudflare.com',
    'adobe.com', 'salesforce.com', 'zoom.us', 'dropbox.com', 'paypal.com',
    'ebay.com', 'yahoo.com', 'bing.com', 'live.com', 'office.com',
    'docs.google.com', 'drive.google.com', 'maps.google.com', 'mail.google.com'
  ];

  constructor() {
    // Initialize cache with 1 hour default TTL
    // maxKeys: 1000 to prevent memory overflow
    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour default
      checkperiod: 600, // Check for expired entries every 10 minutes
      useClones: false, // Don't clone objects for better performance
      maxKeys: 1000 // Maximum 1000 cached entries
    });

    logger.info('✅ Scan Cache Service initialized');
    logger.info(`   Cache TTL: 1 hour (default)`);
    logger.info(`   Well-known domains: ${this.WELL_KNOWN_SAFE_DOMAINS.length}`);
    logger.info(`   Max cached entries: 1000`);
  }

  /**
   * Generate cache key from URL
   */
  private getCacheKey(url: string): string {
    // Normalize URL (remove trailing slashes, lowercase, remove www)
    const normalizedUrl = url.toLowerCase()
      .replace(/\/$/, '')
      .replace(/^https?:\/\/(www\.)?/, '');

    // Create hash for consistent key length
    return crypto.createHash('md5').update(normalizedUrl).digest('hex');
  }

  /**
   * Check if domain is well-known and safe
   */
  private isWellKnownDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');

      return this.WELL_KNOWN_SAFE_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Get cache TTL based on risk level and domain reputation
   */
  private getCacheTTL(url: string, riskLevel: string): number {
    // Well-known domains get 24 hours cache
    if (this.isWellKnownDomain(url)) {
      return 86400; // 24 hours
    }

    // Cache based on risk level
    switch (riskLevel.toLowerCase()) {
      case 'safe':
        return 21600; // 6 hours for safe sites
      case 'low':
        return 7200;  // 2 hours for low risk
      case 'medium':
        return 3600;  // 1 hour for medium risk
      case 'high':
      case 'critical':
        return 0;     // No caching for dangerous sites
      default:
        return 3600;  // 1 hour default
    }
  }

  /**
   * Get cached scan result
   */
  public async get(url: string): Promise<CachedScanResult | null> {
    try {
      const cacheKey = this.getCacheKey(url);
      const cached = this.cache.get<CachedScanResult>(cacheKey);

      if (cached) {
        logger.info(`✅ Cache HIT for ${url}`);
        logger.info(`   Cached at: ${cached.cachedAt}`);
        logger.info(`   Expires at: ${cached.expiresAt}`);
        logger.info(`   Risk level: ${cached.riskLevel}`);

        return {
          ...cached,
          scanResult: {
            ...cached.scanResult,
            cached: true,
            cachedAt: cached.cachedAt
          }
        };
      }

      logger.info(`❌ Cache MISS for ${url}`);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store scan result in cache
   */
  public async set(url: string, scanResult: any): Promise<void> {
    try {
      const riskLevel = scanResult.riskLevel || 'medium';
      const ttl = this.getCacheTTL(url, riskLevel);

      // Don't cache high/critical risk sites
      if (ttl === 0) {
        logger.info(`⚠️  NOT caching ${url} (risk level: ${riskLevel})`);
        return;
      }

      const cacheKey = this.getCacheKey(url);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (ttl * 1000));

      const cachedData: CachedScanResult = {
        url,
        riskScore: scanResult.riskScore || 0,
        riskLevel,
        cachedAt: now,
        expiresAt,
        scanResult
      };

      this.cache.set(cacheKey, cachedData, ttl);

      const isWellKnown = this.isWellKnownDomain(url);
      logger.info(`💾 Cached scan result for ${url}`);
      logger.info(`   Risk level: ${riskLevel}`);
      logger.info(`   TTL: ${ttl}s (${Math.round(ttl / 3600)} hours)`);
      logger.info(`   Well-known domain: ${isWellKnown ? 'Yes' : 'No'}`);
      logger.info(`   Expires: ${expiresAt.toISOString()}`);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Manually invalidate cache for a URL
   */
  public async invalidate(url: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(url);
      const deleted = this.cache.del(cacheKey);

      if (deleted > 0) {
        logger.info(`🗑️  Cache invalidated for ${url}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      return false;
    }
  }

  /**
   * Clear all cached entries
   */
  public async clear(): Promise<void> {
    try {
      this.cache.flushAll();
      logger.info('🗑️  All cache entries cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }
}

export const scanCacheService = new ScanCacheService();
