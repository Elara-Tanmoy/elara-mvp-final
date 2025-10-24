/**
 * ELARA WORKER - BullMQ Background Job Processor
 *
 * Processes background jobs for:
 * - URL scanning with Multi-LLM analysis
 * - Message scanning with emotion detection
 * - File scanning with OCR and conversation analysis
 * - Dataset processing and vectorization
 *
 * Uses Redis and BullMQ for queue management
 */

import { logger } from '../config/logger.js';
import { startWorker } from '../services/queue/scan.queue.js';

let worker: any = null;

async function main() {
  logger.info('╔═══════════════════════════════════════════════════════════╗');
  logger.info('║          ELARA BACKGROUND WORKER                          ║');
  logger.info('╚═══════════════════════════════════════════════════════════╝');

  try {
    // Check if Redis is configured
    if (!process.env.REDIS_URL) {
      logger.warn('⚠️  REDIS_URL not configured');
      logger.info('📋 Worker running in IDLE mode (no job processing)');
      logger.info('ℹ️  To enable job processing, configure REDIS_URL environment variable');

      // Keep worker alive but idle
      setInterval(() => {
        logger.debug('💓 Worker heartbeat (idle - no Redis)');
      }, 60000);

      return;
    }

    // Start the BullMQ worker
    logger.info('🔌 Redis configured, starting job queue worker...');
    worker = await startWorker();

    logger.info('✅ Worker is processing jobs from queue');
    logger.info('📊 Concurrency: 5');
    logger.info('🔄 Job Types: URL, Message, File, Dataset');
    logger.info('');
    logger.info('Worker is ready! Waiting for jobs...');

  } catch (error) {
    logger.error('❌ Failed to start worker:', error);

    // If worker fails to start, go into idle mode instead of crashing
    logger.warn('⚠️  Worker failed to start, entering idle mode');
    setInterval(() => {
      logger.debug('💓 Worker heartbeat (idle - startup failed)');
    }, 60000);
  }
}

// Start the worker
main().catch((error) => {
  logger.error('❌ Fatal error in worker:', error);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`\n📴 Worker received ${signal}, shutting down gracefully...`);

  if (worker) {
    logger.info('⏹️  Closing worker (completing active jobs)...');
    await worker.close();
    logger.info('✅ Worker closed successfully');
  }

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
