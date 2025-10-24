/**
 * THREAT INTELLIGENCE SERVICE
 *
 * Aggregates threat data from multiple public sources:
 * - PhishTank (phishing URLs)
 * - URLhaus (malware URLs)
 * - OpenPhish (phishing URLs)
 * - MalwareBazaar (malware hashes)
 * - ThreatFox (C2 indicators)
 *
 * Provides fast lookup for threat indicators during URL scanning
 */

import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import axios from 'axios';
import crypto from 'crypto';
import { syncAllThreatSources } from '../../jobs/sync-all-threat-sources.js';
import { testPhishTankConnection } from '../threat-feeds/connectors/phishtank.js';
import { testOpenPhishConnection } from '../threat-feeds/connectors/openphish.js';
import { syncCPSCompromisedIPs, syncCPSIlluminate, testCPSConnection } from '../threat-feeds/connectors/criticalpathsecurity.js';
import { syncDigitalSideDomains, syncDigitalSideIPs, testDigitalSideConnection } from '../threat-feeds/connectors/digitalside.js';

interface ThreatIndicatorData {
  type: string;
  value: string;
  threatType: string;
  severity: string;
  confidence: number;
  description?: string;
  tags?: string[];
  metadata?: any;
}

class ThreatIntelligenceService {
  /**
   * Compute SHA-256 hash of a value for indexing
   */
  private computeHash(value: string): string {
    return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex');
  }

  /**
   * Sync all enabled threat feeds
   * Now uses the enhanced sync orchestrator with deduplication
   */
  async syncAllFeeds(): Promise<void> {
    try {
      logger.info(`[Threat Intel] Triggering sync orchestrator`);
      await syncAllThreatSources();
      logger.info(`[Threat Intel] Sync orchestrator completed`);
    } catch (error) {
      logger.error('[Threat Intel] Failed to sync feeds:', error);
      throw error;
    }
  }

  /**
   * Test connection to a specific threat source
   */
  async testConnection(sourceName: string): Promise<{ success: boolean; sample?: any[]; error?: string }> {
    try {
      switch (sourceName.toLowerCase()) {
        case 'phishtank':
          return await testPhishTankConnection();
        case 'openphish':
          return await testOpenPhishConnection();
        case 'criticalpath - compromised ips':
        case 'criticalpath - illuminate':
          return await testCPSConnection();
        case 'digitalside - domains':
        case 'digitalside - ips':
          return await testDigitalSideConnection();
        default:
          return {
            success: false,
            error: 'Test connection not implemented for this source'
          };
      }
    } catch (error: any) {
      logger.error(`[Threat Intel] Test connection failed for ${sourceName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync a specific threat feed
   */
  async syncFeed(sourceId: string): Promise<void> {
    const startTime = Date.now();
    let sync: any;

    try {
      const source = await prisma.threatIntelSource.findUnique({
        where: { id: sourceId }
      });

      if (!source || !source.enabled) {
        logger.warn(`[Threat Intel] Source ${sourceId} not found or disabled`);
        return;
      }

      // Create sync record
      sync = await prisma.threatFeedSync.create({
        data: {
          sourceId: source.id,
          status: 'in_progress',
          startedAt: new Date()
        }
      });

      logger.info(`[Threat Intel] Syncing ${source.name}...`);

      let indicators: ThreatIndicatorData[] = [];

      // Fetch data based on source name
      switch (source.name) {
        case 'PhishTank':
          indicators = await this.fetchPhishTank(source);
          break;
        case 'URLhaus':
          indicators = await this.fetchURLhaus(source);
          break;
        case 'OpenPhish':
          indicators = await this.fetchOpenPhish(source);
          break;
        case 'MalwareBazaar':
          indicators = await this.fetchMalwareBazaar(source);
          break;
        case 'ThreatFox':
          indicators = await this.fetchThreatFox(source);
          break;
        case 'CriticalPath - Compromised IPs':
          // Use direct sync function (handles its own database ops)
          const cpsIpStats = await syncCPSCompromisedIPs(source.id);
          await prisma.threatIntelSource.update({
            where: { id: source.id },
            data: { lastSyncAt: new Date(), lastError: null }
          });
          logger.info(`[Threat Intel] ✅ ${source.name} synced via connector: +${cpsIpStats.recordsAdded}`);
          return;
        case 'CriticalPath - Illuminate':
          // Use direct sync function (handles its own database ops)
          const cpsIlluminateStats = await syncCPSIlluminate(source.id);
          await prisma.threatIntelSource.update({
            where: { id: source.id },
            data: { lastSyncAt: new Date(), lastError: null }
          });
          logger.info(`[Threat Intel] ✅ ${source.name} synced via connector: +${cpsIlluminateStats.recordsAdded}`);
          return;
        case 'DigitalSide - Domains':
          const dsDomainsStats = await syncDigitalSideDomains(source.id);
          await prisma.threatIntelSource.update({
            where: { id: source.id },
            data: { lastSyncAt: new Date(), lastError: null }
          });
          logger.info(`[Threat Intel] ✅ ${source.name} synced via connector: +${dsDomainsStats.recordsAdded}`);
          return;
        case 'DigitalSide - IPs':
          const dsIpsStats = await syncDigitalSideIPs(source.id);
          await prisma.threatIntelSource.update({
            where: { id: source.id },
            data: { lastSyncAt: new Date(), lastError: null }
          });
          logger.info(`[Threat Intel] ✅ ${source.name} synced via connector: +${dsIpsStats.recordsAdded}`);
          return;
        default:
          logger.warn(`[Threat Intel] Unknown source: ${source.name}`);
          return;
      }

      // Upsert indicators to database
      let added = 0;
      let updated = 0;

      for (const indicator of indicators) {
        try {
          const valueHash = this.computeHash(indicator.value);
          const existing = await prisma.threatIndicator.findFirst({
            where: {
              type: indicator.type,
              valueHash: valueHash,
              sourceId: source.id
            }
          });

          if (existing) {
            await prisma.threatIndicator.update({
              where: { id: existing.id },
              data: {
                lastSeen: new Date(),
                severity: indicator.severity,
                confidence: indicator.confidence,
                description: indicator.description,
                tags: indicator.tags || [],
                metadata: indicator.metadata || {}
              }
            });
            updated++;
          } else {
            await prisma.threatIndicator.create({
              data: {
                type: indicator.type,
                value: indicator.value,
                valueHash: valueHash,
                threatType: indicator.threatType,
                severity: indicator.severity,
                confidence: indicator.confidence,
                description: indicator.description,
                tags: indicator.tags || [],
                sourceId: source.id,
                metadata: indicator.metadata || {},
                firstSeen: new Date(),
                lastSeen: new Date()
              }
            });
            added++;
          }
        } catch (error) {
          logger.warn(`[Threat Intel] Failed to upsert indicator: ${indicator.value}`, error);
        }
      }

      // Update source stats
      const totalIndicators = await prisma.threatIndicator.count({
        where: { sourceId: source.id, active: true }
      });

      await prisma.threatIntelSource.update({
        where: { id: source.id },
        data: {
          lastSyncAt: new Date(),
          totalIndicators,
          lastError: null
        }
      });

      // Complete sync
      const duration = Date.now() - startTime;
      await prisma.threatFeedSync.update({
        where: { id: sync.id },
        data: {
          status: 'success',
          indicatorsAdded: added,
          indicatorsUpdated: updated,
          duration,
          completedAt: new Date()
        }
      });

      logger.info(
        `[Threat Intel] ✅ ${source.name} synced: +${added} added, ${updated} updated (${duration}ms)`
      );
    } catch (error: any) {
      logger.error(`[Threat Intel] ❌ Sync failed for ${sourceId}:`, error);

      if (sync) {
        await prisma.threatFeedSync.update({
          where: { id: sync.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date(),
            duration: Date.now() - startTime
          }
        });
      }

      // Update source with error
      await prisma.threatIntelSource.update({
        where: { id: sourceId },
        data: {
          lastError: error.message
        }
      });
    }
  }

  /**
   * Fetch PhishTank feed
   */
  private async fetchPhishTank(source: any): Promise<ThreatIndicatorData[]> {
    try {
      const response = await axios.get(source.url, {
        timeout: 60000,
        headers: { 'User-Agent': 'Elara-ThreatIntel/1.0' }
      });

      const indicators: ThreatIndicatorData[] = [];

      for (const entry of response.data) {
        if (entry.url && entry.verified === 'yes') {
          indicators.push({
            type: 'url',
            value: entry.url.toLowerCase(),
            threatType: 'phishing',
            severity: 'high',
            confidence: entry.verified === 'yes' ? 90 : 50,
            description: `PhishTank verified phishing URL${entry.target ? ` targeting ${entry.target}` : ''}`,
            tags: ['phishing', 'verified'],
            metadata: {
              phish_id: entry.phish_id,
              submission_time: entry.submission_time,
              verified: entry.verified,
              target: entry.target,
              details: entry.details // Move array to metadata (JSON field)
            }
          });
        }
      }

      return indicators;
    } catch (error) {
      logger.error('[Threat Intel] PhishTank fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch URLhaus feed (CSV format)
   */
  private async fetchURLhaus(source: any): Promise<ThreatIndicatorData[]> {
    try {
      const response = await axios.get(source.url, {
        timeout: 60000,
        headers: { 'User-Agent': 'Elara-ThreatIntel/1.0' }
      });

      const indicators: ThreatIndicatorData[] = [];
      const lines = response.data.split('\n');

      for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;

        const parts = line.split(',').map((p: string) => p.replace(/"/g, ''));
        if (parts.length >= 8) {
          const [dateAdded, url, urlStatus, threat, tags, urlhausLink, reporter] = parts;

          if (url && urlStatus === 'online') {
            indicators.push({
              type: 'url',
              value: url.toLowerCase(),
              threatType: threat || 'malware',
              severity: 'high',
              confidence: 85,
              description: `URLhaus malware distribution: ${threat}`,
              tags: tags ? tags.split('|') : ['malware'],
              metadata: {
                date_added: dateAdded,
                url_status: urlStatus,
                urlhaus_link: urlhausLink,
                reporter
              }
            });
          }
        }
      }

      return indicators;
    } catch (error) {
      logger.error('[Threat Intel] URLhaus fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch OpenPhish feed (plain text, one URL per line)
   */
  private async fetchOpenPhish(source: any): Promise<ThreatIndicatorData[]> {
    try {
      const response = await axios.get(source.url, {
        timeout: 60000,
        headers: { 'User-Agent': 'Elara-ThreatIntel/1.0' }
      });

      const indicators: ThreatIndicatorData[] = [];
      const urls = response.data.split('\n');

      for (const url of urls) {
        const cleanUrl = url.trim();
        if (cleanUrl && cleanUrl.startsWith('http')) {
          indicators.push({
            type: 'url',
            value: cleanUrl.toLowerCase(),
            threatType: 'phishing',
            severity: 'high',
            confidence: 80,
            description: 'OpenPhish active phishing URL',
            tags: ['phishing', 'active'],
            metadata: {
              source: 'openphish',
              discovered: new Date().toISOString()
            }
          });
        }
      }

      return indicators;
    } catch (error) {
      logger.error('[Threat Intel] OpenPhish fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch MalwareBazaar feed (CSV format)
   */
  private async fetchMalwareBazaar(source: any): Promise<ThreatIndicatorData[]> {
    try {
      const response = await axios.get(source.url, {
        timeout: 60000,
        headers: { 'User-Agent': 'Elara-ThreatIntel/1.0' }
      });

      const indicators: ThreatIndicatorData[] = [];
      const lines = response.data.split('\n');

      for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;

        const parts = line.split(',').map((p: string) => p.replace(/"/g, ''));
        if (parts.length >= 6) {
          const [firstSeen, sha256, md5, sha1, reporter, fileName, signature] = parts;

          if (sha256) {
            indicators.push({
              type: 'hash',
              value: sha256.toLowerCase(),
              threatType: signature || 'malware',
              severity: 'critical',
              confidence: 95,
              description: `Malware sample: ${fileName || 'unknown'}`,
              tags: ['malware', signature || 'unknown'].filter(Boolean),
              metadata: {
                first_seen: firstSeen,
                md5,
                sha1,
                reporter,
                file_name: fileName
              }
            });
          }
        }
      }

      return indicators;
    } catch (error) {
      logger.error('[Threat Intel] MalwareBazaar fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch ThreatFox feed (JSON format)
   */
  private async fetchThreatFox(source: any): Promise<ThreatIndicatorData[]> {
    try {
      const response = await axios.get(source.url, {
        timeout: 60000,
        headers: { 'User-Agent': 'Elara-ThreatIntel/1.0' }
      });

      const indicators: ThreatIndicatorData[] = [];
      const data = response.data.data || [];

      for (const entry of data) {
        if (entry.ioc && entry.ioc_type) {
          let type = 'other';
          if (entry.ioc_type.includes('url')) type = 'url';
          else if (entry.ioc_type.includes('domain')) type = 'domain';
          else if (entry.ioc_type.includes('ip')) type = 'ip';

          indicators.push({
            type,
            value: entry.ioc.toLowerCase(),
            threatType: entry.threat_type || 'c2',
            severity: entry.confidence_level >= 75 ? 'critical' : 'high',
            confidence: entry.confidence_level || 70,
            description: entry.malware || 'C2 infrastructure',
            tags: [entry.threat_type, entry.malware].filter(Boolean),
            metadata: {
              malware: entry.malware,
              malware_alias: entry.malware_alias,
              first_seen: entry.first_seen,
              last_seen: entry.last_seen,
              reporter: entry.reporter,
              reference: entry.reference
            }
          });
        }
      }

      return indicators;
    } catch (error) {
      logger.error('[Threat Intel] ThreatFox fetch failed:', error);
      throw error;
    }
  }

  /**
   * Check if a URL is in threat database
   * ENHANCED: Better URL matching with protocol normalization and partial matching
   */
  async checkURL(url: string): Promise<{
    isThreat: boolean;
    indicators: any[];
    maxSeverity: string | null;
  }> {
    try {
      const cleanUrl = url.toLowerCase().trim();

      // Normalize URL for better matching (remove protocol differences)
      let normalizedUrl = cleanUrl;
      try {
        const urlObj = new URL(cleanUrl);
        // Remove protocol and www prefix for normalized matching
        normalizedUrl = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname + urlObj.search;
      } catch (e) {
        // If URL parsing fails, use the original
      }

      // IMPROVED SEARCH: Multiple search strategies for better detection

      // Strategy 1: Exact URL match (fastest)
      const exactUrlIndicators = await prisma.threatIndicator.findMany({
        where: {
          type: 'url',
          value: cleanUrl,
          active: true
        },
        include: {
          source: {
            select: {
              name: true,
              type: true
            }
          }
        }
      });

      // Strategy 2: Protocol-agnostic match (check both http and https variants)
      const httpUrl = cleanUrl.replace(/^https:\/\//, 'http://');
      const httpsUrl = cleanUrl.replace(/^http:\/\//, 'https://');

      const protocolVariantIndicators = await prisma.threatIndicator.findMany({
        where: {
          type: 'url',
          value: {
            in: [httpUrl, httpsUrl]
          },
          active: true
        },
        include: {
          source: {
            select: {
              name: true,
              type: true
            }
          }
        }
      });

      // Strategy 3: REMOVED - Partial matching was causing false positives for legitimate sites
      // Example: microsoft.com was matching phishing URLs that contained "microsoft" in their path

      // Extract domain and check domain-level threats
      let domain = '';
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname.toLowerCase().replace(/^www\./, ''); // Remove www for consistency
      } catch (e) {
        // Invalid URL
      }

      const domainIndicators = domain ? await prisma.threatIndicator.findMany({
        where: {
          type: 'domain',
          value: domain,
          active: true
        },
        include: {
          source: {
            select: {
              name: true,
              type: true
            }
          }
        }
      }) : [];

      // Combine all matching strategies (remove duplicates by ID)
      const allIndicators = [
        ...exactUrlIndicators,
        ...protocolVariantIndicators,
        ...domainIndicators
      ].filter((indicator, index, self) =>
        index === self.findIndex((i) => i.id === indicator.id)
      );

      if (allIndicators.length === 0) {
        return {
          isThreat: false,
          indicators: [],
          maxSeverity: null
        };
      }

      // Determine max severity
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      let maxSeverity = 'low';
      for (const indicator of allIndicators) {
        if (severityOrder[indicator.severity as keyof typeof severityOrder] > severityOrder[maxSeverity as keyof typeof severityOrder]) {
          maxSeverity = indicator.severity;
        }
      }

      return {
        isThreat: true,
        indicators: allIndicators,
        maxSeverity
      };
    } catch (error) {
      logger.error('[Threat Intel] Check URL failed:', error);
      return {
        isThreat: false,
        indicators: [],
        maxSeverity: null
      };
    }
  }

  /**
   * Get threat intelligence statistics
   */
  async getStats(): Promise<any> {
    try {
      const [
        totalSources,
        activeSources,
        totalIndicators,
        indicatorsByType,
        indicatorsBySeverity,
        recentSyncs
      ] = await Promise.all([
        prisma.threatIntelSource.count(),
        prisma.threatIntelSource.count({ where: { enabled: true } }),
        prisma.threatIndicator.count({ where: { active: true } }),
        prisma.threatIndicator.groupBy({
          by: ['type'],
          where: { active: true },
          _count: true
        }),
        prisma.threatIndicator.groupBy({
          by: ['severity'],
          where: { active: true },
          _count: true
        }),
        prisma.threatFeedSync.findMany({
          take: 10,
          orderBy: { startedAt: 'desc' },
          include: {
            source: {
              select: {
                name: true
              }
            }
          }
        })
      ]);

      return {
        totalSources,
        activeSources,
        totalIndicators,
        indicatorsByType,
        indicatorsBySeverity,
        recentSyncs
      };
    } catch (error) {
      logger.error('[Threat Intel] Get stats failed:', error);
      throw error;
    }
  }
}

export const threatIntelService = new ThreatIntelligenceService();
