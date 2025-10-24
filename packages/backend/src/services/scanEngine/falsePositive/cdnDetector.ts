/**
 * CDN Detector
 *
 * Detects if a domain/IP belongs to a major CDN provider
 * CDNs are legitimate infrastructure and should reduce false positive risk
 *
 * Major CDNs Supported:
 * - Cloudflare
 * - Akamai
 * - Fastly
 * - Amazon CloudFront
 * - Google Cloud CDN
 * - Microsoft Azure CDN
 * - StackPath
 * - KeyCDN
 */

import { logger } from '../../../config/logger.js';

export interface CDNDetectionResult {
  isCDN: boolean;
  provider?: string;
  confidence: number;  // 0-100
  evidence: string[];
}

export class CDNDetector {
  // CDN domain patterns
  private static readonly CDN_PATTERNS = [
    // Cloudflare
    { provider: 'Cloudflare', pattern: /cloudflare\.com$/i, confidence: 100 },
    { provider: 'Cloudflare', pattern: /cloudflaressl\.com$/i, confidence: 100 },
    { provider: 'Cloudflare', pattern: /cf-ipfs\.com$/i, confidence: 100 },

    // Akamai
    { provider: 'Akamai', pattern: /akamai\.net$/i, confidence: 100 },
    { provider: 'Akamai', pattern: /akamaiedge\.net$/i, confidence: 100 },
    { provider: 'Akamai', pattern: /akamaitechnologies\.com$/i, confidence: 100 },

    // Fastly
    { provider: 'Fastly', pattern: /fastly\.net$/i, confidence: 100 },
    { provider: 'Fastly', pattern: /fastlylb\.net$/i, confidence: 100 },

    // Amazon CloudFront
    { provider: 'CloudFront', pattern: /cloudfront\.net$/i, confidence: 100 },
    { provider: 'CloudFront', pattern: /amazonaws\.com$/i, confidence: 90 },

    // Google Cloud CDN
    { provider: 'Google Cloud CDN', pattern: /googleapis\.com$/i, confidence: 95 },
    { provider: 'Google Cloud CDN', pattern: /googleusercontent\.com$/i, confidence: 90 },
    { provider: 'Google Cloud CDN', pattern: /gstatic\.com$/i, confidence: 95 },

    // Microsoft Azure CDN
    { provider: 'Azure CDN', pattern: /azureedge\.net$/i, confidence: 100 },
    { provider: 'Azure CDN', pattern: /azure\.com$/i, confidence: 85 },

    // StackPath
    { provider: 'StackPath', pattern: /stackpath\.com$/i, confidence: 100 },
    { provider: 'StackPath', pattern: /stackpathcdn\.com$/i, confidence: 100 },

    // KeyCDN
    { provider: 'KeyCDN', pattern: /kxcdn\.com$/i, confidence: 100 },
    { provider: 'KeyCDN', pattern: /keycdn\.com$/i, confidence: 100 },

    // Other popular CDNs
    { provider: 'BunnyCDN', pattern: /bunnycdn\.com$/i, confidence: 100 },
    { provider: 'jsDelivr', pattern: /jsdelivr\.net$/i, confidence: 100 },
    { provider: 'cdnjs', pattern: /cdnjs\.com$/i, confidence: 100 },
    { provider: 'MaxCDN', pattern: /maxcdn\.com$/i, confidence: 100 },
  ];

  // CDN IP ranges (simplified - full implementation would use CIDR ranges)
  // These are indicative patterns in reverse DNS
  private static readonly CDN_REVERSE_DNS_PATTERNS = [
    /cloudflare/i,
    /akamai/i,
    /fastly/i,
    /cloudfront/i,
    /google/i,
    /azure/i,
    /stackpath/i
  ];

  // CDN nameserver patterns
  private static readonly CDN_NAMESERVER_PATTERNS = [
    { provider: 'Cloudflare', pattern: /\.ns\.cloudflare\.com$/i },
    { provider: 'Akamai', pattern: /\.akam\.net$/i },
    { provider: 'AWS Route53', pattern: /\.awsdns-.*\.com$/i },
    { provider: 'Google Cloud DNS', pattern: /\.googledomains\.com$/i },
    { provider: 'Azure DNS', pattern: /\.azure-dns\..*$/i },
  ];

  /**
   * Detect if domain is served by a CDN
   */
  async detect(domain: string, nameservers?: string[]): Promise<CDNDetectionResult> {
    const evidence: string[] = [];
    let isCDN = false;
    let provider: string | undefined;
    let maxConfidence = 0;

    logger.debug(`[CDN Detector] Checking: ${domain}`);

    // Check 1: Domain pattern matching
    for (const { provider: cdnProvider, pattern, confidence } of CDNDetector.CDN_PATTERNS) {
      if (pattern.test(domain)) {
        isCDN = true;
        provider = cdnProvider;
        maxConfidence = Math.max(maxConfidence, confidence);
        evidence.push(`Domain matches ${cdnProvider} pattern`);
        logger.debug(`[CDN Detector] Matched ${cdnProvider} (${confidence}% confidence)`);
        break;
      }
    }

    // Check 2: Nameserver analysis (if provided)
    if (nameservers && nameservers.length > 0) {
      for (const ns of nameservers) {
        for (const { provider: cdnProvider, pattern } of CDNDetector.CDN_NAMESERVER_PATTERNS) {
          if (pattern.test(ns)) {
            isCDN = true;
            provider = provider || cdnProvider;
            maxConfidence = Math.max(maxConfidence, 90);
            evidence.push(`Nameserver ${ns} belongs to ${cdnProvider}`);
            logger.debug(`[CDN Detector] Nameserver matches ${cdnProvider}`);
          }
        }
      }
    }

    // Check 3: Common CDN subdomains
    const cdnSubdomains = ['cdn', 'static', 'assets', 'media', 'images', 'cache'];
    for (const subdomain of cdnSubdomains) {
      if (domain.startsWith(`${subdomain}.`)) {
        evidence.push(`Domain uses CDN-like subdomain: ${subdomain}`);
        maxConfidence = Math.max(maxConfidence, 60);
      }
    }

    const result: CDNDetectionResult = {
      isCDN,
      provider,
      confidence: maxConfidence,
      evidence
    };

    if (isCDN) {
      logger.info(`[CDN Detector] CDN detected: ${provider} (${maxConfidence}% confidence)`);
    } else {
      logger.debug(`[CDN Detector] No CDN detected`);
    }

    return result;
  }

  /**
   * Check if IP belongs to a CDN (requires reverse DNS lookup)
   */
  async detectByIP(ip: string, reverseDNS?: string): Promise<CDNDetectionResult> {
    const evidence: string[] = [];
    let isCDN = false;
    let provider: string | undefined;
    let confidence = 0;

    if (!reverseDNS) {
      return { isCDN: false, confidence: 0, evidence: [] };
    }

    // Check reverse DNS patterns
    for (const pattern of CDNDetector.CDN_REVERSE_DNS_PATTERNS) {
      if (pattern.test(reverseDNS)) {
        isCDN = true;
        provider = reverseDNS.match(pattern)?.[0] || 'Unknown CDN';
        confidence = 85;
        evidence.push(`Reverse DNS indicates CDN: ${reverseDNS}`);
        logger.info(`[CDN Detector] IP ${ip} belongs to CDN (reverse DNS: ${reverseDNS})`);
        break;
      }
    }

    return {
      isCDN,
      provider,
      confidence,
      evidence
    };
  }

  /**
   * Get list of all supported CDN providers
   */
  static getSupportedProviders(): string[] {
    const providers = new Set<string>();
    for (const { provider } of CDNDetector.CDN_PATTERNS) {
      providers.add(provider);
    }
    return Array.from(providers).sort();
  }
}
