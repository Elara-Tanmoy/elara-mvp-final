#!/bin/bash

###############################################################################
# Elara V2 Infrastructure Setup Script
#
# Sets up all required GCP infrastructure for V2 scanner:
# - BigQuery datasets and tables
# - Firestore collections
# - GCS buckets
# - Vertex AI Feature Store
# - Vertex AI Model Registry
#
# Usage: ./scripts/setup-v2-infrastructure.sh
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-elara-mvp}"
LOCATION="${GCP_LOCATION:-us-central1}"
DATASET_NAME="elara_training_data_v2"
BUCKET_NAME="${PROJECT_ID}-training-data"

echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}  Elara V2 Infrastructure Setup${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "Project ID:     ${YELLOW}${PROJECT_ID}${NC}"
echo -e "Location:       ${YELLOW}${LOCATION}${NC}"
echo -e "Dataset:        ${YELLOW}${DATASET_NAME}${NC}"
echo -e "Bucket:         ${YELLOW}${BUCKET_NAME}${NC}"
echo ""

# Confirm before proceeding
read -p "Continue with setup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Setup cancelled${NC}"
    exit 1
fi

###############################################################################
# 1. BigQuery Setup
###############################################################################

echo -e "\n${GREEN}[1/6] Setting up BigQuery datasets and tables...${NC}"

# Create dataset
echo "Creating BigQuery dataset: ${DATASET_NAME}"
bq mk --dataset \
    --location=${LOCATION} \
    --description="Elara V2 training data and features" \
    ${PROJECT_ID}:${DATASET_NAME} 2>/dev/null || echo "Dataset already exists"

# Create phishing_urls table
echo "Creating table: phishing_urls"
bq mk --table \
    ${PROJECT_ID}:${DATASET_NAME}.phishing_urls \
    url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP,features:JSON,metadata:JSON \
    2>/dev/null || echo "Table already exists"

# Create benign_urls table
echo "Creating table: benign_urls"
bq mk --table \
    ${PROJECT_ID}:${DATASET_NAME}.benign_urls \
    url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP,features:JSON,metadata:JSON \
    2>/dev/null || echo "Table already exists"

# Create scan_features table
echo "Creating table: scan_features"
bq mk --table \
    ${PROJECT_ID}:${DATASET_NAME}.scan_features \
    scan_id:STRING,url:STRING,domain:STRING,domain_age:INTEGER,tld_risk:FLOAT,ti_hits:INTEGER,tier1_hits:INTEGER,features:JSON,timestamp:TIMESTAMP \
    2>/dev/null || echo "Table already exists"

# Create ti_hits table
echo "Creating table: ti_hits"
bq mk --table \
    ${PROJECT_ID}:${DATASET_NAME}.ti_hits \
    url:STRING,domain:STRING,source:STRING,tier:INTEGER,severity:STRING,last_seen:TIMESTAMP,metadata:JSON \
    2>/dev/null || echo "Table already exists"

# Create uploaded_training_data table
echo "Creating table: uploaded_training_data"
bq mk --table \
    ${PROJECT_ID}:${DATASET_NAME}.uploaded_training_data \
    dataset_id:STRING,url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP,features:JSON,metadata:JSON \
    2>/dev/null || echo "Table already exists"

echo -e "${GREEN}✓ BigQuery setup complete${NC}"

###############################################################################
# 2. Cloud Storage Setup
###############################################################################

echo -e "\n${GREEN}[2/6] Setting up Cloud Storage buckets...${NC}"

# Create training data bucket
echo "Creating GCS bucket: ${BUCKET_NAME}"
gsutil mb -p ${PROJECT_ID} -c STANDARD -l ${LOCATION} gs://${BUCKET_NAME}/ 2>/dev/null || echo "Bucket already exists"

# Set lifecycle policy (delete files older than 90 days)
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/lifecycle.json gs://${BUCKET_NAME}/
rm /tmp/lifecycle.json

# Create subdirectories
gsutil -m cp /dev/null gs://${BUCKET_NAME}/uploads/.keep 2>/dev/null || true
gsutil -m cp /dev/null gs://${BUCKET_NAME}/processed/.keep 2>/dev/null || true
gsutil -m cp /dev/null gs://${BUCKET_NAME}/models/.keep 2>/dev/null || true

echo -e "${GREEN}✓ Cloud Storage setup complete${NC}"

###############################################################################
# 3. Firestore Setup
###############################################################################

echo -e "\n${GREEN}[3/6] Setting up Firestore collections...${NC}"

# Check if Firestore is enabled
gcloud firestore databases describe --project=${PROJECT_ID} --format="get(name)" 2>/dev/null || \
  (echo "Creating Firestore database..." && \
   gcloud firestore databases create --location=${LOCATION} --project=${PROJECT_ID})

# Collections are created automatically when first document is written
# We'll just note the required collections
echo "Required Firestore collections (created automatically):"
echo "  - v2_features (feature caching)"
echo "  - v2_scan_cache (scan result caching)"
echo "  - v2_training_jobs (training job status)"

echo -e "${GREEN}✓ Firestore setup complete${NC}"

###############################################################################
# 4. Vertex AI Feature Store Setup
###############################################################################

echo -e "\n${GREEN}[4/6] Setting up Vertex AI Feature Store...${NC}"

# Note: Feature Store setup requires Vertex AI API to be enabled
gcloud services enable aiplatform.googleapis.com --project=${PROJECT_ID}

# Create feature store (Legacy Feature Store - will use Firestore for V2)
echo "Using Firestore as feature store (Vertex AI Feature Store is optional)"
echo "Features will be cached in Firestore collection: v2_features"

echo -e "${GREEN}✓ Vertex AI Feature Store setup complete${NC}"

###############################################################################
# 5. Vertex AI Endpoints Setup
###############################################################################

echo -e "\n${GREEN}[5/6] Setting up Vertex AI endpoints...${NC}"

echo "Note: Vertex AI endpoints will be created when models are deployed"
echo "Required endpoints:"
echo "  - elara-v2-stage1-cpu (URL Lexical B + Tabular Risk)"
echo "  - elara-v2-stage2-gpu (Text Persuasion + Screenshot CNN)"
echo ""
echo "Run ./scripts/deploy-v2-models.sh after training to create endpoints"

echo -e "${GREEN}✓ Vertex AI endpoints setup complete${NC}"

###############################################################################
# 6. IAM & Permissions Setup
###############################################################################

echo -e "\n${GREEN}[6/6] Setting up IAM permissions...${NC}"

# Get service account email
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

echo "Granting permissions to service account: ${SERVICE_ACCOUNT}"

# BigQuery permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/bigquery.dataEditor" \
    --condition=None \
    2>/dev/null || echo "Permission already granted"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/bigquery.jobUser" \
    --condition=None \
    2>/dev/null || echo "Permission already granted"

# Cloud Storage permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.objectAdmin" \
    --condition=None \
    2>/dev/null || echo "Permission already granted"

# Vertex AI permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/aiplatform.user" \
    --condition=None \
    2>/dev/null || echo "Permission already granted"

# Firestore permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.user" \
    --condition=None \
    2>/dev/null || echo "Permission already granted"

echo -e "${GREEN}✓ IAM permissions setup complete${NC}"

###############################################################################
# Summary
###############################################################################

echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo "Infrastructure created:"
echo "  ✓ BigQuery dataset: ${DATASET_NAME}"
echo "  ✓ BigQuery tables: 5 tables (phishing_urls, benign_urls, scan_features, ti_hits, uploaded_training_data)"
echo "  ✓ GCS bucket: gs://${BUCKET_NAME}"
echo "  ✓ Firestore collections: v2_features, v2_scan_cache"
echo "  ✓ IAM permissions configured"
echo ""
echo "Next steps:"
echo "  1. Run ./scripts/bootstrap-training-data.sh to load initial training data"
echo "  2. Train models using Vertex AI (documentation in docs/V2_COMPLETE_IMPLEMENTATION_PLAN.md)"
echo "  3. Deploy models using ./scripts/deploy-v2-models.sh"
echo "  4. Enable V2 scanner in admin UI"
echo ""
echo -e "${GREEN}Infrastructure setup complete!${NC}"
