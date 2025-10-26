# Elara V2 Platform - Complete End-to-End Deployment Plan

**Generated**: 2025-10-26
**Status**: Ready for Execution
**Architecture**: Based on `Prompts/v2_architecture.txt`

---

## 📋 DEPLOYMENT STATUS

### ✅ **COMPLETED** (Infrastructure Code Ready)

1. **Backend V2 Scanner Implementation** (100%)
   - ✅ Two-stage ML pipeline architecture
   - ✅ TI gate with 18 sources
   - ✅ Reachability probe (ONLINE/OFFLINE/WAF)
   - ✅ Evidence collection (HTML, TLS, WHOIS, DNS)
   - ✅ Feature extraction with causal signals
   - ✅ Policy engine and decision graph
   - ✅ Gemini AI summarization (Flash/Pro routing)
   - ✅ Central AI API (5 B2B endpoints)
   - ✅ Database schema with V2 fields

2. **Model Training Scripts** (100%)
   - ✅ `train-url-lexical-bert.py` - Stage-1 URL BERT model
   - ✅ `train-tabular-risk.py` - Stage-1 tabular risk model
   - ✅ `train-text-persuasion.py` - Stage-2 text persuasion model
   - ✅ `train-screenshot-cnn.py` - Stage-2 screenshot CNN model
   - ✅ `train-combiner.py` - Combiner with conformal calibration

3. **Infrastructure Scripts** (100%)
   - ✅ `setup-v2-infrastructure.sh` - BigQuery, GCS, Firestore, IAM setup
   - ✅ `bootstrap-training-data.sh` - Load PhishTank, URLhaus, Tranco data
   - ✅ `deploy-v2-models.sh` - Deploy trained models to Vertex AI endpoints

4. **Frontend V2 Interface** (100%)
   - ✅ V2 scanner toggle (defaults ON)
   - ✅ Advanced options panel
   - ✅ Enhanced progress indicators
   - ✅ Model Training Dashboard UI

5. **Screenshot Capture Service** (100%)
   - ✅ Puppeteer-based screenshot capture
   - ✅ GCS upload integration
   - ✅ Evidence collection enhancement

---

## 🚀 DEPLOYMENT EXECUTION PLAN

### **PHASE 1: Fix Build and Deploy Code** ⏱️ 10-15 minutes

**Current Status**: Build `95592ef6` queued - final TypeScript fix applied

#### Step 1.1: Monitor Build Completion
```bash
# Check build status
gcloud builds list --project=elara-mvp-13082025-u1 --limit 1

# If SUCCESS, proceed to Step 1.2
# If FAILURE, check logs and fix errors
```

#### Step 1.2: Verify Pod Deployment
```bash
# Check pods in development namespace
kubectl get pods -n elara-backend-dev

# Expected: All pods Running
# backend-api-xxxxxxxxx-xxxxx  1/1  Running
# worker-xxxxxxxxx-xxxxx       1/1  Running
```

#### Step 1.3: Test V2 Scanner (Smoke Test)
```bash
# Get backend URL
BACKEND_URL="http://35.199.176.26/api"

# Test V2 scan endpoint
curl -X POST "${BACKEND_URL}/v2/scan/uri" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}' \
  | jq '.'

# Expected: Returns scan result with V2 fields (probability, aiSummary, etc.)
```

---

### **PHASE 2: Set Up V2 Infrastructure** ⏱️ 20-30 minutes

**CRITICAL**: Infrastructure is in `us-west1`, but scripts default to `us-central1`. Use override.

#### Step 2.1: Create BigQuery Dataset and Tables
```bash
cd /d/elara-mvp-final

# Run infrastructure setup
GCP_PROJECT_ID="elara-mvp-13082025-u1" \
GCP_LOCATION="us-west1" \
bash scripts/setup-v2-infrastructure.sh
```

**This creates**:
- ✅ BigQuery dataset: `elara_training_data_v2`
- ✅ Tables: `phishing_urls`, `benign_urls`, `scan_features`, `ti_hits`, `uploaded_training_data`
- ✅ GCS bucket: `gs://elara-mvp-13082025-u1-training-data`
- ✅ Firestore collections: `v2_features`, `v2_scan_cache`
- ✅ IAM permissions configured

#### Step 2.2: Verify Infrastructure Creation
```bash
# Check BigQuery dataset
bq ls --project_id=elara-mvp-13082025-u1 | grep elara_training_data_v2

# Check GCS bucket
gsutil ls -b gs://elara-mvp-13082025-u1-training-data

# Check Firestore
gcloud firestore databases list --project=elara-mvp-13082025-u1
```

---

### **PHASE 3: Bootstrap Training Data** ⏱️ 30-45 minutes

#### Step 3.1: Load Public Training Data
```bash
# Run bootstrap script
GCP_PROJECT_ID="elara-mvp-13082025-u1" \
bash scripts/bootstrap-training-data.sh
```

**This loads**:
- 📊 PhishTank: ~50K phishing URLs
- 📊 URLhaus: ~10K malicious URLs
- 📊 Tranco Top 1M: 100K benign URLs
- 📊 V1 Pseudo-labels: Historical scan data (if available)

#### Step 3.2: Verify Data Load
```bash
# Query phishing URLs count
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) as count FROM elara_training_data_v2.phishing_urls"

# Query benign URLs count
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) as count FROM elara_training_data_v2.benign_urls"

# Expected: 60K-70K phishing, 100K+ benign
```

---

### **PHASE 4: Train Vertex AI Models** ⏱️ 4-8 hours (mostly automated)

**Note**: Training can run in background. Models train sequentially or in parallel.

#### Step 4.1: Enable Vertex AI and Create Buckets
```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com \
  --project=elara-mvp-13082025-u1

# Create screenshots bucket
gsutil mb -p elara-mvp-13082025-u1 \
  -c STANDARD -l us-west1 \
  gs://elara-mvp-13082025-u1-screenshots
```

#### Step 4.2: Train Stage-1 Models (CPU)
```bash
cd /d/elara-mvp-final/packages/backend/src/ml/training

# Train URL BERT model (~1-2 hours)
python train-url-lexical-bert.py \
  --epochs 10 \
  --batch-size 32 \
  --version v1

# Train Tabular Risk model (~30-45 minutes)
python train-tabular-risk.py \
  --max-depth 6 \
  --n-estimators 200 \
  --version v1
```

#### Step 4.3: Train Stage-2 Models (GPU recommended)
```bash
# Train Text Persuasion model (~1-2 hours)
python train-text-persuasion.py \
  --epochs 8 \
  --batch-size 16 \
  --version v1

# Train Screenshot CNN model (~2-3 hours)
# REQUIRES: Screenshots captured and stored in GCS
python train-screenshot-cnn.py \
  --epochs 10 \
  --batch-size 32 \
  --version v1
```

#### Step 4.4: Train Combiner Model (~30 minutes)
```bash
# Train final combiner with conformal calibration
python train-combiner.py \
  --model-type gbm \
  --version v1
```

#### Step 4.5: Verify Model Registration
```bash
# List registered models in Vertex AI
gcloud ai models list \
  --project=elara-mvp-13082025-u1 \
  --region=us-west1

# Expected: 5 models registered
# - url-lexical-bert-v1
# - tabular-risk-v1
# - text-persuasion-v1
# - screenshot-cnn-v1
# - combiner-v1
```

---

### **PHASE 5: Deploy Models to Vertex AI Endpoints** ⏱️ 30-45 minutes

#### Step 5.1: Deploy All Models
```bash
cd /d/elara-mvp-final

# Deploy all 5 models to Vertex AI endpoints
GCP_PROJECT_ID="elara-mvp-13082025-u1" \
GCP_LOCATION="us-west1" \
MODEL_VERSION="v1" \
bash scripts/deploy-v2-models.sh
```

**This creates 5 endpoints**:
1. `url-lexical-bert-endpoint` (n1-standard-4, CPU, 1-3 replicas)
2. `tabular-risk-endpoint` (n1-standard-2, CPU, 1-2 replicas)
3. `text-persuasion-endpoint` (n1-standard-4, CPU/GPU, 1-2 replicas)
4. `screenshot-cnn-endpoint` (n1-standard-4, CPU/GPU, 1-2 replicas)
5. `combiner-endpoint` (n1-standard-2, CPU, 1-2 replicas)

#### Step 5.2: Capture Endpoint IDs
```bash
# The script outputs endpoint IDs to /tmp/v2-endpoints.env
cat /tmp/v2-endpoints.env

# Example output:
# VERTEX_URL_LEXICAL_BERT_ENDPOINT=projects/123.../locations/us-west1/endpoints/456...
# VERTEX_TABULAR_RISK_ENDPOINT=projects/123.../locations/us-west1/endpoints/789...
# ...
```

---

### **PHASE 6: Configure Backend with Endpoint URLs** ⏱️ 15-20 minutes

#### Step 6.1: Add Endpoints to Kubernetes Secrets
```bash
# Get endpoint IDs from deployment script output
source /tmp/v2-endpoints.env

# Create Kubernetes secret with endpoint URLs
kubectl create secret generic v2-model-endpoints \
  --from-literal=VERTEX_URL_LEXICAL_BERT_ENDPOINT="${VERTEX_URL_LEXICAL_BERT_ENDPOINT}" \
  --from-literal=VERTEX_TABULAR_RISK_ENDPOINT="${VERTEX_TABULAR_RISK_ENDPOINT}" \
  --from-literal=VERTEX_TEXT_PERSUASION_ENDPOINT="${VERTEX_TEXT_PERSUASION_ENDPOINT}" \
  --from-literal=VERTEX_SCREENSHOT_CNN_ENDPOINT="${VERTEX_SCREENSHOT_CNN_ENDPOINT}" \
  --from-literal=VERTEX_COMBINER_ENDPOINT="${VERTEX_COMBINER_ENDPOINT}" \
  -n elara-backend-dev \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### Step 6.2: Update Deployment to Use Secrets
```bash
# Edit backend deployment to inject environment variables
kubectl edit deployment backend-api -n elara-backend-dev

# Add to container env section:
# - name: VERTEX_URL_LEXICAL_BERT_ENDPOINT
#   valueFrom:
#     secretKeyRef:
#       name: v2-model-endpoints
#       key: VERTEX_URL_LEXICAL_BERT_ENDPOINT
# ... (repeat for all 5 endpoints)

# Or use kubectl patch:
kubectl patch deployment backend-api -n elara-backend-dev \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/envFrom", "value": [{"secretRef": {"name": "v2-model-endpoints"}}]}]'
```

#### Step 6.3: Restart Pods to Apply Changes
```bash
kubectl rollout restart deployment/backend-api -n elara-backend-dev
kubectl rollout status deployment/backend-api -n elara-backend-dev
```

---

### **PHASE 7: End-to-End Testing** ⏱️ 30-45 minutes

#### Step 7.1: Test V2 Scanner with Real Models
```bash
BACKEND_URL="http://35.199.176.26/api"

# Test 1: Known phishing URL
curl -X POST "${BACKEND_URL}/v2/scan/uri" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://phishing-example.com",
    "options": {
      "useV2": true,
      "enableAI": true
    }
  }' | jq '.data.result | {
    verdict: .verdict,
    probability: .probability,
    confidenceInterval: .confidenceInterval,
    stage1Results: .stage1Results,
    stage2Results: .stage2Results,
    aiSummary: .aiSummary.summary
  }'

# Expected: High probability (0.7-0.95), verdict="malicious"

# Test 2: Known benign URL
curl -X POST "${BACKEND_URL}/v2/scan/uri" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://google.com",
    "options": {
      "useV2": true,
      "enableAI": true
    }
  }' | jq '.data.result | {
    verdict: .verdict,
    probability: .probability,
    confidenceInterval: .confidenceInterval
  }'

# Expected: Low probability (0.05-0.2), verdict="safe"
```

#### Step 7.2: Test Frontend V2 Interface
1. Navigate to: `http://136.117.33.149/` (dev frontend)
2. Toggle "Use V2 Scanner" ON
3. Enter test URL: `https://google.com`
4. Click "Scan URL"
5. Verify:
   - ✅ Probability displayed (0-1 scale)
   - ✅ Confidence interval shown
   - ✅ AI summary visible
   - ✅ Decision graph rendered
   - ✅ Stage-by-stage breakdown

#### Step 7.3: Test Central AI API (B2B)
```bash
# Get API key (admin user required)
API_KEY="your-api-key-here"

# Test /v2/ai/analyze endpoint
curl -X POST "${BACKEND_URL}/v2/ai/analyze" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "modules": ["url", "deepfake", "fact-check"]
  }' | jq '.'

# Expected: Consolidated analysis with all module results
```

---

## 📊 VERIFICATION CHECKLIST

### Infrastructure ✅
- [ ] BigQuery dataset `elara_training_data_v2` exists
- [ ] 5 BigQuery tables created and populated
- [ ] GCS bucket `elara-mvp-13082025-u1-training-data` exists
- [ ] Firestore collections created
- [ ] IAM permissions granted

### Training Data ✅
- [ ] PhishTank data loaded (50K+ URLs)
- [ ] Benign data loaded (100K+ URLs)
- [ ] V1 pseudo-labels extracted (optional)
- [ ] Total training samples: 150K+

### Models ✅
- [ ] 5 models registered in Vertex AI Model Registry
- [ ] All models show "DEPLOYED" status
- [ ] 5 endpoints created and running
- [ ] Test predictions return non-null results

### Backend ✅
- [ ] Endpoint environment variables configured
- [ ] Pods restarted with new config
- [ ] Health check passes
- [ ] V2 scanner returns real model predictions (not fallbacks)

### Frontend ✅
- [ ] V2 toggle visible and functional
- [ ] Probability displayed correctly
- [ ] AI summary renders
- [ ] Decision graph shows

### APIs ✅
- [ ] Central AI API endpoints accessible
- [ ] Authentication working
- [ ] Rate limiting functional
- [ ] Usage tracking enabled

---

## 🎯 SUCCESS CRITERIA

**V2 Platform is PRODUCTION-READY when**:

1. ✅ All 5 Vertex AI models deployed and serving predictions
2. ✅ V2 scanner returns calibrated probabilities (0-1 scale)
3. ✅ Confidence intervals computed and displayed
4. ✅ AI summaries generated by Gemini (not placeholders)
5. ✅ Screenshot capture working (Puppeteer functional)
6. ✅ No fallback logic triggered (all models using real endpoints)
7. ✅ Frontend displays all V2 features correctly
8. ✅ Central AI API accepting B2B requests
9. ✅ Decision graph visualizes reasoning
10. ✅ Performance: 95%+ scans complete in <5 seconds

---

## 🔍 CURRENT GAPS TO ADDRESS

### Critical (Blocks Production)
1. ❌ **Build Must Succeed**: Build `95592ef6` queued, must complete successfully
2. ❌ **No Trained Models**: All 5 models need training (4-8 hours)
3. ❌ **No Endpoints Configured**: Backend doesn't have endpoint URLs yet

### High Priority (Improves Accuracy)
4. ⚠️ **Screenshot Capture Not Tested**: Puppeteer integration needs real-world testing
5. ⚠️ **Conformal Calibration Default**: Using placeholder calibration parameters
6. ⚠️ **Gemini API Keys**: Verify Gemini Flash/Pro quotas and keys

### Medium Priority (Enhances UX)
7. ⚠️ **Frontend V2 Results Display**: Could be more visual (graphs, badges)
8. ⚠️ **Admin Dashboard Incomplete**: No model management UI yet
9. ⚠️ **V1 vs V2 Comparison**: No side-by-side comparison view

---

## ⏱️ TIME TO PRODUCTION

### Minimum Viable (Phases 1-6)
- **Effort**: 6-10 hours (mostly waiting for training)
- **Timeline**: 1-2 days
- **Result**: V2 working with real models, no fallbacks

### Full Production (Phases 1-7 + Testing)
- **Effort**: 8-12 hours
- **Timeline**: 2-3 days
- **Result**: Fully tested, production-ready V2

---

## 💰 ESTIMATED COSTS (Monthly)

### GCP Services (V2 Specific)
- Vertex AI Endpoints (5 models): $300-$1,500/month
- BigQuery (training data): $100-$300/month
- Cloud Storage (screenshots, models): $50-$200/month
- Vertex AI Training (initial): $500-$1,000 (one-time)

**Total V2 Additional Cost**: $950-$3,000/month

---

## 🚨 TROUBLESHOOTING

### Build Fails
- Check build logs: `gcloud builds log <BUILD_ID>`
- Common issues: TypeScript errors, missing dependencies
- Fix and push: Trigger new build automatically

### Model Training Fails
- Check Vertex AI logs in GCP Console
- Verify BigQuery data exists and is accessible
- Check service account permissions
- Ensure adequate GPU quota (for Stage-2 models)

### Endpoint Deployment Fails
- Verify model is registered in Model Registry
- Check machine type availability in region
- Ensure service account has `aiplatform.user` role

### V2 Scanner Returns Fallbacks
- Verify endpoint URLs are set in environment variables
- Check endpoint health: `gcloud ai endpoints describe <ENDPOINT_ID>`
- Test endpoint directly: Use Vertex AI console prediction test

### Frontend Not Showing V2 Features
- Check browser console for API errors
- Verify backend is returning V2 fields (probability, aiSummary)
- Clear browser cache and reload

---

## 📝 NEXT IMMEDIATE STEPS

**After Build `95592ef6` Succeeds**:

1. ✅ Verify pods running
2. ✅ Run Phase 2: Infrastructure setup (20 min)
3. ✅ Run Phase 3: Bootstrap data (30 min)
4. ✅ Start Phase 4: Train models (4-8 hours, can run overnight)
5. ✅ Run Phase 5-7 next day: Deploy, configure, test (1-2 hours)

**Total active work**: ~4-5 hours spread over 2 days
**Training wait time**: 4-8 hours (automated)

---

**Generated by**: Claude Code
**Architecture Reference**: `Prompts/v2_architecture.txt`
**Last Updated**: 2025-10-26 02:10 UTC
