import axios from 'axios';
import { logger } from '../config/logger.js';

export interface SafeBrowsingResult {
  listed: boolean;
  threatTypes: string[];
  platformTypes: string[];
  responseTime: number;
  error?: string;
}

/**
 * Google Safe Browsing API Integration
 * Free tier: Unlimited requests
 * Checks URLs against Google's threat database
 */
export async function checkURL(url: string): Promise<SafeBrowsingResult> {
  const startTime = Date.now();
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  try {
    if (!apiKey) {
      logger.warn('[Google Safe Browsing] API key not configured');
      return {
        listed: false,
        threatTypes: [],
        platformTypes: [],
        responseTime: Date.now() - startTime,
        error: 'API key not configured'
      };
    }

    const response = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
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
      },
      { timeout: 5000 }
    );

    const matches = response.data.matches || [];
    const listed = matches.length > 0;

    const threatTypes = [...new Set(matches.map((m: any) => m.threatType))];
    const platformTypes = [...new Set(matches.map((m: any) => m.platformType))];

    logger.info(`[Google Safe Browsing] ${url}: ${listed ? 'LISTED' : 'CLEAN'} (${threatTypes.join(', ')})`);

    return {
      listed,
      threatTypes,
      platformTypes,
      responseTime: Date.now() - startTime
    };

  } catch (error: any) {
    logger.error('[Google Safe Browsing] Error:', error.message);
    return {
      listed: false,
      threatTypes: [],
      platformTypes: [],
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}
