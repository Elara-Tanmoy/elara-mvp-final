import { logger } from '../../config/logger.js';
import { promises as dns } from 'dns';

export interface EmailSecurityResult {
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG - Email Security (25 points max)
 */
export async function analyzeEmailSecurity(hostname: string): Promise<EmailSecurityResult> {
  const findings: any[] = [];
  let score = 0;
  const maxScore = 25;
  const evidence: any = {};

  try {
    const domain = hostname.replace('www.', '');

    // SPF Record Check (6 points)
    try {
      const spfRecords = await dns.resolveTxt(domain);
      const hasSPF = spfRecords.some(record => record.join('').includes('v=spf1'));
      evidence.hasSPF = hasSPF;
      if (!hasSPF) {
        score += 6;
        findings.push({ severity: 'medium', message: 'No SPF record found - email spoofing possible', points: 6, source: 'SPF Check' });
      }
    } catch (error) {
      score += 6;
      findings.push({ severity: 'medium', message: 'SPF record missing', points: 6, source: 'SPF Check' });
    }

    // DMARC Policy Check (8 points)
    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
      const hasDMARC = dmarcRecords.length > 0;
      evidence.hasDMARC = hasDMARC;

      if (!hasDMARC) {
        score += 8;
        findings.push({ severity: 'medium', message: 'No DMARC policy - vulnerable to email impersonation', points: 8, source: 'DMARC Check' });
      } else {
        const dmarcPolicy = dmarcRecords[0].join('');
        if (dmarcPolicy.includes('p=none')) {
          score += 4;
          findings.push({ severity: 'low', message: 'Weak DMARC policy (p=none)', points: 4, source: 'DMARC Check' });
        }
      }
    } catch (error) {
      score += 8;
      findings.push({ severity: 'medium', message: 'DMARC policy not found', points: 8, source: 'DMARC Check' });
    }

    // MX Records Check (4 points)
    try {
      const mxRecords = await dns.resolveMx(domain);
      evidence.mxRecords = mxRecords.length;

      if (mxRecords.length === 0) {
        score += 4;
        findings.push({ severity: 'low', message: 'No email servers configured', points: 4, source: 'MX Check' });
      }
    } catch (error) {
      score += 4;
      findings.push({ severity: 'low', message: 'No MX records found', points: 4, source: 'MX Check' });
    }

    logger.info(`[Email Security] Complete: ${score}/${maxScore} points`);
    return { score, maxScore, findings, evidence };
  } catch (error) {
    logger.error('[Email Security] Error:', error);
    return { score: 0, maxScore, findings: [], evidence: {} };
  }
}
