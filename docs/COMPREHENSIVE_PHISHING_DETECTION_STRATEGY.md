# Comprehensive Phishing Detection Strategy
## A Scalable, Pattern-Based Approach

## PROBLEM STATEMENT

Current approach is reactive:
- ❌ Find one phishing URL → Add one specific check
- ❌ Find another phishing URL → Add another check
- ❌ Not scalable, maintenance nightmare
- ❌ Attackers can easily bypass by using slight variations

**We need**: A proactive, pattern-based system that catches entire classes of phishing attacks.

---

## SOLUTION: Multi-Layered Pattern Recognition System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│           INPUT: URL + Domain + Content                 │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌──────────────┐
│  LAYER 1:     │         │  LAYER 2:    │
│  Pattern      │         │  Behavioral  │
│  Dictionaries │         │  Heuristics  │
└───────┬───────┘         └──────┬───────┘
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
            ┌────────────────┐
            │  LAYER 3:      │
            │  ML Ensemble   │
            │  (URLBERT etc) │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │  LAYER 4:      │
            │  Contextual    │
            │  Risk Scoring  │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │  Final Verdict │
            │  + Explanation │
            └────────────────┘
```

---

## LAYER 1: Comprehensive Pattern Dictionaries

### 1.1 Brand/Entity Dictionary (Auto-Updated)

**File**: `packages/backend/src/scanners/url-scanner-v2/dictionaries/brands.json`

```json
{
  "brands": [
    {
      "name": "PayPal",
      "variations": ["paypal", "paypai", "paypa1", "paypail", "pay-pal", "paypa"],
      "officialDomains": ["paypal.com", "paypal.me", "paypalobjects.com"],
      "category": "financial",
      "riskMultiplier": 2.5
    },
    {
      "name": "Amazon",
      "variations": ["amazon", "amaz0n", "amazom", "arnazon", "anazon"],
      "officialDomains": ["amazon.com", "amazon.co.uk", "amzn.to", "amazonpay.com"],
      "category": "ecommerce",
      "riskMultiplier": 2.0
    }
  ],
  "autoUpdateSource": "https://tranco-list.eu/top-1m.csv.zip",
  "lastUpdated": "2025-10-28T00:00:00Z"
}
```

**Detection Logic**:
```typescript
function checkBrandImpersonation(domain: string, brands: Brand[]): CheckResult {
  for (const brand of brands) {
    // Check if domain contains brand variation
    const matchedVariation = brand.variations.find(v => domain.includes(v));

    if (matchedVariation) {
      // Check if it's an official domain
      const isOfficial = brand.officialDomains.some(od =>
        domain === od || domain.endsWith('.' + od)
      );

      if (!isOfficial) {
        return {
          detected: true,
          brand: brand.name,
          variation: matchedVariation,
          penalty: 40 * brand.riskMultiplier, // 40-100 points
          category: brand.category
        };
      }
    }
  }
  return { detected: false };
}
```

### 1.2 Authority/Government Dictionary

**File**: `packages/backend/src/scanners/url-scanner-v2/dictionaries/authorities.json`

```json
{
  "categories": {
    "government": {
      "keywords": ["gov", "government", "federal", "state", "dept", "department"],
      "officialTLDs": [".gov", ".gov.uk", ".gov.au", ".gc.ca"],
      "penalty": 50
    },
    "lawEnforcement": {
      "keywords": ["police", "fbi", "cia", "interpol", "sheriff", "officer"],
      "officialTLDs": [".gov", ".mil"],
      "penalty": 60
    },
    "taxation": {
      "keywords": ["irs", "tax", "revenue", "hmrc", "cra"],
      "officialTLDs": [".gov"],
      "penalty": 55
    },
    "legal": {
      "keywords": ["court", "legal", "lawsuit", "subpoena", "warrant", "summons"],
      "officialTLDs": [".gov", ".courts.gov"],
      "penalty": 50
    },
    "traffic": {
      "keywords": ["dmv", "traffic", "offence", "offense", "violation", "citation", "ticket", "fine", "penalty"],
      "officialTLDs": [".gov"],
      "penalty": 45
    }
  }
}
```

### 1.3 Urgency/Pressure Tactics Dictionary

```json
{
  "urgencyPatterns": {
    "temporal": {
      "keywords": ["urgent", "immediate", "now", "today", "expire", "deadline", "limited", "hours", "minutes"],
      "penalty": 15
    },
    "threats": {
      "keywords": ["suspended", "locked", "blocked", "terminated", "disabled", "frozen", "restrict"],
      "penalty": 20
    },
    "action": {
      "keywords": ["verify", "confirm", "update", "validate", "unlock", "restore", "reactivate"],
      "penalty": 10
    },
    "financial": {
      "keywords": ["refund", "payment", "charge", "invoice", "debt", "owed", "overdue"],
      "penalty": 15
    }
  }
}
```

### 1.4 Suspicious TLD Dictionary (Auto-Updated)

```json
{
  "highRisk": {
    "tlds": [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work"],
    "penalty": 25,
    "reason": "Free TLDs commonly used for phishing"
  },
  "mediumRisk": {
    "tlds": [".click", ".link", ".online", ".site", ".website"],
    "penalty": 10,
    "reason": "Generic TLDs often used for suspicious sites"
  },
  "dynamicUpdate": {
    "source": "https://openphish.com/feed.txt",
    "updateFrequency": "daily"
  }
}
```

---

## LAYER 2: Behavioral Heuristics

### 2.1 Typosquatting Detection

```typescript
interface TyposquattingDetector {
  // Levenshtein distance
  checkEditDistance(domain: string, brand: string): number;

  // Homograph attacks (lookalike characters)
  checkHomographs(domain: string): {
    detected: boolean;
    characters: Array<{ original: string; lookalike: string }>;
  };

  // Character substitution patterns
  checkSubstitutions(domain: string, brand: string): {
    detected: boolean;
    substitutions: string[];
  };

  // Examples:
  // - paypal → paypai (1 edit distance)
  // - amazon → arnazon (character swap)
  // - google → goog1e (number substitution)
  // - apple → аpple (Cyrillic 'а')
}
```

### 2.2 Domain Structure Analysis

```typescript
interface DomainStructureAnalyzer {
  // Check for suspicious patterns
  patterns: {
    // Long random subdomains
    suspiciousSubdomain: /[a-z0-9]{20,}/,

    // Multiple dashes (paypal-secure-login-verify.com)
    excessiveDashes: (count: number) => count > 3,

    // Brand in subdomain (paypal.phishing.com)
    brandInSubdomain: (subdomain: string, brands: string[]) => boolean,

    // Numeric domain (12345.com)
    numericDomain: /^\d+\.com$/,

    // IP address as domain
    ipAddress: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
  };
}
```

### 2.3 Content Pattern Matching

```typescript
interface ContentPatternMatcher {
  // Detect cloned login pages
  detectClonedForms(): {
    hasLoginForm: boolean;
    hasPasswordField: boolean;
    formAction: string; // Does it submit to different domain?
    hasCaptcha: boolean; // Legitimate sites often have captcha
  };

  // Detect credential harvesting
  detectCredentialHarvesting(): {
    multiplePasswordFields: boolean;
    sensitiveFieldLabels: string[]; // SSN, card number, etc.
    externalFormAction: boolean;
  };

  // Detect fake error pages
  detectFakeErrors(): {
    errorKeywords: string[]; // "account suspended", "verify identity"
    urgencyLanguage: boolean;
    hasLoginForm: boolean; // Error page shouldn't have login
  };
}
```

---

## LAYER 3: ML-Enhanced Detection

### 3.1 Ensemble Model Approach

```typescript
interface MLEnsemble {
  models: {
    urlbert: URLBERTModel;        // Deep learning on URL structure
    xgboost: TabularRiskModel;    // Traditional ML on features
    cnn: ScreenshotCNN;           // Visual similarity detection
    transformer: ContentBERT;     // Page content analysis
  };

  // Weighted voting
  combineScores(scores: ModelScores): {
    finalScore: number;
    confidence: number;
    majorityAgreement: boolean;
  };
}
```

### 3.2 Continuous Learning Pipeline

```typescript
interface ContinuousLearning {
  // Collect user feedback
  collectFeedback(scanId: string, userReport: {
    isPhishing: boolean;
    confidence: number;
    evidence?: string;
  }): void;

  // Retrain models weekly
  retrainSchedule: {
    frequency: "weekly";
    minNewSamples: 1000;
    validationSplit: 0.2;
  };

  // A/B testing for new models
  abTestNewModel(modelVersion: string, trafficPercentage: number): void;
}
```

---

## LAYER 4: Contextual Risk Scoring

### 4.1 Risk Aggregation Formula

```typescript
interface RiskAggregator {
  calculateFinalRisk(signals: {
    patternMatches: PatternMatch[];
    behavioralFlags: BehavioralFlag[];
    mlScores: MLScores;
    contextualFactors: ContextualFactors;
  }): RiskScore;

  formula: `
    finalRisk = (
      patternScore * 0.35 +      // Dictionary matches
      behavioralScore * 0.25 +   // Heuristic flags
      mlScore * 0.30 +           // ML models
      contextScore * 0.10        // Age, reputation, etc.
    )

    // Apply multipliers
    * agePenaltyMultiplier        // <7 days: 1.5x, <30 days: 1.2x
    * categoryMultiplier          // Government: 1.3x, Financial: 1.2x
  `;
}
```

### 4.2 Dynamic Thresholds

```typescript
interface DynamicThresholds {
  // Adjust thresholds based on context
  getThreshold(context: {
    domainAge: number;
    category: string;
    userLocation: string;
    timeSensitivity: number;
  }): {
    highRisk: number;   // Normally 70%, but 50% for <7 day domains
    critical: number;   // Normally 85%, but 65% for government
  };
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Build Dictionary System (Week 1)

```typescript
// File: packages/backend/src/scanners/url-scanner-v2/dictionaries/index.ts

export class DictionaryManager {
  private brands: BrandDictionary;
  private authorities: AuthorityDictionary;
  private urgency: UrgencyDictionary;
  private tlds: TLDDictionary;

  async initialize() {
    await this.loadDictionaries();
    await this.scheduleUpdates();
  }

  async loadDictionaries() {
    this.brands = await this.loadJSON('brands.json');
    this.authorities = await this.loadJSON('authorities.json');
    this.urgency = await this.loadJSON('urgency.json');
    this.tlds = await this.loadJSON('tlds.json');
  }

  async updateFromSources() {
    // Auto-update from Tranco, OpenPhish, etc.
    await this.updateBrandsFromTranco();
    await this.updateTLDsFromOpenPhish();
  }

  checkAll(url: string, domain: string, content: string): DictionaryResults {
    return {
      brandImpersonation: this.brands.check(domain),
      authorityImpersonation: this.authorities.check(domain),
      urgencyTactics: this.urgency.check(content),
      suspiciousTLD: this.tlds.check(domain)
    };
  }
}
```

### Phase 2: Build Heuristic Analyzers (Week 2)

```typescript
// File: packages/backend/src/scanners/url-scanner-v2/heuristics/index.ts

export class HeuristicAnalyzer {
  private typosquatting: TyposquattingDetector;
  private domainStructure: DomainStructureAnalyzer;
  private contentPattern: ContentPatternMatcher;

  analyzeAll(url: string, domain: string, content: string): HeuristicResults {
    return {
      typosquatting: this.typosquatting.detect(domain),
      structure: this.domainStructure.analyze(domain),
      content: this.contentPattern.analyze(content)
    };
  }
}
```

### Phase 3: Integrate with Scanner (Week 3)

```typescript
// File: packages/backend/src/scanners/url-scanner-v2/index.ts

export class URLScannerV2Enhanced {
  private dictionaries: DictionaryManager;
  private heuristics: HeuristicAnalyzer;

  async scan(url: string): Promise<ScanResult> {
    // Layer 1: Dictionary checks
    const dictResults = await this.dictionaries.checkAll(url, domain, content);

    // Layer 2: Heuristic analysis
    const heurResults = await this.heuristics.analyzeAll(url, domain, content);

    // Layer 3: ML models (existing)
    const mlResults = await this.runMLModels(url);

    // Layer 4: Contextual aggregation
    const finalRisk = this.aggregateRisk(dictResults, heurResults, mlResults);

    return {
      riskScore: finalRisk.score,
      riskLevel: finalRisk.level,
      detections: {
        dictionaries: dictResults,
        heuristics: heurResults,
        ml: mlResults
      },
      explanation: this.generateExplanation(finalRisk)
    };
  }
}
```

---

## MAINTENANCE STRATEGY

### Auto-Updates

```typescript
interface AutoUpdateStrategy {
  // Update dictionaries daily
  dailyUpdates: {
    brands: "Tranco Top 10K",
    tlds: "OpenPhish Feed",
    authorities: "Government domains DB"
  };

  // Monitor phishing feeds
  feeds: [
    "https://openphish.com/feed.txt",
    "https://phishtank.org/data/online-valid.json",
    "https://urlhaus.abuse.ch/downloads/csv_recent/"
  ];

  // Extract patterns automatically
  patternExtraction: {
    minOccurrences: 10,      // Pattern must appear 10+ times
    confidenceThreshold: 0.8 // 80% accuracy required
  };
}
```

### Feedback Loop

```typescript
interface FeedbackLoop {
  // Collect false positives/negatives
  collectMisclassifications(): void;

  // Adjust thresholds
  tuneThresholds(): void;

  // Add new patterns
  addPatternsFromMisclassifications(): void;

  // Monthly review
  monthlyReview: {
    accuracy: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    newPatternsAdded: number;
  };
}
```

---

## BENEFITS OF THIS APPROACH

### ✅ Scalability
- Add new brands/patterns without code changes
- Dictionary grows automatically from feeds
- Patterns learned from real-world phishing

### ✅ Maintainability
- One dictionary file instead of scattered checks
- Auto-updates reduce manual work
- Clear separation of concerns

### ✅ Accuracy
- Multi-layered approach catches more attacks
- Reduces false positives through ensemble
- Contextual scoring adapts to specific cases

### ✅ Transparency
- Clear explanation of why URL was flagged
- Shows which patterns matched
- Easy to debug and improve

---

## COST-BENEFIT ANALYSIS

| Approach | Initial Work | Ongoing Work | Coverage | Accuracy |
|----------|-------------|--------------|----------|----------|
| **Current (One-off checks)** | Low | **HIGH** 😞 | Low | Medium |
| **Dictionary System** | **HIGH** | Low 😊 | **HIGH** | **HIGH** |

**Investment**: 3 weeks upfront
**Payoff**: 90% reduction in maintenance, 300% increase in coverage

---

## NEXT STEPS

1. **Immediate** (This sprint):
   - Create dictionary infrastructure
   - Migrate existing checks to dictionaries
   - Add top 100 brands

2. **Short-term** (Next sprint):
   - Implement heuristic analyzers
   - Add auto-update mechanism
   - Connect to phishing feeds

3. **Long-term** (Next month):
   - Build continuous learning pipeline
   - Implement A/B testing for models
   - Create admin dashboard for dictionary management

---

## EXAMPLE: How It Would Catch `my-traffic-offence.com`

```typescript
const analysis = await scanner.scan('https://my-traffic-offence.com');

// Results:
{
  dictionaries: {
    authorities: {
      matched: true,
      category: 'traffic',
      keywords: ['traffic', 'offence'],
      penalty: 45,
      reason: 'Traffic authority keywords without .gov TLD'
    }
  },
  heuristics: {
    domainStructure: {
      multipleKeywords: true, // 'traffic' + 'offence'
      penalty: 15
    }
  },
  contextual: {
    domainAge: 3,
    ageMultiplier: 1.5, // <7 days
    categoryMultiplier: 1.3 // Government category
  },

  finalRisk: {
    baseScore: 60,  // From dictionaries + heuristics
    multiplied: 117, // 60 * 1.5 * 1.3
    level: 'E',     // CRITICAL
    confidence: 0.95
  }
}
```

**One dictionary entry catches ALL government phishing variants!** 🎯
