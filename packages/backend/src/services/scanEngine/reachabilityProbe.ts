/**
 * Stage 0.4: Reachability Probe
 * DNS → TCP → HTTP probing with special condition detection
 */

import dns from 'dns/promises';
import net from 'net';
import https from 'https';
import http from 'http';
import { ReachabilityProbeResult, ReachabilityState, URLComponents } from './types.js';
import { logger } from '../../config/logger.js';

export class ReachabilityProbe {
  private static readonly DNS_TIMEOUT = 2000;
  private static readonly TCP_TIMEOUT = 2000;
  private static readonly HTTP_TIMEOUT = 3000;
  private static readonly MAX_REDIRECTS = 3;

  // Detection patterns
  private static readonly PARKING_PATTERNS = [
    'domain for sale',
    'buy this domain',
    'godaddy',
    'sedo',
    'parked free',
    'domain parking'
  ];

  private static readonly SINKHOLE_PATTERNS = [
    'seized',
    'taken down',
    'suspended by',
    'icann',
    'abuse',
    'law enforcement',
    'fbi'
  ];

  private static readonly WAF_PATTERNS = [
    'cloudflare',
    'checking your browser',
    'captcha',
    'ray id',
    'ddos protection',
    'security check'
  ];

  /**
   * Probe URL reachability with full detection
   */
  static async probe(components: URLComponents, config?: any): Promise<ReachabilityProbeResult> {
    const startTime = Date.now();

    // Step 1: DNS Resolution
    const dnsStart = Date.now();
    const dnsResult = await this.probeDNS(components.hostname);
    const dnsDuration = Date.now() - dnsStart;

    // If DNS fails, immediately return OFFLINE
    if (!dnsResult.resolved) {
      return {
        state: ReachabilityState.OFFLINE,
        dns: { ...dnsResult, duration: dnsDuration },
        tcp: { connected: false, error: 'DNS failed', duration: 0 },
        http: { ok: false, error: 'DNS failed', duration: 0 },
        detection: { isParked: false, isSinkhole: false, isWAF: false, patterns: [] },
        totalDuration: Date.now() - startTime
      };
    }

    // Step 2: TCP Connection
    const tcpStart = Date.now();
    const port = components.protocol === 'https' ? 443 : 80;
    const tcpResult = await this.probeTCP(dnsResult.ip!, port);
    const tcpDuration = Date.now() - tcpStart;

    // If TCP fails, return OFFLINE
    if (!tcpResult.connected) {
      return {
        state: ReachabilityState.OFFLINE,
        dns: { ...dnsResult, duration: dnsDuration },
        tcp: { ...tcpResult, port, duration: tcpDuration },
        http: { ok: false, error: 'TCP connection failed', duration: 0 },
        detection: { isParked: false, isSinkhole: false, isWAF: false, patterns: [] },
        totalDuration: Date.now() - startTime
      };
    }

    // Step 3: HTTP Request (lightweight HEAD or GET)
    const httpStart = Date.now();
    const httpResult = await this.probeHTTP(components.canonical);
    const httpDuration = Date.now() - httpStart;

    // If HTTP fails, return OFFLINE
    if (!httpResult.ok) {
      return {
        state: ReachabilityState.OFFLINE,
        dns: { ...dnsResult, duration: dnsDuration },
        tcp: { ...tcpResult, port, duration: tcpDuration },
        http: { ...httpResult, duration: httpDuration },
        detection: { isParked: false, isSinkhole: false, isWAF: false, patterns: [] },
        totalDuration: Date.now() - startTime
      };
    }

    // Step 4: Special Condition Detection
    const detection = this.detectSpecialConditions(httpResult.body || '', httpResult.headers);

    // Determine final state
    let state: ReachabilityState;
    if (detection.isSinkhole) {
      state = ReachabilityState.SINKHOLE;
    } else if (detection.isWAF) {
      state = ReachabilityState.WAF_CHALLENGE;
    } else if (detection.isParked) {
      state = ReachabilityState.PARKED;
    } else {
      state = ReachabilityState.ONLINE;
    }

    return {
      state,
      dns: { ...dnsResult, duration: dnsDuration },
      tcp: { ...tcpResult, port, duration: tcpDuration },
      http: { ...httpResult, duration: httpDuration },
      detection,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * DNS Resolution with timeout
   */
  private static async probeDNS(hostname: string): Promise<{ resolved: boolean; ip?: string; ips?: string[]; error?: string }> {
    try {
      const result = await Promise.race([
        dns.resolve4(hostname),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), this.DNS_TIMEOUT)
        )
      ]);

      return {
        resolved: true,
        ip: result[0],
        ips: result
      };
    } catch (error) {
      return {
        resolved: false,
        error: error instanceof Error ? error.message : 'DNS resolution failed'
      };
    }
  }

  /**
   * TCP Connection with timeout
   */
  private static async probeTCP(ip: string, port: number): Promise<{ connected: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ connected: false, error: 'TCP timeout' });
        }
      }, this.TCP_TIMEOUT);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.destroy();
          resolve({ connected: true });
        }
      });

      socket.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ connected: false, error: error.message });
        }
      });

      socket.connect(port, ip);
    });
  }

  /**
   * HTTP Request with redirect following
   */
  private static async probeHTTP(url: string): Promise<{
    ok: boolean;
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    redirectChain?: string[];
    error?: string;
  }> {
    return new Promise((resolve) => {
      const redirectChain: string[] = [url];
      const isHTTPS = url.startsWith('https://');
      const client = isHTTPS ? https : http;

      let currentURL = url;
      let redirectCount = 0;
      let isResolved = false;  // Prevent multiple resolutions

      const makeRequest = (targetURL: string) => {
        if (isResolved) return;  // Already resolved, don't make new requests

        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve({ ok: false, error: 'HTTP timeout' });
          }
        }, this.HTTP_TIMEOUT);

        const req = client.get(targetURL, { timeout: this.HTTP_TIMEOUT }, (res) => {
          // Don't clear timeout yet - wait for full response

          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            redirectCount++;
            if (redirectCount > this.MAX_REDIRECTS) {
              clearTimeout(timeout);
              if (!isResolved) {
                isResolved = true;
                resolve({
                  ok: false,
                  statusCode: res.statusCode,
                  error: 'Too many redirects',
                  redirectChain
                });
              }
              return;
            }

            const location = res.headers.location;
            const nextURL = location.startsWith('http') ? location : new URL(location, targetURL).href;
            redirectChain.push(nextURL);

            // Clean up this response before following redirect
            clearTimeout(timeout);
            res.destroy();
            makeRequest(nextURL);
            return;
          }

          // Collect response body (first 5KB only)
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
            if (body.length > 5000) {
              res.destroy();
            }
          });

          res.on('end', () => {
            clearTimeout(timeout);  // Now safe to clear timeout
            if (!isResolved) {
              isResolved = true;
              resolve({
                ok: res.statusCode ? res.statusCode < 400 : false,
                statusCode: res.statusCode,
                headers: res.headers as Record<string, string>,
                body: body.slice(0, 5000),
                redirectChain: redirectChain.length > 1 ? redirectChain : undefined
              });
            }
          });

          // Handle response stream errors
          res.on('error', (error) => {
            clearTimeout(timeout);
            if (!isResolved) {
              isResolved = true;
              resolve({ ok: false, error: error.message });
            }
          });
        });

        req.on('error', (error) => {
          clearTimeout(timeout);
          if (!isResolved) {
            isResolved = true;
            resolve({ ok: false, error: error.message });
          }
        });

        req.on('timeout', () => {
          req.destroy();
          clearTimeout(timeout);
          if (!isResolved) {
            isResolved = true;
            resolve({ ok: false, error: 'HTTP timeout' });
          }
        });
      };

      makeRequest(currentURL);
    });
  }

  /**
   * Detect special conditions (parking, sinkhole, WAF)
   */
  private static detectSpecialConditions(body: string, headers?: Record<string, string>): {
    isParked: boolean;
    isSinkhole: boolean;
    isWAF: boolean;
    patterns: string[];
  } {
    const bodyLower = body.toLowerCase();
    const detectedPatterns: string[] = [];

    // Check for parking patterns
    const parkingMatch = this.PARKING_PATTERNS.find(pattern => bodyLower.includes(pattern));
    const isParked = !!parkingMatch;
    if (parkingMatch) detectedPatterns.push(`parking:${parkingMatch}`);

    // Check for sinkhole patterns
    const sinkholeMatch = this.SINKHOLE_PATTERNS.find(pattern => bodyLower.includes(pattern));
    const isSinkhole = !!sinkholeMatch;
    if (sinkholeMatch) detectedPatterns.push(`sinkhole:${sinkholeMatch}`);

    // Check for WAF patterns
    let isWAF = false;
    if (headers) {
      const serverHeader = headers['server']?.toLowerCase() || '';
      const cfRay = headers['cf-ray'];
      if (serverHeader.includes('cloudflare') || cfRay) {
        isWAF = true;
        detectedPatterns.push('waf:cloudflare');
      }
    }
    const wafMatch = this.WAF_PATTERNS.find(pattern => bodyLower.includes(pattern));
    if (wafMatch) {
      isWAF = true;
      detectedPatterns.push(`waf:${wafMatch}`);
    }

    return { isParked, isSinkhole, isWAF, patterns: detectedPatterns };
  }
}
