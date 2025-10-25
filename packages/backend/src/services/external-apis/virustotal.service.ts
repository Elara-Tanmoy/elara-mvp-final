/**
 * VirusTotal API Integration
 * Checks URLs against VirusTotal database for malicious content
 */

import axios from 'axios';
import { logger } from '../../config/logger.js';

export interface VirusTotalResult {
  detected: boolean;
  positives: number;
  total: number;
  scanDate?: Date;
  permalink?: string;
  engines?: Array<{
    engine: string;
    detected: boolean;
    result?: string;
  }>;
}

export class VirusTotalService {
  private apiKey: string;
  private baseUrl = 'https://www.virustotal.com/api/v3';

  constructor() {
    this.apiKey = process.env.VIRUSTOTAL_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('[VirusTotal] API key not configured - service disabled');
    }
  }

  /**
   * Check URL against VirusTotal
   */
  async checkUrl(url: string): Promise<VirusTotalResult | null> {
    if (!this.apiKey) {
      logger.debug('[VirusTotal] Skipping - no API key');
      return null;
    }

    try {
      // Step 1: Submit URL for analysis
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');

      // Step 2: Get analysis results
      const response = await axios.get(`${this.baseUrl}/urls/${urlId}`, {
        headers: {
          'x-apikey': this.apiKey
        },
        timeout: 10000
      });

      const data = response.data.data;
      const stats = data.attributes.last_analysis_stats;
      const results = data.attributes.last_analysis_results;

      // Parse engine results
      const engines = Object.entries(results).map(([engine, result]: [string, any]) => ({
        engine,
        detected: result.category !== 'undetected' && result.category !== 'harmless',
        result: result.category
      }));

      const totalEngines = Object.keys(results).length;
      const detectedEngines = engines.filter(e => e.detected).length;

      return {
        detected: detectedEngines > 0,
        positives: detectedEngines,
        total: totalEngines,
        scanDate: new Date(data.attributes.last_analysis_date * 1000),
        permalink: `https://www.virustotal.com/gui/url/${urlId}`,
        engines: engines.filter(e => e.detected) // Only return engines that detected
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        // URL not in database - submit for scanning
        try {
          await this.submitUrl(url);
          logger.info(`[VirusTotal] URL submitted for scanning: ${url}`);
          return {
            detected: false,
            positives: 0,
            total: 0
          };
        } catch (submitError) {
          logger.error(`[VirusTotal] Failed to submit URL:`, submitError);
        }
      } else {
        logger.error(`[VirusTotal] Error checking URL:`, error.message);
      }
      return null;
    }
  }

  /**
   * Submit URL for scanning
   */
  private async submitUrl(url: string): Promise<void> {
    if (!this.apiKey) return;

    const formData = new URLSearchParams();
    formData.append('url', url);

    await axios.post(`${this.baseUrl}/urls`, formData, {
      headers: {
        'x-apikey': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const virusTotalService = new VirusTotalService();
