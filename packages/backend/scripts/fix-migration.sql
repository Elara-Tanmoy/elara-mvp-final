-- MIGRATION FIX SCRIPT
-- This script resolves the failed 20250110_threat_intelligence migration
-- Run this directly in your production database before redeploying

-- Step 1: Mark the failed migration as rolled back
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250110_threat_intelligence';

-- Step 2: Drop any partially created threat intelligence tables
DROP TABLE IF EXISTS "threat_feed_syncs" CASCADE;
DROP TABLE IF EXISTS "threat_indicators" CASCADE;
DROP TABLE IF EXISTS "threat_intel_sources" CASCADE;

-- Step 3: Create tables with CORRECT Prisma naming (camelCase columns)
CREATE TABLE IF NOT EXISTS "threat_intel_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "totalIndicators" INTEGER NOT NULL DEFAULT 0,
    "syncFrequency" INTEGER NOT NULL DEFAULT 3600,
    "apiKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "threat_indicators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "threatType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threat_indicators_sourceId_fkey" FOREIGN KEY ("sourceId")
        REFERENCES "threat_intel_sources"("id") ON DELETE CASCADE,

    CONSTRAINT "threat_indicators_type_value_sourceId_key"
        UNIQUE ("type", "value", "sourceId")
);

CREATE TABLE IF NOT EXISTS "threat_feed_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "indicatorsAdded" INTEGER NOT NULL DEFAULT 0,
    "indicatorsUpdated" INTEGER NOT NULL DEFAULT 0,
    "indicatorsRemoved" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "threat_feed_syncs_sourceId_fkey" FOREIGN KEY ("sourceId")
        REFERENCES "threat_intel_sources"("id") ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "threat_intel_sources_name_idx" ON "threat_intel_sources"("name");
CREATE INDEX IF NOT EXISTS "threat_intel_sources_enabled_idx" ON "threat_intel_sources"("enabled");
CREATE INDEX IF NOT EXISTS "threat_intel_sources_type_idx" ON "threat_intel_sources"("type");

CREATE INDEX IF NOT EXISTS "threat_indicators_type_idx" ON "threat_indicators"("type");
CREATE INDEX IF NOT EXISTS "threat_indicators_value_idx" ON "threat_indicators"("value");
CREATE INDEX IF NOT EXISTS "threat_indicators_threatType_idx" ON "threat_indicators"("threatType");
CREATE INDEX IF NOT EXISTS "threat_indicators_severity_idx" ON "threat_indicators"("severity");
CREATE INDEX IF NOT EXISTS "threat_indicators_active_idx" ON "threat_indicators"("active");
CREATE INDEX IF NOT EXISTS "threat_indicators_firstSeen_idx" ON "threat_indicators"("firstSeen");
CREATE INDEX IF NOT EXISTS "threat_indicators_expiresAt_idx" ON "threat_indicators"("expiresAt");
CREATE INDEX IF NOT EXISTS "threat_indicators_sourceId_idx" ON "threat_indicators"("sourceId");

CREATE INDEX IF NOT EXISTS "threat_feed_syncs_sourceId_idx" ON "threat_feed_syncs"("sourceId");
CREATE INDEX IF NOT EXISTS "threat_feed_syncs_status_idx" ON "threat_feed_syncs"("status");
CREATE INDEX IF NOT EXISTS "threat_feed_syncs_startedAt_idx" ON "threat_feed_syncs"("startedAt");

-- Seed sources
INSERT INTO "threat_intel_sources" ("id", "name", "type", "url", "enabled", "syncFrequency", "metadata", "createdAt", "updatedAt")
VALUES
    ('phishtank', 'PhishTank', 'phishing', 'http://data.phishtank.com/data/online-valid.json', true, 3600, '{"format": "json"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('urlhaus', 'URLhaus', 'malware', 'https://urlhaus.abuse.ch/downloads/csv_recent/', true, 3600, '{"format": "csv"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('openphish', 'OpenPhish', 'phishing', 'https://openphish.com/feed.txt', true, 3600, '{"format": "txt"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('malware_bazaar', 'MalwareBazaar', 'malware', 'https://bazaar.abuse.ch/export/csv/recent/', true, 7200, '{"format": "csv"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('threatfox', 'ThreatFox', 'c2', 'https://threatfox.abuse.ch/export/json/recent/', true, 3600, '{"format": "json"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- Mark migration as applied
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    '0',
    NOW(),
    '20250110_threat_intelligence',
    NULL,
    NULL,
    NOW(),
    1
);
