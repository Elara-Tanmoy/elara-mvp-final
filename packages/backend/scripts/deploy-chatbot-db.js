#!/usr/bin/env node

/**
 * Ask Elara Chatbot - Database Deployment Script
 * Automatically sets up the database for the chatbot
 */

import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

async function deployDatabase() {
  log('\n========================================', 'blue');
  log('  Ask Elara Chatbot - Database Setup', 'blue');
  log('========================================\n', 'blue');

  // Check for DATABASE_URL
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    logError('DATABASE_URL environment variable is not set!');
    log('\nPlease set it to your production database URL:');
    log('  export DATABASE_URL="postgresql://user:password@host:port/database"');
    log('\nOr get it from Render.com:');
    log('  1. Go to https://dashboard.render.com');
    log('  2. Click your PostgreSQL database');
    log('  3. Copy the "External Database URL"\n');
    process.exit(1);
  }

  log(`Database URL: ${DATABASE_URL.substring(0, 30)}...`, 'yellow');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to database
    logStep(1, 'Connecting to PostgreSQL database...');
    await client.connect();
    logSuccess('Connected to database');

    // Enable pgvector extension
    logStep(2, 'Enabling pgvector extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      logSuccess('pgvector extension enabled');
    } catch (error) {
      if (error.message.includes('already exists')) {
        logSuccess('pgvector extension already enabled');
      } else {
        throw error;
      }
    }

    // Check if tables already exist
    logStep(3, 'Checking existing tables...');
    const checkTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE 'chatbot%' OR table_name = 'knowledge_base')
      ORDER BY table_name;
    `);

    if (checkTables.rows.length > 0) {
      logWarning('Chatbot tables already exist:');
      checkTables.rows.forEach(row => {
        log(`  - ${row.table_name}`, 'yellow');
      });

      log('\nDo you want to:');
      log('  1. Skip migration (tables already set up)');
      log('  2. Drop and recreate tables (WARNING: deletes all data)');
      log('  3. Exit');

      // For automation, we'll skip if tables exist
      logWarning('Tables already exist - skipping migration');
      logSuccess('Using existing chatbot tables');

    } else {
      // Run migration
      logStep(4, 'Running database migration...');

      // Read migration SQL file
      const migrationPath = join(__dirname, '../../prisma/migrations/20251007_add_chatbot_tables/migration.sql');
      log(`Reading migration file: ${migrationPath}`, 'yellow');

      const migrationSQL = readFileSync(migrationPath, 'utf8');
      log(`Migration file size: ${migrationSQL.length} bytes`, 'yellow');

      // Split SQL into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      log(`Executing ${statements.length} SQL statements...`, 'yellow');

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length > 0) {
          try {
            await client.query(statement);
            process.stdout.write('.');
          } catch (error) {
            // Ignore duplicate errors
            if (!error.message.includes('already exists')) {
              logError(`\nError in statement ${i + 1}: ${error.message}`);
              throw error;
            }
          }
        }
      }

      log('');
      logSuccess('Migration completed successfully');
    }

    // Verify tables
    logStep(5, 'Verifying database setup...');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE 'chatbot%' OR table_name = 'knowledge_base')
      ORDER BY table_name;
    `);

    if (tables.rows.length === 6) {
      logSuccess(`Found all 6 required tables:`);
      tables.rows.forEach(row => {
        log(`  ✓ ${row.table_name}`, 'green');
      });
    } else {
      logWarning(`Found ${tables.rows.length} tables (expected 6)`);
      tables.rows.forEach(row => {
        log(`  - ${row.table_name}`, 'yellow');
      });
    }

    // Check knowledge base entries
    logStep(6, 'Checking knowledge base entries...');
    const knowledgeCount = await client.query('SELECT COUNT(*) FROM knowledge_base;');
    const count = parseInt(knowledgeCount.rows[0].count);

    if (count > 0) {
      logSuccess(`Knowledge base has ${count} entries`);
    } else {
      logWarning('Knowledge base is empty - migration might not have run completely');
    }

    // Check chatbot config
    const configCount = await client.query('SELECT COUNT(*) FROM chatbot_config;');
    const configExists = parseInt(configCount.rows[0].count) > 0;

    if (configExists) {
      logSuccess('Chatbot configuration exists');
    } else {
      logWarning('Chatbot configuration not found');
    }

    // Summary
    log('\n========================================', 'blue');
    log('  Database Setup Complete!', 'green');
    log('========================================\n', 'blue');

    log('Next steps:', 'cyan');
    log('  1. Wait for Render.com to finish rebuilding (~5 minutes)');
    log('  2. Test chatbot at your frontend URL');
    log('  3. Click chatbot button (bottom-right)');
    log('  4. Send message: "What is phishing?"');
    log('  5. Login as admin → Test admin panel\n');

    log('Verify deployment:', 'cyan');
    log(`  Backend Health: https://elara-backend-64tf.onrender.com/api/health`);
    log(`  Chatbot Config: https://elara-backend-64tf.onrender.com/api/v2/chatbot/config`);
    log(`  Knowledge Search: https://elara-backend-64tf.onrender.com/api/v2/chatbot/knowledge/search?q=phishing\n`);

  } catch (error) {
    logError(`\nDeployment failed: ${error.message}`);
    log('\nError details:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    logSuccess('Database connection closed');
  }
}

// Run deployment
deployDatabase().catch(error => {
  logError('Unexpected error:');
  console.error(error);
  process.exit(1);
});
