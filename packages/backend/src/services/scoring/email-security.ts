import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);
const resolveMx = promisify(dns.resolveMx);

interface Finding {
  check: string;
  result: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
  maxPoints: number;
  explanation: string;
  evidence?: any;
}

interface EmailSecurityResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export class EmailSecurityAnalyzer {
  /**
   * Complete Email Security & DMARC Compliance Analysis (25 points)
   *
   * Categories:
   * - SPF Record Validation (6 points)
   * - DKIM Configuration (5 points)
   * - DMARC Policy Strength (8 points)
   * - MX Record Analysis (4 points)
   * - Email Spoofing Vulnerability (2 points)
   */
  async analyzeEmailSecurity(domain: string): Promise<EmailSecurityResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 25;

    try {
      // Add global timeout for entire email security check (10 seconds)
      const analysisPromise = Promise.all([
        this.checkSPF(domain),
        this.checkDKIM(domain),
        this.checkDMARC(domain),
        this.checkMX(domain),
        this.checkSpoofingVulnerability(domain)
      ]);

      const results = await Promise.race([
        analysisPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Email security analysis timeout')), 10000)
        )
      ]);

      // Process results
      findings.push(...results[0].findings);
      score += results[0].score;

      findings.push(...results[1].findings);
      score += results[1].score;

      findings.push(...results[2].findings);
      score += results[2].score;

      findings.push(...results[3].findings);
      score += results[3].score;

      findings.push(...results[4].findings);
      score += results[4].score;

    } catch (error) {
      console.error('Email security analysis error:', error);
      // Add timeout finding
      findings.push({
        check: 'Email Security Analysis',
        result: 'Timeout',
        severity: 'MEDIUM',
        points: 0,
        maxPoints: 0,
        explanation: 'Email security analysis timed out. DNS queries may be slow or unresponsive.',
        evidence: { error: (error as Error).message }
      });
    }

    const status = score >= 15 ? 'FAIL' : score >= 8 ? 'WARNING' : 'PASS';

    return { score, maxScore, findings, status };
  }

  private async checkSPF(domain: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    try {
      // Add timeout to DNS resolution
      const records = await Promise.race([
        resolveTxt(domain),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), 3000)
        )
      ]);
      const spfRecord = records.find(record =>
        record.some(part => part.startsWith('v=spf1'))
      );

      if (!spfRecord) {
        score += 6;
        findings.push({
          check: 'SPF Record',
          result: 'Missing',
          severity: 'HIGH',
          points: 6,
          maxPoints: 6,
          explanation: 'No SPF record found. Emails from this domain can be easily spoofed. SPF (Sender Policy Framework) is critical for email authentication.',
          evidence: { spfRecord: null, recordsChecked: records.length }
        });
      } else {
        const spfString = spfRecord.join('');

        // Check SPF policy strictness
        if (spfString.includes('~all')) {
          score += 2;
          findings.push({
            check: 'SPF Policy',
            result: 'SoftFail (~all)',
            severity: 'MEDIUM',
            points: 2,
            maxPoints: 6,
            explanation: 'SPF uses SoftFail (~all). Better than nothing, but should use HardFail (-all) for maximum security.',
            evidence: { spfRecord: spfString, policy: 'SoftFail' }
          });
        } else if (spfString.includes('+all')) {
          score += 5;
          findings.push({
            check: 'SPF Policy',
            result: 'Pass All (+all)',
            severity: 'HIGH',
            points: 5,
            maxPoints: 6,
            explanation: 'SPF uses Pass All (+all). This allows ANY server to send email as this domain. Completely ineffective.',
            evidence: { spfRecord: spfString, policy: 'PassAll' }
          });
        } else if (spfString.includes('-all')) {
          findings.push({
            check: 'SPF Record',
            result: 'Strict HardFail (-all)',
            severity: 'LOW',
            points: 0,
            maxPoints: 6,
            explanation: 'SPF properly configured with HardFail (-all) policy. Strong email authentication.',
            evidence: { spfRecord: spfString, policy: 'HardFail' }
          });
        } else if (spfString.includes('?all')) {
          score += 3;
          findings.push({
            check: 'SPF Policy',
            result: 'Neutral (?all)',
            severity: 'MEDIUM',
            points: 3,
            maxPoints: 6,
            explanation: 'SPF uses Neutral (?all). Provides no protection against spoofing.',
            evidence: { spfRecord: spfString, policy: 'Neutral' }
          });
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        score += 6;
        findings.push({
          check: 'SPF Record',
          result: 'Not Found',
          severity: 'HIGH',
          points: 6,
          maxPoints: 6,
          explanation: 'DNS lookup failed or no SPF record exists. Domain vulnerable to email spoofing.',
          evidence: { error: error.code }
        });
      }
    }

    return { score, findings };
  }

  private async checkDKIM(domain: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Common DKIM selectors to check
    const commonSelectors = [
      'default',
      'google',
      'k1',
      's1',
      's2',
      'selector1',
      'selector2',
      'dkim',
      'mail'
    ];

    let dkimFound = false;

    try {
      for (const selector of commonSelectors) {
        try {
          const dkimDomain = `${selector}._domainkey.${domain}`;
          const records = await Promise.race([
            resolveTxt(dkimDomain),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('DNS timeout')), 2000)
            )
          ]);

          if (records.length > 0) {
            const dkimRecord = records.find(record =>
              record.some(part => part.includes('v=DKIM1') || part.includes('p='))
            );

            if (dkimRecord) {
              dkimFound = true;
              const dkimString = dkimRecord.join('');

              // Check if public key exists
              if (dkimString.includes('p=;') || dkimString.includes('p=')) {
                const publicKeyMatch = dkimString.match(/p=([^;]+)/);
                if (publicKeyMatch && publicKeyMatch[1].length > 10) {
                  findings.push({
                    check: 'DKIM Configuration',
                    result: `Found (${selector})`,
                    severity: 'LOW',
                    points: 0,
                    maxPoints: 5,
                    explanation: `DKIM properly configured with selector '${selector}'. Email signatures can be verified.`,
                    evidence: { selector, dkimRecord: dkimString }
                  });
                }
              }
              break;
            }
          }
        } catch (error) {
          // Continue checking other selectors
        }
      }

      if (!dkimFound) {
        score += 5;
        findings.push({
          check: 'DKIM Configuration',
          result: 'Not Found',
          severity: 'HIGH',
          points: 5,
          maxPoints: 5,
          explanation: 'No DKIM records found with common selectors. DKIM provides cryptographic email authentication. Absence increases spoofing risk.',
          evidence: { selectorsChecked: commonSelectors }
        });
      }
    } catch (error) {
      console.error('DKIM check error:', error);
    }

    return { score, findings };
  }

  private async checkDMARC(domain: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await Promise.race([
        resolveTxt(dmarcDomain),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), 3000)
        )
      ]);

      const dmarcRecord = records.find(record =>
        record.some(part => part.startsWith('v=DMARC1'))
      );

      if (!dmarcRecord) {
        score += 8;
        findings.push({
          check: 'DMARC Policy',
          result: 'Missing',
          severity: 'CRITICAL',
          points: 8,
          maxPoints: 8,
          explanation: 'No DMARC record found. DMARC tells receiving servers how to handle unauthenticated emails. Critical for preventing phishing.',
          evidence: { dmarcRecord: null }
        });
      } else {
        const dmarcString = dmarcRecord.join('');

        // Parse DMARC policy
        const policyMatch = dmarcString.match(/p=([^;]+)/);
        const policy = policyMatch ? policyMatch[1] : 'none';

        switch (policy) {
          case 'none':
            score += 5;
            findings.push({
              check: 'DMARC Policy',
              result: 'Monitor Only (p=none)',
              severity: 'HIGH',
              points: 5,
              maxPoints: 8,
              explanation: 'DMARC policy set to "none" - only monitoring, no enforcement. Provides visibility but no protection.',
              evidence: { dmarcRecord: dmarcString, policy: 'none' }
            });
            break;

          case 'quarantine':
            score += 2;
            findings.push({
              check: 'DMARC Policy',
              result: 'Quarantine (p=quarantine)',
              severity: 'MEDIUM',
              points: 2,
              maxPoints: 8,
              explanation: 'DMARC policy set to "quarantine" - suspicious emails go to spam. Moderate protection.',
              evidence: { dmarcRecord: dmarcString, policy: 'quarantine' }
            });
            break;

          case 'reject':
            findings.push({
              check: 'DMARC Policy',
              result: 'Strict Reject (p=reject)',
              severity: 'LOW',
              points: 0,
              maxPoints: 8,
              explanation: 'DMARC policy set to "reject" - strongest protection. Unauthenticated emails are rejected.',
              evidence: { dmarcRecord: dmarcString, policy: 'reject' }
            });
            break;

          default:
            score += 3;
            findings.push({
              check: 'DMARC Policy',
              result: `Unknown Policy (${policy})`,
              severity: 'MEDIUM',
              points: 3,
              maxPoints: 8,
              explanation: 'DMARC policy is non-standard or malformed.',
              evidence: { dmarcRecord: dmarcString, policy }
            });
        }

        // Check for aggregate reporting
        const hasRua = dmarcString.includes('rua=');
        if (!hasRua) {
          score += 1;
          findings.push({
            check: 'DMARC Reporting',
            result: 'No Aggregate Reports',
            severity: 'LOW',
            points: 1,
            maxPoints: 1,
            explanation: 'DMARC configured without aggregate reporting (rua). Missing visibility into authentication failures.',
            evidence: { hasRua: false }
          });
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        score += 8;
        findings.push({
          check: 'DMARC Policy',
          result: 'Not Found',
          severity: 'CRITICAL',
          points: 8,
          maxPoints: 8,
          explanation: 'DNS lookup for DMARC record failed. Domain has no email authentication policy.',
          evidence: { error: error.code }
        });
      }
    }

    return { score, findings };
  }

  private async checkMX(domain: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    try {
      const mxRecords = await Promise.race([
        resolveMx(domain),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), 3000)
        )
      ]);

      if (!mxRecords || mxRecords.length === 0) {
        score += 4;
        findings.push({
          check: 'MX Records',
          result: 'Missing',
          severity: 'HIGH',
          points: 4,
          maxPoints: 4,
          explanation: 'No MX (Mail Exchange) records found. Domain cannot receive email, indicating it may be a disposable or fake domain.',
          evidence: { mxRecords: [] }
        });
      } else {
        // Check for suspicious MX patterns
        const mxExchanges = mxRecords.map(mx => mx.exchange.toLowerCase());

        // Check for temporary email services
        const tempEmailProviders = ['tempmail', 'guerrillamail', 'mailinator', '10minutemail'];
        const isTempEmail = tempEmailProviders.some(provider =>
          mxExchanges.some(mx => mx.includes(provider))
        );

        if (isTempEmail) {
          score += 3;
          findings.push({
            check: 'MX Records',
            result: 'Temporary Email Service',
            severity: 'HIGH',
            points: 3,
            maxPoints: 4,
            explanation: 'MX records point to temporary/disposable email service. Often used for fraudulent activities.',
            evidence: { mxRecords: mxExchanges }
          });
        } else {
          findings.push({
            check: 'MX Records',
            result: `${mxRecords.length} record(s) found`,
            severity: 'LOW',
            points: 0,
            maxPoints: 4,
            explanation: 'Valid MX records configured. Domain can receive email.',
            evidence: { mxRecords: mxRecords.map(mx => ({ exchange: mx.exchange, priority: mx.priority })) }
          });
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        score += 4;
        findings.push({
          check: 'MX Records',
          result: 'Not Found',
          severity: 'HIGH',
          points: 4,
          maxPoints: 4,
          explanation: 'MX record lookup failed. Domain likely cannot receive email.',
          evidence: { error: error.code }
        });
      }
    }

    return { score, findings };
  }

  private async checkSpoofingVulnerability(domain: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Calculate overall email spoofing vulnerability based on SPF, DKIM, DMARC
    try {
      const [spfRecords, dmarcRecords] = await Promise.all([
        Promise.race([
          resolveTxt(domain).catch(() => []),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000))
        ]),
        Promise.race([
          resolveTxt(`_dmarc.${domain}`).catch(() => []),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000))
        ])
      ]);

      const hasSPF = spfRecords.some(record =>
        record.some(part => part.startsWith('v=spf1'))
      );

      const hasDMARC = dmarcRecords.some(record =>
        record.some(part => part.startsWith('v=DMARC1'))
      );

      if (!hasSPF && !hasDMARC) {
        score += 2;
        findings.push({
          check: 'Email Spoofing Risk',
          result: 'CRITICAL - No Protection',
          severity: 'CRITICAL',
          points: 2,
          maxPoints: 2,
          explanation: 'Domain has NO email authentication (no SPF, no DMARC). Extremely easy to spoof emails from this domain.',
          evidence: { hasSPF, hasDMARC, vulnerability: 'CRITICAL' }
        });
      } else if (!hasSPF || !hasDMARC) {
        score += 1;
        findings.push({
          check: 'Email Spoofing Risk',
          result: 'HIGH - Partial Protection',
          severity: 'HIGH',
          points: 1,
          maxPoints: 2,
          explanation: `Domain has partial email authentication (${hasSPF ? 'SPF' : 'no SPF'}, ${hasDMARC ? 'DMARC' : 'no DMARC'}). Vulnerable to spoofing.`,
          evidence: { hasSPF, hasDMARC, vulnerability: 'HIGH' }
        });
      } else {
        findings.push({
          check: 'Email Spoofing Risk',
          result: 'Protected',
          severity: 'LOW',
          points: 0,
          maxPoints: 2,
          explanation: 'Domain has both SPF and DMARC configured. Email authentication in place.',
          evidence: { hasSPF, hasDMARC, vulnerability: 'LOW' }
        });
      }
    } catch (error) {
      console.error('Spoofing vulnerability check error:', error);
    }

    return { score, findings };
  }
}
