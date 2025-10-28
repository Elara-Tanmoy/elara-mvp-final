/**
 * Category 2.5: URL Pattern Analysis (65 points - INCREASED from 30)
 * CRITICAL: Runs for ALL reachability states (OFFLINE phishing detection)
 * Checks URL structure for phishing indicators WITHOUT needing page content
 */
export function runURLPatternAnalysisCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  let categoryPoints = 0;
  const maxPoints = 65;

  const urlLower = ctx.url.toLowerCase();
  const parsedUrl = new URL(ctx.url);
  const hostname = parsedUrl.hostname;
  const path = parsedUrl.pathname;

  console.log(`[URL Pattern Analysis] Analyzing URL: ${ctx.url}`);
  console.log(`[URL Pattern Analysis] Hostname: ${hostname}, Path: ${path}`);

  // NEW CHECK: Subdomain TLD Impersonation (35 pts penalty)
  // Detects: paypal-com.example.com, wwnorton-com.vercel.app, microsoft-secure.phish.net
  const subdomainParts = hostname.split('.');
  if (subdomainParts.length > 2) {
    const subdomain = subdomainParts[0];

    // Pattern: Contains "-com", "-net", "-org", "-co" (mimicking TLD)
    if (/-com$|-net$|-org$|-co$/.test(subdomain)) {
      console.log(`[URL Pattern Analysis] CRITICAL: Subdomain TLD impersonation detected: "${subdomain}"`);
      checks.push({
        checkId: 'subdomain_tld_impersonation',
        name: 'Subdomain TLD Impersonation',
        category: 'security',
        status: 'FAIL',
        points: 0,
        maxPoints: 35,
        description: `Suspicious subdomain "${subdomain}" mimicking TLD - common phishing tactic`,
        evidence: { subdomain, hostname, pattern: 'TLD in subdomain' },
        timestamp: new Date()
      });
      categoryPoints += 35;
    }
  }

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
    // Security/Antivirus (ADD NORTON!)
    { keyword: 'norton', official: ['norton.com', 'nortonlifelock.com'] },
    { keyword: 'mcafee', official: ['mcafee.com'] },
    // Crypto
    { keyword: 'coinbase', official: ['coinbase.com'] },
    { keyword: 'binance', official: ['binance.com'] }
  ];

  const impersonatedBrands: string[] = [];
  const hostnameLower = hostname.toLowerCase();

  for (const brand of brandKeywords) {
    // ONLY check hostname (not full URL) to avoid false positives from path/query
    if (hostnameLower.includes(brand.keyword)) {
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
    categoryPoints += 30; // VERY HIGH RISK PENALTY for brand impersonation
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

  // NEW CHECK: Brand Keywords in Path (40 pts penalty)
  // Detects: /norton-02/error.html, /paypal/login, /amazon-verify
  const pathBrands = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook',
                'netflix', 'norton', 'mcafee', 'chase', 'bankofamerica', 'wellsfargo',
                'ebay', 'instagram', 'linkedin', 'twitter', 'dropbox', 'adobe'];

  const pathLower = path.toLowerCase();
  const brandInPath = pathBrands.find(brand => pathLower.includes(brand));

  if (brandInPath) {
    // Check if brand is NOT in the actual domain
    const domainHasBrand = hostnameLower.includes(brandInPath);

    if (!domainHasBrand) {
      console.log(`[URL Pattern Analysis] CRITICAL: Brand "${brandInPath}" in path but NOT in domain`);
      checks.push({
        checkId: 'brand_in_path_not_domain',
        name: 'Brand in Path but Not Domain',
        category: 'security',
        status: 'FAIL',
        points: 0,
        maxPoints: 40,
        description: `Path contains "${brandInPath}" but domain doesn't - likely phishing attempt`,
        evidence: { brandInPath, path, hostname, domainHasBrand: false },
        timestamp: new Date()
      });
      categoryPoints += 40;
    }
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
    categoryPoints += 10;
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

  // NEW CHECK: Phishing Path Keywords (15 pts max, 5 pts penalty)
  const phishingPaths = ['/login', '/verify', '/secure', '/account', '/update',
                         '/confirm', '/suspended', '/locked', '/error', '/support'];

  const hasPhishingPath = phishingPaths.some(p => pathLower.includes(p));
  if (hasPhishingPath) {
    const matchedPaths = phishingPaths.filter(p => pathLower.includes(p));
    console.log(`[URL Pattern Analysis] WARNING: Phishing path keywords detected: ${matchedPaths.join(', ')}`);
    checks.push({
      checkId: 'phishing_path_keywords',
      name: 'Phishing Path Keywords',
      category: 'security',
      status: 'WARN',
      points: 10,
      maxPoints: 15,
      description: `URL path contains suspicious keywords: ${matchedPaths.join(', ')}`,
      evidence: { matchedPaths, path },
      timestamp: new Date()
    });
    categoryPoints += 5;
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
    categoryPoints += 5;
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

  // Calculate earnedPoints and possiblePoints
  const earnedPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const possiblePoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    categoryName: 'URL Pattern Analysis',
    points: categoryPoints,
    maxPoints,
    earnedPoints,
    possiblePoints,
    checks,
    skipped: false
  };
}
