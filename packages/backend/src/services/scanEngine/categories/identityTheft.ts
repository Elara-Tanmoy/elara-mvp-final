/**
 * Category 9: Identity Theft (20 points)
 *
 * Checks:
 * - PII collection (SSN, passport, etc: 8 pts)
 * - Document upload requests (7 pts)
 * - Verification scams (5 pts)
 * - Account takeover patterns (4 pts)
 *
 * Runs in: FULL pipeline
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class IdentityTheftCategory extends CategoryAnalyzer {
  // Highly sensitive PII fields
  private static readonly PII_FIELDS = [
    /ssn|social.?security/i,
    /passport|passport.?number/i,
    /driver.?license|dl.?number/i,
    /national.?id|id.?number/i,
    /tax.?id|ein/i,
    /birth.?date|dob|date.?of.?birth/i,
    /mother.?maiden|maiden.?name/i,
    /medical|health.?insurance/i
  ];

  // Document upload indicators
  private static readonly DOCUMENT_UPLOAD_PATTERNS = [
    /upload.*?(document|photo|scan)/i,
    /file.*input.*accept.*image/i,
    /<input[^>]*type\s*=\s*["']file["'][^>]*>/i,
    /submit.*?(id|document|passport|license)/i
  ];

  // Verification scam patterns
  private static readonly VERIFICATION_SCAM_PATTERNS = [
    /verify.?your.?(identity|account|information)/i,
    /confirm.?your.?(identity|account|details)/i,
    /update.?your.?(personal|account).?information/i,
    /account.?(suspended|locked|restricted)/i,
    /prevent.?account.?closure/i,
    /restore.?access/i
  ];

  // Account takeover indicators
  private static readonly ACCOUNT_TAKEOVER_PATTERNS = [
    /reset.?password/i,
    /change.?email/i,
    /update.?security/i,
    /two.?factor|2fa/i,
    /security.?code|verification.?code/i
  ];

  // ENHANCED: ID/Passport Upload Detection (CRITICAL)
  // Government ID upload requests are extremely high-risk for identity theft
  private static readonly ID_UPLOAD_KEYWORDS = [
    /(?:upload|submit|provide|send).*?(?:government|official|valid)\s*(?:id|identification)/i,
    /(?:upload|submit|provide|send).*?passport/i,
    /(?:upload|submit|provide|send).*?driver'?s?\s*licen[cs]e/i,
    /(?:upload|submit|provide|send).*?national\s*id/i,
    /photo\s*id/i,
    /identity\s*(?:card|document)/i,
    /government\s*issued\s*id/i
  ];

  private static readonly ID_LABEL_PATTERNS = [
    /passport/i,
    /driver'?s?\s*licen[cs]e|dl\s*number/i,
    /national\s*id|government\s*id/i,
    /photo\s*id|id\s*card/i,
    /identity\s*(?:card|document|proof)/i,
    /official\s*id/i
  ];

  constructor() {
    super('identityTheft', 'Identity Theft');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.identityTheft;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;

    logger.debug(`[Identity Theft] Analyzing for: ${context.url}`);

    // Check 1: PII Collection
    const piiFindings = this.checkPIICollection(body, config.checkWeights);
    findings.push(...piiFindings);

    // Check 2: Document Uploads
    const documentFindings = this.checkDocumentUploads(body, config.checkWeights);
    findings.push(...documentFindings);

    // Check 3: Verification Scams
    const verificationFindings = this.checkVerificationScams(body, config.checkWeights);
    findings.push(...verificationFindings);

    // Check 4: Account Takeover
    const accountFindings = this.checkAccountTakeover(body, config.checkWeights);
    findings.push(...accountFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Identity Theft] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 4,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for PII collection
   */
  private checkPIICollection(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract input fields
    const inputFields = body.match(/<input[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi) || [];
    const fieldNames = inputFields.map(input => {
      const match = input.match(/name\s*=\s*["']([^"']+)["']/i);
      return match ? match[1].toLowerCase() : '';
    });

    // Check for PII fields
    const piiFields: string[] = [];
    for (const fieldName of fieldNames) {
      for (const pattern of IdentityTheftCategory.PII_FIELDS) {
        if (pattern.test(fieldName)) {
          piiFields.push(fieldName);
          break;
        }
      }
    }

    if (piiFields.length >= 2) {
      findings.push(this.createFinding(
        'identity_pii_collection',
        'Excessive PII Collection',
        'high',
        weights.identity_pii_collection || 10,
        `Collects ${piiFields.length} highly sensitive PII fields`,
        { fields: piiFields }
      ));
    }

    return findings;
  }

  /**
   * Check for document upload requests
   */
  private checkDocumentUploads(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of IdentityTheftCategory.DOCUMENT_UPLOAD_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'identity_document_upload',
        'Document Upload Request',
        'high',
        weights.identity_document_upload || 8,
        'Requests upload of identity documents',
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check for verification scams
   */
  private checkVerificationScams(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of IdentityTheftCategory.VERIFICATION_SCAM_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'identity_verification_scam',
        'Verification Scam Pattern',
        'high',
        weights.identity_verification_scam || 7,
        `${matches.length} verification scam indicators detected`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check for account takeover patterns
   */
  private checkAccountTakeover(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of IdentityTheftCategory.ACCOUNT_TAKEOVER_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    // If many account-related functions on a suspicious site
    if (matches.length >= 3) {
      findings.push(this.createFinding(
        'identity_account_takeover',
        'Account Takeover Indicators',
        'medium',
        weights.identity_account_takeover || 5,
        `${matches.length} account takeover patterns`,
        { count: matches.length }
      ));
    }

    return findings;
  }
}
