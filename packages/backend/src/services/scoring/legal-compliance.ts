import * as cheerio from 'cheerio';
import axios from 'axios';

interface Finding {
  check: string;
  result: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
  maxPoints: number;
  explanation: string;
  evidence?: any;
}

interface LegalComplianceResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export class LegalComplianceAnalyzer {
  /**
   * Complete Legal & Compliance Framework Analysis (35 points)
   *
   * Categories:
   * - Terms of Service (8 points)
   * - Refund Policy (7 points)
   * - Business Registration (8 points)
   * - Regulatory Compliance (7 points)
   * - Consumer Protection (5 points)
   */
  async analyzeLegalCompliance(url: string, htmlContent: string): Promise<LegalComplianceResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 35;

    try {
      const $ = cheerio.load(htmlContent);

      // Add global timeout for legal compliance (5 seconds - these are fast checks)
      const analysisPromise = Promise.all([
        this.checkTermsOfService($),
        this.checkRefundPolicy($),
        this.checkBusinessRegistration($),
        this.checkRegulatoryCompliance($, url),
        this.checkConsumerProtection($)
      ]);

      const results = await Promise.race([
        analysisPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Legal compliance timeout')), 5000)
        )
      ]);

      // Process results
      results.forEach(result => {
        findings.push(...result.findings);
        score += result.score;
      });

    } catch (error) {
      console.error('Legal compliance analysis error:', error);
      findings.push({
        check: 'Legal Compliance Analysis',
        result: 'Timeout or Error',
        severity: 'MEDIUM',
        points: 0,
        maxPoints: 0,
        explanation: 'Legal compliance analysis encountered an error or timeout.',
        evidence: { error: (error as Error).message }
      });
    }

    const status = score >= 20 ? 'FAIL' : score >= 10 ? 'WARNING' : 'PASS';

    return { score, maxScore, findings, status };
  }

  private async checkTermsOfService($: cheerio.CheerioAPI): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Check for Terms of Service/Terms and Conditions link
    const tosLinks = $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      const href = $(el).attr('href')?.toLowerCase() || '';
      return (
        text.includes('terms of service') ||
        text.includes('terms and conditions') ||
        text.includes('terms of use') ||
        href.includes('terms') ||
        href.includes('tos')
      );
    });

    if (tosLinks.length === 0) {
      score += 6;
      findings.push({
        check: 'Terms of Service',
        result: 'Not Found',
        severity: 'HIGH',
        points: 6,
        maxPoints: 6,
        explanation: 'No Terms of Service found. Legitimate businesses must disclose terms governing use of their service.',
        evidence: { tosLinksFound: 0 }
      });
    } else {
      // Check if TOS link is valid
      const tosUrl = tosLinks.first().attr('href');
      if (tosUrl && (tosUrl === '#' || tosUrl.startsWith('javascript:'))) {
        score += 4;
        findings.push({
          check: 'Terms of Service Link',
          result: 'Invalid Link',
          severity: 'HIGH',
          points: 4,
          maxPoints: 6,
          explanation: 'Terms of Service link is non-functional (placeholder or JavaScript)',
          evidence: { tosUrl }
        });
      } else {
        findings.push({
          check: 'Terms of Service',
          result: 'Present',
          severity: 'LOW',
          points: 0,
          maxPoints: 6,
          explanation: 'Terms of Service link found on page',
          evidence: { tosUrl, linkCount: tosLinks.length }
        });
      }
    }

    // Check for last updated date in TOS
    const bodyText = $('body').text();
    const hasLastUpdated = /last updated|effective date|updated on/i.test(bodyText);

    if (!hasLastUpdated && tosLinks.length > 0) {
      score += 2;
      findings.push({
        check: 'Terms of Service Date',
        result: 'No Update Date',
        severity: 'MEDIUM',
        points: 2,
        maxPoints: 2,
        explanation: 'Terms of Service does not show last updated date. Users cannot verify currency of terms.',
        evidence: { hasLastUpdated: false }
      });
    } else if (hasLastUpdated) {
      findings.push({
        check: 'Terms of Service Date',
        result: 'Update Date Present',
        severity: 'LOW',
        points: 0,
        maxPoints: 2,
        explanation: 'Terms of Service includes last updated date',
        evidence: { hasLastUpdated: true }
      });
    }

    return { score, findings };
  }

  private async checkRefundPolicy($: cheerio.CheerioAPI): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Check for e-commerce indicators
    const hasCheckout = $('a, button').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('checkout') || text.includes('cart') || text.includes('buy now') || text.includes('add to cart');
    }).length > 0;

    const hasPricing = /\$\d+|\d+\.\d{2}|€\d+|£\d+|price:|cost:/i.test($('body').text());

    // If site appears to be e-commerce
    if (hasCheckout || hasPricing) {
      // Check for refund/return policy
      const refundLinks = $('a').filter((_, el) => {
        const text = $(el).text().toLowerCase();
        const href = $(el).attr('href')?.toLowerCase() || '';
        return (
          text.includes('refund') ||
          text.includes('return') ||
          text.includes('money back') ||
          href.includes('refund') ||
          href.includes('return')
        );
      });

      if (refundLinks.length === 0) {
        score += 7;
        findings.push({
          check: 'Refund Policy',
          result: 'Missing (E-commerce Site)',
          severity: 'CRITICAL',
          points: 7,
          maxPoints: 7,
          explanation: 'Site appears to sell products but has no refund policy. Major red flag for e-commerce legitimacy. Consumer protection laws require clear refund terms.',
          evidence: { hasCheckout, hasPricing, refundLinksFound: 0 }
        });
      } else {
        // Check if refund link is valid
        const refundUrl = refundLinks.first().attr('href');
        if (refundUrl && (refundUrl === '#' || refundUrl.startsWith('javascript:'))) {
          score += 5;
          findings.push({
            check: 'Refund Policy Link',
            result: 'Invalid Link',
            severity: 'HIGH',
            points: 5,
            maxPoints: 7,
            explanation: 'Refund policy link is non-functional',
            evidence: { refundUrl }
          });
        } else {
          findings.push({
            check: 'Refund Policy',
            result: 'Present',
            severity: 'LOW',
            points: 0,
            maxPoints: 7,
            explanation: 'Refund policy found on e-commerce site',
            evidence: { refundUrl, linkCount: refundLinks.length }
          });
        }
      }
    } else {
      findings.push({
        check: 'Refund Policy',
        result: 'Not Applicable (Non-E-commerce)',
        severity: 'LOW',
        points: 0,
        maxPoints: 7,
        explanation: 'Site does not appear to be e-commerce, refund policy not required',
        evidence: { hasCheckout, hasPricing }
      });
    }

    return { score, findings };
  }

  private async checkBusinessRegistration($: cheerio.CheerioAPI): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    const bodyText = $('body').text();

    // Check for business registration numbers
    const hasCompanyNumber = /company number|registration number|reg\. no|business number|vat number|tax id/i.test(bodyText);

    if (!hasCompanyNumber) {
      score += 5;
      findings.push({
        check: 'Business Registration',
        result: 'No Registration Number',
        severity: 'HIGH',
        points: 5,
        maxPoints: 5,
        explanation: 'No business registration or company number found. Legitimate businesses display registration details for transparency.',
        evidence: { hasCompanyNumber: false }
      });
    } else {
      findings.push({
        check: 'Business Registration',
        result: 'Registration Details Present',
        severity: 'LOW',
        points: 0,
        maxPoints: 5,
        explanation: 'Business registration or company number found on page',
        evidence: { hasCompanyNumber: true }
      });
    }

    // Check for registered business address
    const hasRegisteredAddress = /registered office|registered address|business address/i.test(bodyText);

    if (!hasRegisteredAddress) {
      score += 3;
      findings.push({
        check: 'Registered Business Address',
        result: 'Not Disclosed',
        severity: 'MEDIUM',
        points: 3,
        maxPoints: 3,
        explanation: 'No registered business address disclosed. Required for legal entities in most jurisdictions.',
        evidence: { hasRegisteredAddress: false }
      });
    } else {
      findings.push({
        check: 'Registered Business Address',
        result: 'Disclosed',
        severity: 'LOW',
        points: 0,
        maxPoints: 3,
        explanation: 'Registered business address found',
        evidence: { hasRegisteredAddress: true }
      });
    }

    return { score, findings };
  }

  private async checkRegulatoryCompliance($: cheerio.CheerioAPI, url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    const bodyText = $('body').text().toLowerCase();

    // Check for industry-specific compliance based on content
    const isFinancial = /bank|invest|trading|crypto|forex|loan|mortgage|insurance/i.test(bodyText);
    const isHealthcare = /medical|health|pharma|prescription|doctor|clinic|hospital/i.test(bodyText);
    const isGambling = /casino|betting|poker|gambling|lottery/i.test(bodyText);

    if (isFinancial) {
      // Financial services require specific disclosures
      const hasFinancialDisclosure = /sec|finra|fca|regulated by|license|authorized/i.test(bodyText);

      if (!hasFinancialDisclosure) {
        score += 7;
        findings.push({
          check: 'Financial Regulatory Compliance',
          result: 'No Regulatory Disclosure',
          severity: 'CRITICAL',
          points: 7,
          maxPoints: 7,
          explanation: 'Site appears to offer financial services but has no regulatory disclosures (SEC, FINRA, FCA, etc.). Likely unauthorized/illegal operation.',
          evidence: { industry: 'financial', hasDisclosure: false }
        });
      } else {
        findings.push({
          check: 'Financial Regulatory Compliance',
          result: 'Regulatory Information Present',
          severity: 'LOW',
          points: 0,
          maxPoints: 7,
          explanation: 'Financial regulatory information found on page',
          evidence: { industry: 'financial', hasDisclosure: true }
        });
      }
    } else if (isHealthcare) {
      // Healthcare requires HIPAA, medical licenses, etc.
      const hasHealthcareCompliance = /hipaa|licensed|certified|medical license/i.test(bodyText);

      if (!hasHealthcareCompliance) {
        score += 6;
        findings.push({
          check: 'Healthcare Regulatory Compliance',
          result: 'No Medical Licensing Info',
          severity: 'HIGH',
          points: 6,
          maxPoints: 7,
          explanation: 'Site appears to offer healthcare services but lacks licensing/certification information',
          evidence: { industry: 'healthcare', hasCompliance: false }
        });
      } else {
        findings.push({
          check: 'Healthcare Regulatory Compliance',
          result: 'Licensing Information Present',
          severity: 'LOW',
          points: 0,
          maxPoints: 7,
          explanation: 'Healthcare licensing/certification information found',
          evidence: { industry: 'healthcare', hasCompliance: true }
        });
      }
    } else if (isGambling) {
      // Gambling requires gaming licenses
      const hasGamblingLicense = /gaming license|licensed by|gambling commission|curacao|malta/i.test(bodyText);

      if (!hasGamblingLicense) {
        score += 7;
        findings.push({
          check: 'Gambling Regulatory Compliance',
          result: 'No Gaming License',
          severity: 'CRITICAL',
          points: 7,
          maxPoints: 7,
          explanation: 'Site appears to offer gambling but has no gaming license disclosure. Likely illegal operation.',
          evidence: { industry: 'gambling', hasLicense: false }
        });
      } else {
        findings.push({
          check: 'Gambling Regulatory Compliance',
          result: 'Gaming License Present',
          severity: 'LOW',
          points: 0,
          maxPoints: 7,
          explanation: 'Gaming license information found',
          evidence: { industry: 'gambling', hasLicense: true }
        });
      }
    } else {
      findings.push({
        check: 'Regulatory Compliance',
        result: 'No Specialized Industry Detected',
        severity: 'LOW',
        points: 0,
        maxPoints: 7,
        explanation: 'Site does not appear to be in highly regulated industry',
        evidence: { isFinancial, isHealthcare, isGambling }
      });
    }

    return { score, findings };
  }

  private async checkConsumerProtection($: cheerio.CheerioAPI): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Check for dispute resolution mechanisms
    const bodyText = $('body').text().toLowerCase();

    const hasDisputeResolution = /dispute resolution|arbitration|complaints|customer service|support/i.test(bodyText);

    if (!hasDisputeResolution) {
      score += 3;
      findings.push({
        check: 'Dispute Resolution',
        result: 'Not Provided',
        severity: 'MEDIUM',
        points: 3,
        maxPoints: 3,
        explanation: 'No dispute resolution or customer support information found. Consumer protection requires accessible complaint mechanisms.',
        evidence: { hasDisputeResolution: false }
      });
    } else {
      findings.push({
        check: 'Dispute Resolution',
        result: 'Available',
        severity: 'LOW',
        points: 0,
        maxPoints: 3,
        explanation: 'Dispute resolution or customer support information present',
        evidence: { hasDisputeResolution: true }
      });
    }

    // Check for consumer rights information
    const hasConsumerRights = /consumer rights|your rights|buyer protection|guarantee/i.test(bodyText);

    if (!hasConsumerRights) {
      score += 2;
      findings.push({
        check: 'Consumer Rights',
        result: 'Not Disclosed',
        severity: 'MEDIUM',
        points: 2,
        maxPoints: 2,
        explanation: 'No consumer rights information provided. Legitimate businesses inform customers of their rights.',
        evidence: { hasConsumerRights: false }
      });
    } else {
      findings.push({
        check: 'Consumer Rights',
        result: 'Disclosed',
        severity: 'LOW',
        points: 0,
        maxPoints: 2,
        explanation: 'Consumer rights information available',
        evidence: { hasConsumerRights: true }
      });
    }

    return { score, findings };
  }
}
