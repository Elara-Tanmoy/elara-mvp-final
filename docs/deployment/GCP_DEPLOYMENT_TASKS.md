# ☁️ GCP DEPLOYMENT TASKS - COMPLETE GUIDE

**Project:** Elara Platform
**Last Updated:** October 6, 2025
**Status:** Infrastructure code ready, not deployed

---

## 📊 DEPLOYMENT OVERVIEW

### **Infrastructure Status:**
- ✅ Terraform configuration complete and production-ready
- ✅ Kubernetes manifests prepared
- ✅ Dockerfiles ready for both frontend and backend
- ⏳ GCP project not created yet
- ⏳ No resources deployed

### **What's Ready:**
- Complete Terraform infrastructure as code
- Kubernetes deployment manifests
- Service configurations
- Ingress and load balancing setup
- Database and Redis configurations

### **What's Needed:**
- GCP project creation and billing setup
- API enablement
- Service account creation
- Actual deployment execution
- Domain configuration

---

## 🔧 REQUIRED GCP SERVICES

### **1. Google Kubernetes Engine (GKE)** 🎯 CRITICAL
**Purpose:** Container orchestration for backend and frontend
**Config:** `infrastructure/terraform/main.tf` (lines 13-106)

**Specifications:**
```
Cluster Name: elara-cluster-production
Region: us-central1 (configurable)
Node Pool: 2-20 nodes (autoscaling)
Machine Type: e2-standard-4 (4 vCPU, 16GB RAM)
Disk: 100GB SSD per node
Network: Private with Workload Identity
Cost: ~$150/month (2 nodes baseline)
```

**Deployment:**
```bash
cd infrastructure/terraform
terraform init
terraform apply -var="project_id=YOUR_PROJECT_ID"
```

---

### **2. Cloud SQL for PostgreSQL** 🎯 CRITICAL
**Purpose:** Primary database
**Config:** `infrastructure/terraform/main.tf` (lines 108-143)

**Specifications:**
```
Version: PostgreSQL 16
Tier: db-custom-2-7680 (2 vCPU, 7.68GB RAM)
Disk: 100GB SSD, autoresize enabled
Backups: Daily at 3:00 AM, 30-day retention
High Availability: Regional
Network: Private IP only
Cost: ~$120/month
```

**Required Actions:**
1. Create instance via Terraform
2. Generate and store password in Secret Manager
3. Configure Cloud SQL Proxy in GKE
4. Update DATABASE_URL in secrets

**Connection String:**
```
DATABASE_URL="postgresql://[USER]:[PASS]@[PRIVATE_IP]:5432/elara_db"
```

---

### **3. Cloud Memorystore for Redis** 🎯 CRITICAL
**Purpose:** Caching, sessions, BullMQ queues, rate limiting
**Config:** `infrastructure/terraform/main.tf` (lines 145-166)

**Specifications:**
```
Version: Redis 7.0
Tier: Standard HA (high availability)
Memory: 5GB
Network: Private service access
Maintenance: Sunday 3:00 AM
Cost: ~$40/month
```

**Required Actions:**
1. Create instance via Terraform
2. Store password in Secret Manager
3. Update REDIS_HOST, REDIS_PORT, REDIS_PASSWORD in secrets

---

### **4. Cloud Storage** 🎯 CRITICAL
**Purpose:** File uploads and dataset storage
**Config:** `infrastructure/terraform/main.tf` (lines 168-208)

**Buckets:**
```
1. elara-uploads-[PROJECT_ID]
   - User file uploads (scans)
   - 90-day lifecycle deletion
   - KMS encryption
   - Versioning enabled

2. elara-datasets-[PROJECT_ID]
   - ML training datasets
   - No lifecycle deletion
   - KMS encryption
   - Versioning enabled
```

**Required Actions:**
1. Create buckets via Terraform
2. Configure IAM for GKE service account
3. Update application code to use GCS (currently local filesystem)

**Environment Variables:**
```env
GOOGLE_CLOUD_STORAGE_BUCKET_UPLOADS="elara-uploads-[PROJECT_ID]"
GOOGLE_CLOUD_STORAGE_BUCKET_DATASETS="elara-datasets-[PROJECT_ID]"
```

---

### **5. Cloud KMS** 🎯 CRITICAL
**Purpose:** Encryption key management
**Config:** `infrastructure/terraform/main.tf` (lines 210-225)

**Specifications:**
```
Key Ring: elara-keyring-production
Key Name: elara-key
Rotation: Every 90 days
Purpose: Encrypt Cloud Storage buckets
Cost: ~$1/month
```

---

### **6. Secret Manager** 🎯 CRITICAL
**Purpose:** Secure API key storage
**Config:** `infrastructure/terraform/main.tf` (lines 227-234)

**Secrets to Store:**
```
elara-api-keys-production:
  - ANTHROPIC_API_KEY (Claude Sonnet 4.5)
  - OPENAI_API_KEY (GPT-4)
  - GOOGLE_AI_API_KEY (Gemini Pro)
  - VIRUSTOTAL_API_KEY
  - GOOGLE_SAFE_BROWSING_API_KEY
  - ABUSEIPDB_API_KEY
  - JWT_SECRET
  - DATABASE_URL
  - REDIS_PASSWORD
```

**Required Actions:**
1. Create secret via Terraform
2. Add each key as a version
3. Grant GKE service account access
4. Update K8s deployment to read from Secret Manager

---

## 🔌 OPTIONAL GCP SERVICES

### **7. BigQuery** ⭐ RECOMMENDED
**Purpose:** ML dataset logging and analytics
**Status:** Code implemented, package NOT installed
**File:** `packages/backend/src/services/logging/bigquery-logger.service.ts`

**What It Does:**
- Logs all analysis results for ML training
- Removes PII automatically
- Tracks performance metrics
- 365-day data retention

**To Enable:**
```bash
cd packages/backend
pnpm add @google-cloud/bigquery
```

**Environment Setup:**
```env
# Use Workload Identity (recommended)
# OR
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

**Deployment:**
- Service auto-creates dataset and table on first run
- Enable BigQuery API in GCP project
- Grant service account `roles/bigquery.dataEditor`

**Fallback:** If not enabled, logs to local files in `logs/ml-dataset/`

**Cost:** ~$5/month for 1TB processed data

---

### **8. Speech-to-Text API** ⭐ RECOMMENDED
**Purpose:** Audio transcription for voice scam analysis
**Status:** Code implemented, package NOT installed
**File:** `packages/backend/src/services/audio/transcription.service.ts`

**What It Does:**
- Transcribes phone call recordings
- Detects scam keywords in speech
- Supports 15 languages
- Analyzes speech patterns

**To Enable:**
```bash
cd packages/backend
pnpm add @google-cloud/speech
```

**Deployment:**
- Enable Speech-to-Text API in GCP project
- Grant service account `roles/speech.client`

**Fallback:** Returns helpful error message if not configured

**Cost:** ~$25/month for 1,000 minutes transcribed

---

### **9. Vision API** 💡 FUTURE
**Purpose:** Brand impersonation detection (Phase 2)
**Status:** Mentioned in docs, not implemented
**Reference:** `PENDING_FEATURES.md`

**Future Use Cases:**
- Detect phishing sites that copy legitimate brand visuals
- Logo detection and comparison
- Screenshot analysis

---

## 📝 CONFIGURATION FILES TO UPDATE

### **1. Kubernetes Manifests** 🎯 REQUIRED

#### **backend-deployment.yaml** (Line 19)
```yaml
# BEFORE:
image: gcr.io/PROJECT_ID/elara-backend:latest

# AFTER:
image: gcr.io/YOUR_ACTUAL_PROJECT_ID/elara-backend:latest
```

#### **frontend-deployment.yaml** (Line 19)
```yaml
# BEFORE:
image: gcr.io/PROJECT_ID/elara-frontend:latest

# AFTER:
image: gcr.io/YOUR_ACTUAL_PROJECT_ID/elara-frontend:latest
```

#### **frontend-ingress.yaml** (Line 53)
```yaml
# BEFORE:
- hosts:
  - elara.example.com

# AFTER:
- hosts:
  - your-actual-domain.com
```

**Quick Replace:**
```bash
cd infrastructure/k8s
sed -i 's/PROJECT_ID/your-project-id/g' *.yaml
sed -i 's/elara.example.com/yourdomain.com/g' frontend-ingress.yaml
```

---

### **2. Environment Variables** 🎯 REQUIRED

#### **Production .env Template:**
```env
# Database (Cloud SQL)
DATABASE_URL="postgresql://elara_user:[PASSWORD]@[CLOUD_SQL_IP]:5432/elara_db"

# Redis (Memorystore)
REDIS_HOST="[REDIS_INTERNAL_IP]"
REDIS_PORT=6379
REDIS_PASSWORD="[GENERATED_PASSWORD]"

# JWT Secrets
JWT_SECRET="[GENERATE_SECURE_SECRET]"
JWT_EXPIRES_IN="30m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="https://your-domain.com"

# AI Services (at least one required)
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-proj-..."
GOOGLE_AI_API_KEY="AIza..."

# External APIs (recommended)
VIRUSTOTAL_API_KEY="your-key"
GOOGLE_SAFE_BROWSING_API_KEY="your-key"
ABUSEIPDB_API_KEY="your-key"

# ChromaDB (deployed separately or local)
CHROMADB_URL="http://chromadb-service:8000"

# Cloud Storage (optional)
GOOGLE_CLOUD_STORAGE_BUCKET_UPLOADS="elara-uploads-[PROJECT_ID]"
GOOGLE_CLOUD_STORAGE_BUCKET_DATASETS="elara-datasets-[PROJECT_ID]"

# Rate Limiting
RATE_LIMIT_FREE=100
RATE_LIMIT_PRO=1000
RATE_LIMIT_ENTERPRISE=10000

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR="./uploads"

# Privacy
HASH_SALT="[GENERATE_SECURE_SALT]"
```

---

## 🔐 IAM & SERVICE ACCOUNTS

### **1. GKE Workload Identity Service Account** 🎯 REQUIRED

**Purpose:** Allow GKE pods to access GCP services securely

**Required Roles:**
- `roles/cloudsql.client` - Connect to Cloud SQL
- `roles/storage.objectAdmin` - Read/write Cloud Storage
- `roles/secretmanager.secretAccessor` - Read secrets
- `roles/bigquery.dataEditor` - Write to BigQuery (optional)
- `roles/speech.client` - Use Speech-to-Text (optional)
- `roles/cloudkms.cryptoKeyEncrypterDecrypter` - Use KMS keys

**Setup Commands:**
```bash
# 1. Create Kubernetes service account
kubectl create serviceaccount elara-backend-sa

# 2. Create GCP service account
gcloud iam service-accounts create elara-backend-sa \
  --display-name="Elara Backend Service Account" \
  --project=YOUR_PROJECT_ID

# 3. Bind K8s SA to GCP SA (Workload Identity)
gcloud iam service-accounts add-iam-policy-binding \
  elara-backend-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="serviceAccount:YOUR_PROJECT_ID.svc.id.goog[default/elara-backend-sa]" \
  --project=YOUR_PROJECT_ID

# 4. Grant Cloud SQL access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:elara-backend-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# 5. Grant Cloud Storage access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:elara-backend-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 6. Grant Secret Manager access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:elara-backend-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for BigQuery, Speech, KMS if using those services
```

**Update Deployment:**
```yaml
# In backend-deployment.yaml, add:
spec:
  serviceAccountName: elara-backend-sa
```

---

### **2. Terraform Deployment Service Account** 🎯 REQUIRED

**Purpose:** Deploy infrastructure via Terraform

**Required Roles:**
- `roles/compute.admin` - GKE cluster management
- `roles/container.admin` - Kubernetes resources
- `roles/sql.admin` - Cloud SQL
- `roles/redis.admin` - Memorystore Redis
- `roles/storage.admin` - Cloud Storage
- `roles/cloudkms.admin` - KMS
- `roles/secretmanager.admin` - Secret Manager
- `roles/iam.serviceAccountAdmin` - Create service accounts

**Setup:**
```bash
# 1. Create service account
gcloud iam service-accounts create terraform-deployer \
  --display-name="Terraform Deployment Account" \
  --project=YOUR_PROJECT_ID

# 2. Grant roles (repeat for each role above)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:terraform-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.admin"

# 3. Create key for Terraform
gcloud iam service-accounts keys create terraform-key.json \
  --iam-account=terraform-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com

# 4. Use key with Terraform
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/terraform-key.json"
```

---

### **3. Developer Service Account** 💡 OPTIONAL

**Purpose:** Local development with GCP services

**Required Roles:**
- `roles/bigquery.dataEditor` - Test BigQuery
- `roles/speech.client` - Test Speech-to-Text
- `roles/storage.objectViewer` - Read from buckets

---

## 📋 DEPLOYMENT CHECKLIST

### **Phase 1: GCP Project Setup**
- [ ] Create new GCP project or select existing
- [ ] Enable billing on project
- [ ] Install gcloud CLI: `https://cloud.google.com/sdk/docs/install`
- [ ] Install kubectl: `gcloud components install kubectl`
- [ ] Install Terraform: `https://www.terraform.io/downloads`
- [ ] Login to gcloud: `gcloud auth login`
- [ ] Set project: `gcloud config set project YOUR_PROJECT_ID`

### **Phase 2: Enable APIs**
```bash
# Enable all required APIs
gcloud services enable \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  cloudkms.googleapis.com \
  secretmanager.googleapis.com \
  --project=YOUR_PROJECT_ID

# Optional APIs
gcloud services enable \
  bigquery.googleapis.com \
  speech.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### **Phase 3: Create Service Accounts**
- [ ] Create Terraform service account
- [ ] Generate and download key
- [ ] Grant required IAM roles
- [ ] Create GKE Workload Identity service account

### **Phase 4: Deploy Infrastructure**
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review plan
terraform plan -var="project_id=YOUR_PROJECT_ID"

# Apply (creates all GCP resources)
terraform apply -var="project_id=YOUR_PROJECT_ID"

# Wait 10-15 minutes for resources to be ready
```

### **Phase 5: Configure Secrets**
```bash
# Create secret with all API keys
gcloud secrets create elara-api-keys-production \
  --replication-policy="automatic" \
  --project=YOUR_PROJECT_ID

# Add each key as a version
echo -n "sk-ant-your-key" | gcloud secrets versions add elara-api-keys-production \
  --data-file=- \
  --project=YOUR_PROJECT_ID

# Repeat for all keys
```

### **Phase 6: Build and Push Docker Images**
```bash
# Authenticate Docker with GCR
gcloud auth configure-docker gcr.io

# Build backend
cd packages/backend
docker build -t gcr.io/YOUR_PROJECT_ID/elara-backend:latest .
docker push gcr.io/YOUR_PROJECT_ID/elara-backend:latest

# Build frontend
cd packages/frontend
docker build -t gcr.io/YOUR_PROJECT_ID/elara-frontend:latest .
docker push gcr.io/YOUR_PROJECT_ID/elara-frontend:latest
```

### **Phase 7: Update Kubernetes Manifests**
```bash
cd infrastructure/k8s

# Replace PROJECT_ID placeholder
sed -i 's/PROJECT_ID/YOUR_PROJECT_ID/g' *.yaml

# Update domain name
sed -i 's/elara.example.com/your-domain.com/g' frontend-ingress.yaml

# Review changes
git diff
```

### **Phase 8: Deploy to Kubernetes**
```bash
# Get cluster credentials
gcloud container clusters get-credentials elara-cluster-production \
  --region=us-central1 \
  --project=YOUR_PROJECT_ID

# Verify connection
kubectl get nodes

# Create namespace (if not using default)
kubectl create namespace elara

# Deploy all manifests
kubectl apply -f infrastructure/k8s/

# Check deployment status
kubectl get pods
kubectl get services
kubectl get ingress
```

### **Phase 9: Database Setup**
```bash
# Install Cloud SQL Proxy locally
curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud-sql-proxy

# Get connection name
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe elara-db-production \
  --format="value(connectionName)" \
  --project=YOUR_PROJECT_ID)

# Start proxy
./cloud-sql-proxy ${INSTANCE_CONNECTION_NAME}

# In another terminal, run migrations
cd packages/backend
export DATABASE_URL="postgresql://elara_user:[PASSWORD]@127.0.0.1:5432/elara_db"
pnpm prisma migrate deploy

# Create initial admin user (if needed)
pnpm prisma db seed
```

### **Phase 10: Verification**
- [ ] Check all pods are running: `kubectl get pods`
- [ ] Check services have external IPs: `kubectl get services`
- [ ] Check ingress is configured: `kubectl get ingress`
- [ ] Test backend health: `curl http://[BACKEND_IP]/api/health`
- [ ] Access frontend in browser
- [ ] Test login/register
- [ ] Test URL scan
- [ ] Check logs: `kubectl logs -l app=elara-backend`

### **Phase 11: DNS Configuration**
```bash
# Get ingress external IP
INGRESS_IP=$(kubectl get ingress frontend-ingress \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Configure DNS A record:"
echo "Domain: your-domain.com"
echo "Type: A"
echo "Value: ${INGRESS_IP}"
```

- [ ] Add A record in DNS provider
- [ ] Wait for DNS propagation (up to 48 hours)
- [ ] Verify: `nslookup your-domain.com`

### **Phase 12: SSL/TLS Setup**
```bash
# Install cert-manager (if not already)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f infrastructure/k8s/cert-issuer.yaml

# Certificate will auto-generate via ingress annotation
# Check status
kubectl get certificate
kubectl describe certificate elara-tls
```

---

## 💰 COST ESTIMATION

### **Baseline Production (Required Services):**
```
GKE Cluster (2x e2-standard-4):     $150/month
Cloud SQL (db-custom-2-7680):       $120/month
Memorystore Redis (5GB Standard):    $40/month
Cloud Storage (50GB):                 $1/month
Cloud KMS (1 key):                    $1/month
Load Balancer:                       $18/month
Networking/Egress (100GB):           $12/month
Secret Manager:                      $0.06/month
──────────────────────────────────────────────
TOTAL BASELINE:                     ~$342/month
```

### **With Optional Services:**
```
+ BigQuery (1TB processed/month):    $5/month
+ Speech-to-Text (1,000 minutes):   $25/month
──────────────────────────────────────────────
TOTAL WITH OPTIONAL:                ~$372/month
```

### **Cost Optimization Tips:**
- Use Preemptible/Spot nodes for dev/staging (70% savings)
- Enable cluster autoscaling to scale to zero off-hours
- Use committed use discounts (30-50% savings)
- Archive old data to Coldline storage

---

## 🚀 QUICK START (Summary)

```bash
# 1. Setup
gcloud config set project YOUR_PROJECT_ID
gcloud services enable container.googleapis.com sqladmin.googleapis.com redis.googleapis.com

# 2. Deploy Infrastructure
cd infrastructure/terraform
terraform init
terraform apply -var="project_id=YOUR_PROJECT_ID"

# 3. Build Images
cd packages/backend && docker build -t gcr.io/YOUR_PROJECT_ID/elara-backend:latest . && docker push gcr.io/YOUR_PROJECT_ID/elara-backend:latest
cd packages/frontend && docker build -t gcr.io/YOUR_PROJECT_ID/elara-frontend:latest . && docker push gcr.io/YOUR_PROJECT_ID/elara-frontend:latest

# 4. Deploy to K8s
gcloud container clusters get-credentials elara-cluster-production --region=us-central1
kubectl apply -f infrastructure/k8s/

# 5. Run Migrations
pnpm prisma migrate deploy

# 6. Verify
kubectl get pods
kubectl get services
```

---

## 📚 REFERENCE DOCUMENTATION

- **Terraform Config:** `infrastructure/terraform/main.tf`
- **K8s Manifests:** `infrastructure/k8s/`
- **Environment Template:** `packages/backend/.env.example`
- **API Keys Setup:** `API-KEYS-SETUP.md`
- **Full Setup Guide:** `SETUP.md`
- **Implementation Status:** `CHECKPOINT_LATEST.md`

---

## ⚠️ IMPORTANT NOTES

1. **Never commit secrets** to Git - use Secret Manager
2. **Use Workload Identity** instead of service account keys
3. **Enable VPC-native networking** for security
4. **Set up monitoring** (Stackdriver) for production
5. **Configure backups** for both database and Redis
6. **Test disaster recovery** procedures
7. **Document all custom configurations**

---

**Status:** Infrastructure code is production-ready. Requires GCP project setup and deployment execution.

**Next Steps:** Create GCP project → Enable APIs → Run Terraform → Deploy to Kubernetes

---

**END OF GCP DEPLOYMENT GUIDE**
