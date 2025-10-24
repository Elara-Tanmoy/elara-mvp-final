/**
 * PhishTank Threat Feed Connector
 * Source: http://data.phishtank.com/data/online-valid.json
 *
 * FIXED: Circular JSON error by extracting only needed fields
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const PHISHTANK_URL = 'https://data.phishtank.com/data/online-valid.json';
const TIMEOUT = 60000; // 60 seconds for large file

interface PhishTankEntry {
  url: string;
  phish_id: string;
  submission_time: string;
  verified: string;
  target?: string;
}

/**
 * Sync PhishTank feed
 */
export async function syncPhishTank(sourceId: string): Promise<{
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}> {
  logger.info('[PhishTank] Starting sync...');

  try {
    // Fetch data
    const response = await axios.get(PHISHTANK_URL, {
      timeout: TIMEOUT,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid response format');
    }

    logger.info(`[PhishTank] Fetched ${response.data.length} phishing URLs`);

    // Extract only needed fields to avoid circular JSON
    const indicators = response.data.map((entry: PhishTankEntry) => ({
      type: 'url',
      value: entry.url,
      severity: 'high',
      confidence: entry.verified === 'yes' ? 90 : 70,
      description: `PhishTank phishing URL${entry.target ? ` targeting ${entry.target}` : ''}`,
      tags: ['phishing', entry.target || 'unknown'].filter(Boolean),
      metadata: {
        phish_id: entry.phish_id,
        submission_time: entry.submission_time,
        verified: entry.verified,
        target: entry.target || 'unknown',
        source: 'phishtank'
      }
    }));

    // Process with deduplication
    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[PhishTank] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[PhishTank] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test PhishTank connection
 */
export async function testPhishTankConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(PHISHTANK_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const sample = response.data.slice(0, 5).map((entry: PhishTankEntry) => ({
      url: entry.url,
      phish_id: entry.phish_id,
      verified: entry.verified,
      target: entry.target
    }));

    return {
      success: true,
      sample
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
