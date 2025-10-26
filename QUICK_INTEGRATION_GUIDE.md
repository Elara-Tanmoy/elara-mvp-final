# V2 Scanner - Quick Integration Guide

## 3-Step Integration Process

### Step 1: Register Backend Routes (1 minute)

In `packages/backend/src/index.ts` (or your main Express app file):

```typescript
// Add this import at the top
import v2ConfigRoutes from './routes/v2-config.routes';

// Add this line with your other route registrations (after auth routes)
app.use('/api/v2-config', v2ConfigRoutes);
```

**Location to add:** Look for where other routes are registered (e.g., `/api/scan`, `/api/auth`), and add this line there.

### Step 2: Integrate ML Detection into Stage-1 (5 minutes)

In `packages/backend/src/scanners/url-scanner-v2/stage1.ts`:

**2a. Add import at the top:**
```typescript
import { createURLRiskAnalyzer } from './ml-models';
```

**2b. Replace the `localURLBERTFallback` method (around line 289):**
```typescript
private localURLBERTFallback(urlTokens: string[]): {
  probability: number;
  confidence: number;
} {
  // NEW: Use real rule-based detection
  try {
    const analyzer = createURLRiskAnalyzer();

    // Reconstruct URL from tokens
    const url = urlTokens.join('');

    // Run comprehensive analysis
    const analysis = analyzer.analyze(url);

    console.log(`[Stage1] URLBERT Fallback with ML Models:`);
    console.log(`  - Probability: ${(analysis.probability * 100).toFixed(1)}%`);
    console.log(`  - Confidence: ${analysis.confidence.toFixed(2)}`);
    console.log(`  - Detections:`, analysis.detections);

    return {
      probability: analysis.probability,
      confidence: analysis.confidence
    };
  } catch (error) {
    console.error('[Stage1] URL risk analysis error:', error);

    // Fallback to existing heuristic if URL analysis fails
    let riskScore = 0;

    // ... (keep existing fallback code here)

    return { probability: 0.5, confidence: 0.3 };
  }
}
```

**Alternative (simpler):** Just add the analyzer call at the start of the existing method:
```typescript
private localURLBERTFallback(urlTokens: string[]): {
  probability: number;
  confidence: number;
} {
  // Try ML-based detection first
  try {
    const analyzer = createURLRiskAnalyzer();
    const url = urlTokens.join('');
    const analysis = analyzer.analyze(url);

    if (analysis.confidence > 0.5) {
      // Use ML result if confident enough
      return {
        probability: analysis.probability,
        confidence: analysis.confidence
      };
    }
  } catch (error) {
    console.error('URL risk analysis failed, using fallback');
  }

  // Existing heuristic code continues below...
  let riskScore = 0;
  // ... rest of existing code ...
}
```

### Step 3: Add Frontend Routes and Navigation (2 minutes)

**3a. Add routes in `packages/frontend/src/App.tsx`:**

```typescript
// Add imports
import V2ConfigPage from './pages/admin/V2ConfigPage';
import V2TestPage from './pages/admin/V2TestPage';

// Add routes (in your <Routes> section, with other admin routes)
<Route path="/admin/v2-config" element={<V2ConfigPage />} />
<Route path="/admin/v2-test" element={<V2TestPage />} />
```

**3b. Add navigation links (in your admin sidebar/menu):**

```tsx
<NavLink to="/admin/v2-config">
  <Settings className="w-5 h-5" />
  <span>V2 Scanner Config</span>
</NavLink>

<NavLink to="/admin/v2-test">
  <TestTube className="w-5 h-5" />
  <span>V2 Test Lab</span>
</NavLink>
```

**3c. Update URLScanner.tsx to use new results component:**

```typescript
// At the top, replace EnhancedScanResults import:
import V2ScanResults from '../components/ScanResults/V2ScanResults';

// In the component, replace:
<EnhancedScanResults scan={scan} />
// with:
<V2ScanResults scan={scan} />
```

## Verification Checklist

After integration, verify these work:

### Backend
- [ ] Server starts without errors
- [ ] `GET /api/v2-config` returns current config (requires auth)
- [ ] `POST /api/v2-config/test` accepts test URL (requires admin)

### Frontend
- [ ] Navigate to `/admin/v2-config` (admin only)
- [ ] Navigate to `/admin/v2-test` (admin only)
- [ ] Scan a URL and see V2ScanResults component

### Phishing Detection Test
1. Navigate to `/admin/v2-test`
2. Enter: `https://ingresa-inicio-usermua.vercel.app/aumento`
3. Click "Run Test"
4. **Expected Result:**
   - Risk Score: 100
   - Verdict: DANGEROUS
   - Explanations include:
     - Free hosting (vercel.app)
     - Suspicious subdomains
     - Social engineering keywords

## Troubleshooting

### Error: "Cannot find module './ml-models'"
**Solution:** The file was created at `packages/backend/src/scanners/url-scanner-v2/ml-models.ts`. Verify it exists.

### Error: "authenticate is not defined"
**Solution:** Check that `packages/backend/src/middleware/auth.ts` exists and exports `authenticate` and `requireAdmin`.

### Error: Routes not working
**Solution:** Verify routes are registered AFTER auth middleware and BEFORE error handlers in your main app file.

### Frontend routes show 404
**Solution:** Check that routes are inside the `<Routes>` component and paths match exactly.

### Admin pages show "Forbidden"
**Solution:** Make sure you're logged in as an admin user. Check the `requireAdmin` middleware.

## Quick Test Commands

### Test Backend API (using curl or Postman):
```bash
# Get config (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v2-config

# Get presets
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v2-config/presets

# Test URL
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://ingresa-inicio-usermua.vercel.app/aumento"}' \
  http://localhost:3000/api/v2-config/test
```

### Test Frontend (in browser):
1. Log in as admin
2. Navigate to: `http://localhost:5173/admin/v2-config`
3. Navigate to: `http://localhost:5173/admin/v2-test`
4. Run a test scan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         V2 SCANNER SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Backend                            Frontend                     │
│  ├── ml-models.ts                   ├── V2ScanResults.tsx       │
│  │   └── URLRiskAnalyzer            │   └── Results Display     │
│  │       ├── Free hosting           │                           │
│  │       ├── Suspicious domains     ├── V2ConfigPage.tsx        │
│  │       ├── Social engineering     │   └── Config Dashboard    │
│  │       ├── Brand impersonation    │                           │
│  │       └── Homoglyphs             ├── V2TestPage.tsx          │
│  │                                  │   └── Testing Interface   │
│  ├── v2-config.controller.ts        │                           │
│  │   ├── GET /api/v2-config        └───────────────────────────┤
│  │   ├── PUT /api/v2-config                                     │
│  │   ├── GET /presets                                           │
│  │   └── POST /test                                             │
│  │                                                               │
│  └── v2-config.routes.ts                                        │
│      └── Route registration                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Next Steps After Integration

1. **Test with known phishing URLs** - Use the preset test URLs
2. **Calibrate thresholds** - Use comparison mode to find optimal settings
3. **Monitor results** - Check if detection works as expected
4. **Collect feedback** - Track false positives/negatives
5. **Adjust configuration** - Fine-tune based on real-world data

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify all files were created correctly
3. Check that imports match file locations
4. Ensure auth middleware is working
5. Refer to V2_SCANNER_IMPLEMENTATION_SUMMARY.md for detailed info

## Success Indicators

✅ Config page loads without errors
✅ Test page can scan URLs
✅ Phishing URL shows 100 risk score
✅ Results display shows all sections
✅ Presets can be applied
✅ Custom thresholds can be saved

That's it! The V2 scanner is now fully integrated and functional.
