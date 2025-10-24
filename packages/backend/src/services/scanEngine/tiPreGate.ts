/**
 * Stage 0.3: Threat Intelligence Pre-Gate
 * Quick check of top 4 TI sources before full scan
 * Stops immediately if any confirm malicious
 */

import { TIPreGateResult } from './types.js';
import { logger } from '../../config/logger.js';

export class TIPreGate {
  private static readonly PREGATE_TIMEOUT = 2000; // 2 seconds total
  private static readonly SOURCE_TIMEOUT = 1500;  // 1.5 seconds per source

  /**
   * Run pre-gate checks on top 4 TI sources
   * Returns immediately if any confirm malicious
   */
  static async check(url: string, config?: any): Promise<TIPreGateResult> {
    const startTime = Date.now();

    const result: TIPreGateResult = {
      maliciousConfirmed: false,
      shouldStop: false,
      checks: {},
      duration: 0
    };

    try {
      // Run all 4 checks in parallel with individual timeouts
      const checks = await Promise.all([
        this.checkGoogleSafeBrowsing(url).catch(e => ({ safe: true, error: e.message })),
        this.checkVirusTotal(url).catch(e => ({ detections: 0, error: e.message })),
        this.checkPhishTank(url).catch(e => ({ listed: false, error: e.message })),
        this.checkURLhaus(url).catch(e => ({ active: false, error: e.message }))
      ]);

      result.checks.googleSafeBrowsing = checks[0];
      result.checks.virusTotal = checks[1];
      result.checks.phishTank = checks[2];
      result.checks.urlhaus = checks[3];

      // Check if any source confirmed malicious
      if (!checks[0].safe && !checks[0].error) {
        result.maliciousConfirmed = true;
        result.source = 'Google Safe Browsing';
        result.confidence = 95;
        result.shouldStop = true;
      } else if (checks[1].detections && checks[1].detections >= 5) {
        result.maliciousConfirmed = true;
        result.source = 'VirusTotal';
        result.confidence = Math.min(95, checks[1].detections * 5);
        result.shouldStop = true;
      } else if (checks[2].listed && !checks[2].error) {
        result.maliciousConfirmed = true;
        result.source = 'PhishTank';
        result.confidence = 90;
        result.shouldStop = true;
      } else if (checks[3].active && !checks[3].error) {
        result.maliciousConfirmed = true;
        result.source = 'URLhaus';
        result.confidence = 95;
        result.shouldStop = true;
      }

      result.duration = Date.now() - startTime;

      if (result.maliciousConfirmed) {
        logger.warn(`[TI Pre-Gate] MALICIOUS confirmed by ${result.source} in ${result.duration}ms - STOPPING`);
      } else {
        logger.info(`[TI Pre-Gate] Clean (${result.duration}ms) - continuing to full scan`);
      }

      return result;
    } catch (error) {
      logger.error('[TI Pre-Gate] Error:', error);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Google Safe Browsing API v4
   */
  private static async checkGoogleSafeBrowsing(url: string): Promise<{ safe: boolean; error?: string }> {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

    if (!apiKey) {
      return { safe: true, error: 'API key not configured' };
    }

    try {
      const response = await Promise.race([
        fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: {
              clientId: 'elara-platform',
              clientVersion: '1.0.0'
            },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url }]
            }
          })
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.SOURCE_TIMEOUT)
        )
      ]);

      const data = await response.json();

      // If matches found, it's NOT safe
      const safe = !data.matches || data.matches.length === 0;

      return { safe };
    } catch (error) {
      return { safe: true, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * VirusTotal API v3
   */
  private static async checkVirusTotal(url: string): Promise<{ detections: number; error?: string }> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;

    if (!apiKey) {
      return { detections: 0, error: 'API key not configured' };
    }

    try {
      // URL ID = base64 of URL without padding
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');

      const response = await Promise.race([
        fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
          headers: { 'x-apikey': apiKey }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.SOURCE_TIMEOUT)
        )
      ]);

      if (response.status === 404) {
        // URL not found in VT database - safe
        return { detections: 0 };
      }

      const data = await response.json();

      const malicious = data.data?.attributes?.last_analysis_stats?.malicious || 0;

      return { detections: malicious };
    } catch (error) {
      return { detections: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * PhishTank API
   */
  private static async checkPhishTank(url: string): Promise<{ listed: boolean; error?: string }> {
    try {
      const encodedURL = encodeURIComponent(url);

      const response = await Promise.race([
        fetch(`https://checkurl.phishtank.com/checkurl/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `url=${encodedURL}&format=json`
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.SOURCE_TIMEOUT)
        )
      ]);

      const data = await response.json();

      const listed = data.results?.in_database === true && data.results?.valid === true;

      return { listed };
    } catch (error) {
      return { listed: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * URLhaus API
   */
  private static async checkURLhaus(url: string): Promise<{ active: boolean; error?: string }> {
    try {
      const response = await Promise.race([
        fetch(`https://urlhaus-api.abuse.ch/v1/url/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `url=${encodeURIComponent(url)}`
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.SOURCE_TIMEOUT)
        )
      ]);

      const data = await response.json();

      // If query_status is "ok", URL is in database
      // If url_status is "online", it's actively malicious
      const active = data.query_status === 'ok' && data.url_status === 'online';

      return { active };
    } catch (error) {
      return { active: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
