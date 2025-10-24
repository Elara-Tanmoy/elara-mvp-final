/**
 * GreyNoise Threat Intel Connector
 * Source: https://www.greynoise.io/
 * API Docs: https://docs.greynoise.io/
 *
 * API Key: Get from https://viz.greynoise.io/account
 * Set GREYNOISE_API_KEY environment variable
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const GREYNOISE_API = 'https://api.greynoise.io/v3/community';
const TIMEOUT = 30000;
const API_KEY = process.env.GREYNOISE_API_KEY || '';

interface GreyNoiseStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync GreyNoise RIOT (Rule It Out) IPs
 * RIOT identifies common business services that are benign
 */
export async function syncGreyNoise(sourceId: string): Promise<GreyNoiseStats> {
  logger.info('[GreyNoise] Starting sync...');

  if (!API_KEY) {
    logger.warn('[GreyNoise] No API key provided, skipping sync');
    return {
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      errors: 0
    };
  }

  // Note: Community API has rate limits, we'll use a small sample
  // For production, use Enterprise API with tags endpoint
  logger.info('[GreyNoise] Using community API - limited dataset');

  // For now, implementing as placeholder since GreyNoise Community API
  // doesn't provide bulk feed access without specific IP queries
  // Production should use Enterprise API with /v3/tags endpoint

  logger.warn('[GreyNoise] Community API requires specific IP lookups, use Enterprise API for bulk feeds');

  return {
    recordsProcessed: 0,
    recordsAdded: 0,
    recordsUpdated: 0,
    errors: 0
  };
}

/**
 * Test GreyNoise connection
 */
export async function testGreyNoiseConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  if (!API_KEY) {
    return {
      success: false,
      error: 'API key not configured'
    };
  }

  try {
    // Test with a known IP (Google DNS)
    const response = await axios.get(`${GREYNOISE_API}/8.8.8.8`, {
      timeout: 10000,
      headers: {
        'key': API_KEY
      }
    });

    if (response.data) {
      return {
        success: true,
        sample: [{
          ip: '8.8.8.8',
          classification: response.data.classification,
          name: response.data.name
        }]
      };
    }

    return {
      success: false,
      error: 'No data returned from API'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
