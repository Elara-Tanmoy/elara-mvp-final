#!/bin/bash

# ==============================================================================
# ELARA PLATFORM - DEPLOY APPLICATIONS TO GKE
# ==============================================================================
# Purpose: Deploy all Elara applications using Kustomize
# ==============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"
K8S_DIR="../kubernetes"

echo "🚀 Deploying Elara applications to GKE"

# Connect to GKE cluster
echo "1️⃣  Connecting to GKE cluster..."
gcloud container clusters get-credentials elara-gke-us-west1 \
  --region=us-west1 \
  --project=$PROJECT_ID

# Deploy using Kustomize
echo ""
echo "2️⃣  Deploying applications with Kustomize..."
kubectl apply -k $K8S_DIR/overlays/production

# Wait for deployments to be ready
echo ""
echo "3️⃣  Waiting for deployments to be ready..."

echo "  → Backend API..."
kubectl rollout status deployment/elara-api -n elara-backend --timeout=5m

echo "  → Workers..."
kubectl rollout status deployment/elara-worker -n elara-workers --timeout=5m

echo "  → Proxy..."
kubectl rollout status deployment/elara-proxy -n elara-proxy --timeout=5m

echo "  → ChromaDB..."
kubectl rollout status statefulset/chromadb -n elara-backend --timeout=5m

# Run database migrations
echo ""
echo "4️⃣  Running database migrations..."
POD=$(kubectl get pods -n elara-backend -l app=elara-api -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n elara-backend $POD -- pnpm --filter @elara/backend prisma migrate deploy

# Verify deployment
echo ""
echo "5️⃣  Verifying deployment..."

echo ""
echo "📦 Pods in elara-backend namespace:"
kubectl get pods -n elara-backend

echo ""
echo "📦 Pods in elara-workers namespace:"
kubectl get pods -n elara-workers

echo ""
echo "📦 Pods in elara-proxy namespace:"
kubectl get pods -n elara-proxy

# Get load balancer IP
echo ""
echo "6️⃣  Getting load balancer information..."
LB_IP=$(kubectl get ingress elara-ingress -n elara-backend -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Load Balancer IP: $LB_IP"
echo ""
echo "🌐 Configure DNS records:"
echo "  A record: elara.com → $LB_IP"
echo "  A record: api.elara.com → $LB_IP"
echo "  A record: www.elara.com → $LB_IP"
echo ""
echo "📊 Monitor deployment:"
echo "  kubectl get pods -A --watch"
echo ""
echo "🔍 View logs:"
echo "  kubectl logs -n elara-backend -l app=elara-api --tail=100 -f"
