# V2 Scanner Comprehensive Fix Plan

## CRITICAL ISSUES IDENTIFIED

### Issue 1: False Negative on Obvious Phishing
**URL**: `https://wwnorton-com.vercel.app/norton-02/error.html`
**Current Result**: Risk Level B (LOW RISK - 29%)
**Expected Result**: Risk Level E/F (CRITICAL - 90%+)

**Problems**:
- Subdomain `wwnorton-com` mimicking `wwnorton.com` NOT detected
- Path `/norton-02/error.html` contains brand name - NOT checked
- Free hosting (Vercel) penalty too low
- Site marked OFFLINE so most checks SKIPPED

###  2: Gemini AI Fallback Text
**Problem**: AI summarizer failing silently and showing generic template
**Current Output**: "This website has been classified as Low risk based on security analysis"
**Fix**: ✅ Added aiplatform.user permission to service account

### Issue 3: Category Scores Showing Zeros
**Problem**: Risk Categories showing "0/175 points (0.0%)" for all categories
**Cause**: Frontend calculating `penalty_points/max_penalty * 100` which is inverted
- All checks pass = 0 penalty = 0% (should be 100%)
- All checks fail = max penalty = 100% (should be 0%)

### Issue 4: Screenshots Not Capturing
**Problem**: No screenshots being saved despite `skipScreenshot: false`
**Cause**: Chromium path detection failing in Docker Alpine

### Issue 5: Reachability Detection Broken
**Problem**: Many ONLINE sites showing as OFFLINE/WAF
**Impact**: When marked OFFLINE, most granular checks are SKIPPED

---

## COMPREHENSIVE FIX STRATEGY

### Phase 1: CRITICAL Detection Fixes (P0)

#### 1.1 Fix URL Pattern Analysis (Works Offline)
**File**: `packages/backend/src/scanners/url-scanner-v2/categories.ts`

**Add to `runURLPatternAnalysisCategory()`**:

```typescript
// NEW CHECK: Subdomain Impersonation
// Detects: paypal-com.example.com, microsoft-secure.phish.net
const subdomainParts = hostname.split('.');
if (subdomainParts.length > 2) {
  const subdomain = subdomainParts[0];

  // Pattern 1: Contains "-com", "-net", "-org" (mimicking TLD)
  if (/-com$|-net$|-org$|-co$/.test(subdomain)) {
    checks.push({
      checkId: 'subdomain_tld_impersonation',
      status: 'FAIL',
      description: `Suspicious subdomain "${subdomain}" mimicking TLD - common phishing tactic`,
      points: 0,
      maxPoints: 35  // HIGH PENALTY
    });
    categoryPoints += 35;
  }
}

// NEW CHECK: Brand Keywords in Path
// Detects: /norton-02/error.html, /paypal/login, /amazon-verify
const brands = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook',
                'netflix', 'norton', 'mcafee', 'chase', 'bankofamerica', 'wellsfargo',
                'ebay', 'instagram', 'linkedin', 'twitter', 'dropbox', 'adobe'];

const path = new URL(ctx.url).pathname.toLowerCase();
const brandInPath = brands.find(brand => path.includes(brand));

if (brandInPath) {
  // Check if brand is NOT in the actual domain
  const domainHasBrand = hostname.includes(brandInPath);

  if (!domainHasBrand) {
    checks.push({
      checkId: 'brand_in_path_not_domain',
      status: 'FAIL',
      description: `Path contains "${brandInPath}" but domain doesn't - likely phishing attempt`,
      points: 0,
      maxPoints: 40  // VERY HIGH PENALTY
    });
    categoryPoints += 40;
  }
}

// NEW CHECK: Phishing Path Keywords
const phishingPaths = ['/login', '/verify', '/secure', '/account', '/update',
                       '/confirm', '/suspended', '/locked', '/error', '/support'];

const hasPhishingPath = phishingPaths.some(p => path.includes(p));
if (hasPhishingPath) {
  checks.push({
    checkId: 'suspicious_path_keyword',
    status: 'WARN',
    description: `URL path contains suspicious keyword commonly used in phishing`,
    points: 5,
    maxPoints: 15
  });
  categoryPoints += 5;
}
```

#### 1.2 Fix Free Hosting Detection & Penalty
**File**: `packages/backend/src/scanners/url-scanner-v2/categories.ts`

**Update in `runTrustGraphCategory()`**:

```typescript
// INCREASED PENALTY for free hosting
if (isFreeHosting) {
  const brandKeywords = ['paypal', 'amazon', 'microsoft', 'apple', 'google',
                         'norton', 'mcafee', 'chase', 'bank'];
  const urlLower = ctx.url.toLowerCase();
  const hasBrandKeyword = brandKeywords.some(brand => urlLower.includes(brand));

  if (hasBrandKeyword) {
    // Free hosting + brand keyword = CRITICAL
    checks.push({
      checkId: 'free_hosting_with_brand',
      status: 'FAIL',
      description: `Free hosting (${hostname}) with brand impersonation - CRITICAL phishing indicator`,
      points: 0,
      maxPoints: 50  // MAXIMUM PENALTY
    });
    categoryPoints += 50;
  } else {
    checks.push({
      checkId: 'free_hosting',
      status: 'FAIL',
      description: `Hosted on free platform (${hostname}) - HIGH risk`,
      points: 0,
      maxPoints: 35  // Increased from 15
    });
    categoryPoints += 35;
  }
}
```

#### 1.3 Make Core Checks Run OFFLINE
**File**: `packages/backend/src/scanners/url-scanner-v2/categories.ts`

**Move to ALWAYS-RUN section** (lines 1371-1376):

```typescript
// ALWAYS run these regardless of reachability (405 points total)
results.push(runThreatIntelCategory(ctx));          // 50 pts
results.push(runDomainAnalysisCategory(ctx));       // 40 pts
results.push(runURLPatternAnalysisCategory(ctx));   // 65 pts - INCREASED from 30
results.push(runTrustGraphCategory(ctx));           // 65 pts - INCREASED from 30
results.push(runEmailSecurityCategory(ctx));        // 25 pts
results.push(runPhishingPatternsCategory(ctx));     // 80 pts - MOVED HERE
results.push(runFinancialFraudCategory(ctx));       // 40 pts - MOVED HERE
results.push(runIdentityTheftCategory(ctx));        // 40 pts - MOVED HERE
```

### Phase 2: Display & Infrastructure Fixes (P1)

#### 2.1 Fix Category Score Display
**File**: `packages/backend/src/scanners/url-scanner-v2/categories.ts`

**Add to `CategoryResult` interface**:

```typescript
export interface CategoryResult {
  categoryName: string;
  points: number;           // Penalty points (for risk calc)
  maxPoints: number;        // Max penalty points

  // NEW: For frontend display
  earnedPoints: number;     // Points checks earned (inverse of penalty)
  possiblePoints: number;   // Max points checks can earn

  checks: GranularCheckResult[];
  skipped: boolean;
  skipReason?: string;
}
```

**Update each category function to calculate**:

```typescript
const earnedPoints = checks.reduce((sum, c) => sum + c.points, 0);
const possiblePoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);

return {
  categoryName: 'URL Pattern Analysis',
  points: categoryPoints,        // Penalty points
  maxPoints: MAX_CATEGORY_POINTS,
  earnedPoints,                  // NEW
  possiblePoints,                // NEW
  checks,
  skipped: false
};
```

#### 2.2 Fix Screenshot Capture
**File**: `packages/backend/src/scanners/url-scanner-v2/screenshot-capture.ts`

**Already implemented** in commit 36624a8 - verify it's working

#### 2.3 Fix Reachability Detection
**File**: `packages/backend/src/scanners/url-scanner-v2/reachability.ts`

**Test with Vercel sites and fix detection logic**

---

## TESTING PLAN

### Test Case 1: Norton Phishing (wwnorton-com.vercel.app)
**Expected Results After Fix**:
- ❌ FAIL: Subdomain TLD impersonation (35 pts penalty)
- ❌ FAIL: Brand in path not domain (40 pts penalty)
- ❌ FAIL: Free hosting with brand (50 pts penalty)
- ❌ FAIL: Phishing path keyword (5 pts penalty)
- **Total**: 130+ pts penalty → Risk Level E/F (CRITICAL)

### Test Case 2: Legitimate Site (google.com)
**Expected Results**:
- ✅ PASS: All checks
- ✅ Risk Level A (SAFE)

### Test Case 3: New Domain with Login Form
**Expected Results**:
- ❌ FAIL: Domain age < 30 days
- ❌ WARN: Login form detected
- ❌ WARN: Suspicious path keyword (/login)
- **Total**: 40-60 pts penalty → Risk Level D/E

---

## DEPLOYMENT PLAN

1. ✅ Fix Gemini AI permissions
2. ⏳ Implement detection fixes (Phase 1)
3. ⏳ Implement display fixes (Phase 2)
4. ⏳ Test with phishing URLs
5. ⏳ Deploy to dev
6. ⏳ Verify all fixes work
7. ⏳ Deploy to prod

---

## SUCCESS CRITERIA

- [ ] `wwnorton-com.vercel.app/norton-02/error.html` shows Risk Level E/F (90%+)
- [ ] Category scores show correct percentages (not zeros)
- [ ] Screenshots capture successfully
- [ ] Gemini AI generates real summaries (not fallback)
- [ ] Reachability detection accurate
- [ ] No false negatives on obvious phishing
- [ ] No false positives on legitimate sites
