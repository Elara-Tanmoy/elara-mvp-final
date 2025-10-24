#!/bin/bash
# ==============================================================================
# ELARA PLATFORM - GCP SECRET MANAGER SETUP
# ==============================================================================
# This script creates all required secrets in GCP Secret Manager
# Run once during initial setup or when adding new secrets
# ==============================================================================

set -e

PROJECT_ID="${GCP_PROJECT_ID:-elara-mvp-13082025-u1}"
REGION="us-west1"

echo "========================================"
echo "Elara Platform - Secret Manager Setup"
echo "Project: $PROJECT_ID"
echo "========================================"
echo ""

# Enable Secret Manager API
echo "1. Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_description=$2

    echo "Creating secret: $secret_name"

    # Check if secret exists
    if gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
        echo "  ✓ Secret $secret_name already exists"
    else
        gcloud secrets create $secret_name \
            --project=$PROJECT_ID \
            --replication-policy="automatic" \
            --labels="environment=production,managed-by=script" \
            --annotations="description=$secret_description"
        echo "  ✓ Created secret: $secret_name"
    fi
}

echo ""
echo "2. Creating secrets (you'll be prompted to enter values)..."
echo ""

# Database Secrets
echo "=== DATABASE SECRETS ==="
create_or_update_secret "database-url-prod" "PostgreSQL connection string for production"
create_or_update_secret "database-url-dev" "PostgreSQL connection string for development"
create_or_update_secret "database-url-staging" "PostgreSQL connection string for staging"
create_or_update_secret "database-password" "PostgreSQL password"

# Redis Secrets
echo ""
echo "=== REDIS SECRETS ==="
create_or_update_secret "redis-url" "Redis connection string"
create_or_update_secret "redis-password" "Redis password (if using AUTH)"

# JWT Secrets
echo ""
echo "=== JWT SECRETS ==="
create_or_update_secret "jwt-secret" "JWT signing secret"
create_or_update_secret "jwt-refresh-secret" "JWT refresh token secret"

# AI API Keys
echo ""
echo "=== AI API KEYS ==="
create_or_update_secret "anthropic-api-key" "Claude API key from Anthropic"
create_or_update_secret "openai-api-key" "GPT-4 API key from OpenAI"
create_or_update_secret "gemini-api-key" "Gemini API key from Google"

# OAuth Secrets
echo ""
echo "=== OAUTH SECRETS ==="
create_or_update_secret "oauth-google-client-id" "Google OAuth 2.0 Client ID"
create_or_update_secret "oauth-google-client-secret" "Google OAuth 2.0 Client Secret"
create_or_update_secret "oauth-facebook-client-id" "Facebook OAuth Client ID"
create_or_update_secret "oauth-facebook-client-secret" "Facebook OAuth Client Secret"
create_or_update_secret "oauth-linkedin-client-id" "LinkedIn OAuth Client ID"
create_or_update_secret "oauth-linkedin-client-secret" "LinkedIn OAuth Client Secret"

# External API Keys
echo ""
echo "=== EXTERNAL API KEYS ==="
create_or_update_secret "virustotal-api-key" "VirusTotal API key"
create_or_update_secret "google-safe-browsing-api-key" "Google Safe Browsing API key"
create_or_update_secret "urlscan-api-key" "URLScan.io API key"
create_or_update_secret "abuseipdb-api-key" "AbuseIPDB API key"

# WhatsApp/Twilio Secrets
echo ""
echo "=== WHATSAPP/TWILIO SECRETS ==="
create_or_update_secret "twilio-account-sid" "Twilio Account SID"
create_or_update_secret "twilio-auth-token" "Twilio Auth Token"
create_or_update_secret "whatsapp-phone-number-id" "WhatsApp Phone Number ID"
create_or_update_secret "whatsapp-business-account-id" "WhatsApp Business Account ID"
create_or_update_secret "whatsapp-verify-token" "WhatsApp Webhook Verify Token"

# Blockchain Secrets
echo ""
echo "=== BLOCKCHAIN SECRETS ==="
create_or_update_secret "ethereum-private-key" "Ethereum wallet private key"
create_or_update_secret "infura-project-id" "Infura Project ID"
create_or_update_secret "alchemy-api-key" "Alchemy API key"

# Encryption Keys
echo ""
echo "=== ENCRYPTION KEYS ==="
create_or_update_secret "encryption-key" "Application encryption key (AES-256)"
create_or_update_secret "api-secret-salt" "Salt for API secret hashing"

echo ""
echo "========================================"
echo "3. Granting access to service accounts..."
echo "========================================"
echo ""

# Grant access to backend service account
BACKEND_SA="elara-api@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Granting access to: $BACKEND_SA"

gcloud secrets add-iam-policy-binding database-url-prod \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding database-url-dev \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding redis-url \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding jwt-secret \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding anthropic-api-key \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding openai-api-key \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding gemini-api-key \
    --member="serviceAccount:$BACKEND_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

# Grant access to all OAuth secrets
for secret in oauth-google-client-secret oauth-facebook-client-secret oauth-linkedin-client-secret; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$BACKEND_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID
done

# Grant access to external API keys
for secret in virustotal-api-key google-safe-browsing-api-key urlscan-api-key abuseipdb-api-key; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$BACKEND_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID
done

# Grant access to worker service account
WORKER_SA="elara-worker@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "Granting access to: $WORKER_SA"

for secret in database-url-prod redis-url anthropic-api-key openai-api-key gemini-api-key twilio-auth-token; do
    gcloud secrets add-iam-policy-binding $secret \
        --member="serviceAccount:$WORKER_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID
done

echo ""
echo "========================================"
echo "✓ Secret Manager setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Add secret values using:"
echo "   echo -n 'YOUR_SECRET_VALUE' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
echo "2. Verify secrets:"
echo "   gcloud secrets list --project=$PROJECT_ID"
echo ""
echo "3. Test access from backend:"
echo "   gcloud secrets versions access latest --secret=jwt-secret"
echo ""
