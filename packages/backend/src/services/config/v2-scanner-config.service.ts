/**
 * V2 Scanner Configuration Service
 *
 * Manages V2 scanner configuration including:
 * - Engine selection (V1/V2)
 * - Vertex AI endpoints
 * - Calibration settings
 * - Feature store configuration
 * - A/B testing and rollout
 */

import { prisma } from '../../config/database.js';
import { getDefaultV2Config } from '../../scanners/url-scanner-v2/index.js';
import type { V2Config } from '../../scanners/url-scanner-v2/types.js';

/**
 * V2 Scanner Config Service
 */
export class V2ScannerConfigService {
  private cachedConfig: V2Config | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Get active V2 configuration
   */
  async getActiveConfig(): Promise<V2Config> {
    // Check cache
    if (this.cachedConfig && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedConfig;
    }

    // Fetch from database
    const dbConfig = await prisma.v2ScannerConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!dbConfig) {
      // Return default config if no active config found
      const defaultConfig = getDefaultV2Config();
      this.cachedConfig = defaultConfig;
      this.cacheTimestamp = Date.now();
      return defaultConfig;
    }

    // Convert DB config to V2Config
    const config: V2Config = {
      enabled: dbConfig.isActive,
      vertexEndpoints: {
        urlLexicalB: dbConfig.urlLexicalBEndpoint || 'placeholder',
        tabularRisk: dbConfig.tabularRiskEndpoint || 'placeholder',
        textPersuasion: dbConfig.textPersuasionEndpoint || 'placeholder',
        screenshotCnn: dbConfig.screenshotCnnEndpoint || 'placeholder',
        combiner: dbConfig.combinerEndpoint || 'placeholder'
      },
      featureStore: {
        type: dbConfig.featureStoreType as 'firestore' | 'vertex',
        firestoreCollection: dbConfig.firestoreCollection,
        vertexFeatureStore: dbConfig.vertexFeatureStore || undefined,
        cacheTTL: dbConfig.featureCacheTTL
      },
      calibration: {
        method: dbConfig.calibrationMethod as 'ICP' | 'PLATT' | 'ISOTONIC',
        alpha: dbConfig.calibrationAlpha,
        calibrationDataPath: dbConfig.calibrationDataPath || undefined
      },
      branchThresholds: dbConfig.branchThresholds as any,
      stage2Threshold: dbConfig.stage2ConfidenceThreshold,
      timeouts: {
        reachability: dbConfig.timeoutReachability,
        evidence: dbConfig.timeoutEvidence,
        stage1: dbConfig.timeoutStage1,
        stage2: dbConfig.timeoutStage2,
        total: dbConfig.timeoutTotal
      }
    };

    this.cachedConfig = config;
    this.cacheTimestamp = Date.now();
    return config;
  }

  /**
   * Check if V2 should be used for a given organization
   */
  async shouldUseV2(organizationId: string): Promise<boolean> {
    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return false; // V2 not enabled
    }

    // Check if organization is in enabled list
    if (config.enabledForOrgs.includes(organizationId)) {
      return true;
    }

    // Check rollout percentage (random selection)
    if (config.rolloutPercentage > 0) {
      const hash = this.hashOrganizationId(organizationId);
      const bucket = hash % 100;
      return bucket < config.rolloutPercentage;
    }

    return false;
  }

  /**
   * Check if shadow mode is enabled
   */
  async isShadowMode(): Promise<boolean> {
    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isActive: true }
    });

    return config?.shadowMode ?? true;
  }

  /**
   * Update V2 configuration
   */
  async updateConfig(configId: string, updates: Partial<any>): Promise<void> {
    await prisma.v2ScannerConfig.update({
      where: { id: configId },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });

    // Clear cache
    this.cachedConfig = null;
  }

  /**
   * Enable V2 for an organization
   */
  async enableForOrganization(organizationId: string): Promise<void> {
    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isDefault: true }
    });

    if (!config) {
      throw new Error('No default V2 config found');
    }

    const enabledOrgs = config.enabledForOrgs;
    if (!enabledOrgs.includes(organizationId)) {
      enabledOrgs.push(organizationId);
      await this.updateConfig(config.id, {
        enabledForOrgs: enabledOrgs
      });
    }
  }

  /**
   * Disable V2 for an organization
   */
  async disableForOrganization(organizationId: string): Promise<void> {
    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isDefault: true }
    });

    if (!config) {
      return;
    }

    const enabledOrgs = config.enabledForOrgs.filter(id => id !== organizationId);
    await this.updateConfig(config.id, {
      enabledForOrgs: enabledOrgs
    });
  }

  /**
   * Set rollout percentage
   */
  async setRolloutPercentage(percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isDefault: true }
    });

    if (!config) {
      throw new Error('No default V2 config found');
    }

    await this.updateConfig(config.id, {
      rolloutPercentage: percentage
    });
  }

  /**
   * Enable/disable V2 globally
   */
  async setEnabled(enabled: boolean): Promise<void> {
    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isDefault: true }
    });

    if (!config) {
      throw new Error('No default V2 config found');
    }

    await this.updateConfig(config.id, {
      isActive: enabled
    });
  }

  /**
   * Get config statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    shadowMode: boolean;
    rolloutPercentage: number;
    enabledOrgsCount: number;
    totalScansV1: number;
    totalScansV2: number;
  }> {
    const config = await prisma.v2ScannerConfig.findFirst({
      where: { isDefault: true }
    });

    const [v1Count, v2Count] = await Promise.all([
      prisma.scanResult.count({
        where: { scanEngineVersion: 'v1' }
      }),
      prisma.scanResult.count({
        where: { scanEngineVersion: 'v2' }
      })
    ]);

    return {
      enabled: config?.isActive ?? false,
      shadowMode: config?.shadowMode ?? true,
      rolloutPercentage: config?.rolloutPercentage ?? 0,
      enabledOrgsCount: config?.enabledForOrgs.length ?? 0,
      totalScansV1: v1Count,
      totalScansV2: v2Count
    };
  }

  /**
   * Hash organization ID for consistent bucketing
   */
  private hashOrganizationId(orgId: string): number {
    let hash = 0;
    for (let i = 0; i < orgId.length; i++) {
      const char = orgId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Clear config cache
   */
  clearCache(): void {
    this.cachedConfig = null;
  }
}

/**
 * Singleton instance
 */
let v2ConfigService: V2ScannerConfigService | null = null;

/**
 * Get V2 Scanner Config Service instance
 */
export function getV2ScannerConfigService(): V2ScannerConfigService {
  if (!v2ConfigService) {
    v2ConfigService = new V2ScannerConfigService();
  }
  return v2ConfigService;
}
