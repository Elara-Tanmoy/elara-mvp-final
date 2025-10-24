/**
 * Stage 0.2: Cache Manager
 * Redis-based caching for scan results and reachability data
 */

import { CacheCheckResult, URLComponents } from './types.js';
import { logger } from '../../config/logger.js';

export class CacheManager {
  private redis: any; // Redis client will be injected
  private memoryCache: Map<string, { data: any; expiresAt: number }> = new Map();
  private readonly MEMORY_CACHE_MAX_SIZE = 1000;

  constructor(redisClient?: any) {
    this.redis = redisClient;
  }

  /**
   * Check cache for existing scan result
   * TTL varies by risk level:
   * - CRITICAL: 5 minutes (300s)
   * - HIGH: 30 minutes (1800s)
   * - MEDIUM: 1 hour (3600s)
   * - LOW: 4 hours (14400s)
   * - SAFE: 24 hours (86400s)
   */
  async checkScanCache(urlHash: string): Promise<CacheCheckResult> {
    try {
      // Try Redis first
      if (this.redis) {
        const cached = await this.redis.get(`scan:${urlHash}`);
        if (cached) {
          const data = JSON.parse(cached);
          const age = Date.now() - new Date(data.timestamp).getTime();

          logger.info(`[Cache] HIT from Redis for ${urlHash.slice(0, 8)}... (age: ${Math.round(age / 1000)}s)`);

          return {
            hit: true,
            age: Math.round(age / 1000),
            data,
            source: 'redis'
          };
        }
      }

      // Fallback to memory cache
      const memoryCached = this.memoryCache.get(`scan:${urlHash}`);
      if (memoryCached && memoryCached.expiresAt > Date.now()) {
        const age = Date.now() - memoryCached.data.timestamp;

        logger.info(`[Cache] HIT from memory for ${urlHash.slice(0, 8)}... (age: ${Math.round(age / 1000)}s)`);

        return {
          hit: true,
          age: Math.round(age / 1000),
          data: memoryCached.data,
          source: 'memory'
        };
      }

      // Clean expired memory cache entry
      if (memoryCached) {
        this.memoryCache.delete(`scan:${urlHash}`);
      }

      logger.info(`[Cache] MISS for ${urlHash.slice(0, 8)}...`);

      return {
        hit: false,
        source: 'none'
      };
    } catch (error) {
      logger.error('[Cache] Error checking cache:', error);
      return {
        hit: false,
        source: 'none'
      };
    }
  }

  /**
   * Save scan result to cache
   */
  async saveScanCache(urlHash: string, scanResult: any): Promise<boolean> {
    try {
      // Determine TTL based on risk level
      const ttl = this.getTTLForRiskLevel(scanResult.riskLevel);

      const cacheData = {
        ...scanResult,
        timestamp: Date.now(),
        cached: true
      };

      // Save to Redis
      if (this.redis) {
        await this.redis.setex(`scan:${urlHash}`, ttl, JSON.stringify(cacheData));
        logger.info(`[Cache] SAVED to Redis for ${urlHash.slice(0, 8)}... (TTL: ${ttl}s)`);
      }

      // Save to memory cache as backup
      this.saveToMemoryCache(`scan:${urlHash}`, cacheData, ttl);

      return true;
    } catch (error) {
      logger.error('[Cache] Error saving to cache:', error);
      return false;
    }
  }

  /**
   * Check reachability cache
   */
  async checkReachabilityCache(domain: string): Promise<CacheCheckResult> {
    try {
      if (this.redis) {
        const cached = await this.redis.get(`reachability:${domain}`);
        if (cached) {
          const data = JSON.parse(cached);
          const age = Date.now() - data.lastChecked;

          return {
            hit: true,
            age: Math.round(age / 1000),
            data,
            source: 'redis'
          };
        }
      }

      // Fallback to memory
      const memoryCached = this.memoryCache.get(`reachability:${domain}`);
      if (memoryCached && memoryCached.expiresAt > Date.now()) {
        const age = Date.now() - memoryCached.data.lastChecked;

        return {
          hit: true,
          age: Math.round(age / 1000),
          data: memoryCached.data,
          source: 'memory'
        };
      }

      return {
        hit: false,
        source: 'none'
      };
    } catch (error) {
      logger.error('[Cache] Error checking reachability cache:', error);
      return {
        hit: false,
        source: 'none'
      };
    }
  }

  /**
   * Save reachability result to cache (1 hour TTL)
   */
  async saveReachabilityCache(domain: string, reachabilityResult: any): Promise<boolean> {
    try {
      const ttl = 3600; // 1 hour

      const cacheData = {
        ...reachabilityResult,
        lastChecked: Date.now()
      };

      if (this.redis) {
        await this.redis.setex(`reachability:${domain}`, ttl, JSON.stringify(cacheData));
      }

      this.saveToMemoryCache(`reachability:${domain}`, cacheData, ttl);

      return true;
    } catch (error) {
      logger.error('[Cache] Error saving reachability cache:', error);
      return false;
    }
  }

  /**
   * Get TTL based on risk level
   */
  private getTTLForRiskLevel(riskLevel: string): number {
    const ttlMap: Record<string, number> = {
      critical: 300,    // 5 minutes
      high: 1800,       // 30 minutes
      medium: 3600,     // 1 hour
      low: 14400,       // 4 hours
      safe: 86400,      // 24 hours
      unknown: 1800     // 30 minutes (default)
    };

    return ttlMap[riskLevel?.toLowerCase()] || 1800;
  }

  /**
   * Save to memory cache with automatic cleanup
   */
  private saveToMemoryCache(key: string, data: any, ttl: number): void {
    // Clean old entries if cache is full
    if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_SIZE) {
      this.cleanMemoryCache();
    }

    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + (ttl * 1000)
    });
  }

  /**
   * Clean expired entries from memory cache
   */
  private cleanMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // If still over limit, remove oldest 10%
    if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_SIZE) {
      const toRemove = Math.floor(this.MEMORY_CACHE_MAX_SIZE * 0.1);
      const keys = Array.from(this.memoryCache.keys()).slice(0, toRemove);
      keys.forEach(key => this.memoryCache.delete(key));
      cleaned += keys.length;
    }

    if (cleaned > 0) {
      logger.debug(`[Cache] Cleaned ${cleaned} expired memory cache entries`);
    }
  }

  /**
   * Clear all cache (for testing)
   */
  async clearAll(): Promise<void> {
    if (this.redis) {
      await this.redis.flushdb();
    }
    this.memoryCache.clear();
    logger.info('[Cache] All cache cleared');
  }
}
