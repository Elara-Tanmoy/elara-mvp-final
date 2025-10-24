/**
 * OpenPhish Threat Feed Connector
 * Source: https://openphish.com/feed.txt
 * Format: Plain text, one URL per line
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const OPENPHISH_URL = 'https://openphish.com/feed.txt';
const TIMEOUT = 30000;

/**
 * Sync OpenPhish feed
 */
export async function syncOpenPhish(sourceId: string): Promise<{
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}> {
  logger.info('[OpenPhish] Starting sync...');

  try {
    const response = await axios.get(OPENPHISH_URL, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const urls = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && line.startsWith('http'));

    logger.info(`[OpenPhish] Fetched ${urls.length} phishing URLs`);

    const indicators = urls.map((url: string) => ({
      type: 'url',
      value: url,
      severity: 'high',
      confidence: 85,
      description: 'OpenPhish confirmed phishing URL',
      tags: ['phishing', 'openphish'],
      metadata: {
        source: 'openphish',
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[OpenPhish] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[OpenPhish] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test OpenPhish connection
 */
export async function testOpenPhishConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(OPENPHISH_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const urls = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && line.startsWith('http'))
      .slice(0, 5);

    return {
      success: true,
      sample: urls.map(url => ({ url }))
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
