/**
 * Evidence Collection Module for URL Scanner V2
 *
 * Collects comprehensive evidence from a URL including:
 * - HTML/DOM analysis
 * - HAR (HTTP Archive) data
 * - Forms, scripts, redirects
 * - Cookies, localStorage
 * - TLS/WHOIS/DNS/ASN
 * - Screenshot + OCR
 *
 * TODO: Integrate with headless browser (Puppeteer/Playwright) for advanced features
 * Currently uses axios + cheerio for basic HTML analysis
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import dns from 'dns/promises';
import whois from 'whois-json';
import { createWorker } from 'tesseract.js';
import type {
  EvidenceData,
  FormEvidence,
  ScriptEvidence,
  ImageEvidence,
  LinkEvidence,
  HARData,
  RedirectEvidence,
  CookieEvidence,
  TLSEvidence,
  WHOISEvidence,
  DNSEvidence,
  ASNEvidence,
  ScreenshotEvidence,
  ReachabilityResult
} from './types';

/**
 * Evidence Collector class
 */
export class EvidenceCollector {
  private timeout: number;
  private maxRedirects: number;

  constructor(timeoutMs: number = 30000, maxRedirects: number = 10) {
    this.timeout = timeoutMs;
    this.maxRedirects = maxRedirects;
  }

  /**
   * Collect all evidence for a URL
   */
  async collect(
    url: string,
    reachability: ReachabilityResult,
    options: {
      skipScreenshot?: boolean;
      skipTLS?: boolean;
      skipWHOIS?: boolean;
    } = {}
  ): Promise<EvidenceData> {
    const startTime = Date.now();

    try {
      // Parallel evidence collection for performance
      const [
        htmlData,
        dnsData,
        whoisData,
        tlsData
      ] = await Promise.allSettled([
        this.collectHTML(url),
        this.collectDNS(new URL(url).hostname),
        options.skipWHOIS ? Promise.resolve(null) : this.collectWHOIS(new URL(url).hostname),
        options.skipTLS ? Promise.resolve(null) : this.collectTLS(url)
      ]);

      // Parse HTML evidence
      const html = htmlData.status === 'fulfilled' ? htmlData.value.html : '';
      const cookies = htmlData.status === 'fulfilled' ? htmlData.value.cookies : [];
      const redirects = htmlData.status === 'fulfilled' ? htmlData.value.redirectChain : [];

      const $ = cheerio.load(html);
      const dom = this.parseDOM($);
      const har = this.buildHAR($, url);

      // Behavioral analysis
      const autoDownload = this.detectAutoDownload($);
      const autoRedirect = this.detectAutoRedirect($);
      const obfuscatedScripts = dom.scripts.some(s => s.obfuscated);

      // Screenshot (simplified - would need browser automation for real implementation)
      let screenshot: ScreenshotEvidence | undefined;
      if (!options.skipScreenshot) {
        screenshot = await this.collectScreenshot(url);
      }

      const evidence: EvidenceData = {
        html,
        dom,
        har,
        redirectChain: redirects,
        cookies,
        localStorage: {}, // TODO: Requires browser automation
        tls: tlsData.status === 'fulfilled' && tlsData.value ? tlsData.value : this.getEmptyTLS(),
        whois: whoisData.status === 'fulfilled' && whoisData.value ? whoisData.value : this.getEmptyWHOIS(),
        dns: dnsData.status === 'fulfilled' && dnsData.value ? dnsData.value : this.getEmptyDNS(),
        asn: this.getASNFromIP(reachability.ipAddress),
        screenshot: screenshot || this.getEmptyScreenshot(),
        autoDownload,
        autoRedirect,
        obfuscatedScripts,
        timestamp: new Date()
      };

      return evidence;

    } catch (error) {
      console.error('Evidence collection error:', error);
      // Return minimal evidence on error
      return this.getEmptyEvidence(url);
    }
  }

  /**
   * Collect HTML content and HTTP metadata
   */
  private async collectHTML(url: string): Promise<{
    html: string;
    cookies: CookieEvidence[];
    redirectChain: RedirectEvidence[];
  }> {
    const redirectChain: RedirectEvidence[] = [];
    const cookies: CookieEvidence[] = [];

    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        maxRedirects: this.maxRedirects,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Allow self-signed certs
        }),
        transformResponse: (data) => data // Keep raw HTML
      });

      // Extract cookies from set-cookie headers
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        for (const cookieStr of setCookieHeaders) {
          const parsed = this.parseCookie(cookieStr);
          if (parsed) cookies.push(parsed);
        }
      }

      // Build redirect chain from axios (simplified)
      if (response.request?.res?.responseUrl && response.request.res.responseUrl !== url) {
        redirectChain.push({
          from: url,
          to: response.request.res.responseUrl,
          statusCode: response.status,
          homoglyphDetected: this.detectHomoglyph(url, response.request.res.responseUrl)
        });
      }

      return {
        html: typeof response.data === 'string' ? response.data : String(response.data),
        cookies,
        redirectChain
      };

    } catch (error) {
      return { html: '', cookies: [], redirectChain: [] };
    }
  }

  /**
   * Parse DOM structure using cheerio
   */
  private parseDOM($: cheerio.CheerioAPI) {
    const title = $('title').text();

    // Meta tags
    const metaTags: Record<string, string> = {};
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property') || '';
      const content = $(el).attr('content') || '';
      if (name && content) {
        metaTags[name] = content;
      }
    });

    // Forms
    const forms: FormEvidence[] = [];
    $('form').each((_, el) => {
      const action = $(el).attr('action') || '';
      const method = $(el).attr('method') || 'get';
      const inputs = $(el).find('input, select, textarea').map((_, input) => ({
        type: $(input).attr('type') || 'text',
        name: $(input).attr('name') || '',
        required: $(input).attr('required') !== undefined
      })).get();

      // Check if form submits to external domain
      const formOrigin = action.startsWith('http') ? new URL(action).origin : '';
      const submitsToExternal = formOrigin && formOrigin !== new URL($('base').attr('href') || '').origin;

      forms.push({ action, method, inputs, submitsToExternal });
    });

    // Scripts
    const scripts: ScriptEvidence[] = [];
    $('script').each((_, el) => {
      const src = $(el).attr('src');
      const inline = !src;
      const scriptContent = $(el).html() || '';
      const obfuscated = this.detectObfuscation(scriptContent);
      const suspiciousPatterns = this.detectSuspiciousJS(scriptContent);

      scripts.push({ src, inline, obfuscated, suspiciousPatterns });
    });

    // Images
    const images: ImageEvidence[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt') || '';
      // Simple logo detection (class/id contains 'logo')
      const isLogo = $(el).attr('class')?.includes('logo') || $(el).attr('id')?.includes('logo') || false;
      images.push({ src, alt, isLogo });
    });

    // Links
    const links: LinkEvidence[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const external = href.startsWith('http') && !href.includes(new URL($('base').attr('href') || 'http://localhost').hostname);
      links.push({ href, text, external });
    });

    // Iframes
    const iframes: string[] = [];
    $('iframe').each((_, el) => {
      const src = $(el).attr('src');
      if (src) iframes.push(src);
    });

    return {
      title,
      metaTags,
      forms,
      scripts,
      iframes,
      images,
      links
    };
  }

  /**
   * Build HAR (HTTP Archive) data
   */
  private buildHAR($: cheerio.CheerioAPI, baseUrl: string): HARData {
    const externalDomains = new Set<string>();
    const suspiciousRequests: Array<{ url: string; method: string; reason: string }> = [];

    // Analyze all external resources
    const baseDomain = new URL(baseUrl).hostname;

    $('script[src], link[href], img[src], iframe[src]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href') || '';
      if (src.startsWith('http')) {
        const domain = new URL(src).hostname;
        if (domain !== baseDomain) {
          externalDomains.add(domain);

          // Check for suspicious patterns
          if (src.includes('.exe') || src.includes('.zip') || src.includes('.rar')) {
            suspiciousRequests.push({
              url: src,
              method: 'GET',
              reason: 'Executable or archive file'
            });
          }
        }
      }
    });

    return {
      requests: $('script[src], link[href], img[src]').length,
      externalDomains: Array.from(externalDomains),
      suspiciousRequests
    };
  }

  /**
   * Collect DNS records
   */
  private async collectDNS(hostname: string): Promise<DNSEvidence> {
    try {
      const [a, mx, ns, txt] = await Promise.allSettled([
        dns.resolve4(hostname),
        dns.resolveMx(hostname),
        dns.resolveNs(hostname),
        dns.resolveTxt(hostname)
      ]);

      const aRecords = a.status === 'fulfilled' ? a.value : [];
      const mxRecords = mx.status === 'fulfilled' ? mx.value.map(r => r.exchange) : [];
      const nsRecords = ns.status === 'fulfilled' ? ns.value : [];
      const txtRecords = txt.status === 'fulfilled' ? txt.value.flat() : [];

      // Check SPF and DMARC
      const spfValid = txtRecords.some(r => r.startsWith('v=spf1'));
      const dmarcValid = txtRecords.some(r => r.startsWith('v=DMARC1'));

      return {
        aRecords,
        mxRecords,
        nsRecords,
        txtRecords,
        caaRecords: [], // TODO: Add CAA resolution
        spfValid,
        dmarcValid
      };
    } catch (error) {
      return this.getEmptyDNS();
    }
  }

  /**
   * Collect WHOIS data
   */
  private async collectWHOIS(hostname: string): Promise<WHOISEvidence> {
    try {
      const data = await whois(hostname);

      const createdDate = data.createdDate ? new Date(data.createdDate) : new Date();
      const updatedDate = data.updatedDate ? new Date(data.updatedDate) : new Date();
      const expiryDate = data.expiryDate ? new Date(data.expiryDate) : new Date();

      const domainAge = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        domainAge,
        registrar: data.registrar || 'Unknown',
        createdDate,
        updatedDate,
        expiryDate,
        privacyProtected: data.registrantName?.includes('REDACTED') || data.registrantName?.includes('Privacy'),
        registrantCountry: data.registrantCountry
      };
    } catch (error) {
      return this.getEmptyWHOIS();
    }
  }

  /**
   * Collect TLS certificate data
   */
  private async collectTLS(url: string): Promise<TLSEvidence | null> {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      return null;
    }

    return new Promise((resolve) => {
      const req = https.get(url, {
        rejectUnauthorized: false,
        agent: new https.Agent({ rejectUnauthorized: false })
      }, (res) => {
        const socket = res.socket as any;
        const cert = socket.getPeerCertificate();

        if (!cert || Object.keys(cert).length === 0) {
          resolve(null);
          return;
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        resolve({
          valid: socket.authorized,
          issuer: cert.issuer?.O || 'Unknown',
          subject: cert.subject?.CN || parsedUrl.hostname,
          validFrom,
          validTo,
          selfSigned: cert.issuer?.CN === cert.subject?.CN,
          daysUntilExpiry,
          certificateChain: [], // TODO: Extract full chain
          tlsVersion: socket.getProtocol() || 'Unknown',
          anomalies: socket.authorized ? [] : [socket.authorizationError]
        });
      });

      req.on('error', () => resolve(null));
      req.end();
    });
  }

  /**
   * Collect screenshot (simplified - would need browser automation)
   * TODO: Implement with Puppeteer/Playwright
   */
  private async collectScreenshot(url: string): Promise<ScreenshotEvidence | undefined> {
    // Placeholder - real implementation requires browser automation
    return undefined;
  }

  /**
   * Get ASN information from IP (simplified)
   * TODO: Integrate with IP intelligence API
   */
  private getASNFromIP(ip?: string): ASNEvidence {
    // Placeholder - would need IP intelligence API
    return {
      asn: 0,
      organization: 'Unknown',
      country: 'Unknown',
      reputation: 'neutral',
      isHosting: false,
      isCDN: false
    };
  }

  /**
   * Detect auto-download behavior
   */
  private detectAutoDownload($: cheerio.CheerioAPI): boolean {
    // Check for download attribute on links
    const hasDownloadLinks = $('a[download]').length > 0;

    // Check for meta refresh to file
    const metaRefresh = $('meta[http-equiv="refresh"]').attr('content') || '';
    const refreshesToFile = /\.(exe|zip|rar|pdf|doc|docx)$/i.test(metaRefresh);

    return hasDownloadLinks || refreshesToFile;
  }

  /**
   * Detect auto-redirect behavior
   */
  private detectAutoRedirect($: cheerio.CheerioAPI): boolean {
    // Meta refresh
    const hasMetaRefresh = $('meta[http-equiv="refresh"]').length > 0;

    // JavaScript redirect patterns
    const scripts = $('script').map((_, el) => $(el).html()).get().join('\n');
    const hasJSRedirect = /window\.location|location\.href|location\.replace/i.test(scripts);

    return hasMetaRefresh || hasJSRedirect;
  }

  /**
   * Detect script obfuscation
   */
  private detectObfuscation(script: string): boolean {
    if (!script) return false;

    // High entropy (random-looking characters)
    const entropy = this.calculateEntropy(script);
    if (entropy > 4.5) return true;

    // Common obfuscation patterns
    const obfuscationPatterns = [
      /eval\(/i,
      /unescape\(/i,
      /fromCharCode/i,
      /\\x[0-9a-f]{2}/gi,
      /\\u[0-9a-f]{4}/gi
    ];

    return obfuscationPatterns.some(pattern => pattern.test(script));
  }

  /**
   * Detect suspicious JavaScript patterns
   */
  private detectSuspiciousJS(script: string): string[] {
    const patterns: string[] = [];

    if (/document\.cookie/i.test(script)) patterns.push('cookie-theft');
    if (/localStorage|sessionStorage/i.test(script)) patterns.push('storage-access');
    if (/\.submit\(\)/i.test(script)) patterns.push('form-hijacking');
    if (/crypto|wallet/i.test(script)) patterns.push('crypto-related');
    if (/password|credit.*card|ssn/i.test(script)) patterns.push('credential-harvesting');

    return patterns;
  }

  /**
   * Calculate Shannon entropy
   */
  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies = new Map<string, number>();

    for (const char of str) {
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of frequencies.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Parse cookie string
   */
  private parseCookie(cookieStr: string): CookieEvidence | null {
    const parts = cookieStr.split(';').map(p => p.trim());
    const [nameValue] = parts;
    const [name, ...value] = nameValue.split('=');

    if (!name) return null;

    const secure = parts.some(p => p.toLowerCase() === 'secure');
    const httpOnly = parts.some(p => p.toLowerCase() === 'httponly');
    const sameSitePart = parts.find(p => p.toLowerCase().startsWith('samesite='));
    const sameSite = sameSitePart ? sameSitePart.split('=')[1] : 'none';
    const domainPart = parts.find(p => p.toLowerCase().startsWith('domain='));
    const domain = domainPart ? domainPart.split('=')[1] : '';

    return { name, domain, secure, httpOnly, sameSite };
  }

  /**
   * Detect homoglyph in redirect
   */
  private detectHomoglyph(url1: string, url2: string): boolean {
    const domain1 = new URL(url1).hostname;
    const domain2 = new URL(url2).hostname;

    // Simple homoglyph detection (would need more sophisticated algorithm)
    // Check for Unicode lookalikes
    const normalizedDomain1 = domain1.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedDomain2 = domain2.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return normalizedDomain1 !== domain1 || normalizedDomain2 !== domain2;
  }

  /**
   * Empty evidence helpers
   */
  private getEmptyEvidence(url: string): EvidenceData {
    return {
      html: '',
      dom: {
        title: '',
        metaTags: {},
        forms: [],
        scripts: [],
        iframes: [],
        images: [],
        links: []
      },
      har: { requests: 0, externalDomains: [], suspiciousRequests: [] },
      redirectChain: [],
      cookies: [],
      localStorage: {},
      tls: this.getEmptyTLS(),
      whois: this.getEmptyWHOIS(),
      dns: this.getEmptyDNS(),
      asn: this.getASNFromIP(),
      screenshot: this.getEmptyScreenshot(),
      autoDownload: false,
      autoRedirect: false,
      obfuscatedScripts: false,
      timestamp: new Date()
    };
  }

  private getEmptyTLS(): TLSEvidence {
    return {
      valid: false,
      issuer: 'Unknown',
      subject: 'Unknown',
      validFrom: new Date(),
      validTo: new Date(),
      selfSigned: false,
      daysUntilExpiry: 0,
      certificateChain: [],
      tlsVersion: 'Unknown',
      anomalies: []
    };
  }

  private getEmptyWHOIS(): WHOISEvidence {
    return {
      domainAge: 0,
      registrar: 'Unknown',
      createdDate: new Date(),
      updatedDate: new Date(),
      expiryDate: new Date(),
      privacyProtected: false
    };
  }

  private getEmptyDNS(): DNSEvidence {
    return {
      aRecords: [],
      mxRecords: [],
      nsRecords: [],
      txtRecords: [],
      caaRecords: [],
      spfValid: false,
      dmarcValid: false
    };
  }

  private getEmptyScreenshot(): ScreenshotEvidence {
    return {
      url: '',
      width: 0,
      height: 0,
      hasLoginForm: false,
      brandLogosDetected: [],
      ocrText: ''
    };
  }
}

/**
 * Factory function
 */
export function createEvidenceCollector(timeoutMs?: number, maxRedirects?: number): EvidenceCollector {
  return new EvidenceCollector(timeoutMs, maxRedirects);
}
