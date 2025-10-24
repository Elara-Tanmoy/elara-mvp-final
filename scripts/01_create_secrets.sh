#!/bin/bash

# ==============================================================================
# ELARA PLATFORM - CREATE SECRETS IN SECRET MANAGER
# ==============================================================================
# Purpose: Upload all secrets from .env.secrets to GCP Secret Manager
# ==============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"
ENV_FILE="$(dirname "$0")/../.env.secrets"

echo "🔐 Creating secrets in Secret Manager for project: $PROJECT_ID"

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found!"
  exit 1
fi

# Function to create or update secret
create_secret() {
  local secret_name=$1
  local secret_value=$2

  # Check if secret exists
  if gcloud secrets describe $secret_name --project=$PROJECT_ID &> /dev/null; then
    echo "  ↻ Updating existing secret: $secret_name"
    echo -n "$secret_value" | gcloud secrets versions add $secret_name \
      --data-file=- \
      --project=$PROJECT_ID
  else
    echo "  ✓ Creating new secret: $secret_name"
    echo -n "$secret_value" | gcloud secrets create $secret_name \
      --data-file=- \
      --replication-policy="automatic" \
      --project=$PROJECT_ID
  fi
}

# Read .env.secrets and create secrets
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue

  # Remove quotes from value
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')

  # Convert env var name to secret name (lowercase, replace _ with -)
  secret_name=$(echo "production-backend-${key,,}" | tr '_' '-')

  # Create secret
  create_secret "$secret_name" "$value"

done < <(grep -v '^#' $ENV_FILE | grep -v '^$')

echo ""
echo "✅ All secrets created successfully!"
echo ""
echo "📋 To list all secrets:"
echo "  gcloud secrets list --project=$PROJECT_ID"
