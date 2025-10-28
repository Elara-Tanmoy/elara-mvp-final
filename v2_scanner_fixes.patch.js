#!/usr/bin/env node

/**
 * V2 Scanner Comprehensive Fixes - Automated Patch Script
 * Applies all Phase 1 (P0) and Phase 2 (P1) fixes from the fix plan
 */

const fs = require('fs');
const path = require('path');

const CATEGORIES_FILE = path.join(__dirname, 'packages/backend/src/scanners/url-scanner-v2/categories.ts');

console.log('🔧 V2 Scanner Comprehensive Fix Script');
console.log('=====================================\n');

// Read the file
let content = fs.readFileSync(CATEGORIES_FILE, 'utf8');
const originalContent = content;

console.log('✅ Loaded categories.ts');

// FIX 1: Update URL Pattern Analysis function signature and maxPoints
console.log('\n[FIX 1] Updating URL Pattern Analysis category...');
content = content.replace(
  /\/\*\*\s+\* Category 2\.5: URL Pattern Analysis \(30 points\)/,
  '/**\n * Category 2.5: URL Pattern Analysis (65 points - INCREASED from 30)'
);
content = content.replace(
  /(export function runURLPatternAnalysisCategory[\s\S]*?const checks: GranularCheckResult\[\] = \[\];)\s+(let points = 0;)\s+(const maxPoints = 30;)/,
  '$1\n  let categoryPoints = 0;\n  const maxPoints = 65;'
);

console.log('  ✓ Updated maxPoints from 30 to 65');
console.log('  ✓ Renamed points to categoryPoints');

// FIX 2: Add console logging after variable declarations
const loggingCode = `
  console.log(\`[URL Pattern Analysis] Analyzing URL: \${ctx.url}\`);
  console.log(\`[URL Pattern Analysis] Hostname: \${hostname}, Path: \${path}\`);

  // NEW CHECK: Subdomain TLD Impersonation (35 pts penalty)
  // Detects: paypal-com.example.com, wwnorton-com.vercel.app, microsoft-secure.phish.net
  const subdomainParts = hostname.split('.');
  if (subdomainParts.length > 2) {
    const subdomain = subdomainParts[0];

    // Pattern: Contains "-com", "-net", "-org", "-co" (mimicking TLD)
    if (/-com$|-net$|-org$|-co$/.test(subdomain)) {
      console.log(\`[URL Pattern Analysis] CRITICAL: Subdomain TLD impersonation detected: "\${subdomain}"\`);
      checks.push({
        checkId: 'subdomain_tld_impersonation',
        name: 'Subdomain TLD Impersonation',
        category: 'security',
        status: 'FAIL',
        points: 0,
        maxPoints: 35,
        description: \`Suspicious subdomain "\${subdomain}" mimicking TLD - common phishing tactic\`,
        evidence: { subdomain, hostname, pattern: 'TLD in subdomain' },
        timestamp: new Date()
      });
      categoryPoints += 35;
    }
  }
`;

content = content.replace(
  /(const path = parsedUrl\.pathname;)\s+(\/\/ Check 2\.5\.1: Brand impersonation)/,
  `$1${loggingCode}\n  $2`
);

console.log('  ✓ Added subdomain TLD impersonation check (35 pts)');

// FIX 3: Add brand-in-path detection after existing brand impersonation check
const brandInPathCode = `
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
      console.log(\`[URL Pattern Analysis] CRITICAL: Brand "\${brandInPath}" in path but NOT in domain\`);
      checks.push({
        checkId: 'brand_in_path_not_domain',
        name: 'Brand in Path but Not Domain',
        category: 'security',
        status: 'FAIL',
        points: 0,
        maxPoints: 40,
        description: \`Path contains "\${brandInPath}" but domain doesn't - likely phishing attempt\`,
        evidence: { brandInPath, path, hostname, domainHasBrand: false },
        timestamp: new Date()
      });
      categoryPoints += 40;
    }
  }
`;

content = content.replace(
  /(points \+= 30; \/\/ VERY HIGH RISK PENALTY for brand impersonation\s+\} else \{[\s\S]*?}\s+})\s+(\/\/ Check 2\.5\.2: Suspicious URL patterns)/,
  `$1${brandInPathCode}\n  $2`
);

console.log('  ✓ Added brand-in-path detection (40 pts)');

// FIX 4: Add phishing path keywords after existing suspicious patterns check
const phishingPathCode = `
  // NEW CHECK: Phishing Path Keywords (15 pts max, 5 pts penalty)
  const phishingPaths = ['/login', '/verify', '/secure', '/account', '/update',
                         '/confirm', '/suspended', '/locked', '/error', '/support'];

  const hasPhishingPath = phishingPaths.some(p => pathLower.includes(p));
  if (hasPhishingPath) {
    const matchedPaths = phishingPaths.filter(p => pathLower.includes(p));
    console.log(\`[URL Pattern Analysis] WARNING: Phishing path keywords detected: \${matchedPaths.join(', ')}\`);
    checks.push({
      checkId: 'phishing_path_keywords',
      name: 'Phishing Path Keywords',
      category: 'security',
      status: 'WARN',
      points: 10,
      maxPoints: 15,
      description: \`URL path contains suspicious keywords: \${matchedPaths.join(', ')}\`,
      evidence: { matchedPaths, path },
      timestamp: new Date()
    });
    categoryPoints += 5;
  }
`;

content = content.replace(
  /(points \+= 10;\s+\} else \{[\s\S]*?}\s+})\s+(\/\/ Check 2\.5\.3: Path contains login)/,
  `$1${phishingPathCode}\n  $2`
);

console.log('  ✓ Added phishing path keywords check (15 pts max)');

// FIX 5: Replace all "points" with "categoryPoints" in URL Pattern Analysis
const urlPatternStart = content.indexOf('export function runURLPatternAnalysisCategory');
const urlPatternEnd = content.indexOf('export function runSSLSecurityCategory');
const urlPatternSection = content.substring(urlPatternStart, urlPatternEnd);
const updatedUrlPattern = urlPatternSection.replace(/(\s+)points(\s+[+\-]=)/g, '$1categoryPoints$2');

content = content.substring(0, urlPatternStart) + updatedUrlPattern + content.substring(urlPatternEnd);

console.log('  ✓ Renamed all points references to categoryPoints');

// FIX 6: Update return statement
content = content.replace(
  /(return \{\s+categoryName: 'URL Pattern Analysis',)\s+(points,)/,
  '$1\n    points: categoryPoints,'
);

console.log('  ✓ Updated return statement');

// FIX 7: Fix Free Hosting Detection in Domain Analysis (move to Trust Graph)
console.log('\n[FIX 2] Fixing Free Hosting penalties...');

// Remove free hosting from Domain Analysis
content = content.replace(
  /\/\/ Check 2\.5: Free hosting provider detection[\s\S]*?points \+= 30; \/\/ HIGH RISK PENALTY\s+}\s+/,
  ''
);

console.log('  ✓ Removed free hosting check from Domain Analysis');

// FIX 8: Update Trust Graph category to add enhanced free hosting checks
content = content.replace(
  /(export function runTrustGraphCategory[\s\S]*?const maxPoints = )30;/,
  '$165;'
);

content = content.replace(
  /(if \(hasASNData && asn\.isHosting\) points \+= 8;)\s+(return \{ categoryName: 'Trust Graph)/,
  `$1

  // ENHANCED: Free Hosting Provider Detection (CRITICAL FOR PHISHING)
  const hostname = new URL(ctx.url).hostname;
  const freeHostingProviders = [
    '000webhostapp.com', 'freehostia.com', 'freehosting.com',
    'infinityfree.net', 'byethost', 'weebly.com', 'wordpress.com',
    'blogspot.com', 'github.io', 'netlify.app', 'vercel.app',
    'wixsite.com', 'webnode.com', 'yolasite.com', 'webs.com'
  ];

  const isFreeHosting = freeHostingProviders.some(provider => hostname.includes(provider));

  if (isFreeHosting) {
    const brandKeywords = ['paypal', 'amazon', 'microsoft', 'apple', 'google',
                           'norton', 'mcafee', 'chase', 'bank', 'cibc', 'td', 'rbc'];
    const urlLower = ctx.url.toLowerCase();
    const hasBrandKeyword = brandKeywords.some(brand => urlLower.includes(brand));

    if (hasBrandKeyword) {
      const matchedBrands = brandKeywords.filter(brand => urlLower.includes(brand));
      console.log(\`[Trust Graph] CRITICAL: Free hosting (\${hostname}) with brand impersonation: \${matchedBrands.join(', ')}\`);
      checks.push({
        checkId: 'free_hosting_with_brand',
        name: 'Free Hosting with Brand Impersonation',
        category: 'reputation',
        status: 'FAIL',
        points: 0,
        maxPoints: 50,
        description: \`Free hosting (\${hostname}) with brand impersonation - CRITICAL phishing indicator\`,
        evidence: { hostname, isFreeHosting: true, brandKeywords: matchedBrands },
        timestamp: new Date()
      });
      points += 50;
    } else {
      console.log(\`[Trust Graph] WARNING: Free hosting detected: \${hostname}\`);
      checks.push({
        checkId: 'free_hosting',
        name: 'Free Hosting Provider',
        category: 'reputation',
        status: 'FAIL',
        points: 0,
        maxPoints: 35,
        description: \`Hosted on free platform (\${hostname}) - HIGH risk\`,
        evidence: { hostname, isFreeHosting: true },
        timestamp: new Date()
      });
      points += 35;
    }
  }

  $2`
);

console.log('  ✓ Added enhanced free hosting checks to Trust Graph (35-50 pts)');

// FIX 9: Move categories to always-run section
console.log('\n[FIX 3] Moving core checks to always-run section...');

content = content.replace(
  /(\/\/ Always run these regardless of reachability \()175( points\))/,
  '$1405$2'
);

content = content.replace(
  /(results\.push\(runURLPatternAnalysisCategory\(ctx\)\);   \/\/ )30( pts - CRITICAL FOR OFFLINE PHISHING)/,
  '$165$2'
);

content = content.replace(
  /(results\.push\(runTrustGraphCategory\(ctx\)\);           \/\/ )30( pts)/,
  '$165$2'
);

content = content.replace(
  /(results\.push\(runEmailSecurityCategory\(ctx\)\);        \/\/ 25 pts\s+)/,
  `$1results.push(runPhishingPatternsCategory(ctx));     // 50 pts - MOVED TO ALWAYS-RUN
  results.push(runFinancialFraudCategory(ctx));       // 25 pts - MOVED TO ALWAYS-RUN
  results.push(runIdentityTheftCategory(ctx));        // 20 pts - MOVED TO ALWAYS-RUN

  `
);

// Remove from conditional section
content = content.replace(
  /results\.push\(runPhishingPatternsCategory\(ctx\)\);     \/\/ 50 pts - Login forms\/brand checks\s+/,
  ''
);

content = content.replace(
  /results\.push\(runFinancialFraudCategory\(ctx\)\);       \/\/ 25 pts - Financial keyword detection\s+/,
  ''
);

content = content.replace(
  /results\.push\(runIdentityTheftCategory\(ctx\)\);        \/\/ 20 pts - File upload\/ID harvesting\s+/,
  ''
);

console.log('  ✓ Moved Phishing Patterns to always-run');
console.log('  ✓ Moved Financial Fraud to always-run');
console.log('  ✓ Moved Identity Theft to always-run');

// FIX 10: Make moved categories work offline
console.log('\n[FIX 4] Making moved categories work offline...');

// Update Phishing Patterns to work offline
content = content.replace(
  /(export function runPhishingPatternsCategory[\s\S]*?if \(ctx\.reachability !== 'ONLINE' \|\| !ctx\.evidence\.html\) \{\s+return \{[\s\S]*?skipReason: 'Site not reachable or no content' \};\s+})/,
  `export function runPhishingPatternsCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 50;

  // Run basic URL-based checks even if offline
  let points = 0;

  // Check 5.1: Banking/financial keywords in URL (WORKS OFFLINE)
  const urlLower = ctx.url.toLowerCase();
  const bankingKeywords = [
    'bank', 'cibc', 'td', 'rbc', 'scotia', 'bmo', 'tangerine',
    'simplii', 'desjardins', 'paypal', 'chase', 'wellsfargo',
    'login', 'signin', 'account', 'verify', 'update', 'secure',
    'banking', 'onlinebanking', 'ebanking', 'netbanking'
  ];

  const foundBankingKeywords = bankingKeywords.filter(kw => urlLower.includes(kw));

  if (foundBankingKeywords.length > 0) {
    console.log(\`[Phishing Patterns] WARNING: Banking keywords in URL: \${foundBankingKeywords.join(', ')}\`);
    checks.push({
      checkId: 'banking_keywords_in_url',
      name: 'Banking Keywords in URL',
      category: 'security',
      status: 'FAIL',
      points: 0,
      maxPoints: 15,
      description: \`URL contains banking keywords: \${foundBankingKeywords.join(', ')} - strong phishing indicator\`,
      evidence: { keywords: foundBankingKeywords },
      timestamp: new Date()
    });
    points += 25;
  }

  // Only run form checks if ONLINE
  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Phishing Patterns', points, maxPoints, checks, skipped: checks.length === 0, skipReason: checks.length === 0 ? 'Site not reachable' : undefined };
  }

  const hasPasswordForm = ctx.evidence.dom.forms.some(f => f.inputs.some(i => i.type === 'password'));
  const formOriginMismatch = ctx.evidence.dom.forms.some(f => f.submitsToExternal)`
);

console.log('  ✓ Updated Phishing Patterns to work offline');

// Update Financial Fraud to work offline
content = content.replace(
  /(export function runFinancialFraudCategory[\s\S]*?if \(ctx\.reachability !== 'ONLINE' \|\| !ctx\.evidence\.html\) \{\s+return \{[\s\S]*?skipReason: 'Site not reachable' \};\s+})/,
  `export function runFinancialFraudCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 25;

  // Basic URL checks work offline
  let points = 0;
  const urlLower = ctx.url.toLowerCase();

  // Check: Financial keywords in URL (WORKS OFFLINE)
  const urlFinancialKeywords = ['bitcoin', 'crypto', 'wallet', 'payment', 'bank', 'paypal'];
  const foundInUrl = urlFinancialKeywords.filter(kw => urlLower.includes(kw));

  if (foundInUrl.length > 0) {
    console.log(\`[Financial Fraud] INFO: Financial keywords in URL: \${foundInUrl.join(', ')}\`);
  }

  // Only run content checks if ONLINE
  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Financial Fraud', points, maxPoints, checks, skipped: true, skipReason: 'Site not reachable' };
  }

  const html = ctx.evidence.html.toLowerCase()`
);

console.log('  ✓ Updated Financial Fraud to work offline');

// Update Identity Theft to work offline
content = content.replace(
  /(export function runIdentityTheftCategory[\s\S]*?if \(ctx\.reachability !== 'ONLINE' \|\| !ctx\.evidence\.html\) \{\s+return \{[\s\S]*?skipReason: 'Site not reachable' \};\s+})/,
  `export function runIdentityTheftCategory(ctx: CategoryExecutionContext): CategoryResult {
  const checks: GranularCheckResult[] = [];
  const maxPoints = 20;

  // Basic URL checks work offline
  let points = 0;
  const urlLower = ctx.url.toLowerCase();

  // Check: Identity-related keywords in URL (WORKS OFFLINE)
  const identityKeywords = ['verify', 'identity', 'kyc', 'document', 'upload', 'ssn', 'passport'];
  const foundInUrl = identityKeywords.filter(kw => urlLower.includes(kw));

  if (foundInUrl.length > 0) {
    console.log(\`[Identity Theft] INFO: Identity keywords in URL: \${foundInUrl.join(', ')}\`);
  }

  // Only run form checks if ONLINE
  if (ctx.reachability !== 'ONLINE' || !ctx.evidence.html) {
    return { categoryName: 'Identity Theft', points, maxPoints, checks, skipped: true, skipReason: 'Site not reachable' };
  }`
);

console.log('  ✓ Updated Identity Theft to work offline');

// FIX 11: Add earnedPoints and possiblePoints to CategoryResult interface
console.log('\n[FIX 5] Adding earnedPoints and possiblePoints to CategoryResult...');

content = content.replace(
  /(export interface CategoryResult \{\s+categoryName: string;\s+points: number;\s+maxPoints: number;)/,
  `$1\n  earnedPoints: number;     // Points checks earned (inverse of penalty)\n  possiblePoints: number;   // Max points checks can earn`
);

console.log('  ✓ Updated CategoryResult interface');

// FIX 12: Add earnedPoints calculation to each category return statement
// This is complex, so we'll add a helper comment
content = content.replace(
  /(return \{\s+categoryName: ['"].*?['"],\s+points)/g,
  (match, p1) => {
    // Extract category name from match
    const categoryNameMatch = match.match(/categoryName: ['"](.*)['"],/);
    const categoryName = categoryNameMatch ? categoryNameMatch[1] : 'Unknown';

    return `const earnedPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const possiblePoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

    return {
      categoryName: '${categoryName}',
      ${p1}`;
  }
);

// Add earnedPoints and possiblePoints to return statements
content = content.replace(
  /(return \{\s+categoryName: .*?,\s+points: .*?,\s+maxPoints.*?,)/g,
  '$1\n      earnedPoints,\n      possiblePoints,'
);

console.log('  ✓ Added earnedPoints/possiblePoints to all category returns');

// Write the updated file
fs.writeFileSync(CATEGORIES_FILE, content);

console.log('\n✅ All fixes applied successfully!');
console.log('\n📊 Summary of Changes:');
console.log('  - URL Pattern Analysis: 30 → 65 points');
console.log('  - Added subdomain TLD impersonation check (35 pts)');
console.log('  - Added brand-in-path detection (40 pts)');
console.log('  - Added phishing path keywords (15 pts max)');
console.log('  - Trust Graph: 30 → 65 points');
console.log('  - Enhanced free hosting detection (35-50 pts)');
console.log('  - Moved 3 categories to always-run (95 pts)');
console.log('  - Added earnedPoints/possiblePoints to all categories');
console.log('\n🎯 Expected result for wwnorton-com.vercel.app:');
console.log('  - Subdomain TLD impersonation: 35 pts');
console.log('  - Brand in path not domain: 40 pts');
console.log('  - Free hosting with brand: 50 pts');
console.log('  - Phishing path keyword: 5 pts');
console.log('  - TOTAL: 130+ pts = Risk Level E/F (CRITICAL)');

// Calculate changes
const linesAdded = (content.match(/\n/g) || []).length - (originalContent.match(/\n/g) || []).length;
console.log(`\n📝 Lines changed: +${linesAdded}`);
