import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';

export interface PrivacyAnalysisResult {
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG - Privacy Analysis (50 points max)
 */
export async function analyzePrivacy(url: string, hostname: string): Promise<PrivacyAnalysisResult> {
  const findings: any[] = [];
  let score = 0;
  const maxScore = 50;
  const evidence: any = {};

  try {
    const response = await axios.get(url, { timeout: 5000, validateStatus: () => true });
    const $ = cheerio.load(response.data);

    // Privacy policy check (15 points)
    const hasPrivacyLink = $('a[href*="privacy"]').length > 0;
    if (!hasPrivacyLink) {
      score += 15;
      findings.push({ severity: 'high', message: 'No privacy policy found', points: 15, source: 'Privacy Check' });
    }

    // GDPR compliance (8 points)
    const hasGDPRNotice = /gdpr|cookie.*consent|data.*protection/i.test(response.data);
    evidence.gdprCompliant = hasGDPRNotice;
    if (!hasGDPRNotice) {
      score += 8;
      findings.push({ severity: 'medium', message: 'No GDPR compliance indicators', points: 8, source: 'GDPR Check' });
    }

    // Unsecured forms (12 points)
    const unsecuredForms = $('form').filter((_, el) => {
      const action = $(el).attr('action');
      return action?.startsWith('http://');
    }).length;
    if (unsecuredForms > 0) {
      score += 12;
      findings.push({ severity: 'high', message: `${unsecuredForms} form(s) submit data insecurely`, points: 12, source: 'Form Security' });
    }

    // Contact information (8 points)
    const hasContact = $('a[href^="mailto:"]').length > 0 || /contact|support.*email/i.test(response.data);
    if (!hasContact) {
      score += 8;
      findings.push({ severity: 'medium', message: 'No contact information found', points: 8, source: 'Contact Check' });
    }

    logger.info(`[Privacy Analysis] Complete: ${score}/${maxScore} points`);
    return { score, maxScore, findings, evidence };
  } catch (error) {
    logger.error('[Privacy Analysis] Error:', error);
    return { score: 0, maxScore, findings: [], evidence: {} };
  }
}
