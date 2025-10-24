#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Apply Enterprise Tables and Seed Data to Cloud SQL
# ═══════════════════════════════════════════════════════════════════════════

set -e

PROJECT_ID="elara-mvp-13082025-u1"
INSTANCE_NAME="elara-postgres-primary"
DATABASE_NAME="elara"

echo "🗄️  Applying Enterprise Tables and Seed Data..."
echo "================================================"
echo ""

# Get a running backend pod
echo "📦 Finding running backend pod..."
POD=$(kubectl get pods -n elara-proxy-dev -l app=elara-backend-api --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$POD" ]; then
    echo "❌ No running backend pods found. Please wait for deployment to complete."
    echo ""
    echo "You can check deployment status with:"
    echo "  kubectl get pods -n elara-proxy-dev"
    echo ""
    exit 1
fi

echo "✅ Found pod: $POD"
echo ""

# Copy SQL files to the pod
echo "📤 Copying SQL files to pod..."
kubectl cp ./create_enterprise_tables.sql elara-proxy-dev/$POD:/tmp/create_enterprise_tables.sql
kubectl cp ./seed_ai_consensus.sql elara-proxy-dev/$POD:/tmp/seed_ai_consensus.sql

echo "✅ Files copied"
echo ""

# Execute SQL files
echo "🔧 Applying enterprise tables..."
kubectl exec -n elara-proxy-dev $POD -- bash -c "PGPASSWORD=\$DATABASE_PASSWORD psql -h \$DATABASE_HOST -U \$DATABASE_USER -d $DATABASE_NAME -f /tmp/create_enterprise_tables.sql"

echo "✅ Enterprise tables created"
echo ""

echo "🌱 Seeding AI models and consensus configurations..."
kubectl exec -n elara-proxy-dev $POD -- bash -c "PGPASSWORD=\$DATABASE_PASSWORD psql -h \$DATABASE_HOST -U \$DATABASE_USER -d $DATABASE_NAME -f /tmp/seed_ai_consensus.sql"

echo "✅ Seed data applied"
echo ""

# Cleanup
echo "🧹 Cleaning up temporary files..."
kubectl exec -n elara-proxy-dev $POD -- rm -f /tmp/create_enterprise_tables.sql /tmp/seed_ai_consensus.sql

echo "✅ Cleanup complete"
echo ""
echo "================================================"
echo "✨ Database changes applied successfully!"
echo ""
echo "AI Models added:"
echo "  • Claude Sonnet 4.5 (rank 1, primary)"
echo "  • GPT-4o (rank 2, fallback)"
echo "  • Gemini 1.5 Flash (rank 3, tie-breaker)"
echo ""
echo "Consensus Configurations:"
echo "  • Balanced Consensus (active, 3-model weighted voting)"
echo "  • Fast Consensus (2-model, speed optimized)"
echo "  • Strict Consensus (unanimous, high confidence)"
echo "  • Performance Optimized (single model, fastest)"
echo ""
echo "Next steps:"
echo "  1. Test endpoints: GET /api/v2/admin/ai-models"
echo "  2. Test endpoints: GET /api/v2/admin/consensus-configs"
echo "  3. Run calibration scan to verify AI consensus integration"
echo ""
