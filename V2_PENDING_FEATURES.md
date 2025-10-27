# Elara V2 Scanner - Pending Features & Admin Capabilities

## Current Status (✅ Completed)

### Core Scanner Engine
- ✅ **17 Granular Categories** (570 points) - ALL implemented with REAL data collection
- ✅ **Reachability-Based Branching** - ONLINE/OFFLINE/PARKED/WAF/SINKHOLE logic working
- ✅ **WHOIS Collection** - Using RDAP API, returns real domain ages
- ✅ **DNS/TLS Evidence** - Real data collection with error handling
- ✅ **Threat Intelligence Integration** - 18 sources with tier-based weighting
- ✅ **ML Rule-Based Analyzer** - Phishing detection heuristics integrated
- ✅ **GranularCheckResult Tracking** - All 62+ individual checks tracked
- ✅ **Categories.ts** - Complete with all sub-checks implemented
- ✅ **Evidence Collection** - HTML, DOM, forms, scripts, TLS, WHOIS, DNS, ASN
- ✅ **Stage-1 Models** - XGBoost + URLBERT + Monotonic XGBoost framework
- ✅ **Policy Engine** - Hard override rules (tombstone, dual TI hits, causal signals)
- ✅ **Combiner** - ICP calibration framework
- ✅ **V2 Config Service** - Database-backed configuration management

---

## ❌ MISSING: Admin Configuration APIs

### 1. Category Configuration CRUD API
**Status:** NOT IMPLEMENTED
**Required:** Like V1 ScanEngineAdmin

```typescript
// NEEDED ENDPOINTS:
POST   /api/admin/v2/categories              // Create custom category config
GET    /api/admin/v2/categories              // List all category configs
GET    /api/admin/v2/categories/:id          // Get specific config
PUT    /api/admin/v2/categories/:id          // Update category weights
DELETE /api/admin/v2/categories/:id          // Delete config
POST   /api/admin/v2/categories/:id/activate // Set as active

// REQUIRED SCHEMA:
{
  id: string,
  name: string,
  version: string,
  isActive: boolean,
  categories: {
    threat_intel: { weight: 50, enabled: true },
    domain_analysis: { weight: 40, enabled: true },
    ssl_security: { weight: 45, enabled: true },
    // ... all 17 categories
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Why needed:** Admins need to adjust category weights dynamically without code changes.

---

### 2. Granular Check Configuration API
**Status:** NOT IMPLEMENTED
**Required:** Per-check point adjustment

```typescript
// NEEDED ENDPOINTS:
GET    /api/admin/v2/checks                    // List all checks
PUT    /api/admin/v2/checks/:checkId           // Update check config
PUT    /api/admin/v2/checks/:checkId/points    // Adjust points
PUT    /api/admin/v2/checks/:checkId/enable    // Enable/disable
PUT    /api/admin/v2/checks/:checkId/severity  // Change severity

// REQUIRED SCHEMA:
{
  checkId: string,  // e.g., "domain_age", "whois_privacy"
  name: string,
  category: string, // Parent category
  defaultPoints: number,
  currentPoints: number,  // Admin-adjusted
  maxPoints: number,
  severity: 'low' | 'medium' | 'high' | 'critical',
  enabled: boolean,
  description: string,
  lastModified: Date,
  modifiedBy: string
}
```

**Example Adjustments Needed:**
- Admin wants to increase "domain_age" from 15 pts to 20 pts for their org
- Admin wants to disable "legal_terms" check (not relevant for their use case)
- Admin wants to mark "ti_gsb_check" as CRITICAL severity

**Why needed:** Different orgs have different risk tolerances. Banking clients might weight TLS higher, while e-commerce weights brand impersonation higher.

---

### 3. Policy Rule Configuration API
**Status:** PARTIALLY IMPLEMENTED (hardcoded rules only)
**Required:** Dynamic policy management

```typescript
// NEEDED ENDPOINTS:
GET    /api/admin/v2/policy/rules              // List all rules
POST   /api/admin/v2/policy/rules              // Create custom rule
PUT    /api/admin/v2/policy/rules/:id          // Update rule
DELETE /api/admin/v2/policy/rules/:id          // Delete rule
PUT    /api/admin/v2/policy/rules/:id/priority // Change priority

// REQUIRED SCHEMA:
{
  id: string,
  name: string,
  priority: number,  // 1 = highest
  enabled: boolean,
  condition: {
    type: 'AND' | 'OR',
    clauses: [
      { field: 'tiTier1Hits', operator: '>=', value: 2 },
      { field: 'domainAge', operator: '<', value: 30 },
      { field: 'brandDetected', operator: '==', value: true }
    ]
  },
  action: {
    type: 'OVERRIDE' | 'ESCALATE' | 'IGNORE',
    riskLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F',
    reason: string,
    block: boolean
  },
  metadata: {
    appliedCount: number,
    lastApplied: Date,
    createdBy: string
  }
}
```

**Current Hardcoded Rules (need to be configurable):**
1. Tombstone Active → F
2. Dual Tier-1 Hits → F
3. Single Tier-1 Critical → F
4. Form Origin Mismatch + Young Domain → D
5. Brand + Young + Risky TLD → C
6. Historical TI Hit (≤90d) → D

**Why needed:** Security teams need to customize rules based on their threat landscape. E.g., financial orgs might want to auto-block ANY tier-1 hit, while research orgs might allow it.

---

### 4. Reachability Branch Threshold Configuration
**Status:** HARDCODED in types.ts
**Required:** Admin-adjustable thresholds

```typescript
// NEEDED ENDPOINTS:
GET    /api/admin/v2/thresholds                       // Get all branch thresholds
PUT    /api/admin/v2/thresholds/:branch               // Update branch thresholds
POST   /api/admin/v2/thresholds/preset/:presetName   // Apply preset (balanced/aggressive/permissive)

// REQUIRED SCHEMA:
{
  branch: 'ONLINE' | 'OFFLINE' | 'PARKED' | 'WAF' | 'SINKHOLE',
  thresholds: {
    safeThreshold: 0.15,      // 0-15% → A
    lowThreshold: 0.30,       // 15-30% → B
    mediumThreshold: 0.50,    // 30-50% → C
    highThreshold: 0.75,      // 50-75% → D
    criticalThreshold: 0.90   // 75-90% → E, 90-100% → F
  },
  preset: 'balanced' | 'aggressive' | 'permissive' | 'custom',
  lastModified: Date
}
```

**Current Values (ONLINE):**
- A: 0-15%, B: 15-30%, C: 30-50%, D: 50-75%, E: 75-90%, F: 90-100%

**Why needed:** Different deployment environments need different sensitivities:
- **Aggressive (SOC):** Lower thresholds → more FPs, catch more threats
- **Balanced (Production):** Current defaults
- **Permissive (Testing):** Higher thresholds → fewer FPs, miss some threats

---

### 5. Test & Calibrate API
**Status:** NOT IMPLEMENTED
**Required:** Like V1's test console

```typescript
// NEEDED ENDPOINTS:
POST   /api/admin/v2/test/scan                // Test scan with custom config
POST   /api/admin/v2/calibrate                // Calibrate thresholds with dataset
GET    /api/admin/v2/calibrate/status        // Get calibration job status
GET    /api/admin/v2/calibrate/results       // Get calibration results

// TEST SCAN REQUEST:
{
  url: string,
  config: {
    categoryWeights?: Record<string, number>,
    checkWeights?: Record<string, number>,
    policyRules?: PolicyRule[],
    branchThresholds?: BranchThresholds
  },
  options: {
    skipStage2?: boolean,
    skipScreenshot?: boolean,
    enableExplainability?: boolean
  }
}

// TEST SCAN RESPONSE:
{
  scanId: string,
  url: string,
  result: EnhancedScanResult,  // Full result with granular checks
  comparison: {
    defaultConfig: { riskLevel: 'C', probability: 0.42 },
    customConfig: { riskLevel: 'D', probability: 0.58 },
    deltaPoints: +78,
    affectedCategories: ['domain_analysis', 'phishing_patterns']
  },
  explanation: string  // Why config changes affected result
}
```

**Why needed:** Admins need to test config changes BEFORE applying to production. E.g., "If I increase domain_age weight from 15 to 25, how does it affect these 10 known phishing URLs?"

---

### 6. Scan Result Formatter APIs
**Status:** PARTIALLY IMPLEMENTED (raw JSON only)
**Required:** Multiple formatted outputs

#### 6a. Non-Technical User Summary
```typescript
// NEEDED ENDPOINT:
GET /api/admin/v2/results/:scanId/summary?format=non-tech

// RESPONSE:
{
  verdict: "🚨 DANGEROUS - DO NOT VISIT",
  riskLevel: "F",
  confidence: "Very High (94%)",
  simpleSummary: "This website is pretending to be PayPal to steal your password. It was registered 12 days ago and has been flagged by Google's security systems.",

  keyWarnings: [
    "🔴 Flagged by Google Safe Browsing as phishing",
    "🔴 Very new website (only 12 days old)",
    "🔴 Login form sends your password to a different website",
    "🔴 Uses fake PayPal branding and logos"
  ],

  whatToDo: [
    "✋ DO NOT enter your username or password",
    "✋ DO NOT download anything from this site",
    "✅ Close this website immediately",
    "✅ If you entered credentials, change your password at the real paypal.com",
    "✅ Enable two-factor authentication on your account"
  ],

  whyDangerous: "Criminals created this fake website to trick you into giving them your PayPal login. They copied PayPal's design perfectly, but it's not the real website.",

  visualIndicators: {
    hasScreenshot: true,
    screenshotUrl: "https://...",
    annotations: [
      { type: "logo", text: "Fake PayPal logo detected" },
      { type: "form", text: "Login form submits to wrong domain" }
    ]
  }
}
```

#### 6b. Technical Analyst Summary
```typescript
// NEEDED ENDPOINT:
GET /api/admin/v2/results/:scanId/summary?format=tech

// RESPONSE:
{
  verdict: "CONFIRMED_THREAT",
  riskScore: 94,
  riskLevel: "F",
  probability: 0.94,
  confidenceInterval: { lower: 0.91, upper: 0.97, width: 0.06 },

  executiveSummary: "High-confidence phishing attack targeting PayPal users. Domain registered 2025-10-15 via Namecheap with privacy protection. GSB and PhishTank hits confirm active campaign. Homoglyph attack (paypai.com). Hosting: Russia AS12345 (bulletproof). No MX/SPF/DMARC. Self-signed cert.",

  threatIntelligence: {
    tier1Hits: 2,
    sources: [
      { name: "Google Safe Browsing", severity: "CRITICAL", lastSeen: "2025-10-27T10:15:00Z", category: "PHISHING" },
      { name: "PhishTank", severity: "HIGH", lastSeen: "2025-10-27T09:30:00Z", category: "PHISHING", contributorCount: 5 }
    ],
    tier2Hits: 1,
    historicalHits: 3,
    firstSeen: "2025-10-25T14:20:00Z",
    campaignId: "PAYPAL_HOMOGLYPH_OCT2025"
  },

  infrastructure: {
    domain: {
      age: 12,
      registrar: "Namecheap",
      privacy: true,
      created: "2025-10-15T00:00:00Z",
      expires: "2026-10-15T00:00:00Z",
      registrantCountry: "REDACTED",
      nameservers: ["ns1.example.com", "ns2.example.com"]
    },
    hosting: {
      ip: "185.220.101.42",
      asn: 12345,
      organization: "BulletProof Systems LLC",
      country: "RU",
      reputation: "BAD",
      isHosting: true,
      isCDN: false,
      reverseDNS: null
    },
    tls: {
      valid: false,
      issuer: "Self-Signed",
      subject: "paypai.com",
      validFrom: "2025-10-25T00:00:00Z",
      validTo: "2026-10-25T00:00:00Z",
      selfSigned: true,
      daysUntilExpiry: 363,
      tlsVersion: "TLS 1.2",
      anomalies: ["SELF_SIGNED", "CERT_NAME_MISMATCH"]
    },
    dns: {
      hasA: true,
      hasMX: false,
      hasSPF: false,
      hasDMARC: false,
      hasCAA: false,
      healthScore: 0.2
    }
  },

  behavioralAnalysis: {
    hasLoginForm: true,
    formFields: ["username", "password", "remember_me"],
    formAction: "https://malicious-collector.ru/phish.php",
    formOriginMismatch: true,
    autoDownload: false,
    autoRedirect: false,
    obfuscatedScripts: true,
    suspiciousJS: ["cookie-theft", "form-hijacking"],
    externalRequests: 12,
    externalDomains: ["malicious-collector.ru", "analytics-fake.com"]
  },

  brandImpersonation: {
    detected: true,
    brand: "PayPal",
    confidence: 0.95,
    indicators: [
      { type: "LEXICAL", match: "paypai.com", technique: "HOMOGLYPH" },
      { type: "VISUAL", match: "PayPal logo (99% similarity)", technique: "LOGO_CLONE" },
      { type: "CONTENT", match: "PayPal copyright text", technique: "TEXT_COPY" }
    ],
    legitimateDomain: "paypal.com",
    infrastructureDivergence: true  // Real PayPal is US-based, this is Russia
  },

  mlPredictions: {
    stage1: {
      urlLexicalA: { prob: 0.87, confidence: 0.92 },
      urlLexicalB: { prob: 0.91, confidence: 0.89 },
      tabularRisk: { prob: 0.82, confidence: 0.94, topFeatures: ["domainAge", "tiTier1Hits", "tlsScore"] },
      combined: { prob: 0.87, confidence: 0.92 },
      latency: 1842
    },
    stage2: {
      textPersuasion: { prob: 0.88, confidence: 0.91, tactics: ["urgency", "authority", "fear"] },
      screenshotCnn: { prob: 0.92, confidence: 0.89, detectedBrands: ["PayPal"], isFakeLogin: true },
      combined: { prob: 0.90, confidence: 0.90 },
      latency: 4231
    }
  },

  policyDecision: {
    overridden: true,
    rule: "DUAL_TIER1_HITS",
    reason: "Flagged by Google Safe Browsing (tier-1 critical) + PhishTank (tier-1 high)",
    action: "BLOCK",
    originalProbability: 0.87,
    finalProbability: 0.94,
    escalation: "+0.07 due to policy rule"
  },

  granularScores: {
    totalPoints: 487,
    totalPossible: 570,
    byCategory: [
      { name: "Threat Intelligence", points: 50, max: 50, passRate: "0%" },
      { name: "Domain/WHOIS/TLD", points: 38, max: 40, passRate: "5%" },
      { name: "SSL/TLS Security", points: 40, max: 45, passRate: "11%" },
      // ... all 17 categories
    ]
  },

  recommendations: {
    immediate: [
      "BLOCK at perimeter (firewall/proxy)",
      "Add to organizational deny list",
      "Alert all users who accessed this domain in last 7 days",
      "Force password reset for PayPal users in org"
    ],
    investigative: [
      "Check SIEM logs for other access attempts to *.paypai.com",
      "Search for related campaign domains (paypa1.com, paypal-secure.com, etc.)",
      "Correlate with email security logs (likely phishing email campaign)"
    ],
    preventive: [
      "Deploy browser extension to warn on homoglyph domains",
      "Enable FIDO2/WebAuthn for PayPal (phishing-resistant)",
      "User awareness training on domain verification"
    ]
  },

  forensics: {
    scanTimestamp: "2025-10-27T14:32:10.542Z",
    scanDuration: 8742,
    evidenceHash: "sha256:abc123...",
    screenshotHash: "sha256:def456...",
    preservedAt: "https://storage.googleapis.com/elara-evidence/550e8400-.../",
    chainOfCustody: [
      { actor: "v2-scanner", action: "SCAN", timestamp: "..." },
      { actor: "policy-engine", action: "OVERRIDE", timestamp: "..." },
      { actor: "storage", action: "ARCHIVE", timestamp: "..." }
    ]
  }
}
```

**Why needed:**
- Non-tech summary: For end users, help desk, executives
- Tech summary: For SOC analysts, incident responders, threat hunters

---

### 7. Admin UI Components
**Status:** PARTIALLY EXISTS (V2ConfigPage.tsx exists but incomplete)
**Required:** Full-featured admin dashboard

#### Missing UI Components:

**7a. Category Weight Sliders (like V1)**
```
┌─────────────────────────────────────────────────────────┐
│ Category Weights Configuration                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Threat Intelligence (50 pts)             ███████ 50     │
│ Domain/WHOIS/TLD (40 pts)                ██████ 40      │
│ SSL/TLS Security (45 pts)                ██████ 45      │
│ Content Analysis (40 pts)                ██████ 40      │
│ Phishing Patterns (50 pts)               ███████ 50     │
│ ... [12 more categories]                                │
│                                                          │
│ Total: 570 points                                       │
│                                                          │
│ [Save] [Reset to Default] [Apply Preset▼]              │
└─────────────────────────────────────────────────────────┘
```

**7b. Granular Check Drill-Down**
```
┌─────────────────────────────────────────────────────────┐
│ Domain/WHOIS/TLD Analysis (40 points)                   │
├─────────────────────────────────────────────────────────┤
│ ✓ Enabled                                               │
│                                                          │
│ Sub-Checks:                                             │
│ ┌─ Domain Age (10 pts) ───────────────────────┐        │
│ │ Points: 10 ═══════════════════════ ☐ 15     │        │
│ │ Status: FAIL if < 30 days                    │        │
│ │ [✓] Enabled  Severity: HIGH                  │        │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ ┌─ WHOIS Privacy (10 pts) ────────────────────┐        │
│ │ Points: 5 ══════════ ☐ 10                   │        │
│ │ Status: WARNING if privacy enabled           │        │
│ │ [✓] Enabled  Severity: MEDIUM                │        │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ [+ Add Custom Check] [Save Changes]                     │
└─────────────────────────────────────────────────────────┘
```

**7c. Policy Rule Builder**
```
┌─────────────────────────────────────────────────────────┐
│ Create Policy Rule                                       │
├─────────────────────────────────────────────────────────┤
│ Rule Name: [Block Dual TI Hits on Young Domains____]    │
│ Priority:  [1▼] (1=highest)                             │
│ Status:    [✓] Enabled                                   │
│                                                          │
│ Conditions (ALL must match):                            │
│ ┌────────────────────────────────────────────┐         │
│ │ tiTier1Hits [>=▼] [2____]                  │         │
│ │ domainAge   [< ▼] [90___] days             │         │
│ │ [+ Add Condition]                          │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ Action:                                                  │
│ ┌────────────────────────────────────────────┐         │
│ │ Type:       [Override▼]                    │         │
│ │ Risk Level: [F - Confirmed Threat▼]        │         │
│ │ Block:      [✓] Yes                         │         │
│ │ Reason:     [Dual tier-1 TI hits with___]  │         │
│ │             [young domain indicate active_]  │         │
│ │             [phishing campaign___________]  │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ [Test Rule] [Save] [Cancel]                             │
└─────────────────────────────────────────────────────────┘
```

**7d. Branch Threshold Configurator**
```
┌─────────────────────────────────────────────────────────┐
│ Reachability Branch Thresholds                          │
├─────────────────────────────────────────────────────────┤
│ Preset: [Balanced▼] [Aggressive] [Permissive] [Custom] │
│                                                          │
│ ONLINE Branch:                                          │
│ ┌────────────────────────────────────────────┐         │
│ │ A (Safe):     0% ═══════ 15%               │         │
│ │ B (Low):     15% ════════ 30%              │         │
│ │ C (Medium):  30% ═══════════ 50%           │         │
│ │ D (High):    50% ═══════════════ 75%       │         │
│ │ E (Critical):75% ════════ 90%              │         │
│ │ F (Severe):  90% ═══ 100%                  │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ OFFLINE Branch: [Show▼]                                 │
│ PARKED Branch:  [Show▼]                                 │
│ WAF Branch:     [Show▼]                                 │
│ SINKHOLE Branch:[Show▼]                                 │
│                                                          │
│ [Apply] [Reset] [Export JSON]                           │
└─────────────────────────────────────────────────────────┘
```

**7e. Test & Calibrate Console**
```
┌─────────────────────────────────────────────────────────┐
│ Test Scanner Configuration                               │
├─────────────────────────────────────────────────────────┤
│ Test URL: [https://paypai.com/login________________]    │
│                                                          │
│ Configuration:                                          │
│ [●] Use Active Config  [○] Use Custom Config           │
│                                                          │
│ Options:                                                │
│ [✓] Run Stage-2 Models                                  │
│ [✓] Capture Screenshot                                  │
│ [✓] Enable Explainability (SHAP values)                │
│                                                          │
│ [▶ Run Test Scan]                                       │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│ Results:                                                │
│                                                          │
│ Risk Level: F (Confirmed Threat)                       │
│ Probability: 94% (CI: 91%-97%)                         │
│ Scan Duration: 8.7s                                    │
│                                                          │
│ Top Risk Factors:                                       │
│ • Google Safe Browsing hit (+20 pts)                   │
│ • Domain age 12 days (+15 pts)                         │
│ • Form origin mismatch (+25 pts)                       │
│ • Brand impersonation detected (+18 pts)               │
│                                                          │
│ [View Full Report] [Compare with Default Config]        │
└─────────────────────────────────────────────────────────┘
```

**7f. Scan History Browser with Granular Drill-Down**
```
┌─────────────────────────────────────────────────────────┐
│ V2 Scan History                                         │
├─────────────────────────────────────────────────────────┤
│ Filters: [Last 24h▼] [All Risk Levels▼] [🔍 Search___] │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 2025-10-27 14:32:10  paypai.com/login        [F] 🔴││
│ │ ├─ Reachability: ONLINE                             ││
│ │ ├─ TI Hits: 2 tier-1, 1 tier-2                      ││
│ │ ├─ Category Scores: TI(50/50), Domain(38/40), ...  ││
│ │ └─ Policy: DUAL_TIER1_HITS (overridden to F)       ││
│ │ [▼ Expand Granular Checks]                          ││
│ └─────────────────────────────────────────────────────┘│
│                                                          │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 2025-10-27 13:15:42  google.com              [A] 🟢││
│ │ ├─ Reachability: ONLINE                             ││
│ │ ├─ TI Hits: 0                                       ││
│ │ ├─ Category Scores: TI(0/50), Domain(2/40), ...    ││
│ │ └─ All checks passed                                ││
│ └─────────────────────────────────────────────────────┘│
│                                                          │
│ [Export CSV] [View Analytics] [Configure Columns]       │
└─────────────────────────────────────────────────────────┘
```

When expanded:
```
┌─────────────────────────────────────────────────────────┐
│ Scan Details: paypai.com/login                          │
├─────────────────────────────────────────────────────────┤
│ Granular Checks (62 total):                            │
│                                                          │
│ ▼ Threat Intelligence (50/50 pts) ──────────────────   │
│   ✗ ti_gsb_check (20/20) - FAIL                        │
│     Google Safe Browsing flagged as MALWARE            │
│   ✗ ti_virustotal (15/15) - FAIL                       │
│     8 of 89 vendors flagged                            │
│   ✗ ti_phishtank (10/10) - FAIL                        │
│     Confirmed phishing by 5 contributors               │
│   ⚠ ti_urlhaus (5/5) - WARNING                         │
│     Historical match found                             │
│                                                          │
│ ▼ Domain/WHOIS/TLD (38/40 pts) ────────────────────    │
│   ✗ domain_age (0/10) - FAIL                           │
│     Domain is 12 days old (very new)                   │
│   ⚠ whois_privacy (5/10) - WARNING                     │
│     Privacy protection enabled                         │
│   ⚠ tld_risk (7/10) - WARNING                          │
│     .com with suspicious patterns                      │
│   ⚠ registrar_reputation (5/10) - WARNING              │
│     Namecheap (common for phishing)                    │
│                                                          │
│ [View All 62 Checks] [Export JSON] [Download Report]    │
└─────────────────────────────────────────────────────────┘
```

**7g. Analytics Dashboard**
```
┌─────────────────────────────────────────────────────────┐
│ V2 Scanner Analytics                                    │
├─────────────────────────────────────────────────────────┤
│ Time Period: [Last 30 Days▼]                           │
│                                                          │
│ Overview:                                               │
│ ┌──────────────┬──────────────┬──────────────┐        │
│ │ Total Scans  │ Threats Found│ Avg Latency  │        │
│ │ 12,450       │ 1,234 (9.9%) │ 6.8s         │        │
│ └──────────────┴──────────────┴──────────────┘        │
│                                                          │
│ Risk Distribution:                                      │
│ [████████ A: 45%] [████ B: 20%] [██ C: 15%]            │
│ [██ D: 10%] [█ E: 5%] [█ F: 5%]                        │
│                                                          │
│ Category Performance:                                   │
│ ┌────────────────────────────────────────────┐         │
│ │ Threat Intel: 98% accuracy (1,210 TPs)     │         │
│ │ Phishing:     95% accuracy (234 TPs)       │         │
│ │ Domain Age:   87% accuracy (false on new legitimate)│ │
│ │ SSL/TLS:      99% accuracy (12 FPs)        │         │
│ └────────────────────────────────────────────┘         │
│                                                          │
│ False Positives (Review):                              │
│ • newstartup.com → F (should be C)                     │
│ • legitimate-bank-migration.com → D (should be B)      │
│ [Review & Retrain]                                      │
│                                                          │
│ Model Performance:                                      │
│ Stage-1: 92% accuracy, 1.8s avg                        │
│ Stage-2: 95% accuracy, 4.2s avg (called 45% of time)  │
│                                                          │
│ [Export Report] [Configure Alerts] [Retrain Models]    │
└─────────────────────────────────────────────────────────┘
```

---

## ❌ MISSING: Result Presentation Features

### 8. Gemini AI Summarization Integration
**Status:** FRAMEWORK EXISTS, NOT INTEGRATED
**Required:** Auto-generate human-readable summaries

**Current:** Raw JSON output only
**Needed:** Call Gemini 1.5 Pro via Vertex AI to generate:

```typescript
{
  explanation: "This website is a phishing attack...",
  keyFindings: [
    "Flagged by Google Safe Browsing",
    "Domain only 12 days old",
    "Login form submits to different domain"
  ],
  riskAssessment: "High confidence phishing attack targeting PayPal users...",
  recommendedActions: [
    "DO NOT enter credentials",
    "Report to IT security",
    "Change PayPal password if compromised"
  ],
  technicalDetails: "Homoglyph attack using paypai.com. Hosting on Russia AS12345..."
}
```

**Implementation:** Already have Vertex AI setup, just need to:
1. Create prompt template
2. Call Gemini API in scan pipeline (after combiner)
3. Add fallback if API fails (use rule-based summary)
4. Store in `aiSummary` field of `EnhancedScanResult`

---

### 9. Screenshot Capture + Storage
**Status:** PLACEHOLDER ONLY
**Required:** Real Puppeteer integration

**Current:** `collectScreenshot()` returns `undefined`
**Needed:**
1. Launch Puppeteer browser
2. Navigate to URL
3. Capture full-page screenshot
4. Upload to GCS bucket `elara-screenshots/`
5. Return public URL
6. Optional: Run OCR (Tesseract.js) for text extraction
7. Optional: Run logo detection (Vision API)

**Implementation:**
```typescript
private async collectScreenshot(url: string): Promise<ScreenshotEvidence> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

  const screenshot = await page.screenshot({ fullPage: true });
  await browser.close();

  const filename = `${scanId}-screenshot.png`;
  const gcsUrl = await uploadToGCS(screenshot, filename);

  // Optional: OCR
  const ocrText = await performOCR(screenshot);

  // Optional: Logo detection
  const logos = await detectLogos(gcsUrl);

  return {
    url: gcsUrl,
    width: 1920,
    height: 1080,
    hasLoginForm: page.$('input[type="password"]') !== null,
    brandLogosDetected: logos,
    ocrText
  };
}
```

---

## Priority Implementation Order

### Phase 1: Core Admin APIs (1-2 days)
1. ✅ Category Configuration CRUD API
2. ✅ Granular Check Configuration API
3. ✅ Test & Calibrate API

### Phase 2: Policy & Thresholds (1 day)
4. ✅ Policy Rule Configuration API
5. ✅ Branch Threshold Configuration API

### Phase 3: Result Formatting (1 day)
6. ✅ Non-Tech User Summary Formatter
7. ✅ Technical Analyst Summary Formatter
8. ✅ Gemini AI Integration

### Phase 4: Admin UI (2-3 days)
9. ✅ Category Weight Sliders UI
10. ✅ Granular Check Drill-Down UI
11. ✅ Policy Rule Builder UI
12. ✅ Branch Threshold Configurator UI
13. ✅ Test Console UI

### Phase 5: History & Analytics (1-2 days)
14. ✅ Scan History Browser with Drill-Down
15. ✅ Analytics Dashboard

### Phase 6: Screenshot Capture (1 day)
16. ✅ Puppeteer Integration
17. ✅ GCS Upload
18. ✅ OCR & Logo Detection (optional)

---

## Comparison: What V1 Has That V2 Needs

| Feature | V1 Status | V2 Status | Priority |
|---------|-----------|-----------|----------|
| Category weight adjustment | ✅ Full UI | ❌ API only (no UI) | HIGH |
| Check-level configuration | ✅ Full UI | ❌ Not implemented | HIGH |
| Test console | ✅ Full UI | ❌ Not implemented | HIGH |
| Policy rules | ✅ Hardcoded | ❌ Hardcoded (no config) | MEDIUM |
| Threshold tuning | ✅ UI sliders | ❌ Not implemented | MEDIUM |
| Scan history | ✅ Full UI | ❌ Database only | HIGH |
| Analytics | ✅ Charts | ❌ Not implemented | MEDIUM |
| Non-tech summary | ✅ Simplified | ❌ Raw JSON only | HIGH |
| Tech summary | ✅ Detailed | ❌ Raw JSON only | HIGH |
| Screenshot capture | ❌ Not in V1 | ❌ Not implemented | LOW |
| Gemini summarization | ❌ Not in V1 | ❌ Not integrated | MEDIUM |

---

## Database Schema Changes Needed

### New Tables:

**1. v2_category_configs**
```sql
CREATE TABLE v2_category_configs (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  category_weights JSONB NOT NULL,  -- { "threat_intel": 50, ... }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

**2. v2_check_configs**
```sql
CREATE TABLE v2_check_configs (
  id UUID PRIMARY KEY,
  check_id VARCHAR(100) NOT NULL,
  category_config_id UUID REFERENCES v2_category_configs(id),
  points INT NOT NULL,
  max_points INT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  severity VARCHAR(20) NOT NULL,
  config JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

**3. v2_policy_rules**
```sql
CREATE TABLE v2_policy_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  priority INT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  condition JSONB NOT NULL,  -- { type: 'AND', clauses: [...] }
  action JSONB NOT NULL,     -- { type: 'OVERRIDE', riskLevel: 'F', ... }
  applied_count INT DEFAULT 0,
  last_applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

**4. v2_branch_thresholds**
```sql
CREATE TABLE v2_branch_thresholds (
  id UUID PRIMARY KEY,
  branch VARCHAR(20) NOT NULL,  -- ONLINE, OFFLINE, etc.
  config_id UUID REFERENCES v2_category_configs(id),
  safe_threshold FLOAT NOT NULL,
  low_threshold FLOAT NOT NULL,
  medium_threshold FLOAT NOT NULL,
  high_threshold FLOAT NOT NULL,
  critical_threshold FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**5. v2_scan_results (enhanced)**
```sql
ALTER TABLE url_scans_v2 ADD COLUMN granular_checks JSONB;
ALTER TABLE url_scans_v2 ADD COLUMN ai_summary JSONB;
ALTER TABLE url_scans_v2 ADD COLUMN non_tech_summary JSONB;
ALTER TABLE url_scans_v2 ADD COLUMN tech_summary JSONB;
ALTER TABLE url_scans_v2 ADD COLUMN screenshot_url TEXT;
ALTER TABLE url_scans_v2 ADD COLUMN config_snapshot JSONB;  -- Config used for scan
```

---

## Summary

### ✅ COMPLETED (Core Scanner)
- All 17 categories with real data collection
- Reachability-based branching
- WHOIS/DNS/TLS evidence collection
- ML rule-based analyzer
- GranularCheckResult tracking
- Policy engine framework
- V2 config service (database-backed)

### ❌ MISSING (Admin & UX)
- **APIs:** Category CRUD, Check config, Policy rules, Test/calibrate
- **UI:** Category sliders, Check drill-down, Policy builder, Test console, Analytics
- **Formatting:** Non-tech summary, Tech summary, Gemini integration
- **Features:** Screenshot capture, Scan history browser

### 🎯 NEXT STEPS
1. Start with **Test & Calibrate API** (high value, enables testing everything else)
2. Build **Result Formatters** (non-tech + tech summaries)
3. Integrate **Gemini AI** (auto-summarization)
4. Create **Admin UI** (category/check config, test console)
5. Add **Scan History Browser** (with granular drill-down)
6. Implement **Screenshot Capture** (Puppeteer + GCS)
7. Build **Analytics Dashboard** (FP/FN rates, category performance)

**Estimated Total Effort:** 8-10 working days for complete V2 admin parity with V1 + enhancements.
