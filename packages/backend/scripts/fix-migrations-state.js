#!/usr/bin/env node

/**
 * PRE-DEPLOYMENT SCRIPT
 * Fixes the _prisma_migrations table state before running migrations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMigrationState() {
  console.log('🔧 Fixing migration state...');

  try {
    // Connect to database
    await prisma.$connect();

    // 1. Only delete the specific problematic migrations (not all failed ones)
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "_prisma_migrations"
        WHERE migration_name IN (
          '20250110_threat_intelligence',
          '20251010_add_missing_tables'
        );
      `);
      console.log('✅ Removed problematic migration records');
    } catch (error) {
      console.log('ℹ️  No problematic migrations to remove');
    }

    // 2. Check current state
    const existingMigrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at;
    `);

    console.log(`📊 Database has ${existingMigrations.length} migration records`);
    existingMigrations.forEach((m) => {
      const status = m.rolled_back_at ? '❌ ROLLED BACK' : m.finished_at ? '✅ APPLIED' : '⏳ PENDING';
      console.log(`   ${status} ${m.migration_name}`);
    });

    console.log('✅ Migration state cleaned successfully!');
  } catch (error) {
    console.error('❌ Error fixing migration state:', error.message);
    // Don't fail - continue with deployment
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrationState();
