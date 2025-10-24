/**
 * THREAT INTELLIGENCE CONTROLLER
 *
 * Admin endpoints for managing threat intelligence feeds
 * and viewing threat indicator statistics
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { threatIntelService } from '../services/threat-intel/threatIntelService.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

export class ThreatIntelController {
  /**
   * GET /api/v2/threat-intel/stats
   * Get threat intelligence statistics
   */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info('[Threat Intel API] Stats requested');

      const stats = await threatIntelService.getStats();

      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Get stats failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/threat-intel/sources
   * Get all threat feed sources with enhanced data
   */
  async getSources(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Sync interval configuration (from sync-all-threat-sources.ts)
      const syncIntervals: Record<string, number> = {
        'URLhaus': 5,
        'ThreatFox': 10,
        'MalwareBazaar': 1440,
        'OpenPhish': 30,
        'PhishTank': 60,
        'AlienVault OTX': 30,
        'Emerging Threats': 1440,
        'DigitalSide - Domains': 360,
        'DigitalSide - IPs': 360,
        'CriticalPath - Compromised IPs': 720,
        'CriticalPath - Illuminate': 720,
        'ThreatMon - C2 Domains': 1440,
        'ThreatMon - C2 IPs': 1440,
        'SSL Blacklist': 1440,
        'AbuseIPDB': 360,
        'GreyNoise': 1440,
        'CISA KEV': 1440,
        'CIRCL': 1440
      };

      // Get only enabled sources
      const sources = await prisma.threatIntelSource.findMany({
        where: { enabled: true },
        include: {
          _count: {
            select: {
              indicators: true,
              syncHistory: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      // Enhance each source with additional data
      const enhancedSources = await Promise.all(sources.map(async (source) => {
        // Get last sync job
        const lastSync = await prisma.threatFeedSync.findFirst({
          where: { sourceId: source.id },
          orderBy: { startedAt: 'desc' }
        });

        // Get severity breakdown
        const severityBreakdown = await prisma.threatIndicator.groupBy({
          by: ['severity'],
          where: { sourceId: source.id, active: true },
          _count: true
        });

        const severityCounts = {
          critical: severityBreakdown.find(s => s.severity === 'critical')?._count || 0,
          high: severityBreakdown.find(s => s.severity === 'high')?._count || 0,
          medium: severityBreakdown.find(s => s.severity === 'medium')?._count || 0,
          low: severityBreakdown.find(s => s.severity === 'low')?._count || 0
        };

        // Calculate next sync time
        const intervalMinutes = syncIntervals[source.name] || 60;
        const nextSyncAt = source.lastSyncAt
          ? new Date(source.lastSyncAt.getTime() + intervalMinutes * 60 * 1000)
          : new Date();

        return {
          ...source,
          lastSyncStatus: lastSync?.status || 'never',
          lastSyncDelta: {
            added: lastSync?.indicatorsAdded || 0,
            updated: lastSync?.indicatorsUpdated || 0,
            removed: lastSync?.indicatorsRemoved || 0
          },
          severityCounts,
          nextSyncAt,
          syncIntervalMinutes: intervalMinutes
        };
      }));

      res.json({
        success: true,
        sources: enhancedSources,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Get sources failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sources',
        details: (error as Error).message
      });
    }
  }

  /**
   * POST /api/v2/threat-intel/sync
   * Trigger manual sync for all or specific source
   */
  async triggerSync(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { sourceId } = req.body;

      logger.info(`[Threat Intel API] Manual sync triggered for ${sourceId || 'all sources'}`);

      if (sourceId) {
        await threatIntelService.syncFeed(sourceId);
      } else {
        await threatIntelService.syncAllFeeds();
      }

      res.json({
        success: true,
        message: sourceId ? 'Source sync initiated' : 'All sources sync initiated',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Sync trigger failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/threat-intel/indicators
   * Get threat indicators with filtering
   */
  async getIndicators(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        type,
        threatType,
        severity,
        sourceId,
        limit = '100',
        offset = '0'
      } = req.query;

      const where: any = { active: true };
      if (type) where.type = type;
      if (threatType) where.threatType = threatType;
      if (severity) where.severity = severity;
      if (sourceId) where.sourceId = sourceId;

      const [indicators, total] = await Promise.all([
        prisma.threatIndicator.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { lastSeen: 'desc' },
          include: {
            source: {
              select: {
                name: true,
                type: true
              }
            }
          }
        }),
        prisma.threatIndicator.count({ where })
      ]);

      res.json({
        success: true,
        indicators,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + indicators.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Get indicators failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get indicators',
        details: (error as Error).message
      });
    }
  }

  /**
   * POST /api/v2/threat-intel/check
   * Check if a URL is in threat database
   */
  async checkURL(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: 'URL is required'
        });
        return;
      }

      const result = await threatIntelService.checkURL(url);

      res.json({
        success: true,
        url,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Check URL failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check URL',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/threat-intel/sync-history
   * Get sync history for all sources
   */
  async getSyncHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = '50' } = req.query;

      const syncs = await prisma.threatFeedSync.findMany({
        take: parseInt(limit as string),
        orderBy: { startedAt: 'desc' },
        include: {
          source: {
            select: {
              name: true,
              type: true
            }
          }
        }
      });

      res.json({
        success: true,
        syncs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Get sync history failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync history',
        details: (error as Error).message
      });
    }
  }

  /**
   * PATCH /api/v2/threat-intel/sources/:id
   * Update a threat source (enable/disable)
   */
  async updateSource(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled, syncFrequency } = req.body;

      const source = await prisma.threatIntelSource.update({
        where: { id },
        data: {
          enabled,
          syncFrequency,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        source,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Update source failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update source',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/threat-intel/sources/:id/config
   * Get source configuration (including API keys)
   */
  async getSourceConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const source = await prisma.threatIntelSource.findUnique({
        where: { id }
      });

      if (!source) {
        res.status(404).json({
          success: false,
          error: 'Source not found'
        });
        return;
      }

      // Extract API configuration from metadata
      const metadata = source.metadata as any || {};

      // Mask API key for security (show only last 4 characters)
      const maskedConfig = {
        ...source,
        apiKey: source.apiKey
          ? `${'*'.repeat(Math.max(0, source.apiKey.length - 4))}${source.apiKey.slice(-4)}`
          : null,
        apiKeySet: !!source.apiKey,

        // Add API configuration details from metadata
        apiConfig: {
          method: metadata.method || 'GET',
          timeout: metadata.timeout || 30000,
          headers: metadata.headers || {},
          queryParams: metadata.queryParams || {},
          bodyParams: metadata.bodyParams || null,
          authHeaderName: metadata.authHeaderName || null,
          envVarName: metadata.envVarName || null
        }
      };

      res.json({
        success: true,
        config: maskedConfig,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Get source config failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get source configuration',
        details: (error as Error).message
      });
    }
  }

  /**
   * PATCH /api/v2/threat-intel/sources/:id/config
   * Update source configuration
   */
  async updateSourceConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { url, apiKey, enabled, syncFrequency, requiresAuth, description } = req.body;

      const updateData: any = {
        updatedAt: new Date(),
        lastEditedBy: req.user?.id
      };

      if (url !== undefined) updateData.url = url;
      if (apiKey !== undefined && apiKey !== '') updateData.apiKey = apiKey;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (syncFrequency !== undefined) updateData.syncFrequency = syncFrequency;
      if (requiresAuth !== undefined) updateData.requiresAuth = requiresAuth;
      if (description !== undefined) updateData.description = description;

      const source = await prisma.threatIntelSource.update({
        where: { id },
        data: updateData
      });

      // Mask API key in response
      const maskedSource = {
        ...source,
        apiKey: source.apiKey
          ? `${'*'.repeat(Math.max(0, source.apiKey.length - 4))}${source.apiKey.slice(-4)}`
          : null
      };

      logger.info(`[Threat Intel API] Source config updated: ${source.name}`);

      res.json({
        success: true,
        source: maskedSource,
        message: 'Configuration updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Threat Intel API] Update source config failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update source configuration',
        details: (error as Error).message
      });
    }
  }

  /**
   * POST /api/v2/threat-intel/sources/:id/test
   * Test connection to threat intel source
   */
  async testSourceConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const source = await prisma.threatIntelSource.findUnique({
        where: { id }
      });

      if (!source) {
        res.status(404).json({
          success: false,
          error: 'Source not found'
        });
        return;
      }

      logger.info(`[Threat Intel API] Testing connection to: ${source.name}`);

      // Dynamic import of connector functions
      let testResult: { success: boolean; message?: string; error?: string; data?: any };

      try {
        switch (source.name) {
          case 'URLhaus':
          case 'ThreatFox':
          case 'MalwareBazaar':
          case 'SSL Blacklist': {
            const { testAbusechConnection } = await import('../services/threat-feeds/connectors/abusech.js');
            testResult = await testAbusechConnection();
            break;
          }
          case 'AbuseIPDB': {
            const { testAbuseIPDBConnection } = await import('../services/threat-feeds/connectors/abuseipdb.js');
            testResult = await testAbuseIPDBConnection();
            break;
          }
          case 'AlienVault OTX': {
            const { testAlienVaultConnection } = await import('../services/threat-feeds/connectors/alienvault.js');
            testResult = await testAlienVaultConnection();
            break;
          }
          case 'PhishTank': {
            const { testPhishTankConnection } = await import('../services/threat-feeds/connectors/phishtank.js');
            testResult = await testPhishTankConnection();
            break;
          }
          default:
            testResult = {
              success: false,
              error: 'Test connection not implemented for this source'
            };
        }

        res.json({
          success: testResult.success,
          source: source.name,
          message: testResult.success
            ? `Successfully connected to ${source.name}`
            : `Failed to connect to ${source.name}`,
          details: testResult,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        logger.error(`[Threat Intel API] Test connection failed for ${source.name}:`, error);
        res.json({
          success: false,
          source: source.name,
          message: `Failed to test connection to ${source.name}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('[Threat Intel API] Test connection failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test connection',
        details: (error as Error).message
      });
    }
  }
}

export const threatIntelController = new ThreatIntelController();
