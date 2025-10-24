# Timeout Fix Applied - October 5, 2025

## Issue
URL scanning was hanging indefinitely (20+ minutes) due to missing timeouts on DNS lookups and network requests in the new Phase 2 analyzers.

## Root Cause
The new scoring analyzers (email-security, privacy-analyzer, legal-compliance) were making DNS queries and HTTP requests without proper timeout configurations, causing the scan to hang when:
- DNS servers are slow or unresponsive
- Domains don't exist
- Network latency is high

## Fixes Applied

### 1. Email Security Analyzer (`email-security.ts`)

**Problem:** DNS lookups (SPF, DKIM, DMARC, MX) had no timeouts

**Fix:** Added Promise.race timeout wrapper to all DNS queries:
- SPF lookup: 3 second timeout
- DKIM lookup: 2 second timeout per selector
- DMARC lookup: 3 second timeout
- MX lookup: 3 second timeout
- Spoofing check: 2 second timeout per query
- **Global analyzer timeout: 10 seconds**

```typescript
const records = await Promise.race([
  resolveTxt(domain),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DNS timeout')), 3000)
  )
]);
```

### 2. Privacy Analyzer (`privacy-analyzer.ts`)

**Problem:** Directory exposure checks could hang on slow servers

**Fix:**
- Reduced axios timeout from 3s to 2s
- Added `maxRedirects: 0` to prevent redirect loops
- Added global analyzer timeout: 8 seconds

```typescript
const response = await axios.head(`${baseUrl}${dir}`, {
  timeout: 2000,
  validateStatus: () => true,
  maxRedirects: 0
});
```

### 3. Legal Compliance Analyzer (`legal-compliance.ts`)

**Problem:** Could hang on complex HTML parsing

**Fix:**
- Added global analyzer timeout: 5 seconds
- Parallel execution with Promise.all + timeout wrapper

```typescript
const results = await Promise.race([
  analysisPromise,
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Legal compliance timeout')), 5000)
  )
]);
```

### 4. Security Headers Analyzer (`security-headers.ts`)

**Already had timeouts:**
- Main axios request: 5 second timeout ✅
- security.txt check: 3 second timeout ✅

## Timeout Summary

| Analyzer | Global Timeout | Individual Timeouts |
|----------|---------------|---------------------|
| Email Security | 10 seconds | 2-3s per DNS query |
| Privacy Analysis | 8 seconds | 2s per directory check |
| Legal Compliance | 5 seconds | Fast (HTML parsing only) |
| Security Headers | 5 seconds | 3s per request |
| **Total Max** | **28 seconds** | **All bounded** |

## Error Handling

All analyzers now:
1. ✅ Gracefully handle timeouts
2. ✅ Return partial results on timeout
3. ✅ Add timeout findings to explain what happened
4. ✅ Don't crash the entire scan
5. ✅ Continue with 0 score for failed checks

Example timeout finding:
```typescript
{
  check: 'Email Security Analysis',
  result: 'Timeout',
  severity: 'MEDIUM',
  points: 0,
  maxPoints: 0,
  explanation: 'Email security analysis timed out. DNS queries may be slow or unresponsive.',
  evidence: { error: 'Email security analysis timeout' }
}
```

## Testing

After applying these fixes:

1. **Fast domains (< 5 seconds):**
   - All checks complete normally
   - Full 350-point scoring

2. **Slow domains (5-28 seconds):**
   - Analyzers timeout gracefully
   - Partial scores returned
   - Scan completes with timeout explanations

3. **Unresponsive domains (> 28 seconds):**
   - Individual analyzers timeout
   - Overall scan completes within ~30 seconds
   - Clear error messages provided

## Expected Scan Duration

| Scenario | Expected Duration |
|----------|-------------------|
| Fast legitimate site | 5-10 seconds |
| Average site | 10-15 seconds |
| Slow/problematic site | 20-30 seconds |
| Worst case | 30 seconds (all timeouts) |

**No scan should take more than 30 seconds.**

## Files Modified

1. ✅ `packages/backend/src/services/scoring/email-security.ts`
2. ✅ `packages/backend/src/services/scoring/privacy-analyzer.ts`
3. ✅ `packages/backend/src/services/scoring/legal-compliance.ts`

**Security-headers.ts already had proper timeouts.**

## Deployment

Changes are backwards compatible. Simply restart the backend:

```powershell
cd packages\backend
# Kill the running process
pnpm dev
```

## Monitoring

Watch for these log messages:
- `Email security analysis error: Email security analysis timeout`
- `Privacy analysis error: Privacy analysis timeout`
- `Legal compliance analysis error: Legal compliance timeout`

These indicate the timeout fixes are working correctly.

---

**Status:** ✅ FIXED
**Date:** October 5, 2025
**Impact:** Scanning now completes in < 30 seconds for all URLs
