import axios from 'axios';
import { logger } from '../../config/logger.js';

export interface SecurityHeadersResult {
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG - Security Headers (25 points max)
 */
export async function analyzeSecurityHeaders(url: string): Promise<SecurityHeadersResult> {
  const findings: any[] = [];
  let score = 0;
  const maxScore = 25;
  const evidence: any = {};

  try {
    const response = await axios.head(url, { timeout: 3000, validateStatus: () => true, maxRedirects: 0 });
    const headers = response.headers;

    // CSP check (6 points)
    if (!headers['content-security-policy']) {
      score += 6;
      findings.push({ severity: 'medium', message: 'Missing Content-Security-Policy header', points: 6, source: 'Security Headers' });
    }

    // X-Frame-Options (4 points)
    if (!headers['x-frame-options']) {
      score += 4;
      findings.push({ severity: 'medium', message: 'Missing X-Frame-Options - vulnerable to clickjacking', points: 4, source: 'Security Headers' });
    }

    // X-Content-Type-Options (3 points)
    if (!headers['x-content-type-options']) {
      score += 3;
      findings.push({ severity: 'low', message: 'Missing X-Content-Type-Options header', points: 3, source: 'Security Headers' });
    }

    // Secure cookies (4 points)
    const cookies = headers['set-cookie'] || [];
    const insecureCookies = Array.isArray(cookies)
      ? cookies.filter((c: string) => !c.includes('Secure') || !c.includes('HttpOnly'))
      : [];

    if (insecureCookies.length > 0) {
      score += 4;
      findings.push({ severity: 'medium', message: `${insecureCookies.length} insecure cookie(s) detected`, points: 4, source: 'Cookie Security' });
    }

    // Security.txt (2 points)
    try {
      const securityTxt = await axios.get(`${new URL(url).origin}/.well-known/security.txt`, { timeout: 2000 });
      if (securityTxt.status !== 200) {
        score += 2;
        findings.push({ severity: 'info', message: 'No security.txt file found', points: 2, source: 'Security Contact' });
      }
    } catch {
      score += 2;
      findings.push({ severity: 'info', message: 'No security.txt file found', points: 2, source: 'Security Contact' });
    }

    evidence.headers = {
      csp: !!headers['content-security-policy'],
      xFrameOptions: !!headers['x-frame-options'],
      xContentTypeOptions: !!headers['x-content-type-options'],
      strictTransportSecurity: !!headers['strict-transport-security']
    };

    logger.info(`[Security Headers] Complete: ${score}/${maxScore} points`);
    return { score, maxScore, findings, evidence };
  } catch (error) {
    logger.error('[Security Headers] Error:', error);
    return { score: 0, maxScore, findings: [], evidence: {} };
  }
}
