import whois from 'whois-json';
import { logger } from '../../config/logger.js';

export interface DomainAnalysisResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  evidence: {
    domainAge?: number;
    registrationDate?: string;
    expirationDate?: string;
    registrar?: string;
    privacyProtection?: boolean;
    previousMaliciousUse?: boolean;
  };
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  points: number;
  source: string;
}

const SUSPICIOUS_REGISTRARS = [
  'namecheap', 'godaddy privacy', 'domains by proxy',
  'whoisguard', 'privacy protect', 'contact privacy'
];

const HIGH_RISK_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'
];

/**
 * RYAN RAG - Domain Analysis (40 points max)
 * Analyzes domain registration details, age, and reputation
 */
export async function analyzeDomain(hostname: string): Promise<DomainAnalysisResult> {
  const findings: Finding[] = [];
  let score = 0;
  const maxScore = 40;
  const evidence: any = {};

  try {
    logger.info(`[Domain Analysis] Analyzing ${hostname}`);

    // Extract domain from hostname (remove subdomains)
    const domainParts = hostname.split('.');
    const domain = domainParts.length > 2
      ? domainParts.slice(-2).join('.')
      : hostname;

    // 1. WHOIS Lookup (with timeout and error handling)
    try {
      const whoisData = await Promise.race([
        whois(domain),
        new Promise((_, reject) => setTimeout(() => reject(new Error('WHOIS timeout')), 5000))
      ]) as any;

      if (whoisData) {
        evidence.registrationDate = whoisData.creationDate || whoisData.createdDate;
        evidence.expirationDate = whoisData.expirationDate || whoisData.registryExpiryDate;
        evidence.registrar = whoisData.registrar;

        // 2. Domain Age Check (0-20 points)
        if (evidence.registrationDate) {
          const regDate = new Date(evidence.registrationDate);
          const ageInDays = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));
          evidence.domainAge = ageInDays;

          if (ageInDays < 7) {
            score += 20;
            findings.push({
              severity: 'critical',
              message: `Domain registered ${ageInDays} days ago (extremely new - high risk)`,
              points: 20,
              source: 'WHOIS'
            });
          } else if (ageInDays < 30) {
            score += 15;
            findings.push({
              severity: 'high',
              message: `Domain registered ${ageInDays} days ago (very new)`,
              points: 15,
              source: 'WHOIS'
            });
          } else if (ageInDays < 90) {
            score += 10;
            findings.push({
              severity: 'medium',
              message: `Domain registered ${ageInDays} days ago (relatively new)`,
              points: 10,
              source: 'WHOIS'
            });
          } else if (ageInDays < 365) {
            score += 5;
            findings.push({
              severity: 'low',
              message: `Domain is ${ageInDays} days old (less than 1 year)`,
              points: 5,
              source: 'WHOIS'
            });
          } else {
            findings.push({
              severity: 'info',
              message: `Domain is ${Math.floor(ageInDays / 365)} years old (established)`,
              points: 0,
              source: 'WHOIS'
            });
          }
        }

        // 3. Privacy Protection Detection (6 points)
        const registrarLower = (evidence.registrar || '').toLowerCase();
        const hasPrivacy = SUSPICIOUS_REGISTRARS.some(sr => registrarLower.includes(sr));
        evidence.privacyProtection = hasPrivacy;

        if (hasPrivacy) {
          score += 6;
          findings.push({
            severity: 'medium',
            message: 'Domain uses privacy protection to hide owner identity',
            points: 6,
            source: 'WHOIS'
          });
        }

        // 4. Suspicious Registrar Patterns (4 points)
        const suspiciousKeywords = ['cheap', 'bulk', 'discount', 'free'];
        const hasSuspiciousRegistrar = suspiciousKeywords.some(kw =>
          registrarLower.includes(kw)
        );

        if (hasSuspiciousRegistrar) {
          score += 4;
          findings.push({
            severity: 'low',
            message: `Registered with potentially suspicious registrar: ${evidence.registrar}`,
            points: 4,
            source: 'WHOIS'
          });
        }
      }
    } catch (whoisError) {
      logger.warn(`[Domain Analysis] WHOIS lookup failed for ${domain}:`, whoisError);
      findings.push({
        severity: 'info',
        message: 'WHOIS data unavailable - domain analysis limited',
        points: 0,
        source: 'WHOIS'
      });
    }

    // 5. High-Risk TLD Check (5 points)
    const tld = '.' + domain.split('.').pop();
    if (HIGH_RISK_TLDS.includes(tld.toLowerCase())) {
      score += 5;
      findings.push({
        severity: 'medium',
        message: `Uses high-risk top-level domain: ${tld}`,
        points: 5,
        source: 'TLD Analysis'
      });
    }

    // 6. Suspicious Domain Patterns (5 points)
    const suspiciousPatterns = [
      /secure-/i,
      /verify-/i,
      /account-/i,
      /login-/i,
      /update-/i,
      /confirm-/i,
      /-official/i,
      /\d{5,}/  // Many numbers
    ];

    const matchedPattern = suspiciousPatterns.find(pattern => pattern.test(hostname));
    if (matchedPattern) {
      score += 5;
      findings.push({
        severity: 'low',
        message: 'Domain contains suspicious pattern often used in phishing',
        points: 5,
        source: 'Pattern Analysis'
      });
    }

    logger.info(`[Domain Analysis] Complete: ${score}/${maxScore} points`);

    return {
      score,
      maxScore,
      findings,
      evidence
    };

  } catch (error) {
    logger.error('[Domain Analysis] Error:', error);
    return {
      score: 0,
      maxScore,
      findings: [{
        severity: 'info',
        message: 'Domain analysis could not be completed',
        points: 0,
        source: 'System'
      }],
      evidence: {}
    };
  }
}
