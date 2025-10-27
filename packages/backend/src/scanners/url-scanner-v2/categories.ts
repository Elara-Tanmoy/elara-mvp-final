/**
 * V2 Granular Categories Module
 *
 * Implements 17-category checking system with 570 total points.
 * Each category creates GranularCheckResult entries for detailed tracking.
 * Applies reachability-based branching (ONLINE/OFFLINE/PARKED/WAF/SINKHOLE).
 */

import type {
  EvidenceData,
  ReachabilityStatus,
  GranularCheckResult
} from './types';

export interface CategoryResult {
  categoryName: string;
  points: number;
  maxPoints: number;
  checks: GranularCheckResult[];
  skipped: boolean;
  skipReason?: string;
}

export interface CategoryExecutionContext {
  url: string;
  evidence: EvidenceData;
  reachability: ReachabilityStatus;
  tiData: {
    totalHits: number;
    tier1Hits: number;
    tier1Sources: Array<{ source: string; severity: string; lastSeen: Date }>;
  };
}

/**
 * Category 1: Threat Intelligence (50 points)
 * Always runs regardless of reachability
 */
export function runThreatIntelCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  let points = 0;
  const maxPoints = 50;

  // Check 1.1: Any TI hits
  const hasTIHits = ctx.tiData.totalHits > 0;
  checks.push({
    checkId: 'ti_hits',
    name: 'Threat Intelligence Database Lookup',
    category: 'reputation',
    status: hasTIHits ? 'FAIL' : 'PASS',
    points: hasTIHits ? 0 : 10,
    maxPoints: 10,
    description: hasTIHits
      ? `Found in ${ctx.tiData.totalHits} threat database(s)`
      : 'No threat intelligence hits found',
    evidence: {
      totalHits: ctx.tiData.totalHits,
      tier1Hits: ctx.tiData.tier1Hits,
      sources: ctx.tiData.tier1Sources.map(s => s.source)
    },
    timestamp: new Date()
  });
  if (hasTIHits) points += 30; // Penalty points

  // Check 1.2: Tier-1 sources
  const hasTier1 = ctx.tiData.tier1Hits > 0;
  checks.push({
    checkId: 'ti_tier1',
    name: 'Premium Threat Intelligence Sources',
    category: 'reputation',
    status: hasTier1 ? 'FAIL' : 'PASS',
    points: hasTier1 ? 0 : 15,
    maxPoints: 15,
    description: hasTier1
      ? `Flagged by ${ctx.tiData.tier1Hits} tier-1 source(s): ${ctx.tiData.tier1Sources.map(s => s.source).join(', ')}`
      : 'No tier-1 threat intelligence hits',
    evidence: {
      tier1Hits: ctx.tiData.tier1Hits,
      sources: ctx.tiData.tier1Sources
    },
    timestamp: new Date()
  });
  if (hasTier1) points += 20; // Additional penalty

  return {
    categoryName: 'Threat Intelligence',
    points,
    maxPoints,
    checks,
    skipped: false
  };
}

/**
 * Category 2: Domain/WHOIS/TLD Analysis (40 points)
 * Always runs
 */
export function runDomainAnalysisCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  let points = 0;
  const maxPoints = 40;

  // Check 2.1: Domain age
  const domainAge = ctx.evidence.whois.domainAge;
  const isYoungDomain = domainAge < 30;
  checks.push({
    checkId: 'domain_age',
    name: 'Domain Age Analysis',
    category: 'legitimacy',
    status: isYoungDomain ? 'FAIL' : domainAge < 90 ? 'WARNING' : 'PASS',
    points: isYoungDomain ? 0 : domainAge < 90 ? 5 : 10,
    maxPoints: 10,
    description: `Domain is ${domainAge} days old${isYoungDomain ? ' (very new - suspicious)' : domainAge < 90 ? ' (relatively new)' : ' (established)'}`,
    evidence: {
      domainAge,
      createdDate: ctx.evidence.whois.createdDate,
      registrar: ctx.evidence.whois.registrar
    },
    timestamp: new Date()
  });
  if (isYoungDomain) points += 15;

  // Check 2.2: WHOIS privacy protection
  const hasPrivacy = ctx.evidence.whois.privacyProtected;
  checks.push({
    checkId: 'whois_privacy',
    name: 'WHOIS Privacy Protection',
    category: 'legitimacy',
    status: hasPrivacy ? 'WARNING' : 'PASS',
    points: hasPrivacy ? 5 : 10,
    maxPoints: 10,
    description: hasPrivacy
      ? 'Domain uses privacy protection (identity hidden)'
      : 'Domain registration information is public',
    evidence: {
      privacyProtected: hasPrivacy,
      registrar: ctx.evidence.whois.registrar
    },
    timestamp: new Date()
  });
  if (hasPrivacy) points += 5;

  // Check 2.3: TLD risk assessment
  const hostname = new URL(ctx.url).hostname;
  const tld = hostname.split('.').pop() || '';
  const highRiskTLDs = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'date', 'download', 'bid', 'win', 'pw', 'cc'];
  const isHighRiskTLD = highRiskTLDs.includes(tld.toLowerCase());
  checks.push({
    checkId: 'tld_risk',
    name: 'Top-Level Domain Risk',
    category: 'technical',
    status: isHighRiskTLD ? 'FAIL' : 'PASS',
    points: isHighRiskTLD ? 0 : 10,
    maxPoints: 10,
    description: isHighRiskTLD
      ? `High-risk TLD: .${tld} (commonly used for abuse)`
      : `Standard TLD: .${tld}`,
    evidence: { tld, isHighRisk: isHighRiskTLD },
    timestamp: new Date()
  });
  if (isHighRiskTLD) points += 10;

  // Check 2.4: Registrar reputation
  const suspiciousRegistrars = ['namecheap', 'godaddy privacy', 'whoisguard', 'domains by proxy'];
  const isSuspiciousRegistrar = suspiciousRegistrars.some(r =>
    ctx.evidence.whois.registrar.toLowerCase().includes(r)
  );
  checks.push({
    checkId: 'registrar_reputation',
    name: 'Registrar Reputation',
    category: 'legitimacy',
    status: isSuspiciousRegistrar ? 'WARNING' : 'INFO',
    points: isSuspiciousRegistrar ? 5 : 10,
    maxPoints: 10,
    description: `Registrar: ${ctx.evidence.whois.registrar}`,
    evidence: {
      registrar: ctx.evidence.whois.registrar,
      suspicious: isSuspiciousRegistrar
    },
    timestamp: new Date()
  });
  if (isSuspiciousRegistrar) points += 5;

  // Check 2.5: Free hosting provider detection (CRITICAL FOR PHISHING)
  const freeHostingProviders = [
    '000webhostapp.com', 'freehostia.com', 'freehosting.com',
    'infinityfree.net', 'byethost', 'weebly.com', 'wordpress.com',
    'blogspot.com', 'github.io', 'netlify.app', 'vercel.app',
    'wixsite.com', 'webnode.com', 'yolasite.com', 'webs.com'
  ];

  const isFreeHosting = freeHostingProviders.some(provider => hostname.includes(provider));

  if (isFreeHosting) {
    checks.push({
      checkId: 'free_hosting_detection',
      name: 'Free Hosting Provider',
      category: 'reputation',
      status: 'FAIL',
      points: 0,
      maxPoints: 10,
      description: `Site hosted on free hosting provider (${hostname}) - common for phishing`,
      evidence: { hostname, isFreeHosting: true, provider: freeHostingProviders.find(p => hostname.includes(p)) },
      timestamp: new Date()
    });
    points += 30; // HIGH RISK PENALTY
  }

  return {
    categoryName: 'Domain/WHOIS/TLD Analysis',
    points,
    maxPoints,
    checks,
    skipped: false
  };
}

/**
 * Category 2.5: URL Pattern Analysis (30 points)
 * CRITICAL: Runs for ALL reachability states (OFFLINE phishing detection)
 * Checks URL structure for phishing indicators WITHOUT needing page content
 */
export function runURLPatternAnalysisCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  let points = 0;
  const maxPoints = 30;

  const urlLower = ctx.url.toLowerCase();
  const parsedUrl = new URL(ctx.url);
  const hostname = parsedUrl.hostname;
  const path = parsedUrl.pathname;

  // Check 2.5.1: Brand impersonation detection (CRITICAL FOR PHISHING)
  // Detects when brand keywords appear in URL but NOT on the official domain
  const brandKeywords = [
    // Banks - Canadian
    { keyword: 'cibc', official: ['cibc.com'] },
    { keyword: 'td', official: ['td.com', 'tdbank.com'] },
    { keyword: 'rbc', official: ['rbc.com', 'rbcroyalbank.com'] },
    { keyword: 'scotia', official: ['scotiabank.com'] },
    { keyword: 'bmo', official: ['bmo.com'] },
    { keyword: 'tangerine', official: ['tangerine.ca'] },
    { keyword: 'simplii', official: ['simplii.com'] },
    { keyword: 'desjardins', official: ['desjardins.com'] },
    // Banks - US
    { keyword: 'paypal', official: ['paypal.com'] },
    { keyword: 'chase', official: ['chase.com'] },
    { keyword: 'wellsfargo', official: ['wellsfargo.com'] },
    { keyword: 'bankofamerica', official: ['bankofamerica.com'] },
    { keyword: 'citi', official: ['citi.com', 'citibank.com'] },
    { keyword: 'capitalone', official: ['capitalone.com'] },
    // Cloud Storage & File Sharing
    { keyword: 'dropbox', official: ['dropbox.com'] },
    { keyword: 'onedrive', official: ['onedrive.com', 'onedrive.live.com'] },
    { keyword: 'googledrive', official: ['drive.google.com'] },
    { keyword: 'icloud', official: ['icloud.com'] },
    { keyword: 'sharepoint', official: ['sharepoint.com'] },
    // Document Services (INCLUDING DOCUSIGN!)
    { keyword: 'docusign', official: ['docusign.com', 'docusign.net'] },
    { keyword: 'adobesign', official: ['adobesign.com', 'adobe.com'] },
    { keyword: 'hellosign', official: ['hellosign.com'] },
    // Tech Companies (commonly impersonated)
    { keyword: 'microsoft', official: ['microsoft.com', 'live.com', 'outlook.com', 'office.com'] },
    { keyword: 'google', official: ['google.com', 'gmail.com'] },
    { keyword: 'apple', official: ['apple.com', 'icloud.com'] },
    { keyword: 'amazon', official: ['amazon.com'] },
    { keyword: 'facebook', official: ['facebook.com', 'fb.com', 'meta.com'] },
    { keyword: 'netflix', official: ['netflix.com'] },
    { keyword: 'spotify', official: ['spotify.com'] },
    // Crypto
    { keyword: 'coinbase', official: ['coinbase.com'] },
    { keyword: 'binance', official: ['binance.com'] }
  ];

  const impersonatedBrands: string[] = [];
  
  for (const brand of brandKeywords) {
    if (urlLower.includes(brand.keyword)) {
      // Check if this is the OFFICIAL domain
      const isOfficialDomain = brand.official.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );
      
      // Only flag as phishing if keyword present but NOT official domain
      if (!isOfficialDomain) {
        impersonatedBrands.push(brand.keyword);
      }
    }
  }

  if (impersonatedBrands.length > 0) {
    checks.push({
      checkId: 'brand_impersonation',
      name: 'Brand Impersonation Detection',
      category: 'security',
      status: 'FAIL',
      points: 0,
      maxPoints: 15,
      description: `URL impersonates ${impersonatedBrands.length} brand(s): ${impersonatedBrands.join(', ')} - CRITICAL phishing indicator`,
      evidence: { impersonatedBrands, hostname },
      timestamp: new Date()
    });
    points += 30; // VERY HIGH RISK PENALTY for brand impersonation
  } else {
    checks.push({
      checkId: 'brand_impersonation',
      name: 'Brand Impersonation Detection',
      category: 'security',
      status: 'PASS',
      points: 15,
      maxPoints: 15,
      description: 'No brand impersonation detected',
      evidence: { impersonatedBrands: [], hostname },
      timestamp: new Date()
    });
  }

  // Check 2.5.2: Suspicious URL patterns (homoglyphs, excessive subdomain levels)
  const suspiciousPatterns = [
    /\d{10,}/, // 10+ consecutive digits
    /[a-z]{30,}/, // 30+ consecutive letters (random strings)
    /-verify|-secure|-update|-account/i, // Suspicious action words
    /\.(tk|ml|ga|cf|gq|xyz)\//i, // High-risk TLDs in path
  ];

  const foundPatterns = suspiciousPatterns.filter(pattern => pattern.test(urlLower));

  if (foundPatterns.length > 0) {
    checks.push({
      checkId: 'suspicious_url_pattern',
      name: 'Suspicious URL Pattern',
      category: 'technical',
      status: 'WARNING',
      points: 5,
      maxPoints: 10,
      description: `URL contains ${foundPatterns.length} suspicious pattern(s)`,
      evidence: { patternCount: foundPatterns.length },
      timestamp: new Date()
    });
    points += 10;
  } else {
    checks.push({
      checkId: 'suspicious_url_pattern',
      name: 'Suspicious URL Pattern',
      category: 'technical',
      status: 'PASS',
      points: 10,
      maxPoints: 10,
      description: 'No suspicious URL patterns detected',
      evidence: { patternCount: 0 },
      timestamp: new Date()
    });
  }

  // Check 2.5.3: Path contains login/signin/verify (phishing target pages)
  const sensitivePathKeywords = ['login', 'signin', 'verify', 'validate', 'confirm', 'authenticate'];
  const hasSensitivePath = sensitivePathKeywords.some(kw => path.toLowerCase().includes(kw));

  if (hasSensitivePath) {
    checks.push({
      checkId: 'sensitive_path_detected',
      name: 'Sensitive Path Detection',
      category: 'security',
      status: 'WARNING',
      points: 0,
      maxPoints: 5,
      description: 'URL path contains login/signin/verify keywords',
      evidence: { path: path },
      timestamp: new Date()
    });
    points += 5;
  } else {
    checks.push({
      checkId: 'sensitive_path_detected',
      name: 'Sensitive Path Detection',
      category: 'security',
      status: 'PASS',
      points: 5,
      maxPoints: 5,
      description: 'No sensitive keywords in URL path',
      evidence: { path: path },
      timestamp: new Date()
    });
  }

  return {
    categoryName: 'URL Pattern Analysis',
    points,
    maxPoints,
    checks,
    skipped: false
  };
}

/**
 * Category 3: SSL/TLS Security (45 points)
 * Only runs for ONLINE sites with HTTPS
 */
export function runSSLSecurityCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 45;

  // Skip if offline or not HTTPS
  const parsedUrl = new URL(ctx.url);
  if (ctx.reachability !== 'ONLINE' || parsedUrl.protocol !== 'https:' || !ctx.evidence.tls) {
    return {
      categoryName: 'SSL/TLS Security',
      points: 0,
      maxPoints,
      checks: [],
      skipped: true,
      skipReason: ctx.reachability !== 'ONLINE'
        ? 'Site not reachable'
        : parsedUrl.protocol !== 'https:'
        ? 'HTTP only (not HTTPS)'
        : 'TLS data unavailable'
    };
  }

  let points = 0;
  const tls = ctx.evidence.tls;

  // Check 3.1: Certificate validity
  checks.push({
    checkId: 'tls_valid',
    name: 'SSL Certificate Validity',
    category: 'security',
    status: tls.valid ? 'PASS' : 'FAIL',
    points: tls.valid ? 15 : 0,
    maxPoints: 15,
    description: tls.valid
      ? `Valid SSL certificate from ${tls.issuer}`
      : 'Invalid or untrusted SSL certificate',
    evidence: {
      valid: tls.valid,
      issuer: tls.issuer,
      subject: tls.subject
    },
    timestamp: new Date()
  });
  if (!tls.valid) points += 20;

  // Check 3.2: Self-signed certificate
  checks.push({
    checkId: 'tls_self_signed',
    name: 'Self-Signed Certificate Check',
    category: 'security',
    status: tls.selfSigned ? 'FAIL' : 'PASS',
    points: tls.selfSigned ? 0 : 10,
    maxPoints: 10,
    description: tls.selfSigned
      ? 'Certificate is self-signed (not from trusted CA)'
      : 'Certificate from trusted Certificate Authority',
    evidence: { selfSigned: tls.selfSigned, issuer: tls.issuer },
    timestamp: new Date()
  });
  if (tls.selfSigned) points += 15;

  // Check 3.3: Certificate expiry
  const isExpiringSoon = tls.daysUntilExpiry < 30;
  const isExpired = tls.daysUntilExpiry < 0;
  checks.push({
    checkId: 'tls_expiry',
    name: 'Certificate Expiration',
    category: 'security',
    status: isExpired ? 'FAIL' : isExpiringSoon ? 'WARNING' : 'PASS',
    points: isExpired ? 0 : isExpiringSoon ? 5 : 10,
    maxPoints: 10,
    description: isExpired
      ? `Certificate expired ${Math.abs(tls.daysUntilExpiry)} days ago`
      : isExpiringSoon
      ? `Certificate expires in ${tls.daysUntilExpiry} days`
      : `Certificate valid for ${tls.daysUntilExpiry} more days`,
    evidence: {
      validFrom: tls.validFrom,
      validTo: tls.validTo,
      daysUntilExpiry: tls.daysUntilExpiry
    },
    timestamp: new Date()
  });
  if (isExpired) points += 10;

  // Check 3.4: TLS version
  const isModernTLS = tls.tlsVersion === 'TLSv1.3' || tls.tlsVersion === 'TLSv1.2';
  checks.push({
    checkId: 'tls_version',
    name: 'TLS Protocol Version',
    category: 'technical',
    status: isModernTLS ? 'PASS' : 'WARNING',
    points: isModernTLS ? 10 : 5,
    maxPoints: 10,
    description: `Using ${tls.tlsVersion}${isModernTLS ? ' (modern)' : ' (outdated)'}`,
    evidence: { tlsVersion: tls.tlsVersion },
    timestamp: new Date()
  });
  if (!isModernTLS) points += 5;

  return {
    categoryName: 'SSL/TLS Security',
    points,
    maxPoints,
    checks,
    skipped: false
  };
}

/**
 * Category 4: Content Analysis (40 points)
 * Only runs for ONLINE sites with HTML content
 */
export function runContentAnalysisCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 40;

  // Skip if no HTML content
  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html || ctx.evidence.html.length === 0) {
    return {
      categoryName: 'Content Analysis',
      points: 0,
      maxPoints,
      checks: [],
      skipped: true,
      skipReason: ctx.reachability !== 'ONLINE' ? 'Site not reachable' : 'No HTML content available'
    };
  }

  let points = 0;
  const html = ctx.evidence.html.toLowerCase();

  // Check 4.1: Suspicious keywords
  const suspiciousKeywords = ['verify', 'urgent', 'suspended', 'confirm', 'update', 'secure', 'account', 'limited'];
  const foundKeywords = suspiciousKeywords.filter(kw => html.includes(kw));
  const hasSuspiciousKeywords = foundKeywords.length >= 2;

  checks.push({
    checkId: 'content_keywords',
    name: 'Suspicious Content Keywords',
    category: 'security',
    status: hasSuspiciousKeywords ? 'FAIL' : foundKeywords.length > 0 ? 'WARNING' : 'PASS',
    points: hasSuspiciousKeywords ? 0 : foundKeywords.length > 0 ? 5 : 10,
    maxPoints: 10,
    description: hasSuspiciousKeywords
      ? `Multiple suspicious keywords found: ${foundKeywords.join(', ')}`
      : foundKeywords.length > 0
      ? `Suspicious keyword found: ${foundKeywords[0]}`
      : 'No suspicious keywords detected',
    evidence: { keywords: foundKeywords },
    timestamp: new Date()
  });
  if (hasSuspiciousKeywords) points += 10;

  // Check 4.2: External links
  const externalLinksCount = ctx.evidence.dom.links.filter(l => l.external).length;
  const hasExcessiveExternalLinks = externalLinksCount > 20;
  checks.push({
    checkId: 'content_external_links',
    name: 'External Links Analysis',
    category: 'security',
    status: hasExcessiveExternalLinks ? 'WARNING' : 'PASS',
    points: hasExcessiveExternalLinks ? 5 : 10,
    maxPoints: 10,
    description: `${externalLinksCount} external link(s)${hasExcessiveExternalLinks ? ' (excessive)' : ''}`,
    evidence: { externalLinksCount },
    timestamp: new Date()
  });
  if (hasExcessiveExternalLinks) points += 5;

  // Check 4.3: Iframes
  const hasIframes = ctx.evidence.dom.iframes.length > 0;
  checks.push({
    checkId: 'content_iframes',
    name: 'Iframe Detection',
    category: 'security',
    status: hasIframes ? 'WARNING' : 'PASS',
    points: hasIframes ? 5 : 10,
    maxPoints: 10,
    description: hasIframes
      ? `${ctx.evidence.dom.iframes.length} iframe(s) detected - potential clickjacking`
      : 'No iframes detected',
    evidence: { iframeCount: ctx.evidence.dom.iframes.length, iframes: ctx.evidence.dom.iframes },
    timestamp: new Date()
  });
  if (hasIframes) points += 5;

  // Check 4.4: Scripts analysis
  const obfuscatedScripts = ctx.evidence.dom.scripts.filter(s => s.obfuscated).length;
  const hasObfuscation = obfuscatedScripts > 0;
  checks.push({
    checkId: 'content_scripts',
    name: 'JavaScript Obfuscation Check',
    category: 'security',
    status: hasObfuscation ? 'FAIL' : 'PASS',
    points: hasObfuscation ? 0 : 10,
    maxPoints: 10,
    description: hasObfuscation
      ? `${obfuscatedScripts} obfuscated script(s) detected`
      : 'No obfuscated scripts detected',
    evidence: {
      totalScripts: ctx.evidence.dom.scripts.length,
      obfuscatedScripts
    },
    timestamp: new Date()
  });
  if (hasObfuscation) points += 10;

  return {
    categoryName: 'Content Analysis',
    points,
    maxPoints,
    checks,
    skipped: false
  };
}

/**
 * Category 5: Phishing Patterns (50 points)
 */
export function runPhishingPatternsCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 50;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Phishing Patterns', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable or no content' };
  }

  let points = 0;
  const hasPasswordForm = ctx.evidence.dom.forms.some(f => f.inputs.some(i => i.type === 'password'));
  const formOriginMismatch = ctx.evidence.dom.forms.some(f => f.submitsToExternal);

  // Check 5.1: Banking/financial keywords in URL (CRITICAL FOR PHISHING)
  const urlLower = ctx.url.toLowerCase();
  const bankingKeywords = [
    'bank', 'cibc', 'td', 'rbc', 'scotia', 'bmo', 'tangerine',
    'simplii', 'desjardins', 'paypal', 'chase', 'wellsfargo',
    'login', 'signin', 'account', 'verify', 'update', 'secure',
    'banking', 'onlinebanking', 'ebanking', 'netbanking'
  ];

  const foundBankingKeywords = bankingKeywords.filter(kw => urlLower.includes(kw));

  if (foundBankingKeywords.length > 0) {
    checks.push({
      checkId: 'banking_keywords_in_url',
      name: 'Banking Keywords in URL',
      category: 'security',
      status: 'FAIL',
      points: 0,
      maxPoints: 15,
      description: `URL contains banking keywords: ${foundBankingKeywords.join(', ')} - strong phishing indicator`,
      evidence: { keywords: foundBankingKeywords },
      timestamp: new Date()
    });
    points += 25; // HIGH RISK PENALTY
  }

  // Check 5.2: HTTP on login page (NO TLS for sensitive forms)
  const parsedUrl = new URL(ctx.url);
  const isHTTP = parsedUrl.protocol === 'http:';
  if (isHTTP && hasPasswordForm) {
    checks.push({
      checkId: 'http_login_form',
      name: 'Unencrypted Login Form',
      category: 'security',
      status: 'FAIL',
      points: 0,
      maxPoints: 10,
      description: 'Login form on HTTP (not HTTPS) - credentials transmitted in plaintext',
      evidence: { protocol: parsedUrl.protocol, hasPasswordForm },
      timestamp: new Date()
    });
    points += 40; // VERY HIGH RISK PENALTY
  }

  // Check 5.3: Login form with external submission
  checks.push({
    checkId: 'phishing_login_form',
    name: 'Suspicious Login Form Detection',
    category: 'security',
    status: hasPasswordForm && formOriginMismatch ? 'FAIL' : hasPasswordForm ? 'WARNING' : 'PASS',
    points: hasPasswordForm && formOriginMismatch ? 0 : hasPasswordForm ? 15 : 25,
    maxPoints: 25,
    description: hasPasswordForm && formOriginMismatch ? 'Login form submits to external domain (phishing indicator)' : hasPasswordForm ? 'Login form detected' : 'No login forms detected',
    evidence: { hasPasswordForm, formOriginMismatch },
    timestamp: new Date()
  });
  if (hasPasswordForm && formOriginMismatch) points += 25;

  return { categoryName: 'Phishing Patterns', points, maxPoints, checks, skipped: false };
}

/**
 * Category 6: Behavioral Analysis (25 points)
 */
export function runBehavioralCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 25;

  if (ctx.reachability !== 'ONLINE') {
    return { categoryName: 'Behavioral Analysis', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;

  checks.push({
    checkId: 'behavioral_auto_download',
    name: 'Auto-Download Detection',
    category: 'security',
    status: ctx.evidence.autoDownload ? 'FAIL' : 'PASS',
    points: ctx.evidence.autoDownload ? 0 : 15,
    maxPoints: 15,
    description: ctx.evidence.autoDownload ? 'Automatic file download detected (malware risk)' : 'No automatic downloads detected',
    evidence: { autoDownload: ctx.evidence.autoDownload },
    timestamp: new Date()
  });
  if (ctx.evidence.autoDownload) points += 15;

  checks.push({
    checkId: 'behavioral_redirect',
    name: 'Redirect Chain Analysis',
    category: 'security',
    status: ctx.evidence.redirectChain.length > 3 ? 'WARNING' : 'PASS',
    points: ctx.evidence.redirectChain.length > 3 ? 5 : 10,
    maxPoints: 10,
    description: `${ctx.evidence.redirectChain.length} redirect(s) detected`,
    evidence: { redirects: ctx.evidence.redirectChain.length },
    timestamp: new Date()
  });
  if (ctx.evidence.redirectChain.length > 3) points += 5;

  return { categoryName: 'Behavioral Analysis', points, maxPoints, checks, skipped: false };
}

/**
 * Category 7: Trust Graph & Network (30 points)
 */
export function runTrustGraphCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 30;
  let points = 0;

  checks.push({
    checkId: 'trust_asn_reputation',
    name: 'ASN & Hosting Provider Reputation',
    category: 'reputation',
    status: ctx.evidence.asn.reputation === 'bad' ? 'FAIL' : ctx.evidence.asn.reputation === 'neutral' ? 'WARNING' : 'PASS',
    points: ctx.evidence.asn.reputation === 'bad' ? 0 : ctx.evidence.asn.reputation === 'neutral' ? 10 : 15,
    maxPoints: 15,
    description: `ASN: ${ctx.evidence.asn.asn} (${ctx.evidence.asn.organization}) - ${ctx.evidence.asn.reputation} reputation`,
    evidence: { asn: ctx.evidence.asn },
    timestamp: new Date()
  });
  if (ctx.evidence.asn.reputation === 'bad') points += 15;

  checks.push({
    checkId: 'trust_hosting_type',
    name: 'Hosting Infrastructure Type',
    category: 'technical',
    status: ctx.evidence.asn.isHosting ? 'WARNING' : 'PASS',
    points: ctx.evidence.asn.isHosting ? 7 : 15,
    maxPoints: 15,
    description: ctx.evidence.asn.isHosting ? 'Hosted on shared/bulletproof hosting' : 'Standard hosting infrastructure',
    evidence: { isHosting: ctx.evidence.asn.isHosting, isCDN: ctx.evidence.asn.isCDN },
    timestamp: new Date()
  });
  if (ctx.evidence.asn.isHosting) points += 8;

  return { categoryName: 'Trust Graph & Network', points, maxPoints, checks, skipped: false };
}

/**
 * Category 8: Malware Detection (45 points)
 */
export function runMalwareDetectionCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 45;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Malware Detection', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;

  // Check: Script obfuscation
  const obfuscatedScripts = ctx.evidence.dom.scripts.filter(s => s.obfuscated).length;
  checks.push({
    checkId: 'malware_obfuscation',
    name: 'JavaScript Obfuscation Detection',
    category: 'security',
    status: obfuscatedScripts > 0 ? 'FAIL' : 'PASS',
    points: obfuscatedScripts > 0 ? 0 : 20,
    maxPoints: 20,
    description: obfuscatedScripts > 0 ? `${obfuscatedScripts} obfuscated scripts detected` : 'No script obfuscation detected',
    evidence: { obfuscatedScripts, totalScripts: ctx.evidence.dom.scripts.length },
    timestamp: new Date()
  });
  if (obfuscatedScripts > 0) points += 20;

  // Check: Suspicious external requests
  const suspiciousRequests = ctx.evidence.har.suspiciousRequests.length;
  checks.push({
    checkId: 'malware_suspicious_requests',
    name: 'Suspicious Network Requests',
    category: 'security',
    status: suspiciousRequests > 0 ? 'WARNING' : 'PASS',
    points: suspiciousRequests > 0 ? 10 : 25,
    maxPoints: 25,
    description: suspiciousRequests > 0 ? `${suspiciousRequests} suspicious network request(s)` : 'No suspicious network activity',
    evidence: { suspiciousRequests: ctx.evidence.har.suspiciousRequests },
    timestamp: new Date()
  });
  if (suspiciousRequests > 0) points += 10;

  return { categoryName: 'Malware Detection', points, maxPoints, checks, skipped: false };
}

/**
 * Category 9: Social Engineering (30 points)
 */
export function runSocialEngineeringCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 30;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Social Engineering', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;
  const html = ctx.evidence.html.toLowerCase();

  // Check: Urgency keywords
  const urgencyKeywords = ['urgent', 'immediately', 'expire', 'suspended', 'limited time', 'act now'];
  const foundUrgency = urgencyKeywords.filter(kw => html.includes(kw));

  checks.push({
    checkId: 'social_urgency',
    name: 'Urgency & Pressure Tactics',
    category: 'security',
    status: foundUrgency.length >= 2 ? 'FAIL' : foundUrgency.length > 0 ? 'WARNING' : 'PASS',
    points: foundUrgency.length >= 2 ? 0 : foundUrgency.length > 0 ? 10 : 30,
    maxPoints: 30,
    description: foundUrgency.length > 0
      ? `Urgency tactics detected: ${foundUrgency.join(', ')}`
      : 'No urgency/pressure tactics detected',
    evidence: { urgencyKeywords: foundUrgency },
    timestamp: new Date()
  });
  if (foundUrgency.length >= 2) points += 20;
  else if (foundUrgency.length > 0) points += 10;

  return { categoryName: 'Social Engineering', points, maxPoints, checks, skipped: false };
}

/**
 * Category 10: Security Headers (25 points)
 */
export function runSecurityHeadersCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 25;

  if (ctx.reachability !== 'ONLINE') {
    return { categoryName: 'Security Headers', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;

  // Check: HSTS header
  const hasHSTS = ctx.evidence.dom.metaTags['strict-transport-security'] !== undefined;
  checks.push({
    checkId: 'headers_hsts',
    name: 'HTTP Strict Transport Security (HSTS)',
    category: 'security',
    status: hasHSTS ? 'PASS' : 'WARNING',
    points: hasHSTS ? 10 : 5,
    maxPoints: 10,
    description: hasHSTS ? 'HSTS header present (forces HTTPS)' : 'HSTS header missing (security risk)',
    evidence: { hasHSTS },
    timestamp: new Date()
  });
  if (!hasHSTS) points += 5;

  // Check: X-Frame-Options
  const hasXFrameOptions = ctx.evidence.dom.metaTags['x-frame-options'] !== undefined;
  checks.push({
    checkId: 'headers_xframe',
    name: 'X-Frame-Options (Clickjacking Protection)',
    category: 'security',
    status: hasXFrameOptions ? 'PASS' : 'WARNING',
    points: hasXFrameOptions ? 15 : 7,
    maxPoints: 15,
    description: hasXFrameOptions ? 'Clickjacking protection enabled' : 'No clickjacking protection',
    evidence: { hasXFrameOptions },
    timestamp: new Date()
  });
  if (!hasXFrameOptions) points += 8;

  return { categoryName: 'Security Headers', points, maxPoints, checks, skipped: false };
}

/**
 * Category 11: DNS & Email Security (25 points)
 */
export function runEmailSecurityCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 25;
  let points = 0;

  // Check: MX records
  const hasMX = ctx.evidence.dns.mxRecords.length > 0;
  checks.push({
    checkId: 'email_mx_records',
    name: 'Mail Exchange (MX) Records',
    category: 'technical',
    status: hasMX ? 'PASS' : 'INFO',
    points: hasMX ? 10 : 10,
    maxPoints: 10,
    description: hasMX ? `${ctx.evidence.dns.mxRecords.length} MX record(s) configured` : 'No email service configured',
    evidence: { mxRecords: ctx.evidence.dns.mxRecords },
    timestamp: new Date()
  });

  // Check: SPF
  checks.push({
    checkId: 'email_spf',
    name: 'SPF (Sender Policy Framework)',
    category: 'technical',
    status: ctx.evidence.dns.spfValid ? 'PASS' : hasMX ? 'WARNING' : 'INFO',
    points: ctx.evidence.dns.spfValid ? 15 : hasMX ? 7 : 15,
    maxPoints: 15,
    description: ctx.evidence.dns.spfValid ? 'SPF record configured (anti-spoofing)' : hasMX ? 'SPF missing (emails can be spoofed)' : 'No email service',
    evidence: { spfValid: ctx.evidence.dns.spfValid, hasMX },
    timestamp: new Date()
  });
  if (hasMX && !ctx.evidence.dns.spfValid) points += 8;

  return { categoryName: 'Email Security (DMARC)', points, maxPoints, checks, skipped: false };
}

/**
 * Category 12: Data Protection & Privacy (50 points)
 */
export function runDataProtectionCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 50;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Data Protection & Privacy', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;
  const html = ctx.evidence.html.toLowerCase();

  // Check: Privacy policy
  const hasPrivacyPolicy = html.includes('privacy policy') || html.includes('privacy notice');
  checks.push({
    checkId: 'privacy_policy',
    name: 'Privacy Policy Presence',
    category: 'legitimacy',
    status: hasPrivacyPolicy ? 'PASS' : 'WARNING',
    points: hasPrivacyPolicy ? 25 : 10,
    maxPoints: 25,
    description: hasPrivacyPolicy ? 'Privacy policy found' : 'No privacy policy detected',
    evidence: { hasPrivacyPolicy },
    timestamp: new Date()
  });
  if (!hasPrivacyPolicy) points += 15;

  // Check: Cookie consent
  const hasCookieConsent = html.includes('cookie') && (html.includes('accept') || html.includes('consent'));
  checks.push({
    checkId: 'cookie_consent',
    name: 'Cookie Consent Banner',
    category: 'legitimacy',
    status: hasCookieConsent ? 'PASS' : 'INFO',
    points: hasCookieConsent ? 25 : 15,
    maxPoints: 25,
    description: hasCookieConsent ? 'Cookie consent mechanism present' : 'No cookie consent detected',
    evidence: { hasCookieConsent },
    timestamp: new Date()
  });
  if (!hasCookieConsent) points += 10;

  return { categoryName: 'Data Protection & Privacy', points, maxPoints, checks, skipped: false };
}

/**
 * Category 13: Financial Fraud (25 points)
 */
export function runFinancialFraudCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 25;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Financial Fraud', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;
  const html = ctx.evidence.html.toLowerCase();

  // Check: Financial keywords
  const financialKeywords = ['bitcoin', 'crypto', 'wallet', 'payment', 'wire transfer', 'bank account', 'credit card'];
  const foundFinancial = financialKeywords.filter(kw => html.includes(kw));

  checks.push({
    checkId: 'financial_keywords',
    name: 'Financial/Payment Keywords Detection',
    category: 'security',
    status: foundFinancial.length >= 3 ? 'WARNING' : foundFinancial.length > 0 ? 'INFO' : 'PASS',
    points: foundFinancial.length >= 3 ? 10 : 25,
    maxPoints: 25,
    description: foundFinancial.length > 0
      ? `Financial keywords found: ${foundFinancial.join(', ')}`
      : 'No financial keywords detected',
    evidence: { financialKeywords: foundFinancial },
    timestamp: new Date()
  });
  if (foundFinancial.length >= 3) points += 15;

  return { categoryName: 'Financial Fraud', points, maxPoints, checks, skipped: false };
}

/**
 * Category 14: Identity Theft (20 points)
 */
export function runIdentityTheftCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 20;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Identity Theft', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;

  // Check: File upload forms (ID/passport upload risk)
  const hasFileUpload = ctx.evidence.dom.forms.some(f =>
    f.inputs.some(i => i.type === 'file')
  );

  checks.push({
    checkId: 'identity_file_upload',
    name: 'File Upload Forms (ID/Document Risk)',
    category: 'security',
    status: hasFileUpload ? 'WARNING' : 'PASS',
    points: hasFileUpload ? 10 : 20,
    maxPoints: 20,
    description: hasFileUpload
      ? 'File upload detected - potential identity document harvesting'
      : 'No file upload forms detected',
    evidence: { hasFileUpload },
    timestamp: new Date()
  });
  if (hasFileUpload) points += 10;

  return { categoryName: 'Identity Theft', points, maxPoints, checks, skipped: false };
}

/**
 * Category 15: Technical Exploits (15 points)
 */
export function runTechnicalExploitsCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 15;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Technical Exploits', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;
  const html = ctx.evidence.html.toLowerCase();

  // Check: Suspicious script patterns
  const exploitPatterns = ['eval(', 'unescape(', 'fromcharcode', 'document.write('];
  const foundExploits = exploitPatterns.filter(pattern => html.includes(pattern));

  checks.push({
    checkId: 'exploits_suspicious_code',
    name: 'Suspicious Code Patterns',
    category: 'security',
    status: foundExploits.length > 0 ? 'FAIL' : 'PASS',
    points: foundExploits.length > 0 ? 0 : 15,
    maxPoints: 15,
    description: foundExploits.length > 0
      ? `Exploit patterns detected: ${foundExploits.join(', ')}`
      : 'No suspicious code patterns detected',
    evidence: { exploitPatterns: foundExploits },
    timestamp: new Date()
  });
  if (foundExploits.length > 0) points += 15;

  return { categoryName: 'Technical Exploits', points, maxPoints, checks, skipped: false };
}

/**
 * Category 16: Legal & Compliance (35 points)
 */
export function runLegalComplianceCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 35;

  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Legal & Compliance', points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  let points = 0;
  const html = ctx.evidence.html.toLowerCase();

  // Check: Terms of service
  const hasTerms = html.includes('terms of service') || html.includes('terms and conditions');
  checks.push({
    checkId: 'legal_terms',
    name: 'Terms of Service',
    category: 'legitimacy',
    status: hasTerms ? 'PASS' : 'WARNING',
    points: hasTerms ? 20 : 10,
    maxPoints: 20,
    description: hasTerms ? 'Terms of service found' : 'No terms of service detected',
    evidence: { hasTerms },
    timestamp: new Date()
  });
  if (!hasTerms) points += 10;

  // Check: Contact information
  const hasContact = html.includes('contact') && (html.includes('email') || html.includes('phone'));
  checks.push({
    checkId: 'legal_contact',
    name: 'Contact Information',
    category: 'legitimacy',
    status: hasContact ? 'PASS' : 'WARNING',
    points: hasContact ? 15 : 7,
    maxPoints: 15,
    description: hasContact ? 'Contact information available' : 'No contact information found',
    evidence: { hasContact },
    timestamp: new Date()
  });
  if (!hasContact) points += 8;

  return { categoryName: 'Legal & Compliance', points, maxPoints, checks, skipped: false };
}

/**
 * Execute all applicable categories based on reachability
 */
export function executeCategories(ctx: CategoryExecutionContext): {
  results: CategoryResult[];
  totalPoints: number;
  totalPossible: number;
  allChecks: GranularCheckResult[];
} {
  const results: CategoryResult[] = [];

  // Always run these regardless of reachability (175 points)
  results.push(runThreatIntelCategory(ctx));          // 50 pts
  results.push(runDomainAnalysisCategory(ctx));       // 40 pts
  results.push(runURLPatternAnalysisCategory(ctx));   // 30 pts - CRITICAL FOR OFFLINE PHISHING
  results.push(runTrustGraphCategory(ctx));           // 30 pts
  results.push(runEmailSecurityCategory(ctx));        // 25 pts

  // Conditional categories based on reachability (450 points)
  if (ctx.reachability === 'ONLINE') {
    // ALL categories with REAL implementations - NO PLACEHOLDERS
    results.push(runSSLSecurityCategory(ctx));          // 45 pts - TLS certificate validation
    results.push(runContentAnalysisCategory(ctx));      // 40 pts - HTML/DOM/script analysis
    results.push(runPhishingPatternsCategory(ctx));     // 50 pts - Login forms/brand checks
    results.push(runBehavioralCategory(ctx));           // 25 pts - Auto-download/redirect detection
    results.push(runMalwareDetectionCategory(ctx));     // 45 pts - Script obfuscation/suspicious requests
    results.push(runSocialEngineeringCategory(ctx));    // 30 pts - Urgency/pressure tactics
    results.push(runDataProtectionCategory(ctx));       // 50 pts - Privacy policy/cookie consent
    results.push(runSecurityHeadersCategory(ctx));      // 25 pts - HSTS/X-Frame-Options
    results.push(runFinancialFraudCategory(ctx));       // 25 pts - Financial keyword detection
    results.push(runIdentityTheftCategory(ctx));        // 20 pts - File upload/ID harvesting
    results.push(runTechnicalExploitsCategory(ctx));    // 15 pts - Exploit pattern detection
    results.push(runLegalComplianceCategory(ctx));      // 35 pts - Terms/contact info
  }

  // Calculate totals
  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const totalPossible = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const allChecks = results.flatMap(r => r.checks);

  return {
    results,
    totalPoints,
    totalPossible,
    allChecks
  };
}
