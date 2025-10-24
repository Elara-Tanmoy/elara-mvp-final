import axios from 'axios';
import { logger } from '../../config/logger.js';
import { elaraAuthService } from './elara-auth.service.js';

/**
 * Fact Checker Service for WhatsApp
 *
 * Checks facts and claims sent via WhatsApp messages
 */
class FactCheckerService {
  private readonly elaraApiBaseUrl: string;

  constructor() {
    this.elaraApiBaseUrl = process.env.ELARA_API_BASE_URL || 'https://elara-backend-64tf.onrender.com/api';
  }

  /**
   * Check if text contains a claim that needs fact-checking
   */
  public shouldCheckFact(text: string): boolean {
    const keywords = [
      'fact check',
      'is this true',
      'is it true',
      'true or false',
      'real or fake',
      'verify',
      'authentic',
      'genuine',
      'hoax',
      'rumor',
      'misinformation',
      'disinformation',
      'fake news',
      'check this',
      'confirm'
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Detect claim category
   */
  private detectCategory(text: string): 'health' | 'political' | 'financial' | 'scientific' | 'general' {
    const lowerText = text.toLowerCase();

    if (/(virus|vaccine|covid|health|medical|disease|cure|doctor|hospital|medicine|treatment)/i.test(lowerText)) {
      return 'health';
    }

    if (/(election|government|president|minister|congress|parliament|vote|political|policy)/i.test(lowerText)) {
      return 'political';
    }

    if (/(stock|investment|economy|financial|market|crypto|bitcoin|trading|money|bank)/i.test(lowerText)) {
      return 'financial';
    }

    if (/(study|research|science|climate|experiment|data shows|scientists|discovery)/i.test(lowerText)) {
      return 'scientific';
    }

    return 'general';
  }

  /**
   * Extract claim from message
   */
  private extractClaim(text: string): string {
    // Remove fact-check trigger words
    let claim = text
      .replace(/fact check|is this true|is it true|true or false|real or fake|verify|check this|confirm/gi, '')
      .trim();

    // Remove punctuation from start
    claim = claim.replace(/^[?!.,;:-]+/, '').trim();

    // Limit length
    if (claim.length > 500) {
      claim = claim.substring(0, 500) + '...';
    }

    return claim;
  }

  /**
   * Check fact using Elara API
   */
  public async checkFact(text: string): Promise<any> {
    try {
      logger.info('[FactChecker] Checking fact:', text.substring(0, 100));

      // Get authentication token
      const token = await elaraAuthService.getToken();

      // Extract claim and detect category
      const claim = this.extractClaim(text);
      const category = this.detectCategory(text);

      if (!claim || claim.length < 10) {
        return {
          success: false,
          error: 'No valid claim found to fact-check',
          riskLevel: 'unknown'
        };
      }

      logger.info('[FactChecker] Extracted claim:', { claim, category });

      // Call Elara fact checker API
      const response = await axios.post(
        `${this.elaraApiBaseUrl}/v2/analyze/fact`,
        {
          claim,
          category
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 45000 // 45 seconds for fact checking
        }
      );

      logger.info('[FactChecker] Fact check complete:', {
        claim: claim.substring(0, 50),
        veracity: response.data.data?.veracity,
        confidence: response.data.data?.confidence
      });

      return {
        success: true,
        claim,
        category,
        veracity: response.data.data?.veracity || 'UNVERIFIED',
        confidence: response.data.data?.confidence || 0,
        explanation: response.data.data?.explanation || 'Unable to verify this claim.',
        harmLevel: response.data.data?.harmAssessment?.level || 'NONE',
        harmDescription: response.data.data?.harmAssessment?.description || '',
        evidence: response.data.data?.evidence || [],
        recommendations: response.data.data?.recommendations || [],
        expertConsensus: response.data.data?.expertConsensus || '',
        sourcesCount: response.data.data?.analysisMetadata?.factCheckSourcesCount || 0,
        newsCount: response.data.data?.analysisMetadata?.newsArticlesCount || 0
      };
    } catch (error: any) {
      logger.error('[FactChecker] Fact check failed:', {
        text: text.substring(0, 100),
        error: error.message
      });

      return {
        success: false,
        claim: this.extractClaim(text),
        category: this.detectCategory(text),
        error: error.message,
        veracity: 'ERROR',
        confidence: 0
      };
    }
  }

  /**
   * Determine risk level from veracity
   */
  public getRiskLevelFromVeracity(veracity: string): string {
    const veracityMap: { [key: string]: string } = {
      'TRUE': 'safe',
      'MOSTLY_TRUE': 'low',
      'MIXED': 'medium',
      'MOSTLY_FALSE': 'high',
      'FALSE': 'critical',
      'UNVERIFIED': 'medium',
      'ERROR': 'unknown'
    };

    return veracityMap[veracity.toUpperCase()] || 'unknown';
  }
}

export const factCheckerService = new FactCheckerService();
