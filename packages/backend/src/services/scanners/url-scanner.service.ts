import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import whois from 'whois-json';
import { logger } from '../../config/logger.js';

export interface URLScanResult {
  url: string;
  riskScore: number;
  riskLevel: string;
  categories: CategoryResult[];
  findings: Finding[];
  scanDuration: number;
}

export interface CategoryResult {
  category: string;
  score: number;
  maxWeight: number;
  findings: Finding[];
  evidence: any;
}

export interface Finding {
  type: string;
  severity: string;
  message: string;
  points: number;
  details?: any;
}

const CATEGORY_WEIGHTS = {
  'Domain Analysis': 40,
  'SSL/TLS Analysis': 45,
  'Threat Intelligence': 50,
  'Content Analysis': 40,
  'Phishing Patterns': 50,
  'Malware Detection': 45,
  'Behavioral Analysis': 25,
  'Social Engineering': 30,
  'Financial Fraud': 25,
  'Identity Theft': 20,
  'Technical Exploits': 15,
  'Brand Impersonation': 20,
  'Network Analysis': 15
};

export class URLScanner {
  private findings: Finding[] = [];
  private categories: Map<string, CategoryResult> = new Map();

  async scanURL(urlString: string): Promise<URLScanResult> {
    const startTime = Date.now();
    this.findings = [];
    this.categories = new Map();

    try {
      const url = new URL(urlString);

      await Promise.allSettled([
        this.analyzeDomain(url),
        this.analyzeSSL(url),
        this.analyzeThreatIntelligence(url),
        this.analyzeContent(url),
        this.analyzePhishingPatterns(url),
        this.analyzeMalware(url),
        this.analyzeBehavioral(url),
        this.analyzeSocialEngineering(url),
        this.analyzeFinancialFraud(url),
        this.analyzeIdentityTheft(url),
        this.analyzeTechnicalExploits(url),
        this.analyzeBrandImpersonation(url),
        this.analyzeNetwork(url)
      ]);

      const riskScore = this.calculateTotalRiskScore();
      const riskLevel = this.determineRiskLevel(riskScore);

      return {
        url: urlString,
        riskScore,
        riskLevel,
        categories: Array.from(this.categories.values()),
        findings: this.findings,
        scanDuration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('URL scan error:', error);
      throw error;
    }
  }

  private async analyzeDomain(url: URL): Promise<void> {
    const category = 'Domain Analysis';
    const findings: Finding[] = [];
    let score = 0;

    try {
      // Domain age analysis
      try {
        const whoisData = await whois(url.hostname, { follow: 1, timeout: 5000 });

        if (whoisData && (whoisData as any).creationDate) {
          const creationDate = new Date((whoisData as any).creationDate);
          const ageInDays = Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24));

          if (ageInDays <= 7) {
            score += 20;
            findings.push({
              type: 'domain_age',
              severity: 'critical',
              message: `Domain is extremely new (${ageInDays} days old)`,
              points: 20,
              details: { ageInDays, creationDate }
            });
          } else if (ageInDays <= 30) {
            score += 15;
            findings.push({
              type: 'domain_age',
              severity: 'high',
              message: `Domain is very new (${ageInDays} days old)`,
              points: 15,
              details: { ageInDays, creationDate }
            });
          } else if (ageInDays <= 90) {
            score += 10;
            findings.push({
              type: 'domain_age',
              severity: 'medium',
              message: `Domain is relatively new (${ageInDays} days old)`,
              points: 10,
              details: { ageInDays, creationDate }
            });
          }
        }

        // Domain parking detection
        if (whoisData && (whoisData as any).registrar) {
          const parkingIndicators = ['parking', 'sedo', 'bodis', 'parked'];
          const isPossiblyParked = parkingIndicators.some(indicator =>
            (whoisData as any).registrar.toLowerCase().includes(indicator)
          );

          if (isPossiblyParked) {
            score += 10;
            findings.push({
              type: 'domain_parking',
              severity: 'medium',
              message: 'Domain may be parked or for sale',
              points: 10,
              details: { registrar: (whoisData as any).registrar }
            });
          }
        }
      } catch (whoisError) {
        logger.debug('WHOIS lookup failed:', whoisError);
      }

      // Suspicious TLD detection
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.date'];
      const hostname = url.hostname.toLowerCase();

      if (suspiciousTLDs.some(tld => hostname.endsWith(tld))) {
        score += 5;
        findings.push({
          type: 'suspicious_tld',
          severity: 'low',
          message: 'Domain uses commonly abused TLD',
          points: 5
        });
      }

      // Subdomain depth analysis
      const subdomains = hostname.split('.').length - 2;
      if (subdomains > 2) {
        score += 5;
        findings.push({
          type: 'deep_subdomain',
          severity: 'low',
          message: `Unusual subdomain depth (${subdomains} levels)`,
          points: 5,
          details: { subdomains }
        });
      }

    } catch (error) {
      logger.error('Domain analysis error:', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeSSL(url: URL): Promise<void> {
    const category = 'SSL/TLS Analysis';
    const findings: Finding[] = [];
    let score = 0;

    try {
      if (url.protocol === 'http:') {
        score += 45;
        findings.push({
          type: 'no_ssl',
          severity: 'critical',
          message: 'No SSL/TLS encryption - insecure connection',
          points: 45
        });
      } else if (url.protocol === 'https:') {
        try {
          // Attempt to fetch with SSL verification
          const response = await axios.get(url.href, {
            timeout: 5000,
            maxRedirects: 0,
            validateStatus: () => true
          });

          // Check security headers
          const headers = response.headers;

          if (!headers['strict-transport-security']) {
            score += 5;
            findings.push({
              type: 'missing_hsts',
              severity: 'low',
              message: 'Missing HSTS header',
              points: 5
            });
          }
        } catch (sslError: any) {
          if (sslError.code === 'CERT_HAS_EXPIRED') {
            score += 30;
            findings.push({
              type: 'expired_certificate',
              severity: 'critical',
              message: 'SSL certificate has expired',
              points: 30
            });
          } else if (sslError.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
            score += 35;
            findings.push({
              type: 'self_signed_cert',
              severity: 'critical',
              message: 'Self-signed SSL certificate detected',
              points: 35
            });
          }
        }
      }
    } catch (error) {
      logger.error('SSL analysis error:', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeThreatIntelligence(url: URL): Promise<void> {
    const category = 'Threat Intelligence';
    const findings: Finding[] = [];
    let score = 0;

    try {
      // URL reputation check (simulated - replace with actual API calls)
      const hostname = url.hostname.toLowerCase();

      // Known malicious patterns
      const maliciousPatterns = [
        'phishing', 'scam', 'malware', 'virus', 'trojan', 'hack',
        'secure-login', 'verify-account', 'suspended-account'
      ];

      for (const pattern of maliciousPatterns) {
        if (hostname.includes(pattern) || url.pathname.toLowerCase().includes(pattern)) {
          score += 15;
          findings.push({
            type: 'malicious_keyword',
            severity: 'high',
            message: `URL contains suspicious keyword: "${pattern}"`,
            points: 15,
            details: { keyword: pattern }
          });
          break;
        }
      }

      // IP address as hostname
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipPattern.test(hostname)) {
        score += 20;
        findings.push({
          type: 'ip_hostname',
          severity: 'high',
          message: 'URL uses IP address instead of domain name',
          points: 20
        });
      }

      // Suspicious port numbers
      const suspiciousPorts = ['8080', '8888', '3000', '4444', '8443'];
      if (url.port && suspiciousPorts.includes(url.port)) {
        score += 10;
        findings.push({
          type: 'suspicious_port',
          severity: 'medium',
          message: `Suspicious port number: ${url.port}`,
          points: 10,
          details: { port: url.port }
        });
      }
    } catch (error) {
      logger.error('Threat intelligence analysis error:', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeContent(url: URL): Promise<void> {
    const category = 'Content Analysis';
    const findings: Finding[] = [];
    let score = 0;

    try {
      const response = await axios.get(url.href, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Hidden elements detection
      const hiddenElements = $('[style*="display:none"], [style*="visibility:hidden"]').length;
      if (hiddenElements > 5) {
        score += 10;
        findings.push({
          type: 'hidden_elements',
          severity: 'medium',
          message: `Large number of hidden elements (${hiddenElements})`,
          points: 10,
          details: { count: hiddenElements }
        });
      }

      // Suspicious forms
      const forms = $('form');
      const passwordForms = forms.filter((_, el) => $(el).find('input[type="password"]').length > 0);

      if (passwordForms.length > 0 && url.protocol === 'http:') {
        score += 20;
        findings.push({
          type: 'insecure_password_form',
          severity: 'critical',
          message: 'Password form on insecure connection',
          points: 20
        });
      }

      // Suspicious JavaScript
      const scripts = $('script').toArray();
      const suspiciousJSPatterns = ['eval(', 'unescape(', 'document.write', 'fromCharCode'];

      for (const script of scripts) {
        const scriptContent = $(script).html() || '';
        for (const pattern of suspiciousJSPatterns) {
          if (scriptContent.includes(pattern)) {
            score += 5;
            findings.push({
              type: 'suspicious_javascript',
              severity: 'low',
              message: `Suspicious JavaScript pattern: ${pattern}`,
              points: 5,
              details: { pattern }
            });
            break;
          }
        }
      }

      // External resources analysis
      const externalResources = $('script[src], link[href], img[src]').filter((_, el) => {
        const src = $(el).attr('src') || $(el).attr('href') || '';
        try {
          const resourceURL = new URL(src, url.href);
          return resourceURL.hostname !== url.hostname;
        } catch {
          return false;
        }
      }).length;

      if (externalResources > 20) {
        score += 5;
        findings.push({
          type: 'many_external_resources',
          severity: 'low',
          message: `High number of external resources (${externalResources})`,
          points: 5,
          details: { count: externalResources }
        });
      }
    } catch (error) {
      logger.debug('Content analysis error (may be expected):', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzePhishingPatterns(url: URL): Promise<void> {
    const category = 'Phishing Patterns';
    const findings: Finding[] = [];
    let score = 0;

    const hostname = url.hostname.toLowerCase();
    const fullURL = url.href.toLowerCase();

    // Brand typosquatting detection
    const popularBrands = [
      'paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook',
      'netflix', 'instagram', 'twitter', 'linkedin', 'ebay', 'chase',
      'bankofamerica', 'wellsfargo', 'citibank', 'americanexpress'
    ];

    for (const brand of popularBrands) {
      // Exact match with suspicious TLD
      if (hostname.includes(brand)) {
        const validDomains = [`${brand}.com`, `${brand}.net`, `${brand}.org`];
        if (!validDomains.some(valid => hostname === valid || hostname.endsWith(`.${valid}`))) {
          score += 30;
          findings.push({
            type: 'brand_typosquatting',
            severity: 'critical',
            message: `Potential ${brand} impersonation`,
            points: 30,
            details: { brand }
          });
          break;
        }
      }

      // Levenshtein distance check for close matches
      if (this.calculateSimilarity(hostname, brand) > 0.8 && !hostname.includes(brand)) {
        score += 25;
        findings.push({
          type: 'brand_similarity',
          severity: 'high',
          message: `Domain very similar to ${brand}`,
          points: 25,
          details: { brand }
        });
        break;
      }
    }

    // Credential harvesting indicators
    const credentialKeywords = ['login', 'signin', 'verify', 'account', 'update', 'suspended', 'confirm'];
    const hasCredentialKeyword = credentialKeywords.some(kw => fullURL.includes(kw));

    if (hasCredentialKeyword && score > 20) {
      score += 15;
      findings.push({
        type: 'credential_harvesting',
        severity: 'high',
        message: 'Possible credential harvesting attempt',
        points: 15
      });
    }

    // URL obfuscation
    if (url.href.includes('@') || url.href.includes('%')) {
      score += 10;
      findings.push({
        type: 'url_obfuscation',
        severity: 'medium',
        message: 'URL contains obfuscation characters',
        points: 10
      });
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeMalware(url: URL): Promise<void> {
    const category = 'Malware Detection';
    const findings: Finding[] = [];
    let score = 0;

    try {
      const response = await axios.get(url.href, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: () => true
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Drive-by download detection
      const suspiciousLinks = $('a[download], a[href$=".exe"], a[href$=".scr"], a[href$=".bat"], a[href$=".vbs"]');
      if (suspiciousLinks.length > 0) {
        score += 30;
        findings.push({
          type: 'suspicious_downloads',
          severity: 'critical',
          message: 'Potential malicious file downloads detected',
          points: 30,
          details: { count: suspiciousLinks.length }
        });
      }

      // Iframe analysis
      const iframes = $('iframe');
      if (iframes.length > 3) {
        score += 10;
        findings.push({
          type: 'multiple_iframes',
          severity: 'medium',
          message: `Multiple iframes detected (${iframes.length})`,
          points: 10,
          details: { count: iframes.length }
        });
      }

      // Exploit kit indicators
      const exploitPatterns = ['exploit', 'payload', 'shellcode', 'metasploit'];
      const pageContent = html.toLowerCase();

      for (const pattern of exploitPatterns) {
        if (pageContent.includes(pattern)) {
          score += 15;
          findings.push({
            type: 'exploit_indicators',
            severity: 'high',
            message: `Possible exploit kit indicator: ${pattern}`,
            points: 15,
            details: { pattern }
          });
          break;
        }
      }
    } catch (error) {
      logger.debug('Malware analysis error:', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeBehavioral(url: URL): Promise<void> {
    const category = 'Behavioral Analysis';
    const findings: Finding[] = [];
    let score = 0;

    try {
      // Redirect chain analysis
      let redirectCount = 0;
      let currentURL = url.href;
      const maxRedirects = 5;

      for (let i = 0; i < maxRedirects; i++) {
        try {
          const response = await axios.get(currentURL, {
            timeout: 3000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
          });

          if (response.status >= 300 && response.status < 400) {
            redirectCount++;
            currentURL = response.headers.location || '';
          } else {
            break;
          }
        } catch (error: any) {
          if (error.response && error.response.status >= 300 && error.response.status < 400) {
            redirectCount++;
            currentURL = error.response.headers.location || '';
          } else {
            break;
          }
        }
      }

      if (redirectCount > 3) {
        score += 15;
        findings.push({
          type: 'excessive_redirects',
          severity: 'medium',
          message: `Excessive redirect chain (${redirectCount} redirects)`,
          points: 15,
          details: { redirectCount }
        });
      }

      // URL length analysis
      if (url.href.length > 200) {
        score += 5;
        findings.push({
          type: 'long_url',
          severity: 'low',
          message: `Unusually long URL (${url.href.length} characters)`,
          points: 5,
          details: { length: url.href.length }
        });
      }

      // Suspicious parameters
      const params = new URLSearchParams(url.search);
      if (params.toString().length > 500) {
        score += 5;
        findings.push({
          type: 'long_parameters',
          severity: 'low',
          message: 'Unusually long URL parameters',
          points: 5
        });
      }
    } catch (error) {
      logger.debug('Behavioral analysis error:', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeSocialEngineering(url: URL): Promise<void> {
    const category = 'Social Engineering';
    const findings: Finding[] = [];
    let score = 0;

    const fullURL = url.href.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    // Urgency tactics
    const urgencyWords = ['urgent', 'immediate', 'expire', 'suspended', 'limited', 'act now', 'hurry'];
    const hasUrgency = urgencyWords.some(word => fullURL.includes(word));

    if (hasUrgency) {
      score += 12;
      findings.push({
        type: 'urgency_tactics',
        severity: 'medium',
        message: 'URL contains urgency indicators',
        points: 12
      });
    }

    // Authority impersonation
    const authorityWords = ['gov', 'official', 'secure', 'verified', 'authentic', 'admin'];
    const hasAuthority = authorityWords.some(word => hostname.includes(word) || url.pathname.includes(word));

    if (hasAuthority && !hostname.endsWith('.gov')) {
      score += 10;
      findings.push({
        type: 'authority_impersonation',
        severity: 'medium',
        message: 'Possible authority impersonation',
        points: 10
      });
    }

    // Fear-based manipulation
    const fearWords = ['warning', 'alert', 'security', 'breach', 'hack', 'compromised'];
    const hasFear = fearWords.some(word => fullURL.includes(word));

    if (hasFear) {
      score += 8;
      findings.push({
        type: 'fear_manipulation',
        severity: 'low',
        message: 'Contains fear-based language',
        points: 8
      });
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeFinancialFraud(url: URL): Promise<void> {
    const category = 'Financial Fraud';
    const findings: Finding[] = [];
    let score = 0;

    const fullURL = url.href.toLowerCase();

    // Payment fraud indicators
    const paymentWords = ['payment', 'refund', 'billing', 'invoice', 'transfer', 'deposit'];
    const hasPayment = paymentWords.some(word => fullURL.includes(word));

    if (hasPayment) {
      score += 10;
      findings.push({
        type: 'payment_indicators',
        severity: 'medium',
        message: 'Contains payment-related keywords',
        points: 10
      });
    }

    // Cryptocurrency scam indicators
    const cryptoWords = ['bitcoin', 'ethereum', 'crypto', 'wallet', 'investment', 'profit', 'trading'];
    const hasCrypto = cryptoWords.some(word => fullURL.includes(word));

    if (hasCrypto) {
      score += 10;
      findings.push({
        type: 'crypto_indicators',
        severity: 'medium',
        message: 'Contains cryptocurrency-related keywords',
        points: 10
      });
    }

    // Too-good-to-be-true offers
    const scamWords = ['free', 'winner', 'prize', 'guaranteed', 'earn', 'cash'];
    const hasScamWord = scamWords.some(word => fullURL.includes(word));

    if (hasScamWord) {
      score += 5;
      findings.push({
        type: 'scam_indicators',
        severity: 'low',
        message: 'Contains typical scam keywords',
        points: 5
      });
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeIdentityTheft(url: URL): Promise<void> {
    const category = 'Identity Theft';
    const findings: Finding[] = [];
    let score = 0;

    const fullURL = url.href.toLowerCase();

    // PII harvesting indicators
    const piiWords = ['ssn', 'social security', 'passport', 'driver license', 'birthdate', 'personal info'];
    const hasPII = piiWords.some(word => fullURL.includes(word.replace(' ', '')));

    if (hasPII) {
      score += 12;
      findings.push({
        type: 'pii_harvesting',
        severity: 'high',
        message: 'Requests for personally identifiable information',
        points: 12
      });
    }

    // Identity verification requests
    const verifyWords = ['verify identity', 'confirm identity', 'validate'];
    const hasVerify = verifyWords.some(word => fullURL.includes(word.replace(' ', '')));

    if (hasVerify) {
      score += 8;
      findings.push({
        type: 'identity_verification',
        severity: 'medium',
        message: 'Requests identity verification',
        points: 8
      });
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeTechnicalExploits(url: URL): Promise<void> {
    const category = 'Technical Exploits';
    const findings: Finding[] = [];
    let score = 0;

    const fullURL = url.href;
    const path = url.pathname + url.search;

    // SQL injection patterns
    const sqlPatterns = ["'", '"', '--', 'OR', 'SELECT', 'UNION'];
    const hasSQLPattern = sqlPatterns.some(pattern => path.toUpperCase().includes(pattern));

    if (hasSQLPattern) {
      score += 7;
      findings.push({
        type: 'sql_injection',
        severity: 'medium',
        message: 'Possible SQL injection attempt',
        points: 7
      });
    }

    // XSS patterns
    const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload='];
    const hasXSS = xssPatterns.some(pattern => path.toLowerCase().includes(pattern));

    if (hasXSS) {
      score += 5;
      findings.push({
        type: 'xss_attempt',
        severity: 'medium',
        message: 'Possible XSS attempt detected',
        points: 5
      });
    }

    // Path traversal
    if (path.includes('../') || path.includes('..\\')) {
      score += 3;
      findings.push({
        type: 'path_traversal',
        severity: 'low',
        message: 'Path traversal pattern detected',
        points: 3
      });
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeBrandImpersonation(url: URL): Promise<void> {
    const category = 'Brand Impersonation';
    const findings: Finding[] = [];
    let score = 0;

    try {
      const response = await axios.get(url.href, {
        timeout: 5000,
        validateStatus: () => true
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Favicon analysis
      const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').attr('href');
      if (favicon && favicon.includes('http') && !favicon.includes(url.hostname)) {
        score += 8;
        findings.push({
          type: 'external_favicon',
          severity: 'low',
          message: 'Favicon loaded from external domain',
          points: 8
        });
      }

      // Copyright text analysis
      const bodyText = $('body').text().toLowerCase();
      const copyrightMatch = bodyText.match(/©\s*\d{4}\s+([a-z\s]+)/i);

      if (copyrightMatch && !url.hostname.includes(copyrightMatch[1].trim())) {
        score += 7;
        findings.push({
          type: 'mismatched_copyright',
          severity: 'low',
          message: 'Copyright doesn\'t match domain',
          points: 7
        });
      }

      // Logo analysis (external logos)
      const logos = $('img[alt*="logo" i], img[src*="logo" i]');
      const externalLogos = logos.filter((_, el) => {
        const src = $(el).attr('src') || '';
        try {
          const logoURL = new URL(src, url.href);
          return logoURL.hostname !== url.hostname;
        } catch {
          return false;
        }
      }).length;

      if (externalLogos > 0) {
        score += 5;
        findings.push({
          type: 'external_logo',
          severity: 'low',
          message: 'Logo loaded from external source',
          points: 5,
          details: { count: externalLogos }
        });
      }
    } catch (error) {
      logger.debug('Brand impersonation analysis error:', error);
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private async analyzeNetwork(url: URL): Promise<void> {
    const category = 'Network Analysis';
    const findings: Finding[] = [];
    let score = 0;

    const hostname = url.hostname;

    // IP reputation (simulated)
    const suspiciousIPs = ['192.168.', '10.', '172.16.'];
    if (suspiciousIPs.some(ip => hostname.startsWith(ip))) {
      score += 8;
      findings.push({
        type: 'private_ip',
        severity: 'medium',
        message: 'Uses private IP address range',
        points: 8
      });
    }

    // Port analysis
    if (url.port && !['80', '443', '8080'].includes(url.port)) {
      score += 4;
      findings.push({
        type: 'uncommon_port',
        severity: 'low',
        message: `Uncommon port: ${url.port}`,
        points: 4,
        details: { port: url.port }
      });
    }

    // Localhost detection
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      score += 3;
      findings.push({
        type: 'localhost',
        severity: 'low',
        message: 'Points to localhost',
        points: 3
      });
    }

    this.addCategory(category, score, findings, CATEGORY_WEIGHTS[category]);
  }

  private addCategory(name: string, score: number, findings: Finding[], maxWeight: number): void {
    this.categories.set(name, {
      category: name,
      score: Math.min(score, maxWeight),
      maxWeight,
      findings,
      evidence: { timestamp: new Date().toISOString() }
    });

    this.findings.push(...findings);
  }

  private calculateTotalRiskScore(): number {
    let total = 0;
    for (const category of this.categories.values()) {
      total += category.score;
    }
    return Math.min(total, 350);
  }

  private determineRiskLevel(score: number): string {
    if (score >= 200) return 'critical';
    if (score >= 120) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 20) return 'low';
    return 'safe';
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export const urlScanner = new URLScanner();
