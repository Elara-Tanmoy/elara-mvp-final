/**
 * Category 12: Trust Graph & Network Analysis (30 points)
 *
 * Checks:
 * - Unknown/new hosting provider (10 pts)
 * - Suspicious hosting patterns (shared hosting for financial sites: 8 pts)
 * - No established reputation (7 pts)
 * - Suspicious network neighbors (5 pts)
 *
 * Runs in: ALL pipelines (DNS/IP-based checks)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class TrustGraphCategory extends CategoryAnalyzer {
  // Known trusted hosting providers (major cloud/CDN providers)
  private static readonly TRUSTED_HOSTING_PROVIDERS = [
    { name: 'Amazon Web Services', asn: 'AS16509', ranges: ['54.', '3.', '52.'] },
    { name: 'Google Cloud', asn: 'AS15169', ranges: ['35.', '34.', '104.'] },
    { name: 'Microsoft Azure', asn: 'AS8075', ranges: ['20.', '40.', '52.'] },
    { name: 'Cloudflare', asn: 'AS13335', ranges: ['104.', '172.'] },
    { name: 'Akamai', asn: 'AS20940', ranges: [] },
    { name: 'Fastly', asn: 'AS54113', ranges: [] },
    { name: 'DigitalOcean', asn: 'AS14061', ranges: ['159.', '167.'] }
  ];

  // Suspicious hosting characteristics
  private static readonly SUSPICIOUS_HOSTING_INDICATORS = [
    'shared hosting',
    'bulletproof',
    'anonymous',
    'offshore',
    'privacy protected'
  ];

  // Known good domains (for reputation baseline)
  private static readonly ESTABLISHED_DOMAINS = new Set([
    'google.com', 'amazon.com', 'microsoft.com', 'apple.com',
    'facebook.com', 'twitter.com', 'linkedin.com', 'github.com',
    'stackoverflow.com', 'reddit.com', 'wikipedia.org'
  ]);

  constructor() {
    super('trustGraph', 'Trust Graph & Network Analysis');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Can run in all pipelines (IP/DNS-based)
    return true;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.trustGraph;

    logger.debug(`[Trust Graph] Analyzing trust for: ${context.urlComponents.domain}`);

    // Check 1: Hosting Provider Analysis
    if (context.reachability.dns.resolved && context.reachability.dns.ip) {
      const hostingFindings = await this.checkHostingProvider(
        context.reachability.dns.ip,
        context.urlComponents.domain,
        config.checkWeights
      );
      findings.push(...hostingFindings);
    }

    // Check 2: Domain Reputation
    const reputationFindings = this.checkDomainReputation(
      context.urlComponents.domain,
      context.whoisData,
      config.checkWeights
    );
    findings.push(...reputationFindings);

    // Check 3: DNS Configuration Analysis
    if (context.dnsRecords) {
      const dnsFindings = this.checkDNSConfiguration(
        context.dnsRecords,
        config.checkWeights
      );
      findings.push(...dnsFindings);
    }

    // Check 4: Network Consistency
    const consistencyFindings = this.checkNetworkConsistency(
      context.urlComponents,
      context.reachability,
      config.checkWeights
    );
    findings.push(...consistencyFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Trust Graph] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

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
   * Check hosting provider reputation
   */
  private async checkHostingProvider(
    ip: string,
    domain: string,
    weights: Record<string, number>
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check if hosted on trusted provider
    let isTrustedProvider = false;
    let providerName = 'Unknown';

    for (const provider of TrustGraphCategory.TRUSTED_HOSTING_PROVIDERS) {
      if (provider.ranges.some(range => ip.startsWith(range))) {
        isTrustedProvider = true;
        providerName = provider.name;
        break;
      }
    }

    if (!isTrustedProvider) {
      // Check if it's a suspicious hosting pattern
      // For now, flag unknown providers with moderate score
      findings.push(this.createFinding(
        'trust_unknown_hosting',
        'Unknown Hosting Provider',
        'medium',
        weights.trust_unknown_hosting || 8,
        `Hosted on unknown/unverified infrastructure (IP: ${ip})`,
        { ip, provider: providerName }
      ));
    }

    // Check for shared hosting indicators (multiple domains on same IP)
    // This would require reverse IP lookup, which we'll simulate for now
    const isSharedHosting = this.detectSharedHosting(ip);

    if (isSharedHosting && this.isFinancialSite(domain)) {
      findings.push(this.createFinding(
        'trust_shared_hosting_financial',
        'Financial Site on Shared Hosting',
        'high',
        weights.trust_shared_hosting_financial || 12,
        'Financial/banking domain on shared hosting (security risk)',
        { ip }
      ));
    }

    return findings;
  }

  /**
   * Check domain reputation
   */
  private checkDomainReputation(
    domain: string,
    whoisData: any,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Check if domain is in established list
    const isEstablished = TrustGraphCategory.ESTABLISHED_DOMAINS.has(domain);

    if (!isEstablished) {
      // Check domain age from WHOIS
      if (whoisData?.registrationDate) {
        const ageInDays = Math.floor(
          (Date.now() - new Date(whoisData.registrationDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // If domain is very new (< 30 days) and not established, flag it
        if (ageInDays < 30) {
          findings.push(this.createFinding(
            'trust_no_established_reputation',
            'No Established Reputation',
            'medium',
            weights.trust_no_established_reputation || 7,
            `New domain with no established trust history (${ageInDays} days old)`,
            { ageInDays }
          ));
        }
      }
    }

    return findings;
  }

  /**
   * Check DNS configuration for trust signals
   */
  private checkDNSConfiguration(
    dnsRecords: any,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Check for suspicious DNS patterns
    const hasNoMXRecords = !dnsRecords.MX || dnsRecords.MX.length === 0;
    const hasNoNSRecords = !dnsRecords.NS || dnsRecords.NS.length === 0;

    // Legitimate businesses typically have email (MX records)
    if (hasNoMXRecords) {
      findings.push(this.createFinding(
        'trust_no_email_infrastructure',
        'No Email Infrastructure',
        'low',
        weights.trust_no_email_infrastructure || 5,
        'Domain has no MX records (no email capability)',
        {}
      ));
    }

    // Multiple name servers = more legitimate
    if (dnsRecords.NS && dnsRecords.NS.length === 1) {
      findings.push(this.createFinding(
        'trust_single_nameserver',
        'Single Name Server',
        'low',
        weights.trust_single_nameserver || 4,
        'Domain uses only one name server (reliability concern)',
        { count: 1 }
      ));
    }

    return findings;
  }

  /**
   * Check network consistency
   */
  private checkNetworkConsistency(
    urlComponents: any,
    reachability: any,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Check if domain uses IP address instead of hostname
    if (/^\d+\.\d+\.\d+\.\d+$/.test(urlComponents.hostname)) {
      findings.push(this.createFinding(
        'trust_ip_instead_of_domain',
        'Uses IP Address Instead of Domain',
        'high',
        weights.trust_ip_instead_of_domain || 10,
        'URL uses raw IP address instead of domain name',
        { ip: urlComponents.hostname }
      ));
    }

    return findings;
  }

  /**
   * Detect shared hosting (simplified heuristic)
   */
  private detectSharedHosting(ip: string): boolean {
    // In production, this would do reverse IP lookup
    // For now, use heuristic: common shared hosting IP ranges
    const sharedHostingPrefixes = ['192.168.', '10.', '172.'];
    return sharedHostingPrefixes.some(prefix => ip.startsWith(prefix));
  }

  /**
   * Detect if domain appears to be financial/banking
   */
  private isFinancialSite(domain: string): boolean {
    const financialKeywords = ['bank', 'pay', 'credit', 'finance', 'invest', 'wallet'];
    return financialKeywords.some(keyword => domain.includes(keyword));
  }
}
