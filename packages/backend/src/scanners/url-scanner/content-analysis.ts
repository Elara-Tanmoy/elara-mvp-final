import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';

export interface ContentAnalysisResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  evidence: {
    urgencyTactics?: string[];
    authorityImpersonation?: string[];
    fakeLoginForms?: boolean;
    maliciousScripts?: string[];
    hiddenIframes?: number;
    suspiciousRedirects?: boolean;
    formCount?: number;
    scriptCount?: number;
  };
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  points: number;
  source: string;
}

const URGENCY_KEYWORDS = [
  'urgent', 'immediate', 'act now', 'limited time', 'expires', 'hurry',
  'last chance', 'final warning', 'suspended', 'locked', 'verify now',
  'confirm immediately', 'action required', 'within 24 hours'
];

const AUTHORITY_BRANDS = [
  'paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook',
  'netflix', 'bank', 'irs', 'fedex', 'ups', 'dhl', 'usps'
];

const MALICIOUS_SCRIPT_PATTERNS = [
  /eval\(/gi,
  /document\.write\(/gi,
  /fromCharCode/gi,
  /unescape\(/gi,
  /atob\(/gi,
  /\$\(document\)\.ready.*keylog/gi
];

/**
 * RYAN RAG - Content Analysis (60 points max)
 * Analyzes page content for phishing patterns and malicious code
 */
export async function analyzeContent(url: string, hostname: string): Promise<ContentAnalysisResult> {
  const findings: Finding[] = [];
  let score = 0;
  const maxScore = 60;
  const evidence: any = {
    urgencyTactics: [],
    authorityImpersonation: [],
    maliciousScripts: []
  };

  try {
    logger.info(`[Content Analysis] Analyzing ${url}`);

    // Fetch page content
    const response = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: () => true
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const pageText = $('body').text().toLowerCase();

    // 1. Urgency Tactics Detection (8 points)
    const foundUrgency = URGENCY_KEYWORDS.filter(keyword =>
      pageText.includes(keyword.toLowerCase())
    );

    if (foundUrgency.length > 5) {
      score += 8;
      evidence.urgencyTactics = foundUrgency.slice(0, 5);
      findings.push({
        severity: 'high',
        message: `Heavy use of urgency tactics (${foundUrgency.length} instances)`,
        points: 8,
        source: 'Content Analysis'
      });
    } else if (foundUrgency.length > 2) {
      score += 5;
      evidence.urgencyTactics = foundUrgency;
      findings.push({
        severity: 'medium',
        message: `Uses urgency language: ${foundUrgency.slice(0, 3).join(', ')}`,
        points: 5,
        source: 'Content Analysis'
      });
    }

    // 2. Authority Impersonation (10 points)
    // Enhanced logic to prevent false positives
    const foundBrands = AUTHORITY_BRANDS.filter(brand => {
      const regex = new RegExp(`\\b${brand}\\b`, 'i');
      return regex.test(pageText);
    });

    // Check if domain is official or legitimate
    const isOfficialDomain = foundBrands.some(brand => {
      const normalizedHost = hostname.toLowerCase();
      return (
        // Official domains
        normalizedHost === `${brand}.com` ||
        normalizedHost === `www.${brand}.com` ||
        normalizedHost.endsWith(`.${brand}.com`) ||
        normalizedHost === `${brand}.net` ||
        normalizedHost.endsWith(`.${brand}.net`) ||
        normalizedHost === `${brand}.org` ||
        normalizedHost.endsWith(`.${brand}.org`) ||
        // Known legitimate subdomains
        normalizedHost.includes(`${brand}.`) ||
        // Special cases for known brands
        (brand === 'google' && (normalizedHost.includes('google') || normalizedHost.includes('gmail') || normalizedHost.includes('youtube'))) ||
        (brand === 'microsoft' && (normalizedHost.includes('microsoft') || normalizedHost.includes('office') || normalizedHost.includes('live.com') || normalizedHost.includes('outlook'))) ||
        (brand === 'apple' && (normalizedHost.includes('apple') || normalizedHost.includes('icloud'))) ||
        (brand === 'amazon' && (normalizedHost.includes('amazon') || normalizedHost.includes('aws'))) ||
        (brand === 'facebook' && (normalizedHost.includes('facebook') || normalizedHost.includes('fb.com') || normalizedHost.includes('messenger')))
      );
    });

    // Only flag if brand is mentioned prominently AND domain is suspicious
    const prominentBrandMention = foundBrands.filter(brand => {
      const titleText = $('title').text().toLowerCase();
      const h1Text = $('h1').text().toLowerCase();
      const brandRegex = new RegExp(`\\b${brand}\\b`, 'i');

      // Check for prominent mentions in title, h1, or multiple occurrences
      const titleMatch = brandRegex.test(titleText);
      const h1Match = brandRegex.test(h1Text);
      const occurrences = (pageText.match(new RegExp(`\\b${brand}\\b`, 'gi')) || []).length;

      return (titleMatch || h1Match || occurrences > 5);
    });

    if (prominentBrandMention.length > 0 && !isOfficialDomain) {
      // Additional check: ensure this looks like impersonation, not just a mention
      const hasLoginForm = $('input[type="password"]').length > 0;
      const hasUrgencyLanguage = foundUrgency.length > 3;

      if (hasLoginForm || hasUrgencyLanguage) {
        score += 10;
        evidence.authorityImpersonation = prominentBrandMention;
        findings.push({
          severity: 'critical',
          message: `Likely impersonates trusted brand: ${prominentBrandMention.join(', ')} (suspicious domain)`,
          points: 10,
          source: 'Content Analysis'
        });
      } else {
        // Lower severity if just mentioning brand without clear phishing indicators
        score += 3;
        evidence.authorityImpersonation = prominentBrandMention;
        findings.push({
          severity: 'low',
          message: `Mentions brand: ${prominentBrandMention.join(', ')} (not official domain)`,
          points: 3,
          source: 'Content Analysis'
        });
      }
    }

    // 3. Fake Login Forms (12 points)
    const passwordFields = $('input[type="password"]').length;
    const emailFields = $('input[type="email"], input[name*="email"], input[name*="username"]').length;
    evidence.formCount = $('form').length;

    if (passwordFields > 0 && emailFields > 0) {
      const formAction = $('form').first().attr('action');
      const formSubmitsElsewhere = formAction && !formAction.startsWith(url) && !formAction.startsWith('/');

      if (formSubmitsElsewhere) {
        score += 12;
        evidence.fakeLoginForms = true;
        findings.push({
          severity: 'critical',
          message: `Login form submits to external domain: ${formAction}`,
          points: 12,
          source: 'Content Analysis'
        });
      } else if (prominentBrandMention.length > 0 && !isOfficialDomain) {
        score += 10;
        evidence.fakeLoginForms = true;
        findings.push({
          severity: 'critical',
          message: 'Fake login form mimicking trusted service',
          points: 10,
          source: 'Content Analysis'
        });
      }
    }

    // 4. Malicious JavaScript Patterns (10 points)
    const scripts = $('script')
      .map((_, el) => $(el).html())
      .get()
      .join('\n');

    evidence.scriptCount = $('script').length;

    const maliciousPatterns = MALICIOUS_SCRIPT_PATTERNS.filter(pattern =>
      pattern.test(scripts)
    );

    if (maliciousPatterns.length > 3) {
      score += 10;
      evidence.maliciousScripts = maliciousPatterns.map(p => p.source.substring(0, 30));
      findings.push({
        severity: 'critical',
        message: `Multiple suspicious JavaScript patterns detected (${maliciousPatterns.length})`,
        points: 10,
        source: 'Content Analysis'
      });
    } else if (maliciousPatterns.length > 0) {
      score += 6;
      evidence.maliciousScripts = maliciousPatterns.map(p => p.source.substring(0, 30));
      findings.push({
        severity: 'high',
        message: `Suspicious JavaScript patterns found: ${maliciousPatterns.length}`,
        points: 6,
        source: 'Content Analysis'
      });
    }

    // 5. Hidden Iframes (8 points)
    const iframes = $('iframe');
    const hiddenIframes = iframes.filter((_, el) => {
      const $iframe = $(el);
      const width = $iframe.attr('width') || $iframe.css('width');
      const height = $iframe.attr('height') || $iframe.css('height');
      const display = $iframe.css('display');
      const visibility = $iframe.css('visibility');

      return (
        width === '0' ||
        width === '0px' ||
        height === '0' ||
        height === '0px' ||
        display === 'none' ||
        visibility === 'hidden'
      );
    }).length;

    evidence.hiddenIframes = hiddenIframes;

    if (hiddenIframes > 2) {
      score += 8;
      findings.push({
        severity: 'high',
        message: `${hiddenIframes} hidden iframes detected - possible clickjacking`,
        points: 8,
        source: 'Content Analysis'
      });
    } else if (hiddenIframes > 0) {
      score += 5;
      findings.push({
        severity: 'medium',
        message: `${hiddenIframes} hidden iframe(s) detected`,
        points: 5,
        source: 'Content Analysis'
      });
    }

    // 6. Suspicious Redirects (7 points)
    const metaRefresh = $('meta[http-equiv="refresh"]');
    const jsRedirects = scripts.match(/window\.location|document\.location|location\.href|location\.replace/g);

    if (metaRefresh.length > 0 || (jsRedirects && jsRedirects.length > 2)) {
      score += 7;
      evidence.suspiciousRedirects = true;
      findings.push({
        severity: 'medium',
        message: 'Multiple redirects detected - possible phishing chain',
        points: 7,
        source: 'Content Analysis'
      });
    }

    // 7. No HTTPS in forms (5 points - bonus check)
    const formsWithoutHttps = $('form').filter((_, el) => {
      const action = $(el).attr('action');
      return action && action.startsWith('http://');
    }).length;

    if (formsWithoutHttps > 0) {
      score += 5;
      findings.push({
        severity: 'medium',
        message: `${formsWithoutHttps} form(s) submit over unencrypted HTTP`,
        points: 5,
        source: 'Content Analysis'
      });
    }

    // Add summary finding if safe
    if (score === 0) {
      findings.push({
        severity: 'info',
        message: 'No malicious content patterns detected',
        points: 0,
        source: 'Content Analysis'
      });
    }

    logger.info(`[Content Analysis] Complete: ${score}/${maxScore} points`);

    return {
      score,
      maxScore,
      findings,
      evidence
    };

  } catch (error: any) {
    logger.error('[Content Analysis] Error:', error.message);
    return {
      score: 0,
      maxScore,
      findings: [{
        severity: 'info',
        message: `Content analysis incomplete: ${error.message}`,
        points: 0,
        source: 'System'
      }],
      evidence: {}
    };
  }
}
