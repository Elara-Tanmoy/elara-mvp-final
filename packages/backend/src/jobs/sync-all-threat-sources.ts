/**
 * Threat Intelligence Feed Synchronization Orchestrator
 *
 * Coordinates synchronization of all threat intelligence sources.
 * Runs as a scheduled job (CronJob) every 5 minutes.
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { syncPhishTank } from '../services/threat-feeds/connectors/phishtank.js';
import { syncOpenPhish } from '../services/threat-feeds/connectors/openphish.js';
import { syncDigitalSideDomains, syncDigitalSideIPs } from '../services/threat-feeds/connectors/digitalside.js';
import { syncCPSCompromisedIPs, syncCPSIlluminate } from '../services/threat-feeds/connectors/criticalpathsecurity.js';
import { syncThreatMonC2Domains, syncThreatMonC2IPs } from '../services/threat-feeds/connectors/threatmon-c2.js';
import { syncURLhaus, syncThreatFox, syncMalwareBazaar, syncSSLBlacklist } from '../services/threat-feeds/connectors/abusech.js';
import { syncEmergingThreats } from '../services/threat-feeds/connectors/emergingthreats.js';
import { syncAbuseIPDB } from '../services/threat-feeds/connectors/abuseipdb.js';
import { syncAlienVault } from '../services/threat-feeds/connectors/alienvault.js';
import { syncGreyNoise } from '../services/threat-feeds/connectors/greynoise.js';
import { syncCISAKEV } from '../services/threat-feeds/connectors/cisa-kev.js';
import { syncCIRCL } from '../services/threat-feeds/connectors/circl.js';


interface SyncSource {
  name: string;
  syncFn: (sourceId: string) => Promise<{
    recordsProcessed: number;
    recordsAdded: number;
    recordsUpdated: number;
    errors: number;
  }>;
  intervalMinutes: number;
  priority: number;
}

// Define all threat sources
const THREAT_SOURCES: SyncSource[] = [
  {
    name: 'URLhaus',
    syncFn: syncURLhaus,
    intervalMinutes: 5,
    priority: 1
  },
  {
    name: 'ThreatFox',
    syncFn: syncThreatFox,
    intervalMinutes: 10,
    priority: 1
  },
  {
    name: 'MalwareBazaar',
    syncFn: syncMalwareBazaar,
    intervalMinutes: 1440, // Daily
    priority: 2
  },
  {
    name: 'OpenPhish',
    syncFn: syncOpenPhish,
    intervalMinutes: 30,
    priority: 1
  },
  {
    name: 'PhishTank',
    syncFn: syncPhishTank,
    intervalMinutes: 60,
    priority: 1
  },
  {
    name: 'AlienVault OTX',
    syncFn: syncAlienVault,
    intervalMinutes: 30,
    priority: 2
  },
  {
    name: 'Emerging Threats',
    syncFn: syncEmergingThreats,
    intervalMinutes: 1440, // Daily
    priority: 3
  },
  // NEW GitHub-sourced threat intelligence feeds
  {
    name: 'DigitalSide - Domains',
    syncFn: syncDigitalSideDomains,
    intervalMinutes: 360, // 6 hours
    priority: 1
  },
  {
    name: 'DigitalSide - IPs',
    syncFn: syncDigitalSideIPs,
    intervalMinutes: 360, // 6 hours
    priority: 1
  },
  {
    name: 'CriticalPath - Compromised IPs',
    syncFn: syncCPSCompromisedIPs,
    intervalMinutes: 720, // 12 hours
    priority: 1
  },
  {
    name: 'CriticalPath - Illuminate',
    syncFn: syncCPSIlluminate,
    intervalMinutes: 720, // 12 hours
    priority: 2
  },
  {
    name: 'ThreatMon - C2 Domains',
    syncFn: syncThreatMonC2Domains,
    intervalMinutes: 1440, // Daily
    priority: 1
  },
  {
    name: 'ThreatMon - C2 IPs',
    syncFn: syncThreatMonC2IPs,
    intervalMinutes: 1440, // Daily
    priority: 1
  },
  {
    name: 'SSL Blacklist',
    syncFn: syncSSLBlacklist,
    intervalMinutes: 1440, // Daily
    priority: 2
  },
  {
    name: 'AbuseIPDB',
    syncFn: syncAbuseIPDB,
    intervalMinutes: 360, // 6 hours
    priority: 1
  },
  {
    name: 'GreyNoise',
    syncFn: syncGreyNoise,
    intervalMinutes: 1440, // Daily
    priority: 3
  },
  {
    name: 'CISA KEV',
    syncFn: syncCISAKEV,
    intervalMinutes: 1440, // Daily
    priority: 1
  },
  {
    name: 'CIRCL',
    syncFn: syncCIRCL,
    intervalMinutes: 1440, // Daily
    priority: 2
  }
];

/**
 * Check if source should sync based on interval
 */
async function shouldSync(source: SyncSource): Promise<boolean> {
  try {
    const dbSource = await prisma.threatIntelSource.findFirst({
      where: { name: source.name }
    });

    if (!dbSource || !dbSource.enabled) {
      logger.debug(`[${source.name}] Source disabled or not found`);
      return false;
    }

    if (!dbSource.lastSyncAt) {
      return true; // Never synced
    }

    const now = new Date();
    const minutesSinceLastSync = (now.getTime() - dbSource.lastSyncAt.getTime()) / 1000 / 60;

    return minutesSinceLastSync >= source.intervalMinutes;
  } catch (error) {
    logger.error(`[${source.name}] Error checking sync status:`, error);
    return false;
  }
}

/**
 * Sync a single source
 */
async function syncSource(source: SyncSource): Promise<void> {
  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    // Get source from database
    const dbSource = await prisma.threatIntelSource.findFirst({
      where: { name: source.name }
    });

    if (!dbSource) {
      logger.warn(`[${source.name}] Source not found in database, skipping`);
      return;
    }

    // Create sync job record
    const job = await prisma.threatFeedSync.create({
      data: {
        sourceId: dbSource.id,
        status: 'running',
        startedAt: new Date()
      }
    });

    jobId = job.id;
    logger.info(`[${source.name}] Starting sync (job: ${jobId})...`);

    // Execute sync function
    const result = await source.syncFn(dbSource.id);

    const duration = Date.now() - startTime;

    // Update job with success
    await prisma.threatFeedSync.update({
      where: { id: jobId },
      data: {
        status: 'success',
        completedAt: new Date(),
        indicatorsAdded: result.recordsAdded,
        indicatorsUpdated: result.recordsUpdated,
        indicatorsRemoved: 0,
        duration,
        metadata: {
          recordsProcessed: result.recordsProcessed,
          errors: result.errors
        } as any
      }
    });

    // Update source last sync time and total indicators count
    const totalIndicators = await prisma.threatIndicator.count({
      where: { sourceId: dbSource.id, active: true }
    });

    await prisma.threatIntelSource.update({
      where: { id: dbSource.id },
      data: {
        lastSyncAt: new Date(),
        totalIndicators,
        lastError: null
      }
    });

    logger.info(`[${source.name}] Sync complete:`, {
      duration: `${duration}ms`,
      processed: result.recordsProcessed,
      added: result.recordsAdded,
      updated: result.recordsUpdated,
      errors: result.errors
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Safely extract error message (avoid circular JSON from axios errors)
    let errorMessage = 'Unknown error';
    if (error.response) {
      // Axios error with response
      errorMessage = `Request failed with status code ${error.response.status}`;
      if (error.response.data?.message) {
        errorMessage += `: ${error.response.data.message}`;
      }
    } else if (error.request) {
      // Axios error without response
      errorMessage = `Request failed: ${error.message || 'No response received'}`;
    } else if (error.message) {
      // Regular error
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    logger.error(`[${source.name}] Sync failed:`, errorMessage);

    if (jobId) {
      await prisma.threatFeedSync.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          duration,
          errorMessage
        }
      });
    }

    // Update source failure count
    const dbSource = await prisma.threatIntelSource.findFirst({
      where: { name: source.name }
    });

    if (dbSource) {
      await prisma.threatIntelSource.update({
        where: { id: dbSource.id },
        data: {
          lastError: errorMessage,
          lastSyncAt: new Date()
        }
      });
    }
  }
}

/**
 * Main orchestrator function
 */
export async function syncAllThreatSources(): Promise<void> {
  const startTime = Date.now();
  logger.info('=====================================');
  logger.info('🚀 Starting Threat Intel Sync Orchestrator');
  logger.info('=====================================\n');

  const results = {
    attempted: 0,
    successful: 0,
    failed: 0,
    skipped: 0
  };

  // Sort by priority
  const sortedSources = [...THREAT_SOURCES].sort((a, b) => a.priority - b.priority);

  for (const source of sortedSources) {
    try {
      // Check if source should sync
      if (await shouldSync(source)) {
        results.attempted++;
        await syncSource(source);
        results.successful++;
      } else {
        logger.debug(`[${source.name}] Skipping (not due for sync)`);
        results.skipped++;
      }

      // Small delay between sources to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      logger.error(`[${source.name}] Unexpected error:`, error.message || String(error));
      results.attempted++;
      results.failed++;
    }
  }

  const totalDuration = Date.now() - startTime;

  logger.info('\n=====================================');
  logger.info('✅ Threat Intel Sync Orchestrator Complete');
  logger.info('=====================================');
  logger.info('Summary:', {
    duration: `${(totalDuration / 1000).toFixed(2)}s`,
    attempted: results.attempted,
    successful: results.successful,
    failed: results.failed,
    skipped: results.skipped
  });
  logger.info('=====================================\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAllThreatSources()
    .then(() => {
      logger.info('Sync orchestrator completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Sync orchestrator failed:', error);
      process.exit(1);
    });
}
