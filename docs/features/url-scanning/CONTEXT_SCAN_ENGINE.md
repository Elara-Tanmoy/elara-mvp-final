# 🎯 SCAN ENGINE - QUICK CONTEXT

**Last Updated:** October 15, 2025 - 10:05 PM
**Current Phase:** Phase 5 (AI Consensus Engine) - IN PROGRESS
**Deployment Status:** Phase 4 deploying to GCP

---

## 📊 PROGRESS OVERVIEW

```
Phase 1: Configuration & Foundation           ✅ DEPLOYED
Phase 2: Reachability Engine (Stage 0)        ✅ DEPLOYED
Phase 3: Internal Categories (17 categories)  ✅ DEPLOYED
Phase 4: Threat Intelligence (11 sources)     ✅ DEPLOYING NOW
Phase 5: AI Consensus Engine (3 LLMs)         ⏳ IN PROGRESS
Phase 6: Scoring Polish + False Positives     ⏳ TODO
Phase 7: Admin Backend APIs                   ⏳ TODO
Phase 8: Admin Frontend Dashboard             ⏳ TODO
```

**Overall Progress:** 4/8 phases (50%)

---

## 🏗️ ARCHITECTURE QUICK VIEW

### **6-Stage Scanner Workflow:**
```
Stage 0: Pre-Flight Checks       → Fast-path verdicts
Stage 1: Category Execution      → 0-515 pts (17 categories)
Stage 2: Threat Intelligence     → 0-55 pts (11 sources)
Stage 3: Base Score Calculation  → Categories + TI
Stage 4: AI Multiplier           → 0.7-1.3× (Phase 5 - TODO)
Stage 5: Risk Level & Save       → SAFE/LOW/MEDIUM/HIGH/CRITICAL
```

### **Scoring Breakdown:**
- **Internal Analysis:** 515 pts (17 categories)
- **Threat Intelligence:** 55 pts (11 sources)
- **AI Multiplier:** 0.7-1.3× (Phase 5)
- **Max Possible:** 741 pts (570 × 1.3)

### **Reachability States:**
- ONLINE → Full pipeline
- OFFLINE → Passive analysis only
- PARKED → Tombstone detection
- WAF_CHALLENGE → Limited analysis
- SINKHOLE → Immediate critical verdict

---

## 📁 FILE STRUCTURE

```
packages/backend/src/services/scanEngine/
├── scanner.ts                    # Main orchestrator (6 stages)
├── types.ts                      # TypeScript interfaces
│
├── stage0Orchestrator.ts         # Pre-flight coordinator
├── urlValidator.ts               # URL parsing & canonicalization
├── tombstoneDetector.ts          # Parked domain detection
├── sinkholeDetector.ts           # Security sinkhole detection
├── wafDetector.ts                # WAF/bot protection detection
├── reachabilityChecker.ts        # DNS + HTTP connectivity
├── cacheManager.ts               # Multi-tier caching
│
├── categoryBase.ts               # Abstract category class
├── categoryExecutor.ts           # Category orchestrator
│
├── categories/                   # 17 internal categories
│   ├── domainAnalysis.ts         # 40 pts
│   ├── sslSecurity.ts            # 45 pts
│   ├── contentAnalysis.ts        # 40 pts
│   ├── phishingPatterns.ts       # 50 pts
│   ├── malwareDetection.ts       # 45 pts
│   ├── securityHeaders.ts        # 25 pts
│   ├── emailSecurity.ts          # 25 pts
│   ├── dataProtection.ts         # 50 pts
│   ├── legalCompliance.ts        # 35 pts
│   ├── trustGraph.ts             # 30 pts
│   ├── socialEngineering.ts      # 30 pts
│   ├── financialFraud.ts         # 25 pts
│   ├── redirectChain.ts          # 15 pts
│   ├── brandImpersonation.ts     # 20 pts
│   ├── behavioralJS.ts           # 25 pts
│   ├── identityTheft.ts          # 20 pts
│   └── technicalExploits.ts      # 15 pts
│
└── threatIntelligence/           # TI Layer (Phase 4)
    ├── tiLayer.ts                # 11 TI sources orchestrator
    └── circuitBreaker.ts         # Fault tolerance pattern
```

---

## 🔑 KEY CONCEPTS

### **Contextual Scoring:**
Only scores observable categories based on reachability state.
- ONLINE: All categories run
- OFFLINE: Only passive categories (domain, SSL metadata)
- PARKED: Tombstone detection only
- Active Max Score adjusts dynamically

### **Circuit Breaker Pattern:**
Protects against TI source failures:
- CLOSED: Normal operation
- OPEN: Too many failures (5+), skip for 30s
- HALF_OPEN: Testing recovery

### **Caching Strategy:**
- **Scan Results:** 60 min TTL (risk-based)
- **TI Results:** 60 min TTL per source
- **DNS Results:** 5 min TTL
- Cache key: URL SHA-256 hash

### **Risk Thresholds:**
```
 0-15%: SAFE
15-30%: LOW
30-60%: MEDIUM
60-80%: HIGH
80%+:   CRITICAL
```

---

## 🚀 NEXT PHASE: AI CONSENSUS ENGINE (Phase 5)

### **Goal:**
Implement 3-LLM consensus to calculate AI multiplier (0.7-1.3×)

### **Models:**
1. **Claude Sonnet 4.5** - 35% weight
2. **GPT-4** - 35% weight
3. **Gemini 1.5 Flash** - 30% weight

### **Input to LLMs:**
- URL components (domain, path, params)
- Reachability state
- Category findings (top risks)
- TI verdicts (malicious/suspicious sources)
- Base score & risk level

### **LLM Task:**
Analyze the URL and findings, then:
- Provide risk assessment (0-100)
- Suggest multiplier (0.7-1.3)
- Explain reasoning
- Confidence score (0-100)

### **Consensus Calculation:**
```typescript
finalMultiplier = (
  claude.multiplier * 0.35 +
  gpt4.multiplier * 0.35 +
  gemini.multiplier * 0.30
)

agreementRate = % of models within 0.1 of each other
averageConfidence = mean(claude.conf, gpt4.conf, gemini.conf)
```

### **Files to Create:**
1. `aiConsensus/aiOrchestrator.ts` - Main AI coordinator
2. `aiConsensus/claudeAnalyzer.ts` - Claude integration
3. `aiConsensus/gptAnalyzer.ts` - GPT-4 integration
4. `aiConsensus/geminiAnalyzer.ts` - Gemini integration
5. `aiConsensus/consensusCalculator.ts` - Weighted consensus logic

### **Integration:**
Update `scanner.ts` Stage 4 to call AI orchestrator:
```typescript
// STAGE 4: AI Multiplier (currently placeholder)
const aiAnalysis = await this.aiOrchestrator.execute({
  url: stage0.validation.components.canonical,
  baseScore,
  activeMaxScore,
  categoryResults,
  tiResults
});

const aiMultiplier = aiAnalysis.finalMultiplier;
const finalScore = Math.round(baseScore * aiMultiplier);
```

---

## 🔧 ENVIRONMENT VARIABLES

### **Required for Phase 4 (TI Layer):**
```env
GOOGLE_SAFE_BROWSING_API_KEY=xxx
VIRUSTOTAL_API_KEY=xxx
ALIENVAULT_OTX_API_KEY=xxx
ABUSEIPDB_API_KEY=xxx
IBM_XFORCE_API_KEY=xxx
IBM_XFORCE_API_PASSWORD=xxx
```

### **Required for Phase 5 (AI Consensus):**
```env
ANTHROPIC_API_KEY=xxx          # Claude Sonnet 4.5
OPENAI_API_KEY=xxx             # GPT-4
GOOGLE_AI_API_KEY=xxx          # Gemini 1.5 Flash
```

---

## 📝 RECENT COMMITS

```
11ecbca - Phase 4: TI Layer (570/570 pts COMPLETE) 🎉
67749c9 - Phase 3.6: Final 5 Categories (515/515 pts)
b56b7b3 - Phase 3.5: 5 Advanced Categories (440/515 pts)
22620ca - Phase 3: Framework + 7 Core Categories (270/515 pts)
41693f7 - Phase 2: Reachability Engine (Stage 0)
de4bd39 - Phase 1: Configuration seed
```

---

## 🎯 IMMEDIATE NEXT STEPS

1. ✅ Update checkpoint (DONE)
2. ✅ Update context (DONE)
3. ⏳ Implement Phase 5: AI Consensus Engine
   - Create aiOrchestrator.ts
   - Create claudeAnalyzer.ts
   - Create gptAnalyzer.ts
   - Create geminiAnalyzer.ts
   - Create consensusCalculator.ts
   - Update scanner.ts Stage 4
4. ⏳ Test AI consensus locally
5. ⏳ Commit Phase 5
6. ⏳ Deploy Phase 5 to GCP

---

**For Full Details:** See `CHECKPOINT_SCAN_ENGINE_PHASE4_OCT15_2025.md`

**END OF CONTEXT**
