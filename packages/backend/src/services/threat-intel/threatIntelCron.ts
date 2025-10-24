/**
 * THREAT INTELLIGENCE CRON SERVICE
 *
 * Automatically syncs threat feeds on schedule
 * - Initial sync on server startup
 * - Regular syncs every hour
 */

import { threatIntelService } from './threatIntelService.js';
import { logger } from '../../config/logger.js';

class ThreatIntelCron {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Initialize threat intelligence automation
   * - Runs initial sync on startup (with delay)
   * - Schedules hourly syncs
   */
  async initialize(): Promise<void> {
    logger.info('[Threat Intel Cron] Initializing automated threat feed syncs');

    // Run initial sync after 30 seconds (give server time to fully start)
    setTimeout(async () => {
      await this.runInitialSync();

      // Start regular sync schedule (every hour)
      this.startScheduledSyncs();
    }, 30000); // 30 second delay
  }

  /**
   * Run initial sync on startup
   */
  private async runInitialSync(): Promise<void> {
    try {
      logger.info('[Threat Intel Cron] Running initial threat feed sync...');

      await threatIntelService.syncAllFeeds();

      logger.info('[Threat Intel Cron] ✅ Initial sync completed successfully');
    } catch (error) {
      logger.error('[Threat Intel Cron] ❌ Initial sync failed:', error);
      // Don't throw - server should continue even if sync fails
    }
  }

  /**
   * Start scheduled syncs (every hour)
   */
  private startScheduledSyncs(): void {
    // Run every hour (3600000 ms)
    const syncIntervalMs = 3600000;

    this.syncInterval = setInterval(async () => {
      if (this.isRunning) {
        logger.warn('[Threat Intel Cron] Previous sync still running, skipping...');
        return;
      }

      this.isRunning = true;

      try {
        logger.info('[Threat Intel Cron] Running scheduled threat feed sync...');

        await threatIntelService.syncAllFeeds();

        logger.info('[Threat Intel Cron] ✅ Scheduled sync completed successfully');
      } catch (error) {
        logger.error('[Threat Intel Cron] ❌ Scheduled sync failed:', error);
      } finally {
        this.isRunning = false;
      }
    }, syncIntervalMs);

    logger.info('[Threat Intel Cron] Scheduled syncs started (every 1 hour)');
  }

  /**
   * Stop scheduled syncs (for graceful shutdown)
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('[Threat Intel Cron] Scheduled syncs stopped');
    }
  }
}

export const threatIntelCron = new ThreatIntelCron();
