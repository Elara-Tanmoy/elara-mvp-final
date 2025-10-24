#!/bin/bash

# ==============================================================================
# ELARA PLATFORM - DEPLOY INFRASTRUCTURE WITH TERRAFORM
# ==============================================================================
# Purpose: Deploy all GCP infrastructure using Terraform
# ==============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"
TFVARS_FILE="$TERRAFORM_DIR/environments/production/terraform.tfvars"

echo "🏗️  Deploying Elara infrastructure with Terraform"

# Navigate to Terraform directory
cd "$TERRAFORM_DIR"

# Initialize Terraform
echo ""
echo "1️⃣  Initializing Terraform..."
terraform init

# Validate configuration
echo ""
echo "2️⃣  Validating Terraform configuration..."
terraform validate

# Create execution plan
echo ""
echo "3️⃣  Creating Terraform plan..."
terraform plan -var-file="$TFVARS_FILE" -out=tfplan

# Apply the plan
echo ""
echo "4️⃣  Applying Terraform plan..."
echo "   This will create:"
echo "   • VPC network with subnets and firewall rules"
echo "   • Cloud SQL PostgreSQL (Regional HA)"
echo "   • Memorystore Redis (HA)"
echo "   • Cloud Storage buckets"
echo "   • GKE Autopilot cluster"
echo "   • Global Load Balancer with Cloud Armor"
echo "   • KMS encryption keys"
echo "   • IAM service accounts"
echo "   • Monitoring and logging infrastructure"
echo ""
read -p "   Continue with deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

terraform apply tfplan

# Output important information
echo ""
echo "5️⃣  Deployment complete! Fetching outputs..."
terraform output > terraform-outputs.txt

echo ""
echo "✅ Infrastructure deployed successfully!"
echo ""
echo "📋 Important outputs saved to: terraform-outputs.txt"
echo ""
echo "Next steps:"
echo "  1. Connect to GKE cluster:"
echo "     gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1 --project=$PROJECT_ID"
echo ""
echo "  2. Create Kubernetes secrets:"
echo "     ./scripts/03_create_k8s_secrets.sh"
echo ""
echo "  3. Deploy applications:"
echo "     ./scripts/04_deploy_applications.sh"
