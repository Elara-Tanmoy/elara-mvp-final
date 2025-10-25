# Elara URL Scanning Algorithm - Complete Technical Documentation

## System Overview

**Total Maximum Score**: 590 Points
- **Categories**: 535 points (17 categories)
- **Threat Intelligence**: 55 points (11 sources × 5 points each)
- **AI Consensus**: 0.7× to 1.3× multiplier on base score
- **False Positive Prevention**: 0.5× to 1.0× adjustment on final score

---

## Complete Scan Flow (7 Stages)

### Stage 0: Pre-Flight Checks
**Purpose**: Validate URL and check reachability before deep analysis

**Steps**:
1. **URL Validation**
   - Parse URL components (protocol, hostname, domain, TLD, path, query)
   - Extract canonical form
   - Calculate URL hash (SHA-256)
   - Validate URL format

2. **Cache Check**
   - Check if URL was scanned recently (within cache TTL)
   - If cache hit: return cached result (skip stages 1-6)

3. **Tombstone Check**
   - Check if URL is in tombstone list (known permanent verdict)
   - If tombstone: return verdict immediately

4. **Sinkhole/Blacklist Check**
   - Check if domain is in known sinkhole list
   - If sinkhole: return critical verdict immediately

5. **DNS Resolution**
   - Resolve hostname to IP address
   - Extract IP, nameservers
   - Detect DNS failures

6. **Reachability Probe**
   - Test TCP connectivity (port 80/443)
   - Test HTTP/HTTPS response
   - Measure latency
   - Detect timeouts, connection refused, etc.

7. **Pipeline Selection**
   - **Full Pipeline**: URL is reachable, proceed with all checks
   - **Partial Pipeline**: URL unreachable but domain valid, skip HTTP-based checks
   - **Minimal Pipeline**: DNS failed, only domain-based checks

**Stage 0 Output**:
```javascript
{
  validation: {
    valid: true,
    components: {
      canonical: "https://example.com/path",
      protocol: "https",
      hostname: "example.com",
      domain: "example.com",
      tld: "com",
      subdomain: "",
      path: "/path",
      query: "",
      hash: "abc123..."
    }
  },
  reachability: {
    state: "reachable", // or "unreachable", "timeout", "dns_failed"
    dns: {
      resolved: true,
      ip: "93.184.216.34",
      nameservers: ["a.iana-servers.net"]
    },
    tcp: {
      port80: true,
      port443: true
    },
    http: {
      statusCode: 200,
      responseTime: 234
    }
  },
  pipeline: "full", // or "partial", "minimal"
  shouldContinue: true,
  fastPathVerdict: null
}
```

---

### Stage 1: Category Execution (17 Categories, 535 Points)

**Purpose**: Execute all security analysis categories based on pipeline

#### Category 1: Domain Analysis (40 points max)

**Checks Performed**:

1. **Domain Age** (20 points max)
   - Query WHOIS for domain creation date
   - 0-7 days old: **+20 points** (critical)
   - 8-30 days old: **+15 points** (high)
   - 31-90 days old: **+10 points** (medium)
   - 91-180 days old: **+5 points** (low)
   - >180 days: **0 points**

2. **TLD Risk Assessment** (15 points max)
   - High-risk TLDs (.tk, .ml, .ga, .cf, .gq): **+15 points**
   - Medium-risk TLDs (.xyz, .top, .work, .date, .click, .win): **+8 points**
   - Low-risk TLDs (.info, .biz): **+3 points**
   - Trusted TLDs (.com, .net, .org, .gov, .edu): **0 points**

3. **WHOIS Data Quality** (13 points max)
   - WHOIS privacy protection enabled: **+5 points**
   - Incomplete WHOIS data (missing registrant): **+8 points**
   - Frequently abused registrar: **+3 points**

4. **Domain Pattern Analysis** (12 points max)
   - Excessive subdomain depth (>2 levels): **+7 points**
   - Suspicious domain pattern (IP in domain, excessive hyphens): **+12 points**
   - Excessive numbers in domain (>50%): **+8 points**
   - Random character sequence detected: **+7 points**

**Category Score**: Sum of all triggered checks (max 40)

---

#### Category 2: SSL Security (45 points max)

**Checks Performed**:

1. **SSL Certificate Presence**
   - No SSL certificate (HTTP only): **+25 points** (critical)
   - Certificate present: **0 points**

2. **Certificate Validity**
   - Certificate expired: **+20 points** (critical)
   - Certificate expires within 7 days: **+10 points** (high)
   - Valid certificate: **0 points**

3. **Certificate Trust**
   - Self-signed certificate: **+15 points** (high)
   - Untrusted issuer: **+12 points** (high)
   - Trusted CA: **0 points**

4. **Cipher Suite Analysis**
   - Weak cipher suite (RC4, DES, MD5): **+10 points** (medium)
   - Strong cipher suite: **0 points**

5. **Security Headers**
   - Missing HSTS header: **+8 points** (low)
   - HSTS present: **0 points**

**Category Score**: Sum of all triggered checks (max 45)

---

#### Category 3: Content Analysis (40 points max)

**Requires**: Full pipeline (HTTP fetch successful)

**Checks Performed**:

1. **Code Obfuscation**
   - Obfuscated JavaScript detected: **+15 points** (high)
   - Minified but not obfuscated: **0 points**

2. **Suspicious Keywords**
   - Malicious keywords in HTML/JS: **+10 points** (medium)
   - Common words: **0 points**

3. **Hidden Elements**
   - >5 hidden elements (display:none, visibility:hidden): **+8 points** (medium)
   - Normal hidden elements: **0 points**

4. **External Resources**
   - >20 external resources from unknown domains: **+12 points** (high)
   - CDN resources: **0 points**

**Category Score**: Sum of all triggered checks (max 40)

---

#### Category 4: Phishing Patterns (50 points max)

**Checks Performed**:

1. **Login Form Detection**
   - Password input field detected: **+20 points** (critical)
   - No login form: **0 points**

2. **Credential Harvesting**
   - Form submits to external domain: **+25 points** (critical)
   - Multiple password fields: **+15 points** (high)

3. **Brand Mimicry**
   - Domain contains popular brand name (paypal, amazon, microsoft): **+18 points** (high)
   - Levenshtein distance to known brand <3: **+15 points** (high)

4. **Urgent Language**
   - Contains "urgent", "immediate", "verify now", "suspended": **+12 points** (medium)

**Category Score**: Sum of all triggered checks (max 50)

---

#### Category 5: Malware Detection (45 points max)

**Checks Performed**:

1. **Suspicious JavaScript**
   - eval(), unescape(), fromCharCode(): **+20 points** (high)
   - document.write(): **+10 points** (medium)

2. **Auto-Download Behavior**
   - Auto-download triggered: **+25 points** (critical)
   - Download link to .exe, .scr, .bat, .vbs: **+20 points** (high)

3. **Exploit Kit Patterns**
   - Known exploit kit signatures: **+30 points** (critical)

4. **Iframe Injection**
   - >3 iframes detected: **+15 points** (high)
   - Hidden iframe: **+20 points** (high)

**Category Score**: Sum of all triggered checks (max 45)

---

#### Category 6: Behavioral JS (25 points max)

**Checks Performed**:

1. **Redirect Chain**
   - >3 redirects: **+15 points** (high)
   - Redirect to different domain: **+10 points** (medium)

2. **Dynamic Script Loading**
   - Scripts loaded from unknown CDN: **+8 points** (medium)

3. **URL Manipulation**
   - URL encoding/obfuscation: **+10 points** (medium)

**Category Score**: Sum of all triggered checks (max 25)

---

#### Category 7: Social Engineering (30 points max)

**Checks Performed**:

1. **Urgency Words** (12 points max)
   - "urgent", "immediate", "expire", "suspended", "limited", "act now"
   - Each occurrence: **+3 points** (up to 12)

2. **Authority Words** (10 points max)
   - "gov", "official", "secure", "verified", "certified"
   - Each occurrence: **+2 points** (up to 10)

3. **Fear Words** (8 points max)
   - "warning", "alert", "security", "breach", "hack", "compromised"
   - Each occurrence: **+2 points** (up to 8)

**Category Score**: Sum of all triggered checks (max 30)

---

#### Category 8: Financial Fraud (25 points max)

**Checks Performed**:

1. **Payment Keywords** (10 points max)
   - "payment", "refund", "billing", "invoice", "transaction"
   - Presence: **+10 points** (medium)

2. **Crypto Keywords** (10 points max)
   - "bitcoin", "ethereum", "crypto", "wallet", "trading", "invest"
   - Presence: **+10 points** (medium)

3. **Scam Words** (5 points max)
   - "free", "winner", "prize", "guaranteed", "earn", "cash"
   - Presence: **+5 points** (low)

**Category Score**: Sum of all triggered checks (max 25)

---

#### Category 9: Identity Theft (20 points max)

**Checks Performed**:

1. **PII Keywords** (12 points max)
   - "ssn", "social security", "passport", "driver license", "national id"
   - Presence: **+12 points** (high)

2. **Verification Requests** (8 points max)
   - "verify identity", "confirm identity", "upload document"
   - Presence: **+8 points** (medium)

**Category Score**: Sum of all triggered checks (max 20)

---

#### Category 10: Technical Exploits (15 points max)

**Checks Performed**:

1. **SQL Injection Patterns** (7 points max)
   - ', ", --, OR, SELECT, UNION in URL parameters
   - Presence: **+7 points** (medium)

2. **XSS Patterns** (5 points max)
   - <script, javascript:, onerror=, onload= in URL
   - Presence: **+5 points** (medium)

3. **Path Traversal** (3 points max)
   - ../ in URL path
   - Presence: **+3 points** (low)

**Category Score**: Sum of all triggered checks (max 15)

---

#### Category 11: Brand Impersonation (20 points max)

**Checks Performed**:

1. **External Favicon** (8 points max)
   - Favicon loaded from different domain: **+8 points** (medium)

2. **Mismatched Copyright** (7 points max)
   - Copyright mentions different company: **+7 points** (medium)

3. **External Logos** (5 points max)
   - Company logos from external domain: **+5 points** (low)

**Category Score**: Sum of all triggered checks (max 20)

---

#### Category 12: Trust Graph (30 points max)

**Checks Performed**:

1. **Historical Reputation**
   - Domain flagged in past scans: **+15 points** (high)
   - No history: **0 points**

2. **Link Analysis**
   - Links to known malicious domains: **+20 points** (high)

3. **Trust Network**
   - Low trust score from network analysis: **+10 points** (medium)

**Category Score**: Sum of all triggered checks (max 30)

---

#### Category 13: Data Protection (50 points max)

**Checks Performed**:

1. **Privacy Policy**
   - Missing privacy policy: **+20 points** (high)
   - Privacy policy present: **0 points**

2. **Cookie Consent**
   - Missing cookie consent (GDPR): **+15 points** (medium)
   - Cookie consent present: **0 points**

3. **Data Collection**
   - Excessive data collection detected: **+15 points** (medium)

**Category Score**: Sum of all triggered checks (max 50)

---

#### Category 14: Email Security (25 points max)

**Checks Performed**:

1. **SPF Record**
   - Missing SPF record: **+10 points** (medium)
   - SPF present: **0 points**

2. **DKIM**
   - Missing DKIM: **+8 points** (medium)

3. **DMARC**
   - Missing DMARC: **+7 points** (low)

**Category Score**: Sum of all triggered checks (max 25)

---

#### Category 15: Legal Compliance (35 points max)

**Checks Performed**:

1. **Terms of Service**
   - Missing ToS: **+15 points** (medium)

2. **Privacy Policy**
   - Missing privacy policy: **+15 points** (medium)

3. **Cookie Policy**
   - Missing cookie policy: **+5 points** (low)

**Category Score**: Sum of all triggered checks (max 35)

---

#### Category 16: Security Headers (25 points max)

**Checks Performed**:

1. **Content-Security-Policy**
   - Missing CSP: **+8 points** (medium)

2. **X-Frame-Options**
   - Missing X-Frame-Options: **+7 points** (medium)

3. **X-Content-Type-Options**
   - Missing X-Content-Type-Options: **+5 points** (low)

4. **Referrer-Policy**
   - Missing Referrer-Policy: **+5 points** (low)

**Category Score**: Sum of all triggered checks (max 25)

---

#### Category 17: Redirect Chain (15 points max)

**Checks Performed**:

1. **Redirect Count**
   - >3 redirects: **+15 points** (high)
   - 2-3 redirects: **+8 points** (medium)
   - 0-1 redirects: **0 points**

**Category Score**: Sum of all triggered checks (max 15)

---

**Stage 1 Output**:
```javascript
{
  baseScore: 127, // Sum of all category scores
  activeMaxScore: 535, // Total possible from active categories
  categoryResults: [
    {
      id: "domainAnalysis",
      name: "Domain Analysis",
      score: 25, // Points accumulated
      maxWeight: 40, // Max possible for this category
      status: "warning", // or "pass", "fail"
      findings: [
        {
          checkId: "domainAge_8_30_days",
          severity: "high",
          message: "Domain is only 12 days old",
          points: 15
        },
        {
          checkId: "tld_medium_risk",
          severity: "medium",
          message: "Domain uses .xyz TLD",
          points: 8
        }
      ],
      checksRun: 12,
      checksTotal: 12,
      duration: 234
    },
    // ... 16 more categories
  ],
  totalDuration: 2456
}
```

---

### Stage 2: Threat Intelligence Layer (11 Sources, 55 Points)

**Purpose**: Query external threat intelligence sources

**Sources Queried** (5 points each):

1. **Google Safe Browsing**
   - API: Google Safe Browsing API v4
   - Check: URL/domain/IP against malware/phishing database
   - Verdict: malicious (5 pts), suspicious (3 pts), safe (0 pts)
   - Timeout: 5 seconds

2. **VirusTotal**
   - API: VirusTotal API v3
   - Check: URL scan against 70+ antivirus engines
   - Verdict: malicious if >0 detections (5 pts), safe (0 pts)
   - Timeout: 10 seconds

3. **PhishTank**
   - API: PhishTank API
   - Check: URL in verified phishing database
   - Verdict: malicious if listed (5 pts), safe (0 pts)
   - Timeout: 5 seconds

4. **URLhaus**
   - API: URLhaus API (abuse.ch)
   - Check: URL in malware distribution database
   - Verdict: malicious if listed (5 pts), safe (0 pts)
   - Timeout: 5 seconds

5. **AlienVault OTX**
   - API: AlienVault Open Threat Exchange
   - Check: Domain/IP in threat indicators
   - Verdict: malicious (5 pts), suspicious (3 pts), safe (0 pts)
   - Timeout: 5 seconds

6. **AbuseIPDB**
   - API: AbuseIPDB API
   - Check: IP address reputation
   - Verdict: malicious if >50% confidence (5 pts), safe (0 pts)
   - Timeout: 5 seconds

7. **Spamhaus DBL**
   - API: DNS query to Spamhaus Domain Block List
   - Check: Domain in spam database
   - Verdict: malicious if listed (5 pts), safe (0 pts)
   - Timeout: 3 seconds

8. **SURBL**
   - API: DNS query to SURBL
   - Check: URL in spam URI realtime blocklist
   - Verdict: malicious if listed (5 pts), safe (0 pts)
   - Timeout: 3 seconds

9. **OpenPhish**
   - API: OpenPhish API
   - Check: URL in active phishing feed
   - Verdict: malicious if listed (5 pts), safe (0 pts)
   - Timeout: 5 seconds

10. **Cisco Talos**
    - API: Cisco Talos Intelligence API
    - Check: Domain/IP reputation
    - Verdict: malicious (5 pts), suspicious (3 pts), safe (0 pts)
    - Timeout: 5 seconds

11. **IBM X-Force**
    - API: IBM X-Force Exchange API
    - Check: URL/domain threat intelligence
    - Verdict: malicious (5 pts), suspicious (3 pts), safe (0 pts)
    - Timeout: 5 seconds

**Parallel Execution**: All 11 sources queried simultaneously

**Stage 2 Output**:
```javascript
{
  sources: [
    {
      source: "Google Safe Browsing",
      verdict: "safe", // or "malicious", "suspicious", "error"
      score: 0,
      confidence: 95,
      duration: 234,
      details: {
        threatType: null,
        platformType: null
      }
    },
    {
      source: "VirusTotal",
      verdict: "malicious",
      score: 5,
      confidence: 87,
      duration: 1245,
      details: {
        detections: 3,
        total: 70,
        engines: ["Fortinet", "Kaspersky", "Sophos"]
      }
    },
    // ... 9 more sources
  ],
  totalScore: 15, // Sum of all source scores
  maxScore: 55, // Max possible
  maliciousCount: 2,
  suspiciousCount: 1,
  safeCount: 8,
  errorCount: 0,
  totalDuration: 3456
}
```

---

### Stage 3: Base Score Calculation

**Purpose**: Combine category scores and TI scores

**Formula**:
```javascript
baseScore = categoryScore + tiScore
activeMaxScore = categoryMaxScore + tiMaxScore

// Example:
baseScore = 127 + 15 = 142
activeMaxScore = 535 + 55 = 590
```

**Stage 3 Output**:
```javascript
{
  baseScore: 142,
  activeMaxScore: 590,
  categoryScore: 127,
  tiScore: 15,
  basePercentage: 24.07 // (142/590) * 100
}
```

---

### Stage 4: AI Consensus Engine (3 LLMs)

**Purpose**: Multi-LLM analysis for intelligent verdict adjustment

**AI Models Used**:

1. **Claude Sonnet 4.5** (Anthropic)
   - Weight: 35%
   - Model: claude-sonnet-4-20250514
   - Timeout: 10 seconds

2. **GPT-4 Turbo** (OpenAI)
   - Weight: 35%
   - Model: gpt-4-turbo-preview
   - Timeout: 10 seconds

3. **Gemini 1.5 Flash** (Google)
   - Weight: 30%
   - Model: gemini-1.5-flash
   - Timeout: 10 seconds

**Input to Each AI**:
```javascript
{
  url: "https://example.com",
  baseScore: 142,
  activeMaxScore: 590,
  riskLevel: "medium",
  riskPercentage: 24.07,
  topFindings: [
    { category: "Domain Analysis", severity: "high", message: "Domain is 12 days old", points: 15 },
    { category: "Phishing Patterns", severity: "critical", message: "Login form detected", points: 20 },
    { category: "SSL Security", severity: "low", message: "Missing HSTS header", points: 8 },
    // ... top 10 findings
  ],
  tiSummary: {
    maliciousCount: 2,
    suspiciousCount: 1,
    safeCount: 8,
    maliciousSources: ["VirusTotal", "PhishTank"]
  }
}
```

**AI Prompt Template**:
```
You are a cybersecurity expert analyzing a URL scan. Based on the findings below, determine if the risk score should be:
- INCREASED (multiply by 1.1-1.3x) if you believe the threat is underestimated
- NEUTRAL (multiply by 1.0x) if the score is accurate
- DECREASED (multiply by 0.7-0.9x) if you believe there are false positives

URL: {url}
Current Risk Score: {baseScore}/{activeMaxScore} ({riskPercentage}%)
Current Risk Level: {riskLevel}

Key Findings:
{topFindings}

Threat Intelligence:
{tiSummary}

Provide:
1. Your verdict: INCREASE, NEUTRAL, or DECREASE
2. Confidence: 0-100%
3. Multiplier: exact value (0.7-1.3)
4. Reasoning: brief explanation
```

**AI Response Processing**:
```javascript
// Example AI responses:
{
  claude: {
    model: "claude-sonnet-4.5",
    verdict: "increase",
    confidence: 85,
    multiplier: 1.2,
    reasoning: "VirusTotal and PhishTank both flagged this URL. Combined with recent domain age, this appears to be an active phishing campaign.",
    duration: 2345
  },
  gpt4: {
    model: "gpt-4-turbo",
    verdict: "increase",
    confidence: 78,
    multiplier: 1.15,
    reasoning: "Login form on a 12-day-old domain is highly suspicious. Multiple TI sources confirm malicious activity.",
    duration: 1876
  },
  gemini: {
    model: "gemini-1.5-flash",
    verdict: "neutral",
    confidence: 65,
    multiplier: 1.0,
    reasoning: "While concerning, some findings like missing HSTS are common. Need more context.",
    duration: 1234
  }
}
```

**Consensus Calculation**:
```javascript
// Weighted average of multipliers
finalMultiplier = (claude.multiplier * 0.35) + (gpt4.multiplier * 0.35) + (gemini.multiplier * 0.30)
                = (1.2 * 0.35) + (1.15 * 0.35) + (1.0 * 0.30)
                = 0.42 + 0.4025 + 0.30
                = 1.1225

// Agreement rate
agreementRate = (number of models with same verdict / total models) * 100
              = (2/3) * 100 = 66.67%

// Average confidence
averageConfidence = (85 + 78 + 65) / 3 = 76%

// Apply multiplier
finalScore = baseScore * finalMultiplier
           = 142 * 1.1225
           = 159 (rounded)
```

**Stage 4 Output**:
```javascript
{
  models: [
    {
      model: "claude-sonnet-4.5",
      verdict: "increase",
      confidence: 85,
      multiplier: 1.2,
      reasoning: "...",
      duration: 2345
    },
    {
      model: "gpt-4-turbo",
      verdict: "increase",
      confidence: 78,
      multiplier: 1.15,
      reasoning: "...",
      duration: 1876
    },
    {
      model: "gemini-1.5-flash",
      verdict: "neutral",
      confidence: 65,
      multiplier: 1.0,
      reasoning: "...",
      duration: 1234
    }
  ],
  finalMultiplier: 1.1225,
  agreementRate: 66.67,
  averageConfidence: 76,
  consensusVerdict: "increase",
  modelVotes: { increase: 2, neutral: 1, decrease: 0 },
  totalDuration: 5455
}
```

---

### Stage 5: False Positive Prevention

**Purpose**: Reduce false positives using legitimacy indicators

**Checks Performed**:

1. **CDN Detection**
   - Check if IP belongs to known CDN (Cloudflare, Akamai, Fastly, etc.)
   - CDN detected: Legitimacy +20

2. **RIOT Check** (Greynoise)
   - Check if IP is known good infrastructure
   - RIOT detected: Legitimacy +25

3. **Government/Educational Check**
   - Domain ends in .gov, .edu, .int, .mil
   - Government/edu detected: Legitimacy +30

4. **Legitimacy Indicators** (0-100 score)
   - Valid SSL certificate: +15
   - Domain age >1 year: +10
   - Domain age >3 years: +15
   - Has privacy policy: +10
   - Has contact information: +10
   - Has social media links: +5
   - No negative TI detections: +10
   - WHOIS data complete: +5
   - Uses known hosting (AWS, GCP, Azure): +10

**Adjustment Calculation**:
```javascript
// Calculate legitimacy score
legitimacyScore = sum of legitimacy indicators (0-100)

// Determine adjustment multiplier
if (legitimacyScore >= 80) {
  adjustmentMultiplier = 0.5; // Halve the score
} else if (legitimacyScore >= 60) {
  adjustmentMultiplier = 0.7;
} else if (legitimacyScore >= 40) {
  adjustmentMultiplier = 0.85;
} else {
  adjustmentMultiplier = 1.0; // No adjustment
}

// Apply adjustment
scoreBeforeFP = 159 // from AI consensus
finalScore = scoreBeforeFP * adjustmentMultiplier
           = 159 * 0.85 // if legitimacy = 55
           = 135 (rounded)
```

**Stage 5 Output**:
```javascript
{
  cdnCheck: {
    isCDN: false,
    provider: null
  },
  riotCheck: {
    isRIOT: false,
    classification: null
  },
  govCheck: {
    isGovernment: false,
    isEducational: false,
    isInternational: false
  },
  legitimacyIndicators: {
    validSSL: true, // +15
    domainAgeOver1Year: true, // +10
    domainAgeOver3Years: false,
    hasPrivacyPolicy: false,
    hasContactInfo: true, // +10
    hasSocialLinks: true, // +5
    noTIDetections: false,
    completeWhois: true, // +5
    knownHosting: true // +10
  },
  legitimacyScore: 55,
  scoreAdjustment: -24, // 159 * 0.85 = 135, so -24
  adjustmentMultiplier: 0.85,
  recommendation: "Apply 0.85x adjustment due to moderate legitimacy signals",
  evidence: [
    "Valid SSL certificate",
    "Domain age >1 year",
    "Has contact information",
    "Has social media links",
    "Complete WHOIS data",
    "Hosted on AWS"
  ]
}
```

---

### Stage 6: Risk Level Determination

**Purpose**: Convert final score to risk level and percentage

**Risk Thresholds** (percentage of max score):

| Risk Level | Threshold | Score Range (590 max) | Color |
|------------|-----------|------------------------|-------|
| **safe** | 0-15% | 0-88 points | Green (#10b981) |
| **low** | 15-30% | 89-177 points | Blue (#3b82f6) |
| **medium** | 30-60% | 178-354 points | Yellow (#f59e0b) |
| **high** | 60-80% | 355-472 points | Orange (#ef4444) |
| **critical** | 80-100% | 473-590 points | Red (#991b1b) |

**Calculation**:
```javascript
finalScore = 135 // from Stage 5
activeMaxScore = 590

// Calculate percentage
riskPercentage = (finalScore / activeMaxScore) * 100
               = (135 / 590) * 100
               = 22.88%

// Determine risk level
if (riskPercentage >= 80) {
  riskLevel = "critical";
} else if (riskPercentage >= 60) {
  riskLevel = "high";
} else if (riskPercentage >= 30) {
  riskLevel = "medium";
} else if (riskPercentage >= 15) {
  riskLevel = "low";
} else {
  riskLevel = "safe";
}

// Result:
riskLevel = "low" // because 22.88% is in 15-30% range
```

**Stage 6 Output**:
```javascript
{
  finalScore: 135,
  activeMaxScore: 590,
  riskPercentage: 22.88,
  riskLevel: "low",
  color: "#3b82f6",
  description: "Low Risk - Minor concerns detected"
}
```

---

## Complete Scan Result

**Final Output** (returned to API):
```javascript
{
  // URL Information
  url: "https://example.com",
  urlComponents: {
    canonical: "https://example.com",
    protocol: "https",
    hostname: "example.com",
    domain: "example.com",
    tld: "com",
    subdomain: "",
    path: "/",
    query: "",
    hash: "abc123..."
  },

  // Reachability
  reachabilityState: "reachable",
  pipelineUsed: "full",

  // Scoring
  baseScore: 142, // Categories (127) + TI (15)
  aiMultiplier: 1.1225, // AI consensus
  finalScore: 135, // After false positive adjustment
  activeMaxScore: 590,
  riskPercentage: 22.88,
  riskLevel: "low",

  // Detailed Results
  categories: [
    {
      id: "domainAnalysis",
      name: "Domain Analysis",
      score: 25,
      maxWeight: 40,
      percentage: 62.5,
      status: "warning",
      findings: [
        {
          checkId: "domainAge_8_30_days",
          severity: "high",
          message: "Domain is only 12 days old",
          points: 15,
          details: { ageInDays: 12 }
        },
        {
          checkId: "tld_medium_risk",
          severity: "medium",
          message: "Domain uses .xyz TLD",
          points: 8
        }
      ],
      checksRun: 12,
      checksTotal: 12,
      duration: 234
    },
    // ... 16 more categories
  ],

  tiResults: [
    {
      source: "Google Safe Browsing",
      verdict: "safe",
      score: 0,
      confidence: 95,
      duration: 234,
      details: {}
    },
    {
      source: "VirusTotal",
      verdict: "malicious",
      score: 5,
      confidence: 87,
      duration: 1245,
      details: {
        detections: 3,
        total: 70,
        engines: ["Fortinet", "Kaspersky", "Sophos"]
      }
    },
    // ... 9 more sources
  ],

  aiAnalysis: {
    models: [
      {
        model: "claude-sonnet-4.5",
        verdict: "increase",
        confidence: 85,
        multiplier: 1.2,
        reasoning: "VirusTotal and PhishTank detections combined with recent domain age indicate active phishing.",
        duration: 2345
      },
      {
        model: "gpt-4-turbo",
        verdict: "increase",
        confidence: 78,
        multiplier: 1.15,
        reasoning: "Multiple suspicious indicators including login form on new domain.",
        duration: 1876
      },
      {
        model: "gemini-1.5-flash",
        verdict: "neutral",
        confidence: 65,
        multiplier: 1.0,
        reasoning: "Some findings are common web patterns, but TI detections are concerning.",
        duration: 1234
      }
    ],
    finalMultiplier: 1.1225,
    agreementRate: 66.67,
    averageConfidence: 76,
    consensusVerdict: "increase",
    totalDuration: 5455
  },

  falsePositiveChecks: {
    cdnCheck: false,
    riotCheck: false,
    govCheck: false,
    legitimacyIndicators: {
      validSSL: true,
      domainAgeOver1Year: true,
      hasContactInfo: true,
      hasSocialLinks: true,
      completeWhois: true,
      knownHosting: true
    },
    legitimacyScore: 55,
    scoreAdjustment: -24,
    adjustmentMultiplier: 0.85,
    recommendation: "Apply 0.85x adjustment",
    evidence: [
      "Valid SSL certificate",
      "Domain age >1 year",
      "Has contact information"
    ]
  },

  // Performance
  scanDuration: 8976, // Total time in ms
  performanceMetrics: {
    stage0: 456,
    categories: 2456,
    tiLayer: 3456,
    aiConsensus: 5455,
    finalization: 123
  },

  // Metadata
  timestamp: "2025-10-25T10:30:45.123Z",
  metadata: {
    scanId: "scan_1729854645123_abc123",
    duration: 8976,
    timestamp: "2025-10-25T10:30:45.123Z",
    configurationId: "default",
    configurationName: "Default Configuration"
  },

  cacheStatus: {
    hit: false,
    saved: true
  }
}
```

---

## Risk Level Classification Logic

### Classification Algorithm

```javascript
function calculateRiskLevel(finalScore, maxScore) {
  const percentage = (finalScore / maxScore) * 100;

  const thresholds = {
    safe: 15,      // 0-15%
    low: 30,       // 15-30%
    medium: 60,    // 30-60%
    high: 80,      // 60-80%
    critical: 100  // 80-100%
  };

  if (percentage >= thresholds.high) return 'critical';
  if (percentage >= thresholds.medium) return 'high';
  if (percentage >= thresholds.low) return 'medium';
  if (percentage >= thresholds.safe) return 'low';
  return 'safe';
}
```

### Risk Level Descriptions

#### SAFE (0-15%, 0-88 points)
**Color**: Green (#10b981)
**User Message**: "This link appears to be SAFE"
**Description**: No significant threats detected. The URL passed most security checks.
**Recommendation**: Safe to visit
**Typical Characteristics**:
- Old, established domain (>1 year)
- Valid SSL certificate
- No TI detections
- No phishing/malware patterns
- Complete WHOIS data
- Known hosting provider

**Example**: google.com, amazon.com, microsoft.com

---

#### LOW (15-30%, 89-177 points)
**Color**: Blue (#3b82f6)
**User Message**: "This link seems mostly safe, but be careful"
**Description**: Minor concerns detected. Some low-severity findings but no critical threats.
**Recommendation**: Generally safe, but exercise caution
**Typical Characteristics**:
- New domain (30-90 days) but legitimate business
- Valid SSL but missing security headers
- Login form but on expected domain
- 1-2 TI sources flagged with low confidence
- Some suspicious keywords in legitimate context

**Example**: New startup website, recently launched e-commerce site

---

#### MEDIUM (30-60%, 178-354 points)
**Color**: Yellow (#f59e0b)
**User Message**: "WARNING: This link might be dangerous"
**Description**: Multiple concerns detected. Significant risk indicators present.
**Recommendation**: Use caution. Avoid entering personal information.
**Typical Characteristics**:
- Very new domain (<30 days)
- Multiple phishing patterns detected
- 3-5 TI sources flagged
- Login form on suspicious domain
- Suspicious TLD (.tk, .ml, .xyz)
- Obfuscated code or hidden elements
- Missing privacy policy/contact info

**Example**: Suspicious promotional sites, questionable offers

---

#### HIGH (60-80%, 355-472 points)
**Color**: Orange (#ef4444)
**User Message**: "DANGER: This link is likely a scam"
**Description**: Significant threats detected. High probability of malicious intent.
**Recommendation**: Do not visit. Do not enter any information.
**Typical Characteristics**:
- Brand impersonation detected
- Multiple TI sources flagged (5-8)
- Credential harvesting patterns
- Urgent/threatening language
- Auto-download behavior
- Known exploit patterns
- No legitimate business indicators

**Example**: Phishing sites mimicking banks, fake tech support

---

#### CRITICAL (80-100%, 473-590 points)
**Color**: Red (#991b1b)
**User Message**: "DANGER: DO NOT CLICK THIS LINK!"
**Description**: Severe threats detected. Confirmed malicious activity.
**Recommendation**: Do not visit under any circumstances. Report to authorities.
**Typical Characteristics**:
- Listed in PhishTank/URLhaus
- 10+ VirusTotal engine detections
- Active malware distribution
- Confirmed phishing campaign
- Exploit kit detected
- Google Safe Browsing flagged
- Multiple critical findings

**Example**: Active phishing campaigns, malware distribution sites

---

## Summary

### Scoring Breakdown
```
Total Maximum Score: 590 points

Categories (535 points):
├── Domain Analysis: 40
├── SSL Security: 45
├── Content Analysis: 40
├── Phishing Patterns: 50
├── Malware Detection: 45
├── Behavioral JS: 25
├── Social Engineering: 30
├── Financial Fraud: 25
├── Identity Theft: 20
├── Technical Exploits: 15
├── Brand Impersonation: 20
├── Trust Graph: 30
├── Data Protection: 50
├── Email Security: 25
├── Legal Compliance: 35
├── Security Headers: 25
└── Redirect Chain: 15

Threat Intelligence (55 points):
├── Google Safe Browsing: 5
├── VirusTotal: 5
├── PhishTank: 5
├── URLhaus: 5
├── AlienVault OTX: 5
├── AbuseIPDB: 5
├── Spamhaus DBL: 5
├── SURBL: 5
├── OpenPhish: 5
├── Cisco Talos: 5
└── IBM X-Force: 5

AI Consensus Multiplier: 0.7x - 1.3x
False Positive Adjustment: 0.5x - 1.0x
```

### Scan Duration Breakdown
```
Average Scan Time: 5-10 seconds

Stage 0 (Pre-Flight): 0.5-1s
├── DNS resolution: 100-300ms
├── TCP probe: 100-200ms
└── HTTP fetch: 200-500ms

Stage 1 (Categories): 1-3s
├── Domain analysis: 200-500ms (WHOIS query)
├── SSL analysis: 100-300ms
├── Content analysis: 500-1000ms (HTML parsing)
└── Other categories: 200-1000ms

Stage 2 (Threat Intelligence): 3-5s
├── API calls (parallel): 3-5s
└── Timeout handling: variable

Stage 3 (Base Score): <1ms
├── Simple addition

Stage 4 (AI Consensus): 3-8s
├── Claude API: 1-3s
├── GPT-4 API: 1-3s
└── Gemini API: 1-2s

Stage 5 (False Positive): 100-500ms
├── CDN check: 50-100ms
├── RIOT check: 50-100ms
├── Legitimacy calculation: <1ms

Stage 6 (Risk Level): <1ms
├── Threshold comparison
```

### Configuration Presets

**Balanced (Default)**: 590 max score
- All categories enabled
- All TI sources enabled
- AI consensus: 0.7-1.3x
- FP adjustment: 0.5-1.0x

**Strict**: 700 max score
- Higher weights on all categories
- Tighter risk thresholds
- More aggressive flagging

**Permissive**: 450 max score
- Lower weights on common patterns
- Higher risk thresholds
- Fewer false positives

**Enterprise**: 600 max score
- Focus on data protection & compliance
- Business verification emphasis
- Balanced for corporate environments

**Fast**: 400 max score
- Skip slow checks
- Use only fast TI sources (Google, VirusTotal, PhishTank)
- Reduce AI timeout

---

## API Endpoints

### POST /v2/scan/url
**Request**:
```json
{
  "url": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scanId": "scan_1729854645123_abc123",
    "url": "https://example.com",
    "riskLevel": "low",
    "riskPercentage": 22.88,
    "finalScore": 135,
    "activeMaxScore": 590,
    "verdict": "This link seems mostly safe, but be careful",
    "timestamp": "2025-10-25T10:30:45.123Z"
  }
}
```

### GET /v2/scans/:scanId
**Response**: Complete scan result object (as documented above)

---

*End of Documentation*
