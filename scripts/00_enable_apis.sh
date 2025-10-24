#!/bin/bash

# ==============================================================================
# ELARA PLATFORM - ENABLE GCP APIS
# ==============================================================================
# Purpose: Enable all required GCP APIs for Elara infrastructure
# ==============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"

echo "🔧 Enabling GCP APIs for project: $PROJECT_ID"

# Set the project
gcloud config set project $PROJECT_ID

# List of required APIs
APIS=(
  "compute.googleapis.com"                    # Compute Engine
  "container.googleapis.com"                  # Google Kubernetes Engine
  "sqladmin.googleapis.com"                   # Cloud SQL
  "redis.googleapis.com"                      # Memorystore Redis
  "storage.googleapis.com"                    # Cloud Storage
  "secretmanager.googleapis.com"              # Secret Manager
  "cloudkms.googleapis.com"                   # Cloud KMS
  "servicenetworking.googleapis.com"          # VPC Service Networking
  "cloudresourcemanager.googleapis.com"       # Cloud Resource Manager
  "iam.googleapis.com"                        # IAM
  "iamcredentials.googleapis.com"             # IAM Service Account Credentials
  "logging.googleapis.com"                    # Cloud Logging
  "monitoring.googleapis.com"                 # Cloud Monitoring
  "cloudbuild.googleapis.com"                 # Cloud Build
  "artifactregistry.googleapis.com"           # Artifact Registry
  "dns.googleapis.com"                        # Cloud DNS
  "cloudtrace.googleapis.com"                 # Cloud Trace
  "cloudprofiler.googleapis.com"              # Cloud Profiler
  "binaryauthorization.googleapis.com"        # Binary Authorization
  "containerscanning.googleapis.com"          # Container Scanning
)

# Enable all APIs
for api in "${APIS[@]}"; do
  echo "  Enabling $api..."
  gcloud services enable $api --quiet
done

echo "✅ All GCP APIs enabled successfully!"
