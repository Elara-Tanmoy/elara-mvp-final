/**
 * Category 2: SSL/TLS Security (45 points)
 *
 * Checks:
 * - Certificate validity (expired/not yet valid: 20 pts)
 * - Self-signed certificate (15 pts)
 * - Certificate issuer trust (untrusted CA: 12 pts)
 * - Certificate age (too new: 10 pts)
 * - Hostname mismatch (8 pts)
 * - Weak encryption (8 pts)
 * - Certificate chain issues (7 pts)
 *
 * Runs in: FULL, WAF pipelines (requires HTTPS and ONLINE state)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class SSLSecurityCategory extends CategoryAnalyzer {
  // Trusted Certificate Authorities
  private static readonly TRUSTED_CAS = new Set([
    "Let's Encrypt",
    'DigiCert',
    'Sectigo',
    'GoDaddy',
    'GlobalSign',
    'Comodo',
    'Entrust',
    'Amazon',
    'Google Trust Services',
    'Microsoft',
    'Cloudflare',
    'Baltimore',
    'VeriSign',
    'Thawte',
    'GeoTrust'
  ]);

  constructor() {
    super('sslSecurity', 'SSL/TLS Security');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Only run for HTTPS URLs in ONLINE or WAF states
    return (reachabilityState === ReachabilityState.ONLINE ||
            reachabilityState === ReachabilityState.WAF_CHALLENGE);
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.sslSecurity;

    // Skip if not HTTPS
    if (context.urlComponents.protocol !== 'https') {
      logger.debug('[SSL Security] Skipping - not HTTPS');
      return this.createSkippedResult('Not HTTPS', config.maxWeight);
    }

    // Skip if no SSL certificate data
    if (!context.sslCertificate) {
      logger.debug('[SSL Security] Skipping - no SSL certificate data');
      return this.createSkippedResult('SSL certificate data unavailable', config.maxWeight);
    }

    logger.debug(`[SSL Security] Starting analysis for: ${context.urlComponents.hostname}`);

    // Check 1: Certificate Validity (expiration)
    const validityFindings = this.checkCertificateValidity(
      context.sslCertificate,
      config.checkWeights
    );
    findings.push(...validityFindings);

    // Check 2: Self-Signed Certificate
    const selfSignedFindings = this.checkSelfSigned(
      context.sslCertificate,
      config.checkWeights
    );
    findings.push(...selfSignedFindings);

    // Check 3: Certificate Issuer Trust
    const issuerFindings = this.checkIssuerTrust(
      context.sslCertificate,
      config.checkWeights
    );
    findings.push(...issuerFindings);

    // Check 4: Certificate Age
    const ageFindings = this.checkCertificateAge(
      context.sslCertificate,
      config.checkWeights
    );
    findings.push(...ageFindings);

    // Check 5: Hostname Mismatch
    const hostnameFindings = this.checkHostnameMismatch(
      context.urlComponents.hostname,
      context.sslCertificate,
      config.checkWeights
    );
    findings.push(...hostnameFindings);

    // Check 6: Weak Encryption
    const encryptionFindings = this.checkEncryptionStrength(
      context.sslCertificate,
      config.checkWeights
    );
    findings.push(...encryptionFindings);

    // Calculate final score
    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[SSL Security] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

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
   * Check certificate validity (expiration dates)
   */
  private checkCertificateValidity(cert: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const now = new Date();
    const validFrom = new Date(cert.validFrom);
    const validTo = new Date(cert.validTo);

    // Certificate expired
    if (now > validTo) {
      findings.push(this.createFinding(
        'ssl_cert_expired',
        'SSL Certificate Expired',
        'critical',
        weights.ssl_cert_expired || 20,
        `Certificate expired on ${validTo.toISOString().split('T')[0]}`,
        { validTo, expiredDays: Math.floor((now.getTime() - validTo.getTime()) / (1000 * 60 * 60 * 24)) }
      ));
    }
    // Certificate not yet valid
    else if (now < validFrom) {
      findings.push(this.createFinding(
        'ssl_cert_not_yet_valid',
        'SSL Certificate Not Yet Valid',
        'critical',
        weights.ssl_cert_not_yet_valid || 20,
        `Certificate not valid until ${validFrom.toISOString().split('T')[0]}`,
        { validFrom }
      ));
    }
    // Certificate expiring soon (within 7 days)
    else if ((validTo.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000) {
      const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      findings.push(this.createFinding(
        'ssl_cert_expiring_soon',
        'SSL Certificate Expiring Soon',
        'medium',
        weights.ssl_cert_expiring_soon || 8,
        `Certificate expires in ${daysLeft} day(s)`,
        { validTo, daysLeft }
      ));
    }

    return findings;
  }

  /**
   * Check for self-signed certificate
   */
  private checkSelfSigned(cert: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Self-signed if subject and issuer are identical
    const isSelfSigned = JSON.stringify(cert.subject) === JSON.stringify(cert.issuer);

    if (isSelfSigned) {
      findings.push(this.createFinding(
        'ssl_self_signed',
        'Self-Signed Certificate',
        'critical',
        weights.ssl_self_signed || 15,
        'Certificate is self-signed (not issued by trusted CA)',
        { subject: cert.subject, issuer: cert.issuer }
      ));
    }

    return findings;
  }

  /**
   * Check certificate issuer trust
   */
  private checkIssuerTrust(cert: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    const issuerOrg = cert.issuer?.O || cert.issuer?.CN || '';
    const isTrusted = Array.from(SSLSecurityCategory.TRUSTED_CAS).some(ca =>
      issuerOrg.includes(ca)
    );

    if (!isTrusted && issuerOrg) {
      findings.push(this.createFinding(
        'ssl_untrusted_issuer',
        'Untrusted Certificate Issuer',
        'high',
        weights.ssl_untrusted_issuer || 12,
        `Certificate issued by untrusted CA: ${issuerOrg}`,
        { issuer: cert.issuer }
      ));
    }

    return findings;
  }

  /**
   * Check certificate age (too new = suspicious)
   */
  private checkCertificateAge(cert: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const validFrom = new Date(cert.validFrom);
    const ageInDays = Math.floor((Date.now() - validFrom.getTime()) / (1000 * 60 * 60 * 24));

    // Certificate issued within last 7 days
    if (ageInDays <= 7) {
      findings.push(this.createFinding(
        'ssl_cert_very_new',
        'Very New SSL Certificate',
        'medium',
        weights.ssl_cert_very_new || 10,
        `Certificate issued ${ageInDays} day(s) ago`,
        { validFrom, ageInDays }
      ));
    }

    return findings;
  }

  /**
   * Check hostname mismatch
   */
  private checkHostnameMismatch(hostname: string, cert: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract certificate hostnames (CN + SAN)
    const certHostnames: string[] = [];

    if (cert.subject?.CN) {
      certHostnames.push(cert.subject.CN.toLowerCase());
    }

    if (cert.subjectAltNames) {
      const sans = cert.subjectAltNames.split(',').map((san: string) =>
        san.trim().replace(/^DNS:/, '').toLowerCase()
      );
      certHostnames.push(...sans);
    }

    // Check if hostname matches any certificate hostname (including wildcards)
    const matches = certHostnames.some((certHost: string) => {
      if (certHost.startsWith('*.')) {
        // Wildcard match
        const domain = certHost.slice(2);
        return hostname.endsWith(domain);
      } else {
        return hostname === certHost;
      }
    });

    if (!matches) {
      findings.push(this.createFinding(
        'ssl_hostname_mismatch',
        'SSL Hostname Mismatch',
        'high',
        weights.ssl_hostname_mismatch || 15,
        `Certificate does not match hostname ${hostname}`,
        { hostname, certificateHosts: certHostnames }
      ));
    }

    return findings;
  }

  /**
   * Check encryption strength
   */
  private checkEncryptionStrength(cert: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check key size (< 2048 bits is weak)
    if (cert.keySize && cert.keySize < 2048) {
      findings.push(this.createFinding(
        'ssl_weak_key_size',
        'Weak SSL Key Size',
        'medium',
        weights.ssl_weak_key_size || 8,
        `Certificate uses weak ${cert.keySize}-bit key (should be ≥2048)`,
        { keySize: cert.keySize }
      ));
    }

    // Check signature algorithm (SHA1 is deprecated)
    if (cert.signatureAlgorithm?.toLowerCase().includes('sha1')) {
      findings.push(this.createFinding(
        'ssl_weak_signature_algorithm',
        'Weak Signature Algorithm',
        'medium',
        weights.ssl_weak_signature_algorithm || 8,
        'Certificate uses deprecated SHA-1 signature algorithm',
        { signatureAlgorithm: cert.signatureAlgorithm }
      ));
    }

    return findings;
  }
}
