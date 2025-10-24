/**
 * Abuse.ch Threat Intel Connectors
 * Sources:
 * - URLhaus: https://urlhaus.abuse.ch/
 * - ThreatFox: https://threatfox.abuse.ch/
 * - MalwareBazaar: https://bazaar.abuse.ch/
 * - SSL Blacklist: https://sslbl.abuse.ch/
 *
 * API Key: Get from https://auth.abuse.ch/
 * Set ABUSECH_API_KEY environment variable
 * All services share the same API key
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

// Use JSON APIs with Auth-Key header (correct method per abuse.ch docs)
const URLHAUS_API = 'https://urlhaus-api.abuse.ch/v1/urls/recent/';
const THREATFOX_API = 'https://threatfox-api.abuse.ch/api/v1/';
const MALWAREBAZAAR_API = 'https://mb-api.abuse.ch/api/v1/';
const SSLBL_API = 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv';
const TIMEOUT = 30000;
const API_KEY = process.env.ABUSECH_API_KEY || '';

interface AbusechStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync URLhaus recent malware URLs
 * https://urlhaus-api.abuse.ch/ (Uses Auth-Key header)
 */
export async function syncURLhaus(sourceId: string): Promise<AbusechStats> {
  logger.info('[URLhaus] Starting sync...');

  try {
    const response = await axios.get(URLHAUS_API, {
      timeout: TIMEOUT,
      headers: {
        'Auth-Key': API_KEY,
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const data = response.data;

    if (data.query_status !== 'ok') {
      throw new Error(`URLhaus API error: ${data.query_status}`);
    }

    const urls = data.urls || [];
    logger.info(`[URLhaus] Fetched ${urls.length} recent malware URLs`);

    const indicators = urls.map((item: any) => ({
      type: 'url',
      value: item.url.toLowerCase(),
      severity: item.threat === 'malware_download' ? 'high' : 'medium',
      confidence: 90,
      description: `URLhaus malware URL - ${item.url_status || 'active'}`,
      tags: ['malware', 'urlhaus', 'abuse.ch', item.threat || 'unknown'],
      metadata: {
        source: 'urlhaus',
        url_status: String(item.url_status || ''),
        threat: String(item.threat || ''),
        tags: Array.isArray(item.tags) ? item.tags.map((t: any) => String(t)) : [],
        host: String(item.host || ''),
        dateadded: String(item.dateadded || ''),
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[URLhaus] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[URLhaus] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync ThreatFox recent IOCs
 * https://threatfox-api.abuse.ch/ (Uses Auth-Key header)
 */
export async function syncThreatFox(sourceId: string): Promise<AbusechStats> {
  logger.info('[ThreatFox] Starting sync...');

  try {
    const response = await axios.post(
      THREATFOX_API,
      { query: 'get_iocs', days: 1 },
      {
        timeout: TIMEOUT,
        headers: {
          'Auth-Key': API_KEY,
          'User-Agent': 'Elara-Cybersecurity-Platform/1.0',
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    if (data.query_status !== 'ok') {
      logger.warn(`[ThreatFox] API response: ${data.query_status}`);
      return {
        recordsProcessed: 0,
        recordsAdded: 0,
        recordsUpdated: 0,
        errors: 0
      };
    }

    const iocs = data.data || [];
    logger.info(`[ThreatFox] Fetched ${iocs.length} IOCs from last 24 hours`);

    const indicators = iocs.map((item: any) => {
      // Determine type from ioc_type
      let type = 'domain';
      if (item.ioc_type === 'ip:port' || item.ioc_type === 'ip') {
        type = 'ip';
      } else if (item.ioc_type === 'url') {
        type = 'url';
      } else if (item.ioc_type === 'md5_hash' || item.ioc_type === 'sha256_hash') {
        type = 'hash';
      }

      return {
        type,
        value: item.ioc.toLowerCase(),
        severity: item.confidence_level >= 75 ? 'high' : 'medium',
        confidence: item.confidence_level || 75,
        description: `ThreatFox IOC - ${item.malware || 'Unknown malware'}`,
        tags: ['threatfox', 'abuse.ch', 'ioc', item.threat_type || 'unknown'],
        metadata: {
          source: 'threatfox',
          malware: String(item.malware || ''),
          malware_alias: String(item.malware_alias || ''),
          malware_printable: String(item.malware_printable || ''),
          threat_type: String(item.threat_type || ''),
          ioc_type: String(item.ioc_type || ''),
          first_seen: String(item.first_seen || ''),
          last_seen: String(item.last_seen || ''),
          tags: Array.isArray(item.tags) ? item.tags.map((t: any) => String(t)) : [],
          discovered_at: new Date().toISOString()
        }
      };
    });

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[ThreatFox] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[ThreatFox] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync MalwareBazaar recent samples
 * https://mb-api.abuse.ch/ (Uses Auth-Key header)
 */
export async function syncMalwareBazaar(sourceId: string): Promise<AbusechStats> {
  logger.info('[MalwareBazaar] Starting sync...');

  try {
    const response = await axios.post(
      MALWAREBAZAAR_API,
      'query=get_recent&selector=100',
      {
        timeout: TIMEOUT,
        headers: {
          'Auth-Key': API_KEY,
          'User-Agent': 'Elara-Cybersecurity-Platform/1.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const data = response.data;

    if (data.query_status !== 'ok') {
      logger.warn(`[MalwareBazaar] API response: ${data.query_status}`);
      return {
        recordsProcessed: 0,
        recordsAdded: 0,
        recordsUpdated: 0,
        errors: 0
      };
    }

    const samples = data.data || [];
    logger.info(`[MalwareBazaar] Fetched ${samples.length} recent malware samples`);

    const indicators = samples.flatMap((item: any) => {
      const indicators: any[] = [];

      // Add SHA256 hash
      if (item.sha256_hash) {
        indicators.push({
          type: 'hash',
          value: item.sha256_hash.toLowerCase(),
          severity: 'high',
          confidence: 95,
          description: `Malware sample: ${item.file_name || 'Unknown'}`,
          tags: ['malware', 'malwarebazaar', 'abuse.ch', item.signature || 'unknown'],
          metadata: {
            source: 'malwarebazaar',
            file_name: String(item.file_name || ''),
            file_type: String(item.file_type || ''),
            file_size: Number(item.file_size) || 0,
            signature: String(item.signature || ''),
            first_seen: String(item.first_seen || ''),
            last_seen: String(item.last_seen || ''),
            tags: Array.isArray(item.tags) ? item.tags.map((t: any) => String(t)) : [],
            discovered_at: new Date().toISOString()
          }
        });
      }

      // Add MD5 hash if available
      if (item.md5_hash && item.md5_hash !== item.sha256_hash) {
        indicators.push({
          type: 'hash',
          value: item.md5_hash.toLowerCase(),
          severity: 'high',
          confidence: 95,
          description: `Malware sample: ${item.file_name || 'Unknown'} (MD5)`,
          tags: ['malware', 'malwarebazaar', 'abuse.ch', item.signature || 'unknown'],
          metadata: {
            source: 'malwarebazaar',
            file_name: String(item.file_name || ''),
            file_type: String(item.file_type || ''),
            signature: String(item.signature || ''),
            discovered_at: new Date().toISOString()
          }
        });
      }

      return indicators;
    });

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[MalwareBazaar] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[MalwareBazaar] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync SSL Blacklist malicious certificates
 * https://sslbl.abuse.ch/
 */
export async function syncSSLBlacklist(sourceId: string): Promise<AbusechStats> {
  logger.info('[SSL Blacklist] Starting sync...');

  try {
    const response = await axios.get(SSLBL_API, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0',
        ...(API_KEY && { 'API-KEY': API_KEY })
      }
    });

    // Parse CSV format
    const lines = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('#'));

    logger.info(`[SSL Blacklist] Fetched ${lines.length} SSL certificate fingerprints`);

    const indicators = lines.map((line: string) => {
      // CSV format: Listingdate,SHA1,Listingreason
      const parts = line.split(',');
      if (parts.length < 3) return null;

      const [listingDate, sha1, reason] = parts;

      return {
        type: 'hash',
        value: sha1,
        severity: 'high',
        confidence: 90,
        description: `Malicious SSL certificate - ${reason || 'Unknown'}`,
        tags: ['ssl', 'certificate', 'sslbl', 'abuse.ch', reason || 'unknown'],
        metadata: {
          source: 'sslbl',
          listing_date: String(listingDate || ''),
          reason: String(reason || ''),
          hash_type: 'sha1',
          discovered_at: new Date().toISOString()
        }
      };
    }).filter((indicator: any): indicator is NonNullable<typeof indicator> => indicator !== null);

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[SSL Blacklist] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[SSL Blacklist] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test Abuse.ch connections
 */
export async function testAbusechConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(
      URLHAUS_API,
      {
        timeout: 10000,
        headers: {
          'Auth-Key': API_KEY,
          'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
        }
      }
    );

    if (response.data.query_status === 'ok') {
      const urls = response.data.urls || [];
      return {
        success: true,
        sample: urls.slice(0, 3).map((url: any) => ({
          url: url.url,
          threat: url.threat,
          status: url.url_status
        }))
      };
    }

    return {
      success: false,
      error: `API returned status: ${response.data.query_status}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
