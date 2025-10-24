import axios from 'axios';
import { logger } from '../config/logger.js';

export interface VirusTotalResult {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total: number;
  responseTime: number;
  error?: string;
}

/**
 * VirusTotal URL Scanner
 * Free tier: 4 requests/min, 500/day
 */
export async function scanURL(url: string): Promise<VirusTotalResult> {
  const startTime = Date.now();
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    return {
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
      total: 0,
      responseTime: Date.now() - startTime,
      error: 'API key not configured'
    };
  }

  try {
    // Submit URL for scanning
    const submitResponse = await axios.post(
      'https://www.virustotal.com/api/v3/urls',
      `url=${encodeURIComponent(url)}`,
      {
        headers: {
          'x-apikey': apiKey,
          'content-type': 'application/x-www-form-urlencoded'
        },
        timeout: 5000
      }
    );

    const analysisId = submitResponse.data.data.id;

    // Wait 2 seconds for analysis to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get analysis results
    const resultResponse = await axios.get(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      {
        headers: { 'x-apikey': apiKey },
        timeout: 5000
      }
    );

    const stats = resultResponse.data.data.attributes.stats;

    logger.info(`[VirusTotal] ${url}: ${stats.malicious} malicious / ${stats.malicious + stats.harmless} total`);

    return {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      total: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
      responseTime: Date.now() - startTime
    };

  } catch (error: any) {
    logger.error('[VirusTotal] Error:', error.message);
    return {
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
      total: 0,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}
