#!/bin/bash
# ==============================================================================
# ELARA PLATFORM - ADD SECRETS TO GCP SECRET MANAGER
# ==============================================================================
# Interactive script to add secret values to GCP Secret Manager
# Prompts for each secret value and stores it securely
# ==============================================================================

set -e

PROJECT_ID="${GCP_PROJECT_ID:-elara-mvp-13082025-u1}"

echo "========================================"
echo "Elara Platform - Add Secret Values"
echo "Project: $PROJECT_ID"
echo "========================================"
echo ""

# Function to add or update secret value
add_secret_value() {
    local secret_name=$1
    local secret_description=$2
    local is_multiline=${3:-false}

    echo ""
    echo "----------------------------------------"
    echo "Secret: $secret_name"
    echo "Description: $secret_description"
    echo "----------------------------------------"

    # Check if secret exists
    if ! gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
        echo "⚠ Secret $secret_name doesn't exist. Run setup-secrets.sh first."
        return
    fi

    # Prompt for secret value
    if [ "$is_multiline" = true ]; then
        echo "Enter value (press Ctrl+D when done):"
        secret_value=$(cat)
    else
        read -s -p "Enter value (hidden): " secret_value
        echo ""
    fi

    # Validate input
    if [ -z "$secret_value" ]; then
        echo "⚠ Empty value, skipping..."
        return
    fi

    # Add secret version
    echo -n "$secret_value" | gcloud secrets versions add $secret_name \
        --data-file=- \
        --project=$PROJECT_ID

    echo "✓ Added secret version for: $secret_name"
}

# ==============================================================================
# DATABASE SECRETS
# ==============================================================================

echo ""
echo "=== DATABASE SECRETS ==="
echo ""

add_secret_value "database-url-prod" \
    "PostgreSQL URL: postgresql://user:pass@host:5432/elara_production"

add_secret_value "database-url-dev" \
    "PostgreSQL URL: postgresql://user:pass@host:5432/elara_dev"

add_secret_value "database-password" \
    "PostgreSQL password"

# ==============================================================================
# REDIS SECRETS
# ==============================================================================

echo ""
echo "=== REDIS SECRETS ==="
echo ""

add_secret_value "redis-url" \
    "Redis URL: redis://10.190.0.4:6379"

# ==============================================================================
# JWT SECRETS
# ==============================================================================

echo ""
echo "=== JWT SECRETS ==="
echo ""

echo "💡 Tip: Generate strong secrets with: openssl rand -hex 32"
echo ""

add_secret_value "jwt-secret" \
    "JWT signing secret (generate with: openssl rand -hex 32)"

add_secret_value "jwt-refresh-secret" \
    "JWT refresh token secret (generate with: openssl rand -hex 32)"

# ==============================================================================
# AI API KEYS
# ==============================================================================

echo ""
echo "=== AI API KEYS ==="
echo ""

add_secret_value "anthropic-api-key" \
    "Claude API key from https://console.anthropic.com/ (starts with sk-ant-)"

add_secret_value "openai-api-key" \
    "GPT-4 API key from https://platform.openai.com/ (starts with sk-proj-)"

add_secret_value "gemini-api-key" \
    "Gemini API key from https://makersuite.google.com/"

# ==============================================================================
# OAUTH SECRETS
# ==============================================================================

echo ""
echo "=== OAUTH SECRETS ==="
echo ""

add_secret_value "oauth-google-client-id" \
    "Google OAuth Client ID from https://console.cloud.google.com/"

add_secret_value "oauth-google-client-secret" \
    "Google OAuth Client Secret"

add_secret_value "oauth-facebook-client-id" \
    "Facebook OAuth App ID from https://developers.facebook.com/"

add_secret_value "oauth-facebook-client-secret" \
    "Facebook OAuth App Secret"

add_secret_value "oauth-linkedin-client-id" \
    "LinkedIn OAuth Client ID from https://www.linkedin.com/developers/"

add_secret_value "oauth-linkedin-client-secret" \
    "LinkedIn OAuth Client Secret"

# ==============================================================================
# EXTERNAL API KEYS
# ==============================================================================

echo ""
echo "=== EXTERNAL API KEYS ==="
echo ""

add_secret_value "virustotal-api-key" \
    "VirusTotal API key from https://www.virustotal.com/"

add_secret_value "google-safe-browsing-api-key" \
    "Google Safe Browsing API key"

add_secret_value "urlscan-api-key" \
    "URLScan.io API key from https://urlscan.io/"

add_secret_value "abuseipdb-api-key" \
    "AbuseIPDB API key from https://www.abuseipdb.com/"

# ==============================================================================
# WHATSAPP/TWILIO SECRETS
# ==============================================================================

echo ""
echo "=== WHATSAPP/TWILIO SECRETS ==="
echo ""

add_secret_value "twilio-account-sid" \
    "Twilio Account SID (starts with AC) from https://www.twilio.com/"

add_secret_value "twilio-auth-token" \
    "Twilio Auth Token"

add_secret_value "whatsapp-phone-number-id" \
    "WhatsApp Phone Number ID"

add_secret_value "whatsapp-business-account-id" \
    "WhatsApp Business Account ID"

add_secret_value "whatsapp-verify-token" \
    "WhatsApp Webhook Verify Token (generate random string)"

# ==============================================================================
# BLOCKCHAIN SECRETS
# ==============================================================================

echo ""
echo "=== BLOCKCHAIN SECRETS (Optional) ==="
echo ""

read -p "Do you want to add blockchain secrets? (y/N): " add_blockchain
if [ "$add_blockchain" = "y" ] || [ "$add_blockchain" = "Y" ]; then
    add_secret_value "ethereum-private-key" \
        "Ethereum wallet private key (NEVER share this!)"

    add_secret_value "infura-project-id" \
        "Infura Project ID from https://infura.io/"

    add_secret_value "alchemy-api-key" \
        "Alchemy API key from https://www.alchemy.com/"
fi

# ==============================================================================
# ENCRYPTION KEYS
# ==============================================================================

echo ""
echo "=== ENCRYPTION KEYS ==="
echo ""

echo "💡 Tip: Generate encryption key with: openssl rand -hex 32"
echo ""

add_secret_value "encryption-key" \
    "Application encryption key (AES-256, 32 bytes hex)"

add_secret_value "api-secret-salt" \
    "Salt for API secret hashing"

# ==============================================================================
# SUMMARY
# ==============================================================================

echo ""
echo "========================================"
echo "✓ Secret values added successfully!"
echo "========================================"
echo ""
echo "Verify secrets:"
echo "  gcloud secrets list --project=$PROJECT_ID"
echo ""
echo "View secret value:"
echo "  gcloud secrets versions access latest --secret=SECRET_NAME --project=$PROJECT_ID"
echo ""
echo "Test from application:"
echo "  The backend will automatically fetch secrets using Workload Identity"
echo ""
