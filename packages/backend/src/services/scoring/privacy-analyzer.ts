import axios from 'axios';
import * as cheerio from 'cheerio';

interface Finding {
  check: string;
  result: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
  maxPoints: number;
  explanation: string;
  evidence?: any;
}

interface PrivacyAnalysisResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export class PrivacyAnalyzer {
  /**
   * Complete Data Protection & Privacy Risk Analysis (50 points)
   *
   * Categories:
   * - Privacy Policy Compliance (12 points)
   * - GDPR/CCPA Requirements (10 points)
   * - User Data Leak Risk (8 points)
   * - Form Security (8 points)
   * - Directory Exposure (6 points)
   * - Contact Transparency (6 points)
   */
  async analyzePrivacy(url: string, htmlContent: string): Promise<PrivacyAnalysisResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 50;

    try {
      const $ = cheerio.load(htmlContent);

      // Add global timeout for privacy analysis (8 seconds)
      const analysisPromise = Promise.all([
        this.checkPrivacyPolicy($, url),
        this.checkDataProtectionCompliance($, url),
        this.checkDataLeakRisks($, url),
        this.checkFormSecurity($, url),
        this.checkDirectoryExposure(url),
        this.checkContactTransparency($)
      ]);

      const results = await Promise.race([
        analysisPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Privacy analysis timeout')), 8000)
        )
      ]);

      // Process results
      results.forEach(result => {
        findings.push(...result.findings);
        score += result.score;
      });

    } catch (error) {
      console.error('Privacy analysis error:', error);
      findings.push({
        check: 'Privacy Analysis',
        result: 'Timeout or Error',
        severity: 'MEDIUM',
        points: 0,
        maxPoints: 0,
        explanation: 'Privacy analysis encountered an error or timeout.',
        evidence: { error: (error as Error).message }
      });
    }

    const status = score >= 30 ? 'FAIL' : score >= 15 ? 'WARNING' : 'PASS';

    return { score, maxScore, findings, status };
  }

  private async checkPrivacyPolicy($: cheerio.CheerioAPI, url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Check for privacy policy link
    const privacyLinks = $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('privacy') || text.includes('policy');
    });

    if (privacyLinks.length === 0) {
      score += 8;
      findings.push({
        check: 'Privacy Policy',
        result: 'Not Found',
        severity: 'HIGH',
        points: 8,
        maxPoints: 8,
        explanation: 'No privacy policy link found on the page. Legitimate sites must have accessible privacy policies.',
        evidence: { privacyLinksFound: 0 }
      });
    } else {
      // Check if privacy policy link is valid
      const privacyUrl = privacyLinks.first().attr('href');
      if (privacyUrl && (privacyUrl === '#' || privacyUrl.startsWith('javascript:'))) {
        score += 6;
        findings.push({
          check: 'Privacy Policy Link',
          result: 'Invalid Link',
          severity: 'HIGH',
          points: 6,
          maxPoints: 8,
          explanation: 'Privacy policy link is non-functional (placeholder or JavaScript link)',
          evidence: { privacyUrl }
        });
      } else {
        findings.push({
          check: 'Privacy Policy',
          result: 'Present',
          severity: 'LOW',
          points: 0,
          maxPoints: 8,
          explanation: 'Privacy policy link found on the page',
          evidence: { privacyUrl, linkCount: privacyLinks.length }
        });
      }
    }

    // Check for cookie consent (GDPR requirement)
    const cookieConsent = $('div, section').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('cookie') && (text.includes('accept') || text.includes('consent'));
    });

    if (cookieConsent.length === 0) {
      score += 4;
      findings.push({
        check: 'Cookie Consent',
        result: 'Missing',
        severity: 'MEDIUM',
        points: 4,
        maxPoints: 4,
        explanation: 'No cookie consent banner detected. GDPR requires explicit consent for cookies.',
        evidence: { cookieConsentFound: false }
      });
    } else {
      findings.push({
        check: 'Cookie Consent',
        result: 'Present',
        severity: 'LOW',
        points: 0,
        maxPoints: 4,
        explanation: 'Cookie consent mechanism detected on page',
        evidence: { cookieConsentFound: true }
      });
    }

    return { score, findings };
  }

  private async checkDataProtectionCompliance($: cheerio.CheerioAPI, url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Check for GDPR/CCPA compliance statements
    const bodyText = $('body').text().toLowerCase();

    const hasGDPR = bodyText.includes('gdpr') || bodyText.includes('general data protection');
    const hasCCPA = bodyText.includes('ccpa') || bodyText.includes('california consumer privacy');

    if (!hasGDPR && !hasCCPA) {
      score += 6;
      findings.push({
        check: 'Data Protection Compliance',
        result: 'No Compliance Statements',
        severity: 'HIGH',
        points: 6,
        maxPoints: 6,
        explanation: 'No GDPR or CCPA compliance statements found. Sites handling user data must comply with data protection regulations.',
        evidence: { hasGDPR, hasCCPA }
      });
    } else {
      findings.push({
        check: 'Data Protection Compliance',
        result: hasGDPR && hasCCPA ? 'Full Compliance' : 'Partial Compliance',
        severity: 'LOW',
        points: 0,
        maxPoints: 6,
        explanation: `Compliance statements found: ${hasGDPR ? 'GDPR' : ''} ${hasCCPA ? 'CCPA' : ''}`,
        evidence: { hasGDPR, hasCCPA }
      });
    }

    // Check for data subject rights information
    const hasRightToAccess = bodyText.includes('right to access') || bodyText.includes('access your data');
    const hasRightToDelete = bodyText.includes('right to delete') || bodyText.includes('right to erasure') || bodyText.includes('delete your data');

    if (!hasRightToAccess && !hasRightToDelete) {
      score += 4;
      findings.push({
        check: 'Data Subject Rights',
        result: 'Not Disclosed',
        severity: 'MEDIUM',
        points: 4,
        maxPoints: 4,
        explanation: 'No information about user data rights (access, deletion, etc.). Required by GDPR/CCPA.',
        evidence: { hasRightToAccess, hasRightToDelete }
      });
    } else {
      findings.push({
        check: 'Data Subject Rights',
        result: 'Disclosed',
        severity: 'LOW',
        points: 0,
        maxPoints: 4,
        explanation: 'User data rights information present',
        evidence: { hasRightToAccess, hasRightToDelete }
      });
    }

    return { score, findings };
  }

  private async checkDataLeakRisks($: cheerio.CheerioAPI, url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Check for exposed sensitive data in HTML
    const htmlContent = $.html();

    // Email addresses exposed in HTML
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const exposedEmails = htmlContent.match(emailRegex) || [];

    if (exposedEmails.length > 5) {
      score += 3;
      findings.push({
        check: 'Email Exposure',
        result: `${exposedEmails.length} emails exposed`,
        severity: 'MEDIUM',
        points: 3,
        maxPoints: 3,
        explanation: 'Multiple email addresses exposed in HTML source. Can be harvested by bots for spam.',
        evidence: { emailCount: exposedEmails.length, sample: exposedEmails.slice(0, 3) }
      });
    } else if (exposedEmails.length > 0) {
      findings.push({
        check: 'Email Exposure',
        result: `${exposedEmails.length} emails found`,
        severity: 'LOW',
        points: 0,
        maxPoints: 3,
        explanation: 'Some email addresses present, but within normal range',
        evidence: { emailCount: exposedEmails.length }
      });
    }

    // Phone numbers exposed
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const exposedPhones = htmlContent.match(phoneRegex) || [];

    if (exposedPhones.length > 3) {
      score += 2;
      findings.push({
        check: 'Phone Number Exposure',
        result: `${exposedPhones.length} phone numbers exposed`,
        severity: 'MEDIUM',
        points: 2,
        maxPoints: 2,
        explanation: 'Multiple phone numbers exposed in HTML source',
        evidence: { phoneCount: exposedPhones.length }
      });
    }

    // Check for third-party tracking
    const trackingScripts = $('script[src]').filter((_, el) => {
      const src = $(el).attr('src') || '';
      return src.includes('analytics') || src.includes('tracking') || src.includes('pixel');
    });

    if (trackingScripts.length > 5) {
      score += 3;
      findings.push({
        check: 'Third-Party Tracking',
        result: `${trackingScripts.length} tracking scripts`,
        severity: 'MEDIUM',
        points: 3,
        maxPoints: 3,
        explanation: 'Excessive third-party tracking scripts detected. Privacy concern.',
        evidence: { scriptCount: trackingScripts.length }
      });
    }

    return { score, findings };
  }

  private async checkFormSecurity($: cheerio.CheerioAPI, url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    const forms = $('form');

    if (forms.length > 0) {
      forms.each((_, form) => {
        const $form = $(form);
        const action = $form.attr('action');
        const method = $form.attr('method')?.toLowerCase();

        // Check for password fields
        const passwordFields = $form.find('input[type="password"]');

        if (passwordFields.length > 0) {
          // Password form without HTTPS
          if (!url.startsWith('https://')) {
            score += 5;
            findings.push({
              check: 'Password Form Security',
              result: 'Insecure (No HTTPS)',
              severity: 'CRITICAL',
              points: 5,
              maxPoints: 5,
              explanation: 'Password input field on non-HTTPS page. Credentials transmitted in plaintext.',
              evidence: { formAction: action, method, https: false }
            });
          }

          // Check for autocomplete on password fields
          const hasAutocompleteOff = passwordFields.filter((_, el) =>
            $(el).attr('autocomplete') === 'off' || $(el).attr('autocomplete') === 'new-password'
          ).length > 0;

          if (!hasAutocompleteOff) {
            score += 1;
            findings.push({
              check: 'Password Autocomplete',
              result: 'Enabled',
              severity: 'LOW',
              points: 1,
              maxPoints: 1,
              explanation: 'Password field allows autocomplete. Minor security risk.',
              evidence: { autocomplete: 'enabled' }
            });
          }
        }

        // Check for GET method on sensitive forms
        if (method === 'get' && passwordFields.length > 0) {
          score += 2;
          findings.push({
            check: 'Form Method Security',
            result: 'GET method on password form',
            severity: 'HIGH',
            points: 2,
            maxPoints: 2,
            explanation: 'Password form uses GET method. Credentials will appear in URL and logs.',
            evidence: { method: 'GET', hasPasswordField: true }
          });
        }
      });
    }

    return { score, findings };
  }

  private async checkDirectoryExposure(url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    // Common sensitive directories to check
    const sensitiveDirectories = [
      '/.git/',
      '/.env',
      '/admin/',
      '/backup/',
      '/.aws/',
      '/config/'
    ];

    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

      for (const dir of sensitiveDirectories) {
        try {
          const response = await axios.head(`${baseUrl}${dir}`, {
            timeout: 2000,
            validateStatus: () => true, // Don't throw on any status
            maxRedirects: 0 // Don't follow redirects
          });

          if (response.status === 200 || response.status === 403) {
            score += 1;
            findings.push({
              check: 'Directory Exposure',
              result: `${dir} accessible`,
              severity: dir.includes('.git') || dir.includes('.env') ? 'CRITICAL' : 'MEDIUM',
              points: 1,
              maxPoints: 1,
              explanation: `Sensitive directory ${dir} is accessible. May expose configuration or source code.`,
              evidence: { directory: dir, status: response.status }
            });
          }
        } catch (error) {
          // Directory not accessible - this is good
        }
      }
    } catch (error) {
      console.error('Directory exposure check error:', error);
    }

    return { score, findings };
  }

  private async checkContactTransparency($: cheerio.CheerioAPI): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    const bodyText = $('body').text().toLowerCase();

    // Check for physical address
    const hasAddress = bodyText.includes('address:') || bodyText.includes('location:') ||
                       /\d+\s+[\w\s]+\s+(street|avenue|road|blvd|drive)/i.test(bodyText);

    if (!hasAddress) {
      score += 3;
      findings.push({
        check: 'Physical Address',
        result: 'Not Provided',
        severity: 'MEDIUM',
        points: 3,
        maxPoints: 3,
        explanation: 'No physical address found. Legitimate businesses typically provide contact addresses.',
        evidence: { addressFound: false }
      });
    } else {
      findings.push({
        check: 'Physical Address',
        result: 'Provided',
        severity: 'LOW',
        points: 0,
        maxPoints: 3,
        explanation: 'Physical address present on page',
        evidence: { addressFound: true }
      });
    }

    // Check for contact information
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(bodyText);
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(bodyText);
    const hasContactPage = $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('contact');
    }).length > 0;

    if (!hasPhone && !hasEmail && !hasContactPage) {
      score += 3;
      findings.push({
        check: 'Contact Information',
        result: 'None Found',
        severity: 'HIGH',
        points: 3,
        maxPoints: 3,
        explanation: 'No contact information (phone, email, or contact page) found. Major red flag for legitimacy.',
        evidence: { hasPhone, hasEmail, hasContactPage }
      });
    } else if ((!hasPhone && !hasEmail) || !hasContactPage) {
      score += 1;
      findings.push({
        check: 'Contact Information',
        result: 'Incomplete',
        severity: 'MEDIUM',
        points: 1,
        maxPoints: 3,
        explanation: 'Limited contact information available',
        evidence: { hasPhone, hasEmail, hasContactPage }
      });
    } else {
      findings.push({
        check: 'Contact Information',
        result: 'Complete',
        severity: 'LOW',
        points: 0,
        maxPoints: 3,
        explanation: 'Multiple contact methods available',
        evidence: { hasPhone, hasEmail, hasContactPage }
      });
    }

    return { score, findings };
  }
}
