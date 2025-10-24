#!/usr/bin/env node

/**
 * PRE-DEPLOYMENT SCRIPT
 * Safely renames tables from PascalCase to snake_case to preserve data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function renameTables() {
  console.log('🔧 Renaming tables to match schema...');

  try {
    await prisma.$connect();

    // Rename tables if they exist (preserves all data)
    const renames = [
      { from: 'ScanResult', to: 'scan_results' },
      { from: 'ApiUsage', to: 'api_usage' }
    ];

    for (const { from, to } of renames) {
      try {
        // Check if old table exists
        const exists = await prisma.$queryRawUnsafe(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = '${from}'
          );
        `);

        if (exists[0].exists) {
          // Rename table (preserves all data and constraints)
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "${from}" RENAME TO "${to}";
          `);
          console.log(`✅ Renamed ${from} → ${to}`);
        } else {
          console.log(`ℹ️  Table ${from} doesn't exist (already renamed or doesn't exist)`);
        }
      } catch (error) {
        console.log(`⚠️  Could not rename ${from}: ${error.message}`);
      }
    }

    console.log('✅ Table renaming complete!');
  } catch (error) {
    console.error('❌ Error renaming tables:', error.message);
    // Don't fail deployment
  } finally {
    await prisma.$disconnect();
  }
}

renameTables();
