/**
 * ScamAdviser API Integration
 * Checks website trust score and reputation
 */

import axios from 'axios';
import { logger } from '../../config/logger.js';

export interface ScamAdviserResult {
  trustScore: number; // 0-100
  riskLevel: string;
  country?: string;
  age?: number;
  warnings?: string[];
  badges?: string[];
}

export class ScamAdviserService {
  private apiKey: string;
  private baseUrl = 'https://api.scamadviser.com/v2';

  constructor() {
    this.apiKey = process.env.SCAMADVISER_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('[ScamAdviser] API key not configured - service disabled');
    }
  }

  /**
   * Check website trust score
   */
  async checkWebsite(url: string): Promise<ScamAdviserResult | null> {
    if (!this.apiKey) {
      logger.debug('[ScamAdviser] Skipping - no API key');
      return null;
    }

    try {
      const domain = new URL(url).hostname;

      const response = await axios.get(`${this.baseUrl}/check`, {
        params: {
          url: domain,
          key: this.apiKey
        },
        timeout: 10000
      });

      const data = response.data;

      // Parse trust score
      const trustScore = data.trust_score || 0;
      let riskLevel = 'UNKNOWN';
      if (trustScore >= 80) riskLevel = 'LOW';
      else if (trustScore >= 60) riskLevel = 'MEDIUM';
      else if (trustScore >= 40) riskLevel = 'HIGH';
      else riskLevel = 'CRITICAL';

      // Parse warnings
      const warnings: string[] = [];
      if (data.warnings) {
        warnings.push(...data.warnings);
      }
      if (data.domain_age && data.domain_age < 180) {
        warnings.push('Domain is less than 6 months old');
      }
      if (data.ssl_valid === false) {
        warnings.push('Invalid SSL certificate');
      }

      // Parse badges
      const badges: string[] = [];
      if (data.badges) {
        badges.push(...data.badges);
      }

      return {
        trustScore,
        riskLevel,
        country: data.country,
        age: data.domain_age,
        warnings: warnings.length > 0 ? warnings : undefined,
        badges: badges.length > 0 ? badges : undefined
      };

    } catch (error: any) {
      logger.error(`[ScamAdviser] Error checking website:`, error.message);
      return null;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const scamAdviserService = new ScamAdviserService();
