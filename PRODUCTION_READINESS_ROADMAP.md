# Elara V2 Platform - Production Readiness Roadmap

**Generated**: 2025-10-25
**Current Progress**: ~75% Complete
**Goal**: 100% production-ready with NO placeholders or fallbacks

---

## 📊 CURRENT STATE ANALYSIS

### ✅ **What's Working (Production-Ready)**

1. **Backend V2 Scanner Pipeline** (100%)
   - URL canonicalization
   - TI gate check (18 sources)
   - Reachability probe
   - Evidence collection (HTML, TLS, WHOIS, DNS)
   - Feature extraction
   - Policy engine
   - Database storage

2. **External API Integration** (100%)
   - VirusTotal service (requires API key)
   - ScamAdviser service (requires API key)
   - Parallel execution with error handling

3. **AI Summarization** (100%)
   - Gemini Flash/Pro integration
   - Smart model routing
   - Structured summaries
   - Fallback handling

4. **Central AI API** (100%)
   - 5 B2B endpoints (`/v2/ai/analyze`, `/v2/ai/chat`, `/v2/scan/uri`, `/v2/ai/models`, `/v2/ai/usage`)
   - JWT authentication
   - Rate limiting
   - Usage tracking

5. **Database Schema** (100%)
   - V2 fields added (`externalAPIs`, `aiSummary`, `probability`, `confidenceInterval`, etc.)
   - Migration applied

6. **Frontend V2 Interface** (100%)
   - V2 scanner toggle (defaults ON)
   - Advanced options panel
   - Enhanced progress indicators

---

## ❌ **What's Using Placeholders/Fallbacks**

### **CRITICAL - Prevents Full V2 Accuracy**

#### 1. **Vertex AI Model Endpoints** (0% configured)
**Impact**: All ML models currently using heuristic fallbacks instead of trained models

**Current State**:
```typescript
// packages/backend/src/scanners/url-scanner-v2/index.ts:518-522
urlLexicalB: process.env.VERTEX_URL_BERT_ENDPOINT || 'placeholder'
tabularRisk: process.env.VERTEX_TABULAR_ENDPOINT || 'placeholder'
textPersuasion: process.env.VERTEX_TEXT_ENDPOINT || 'placeholder'
screenshotCnn: process.env.VERTEX_SCREENSHOT_ENDPOINT || 'placeholder'
combiner: process.env.VERTEX_COMBINER_ENDPOINT || 'placeholder'
```

**Files Using Fallbacks**:
- `stage1.ts:121-123` - URL BERT fallback (heuristic-based, low confidence)
- `stage1.ts:164-166` - Tabular risk fallback (rule-based scoring)
- `stage2.ts:99-100` - Text persuasion fallback (keyword matching)
- `stage2.ts:147-148` - Screenshot CNN fallback (returns neutral)
- `combiner.ts:325` - Default calibration instead of trained calibration

**What's Needed**:
1. Train and deploy 5 Vertex AI models
2. Configure endpoint URLs in environment variables
3. Remove fallback logic once endpoints are live

**Estimated Effort**: 40-60 hours
- Model training setup: 8-12 hours
- Training data preparation: 10-15 hours
- Model training & tuning: 20-30 hours
- Deployment & testing: 2-3 hours

---

#### 2. **Screenshot Capture** (0% implemented)
**Impact**: Stage-2 screenshot analysis always returns neutral

**Current State**:
```typescript
// packages/backend/src/scanners/url-scanner-v2/evidence.ts:412
// Placeholder - real implementation requires browser automation
```

**What's Needed**:
- Puppeteer/Playwright integration for headless browsing
- Screenshot capture during evidence collection
- OCR for text extraction (if needed)
- Storage for screenshots (Cloud Storage bucket)

**Estimated Effort**: 6-8 hours
- Puppeteer setup: 2-3 hours
- Screenshot capture logic: 2-3 hours
- Storage integration: 1-2 hours
- Testing: 1 hour

---

#### 3. **ASN/IP Intelligence** (0% implemented)
**Impact**: Missing network-level threat intelligence

**Current State**:
```typescript
// packages/backend/src/scanners/url-scanner-v2/evidence.ts:421
// Placeholder - would need IP intelligence API
```

**What's Needed**:
- IPinfo.io or similar service integration
- ASN reputation scoring
- Hosting provider risk analysis

**Estimated Effort**: 3-4 hours
- API integration: 2 hours
- Feature extraction: 1-2 hours

---

#### 4. **Conformal Calibration Training** (using defaults)
**Impact**: Confidence intervals are generic, not optimized

**Current State**:
```typescript
// packages/backend/src/scanners/url-scanner-v2/combiner.ts:325
// Default calibration (placeholder)
```

**What's Needed**:
- Historical scan data collection
- Conformal prediction calibration script
- Per-branch calibration parameters

**Estimated Effort**: 8-10 hours
- Data collection pipeline: 3-4 hours
- Calibration algorithm: 4-5 hours
- Integration: 1 hour

---

### **HIGH PRIORITY - External Dependencies**

#### 5. **External API Keys** (not configured)
**Impact**: VirusTotal and ScamAdviser validation disabled

**What's Needed**:
```bash
# Add to GCP Secret Manager or Kubernetes secrets
VIRUSTOTAL_API_KEY=<your_key>
SCAMADVISER_API_KEY=<your_key>
```

**Estimated Effort**: 1 hour
- Obtain API keys: 30 min
- Configure in GCP: 30 min

**Cost**:
- VirusTotal API: $500-$2000/month (depending on volume)
- ScamAdviser API: $99-$499/month

---

#### 6. **Dual Tier-1 TI Hit Detection** (placeholder)
**Impact**: Advanced TI correlation not working

**Current State**:
```typescript
// packages/backend/src/scanners/url-scanner-v2/feature-extract.ts:196
const dualTier1Hits = false; // Placeholder
```

**What's Needed**:
- Load all TI sources with tier classifications
- Cross-reference to detect when 2+ tier-1 sources flag the same URL

**Estimated Effort**: 2-3 hours

---

### **MEDIUM PRIORITY - Frontend Enhancements**

#### 7. **Enhanced V2 Results Display** (60% complete)
**Impact**: V2 features not visually highlighted

**Current State**: Using generic `EnhancedScanResults` component

**What's Needed**:
- Confidence interval visualization (graph/gauge)
- External API badges (VirusTotal, ScamAdviser)
- AI summary in prominent expandable section
- Decision graph rendering
- Stage-by-stage breakdown accordion
- Screenshot display
- Recommended actions checklist

**Estimated Effort**: 4-6 hours
- Design components: 2 hours
- Implement visualizations: 2-3 hours
- Testing: 1 hour

---

#### 8. **Admin Dashboard - V2 Configuration** (10% complete)
**Impact**: No UI to manage V2 settings

**What's Needed**:
- Enable/disable V2 globally
- Shadow mode toggle (run V1+V2, compare results)
- Rollout percentage slider (gradual rollout)
- Vertex AI endpoint configuration UI
- V2 scan metrics dashboard
- Training data upload interface

**Estimated Effort**: 6-8 hours
- Configuration panel: 3-4 hours
- Metrics dashboard: 2-3 hours
- Testing: 1 hour

---

#### 9. **V1 vs V2 Comparison UI** (0% complete)
**Impact**: Can't evaluate V2 performance vs V1

**What's Needed**:
- Side-by-side result comparison
- Accuracy metrics
- Latency comparison
- False positive/negative rates
- Shadow mode test results display

**Estimated Effort**: 4-5 hours

---

### **LOW PRIORITY - Infrastructure & Automation**

#### 10. **Vertex AI Training Pipelines** (0% complete)
**Impact**: Manual model retraining required

**What's Needed**:
- Automated pipeline for model retraining
- Data ingestion from BigQuery/Feature Store
- Hyperparameter tuning
- Model versioning and deployment
- A/B testing infrastructure

**Estimated Effort**: 30-50 hours
- Pipeline design: 8-10 hours
- Implementation: 20-30 hours
- Testing & tuning: 2-10 hours

---

#### 11. **Model Training UI** (0% complete)
**Impact**: Admins can't trigger training jobs via UI

**What's Needed**:
- Training job launcher
- Hyperparameter configuration
- Progress monitoring
- Model comparison dashboard

**Estimated Effort**: 6-8 hours

---

#### 12. **Data Lake & Feature Store** (0% complete)
**Impact**: No centralized feature storage for training

**What's Needed**:
- BigQuery dataset for scan history
- Vertex AI Feature Store setup
- Batch feature extraction pipeline
- Feature versioning

**Estimated Effort**: 12-16 hours

---

## 📋 **PRODUCTION-READY CHECKLIST**

### **Phase 1: Critical Path (50-70 hours)** 🔴
**Goal**: Remove all ML placeholders and enable real models

- [ ] **Train Vertex AI Models** (40-60 hours)
  - [ ] Collect and label training data (10-15 hours)
  - [ ] Train URL BERT model (8-10 hours)
  - [ ] Train tabular risk model (8-10 hours)
  - [ ] Train text persuasion model (8-10 hours)
  - [ ] Train screenshot CNN model (8-10 hours)
  - [ ] Train combiner model (6-8 hours)
  - [ ] Deploy to Vertex AI endpoints (2-3 hours)

- [ ] **Configure Vertex Endpoints** (1 hour)
  - [ ] Add endpoint URLs to environment variables
  - [ ] Test each endpoint individually
  - [ ] Remove fallback logic from code

- [ ] **Implement Screenshot Capture** (6-8 hours)
  - [ ] Add Puppeteer to backend
  - [ ] Implement screenshot capture in evidence collector
  - [ ] Set up Cloud Storage for screenshots

- [ ] **Configure External API Keys** (1 hour)
  - [ ] Obtain VirusTotal API key
  - [ ] Obtain ScamAdviser API key
  - [ ] Add to GCP Secret Manager

### **Phase 2: High Priority (15-20 hours)** 🟡
**Goal**: Complete frontend and configuration

- [ ] **Enhanced V2 Results Display** (4-6 hours)
  - [ ] Confidence interval graph
  - [ ] External API badges
  - [ ] AI summary section
  - [ ] Decision graph
  - [ ] Screenshot display

- [ ] **Admin Dashboard Enhancements** (6-8 hours)
  - [ ] V2 enable/disable toggle
  - [ ] Shadow mode controls
  - [ ] Rollout percentage slider
  - [ ] Endpoint configuration UI
  - [ ] V2 metrics dashboard

- [ ] **ASN/IP Intelligence** (3-4 hours)
  - [ ] Integrate IPinfo.io or similar
  - [ ] Add to evidence collection

- [ ] **Conformal Calibration** (8-10 hours)
  - [ ] Collect calibration dataset
  - [ ] Train calibration parameters
  - [ ] Integrate into combiner

### **Phase 3: Medium Priority (10-15 hours)** 🟢
**Goal**: Advanced features and optimizations

- [ ] **V1 vs V2 Comparison UI** (4-5 hours)
- [ ] **Dual Tier-1 TI Detection** (2-3 hours)
- [ ] **Shadow Mode Implementation** (4-6 hours)
  - [ ] Run V1+V2 in parallel
  - [ ] Compare results
  - [ ] Log discrepancies

### **Phase 4: Future Enhancements (40-60 hours)** 🔵
**Goal**: Full automation and MLOps

- [ ] **Vertex AI Training Pipelines** (30-50 hours)
- [ ] **Model Training UI** (6-8 hours)
- [ ] **Data Lake & Feature Store** (12-16 hours)

---

## 💰 **ESTIMATED COSTS (Monthly)**

### **External Services**
- VirusTotal API: $500-$2,000/month
- ScamAdviser API: $99-$499/month
- IPinfo.io: $249/month
- **Subtotal**: $848-$2,748/month

### **GCP Services**
- Vertex AI Training: $500-$2,000/month (during training)
- Vertex AI Endpoints: $300-$1,500/month (5 models)
- BigQuery (Feature Store): $100-$500/month
- Cloud Storage (screenshots): $50-$200/month
- **Subtotal**: $950-$4,200/month

### **Total**: $1,800-$7,000/month

---

## ⏱️ **TIME TO PRODUCTION-READY**

### **Minimum Viable Production** (Phase 1 only)
- **Effort**: 50-70 hours
- **Timeline**: 2-3 weeks (full-time) or 4-6 weeks (part-time)
- **Result**: V2 working with real ML models, no heuristic fallbacks

### **Full Feature Complete** (Phases 1-3)
- **Effort**: 75-105 hours
- **Timeline**: 3-4 weeks (full-time) or 6-8 weeks (part-time)
- **Result**: Complete V2 with admin UI, comparison tools, optimized calibration

### **MLOps Automation** (Phases 1-4)
- **Effort**: 115-165 hours
- **Timeline**: 5-7 weeks (full-time) or 10-14 weeks (part-time)
- **Result**: Fully automated retraining, A/B testing, continuous improvement

---

## 🎯 **RECOMMENDED PATH FORWARD**

### **Option A: Quick Production Launch** (2-3 weeks)
**Best for**: Getting V2 live quickly with acceptable accuracy

1. **Week 1**: Train basic models on available data
2. **Week 2**: Deploy models to Vertex AI, configure endpoints
3. **Week 3**: Test, fix bugs, configure API keys, deploy

**Result**: 80% of ideal accuracy, production-ready

### **Option B: Optimized Production Launch** (4-6 weeks)
**Best for**: Maximum accuracy and user experience

1. **Weeks 1-2**: Train high-quality models with tuning
2. **Week 3**: Deploy models, implement screenshot capture
3. **Week 4**: Build enhanced results display
4. **Week 5**: Admin dashboard and calibration
5. **Week 6**: Testing, optimization, deployment

**Result**: 95% of ideal accuracy, excellent UX

### **Option C: Full Platform** (10-14 weeks)
**Best for**: Complete MLOps automation

1. **Weeks 1-6**: Option B tasks
2. **Weeks 7-10**: Build training pipelines and feature store
3. **Weeks 11-12**: Model training UI and A/B testing
4. **Weeks 13-14**: Documentation, final testing

**Result**: 100% automated, continuously improving

---

## 📝 **IMMEDIATE NEXT STEPS** (After Current Build Deploys)

1. **Verify Build Success** (15 min)
   - Check pods are running
   - Test V2 scan via UI
   - Confirm no import errors

2. **Configure API Keys** (1 hour)
   - Sign up for VirusTotal API
   - Sign up for ScamAdviser API
   - Add to GCP Secret Manager
   - Test external API integration

3. **Plan Model Training** (2 hours)
   - Identify available training data sources
   - Design labeling strategy
   - Choose Option A, B, or C timeline
   - Set up Vertex AI project

4. **Create Training Data Pipeline** (8 hours)
   - Export existing scan data
   - Label benign vs malicious samples
   - Create train/validation/test splits
   - Upload to GCS bucket

5. **Start Model Training** (begin Option A, B, or C)

---

## 🚨 **CURRENT BLOCKERS**

### **Immediate** (blocking deployment)
- ✅ Import path issue (FIXED in commit 186fdf7, deploying now)

### **Short-term** (blocking full V2 accuracy)
- ❌ No trained Vertex AI models deployed
- ❌ No Vertex AI endpoint URLs configured
- ❌ Missing external API keys

### **Medium-term** (blocking optimal user experience)
- ❌ Screenshot capture not implemented
- ❌ V2 results display not enhanced
- ❌ Admin dashboard incomplete

### **Long-term** (blocking automation)
- ❌ No training pipelines
- ❌ No feature store
- ❌ No A/B testing framework

---

## 🎉 **WHAT'S ALREADY PRODUCTION-READY**

1. ✅ Backend V2 scanner infrastructure
2. ✅ External API integration (needs keys)
3. ✅ AI summarization (Gemini)
4. ✅ Central AI API (5 endpoints)
5. ✅ Database schema
6. ✅ Frontend V2 toggle and options
7. ✅ Rate limiting and authentication
8. ✅ Error handling and fallbacks
9. ✅ B2B API for partners
10. ✅ Deployment pipeline

**You have a solid foundation. The main gap is training and deploying the ML models to replace heuristic fallbacks.**

---

**Ready to proceed? Choose:**
- **Option A** if you want V2 live in 2-3 weeks
- **Option B** if you want optimal quality in 4-6 weeks
- **Option C** if you want full automation in 10-14 weeks
