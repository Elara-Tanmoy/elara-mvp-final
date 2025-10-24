#!/bin/bash

# ==============================================================================
# ELARA PLATFORM - CREATE KUBERNETES SECRETS
# ==============================================================================
# Purpose: Create K8s secrets from GCP Secret Manager
# ==============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"
NAMESPACE="elara-backend"

echo "🔐 Creating Kubernetes secrets from Secret Manager"

# Connect to GKE cluster
echo "Connecting to GKE cluster..."
gcloud container clusters get-credentials elara-gke-us-west1 \
  --region=us-west1 \
  --project=$PROJECT_ID

# Function to get secret from Secret Manager
get_secret() {
  local secret_name=$1
  gcloud secrets versions access latest \
    --secret=$secret_name \
    --project=$PROJECT_ID
}

# Create K8s secret with all values
echo "Creating elara-secrets in namespace: $NAMESPACE"

kubectl create secret generic elara-secrets \
  --namespace=$NAMESPACE \
  --from-literal=database-url="$(get_secret production-backend-database-url)" \
  --from-literal=db-host="$(get_secret production-backend-db-host)" \
  --from-literal=redis-url="$(get_secret production-backend-redis-url)" \
  --from-literal=redis-host="$(get_secret production-backend-redis-host)" \
  --from-literal=jwt-secret="$(get_secret production-backend-jwt-secret)" \
  --from-literal=anthropic-api-key="$(get_secret production-backend-anthropic-api-key)" \
  --from-literal=openai-api-key="$(get_secret production-backend-openai-api-key)" \
  --from-literal=google-ai-api-key="$(get_secret production-backend-google-ai-api-key)" \
  --from-literal=huggingface-api-key="$(get_secret production-backend-huggingface-api-key)" \
  --from-literal=grok-api-key="$(get_secret production-backend-grok-api-key)" \
  --from-literal=virustotal-api-key="$(get_secret production-backend-virustotal-api-key)" \
  --from-literal=google-safe-browsing-api-key="$(get_secret production-backend-google-safe-browsing-api-key)" \
  --from-literal=abuseipdb-api-key="$(get_secret production-backend-abuseipdb-api-key)" \
  --from-literal=abstract-api-key="$(get_secret production-backend-abstract-api-key)" \
  --from-literal=twilio-account-sid="$(get_secret production-backend-twilio-account-sid)" \
  --from-literal=twilio-auth-token="$(get_secret production-backend-twilio-auth-token)" \
  --from-literal=twilio-whatsapp-number="$(get_secret production-backend-twilio-whatsapp-number)" \
  --from-literal=whatsapp-encryption-key="$(get_secret production-backend-whatsapp-encryption-key)" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create secret in other namespaces
for ns in "elara-workers" "elara-proxy"; do
  echo "Creating elara-secrets in namespace: $ns"
  kubectl create secret generic elara-secrets \
    --namespace=$ns \
    --from-literal=database-url="$(get_secret production-backend-database-url)" \
    --from-literal=redis-url="$(get_secret production-backend-redis-url)" \
    --dry-run=client -o yaml | kubectl apply -f -
done

echo ""
echo "✅ Kubernetes secrets created successfully!"
echo ""
echo "📋 To verify:"
echo "  kubectl get secrets -n $NAMESPACE"
