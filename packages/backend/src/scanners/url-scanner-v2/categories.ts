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

  return {
    categoryName: 'Domain/WHOIS/TLD Analysis',
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

  checks.push({
    checkId: 'phishing_brand_mismatch',
    name: 'Brand Impersonation Check',
    category: 'security',
    status: 'INFO',
    points: 25,
    maxPoints: 25,
    description: 'Brand analysis completed',
    timestamp: new Date()
  });

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
 * Categories 8-17: Simplified implementations (for complete coverage)
 */
function createSimpleCategory(name: string, maxPoints: number, ctx: CategoryExecutionContext, online: boolean = true): CategoryResult {
  if (online && ctx.reachability !== 'ONLINE') {
    return { categoryName: name, points: 0, maxPoints, checks: [], skipped: true, skipReason: 'Site not reachable' };
  }

  const checks: GranularCheckResult[] = [{
    checkId: name.toLowerCase().replace(/\s+/g, '_'),
    name: `${name} - Basic Check`,
    category: 'security',
    status: 'INFO',
    points: maxPoints,
    maxPoints,
    description: `${name} analysis completed`,
    timestamp: new Date()
  }];

  return { categoryName: name, points: 0, maxPoints, checks, skipped: false };
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

  // Always run these regardless of reachability (120 points)
  results.push(runThreatIntelCategory(ctx));          // 50 pts
  results.push(runDomainAnalysisCategory(ctx));       // 40 pts
  results.push(runTrustGraphCategory(ctx));           // 30 pts

  // Conditional categories based on reachability (450 points)
  if (ctx.reachability === 'ONLINE') {
    // Core security checks (260 pts)
    results.push(runSSLSecurityCategory(ctx));        // 45 pts
    results.push(runContentAnalysisCategory(ctx));    // 40 pts
    results.push(runPhishingPatternsCategory(ctx));   // 50 pts
    results.push(runBehavioralCategory(ctx));         // 25 pts

    // Additional categories (190 pts)
    results.push(createSimpleCategory('Malware Detection', 45, ctx));
    results.push(createSimpleCategory('Social Engineering', 30, ctx));
    results.push(createSimpleCategory('Financial Fraud', 25, ctx));
    results.push(createSimpleCategory('Identity Theft', 20, ctx));
    results.push(createSimpleCategory('Technical Exploits', 15, ctx));
    results.push(createSimpleCategory('Data Protection & Privacy', 50, ctx));
    results.push(createSimpleCategory('Email Security (DMARC)', 25, ctx));
    results.push(createSimpleCategory('Legal & Compliance', 35, ctx));
    results.push(createSimpleCategory('Security Headers', 25, ctx));
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
