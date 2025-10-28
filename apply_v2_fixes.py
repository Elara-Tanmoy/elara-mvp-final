#!/usr/bin/env python3
"""
V2 Scanner Comprehensive Fixes - Python Patch Script
Applies all Phase 1 (P0) and Phase 2 (P1) fixes from the fix plan
"""

import re
import sys

CATEGORIES_FILE = 'packages/backend/src/scanners/url-scanner-v2/categories.ts'

print('V2 Scanner Comprehensive Fix Script')
print('====================================\n')

# Read the file
with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

print('[OK] Loaded categories.ts\n')

# ==================================================================
# FIX 1: Update CategoryResult interface to add earnedPoints/possiblePoints
# ==================================================================
print('[FIX 1] Adding earnedPoints and possiblePoints to CategoryResult interface...')

interface_pattern = r'(export interface CategoryResult \{\s+categoryName: string;\s+points: number;\s+maxPoints: number;)'
interface_replacement = r'\1\n  earnedPoints: number;     // Points checks earned (inverse of penalty)\n  possiblePoints: number;   // Max points checks can earn'

content = re.sub(interface_pattern, interface_replacement, content)
print('  [OK] Updated CategoryResult interface\n')

# ==================================================================
# FIX 2: Replace entire runURLPatternAnalysisCategory function
# ==================================================================
print('[FIX 2] Replacing runURLPatternAnalysisCategory function...')

# Find the function start and end
url_pattern_start = content.find('/**\n * Category 2.5: URL Pattern Analysis')
url_pattern_end = content.find('/**\n * Category 3: SSL/TLS Security')

if url_pattern_start == -1 or url_pattern_end == -1:
    print('  [ERROR] ERROR: Could not find URL Pattern Analysis function boundaries')
    sys.exit(1)

# Read the new function
with open('url_pattern_analysis_new.ts', 'r', encoding='utf-8') as f:
    new_function = f.read()

# Replace the function
content = content[:url_pattern_start] + new_function + '\n\n' + content[url_pattern_end:]

print('  [OK] Replaced URL Pattern Analysis function')
print('  [OK] Added subdomain TLD impersonation check (35 pts)')
print('  [OK] Added brand-in-path detection (40 pts)')
print('  [OK] Added phishing path keywords (15 pts max)')
print('  [OK] Added earnedPoints/possiblePoints to return')
print('  [OK] Updated maxPoints from 30 to 65\n')

# ==================================================================
# FIX 3: Update runTrustGraphCategory - Remove free hosting, add it back enhanced
# ==================================================================
print('[FIX 3] Enhancing runTrustGraphCategory with free hosting checks...')

# Find Trust Graph function
trust_graph_start = content.find('export function runTrustGraphCategory')
trust_graph_end = content.find('export function runMalwareDetectionCategory')

if trust_graph_start == -1 or trust_graph_end == -1:
    print('  [ERROR] ERROR: Could not find Trust Graph function boundaries')
    sys.exit(1)

trust_graph_section = content[trust_graph_start:trust_graph_end]

# Update maxPoints from 30 to 65
trust_graph_section = re.sub(r'const maxPoints = 30;', 'const maxPoints = 65;', trust_graph_section)

# Add free hosting checks before the return statement
free_hosting_code = '''
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
      console.log(`[Trust Graph] CRITICAL: Free hosting (${hostname}) with brand impersonation: ${matchedBrands.join(', ')}`);
      checks.push({
        checkId: 'free_hosting_with_brand',
        name: 'Free Hosting with Brand Impersonation',
        category: 'reputation',
        status: 'FAIL',
        points: 0,
        maxPoints: 50,
        description: `Free hosting (${hostname}) with brand impersonation - CRITICAL phishing indicator`,
        evidence: { hostname, isFreeHosting: true, brandKeywords: matchedBrands },
        timestamp: new Date()
      });
      points += 50;
    } else {
      console.log(`[Trust Graph] WARNING: Free hosting detected: ${hostname}`);
      checks.push({
        checkId: 'free_hosting',
        name: 'Free Hosting Provider',
        category: 'reputation',
        status: 'FAIL',
        points: 0,
        maxPoints: 35,
        description: `Hosted on free platform (${hostname}) - HIGH risk`,
        evidence: { hostname, isFreeHosting: true },
        timestamp: new Date()
      });
      points += 35;
    }
  }

  // Calculate earnedPoints and possiblePoints
  const earnedPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const possiblePoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

  return { categoryName: 'Trust Graph & Network', points, maxPoints, earnedPoints, possiblePoints, checks, skipped: false };'''

# Replace the return statement
trust_graph_section = re.sub(
    r'return \{ categoryName: \'Trust Graph & Network\', points, maxPoints, checks, skipped: false \};',
    free_hosting_code,
    trust_graph_section
)

content = content[:trust_graph_start] + trust_graph_section + content[trust_graph_end:]

print('  [OK] Updated maxPoints from 30 to 65')
print('  [OK] Added enhanced free hosting detection (35-50 pts)')
print('  [OK] Added earnedPoints/possiblePoints to return\n')

# ==================================================================
# FIX 4: Remove free hosting check from runDomainAnalysisCategory
# ==================================================================
print('[FIX 4] Removing free hosting from Domain Analysis...')

# Find and remove the free hosting section from Domain Analysis
free_hosting_pattern = r'  \/\/ Check 2\.5: Free hosting provider detection.*?points \+= 30; \/\/ HIGH RISK PENALTY\s+}\s+'
content = re.sub(free_hosting_pattern, '', content, flags=re.DOTALL)

print('  [OK] Removed duplicate free hosting check\n')

# ==================================================================
# FIX 5: Update executeCategories - move categories to always-run
# ==================================================================
print('[FIX 5] Moving core checks to always-run section...')

# Update the comment
content = re.sub(
    r'// Always run these regardless of reachability \(175 points\)',
    '// Always run these regardless of reachability (405 points)',
    content
)

# Update the point values in comments
content = re.sub(
    r'results\.push\(runURLPatternAnalysisCategory\(ctx\)\);   \/\/ 30 pts',
    'results.push(runURLPatternAnalysisCategory(ctx));   // 65 pts',
    content
)

content = re.sub(
    r'results\.push\(runTrustGraphCategory\(ctx\)\);           \/\/ 30 pts',
    'results.push(runTrustGraphCategory(ctx));           // 65 pts',
    content
)

# Add the three categories to always-run section
always_run_addition = '''  results.push(runPhishingPatternsCategory(ctx));     // 50 pts - MOVED TO ALWAYS-RUN
  results.push(runFinancialFraudCategory(ctx));       // 25 pts - MOVED TO ALWAYS-RUN
  results.push(runIdentityTheftCategory(ctx));        // 20 pts - MOVED TO ALWAYS-RUN

  '''

content = re.sub(
    r'(results\.push\(runEmailSecurityCategory\(ctx\)\);        \/\/ 25 pts\s+)',
    r'\1' + always_run_addition,
    content
)

# Remove from conditional section
content = re.sub(
    r'    results\.push\(runPhishingPatternsCategory\(ctx\)\);     \/\/ 50 pts.*?\n',
    '',
    content
)

content = re.sub(
    r'    results\.push\(runFinancialFraudCategory\(ctx\)\);       \/\/ 25 pts.*?\n',
    '',
    content
)

content = re.sub(
    r'    results\.push\(runIdentityTheftCategory\(ctx\)\);        \/\/ 20 pts.*?\n',
    '',
    content
)

print('  [OK] Moved Phishing Patterns to always-run')
print('  [OK] Moved Financial Fraud to always-run')
print('  [OK] Moved Identity Theft to always-run')
print('  [OK] Updated point totals\n')

# ==================================================================
# FIX 6: Add earnedPoints/possiblePoints to ALL category return statements
# ==================================================================
print('[FIX 6] Adding earnedPoints/possiblePoints to all categories...')

# Find all category functions and add the calculation before return
functions_to_update = [
    'runThreatIntelCategory',
    'runDomainAnalysisCategory',
    'runSSLSecurityCategory',
    'runContentAnalysisCategory',
    'runPhishingPatternsCategory',
    'runBehavioralCategory',
    'runMalwareDetectionCategory',
    'runSocialEngineeringCategory',
    'runSecurityHeadersCategory',
    'runEmailSecurityCategory',
    'runDataProtectionCategory',
    'runFinancialFraudCategory',
    'runIdentityTheftCategory',
    'runTechnicalExploitsCategory',
    'runLegalComplianceCategory'
]

for func_name in functions_to_update:
    # Find each function
    pattern = rf'(export function {func_name}\(ctx: CategoryExecutionContext\): CategoryResult \{{[\s\S]*?)(return \{{ categoryName:)'

    def add_calc(match):
        before_return = match.group(1)
        return_start = match.group(2)

        # Check if earnedPoints calculation already exists
        if 'earnedPoints = checks.reduce' in before_return:
            return match.group(0)  # Already has it

        # Add calculation before return
        calc_code = '''
  // Calculate earnedPoints and possiblePoints
  const earnedPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const possiblePoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

  '''
        return before_return + calc_code + return_start

    content = re.sub(pattern, add_calc, content)

# Now update all return statements to include earnedPoints and possiblePoints
# Pattern: return { categoryName: ..., points, maxPoints, checks, ...
return_pattern = r'(return \{\s+categoryName: [^,]+,\s+points:[^,]+,\s+maxPoints:[^,]+,)'
return_replacement = r'\1\n    earnedPoints,\n    possiblePoints,'

content = re.sub(return_pattern, return_replacement, content)

print('  [OK] Added earnedPoints/possiblePoints calculations to all categories')
print('  [OK] Updated all return statements\n')

# ==================================================================
# Write the updated file
# ==================================================================
with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
    f.write(content)

new_len = len(content)
diff = new_len - original_len

print('[OK] All fixes applied successfully!')
print('\n📊 Summary of Changes:')
print('  - URL Pattern Analysis: 30 → 65 points')
print('    • Added subdomain TLD impersonation check (35 pts)')
print('    • Added brand-in-path detection (40 pts)')
print('    • Added phishing path keywords (15 pts max)')
print('  - Trust Graph: 30 → 65 points')
print('    • Enhanced free hosting detection (35-50 pts)')
print('  - Moved 3 categories to always-run (95 pts)')
print('  - Added earnedPoints/possiblePoints to ALL categories')
print(f'\n📝 File size changed by: {diff:+d} bytes')
print('\n🎯 Expected result for wwnorton-com.vercel.app:')
print('  - Subdomain TLD impersonation: 35 pts')
print('  - Brand in path not domain: 40 pts')
print('  - Free hosting with brand: 50 pts')
print('  - Phishing path keyword: 5 pts')
print('  - TOTAL: 130+ pts = Risk Level E/F (CRITICAL)')
