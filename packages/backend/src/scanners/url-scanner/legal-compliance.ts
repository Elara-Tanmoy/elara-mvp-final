import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';

export interface LegalComplianceResult {
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG - Legal Compliance (35 points max)
 */
export async function analyzeLegalCompliance(url: string): Promise<LegalComplianceResult> {
  const findings: any[] = [];
  let score = 0;
  const maxScore = 35;
  const evidence: any = {};

  try {
    const response = await axios.get(url, { timeout: 5000, validateStatus: () => true });
    const $ = cheerio.load(response.data);
    const pageText = response.data.toLowerCase();

    // Terms of Service check (10 points)
    const hasTerms = $('a[href*="terms"]').length > 0 || /terms.*service|terms.*use|terms.*condition/i.test(pageText);
    if (!hasTerms) {
      score += 10;
      findings.push({ severity: 'medium', message: 'No terms of service found', points: 10, source: 'Legal Check' });
    }

    // Business registration (8 points)
    const hasBusinessInfo = /registration.*number|company.*number|vat.*number|tax.*id/i.test(pageText);
    if (!hasBusinessInfo) {
      score += 8;
      findings.push({ severity: 'medium', message: 'No business registration information', points: 8, source: 'Business Verification' });
    }

    // Refund policy (4 points)
    const hasRefund = $('a[href*="refund"]').length > 0 || /refund.*policy|money.*back.*guarantee/i.test(pageText);
    if (!hasRefund) {
      score += 4;
      findings.push({ severity: 'low', message: 'No refund policy found', points: 4, source: 'Consumer Protection' });
    }

    // Subscription traps (7 points)
    const hasSubscription = /automatically.*renew|recurring.*payment|subscription.*fee|monthly.*charge/i.test(pageText);
    const hasDisclaimer = /cancel.*anytime|unsubscribe/i.test(pageText);
    if (hasSubscription && !hasDisclaimer) {
      score += 7;
      findings.push({ severity: 'medium', message: 'Subscription terms without clear cancellation info', points: 7, source: 'Subscription Analysis' });
    }

    logger.info(`[Legal Compliance] Complete: ${score}/${maxScore} points`);
    return { score, maxScore, findings, evidence };
  } catch (error) {
    logger.error('[Legal Compliance] Error:', error);
    return { score: 0, maxScore, findings: [], evidence: {} };
  }
}
