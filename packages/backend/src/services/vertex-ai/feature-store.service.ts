/**
 * Vertex AI Feature Store Service
 *
 * Manages feature storage and retrieval for V2 scanner:
 * - Slow-moving features (domain age, ASN reputation)
 * - Medium-refresh features (TI hit counts)
 * - Real-time feature computation
 * - Feature caching with TTLs
 */

import { logger } from '../../config/logger.js';
import { Firestore } from '@google-cloud/firestore';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp';

export interface CachedFeature {
  value: any;
  cachedAt: Date;
  ttl: number; // seconds
}

export interface FeatureSet {
  domain_age?: number;
  asn_reputation?: number;
  tld_risk_score?: number;
  ti_hit_count?: number;
  tier1_ti_hits?: number;
}

class FeatureStoreService {
  private firestore: Firestore;
  private readonly COLLECTION = 'v2_features';

  // TTLs in seconds
  private readonly TTLs = {
    domain_age: 86400, // 24 hours
    asn_reputation: 86400, // 24 hours
    tld_risk_score: 604800, // 7 days
    ti_hit_count: 3600, // 1 hour
    tier1_ti_hits: 3600 // 1 hour
  };

  constructor() {
    this.firestore = new Firestore({ projectId: PROJECT_ID });
  }

  /**
   * Get features for a domain
   */
  async getFeatures(domain: string): Promise<FeatureSet> {
    try {
      const docRef = this.firestore.collection(this.COLLECTION).doc(domain);
      const doc = await docRef.get();

      if (!doc.exists) {
        logger.debug(`[Feature Store] No cached features for ${domain}`);
        return {};
      }

      const data = doc.data() as Record<string, CachedFeature>;
      const features: FeatureSet = {};

      // Check TTL and extract values
      const now = Date.now();
      for (const [key, cached] of Object.entries(data)) {
        const age = (now - cached.cachedAt.getTime()) / 1000;
        if (age < cached.ttl) {
          (features as any)[key] = cached.value;
        }
      }

      logger.debug(`[Feature Store] Retrieved ${Object.keys(features).length} cached features for ${domain}`);

      return features;
    } catch (error) {
      logger.error('[Feature Store] Error getting features:', error);
      return {};
    }
  }

  /**
   * Cache features for a domain
   */
  async cacheFeatures(domain: string, features: FeatureSet): Promise<void> {
    try {
      const docRef = this.firestore.collection(this.COLLECTION).doc(domain);

      const cached: Record<string, CachedFeature> = {};

      for (const [key, value] of Object.entries(features)) {
        cached[key] = {
          value,
          cachedAt: new Date(),
          ttl: (this.TTLs as any)[key] || 3600
        };
      }

      await docRef.set(cached, { merge: true });

      logger.debug(`[Feature Store] Cached ${Object.keys(features).length} features for ${domain}`);
    } catch (error) {
      logger.error('[Feature Store] Error caching features:', error);
    }
  }

  /**
   * Invalidate cached features for a domain
   */
  async invalidate(domain: string): Promise<void> {
    try {
      const docRef = this.firestore.collection(this.COLLECTION).doc(domain);
      await docRef.delete();
      logger.info(`[Feature Store] Invalidated cache for ${domain}`);
    } catch (error) {
      logger.error('[Feature Store] Error invalidating cache:', error);
    }
  }

  /**
   * Batch get features for multiple domains
   */
  async batchGetFeatures(domains: string[]): Promise<Map<string, FeatureSet>> {
    const results = new Map<string, FeatureSet>();

    // Firestore batch limit is 500, process in chunks
    const chunkSize = 500;
    for (let i = 0; i < domains.length; i += chunkSize) {
      const chunk = domains.slice(i, i + chunkSize);

      const promises = chunk.map(domain => this.getFeatures(domain));
      const features = await Promise.all(promises);

      chunk.forEach((domain, idx) => {
        results.set(domain, features[idx]);
      });
    }

    return results;
  }
}

export const featureStoreService = new FeatureStoreService();
export default featureStoreService;
