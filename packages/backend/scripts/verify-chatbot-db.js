#!/usr/bin/env node

/**
 * Ask Elara Chatbot - Database Verification Script
 * Checks if database migration was successful
 */

import pkg from 'pg';
const { Client } = pkg;

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

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

async function verifyDatabase() {
  log('\n========================================', 'blue');
  log('  Chatbot Database Verification', 'blue');
  log('========================================\n', 'blue');

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    logError('DATABASE_URL environment variable is not set!');
    log('\nSet it to your production database URL:');
    log('  export DATABASE_URL="postgresql://user:password@host:port/database"\n');
    process.exit(1);
  }

  logInfo(`Connecting to: ${DATABASE_URL.split('@')[1]}`);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let allChecks = {
    connection: false,
    pgvector: false,
    tables: false,
    knowledge: false,
    config: false
  };

  try {
    // Test connection
    log('\n[1/5] Testing Database Connection...', 'cyan');
    await client.connect();
    logSuccess('Connected to PostgreSQL database');
    allChecks.connection = true;

    // Check pgvector extension
    log('\n[2/5] Checking pgvector Extension...', 'cyan');
    try {
      const extResult = await client.query(`
        SELECT * FROM pg_extension WHERE extname = 'vector';
      `);

      if (extResult.rows.length > 0) {
        logSuccess('pgvector extension is installed');
        allChecks.pgvector = true;
      } else {
        logError('pgvector extension is NOT installed');
        logWarning('Run: CREATE EXTENSION IF NOT EXISTS vector;');
      }
    } catch (error) {
      logError(`Error checking pgvector: ${error.message}`);
    }

    // Check chatbot tables
    log('\n[3/5] Checking Chatbot Tables...', 'cyan');
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE 'chatbot%' OR table_name = 'knowledge_base' OR table_name = 'chat_sessions' OR table_name = 'chat_messages')
      ORDER BY table_name;
    `);

    const expectedTables = [
      'chatbot_analytics',
      'chatbot_config',
      'chatbot_training_data',
      'chat_messages',
      'chat_sessions',
      'knowledge_base'
    ];

    const foundTables = tableResult.rows.map(r => r.table_name);

    if (foundTables.length === 6) {
      logSuccess(`All 6 chatbot tables exist:`);
      expectedTables.forEach(table => {
        if (foundTables.includes(table)) {
          log(`  ✓ ${table}`, 'green');
        } else {
          log(`  ✗ ${table} (MISSING)`, 'red');
        }
      });
      allChecks.tables = true;
    } else {
      logWarning(`Found ${foundTables.length}/6 tables`);
      foundTables.forEach(table => {
        log(`  - ${table}`, 'yellow');
      });

      const missingTables = expectedTables.filter(t => !foundTables.includes(t));
      if (missingTables.length > 0) {
        logError('Missing tables:');
        missingTables.forEach(table => {
          log(`  ✗ ${table}`, 'red');
        });
      }
    }

    // Check table structures
    log('\n[4/5] Checking Table Structures...', 'cyan');

    // Check knowledge_base has embedding column
    if (foundTables.includes('knowledge_base')) {
      const kbColumns = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'knowledge_base'
        ORDER BY ordinal_position;
      `);

      const hasEmbedding = kbColumns.rows.some(c => c.column_name === 'embedding');
      const embeddingCol = kbColumns.rows.find(c => c.column_name === 'embedding');

      if (hasEmbedding) {
        logSuccess(`knowledge_base has embedding column (type: ${embeddingCol.udt_name})`);

        // Check for vector index
        const indexResult = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'knowledge_base'
          AND indexname LIKE '%embedding%';
        `);

        if (indexResult.rows.length > 0) {
          logSuccess(`Vector index exists: ${indexResult.rows[0].indexname}`);
        } else {
          logWarning('No vector index found on embedding column');
        }
      } else {
        logError('knowledge_base missing embedding column!');
      }

      log(`  Total columns: ${kbColumns.rows.length}`);
      kbColumns.rows.forEach(col => {
        log(`    - ${col.column_name} (${col.data_type})`, 'reset');
      });
    }

    // Check knowledge base entries
    log('\n[5/5] Checking Knowledge Base Data...', 'cyan');
    if (foundTables.includes('knowledge_base')) {
      const countResult = await client.query('SELECT COUNT(*) FROM knowledge_base;');
      const count = parseInt(countResult.rows[0].count);

      if (count > 0) {
        logSuccess(`Knowledge base has ${count} entries`);
        allChecks.knowledge = true;

        // Get sample entries
        const sampleResult = await client.query(`
          SELECT id, title, category,
                 CASE WHEN embedding IS NOT NULL THEN 'Yes' ELSE 'No' END as has_embedding,
                 indexed
          FROM knowledge_base
          LIMIT 5;
        `);

        log('\n  Sample entries:');
        sampleResult.rows.forEach((row, idx) => {
          log(`  ${idx + 1}. ${row.title}`, 'reset');
          log(`     Category: ${row.category || 'none'}`, 'reset');
          log(`     Embedding: ${row.has_embedding} | Indexed: ${row.indexed}`, 'reset');
        });

        // Count by category
        const categoryResult = await client.query(`
          SELECT category, COUNT(*) as count
          FROM knowledge_base
          GROUP BY category
          ORDER BY count DESC;
        `);

        if (categoryResult.rows.length > 0) {
          log('\n  Categories:', 'cyan');
          categoryResult.rows.forEach(row => {
            log(`    ${row.category || 'uncategorized'}: ${row.count} entries`, 'reset');
          });
        }
      } else {
        logError('Knowledge base is EMPTY!');
        logWarning('Migration may not have run completely');
      }
    }

    // Check chatbot config
    if (foundTables.includes('chatbot_config')) {
      const configResult = await client.query('SELECT COUNT(*) FROM chatbot_config;');
      const configCount = parseInt(configResult.rows[0].count);

      if (configCount > 0) {
        logSuccess(`Chatbot configuration exists (${configCount} config(s))`);

        const configData = await client.query(`
          SELECT system_prompt, temperature, max_tokens, enable_rag,
                 enable_conversation_memory, enabled
          FROM chatbot_config
          LIMIT 1;
        `);

        if (configData.rows.length > 0) {
          const config = configData.rows[0];
          log('\n  Configuration:', 'cyan');
          log(`    Temperature: ${config.temperature}`, 'reset');
          log(`    Max Tokens: ${config.max_tokens}`, 'reset');
          log(`    RAG Enabled: ${config.enable_rag}`, 'reset');
          log(`    Memory Enabled: ${config.enable_conversation_memory}`, 'reset');
          log(`    System Prompt Length: ${config.system_prompt?.length || 0} chars`, 'reset');
        }

        allChecks.config = true;
      } else {
        logWarning('No chatbot configuration found');
      }
    }

    // Check sessions and messages
    if (foundTables.includes('chat_sessions')) {
      const sessionsResult = await client.query('SELECT COUNT(*) FROM chat_sessions;');
      const sessionCount = parseInt(sessionsResult.rows[0].count);
      log(`\n  Chat Sessions: ${sessionCount}`, 'cyan');
    }

    if (foundTables.includes('chat_messages')) {
      const messagesResult = await client.query('SELECT COUNT(*) FROM chat_messages;');
      const messageCount = parseInt(messagesResult.rows[0].count);
      log(`  Chat Messages: ${messageCount}`, 'cyan');
    }

    // Final summary
    log('\n========================================', 'blue');
    log('  Verification Summary', 'blue');
    log('========================================\n', 'blue');

    const checks = [
      { name: 'Database Connection', status: allChecks.connection },
      { name: 'pgvector Extension', status: allChecks.pgvector },
      { name: 'Chatbot Tables (6)', status: allChecks.tables },
      { name: 'Knowledge Base Data', status: allChecks.knowledge },
      { name: 'Chatbot Configuration', status: allChecks.config }
    ];

    checks.forEach(check => {
      if (check.status) {
        logSuccess(check.name);
      } else {
        logError(check.name);
      }
    });

    const passedChecks = checks.filter(c => c.status).length;
    const totalChecks = checks.length;

    log(`\nPassed: ${passedChecks}/${totalChecks} checks\n`, passedChecks === totalChecks ? 'green' : 'yellow');

    if (passedChecks === totalChecks) {
      log('========================================', 'green');
      log('  ✓ DATABASE FULLY CONFIGURED!', 'green');
      log('========================================\n', 'green');

      log('Next steps:', 'cyan');
      log('1. Wait for Render rebuild to complete');
      log('2. Test chatbot at your frontend URL');
      log('3. Send message: "What is phishing?"');
      log('4. Verify response with sources\n');

    } else {
      log('========================================', 'yellow');
      log('  ⚠ DATABASE SETUP INCOMPLETE', 'yellow');
      log('========================================\n', 'yellow');

      log('To fix:', 'cyan');
      log('1. Run: npm run deploy:chatbot');
      log('2. Check errors in the output');
      log('3. Run this verification again\n');
    }

  } catch (error) {
    logError(`\nVerification failed: ${error.message}`);
    log('\nError details:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    logInfo('Database connection closed\n');
  }
}

// Run verification
verifyDatabase().catch(error => {
  logError('Unexpected error:');
  console.error(error);
  process.exit(1);
});
