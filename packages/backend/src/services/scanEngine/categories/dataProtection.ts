/**
 * Category 13: Data Protection & Privacy (50 points)
 *
 * Checks:
 * - Missing privacy policy (15 pts)
 * - Excessive data collection (12 pts)
 * - Missing cookie consent (10 pts)
 * - GDPR compliance issues (10 pts)
 * - Third-party tracking (8 pts)
 * - Data transmission security (5 pts)
 *
 * Runs in: FULL pipeline (requires HTTP response)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class DataProtectionCategory extends CategoryAnalyzer {
  // Privacy policy indicators
  private static readonly PRIVACY_POLICY_PATTERNS = [
    /privacy\s+policy/i,
    /privacy\s+statement/i,
    /data\s+protection/i,
    /privacy\.html/i,
    /privacy\.php/i
  ];

  // GDPR indicators
  private static readonly GDPR_PATTERNS = [
    /gdpr/i,
    /general\s+data\s+protection/i,
    /right\s+to\s+erasure/i,
    /data\s+controller/i,
    /data\s+processor/i
  ];

  // Cookie consent patterns
  private static readonly COOKIE_CONSENT_PATTERNS = [
    /cookie\s+(consent|banner|notice|policy)/i,
    /we\s+use\s+cookies/i,
    /accept\s+(all\s+)?cookies/i,
    /cookie\s+preferences/i
  ];

  // Excessive data collection fields
  private static readonly SENSITIVE_DATA_FIELDS = [
    /ssn|social.?security/i,
    /passport/i,
    /driver.?license/i,
    /national.?id/i,
    /tax.?id/i,
    /birth.?date|dob/i,
    /mother.?maiden/i,
    /security.?question/i
  ];

  // Third-party tracking domains
  private static readonly TRACKING_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.net',
    'doubleclick.net',
    'scorecardresearch.com',
    'quantserve.com',
    'hotjar.com',
    'mixpanel.com',
    'segment.com',
    'amplitude.com'
  ];

  constructor() {
    super('dataProtection', 'Data Protection & Privacy');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.dataProtection;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;

    logger.debug(`[Data Protection] Analyzing privacy for: ${context.url}`);

    // Check 1: Privacy Policy
    const policyFindings = this.checkPrivacyPolicy(body, config.checkWeights);
    findings.push(...policyFindings);

    // Check 2: Excessive Data Collection
    const dataCollectionFindings = this.checkDataCollection(body, config.checkWeights);
    findings.push(...dataCollectionFindings);

    // Check 3: Cookie Consent
    const cookieFindings = this.checkCookieConsent(body, config.checkWeights);
    findings.push(...cookieFindings);

    // Check 4: GDPR Compliance
    const gdprFindings = this.checkGDPRCompliance(body, config.checkWeights);
    findings.push(...gdprFindings);

    // Check 5: Third-Party Tracking
    const trackingFindings = this.checkThirdPartyTracking(body, config.checkWeights);
    findings.push(...trackingFindings);

    // Check 6: Data Transmission Security
    const securityFindings = this.checkDataTransmissionSecurity(
      body,
      context.urlComponents.protocol,
      config.checkWeights
    );
    findings.push(...securityFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Data Protection] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 6,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for privacy policy
   */
  private checkPrivacyPolicy(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    let hasPrivacyPolicy = false;

    for (const pattern of DataProtectionCategory.PRIVACY_POLICY_PATTERNS) {
      if (pattern.test(body)) {
        hasPrivacyPolicy = true;
        break;
      }
    }

    if (!hasPrivacyPolicy) {
      findings.push(this.createFinding(
        'privacy_no_policy',
        'No Privacy Policy',
        'high',
        weights.privacy_no_policy || 15,
        'No privacy policy found (GDPR/CCPA violation)',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check for excessive data collection
   */
  private checkDataCollection(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract input fields
    const inputFields = body.match(/<input[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi) || [];
    const fieldNames = inputFields.map(input => {
      const match = input.match(/name\s*=\s*["']([^"']+)["']/i);
      return match ? match[1].toLowerCase() : '';
    });

    // Count sensitive fields
    const sensitiveFields: string[] = [];
    for (const fieldName of fieldNames) {
      for (const pattern of DataProtectionCategory.SENSITIVE_DATA_FIELDS) {
        if (pattern.test(fieldName)) {
          sensitiveFields.push(fieldName);
          break;
        }
      }
    }

    if (sensitiveFields.length >= 3) {
      findings.push(this.createFinding(
        'privacy_excessive_data_collection',
        'Excessive Sensitive Data Collection',
        'high',
        weights.privacy_excessive_data_collection || 12,
        `Collects ${sensitiveFields.length} sensitive personal data fields`,
        { fields: sensitiveFields }
      ));
    }

    return findings;
  }

  /**
   * Check for cookie consent
   */
  private checkCookieConsent(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    let hasCookieConsent = false;

    for (const pattern of DataProtectionCategory.COOKIE_CONSENT_PATTERNS) {
      if (pattern.test(body)) {
        hasCookieConsent = true;
        break;
      }
    }

    // Check for cookies being set
    const hasCookies = body.includes('document.cookie') ||
                       body.includes('setCookie') ||
                       /<script[^>]*>[\s\S]*cookie[\s\S]*<\/script>/i.test(body);

    if (hasCookies && !hasCookieConsent) {
      findings.push(this.createFinding(
        'privacy_no_cookie_consent',
        'Missing Cookie Consent',
        'medium',
        weights.privacy_no_cookie_consent || 10,
        'Sets cookies without consent banner (GDPR violation)',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check GDPR compliance indicators
   */
  private checkGDPRCompliance(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    let hasGDPRMention = false;

    for (const pattern of DataProtectionCategory.GDPR_PATTERNS) {
      if (pattern.test(body)) {
        hasGDPRMention = true;
        break;
      }
    }

    // If collecting personal data but no GDPR mention
    const hasPersonalDataForms = /<input[^>]*type\s*=\s*["'](email|password|text)["'][^>]*>/i.test(body);

    if (hasPersonalDataForms && !hasGDPRMention) {
      findings.push(this.createFinding(
        'privacy_no_gdpr_compliance',
        'No GDPR Compliance Information',
        'medium',
        weights.privacy_no_gdpr_compliance || 8,
        'Collects personal data without GDPR compliance statement',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check for third-party tracking
   */
  private checkThirdPartyTracking(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const detectedTrackers: string[] = [];

    for (const domain of DataProtectionCategory.TRACKING_DOMAINS) {
      if (body.includes(domain)) {
        detectedTrackers.push(domain);
      }
    }

    if (detectedTrackers.length >= 3) {
      findings.push(this.createFinding(
        'privacy_excessive_tracking',
        'Excessive Third-Party Tracking',
        'medium',
        weights.privacy_excessive_tracking || 8,
        `Uses ${detectedTrackers.length} third-party tracking services`,
        { trackers: detectedTrackers.slice(0, 5) }
      ));
    }

    return findings;
  }

  /**
   * Check data transmission security
   */
  private checkDataTransmissionSecurity(
    body: string,
    protocol: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Check for forms submitting over HTTP
    if (protocol === 'http') {
      const hasForms = /<form[^>]*>/i.test(body);
      if (hasForms) {
        findings.push(this.createFinding(
          'privacy_insecure_data_transmission',
          'Insecure Data Transmission',
          'high',
          weights.privacy_insecure_data_transmission || 10,
          'Forms transmitted over unencrypted HTTP',
          {}
        ));
      }
    }

    return findings;
  }
}
