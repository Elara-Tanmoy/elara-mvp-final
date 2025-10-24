#!/bin/bash
# ==============================================================================
# Elara Platform - Cloud Build Triggers Setup
# ==============================================================================
# This script sets up Cloud Build triggers for automatic deployment
# Run this after connecting GitHub to Cloud Build in GCP Console
# ==============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"
REGION="us-west1"
REPO_OWNER="tanmayb2612"  # Change to your GitHub username
REPO_NAME="Elara_MVP"      # Change to your repository name

echo "=================================================="
echo "Elara Platform - Setting up Cloud Build Triggers"
echo "=================================================="
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "GitHub: $REPO_OWNER/$REPO_NAME"
echo ""

# Set project
gcloud config set project $PROJECT_ID

echo "Step 1: Checking if GitHub is connected to Cloud Build..."
echo "If not connected, please visit:"
echo "https://console.cloud.google.com/cloud-build/triggers/connect?project=$PROJECT_ID"
echo ""
read -p "Press Enter once GitHub is connected..."

echo ""
echo "Step 2: Creating Development environment trigger..."
gcloud builds triggers create github \
  --region=$REGION \
  --name="elara-dev-auto-deploy" \
  --repo-name=$REPO_NAME \
  --repo-owner=$REPO_OWNER \
  --branch-pattern="^develop$" \
  --build-config=cloudbuild-dev.yaml \
  --project=$PROJECT_ID \
  --description="Auto-deploy to development environment on push to develop branch" \
  2>&1 || echo "✓ Dev trigger may already exist"

echo ""
echo "Step 3: Creating Staging environment trigger..."
gcloud builds triggers create github \
  --region=$REGION \
  --name="elara-staging-auto-deploy" \
  --repo-name=$REPO_NAME \
  --repo-owner=$REPO_OWNER \
  --branch-pattern="^staging$" \
  --build-config=cloudbuild-staging.yaml \
  --project=$PROJECT_ID \
  --description="Auto-deploy to staging environment on push to staging branch" \
  2>&1 || echo "✓ Staging trigger may already exist"

echo ""
echo "Step 4: Creating Production environment trigger..."
gcloud builds triggers create github \
  --region=$REGION \
  --name="elara-prod-auto-deploy" \
  --repo-name=$REPO_NAME \
  --repo-owner=$REPO_OWNER \
  --branch-pattern="^main$" \
  --build-config=cloudbuild-prod.yaml \
  --project=$PROJECT_ID \
  --description="Auto-deploy to production environment on push to main branch" \
  2>&1 || echo "✓ Production trigger may already exist"

echo ""
echo "Step 5: Listing all triggers..."
gcloud builds triggers list --region=$REGION --project=$PROJECT_ID

echo ""
echo "=================================================="
echo "✅ Cloud Build Triggers Setup Complete!"
echo "=================================================="
echo ""
echo "Deployment workflow:"
echo "  • Push to 'develop' branch → Deploys to DEV environment"
echo "  • Push to 'staging' branch → Deploys to STAGING environment"
echo "  • Push to 'main' branch → Deploys to PRODUCTION environment"
echo ""
echo "You can also trigger builds manually from:"
echo "https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo ""
