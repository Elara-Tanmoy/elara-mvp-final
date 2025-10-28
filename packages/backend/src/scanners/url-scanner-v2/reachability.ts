/**
 * Reachability Module for URL Scanner V2
 *
 * Performs DNS, TCP, and HTTP reachability checks to classify URL status.
 * Returns one of: ONLINE, OFFLINE, WAF, PARKED, SINKHOLE
 */

import dns from 'dns/promises';
import net from 'net';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ReachabilityStatus, ReachabilityResult } from './types';

/**
 * Known WAF signatures
 */
const WAF_SIGNATURES = [
  'cloudflare',
  'akamai',
  'incapsula',
  'sucuri',
  'barracuda',
  'f5',
  'imperva',
  'fortiweb'
];

/**
 * Parked domain indicators
 */
const PARKED_INDICATORS = [
  'this domain is parked',
  'domain for sale',
  'buy this domain',
  'sedo.com',
  'godaddy.com/domainfind',
  'underconstruction',
  'coming soon'
];

/**
 * Known sinkhole IP ranges and domains
 */
const SINKHOLE_INDICATORS = {
  ips: [
    '0.0.0.0',
    '127.0.0.1',
    '127.0.0.2', // Spamhaus
    '127.0.0.3',
    '146.112.61.106', // Quad9
    '149.112.112.112'
  ],
  domains: [
    'localhost',
    'sinkhole',
    'sinkhole.cert',
    'blackhole',
    'abuse.ch'
  ]
};

/**
 * Reachability checker class
 */
export class ReachabilityChecker {
  private timeout: number;

  constructor(timeoutMs: number = 10000) {
    this.timeout = timeoutMs;
  }

  /**
   * Main reachability check
   */
  async check(url: string): Promise<ReachabilityResult> {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    const result: ReachabilityResult = {
      status: ReachabilityStatus.ERROR,
      responseTime: 0,
      dnsResolved: false,
      tcpConnectable: false,
      tlsValid: false,
      details: {},
      timestamp: new Date()
    };

    try {
      // Step 1: DNS Resolution
      const dnsResult = await this.checkDNS(hostname);
      result.dnsResolved = dnsResult.resolved;
      result.ipAddress = dnsResult.ip;

      if (dnsResult.error) {
        result.details.dnsError = dnsResult.error;
      }

      // Check for sinkhole
      if (this.isSinkhole(hostname, dnsResult.ip)) {
        result.status = ReachabilityStatus.SINKHOLE;
        result.details.sinkholeIndicators = ['Known sinkhole IP or domain'];
        result.responseTime = Date.now() - startTime;
        return result;
      }

      // If DNS fails, mark as OFFLINE
      if (!result.dnsResolved || !dnsResult.ip) {
        result.status = ReachabilityStatus.OFFLINE;
        result.responseTime = Date.now() - startTime;
        return result;
      }

      // Step 2: TCP Check
      const port = parsedUrl.protocol === 'https:' ? 443 : 80;
      const tcpResult = await this.checkTCP(dnsResult.ip, port);
      result.tcpConnectable = tcpResult.connectable;

      if (tcpResult.error) {
        result.details.tcpError = tcpResult.error;
      }

      // If TCP fails, mark as OFFLINE
      if (!result.tcpConnectable) {
        result.status = ReachabilityStatus.OFFLINE;
        result.responseTime = Date.now() - startTime;
        return result;
      }

      // Step 3: HTTP/HTTPS Check
      const httpResult = await this.checkHTTP(url);
      result.httpStatusCode = httpResult.statusCode;
      result.details.redirectChain = httpResult.redirectChain;

      if (httpResult.error) {
        result.details.httpError = httpResult.error;
      }

      // Check TLS validity for HTTPS
      if (parsedUrl.protocol === 'https:') {
        result.tlsValid = httpResult.tlsValid || false;
        if (httpResult.tlsError) {
          result.details.tlsError = httpResult.tlsError;
        }
      }

      // Step 4: Classify status
      result.status = this.classifyStatus(httpResult, hostname);

      // Store classification details
      if (result.status === ReachabilityStatus.WAF) {
        result.details.wafSignatures = httpResult.wafSignatures;
      } else if (result.status === ReachabilityStatus.PARKED) {
        result.details.parkedIndicators = httpResult.parkedIndicators;
      }

      result.responseTime = Date.now() - startTime;
      return result;

    } catch (error) {
      result.status = ReachabilityStatus.ERROR;
      result.details.httpError = error instanceof Error ? error.message : 'Unknown error';
      result.responseTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Check DNS resolution
   */
  private async checkDNS(hostname: string): Promise<{
    resolved: boolean;
    ip?: string;
    error?: string;
  }> {
    try {
      const addresses = await dns.resolve4(hostname);
      return {
        resolved: true,
        ip: addresses[0]
      };
    } catch (error) {
      // Try IPv6
      try {
        const addresses = await dns.resolve6(hostname);
        return {
          resolved: true,
          ip: addresses[0]
        };
      } catch (ipv6Error) {
        return {
          resolved: false,
          error: error instanceof Error ? error.message : 'DNS resolution failed'
        };
      }
    }
  }

  /**
   * Check TCP connectivity
   */
  private async checkTCP(host: string, port: number): Promise<{
    connectable: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          connectable: false,
          error: 'TCP connection timeout'
        });
      }, this.timeout);

      socket.connect(port, host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ connectable: true });
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          connectable: false,
          error: error.message
        });
      });
    });
  }

  /**
   * Check HTTP/HTTPS response
   */
  private async checkHTTP(url: string): Promise<{
    statusCode?: number;
    redirectChain: string[];
    tlsValid?: boolean;
    tlsError?: string;
    wafSignatures?: string[];
    parkedIndicators?: string[];
    error?: string;
    body?: string;
  }> {
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const redirectChain: string[] = [url];
      let currentUrl = url;
      let redirectCount = 0;
      const maxRedirects = 10;

      const makeRequest = (targetUrl: string): void => {
        const parsedTarget = new URL(targetUrl);
        // Determine the correct client based on the target URL protocol (not initial URL)
        const client = parsedTarget.protocol === 'https:' ? https : http;
        const options = {
          method: 'GET',
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          rejectUnauthorized: false // Allow self-signed certs for detection
        };

        const req = client.request(targetUrl, options, (res) => {
          let body = '';

          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
            const location = res.headers.location;
            if (location && redirectCount < maxRedirects) {
              redirectCount++;
              const nextUrl = location.startsWith('http')
                ? location
                : new URL(location, targetUrl).toString();
              redirectChain.push(nextUrl);
              makeRequest(nextUrl);
              return;
            }
          }

          // Collect response body (up to 100KB for analysis)
          res.on('data', (chunk) => {
            if (body.length < 100000) {
              body += chunk.toString();
            }
          });

          res.on('end', () => {
            // Check TLS if HTTPS
            let tlsValid = false;
            let tlsError: string | undefined;

            if (parsedTarget.protocol === 'https:' && req.socket) {
              const socket = req.socket as any;
              if (socket.authorized) {
                tlsValid = true;
              } else {
                tlsError = socket.authorizationError;
              }
            }

            // Check for WAF signatures
            const wafSignatures = this.detectWAF(res.headers, body);

            // Check for parked indicators
            const parkedIndicators = this.detectParked(body);

            resolve({
              statusCode: res.statusCode,
              redirectChain,
              tlsValid: parsedTarget.protocol === 'https:' ? tlsValid : undefined,
              tlsError,
              wafSignatures: wafSignatures.length > 0 ? wafSignatures : undefined,
              parkedIndicators: parkedIndicators.length > 0 ? parkedIndicators : undefined,
              body
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            redirectChain,
            error: error.message
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            redirectChain,
            error: 'HTTP request timeout'
          });
        });

        req.end();
      };

      makeRequest(currentUrl);
    });
  }

  /**
   * Detect WAF from headers and body
   */
  private detectWAF(headers: http.IncomingHttpHeaders, body: string): string[] {
    const detected: string[] = [];

    // Check headers
    const headerString = JSON.stringify(headers).toLowerCase();
    for (const signature of WAF_SIGNATURES) {
      if (headerString.includes(signature)) {
        detected.push(signature);
      }
    }

    // Check for common WAF response patterns
    const bodyLower = body.toLowerCase();
    if (bodyLower.includes('access denied')) {
      detected.push('access-denied-response');
    }
    if (bodyLower.includes('ray id')) {
      detected.push('cloudflare');
    }

    return detected;
  }

  /**
   * Detect parked domain indicators
   */
  private detectParked(body: string): string[] {
    const detected: string[] = [];
    const bodyLower = body.toLowerCase();

    for (const indicator of PARKED_INDICATORS) {
      if (bodyLower.includes(indicator.toLowerCase())) {
        detected.push(indicator);
      }
    }

    return detected;
  }

  /**
   * Check if IP/domain is a sinkhole
   */
  private isSinkhole(hostname: string, ip?: string): boolean {
    // Check hostname
    for (const domain of SINKHOLE_INDICATORS.domains) {
      if (hostname.toLowerCase().includes(domain)) {
        return true;
      }
    }

    // Check IP
    if (ip) {
      for (const sinkholeIp of SINKHOLE_INDICATORS.ips) {
        if (ip === sinkholeIp) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Classify reachability status based on HTTP result
   */
  private classifyStatus(
    httpResult: {
      statusCode?: number;
      wafSignatures?: string[];
      parkedIndicators?: string[];
      error?: string;
    },
    hostname: string
  ): ReachabilityStatus {
    // WAF detected
    if (httpResult.wafSignatures && httpResult.wafSignatures.length > 0) {
      return ReachabilityStatus.WAF;
    }

    // Parked domain
    if (httpResult.parkedIndicators && httpResult.parkedIndicators.length > 0) {
      return ReachabilityStatus.PARKED;
    }

    // Success status codes (2xx and 3xx are considered ONLINE)
    if (httpResult.statusCode && httpResult.statusCode >= 200 && httpResult.statusCode < 400) {
      return ReachabilityStatus.ONLINE;
    }

    // HTTP errors with no status code
    if (httpResult.error && !httpResult.statusCode) {
      return ReachabilityStatus.OFFLINE;
    }

    // Client/server errors (4xx and 5xx)
    if (httpResult.statusCode && httpResult.statusCode >= 400) {
      return ReachabilityStatus.OFFLINE;
    }

    // Default to ONLINE if we got any status code (even if we don't recognize it)
    if (httpResult.statusCode) {
      return ReachabilityStatus.ONLINE;
    }

    return ReachabilityStatus.OFFLINE;
  }
}

/**
 * Factory function to create reachability checker
 */
export function createReachabilityChecker(timeoutMs?: number): ReachabilityChecker {
  return new ReachabilityChecker(timeoutMs);
}
