/**
 * Category 14: Email Security - SPF/DMARC/DKIM (25 points)
 *
 * Checks:
 * - Missing SPF record (10 pts)
 * - Missing DMARC record (8 pts)
 * - Weak SPF policy (~all: 5 pts)
 * - Weak DMARC policy (p=none: 4 pts)
 *
 * Runs in: ALL pipelines (DNS-based, works even OFFLINE)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class EmailSecurityCategory extends CategoryAnalyzer {
  constructor() {
    super('emailSecurity', 'Email Security (SPF/DMARC/DKIM)');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Can run in all pipelines (DNS-based)
    return true;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.emailSecurity;

    if (!context.dnsRecords?.TXT) {
      return this.createSkippedResult('No DNS TXT records', config.maxWeight);
    }

    const txtRecords = context.dnsRecords.TXT;

    logger.debug(`[Email Security] Analyzing email security for: ${context.urlComponents.domain}`);

    // Check 1: SPF Record
    const spfFindings = this.checkSPF(txtRecords, config.checkWeights);
    findings.push(...spfFindings);

    // Check 2: DMARC Record
    const dmarcFindings = await this.checkDMARC(
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...dmarcFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Email Security] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 2,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check SPF record
   */
  private checkSPF(txtRecords: string[], weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Find SPF record
    const spfRecord = txtRecords.find(record =>
      record.toLowerCase().startsWith('v=spf1')
    );

    if (!spfRecord) {
      findings.push(this.createFinding(
        'email_missing_spf',
        'Missing SPF Record',
        'medium',
        weights.email_missing_spf || 10,
        'Domain has no SPF record (email spoofing risk)',
        {}
      ));
      return findings;
    }

    // Check for weak SPF policy (~all = softfail, allows spoofing)
    if (spfRecord.includes('~all')) {
      findings.push(this.createFinding(
        'email_weak_spf_policy',
        'Weak SPF Policy',
        'low',
        weights.email_weak_spf_policy || 5,
        'SPF uses softfail (~all) instead of hardfail (-all)',
        { spfRecord }
      ));
    }

    // Check for very permissive SPF (+all = allows all senders)
    if (spfRecord.includes('+all')) {
      findings.push(this.createFinding(
        'email_permissive_spf',
        'Permissive SPF Policy',
        'high',
        weights.email_permissive_spf || 12,
        'SPF allows all senders (+all) - no email authentication',
        { spfRecord }
      ));
    }

    return findings;
  }

  /**
   * Check DMARC record
   */
  private async checkDMARC(domain: string, weights: Record<string, number>): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const dns = require('dns').promises;
      const dmarcDomain = `_dmarc.${domain}`;

      const txtRecords = await dns.resolveTxt(dmarcDomain).catch(() => []);
      const dmarcRecord = txtRecords.flat().find((record: string) =>
        record.toLowerCase().startsWith('v=dmarc1')
      );

      if (!dmarcRecord) {
        findings.push(this.createFinding(
          'email_missing_dmarc',
          'Missing DMARC Record',
          'medium',
          weights.email_missing_dmarc || 8,
          'Domain has no DMARC record (email spoofing risk)',
          {}
        ));
        return findings;
      }

      // Check for weak DMARC policy (p=none)
      if (/p=none/i.test(dmarcRecord)) {
        findings.push(this.createFinding(
          'email_weak_dmarc_policy',
          'Weak DMARC Policy',
          'low',
          weights.email_weak_dmarc_policy || 4,
          'DMARC policy set to "none" (monitoring only)',
          { dmarcRecord }
        ));
      }
    } catch (error) {
      logger.debug(`[Email Security] Could not check DMARC for ${domain}`);
    }

    return findings;
  }
}
