# Elara V2 Complete Implementation Plan
**Date**: 2025-10-25
**Branch**: develop
**Objective**: Full end-to-end V2 scanner with training data lake and Vertex AI integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELARA V2 COMPLETE SYSTEM                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. TRAINING DATA LAKE (BigQuery + GCS)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │ Admin Upload API │───>│ Data Validation  │───>│  BigQuery Tables │     │
│  │ CSV/XLSX/JSON/SQL│    │ Schema Enforce   │    │  - phishing_urls │     │
│  └──────────────────┘    └──────────────────┘    │  - benign_urls   │     │
│           │                                       │  - scan_features │     │
│           v                                       │  - ti_hits       │     │
│  ┌──────────────────┐                            └──────────────────┘     │
│  │ Public Sources   │                                     │               │
│  │ - PhishTank      │                                     v               │
│  │ - URLhaus        │                            ┌──────────────────┐     │
│  │ - Tranco Top 1M  │                            │ Feature Store    │     │
│  │ - V1 Pseudo      │                            │ (Vertex AI)      │     │
│  └──────────────────┘                            └──────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. TRAINING PIPELINE (Vertex AI Pipelines)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Pipeline Orchestrator (Cloud Functions / Cloud Run)            │        │
│  │  - Triggered by admin or schedule                              │        │
│  │  - Reads from BigQuery                                         │        │
│  │  - Submits training jobs to Vertex AI                          │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                             │                                              │
│                             v                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Training Jobs (Vertex AI Custom Training)                      │        │
│  │                                                                 │        │
│  │  1. URL Lexical B (PhishBERT/URLBERT)                         │        │
│  │     - Input: URL tokens from BigQuery                          │        │
│  │     - Framework: TensorFlow/PyTorch                            │        │
│  │     - Output: Fine-tuned BERT model                           │        │
│  │                                                                 │        │
│  │  2. Tabular Risk (Monotonic XGBoost)                          │        │
│  │     - Input: Tabular features from Feature Store               │        │
│  │     - Framework: XGBoost with monotonic constraints            │        │
│  │     - Output: Calibrated tabular model                         │        │
│  │                                                                 │        │
│  │  3. Text Persuasion (Gemma/Mixtral)                           │        │
│  │     - Input: Aggregated page text                              │        │
│  │     - Framework: Fine-tuned LLM                                │        │
│  │     - Output: Persuasion detection model                       │        │
│  │                                                                 │        │
│  │  4. Screenshot CNN (EfficientNet/ViT)                         │        │
│  │     - Input: Screenshots from scans                            │        │
│  │     - Framework: TensorFlow/PyTorch                            │        │
│  │     - Output: Brand detection model                            │        │
│  │                                                                 │        │
│  │  5. Combiner (Calibrated Fusion)                              │        │
│  │     - Input: Stage-1/Stage-2 predictions + causal signals      │        │
│  │     - Framework: Logistic/GBM + ICP                           │        │
│  │     - Output: Final calibrated model                           │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                             │                                              │
│                             v                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Model Registry (Vertex AI)                                     │        │
│  │  - Version tracking                                             │        │
│  │  - Metrics logging (F1, FPR, FNR, latency)                    │        │
│  │  - Model metadata                                              │        │
│  └────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MODEL DEPLOYMENT (Vertex AI Endpoints)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │ Stage-1 CPU Endpoint │  │ Stage-2 GPU Endpoint │                        │
│  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │                        │
│  │ │ URL Lexical B    │ │  │ │ Text Persuasion  │ │                        │
│  │ │ Tabular Risk     │ │  │ │ Screenshot CNN   │ │                        │
│  │ └──────────────────┘ │  │ └──────────────────┘ │                        │
│  │ Min: 1 node          │  │ Min: 0 nodes (scale  │                        │
│  │ Max: 5 nodes         │  │      to zero)        │                        │
│  │ Autoscaling: CPU 70% │  │ Max: 3 nodes         │                        │
│  └──────────────────────┘  │ Autoscaling: GPU 60% │                        │
│                             └──────────────────────┘                        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Monitoring & Alerts                                             │        │
│  │  - Latency (p50, p95, p99)                                     │        │
│  │  - Error rate                                                   │        │
│  │  - Prediction drift detection                                  │        │
│  │  - Cost tracking                                                │        │
│  └────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. V2 SCANNER INTEGRATION                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Request                                                               │
│      │                                                                      │
│      v                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Scan Controller                                                 │        │
│  │  - Accept ?version=v2 param                                    │        │
│  │  - Queue scan job with scanEngineVersion                       │        │
│  └────────────────────────────────────────────────────────────────┘        │
│      │                                                                      │
│      v                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Scan Processor (Queue Worker)                                  │        │
│  │  - Check V2ScannerConfig                                       │        │
│  │  - Determine V1 vs V2                                          │        │
│  │  - Shadow mode support                                         │        │
│  └────────────────────────────────────────────────────────────────┘        │
│      │                │                                                     │
│      v                v                                                     │
│  ┌─────────┐    ┌──────────────────────────────────────────────┐          │
│  │ V1      │    │ V2 Scanner                                    │          │
│  │ Scanner │    │                                               │          │
│  └─────────┘    │ 1. Reachability                              │          │
│                 │ 2. Evidence Collection                        │          │
│                 │ 3. Feature Extraction                         │          │
│                 │ 4. TI Integration ─────> 18 TI Sources        │          │
│                 │ 5. Stage-1 Models ─────> Vertex AI Endpoints  │          │
│                 │ 6. Stage-2 Models ─────> Vertex AI Endpoints  │          │
│                 │ 7. Combiner + ICP                             │          │
│                 │ 8. Policy Engine                              │          │
│                 │ 9. Consensus Service ──> Gemini Router        │          │
│                 │                                               │          │
│                 └──────────────────────────────────────────────┘          │
│                                     │                                       │
│                                     v                                       │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ EnhancedScanResult                                              │        │
│  │  - riskScore, riskLevel                                        │        │
│  │  - probability, confidenceInterval                             │        │
│  │  - decisionGraph                                                │        │
│  │  - recommendedActions                                           │        │
│  │  - geminiExplanation                                            │        │
│  └────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. ADMIN UI                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Training Data Management                                        │        │
│  │  - Upload CSV/XLSX/JSON/SQL files                             │        │
│  │  - View uploaded datasets                                      │        │
│  │  - Validate data schemas                                       │        │
│  │  - Trigger training jobs                                       │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ V2 Scanner Configuration                                        │        │
│  │  - Enable/Disable V2                                           │        │
│  │  - Rollout percentage (0-100%)                                 │        │
│  │  - Shadow mode toggle                                          │        │
│  │  - Vertex endpoints configuration                              │        │
│  │  - Threshold tuning                                            │        │
│  │  - Per-organization enablement                                 │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ V2 Check Definitions                                            │        │
│  │  - Manage granular checks                                      │        │
│  │  - Adjust weights/thresholds                                   │        │
│  │  - Enable/disable checks                                       │        │
│  │  - Bulk updates                                                │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ V2 Presets                                                      │        │
│  │  - Strict / Balanced / Lenient presets                        │        │
│  │  - Create custom presets                                       │        │
│  │  - Apply/clone presets                                         │        │
│  │  - Import/export presets                                       │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ Model Registry Dashboard                                        │        │
│  │  - View deployed models                                        │        │
│  │  - Model versions and metrics                                  │        │
│  │  - Training history                                            │        │
│  │  - Deployment status                                           │        │
│  └────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘

## Implementation Phases

### Phase 1: Training Data Lake (Weeks 1-2)

#### 1.1 BigQuery Infrastructure
- **Dataset**: `elara_training_data_v2`
- **Tables**:
  - `phishing_urls` - Labeled phishing URLs
  - `benign_urls` - Labeled benign URLs
  - `scan_features` - Extracted features from scans
  - `ti_hits` - Threat intelligence hits
  - `training_metadata` - Dataset metadata and versioning

#### 1.2 Data Upload API
**Endpoint**: `/api/admin/training-data/upload`
- **Formats**: CSV, XLSX, JSON, SQL
- **Schema validation**: Enforce required fields (url, label, source, timestamp)
- **Deduplication**: Hash-based URL deduplication
- **Storage**: GCS → BigQuery pipeline

#### 1.3 Data Validation Service
- Column validation (url, label, confidence, source)
- URL format validation
- Label validation (phishing, benign, suspicious)
- Data quality metrics

### Phase 2: Vertex AI Setup (Week 2)

#### 2.1 Feature Store
- **Features**:
  - `domain_age` (slow-moving, TTL: 24h)
  - `asn_reputation` (slow-moving, TTL: 24h)
  - `ti_hit_count` (medium, TTL: 1h)
  - `tld_risk_score` (static, TTL: 7d)

#### 2.2 Model Registry
- Version tracking
- Metrics storage (F1, precision, recall, FPR, FNR)
- Model lineage
- Deployment status

#### 2.3 Training Pipeline Setup
- Cloud Functions trigger
- Vertex AI Pipeline definition (KFP)
- Hyperparameter tuning configuration
- Model evaluation scripts

### Phase 3: Model Training (Weeks 3-4)

#### 3.1 Bootstrap Training Data
**Script**: `scripts/bootstrap-training-data.sh`
```bash
# PhishTank (50K phishing URLs)
wget https://data.phishtank.com/data/online-valid.csv
bq load --autodetect elara_training_data_v2.phishing_urls phishtank.csv

# URLhaus (100K malicious URLs)
wget https://urlhaus.abuse.ch/downloads/csv_recent/
bq load --autodetect elara_training_data_v2.phishing_urls urlhaus.csv

# Tranco Top 1M (benign)
wget https://tranco-list.eu/top-1m.csv.zip
bq load --autodetect elara_training_data_v2.benign_urls tranco.csv

# V1 Pseudo-labels (6 months)
# Query existing scans with high-confidence V1 results
```

#### 3.2 Train URL Lexical B (PhishBERT)
- Base model: `huggingface.co/BERT/phishbert`
- Fine-tuning: 10K phishing + 10K benign
- Epochs: 5
- Batch size: 32
- Learning rate: 2e-5
- Validation: 80/20 split
- Target F1: >92%

#### 3.3 Train Tabular Risk (XGBoost)
- Features: 50 tabular features
- Monotonic constraints on domain age, TI hits
- Trees: 500
- Max depth: 6
- Learning rate: 0.1
- Target F1: >90%

#### 3.4 Calibration
- Isotonic regression on validation set
- Branch-specific thresholds
- Confidence interval calculation (ICP, alpha=0.1)

### Phase 4: Model Deployment (Week 4)

#### 4.1 Deploy to Vertex AI Endpoints
**Script**: `scripts/deploy-vertex-models.sh`

```bash
# Stage-1 CPU Endpoint
gcloud ai endpoints create \
  --region=us-central1 \
  --display-name=elara-v2-stage1

gcloud ai models deploy MODEL_ID \
  --endpoint=ENDPOINT_ID \
  --region=us-central1 \
  --machine-type=n1-standard-4 \
  --min-replica-count=1 \
  --max-replica-count=5

# Stage-2 GPU Endpoint
gcloud ai endpoints create \
  --region=us-central1 \
  --display-name=elara-v2-stage2

gcloud ai models deploy MODEL_ID \
  --endpoint=ENDPOINT_ID \
  --region=us-central1 \
  --machine-type=n1-standard-4 \
  --accelerator-type=nvidia-tesla-t4 \
  --accelerator-count=1 \
  --min-replica-count=0 \
  --max-replica-count=3
```

#### 4.2 Health Checks
- Endpoint availability monitoring
- Latency tracking
- Error rate alerts

### Phase 5: V2 Integration (Week 5)

#### 5.1 TI Integration Service
**File**: `packages/backend/src/services/threat-intel/v2-ti-integration.service.ts`
- Fetch TI hits for URL
- Calculate tier-1 hit count
- Dual tier-1 detection
- Feature extraction for tabular model

#### 5.2 Scan Processor Integration
**File**: `packages/backend/src/services/queue/scan.processor.ts`
- Check `V2ScannerConfig`
- Route to V1/V2
- Shadow mode comparison
- Latency tracking

#### 5.3 Admin API
**Controllers**:
- `v2-config.controller.ts` - V2 configuration
- `v2-checks.controller.ts` - Check definitions (already created)
- `v2-presets.controller.ts` - Presets (already created)
- `training-data.controller.ts` - Training data management

### Phase 6: Admin UI (Week 6)

#### 6.1 Training Data Management UI
**Components**:
- `TrainingDataUpload.tsx` - Multi-format upload
- `DatasetList.tsx` - View datasets
- `TrainingJobTrigger.tsx` - Launch training

#### 6.2 V2 Scanner Config UI
**Components**:
- `V2ScannerConfig.tsx` - Main config page
- `V2ConfigForm.tsx` - Settings form
- `V2StatsCard.tsx` - V1 vs V2 statistics
- `V2ChecksManager.tsx` - Granular checks
- `V2PresetsManager.tsx` - Preset management

### Phase 7: Testing & Deployment (Week 7)

#### 7.1 Database Migration
```bash
cd packages/backend
npx prisma db push
npx prisma generate
```

#### 7.2 End-to-End Testing
- Test URL upload → feature extraction
- Test Stage-1 prediction
- Test Stage-2 prediction
- Test consensus generation
- Test admin UI flows

#### 7.3 Deploy to GCP Dev
```bash
git add .
git commit -m "feat: Complete V2 implementation with training data lake"
git push origin develop
# Cloud Build auto-deploys
```

#### 7.4 Shadow Mode Testing
- Enable shadow mode
- Run V1 and V2 in parallel
- Compare results
- Tune thresholds

#### 7.5 Gradual Rollout
- Week 1: 10% V2
- Week 2: 25% V2
- Week 3: 50% V2
- Week 4: 100% V2

## File Structure

```
packages/backend/
├── src/
│   ├── scanners/
│   │   └── url-scanner-v2/          [✅ Complete]
│   │       ├── index.ts
│   │       ├── types.ts
│   │       ├── reachability.ts
│   │       ├── evidence.ts
│   │       ├── feature-extract.ts
│   │       ├── stage1.ts
│   │       ├── stage2.ts
│   │       ├── combiner.ts
│   │       └── policy.ts
│   ├── services/
│   │   ├── ai/
│   │   │   └── geminiRouter.service.ts   [✅ Complete]
│   │   ├── consensus/
│   │   │   └── consensus.service.ts      [✅ Complete]
│   │   ├── config/
│   │   │   └── v2-scanner-config.service.ts [✅ Complete]
│   │   ├── threat-intel/
│   │   │   └── v2-ti-integration.service.ts [⏳ To create]
│   │   ├── training/
│   │   │   ├── data-upload.service.ts    [⏳ To create]
│   │   │   ├── data-validation.service.ts [⏳ To create]
│   │   │   └── training-pipeline.service.ts [⏳ To create]
│   │   └── vertex-ai/
│   │       ├── feature-store.service.ts  [⏳ To create]
│   │       ├── model-registry.service.ts [⏳ To create]
│   │       └── prediction.service.ts     [⏳ To create]
│   ├── controllers/
│   │   ├── admin/
│   │   │   ├── v2-config.controller.ts   [⏳ To create]
│   │   │   ├── v2-checks.controller.ts   [✅ Complete]
│   │   │   ├── v2-presets.controller.ts  [✅ Complete]
│   │   │   └── training-data.controller.ts [⏳ To create]
│   │   └── scan.controller.ts            [⏳ Update]
│   └── routes/
│       ├── admin.routes.ts               [⏳ Update]
│       └── training.routes.ts            [⏳ To create]
├── scripts/
│   ├── setup-bigquery.sh                 [⏳ To create]
│   ├── setup-vertex-ai.sh                [⏳ To create]
│   ├── bootstrap-training-data.sh        [⏳ To create]
│   └── deploy-vertex-models.sh           [⏳ To create]
└── prisma/
    └── schema.prisma                     [✅ Updated with V2 models]

packages/frontend/
└── src/
    ├── pages/
    │   └── admin/
    │       ├── TrainingData.tsx          [⏳ To create]
    │       ├── V2ScannerConfig.tsx       [⏳ To create]
    │       ├── V2Checks.tsx              [⏳ To create]
    │       └── V2Presets.tsx             [⏳ To create]
    └── components/
        └── admin/
            ├── TrainingDataUpload.tsx    [⏳ To create]
            ├── V2ConfigForm.tsx          [⏳ To create]
            ├── V2StatsCard.tsx           [⏳ To create]
            ├── V2ChecksManager.tsx       [⏳ To create]
            └── V2PresetsManager.tsx      [⏳ To create]
```

## Success Criteria

- ✅ Training data upload API supports CSV, XLSX, JSON, SQL
- ✅ BigQuery tables populated with 100K+ labeled URLs
- ✅ Vertex AI models deployed and accessible
- ✅ V2 scanner integrated end-to-end
- ✅ Admin UI fully functional
- ✅ Shadow mode testing shows <5% FPR, <7% FNR
- ✅ Latency p95 < 1.5s for Stage-1 only scans
- ✅ Cost per scan < $0.001 with caching

## Next Steps

1. Create training data lake infrastructure
2. Implement training data API
3. Set up Vertex AI components
4. Integrate V2 scanner with existing system
5. Build admin UI
6. Test end-to-end
7. Deploy to GCP dev
8. Shadow mode testing
9. Gradual rollout

---
**Status**: Ready to implement
**Estimated Time**: 6-7 weeks
**Priority**: HIGH
