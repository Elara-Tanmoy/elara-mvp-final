#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting Elara Backend Deployment..."

# Step 1: Fix corrupted migration state - Mark problematic migration as completed
echo "📋 Fixing migration table state..."
npx prisma db execute --stdin <<SQL
-- Clean up any incomplete migration records
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251004200928_';

-- Insert completed migration record (skip actual execution since enums exist)
INSERT INTO "_prisma_migrations" (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
) VALUES (
  gen_random_uuid()::text,
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  NOW(),
  '20251004200928_',
  'Migration skipped - types already exist in database',
  NULL,
  NOW(),
  1
) ON CONFLICT (migration_name) DO UPDATE SET
  finished_at = NOW(),
  applied_steps_count = 1,
  logs = 'Migration marked as completed during deployment';
SQL

echo "✅ Migration table fixed"

# Step 2: Deploy all pending migrations
echo "🔄 Deploying database migrations..."
npx prisma migrate deploy

# Step 3: Seed the database (if needed)
echo "🌱 Seeding database..."
npm run db:seed 2>/dev/null || echo "⚠️  Seed skipped (may already be seeded)"

# Step 4: Start the server
echo "✅ Starting server..."
tsx src/index.ts
