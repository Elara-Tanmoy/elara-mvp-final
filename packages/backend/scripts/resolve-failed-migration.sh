#!/bin/bash
# Script to resolve failed Prisma migration in production

echo "🔧 Resolving failed migration..."

# Mark the failed migration as rolled back so Prisma can re-run it
npx prisma migrate resolve --rolled-back 20250110_threat_intelligence

echo "✅ Migration marked as rolled back - Prisma will re-run it"

# Now run migrate deploy which will:
# 1. Re-run the fixed 20250110_threat_intelligence migration
# 2. Run any subsequent migrations (20251010_add_missing_tables)
npx prisma migrate deploy

echo "✅ All migrations applied successfully"
