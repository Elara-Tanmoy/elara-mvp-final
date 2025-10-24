# Elara Platform - Comprehensive 350-Point Scoring System

**Complete Technical Risk Assessment Framework**
**Last Updated:** 2025-10-24
**Status:** Production

---

## 📊 Complete Scoring Breakdown (350 Points Total)

### 1. Domain & Registration Analysis (40 points)

#### Domain Age & History (27 points)
```typescript
const domainAgeScoring = {
  '0-7 days': 20,
  '8-30 days': 15,
  '31-90 days': 10,
  '91-365 days': 5,
  '1-2 years': 2,
  'frequentOwnershipChanges': 8,
  'domainParkingHistory': 5,
  'previousMaliciousUse': 12
};

// Implementation
async analyzeDomainAge(domain: string) {
  const whoisData = await whois(domain);
  const createdDate = new Date(whoisData.creationDate);
  const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

  let score = 0;
  let findings = [];

  // Age-based scoring
  if (ageInDays < 7) {
    score += 20;
    findings.push({
      check: 'Domain Age',
      result: `${Math.floor(ageInDays)} days old`,
      severity: 'CRITICAL',
      points: 20,
      maxPoints: 20,
      explanation: 'Domain registered less than 7 days ago - extremely high risk for phishing/scam sites'
    });
  } else if (ageInDays < 30) {
    score += 15;
    findings.push({
      check: 'Domain Age',
      result: `${Math.floor(ageInDays)} days old`,
      severity: 'HIGH',
      points: 15,
      maxPoints: 20,
      explanation: 'Very new domain (under 30 days) - high risk indicator'
    });
  }
  // ... continue for other age ranges

  return { score, findings, maxScore: 27 };
}
```

**Data Sources:**
- WHOIS API (whois-json npm package)
- Internet Archive Wayback Machine API
- Domain history databases

#### WHOIS & Registration (13 points)
```typescript
const whoisScoring = {
  'privateRegistration': 6,
  'suspiciousRegistrar': 4,
  'bulkRegistration': 5,
  'contactInconsistencies': 6,
  'multipleSimilarDomains': 7
};

async analyzeWhoisPatterns(whoisData: any) {
  let score = 0;
  let findings = [];

  // Privacy protection detection
  const privacyKeywords = ['privacy', 'protected', 'redacted', 'proxy', 'whoisguard'];
  const registrantOrg = whoisData.registrant?.organization?.toLowerCase() || '';

  if (privacyKeywords.some(kw => registrantOrg.includes(kw))) {
    score += 6;
    findings.push({
      check: 'WHOIS Privacy',
      result: 'Privacy protection enabled',
      severity: 'MEDIUM',
      points: 6,
      maxPoints: 6,
      explanation: 'WHOIS privacy hides owner identity - common in malicious sites'
    });
  }

  // Suspicious registrar patterns
  const suspiciousRegistrars = ['namecheap', 'godaddy', 'enom', 'publicdomainregistry'];
  const registrar = whoisData.registrar?.toLowerCase() || '';

  if (suspiciousRegistrars.some(sr => registrar.includes(sr))) {
    score += 4;
    findings.push({
      check: 'Registrar Reputation',
      result: whoisData.registrar,
      severity: 'MEDIUM',
      points: 4,
      maxPoints: 4,
      explanation: 'Registrar known for high abuse rates'
    });
  }

  return { score, findings, maxScore: 13 };
}
```

---

### 2. Network Security & Infrastructure (45 points)

#### SSL/TLS Analysis (32 points)
```typescript
const sslScoring = {
  'noSSL': 15,
  'selfSigned': 12,
  'expiredInvalid': 10,
  'weakCiphers': 6,
  'certificateTransparency': 4,
  'mixedContent': 5
};

async analyzeSSL(url: URL) {
  let score = 0;
  let findings = [];

  if (!url.protocol.includes('https')) {
    score += 15;
    findings.push({
      check: 'SSL/TLS Encryption',
      result: 'No HTTPS',
      severity: 'CRITICAL',
      points: 15,
      maxPoints: 15,
      explanation: 'No SSL/TLS encryption - all data transmitted in plain text'
    });
    return { score, findings, maxScore: 32 };
  }

  // Connect via TLS and analyze certificate
  const options = {
    host: url.hostname,
    port: 443,
    rejectUnauthorized: false
  };

  return new Promise((resolve) => {
    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate();

      // Check expiration
      const validTo = new Date(cert.valid_to);
      if (validTo < new Date()) {
        score += 10;
        findings.push({
          check: 'Certificate Validity',
          result: 'Expired certificate',
          severity: 'CRITICAL',
          points: 10,
          maxPoints: 10,
          explanation: `Certificate expired on ${validTo.toISOString()}`
        });
      }

      // Check for self-signed
      if (cert.issuer.CN === cert.subject.CN) {
        score += 12;
        findings.push({
          check: 'Certificate Authority',
          result: 'Self-signed certificate',
          severity: 'CRITICAL',
          points: 12,
          maxPoints: 12,
          explanation: 'Certificate not issued by trusted CA'
        });
      }

      // Check cipher suite
      const cipher = socket.getCipher();
      if (cipher.version !== 'TLSv1.3' && cipher.version !== 'TLSv1.2') {
        score += 6;
        findings.push({
          check: 'TLS Version',
          result: cipher.version,
          severity: 'HIGH',
          points: 6,
          maxPoints: 6,
          explanation: 'Using outdated TLS version'
        });
      }

      socket.end();
      resolve({ score, findings, maxScore: 32 });
    });

    socket.on('error', () => {
      score += 15;
      findings.push({
        check: 'SSL/TLS Connection',
        result: 'Connection failed',
        severity: 'CRITICAL',
        points: 15,
        maxPoints: 32,
        explanation: 'Unable to establish secure connection'
      });
      resolve({ score, findings, maxScore: 32 });
    });
  });
}
```

#### MITM Attack Vulnerability (18 points)
```typescript
async analyzeMITMRisk(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString(), {
    validateStatus: () => true
  });

  // Check HSTS header
  if (!response.headers['strict-transport-security']) {
    score += 8;
    findings.push({
      check: 'HSTS Header',
      result: 'Missing',
      severity: 'HIGH',
      points: 8,
      maxPoints: 8,
      explanation: 'No HTTP Strict Transport Security - vulnerable to SSL stripping'
    });
  }

  // Check for insecure redirects
  if (response.request.res.responseUrl !== url.toString()) {
    const redirectChain = response.request._redirectable._redirectCount;
    if (redirectChain > 0) {
      score += 7;
      findings.push({
        check: 'Redirect Security',
        result: `${redirectChain} redirects detected`,
        severity: 'MEDIUM',
        points: 7,
        maxPoints: 7,
        explanation: 'Multiple redirects increase MITM attack surface'
      });
    }
  }

  return { score, findings, maxScore: 18 };
}
```

#### Network Infrastructure (32 points)
```typescript
async analyzeNetworkInfrastructure(domain: string) {
  let score = 0;
  let findings = [];

  // Get IP address
  const ips = await dns.promises.resolve4(domain);
  const ip = ips[0];

  // AbuseIPDB check (free tier: 1000/day)
  const abuseData = await axios.get(
    `https://api.abuseipdb.com/api/v2/check`,
    {
      params: { ipAddress: ip, maxAgeInDays: 90 },
      headers: { Key: process.env.ABUSEIPDB_API_KEY }
    }
  );

  if (abuseData.data.data.abuseConfidenceScore > 50) {
    score += 10;
    findings.push({
      check: 'IP Reputation',
      result: `${abuseData.data.data.abuseConfidenceScore}% abuse confidence`,
      severity: 'CRITICAL',
      points: 10,
      maxPoints: 10,
      explanation: `IP flagged in ${abuseData.data.data.totalReports} abuse reports`
    });
  }

  // ASN analysis using BGPView (free)
  const asnData = await axios.get(`https://api.bgpview.io/ip/${ip}`);
  const asn = asnData.data.data.prefixes[0]?.asn.asn;

  // Check for suspicious ASN patterns
  const suspiciousASNs = [/* known bad ASNs */];
  if (suspiciousASNs.includes(asn)) {
    score += 5;
    findings.push({
      check: 'ASN Reputation',
      result: `AS${asn}`,
      severity: 'HIGH',
      points: 5,
      maxPoints: 5,
      explanation: 'ASN associated with malicious activity'
    });
  }

  // Shodan InternetDB for exposed services
  const shodanData = await axios.get(`https://internetdb.shodan.io/${ip}`);
  const openPorts = shodanData.data.ports || [];

  if (openPorts.length > 5) {
    score += 7;
    findings.push({
      check: 'Exposed Services',
      result: `${openPorts.length} open ports`,
      severity: 'MEDIUM',
      points: 7,
      maxPoints: 7,
      explanation: 'Unusually high number of exposed services'
    });
  }

  return { score, findings, maxScore: 32 };
}
```

---

### 3. Data Protection & Privacy Risks (50 points)

#### Privacy Policy Compliance (36 points)
```typescript
async analyzePrivacyCompliance(url: URL) {
  let score = 0;
  let findings = [];

  // Fetch homepage
  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);

  // Look for privacy policy link
  const privacyLinks = $('a[href*="privacy"], a:contains("Privacy Policy")');

  if (privacyLinks.length === 0) {
    score += 15;
    findings.push({
      check: 'Privacy Policy',
      result: 'Not found',
      severity: 'CRITICAL',
      points: 15,
      maxPoints: 15,
      explanation: 'No privacy policy found - serious compliance violation'
    });
    return { score, findings, maxScore: 36 };
  }

  // Fetch and analyze privacy policy
  const privacyUrl = privacyLinks.first().attr('href');
  const privacyResponse = await axios.get(new URL(privacyUrl, url).toString());
  const privacyText = cheerio.load(privacyResponse.data).text().toLowerCase();

  // Check for GDPR compliance
  const gdprKeywords = ['gdpr', 'general data protection', 'data subject rights', 'right to erasure'];
  const hasGDPR = gdprKeywords.some(kw => privacyText.includes(kw));

  if (!hasGDPR) {
    score += 8;
    findings.push({
      check: 'GDPR Compliance',
      result: 'No GDPR disclosures found',
      severity: 'HIGH',
      points: 8,
      maxPoints: 8,
      explanation: 'Missing required GDPR compliance information'
    });
  }

  // Check for CCPA compliance
  const ccpaKeywords = ['ccpa', 'california consumer privacy', 'do not sell'];
  const hasCCPA = ccpaKeywords.some(kw => privacyText.includes(kw));

  if (!hasCCPA) {
    score += 6;
    findings.push({
      check: 'CCPA Compliance',
      result: 'No CCPA disclosures found',
      severity: 'MEDIUM',
      points: 6,
      maxPoints: 6,
      explanation: 'Missing California privacy law compliance'
    });
  }

  return { score, findings, maxScore: 36 };
}
```

#### User Data Leak Risk (48 points)
```typescript
async analyzeDataLeakRisk(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);

  // Check for unsecured forms
  const forms = $('form');
  forms.each((i, form) => {
    const action = $(form).attr('action');
    const method = $(form).attr('method')?.toLowerCase();

    // Check for forms submitting over HTTP
    if (action && action.startsWith('http://')) {
      score += 12;
      findings.push({
        check: 'Form Security',
        result: 'Form submits over HTTP',
        severity: 'CRITICAL',
        points: 12,
        maxPoints: 12,
        explanation: 'Form data transmitted without encryption'
      });
    }

    // Check for input validation
    const inputs = $(form).find('input');
    let hasValidation = false;
    inputs.each((j, input) => {
      if ($(input).attr('required') || $(input).attr('pattern')) {
        hasValidation = true;
      }
    });

    if (!hasValidation) {
      score += 8;
      findings.push({
        check: 'Input Validation',
        result: 'No client-side validation',
        severity: 'HIGH',
        points: 8,
        maxPoints: 8,
        explanation: 'Forms lack basic input validation'
      });
    }
  });

  // Check for exposed directories
  const exposedPaths = ['/.git', '/.env', '/admin', '/backup', '/config'];
  for (const path of exposedPaths) {
    try {
      const testResponse = await axios.get(new URL(path, url).toString(), {
        validateStatus: (status) => status < 500
      });
      if (testResponse.status === 200) {
        score += 10;
        findings.push({
          check: 'Directory Exposure',
          result: `Exposed path: ${path}`,
          severity: 'CRITICAL',
          points: 10,
          maxPoints: 10,
          explanation: 'Sensitive directory publicly accessible'
        });
        break; // Only count once
      }
    } catch {}
  }

  return { score, findings, maxScore: 48 };
}
```

---

### 4. Email Security & DMARC Compliance (25 points)

```typescript
async analyzeEmailSecurity(domain: string) {
  let score = 0;
  let findings = [];

  // Check SPF record
  try {
    const spfRecords = await dns.promises.resolveTxt(domain);
    const hasSPF = spfRecords.some(record =>
      record.some(part => part.startsWith('v=spf1'))
    );

    if (!hasSPF) {
      score += 6;
      findings.push({
        check: 'SPF Record',
        result: 'Missing',
        severity: 'HIGH',
        points: 6,
        maxPoints: 6,
        explanation: 'No SPF record - emails can be easily spoofed'
      });
    }
  } catch {
    score += 6;
    findings.push({
      check: 'SPF Record',
      result: 'Not found',
      severity: 'HIGH',
      points: 6,
      maxPoints: 6,
      explanation: 'Domain has no SPF configuration'
    });
  }

  // Check DMARC policy
  try {
    const dmarcRecords = await dns.promises.resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = dmarcRecords.flat().find(r => r.startsWith('v=DMARC1'));

    if (!dmarcRecord) {
      score += 8;
      findings.push({
        check: 'DMARC Policy',
        result: 'Missing',
        severity: 'CRITICAL',
        points: 8,
        maxPoints: 8,
        explanation: 'No DMARC policy - no email authentication enforcement'
      });
    } else {
      // Check DMARC policy strength
      if (dmarcRecord.includes('p=none')) {
        score += 4;
        findings.push({
          check: 'DMARC Policy',
          result: 'Weak (p=none)',
          severity: 'MEDIUM',
          points: 4,
          maxPoints: 4,
          explanation: 'DMARC policy set to monitoring only'
        });
      }
    }
  } catch {
    score += 8;
    findings.push({
      check: 'DMARC Policy',
      result: 'Not found',
      severity: 'CRITICAL',
      points: 8,
      maxPoints: 8,
      explanation: 'No DMARC record configured'
    });
  }

  // Check DKIM (common selectors)
  const dkimSelectors = ['default', 'google', 'mail', 'k1'];
  let hasDKIM = false;

  for (const selector of dkimSelectors) {
    try {
      await dns.promises.resolveTxt(`${selector}._domainkey.${domain}`);
      hasDKIM = true;
      break;
    } catch {}
  }

  if (!hasDKIM) {
    score += 5;
    findings.push({
      check: 'DKIM Signature',
      result: 'Not configured',
      severity: 'HIGH',
      points: 5,
      maxPoints: 5,
      explanation: 'No DKIM found - emails lack cryptographic verification'
    });
  }

  return { score, findings, maxScore: 25 };
}
```

---

### 5. Content Security & Social Engineering (60 points)

#### Social Engineering Patterns (35 points)
```typescript
async detectSocialEngineering(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);
  const pageText = $.text().toLowerCase();

  // Urgency tactics
  const urgencyKeywords = [
    'urgent', 'act now', 'immediately', 'expires today', 'last chance',
    'limited time', 'hurry', 'deadline', 'final notice', 'time sensitive'
  ];
  const urgencyCount = urgencyKeywords.filter(kw => pageText.includes(kw)).length;

  if (urgencyCount > 2) {
    score += 8;
    findings.push({
      check: 'Urgency Tactics',
      result: `${urgencyCount} urgency keywords found`,
      severity: 'HIGH',
      points: 8,
      maxPoints: 8,
      explanation: 'Excessive urgency language - pressure tactic indicator',
      keywords: urgencyKeywords.filter(kw => pageText.includes(kw))
    });
  }

  // Authority impersonation
  const authorityKeywords = [
    'government', 'irs', 'fbi', 'police', 'official', 'authorized',
    'department', 'agency', 'administration', 'ministry'
  ];
  const authorityCount = authorityKeywords.filter(kw => pageText.includes(kw)).length;

  if (authorityCount > 2) {
    score += 10;
    findings.push({
      check: 'Authority Impersonation',
      result: `${authorityCount} authority terms found`,
      severity: 'CRITICAL',
      points: 10,
      maxPoints: 10,
      explanation: 'Impersonating government/authority - common scam tactic',
      keywords: authorityKeywords.filter(kw => pageText.includes(kw))
    });
  }

  // Fear-based manipulation
  const fearKeywords = [
    'suspended', 'locked', 'blocked', 'terminated', 'deactivated',
    'violation', 'warning', 'penalty', 'consequences', 'legal action'
  ];
  const fearCount = fearKeywords.filter(kw => pageText.includes(kw)).length;

  if (fearCount > 2) {
    score += 8;
    findings.push({
      check: 'Fear Tactics',
      result: `${fearCount} fear-inducing terms found`,
      severity: 'HIGH',
      points: 8,
      maxPoints: 8,
      explanation: 'Using fear to manipulate user actions',
      keywords: fearKeywords.filter(kw => pageText.includes(kw))
    });
  }

  return { score, findings, maxScore: 35 };
}
```

#### Credential Harvesting (34 points)
```typescript
async detectCredentialHarvesting(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);

  // Detect fake login forms
  const loginForms = $('form:has(input[type="password"])');

  if (loginForms.length > 0) {
    loginForms.each((i, form) => {
      const action = $(form).attr('action');
      const formDomain = action ? new URL(action, url).hostname : url.hostname;

      // Check if form submits to different domain
      if (formDomain !== url.hostname) {
        score += 12;
        findings.push({
          check: 'Login Form',
          result: 'Submits to external domain',
          severity: 'CRITICAL',
          points: 12,
          maxPoints: 12,
          explanation: `Form submits credentials to ${formDomain}`,
          evidence: action
        });
      }
    });
  }

  // Detect excessive data collection
  const sensitiveInputs = $('input[type="text"], input[type="email"], input[type="tel"]');
  const labels = [];

  sensitiveInputs.each((i, input) => {
    const name = $(input).attr('name')?.toLowerCase() || '';
    const placeholder = $(input).attr('placeholder')?.toLowerCase() || '';
    const label = $(input).parent().find('label').text().toLowerCase();

    if (
      name.includes('ssn') || name.includes('social') ||
      placeholder.includes('ssn') || placeholder.includes('social') ||
      label.includes('social security')
    ) {
      score += 8;
      findings.push({
        check: 'Sensitive Data Collection',
        result: 'Requests Social Security Number',
        severity: 'CRITICAL',
        points: 8,
        maxPoints: 8,
        explanation: 'Legitimate sites rarely request SSN'
      });
    }
  });

  return { score, findings, maxScore: 34 };
}
```

#### Technical Content Issues (45 points)
```typescript
async analyzeTechnicalContent(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);

  // Detect malicious JavaScript
  const scripts = $('script');
  let hasObfuscation = false;
  let hasEval = false;

  scripts.each((i, script) => {
    const scriptContent = $(script).html() || '';

    // Check for eval() usage
    if (scriptContent.includes('eval(')) {
      hasEval = true;
    }

    // Check for obfuscation patterns
    if (
      scriptContent.includes('\\x') ||
      scriptContent.includes('String.fromCharCode') ||
      scriptContent.includes('unescape(')
    ) {
      hasObfuscation = true;
    }
  });

  if (hasEval) {
    score += 10;
    findings.push({
      check: 'JavaScript Analysis',
      result: 'eval() detected',
      severity: 'CRITICAL',
      points: 10,
      maxPoints: 10,
      explanation: 'eval() can execute arbitrary code - major security risk'
    });
  }

  if (hasObfuscation) {
    score += 6;
    findings.push({
      check: 'Code Obfuscation',
      result: 'Obfuscated JavaScript detected',
      severity: 'HIGH',
      points: 6,
      maxPoints: 6,
      explanation: 'Obfuscation hides malicious functionality'
    });
  }

  // Detect hidden iframes
  const iframes = $('iframe[style*="display:none"], iframe[style*="visibility:hidden"], iframe[width="0"], iframe[height="0"]');

  if (iframes.length > 0) {
    score += 8;
    findings.push({
      check: 'Hidden Elements',
      result: `${iframes.length} hidden iframe(s)`,
      severity: 'CRITICAL',
      points: 8,
      maxPoints: 8,
      explanation: 'Hidden iframes often load malware or track users'
    });
  }

  // Detect suspicious redirects
  const metaRefresh = $('meta[http-equiv="refresh"]');
  if (metaRefresh.length > 0) {
    score += 7;
    findings.push({
      check: 'Auto-Redirect',
      result: 'Meta refresh detected',
      severity: 'HIGH',
      points: 7,
      maxPoints: 7,
      explanation: 'Automatic redirects often used in phishing campaigns'
    });
  }

  return { score, findings, maxScore: 45 };
}
```

---

### 6. Legal & Compliance Framework (35 points)

```typescript
async analyzeLegalCompliance(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString());
  const $ = cheerio.load(response.data);

  // Check for Terms of Service
  const tosLinks = $('a[href*="terms"], a:contains("Terms of Service"), a:contains("Terms and Conditions")');

  if (tosLinks.length === 0) {
    score += 10;
    findings.push({
      check: 'Terms of Service',
      result: 'Not found',
      severity: 'HIGH',
      points: 10,
      maxPoints: 10,
      explanation: 'No terms of service - indicates lack of legitimate business structure'
    });
  }

  // Check for refund policy
  const refundLinks = $('a[href*="refund"], a:contains("Refund Policy"), a:contains("Returns")');

  if (refundLinks.length === 0) {
    score += 4;
    findings.push({
      check: 'Refund Policy',
      result: 'Not found',
      severity: 'MEDIUM',
      points: 4,
      maxPoints: 4,
      explanation: 'No refund policy - consumer protection concern'
    });
  }

  // Check for contact information
  const contactLinks = $('a[href*="contact"], a:contains("Contact Us")');
  const phoneNumbers = $.text().match(/\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}/g);
  const emails = $.text().match(/[\w.-]+@[\w.-]+\.\w+/g);

  if (contactLinks.length === 0 && !phoneNumbers && !emails) {
    score += 8;
    findings.push({
      check: 'Contact Information',
      result: 'No contact details found',
      severity: 'CRITICAL',
      points: 8,
      maxPoints: 8,
      explanation: 'Legitimate businesses provide contact information'
    });
  }

  return { score, findings, maxScore: 35 };
}
```

---

### 7. Brand Protection & Impersonation (30 points)

```typescript
async detectBrandImpersonation(url: URL, knownBrands: string[]) {
  let score = 0;
  let findings = [];

  const domain = url.hostname.toLowerCase();

  // Typosquatting detection
  for (const brand of knownBrands) {
    const distance = levenshteinDistance(domain, brand);

    if (distance <= 2 && distance > 0) {
      score += 10;
      findings.push({
        check: 'Typosquatting',
        result: `Similar to ${brand}`,
        severity: 'CRITICAL',
        points: 10,
        maxPoints: 10,
        explanation: `Domain is ${distance} character(s) different from ${brand}`,
        evidence: { domain, brand, distance }
      });
      break;
    }
  }

  // Homograph attack detection
  const suspiciousChars = /[а-яА-ЯёЁ]/; // Cyrillic characters
  if (suspiciousChars.test(domain)) {
    score += 8;
    findings.push({
      check: 'Homograph Attack',
      result: 'Unicode character substitution detected',
      severity: 'CRITICAL',
      points: 8,
      maxPoints: 8,
      explanation: 'Uses visually similar characters to impersonate legitimate domain'
    });
  }

  // Subdomain spoofing
  const parts = domain.split('.');
  if (parts.length > 3) {
    for (const brand of knownBrands) {
      if (parts.some(part => part === brand)) {
        score += 6;
        findings.push({
          check: 'Subdomain Spoofing',
          result: `Brand name in subdomain: ${brand}`,
          severity: 'HIGH',
          points: 6,
          maxPoints: 6,
          explanation: 'Uses brand name in subdomain to appear legitimate'
        });
        break;
      }
    }
  }

  return { score, findings, maxScore: 30 };
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
```

---

### 8. Advanced Threat Intelligence (40 points)

```typescript
async queryThreatDatabases(url: URL) {
  let score = 0;
  let findings = [];

  const urlString = url.toString();

  // Google Safe Browsing (free: 10,000/day)
  try {
    const gsbResponse = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_SAFE_BROWSING_KEY}`,
      {
        client: { clientId: 'elara', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: urlString }]
        }
      }
    );

    if (gsbResponse.data.matches) {
      score += 15;
      findings.push({
        check: 'Google Safe Browsing',
        result: 'Threat detected',
        severity: 'CRITICAL',
        points: 15,
        maxPoints: 15,
        explanation: `Flagged as ${gsbResponse.data.matches[0].threatType}`,
        evidence: gsbResponse.data.matches
      });
    }
  } catch {}

  // PhishTank (free)
  try {
    const phishTankResponse = await axios.post(
      'https://checkurl.phishtank.com/checkurl/',
      `url=${encodeURIComponent(urlString)}&format=json`,
      { headers: { 'User-Agent': 'Elara/1.0' } }
    );

    if (phishTankResponse.data.results.in_database) {
      score += 12;
      findings.push({
        check: 'PhishTank',
        result: 'Confirmed phishing',
        severity: 'CRITICAL',
        points: 12,
        maxPoints: 12,
        explanation: 'URL in PhishTank phishing database',
        evidence: phishTankResponse.data.results
      });
    }
  } catch {}

  // URLhaus (free)
  try {
    const urlhausResponse = await axios.post(
      'https://urlhaus-api.abuse.ch/v1/url/',
      `url=${encodeURIComponent(urlString)}`
    );

    if (urlhausResponse.data.query_status === 'ok') {
      score += 10;
      findings.push({
        check: 'URLhaus',
        result: 'Malware distribution detected',
        severity: 'CRITICAL',
        points: 10,
        maxPoints: 10,
        explanation: 'URL distributing malware',
        evidence: urlhausResponse.data
      });
    }
  } catch {}

  return { score, findings, maxScore: 40 };
}
```

---

### 9. Security Headers & Modern Standards (25 points)

```typescript
async analyzeSecurityHeaders(url: URL) {
  let score = 0;
  let findings = [];

  const response = await axios.get(url.toString(), {
    validateStatus: () => true
  });

  const headers = response.headers;

  // Check Content-Security-Policy
  if (!headers['content-security-policy']) {
    score += 6;
    findings.push({
      check: 'Content-Security-Policy',
      result: 'Missing',
      severity: 'HIGH',
      points: 6,
      maxPoints: 6,
      explanation: 'No CSP header - vulnerable to XSS attacks'
    });
  }

  // Check X-Frame-Options
  if (!headers['x-frame-options']) {
    score += 4;
    findings.push({
      check: 'X-Frame-Options',
      result: 'Missing',
      severity: 'MEDIUM',
      points: 4,
      maxPoints: 4,
      explanation: 'No clickjacking protection'
    });
  }

  // Check X-Content-Type-Options
  if (!headers['x-content-type-options']) {
    score += 3;
    findings.push({
      check: 'X-Content-Type-Options',
      result: 'Missing',
      severity: 'MEDIUM',
      points: 3,
      maxPoints: 3,
      explanation: 'MIME-type sniffing not prevented'
    });
  }

  // Check security.txt
  try {
    await axios.get(new URL('/.well-known/security.txt', url).toString());
  } catch {
    score += 2;
    findings.push({
      check: 'Security.txt',
      result: 'Not found',
      severity: 'LOW',
      points: 2,
      maxPoints: 2,
      explanation: 'No security contact information'
    });
  }

  return { score, findings, maxScore: 25 };
}
```

---

## 📈 Complete Scoring Output Format

```typescript
interface ComprehensiveScanResult {
  url: string;
  scanDate: Date;
  totalScore: number;
  maxPossibleScore: number;
  riskPercentage: number;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  categories: {
    domainRegistration: CategoryResult;
    networkSecurity: CategoryResult;
    dataProtection: CategoryResult;
    emailSecurity: CategoryResult;
    contentSecurity: CategoryResult;
    legalCompliance: CategoryResult;
    brandProtection: CategoryResult;
    threatIntelligence: CategoryResult;
    securityHeaders: CategoryResult;
  };

  summary: {
    criticalFindings: Finding[];
    highFindings: Finding[];
    mediumFindings: Finding[];
    lowFindings: Finding[];
  };

  recommendations: string[];
  verdict: string;
}

interface CategoryResult {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  findings: Finding[];
  status: 'PASS' | 'WARNING' | 'FAIL';
}

interface Finding {
  check: string;
  result: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
  maxPoints: number;
  explanation: string;
  evidence?: any;
  keywords?: string[];
}
```

---

## 🎯 Implementation Priority

### Phase 1 (Immediate):
1. ✅ Domain & Registration Analysis
2. ✅ Basic Network Security
3. ✅ Content Security (social engineering)
4. ✅ Threat Intelligence integration

### Phase 2 (Current):
5. 🔄 Complete all 350-point scoring
6. 🔄 Detailed score breakdown display
7. 🔄 All free API integrations
8. 🔄 Comprehensive output formatting

### Phase 3 (Next):
9. Advanced behavioral analysis
10. ML-based pattern recognition
11. Real-time threat feed integration
12. Automated reporting

---

**Status:** Complete specification ready for implementation
**Next Step:** Update Claude Code prompt with this comprehensive scoring system
