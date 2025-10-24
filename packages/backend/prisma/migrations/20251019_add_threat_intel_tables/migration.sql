-- Migration: Enhanced Threat Intelligence System
-- Date: 2025-10-19
-- Description: Add deduplication, source mappings, and sync tracking

-- =====================================================
-- 1. Add columns to existing ThreatIndicator table
-- =====================================================

-- Add deduplication hash
ALTER TABLE "ThreatIndicator" ADD COLUMN IF NOT EXISTS "valueHash" VARCHAR(64);
CREATE INDEX IF NOT EXISTS "idx_threat_indicator_hash" ON "ThreatIndicator"("valueHash");

-- Add aggregate fields
ALTER TABLE "ThreatIndicator" ADD COLUMN IF NOT EXISTS "aggregateConfidence" INTEGER DEFAULT 50;
ALTER TABLE "ThreatIndicator" ADD COLUMN IF NOT EXISTS "sourceCount" INTEGER DEFAULT 1;
ALTER TABLE "ThreatIndicator" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP DEFAULT NOW();

-- Add normalized value for deduplication
ALTER TABLE "ThreatIndicator" ADD COLUMN IF NOT EXISTS "normalizedValue" TEXT;
CREATE INDEX IF NOT EXISTS "idx_threat_indicator_normalized" ON "ThreatIndicator"("normalizedValue");

-- =====================================================
-- 2. Create threat_source_mappings table
-- =====================================================

CREATE TABLE IF NOT EXISTS "ThreatSourceMapping" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "threatIndicatorId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP DEFAULT NOW(),
  "lastSeenAt" TIMESTAMP DEFAULT NOW(),
  "seenCount" INTEGER DEFAULT 1,
  "confidence" INTEGER DEFAULT 50,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_threat_indicator" FOREIGN KEY ("threatIndicatorId")
    REFERENCES "ThreatIndicator"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_threat_source" FOREIGN KEY ("sourceId")
    REFERENCES "ThreatIntelSource"("id") ON DELETE CASCADE,

  CONSTRAINT "unique_threat_source" UNIQUE ("threatIndicatorId", "sourceId")
);

CREATE INDEX IF NOT EXISTS "idx_threat_source_mapping_threat" ON "ThreatSourceMapping"("threatIndicatorId");
CREATE INDEX IF NOT EXISTS "idx_threat_source_mapping_source" ON "ThreatSourceMapping"("sourceId");
CREATE INDEX IF NOT EXISTS "idx_threat_source_mapping_last_seen" ON "ThreatSourceMapping"("lastSeenAt");

-- =====================================================
-- 3. Create threat_sync_jobs table
-- =====================================================

CREATE TABLE IF NOT EXISTS "ThreatSyncJob" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "sourceId" TEXT NOT NULL,
  "status" VARCHAR(50) DEFAULT 'pending',
  "startedAt" TIMESTAMP DEFAULT NOW(),
  "completedAt" TIMESTAMP,
  "recordsProcessed" INTEGER DEFAULT 0,
  "recordsAdded" INTEGER DEFAULT 0,
  "recordsUpdated" INTEGER DEFAULT 0,
  "recordsSkipped" INTEGER DEFAULT 0,
  "errorCount" INTEGER DEFAULT 0,
  "errorMessage" TEXT,
  "duration" INTEGER, -- milliseconds
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_sync_source" FOREIGN KEY ("sourceId")
    REFERENCES "ThreatIntelSource"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_threat_sync_job_source" ON "ThreatSyncJob"("sourceId");
CREATE INDEX IF NOT EXISTS "idx_threat_sync_job_status" ON "ThreatSyncJob"("status");
CREATE INDEX IF NOT EXISTS "idx_threat_sync_job_started" ON "ThreatSyncJob"("startedAt");

-- =====================================================
-- 4. Create deduplication function
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_threat_hash(
  p_type TEXT,
  p_normalized_value TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_type || ':' || p_normalized_value, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 5. Create aggregate confidence calculation function
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_aggregate_confidence(
  p_threat_indicator_id TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_avg_confidence NUMERIC;
  v_source_count INTEGER;
  v_base_confidence INTEGER;
  v_source_bonus INTEGER;
  v_final_confidence INTEGER;
BEGIN
  -- Get average confidence and source count
  SELECT
    COALESCE(AVG(confidence), 50),
    COUNT(DISTINCT "sourceId")
  INTO v_avg_confidence, v_source_count
  FROM "ThreatSourceMapping"
  WHERE "threatIndicatorId" = p_threat_indicator_id;

  -- Base confidence from average
  v_base_confidence := ROUND(v_avg_confidence);

  -- Bonus for multiple sources (max +20 for 4+ sources)
  v_source_bonus := LEAST(v_source_count * 5, 20);

  -- Calculate final confidence (capped at 100)
  v_final_confidence := LEAST(v_base_confidence + v_source_bonus, 100);

  RETURN v_final_confidence;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Create trigger to update aggregate confidence
-- =====================================================

CREATE OR REPLACE FUNCTION update_threat_aggregate()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "ThreatIndicator"
  SET
    "aggregateConfidence" = calculate_aggregate_confidence(NEW."threatIndicatorId"),
    "sourceCount" = (
      SELECT COUNT(DISTINCT "sourceId")
      FROM "ThreatSourceMapping"
      WHERE "threatIndicatorId" = NEW."threatIndicatorId"
    ),
    "lastSeenAt" = NEW."lastSeenAt",
    "updatedAt" = NOW()
  WHERE "id" = NEW."threatIndicatorId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_threat_aggregate
AFTER INSERT OR UPDATE ON "ThreatSourceMapping"
FOR EACH ROW
EXECUTE FUNCTION update_threat_aggregate();

-- =====================================================
-- 7. Update existing ThreatIntelSource records
-- =====================================================

-- Add reliability and priority if not exists
ALTER TABLE "ThreatIntelSource" ADD COLUMN IF NOT EXISTS "reliability" DECIMAL(3,2) DEFAULT 0.80;
ALTER TABLE "ThreatIntelSource" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 1;
ALTER TABLE "ThreatIntelSource" ADD COLUMN IF NOT EXISTS "syncIntervalMinutes" INTEGER DEFAULT 60;
ALTER TABLE "ThreatIntelSource" ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER DEFAULT 0;

-- Update existing sources with sync intervals
UPDATE "ThreatIntelSource" SET "syncIntervalMinutes" = 5 WHERE "name" = 'URLhaus';
UPDATE "ThreatIntelSource" SET "syncIntervalMinutes" = 10 WHERE "name" = 'ThreatFox';
UPDATE "ThreatIntelSource" SET "syncIntervalMinutes" = 1440 WHERE "name" = 'MalwareBazaar'; -- Daily
UPDATE "ThreatIntelSource" SET "syncIntervalMinutes" = 30 WHERE "name" = 'OpenPhish';
UPDATE "ThreatIntelSource" SET "syncIntervalMinutes" = 60 WHERE "name" = 'PhishTank';

-- =====================================================
-- 8. Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS "idx_threat_indicator_active" ON "ThreatIndicator"("active");
CREATE INDEX IF NOT EXISTS "idx_threat_indicator_first_seen" ON "ThreatIndicator"("firstSeen");
CREATE INDEX IF NOT EXISTS "idx_threat_indicator_type_value" ON "ThreatIndicator"("type", "value");
CREATE INDEX IF NOT EXISTS "idx_threat_source_enabled" ON "ThreatIntelSource"("enabled");

-- =====================================================
-- 9. Create materialized view for dashboard stats
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS "ThreatIntelDashboardStats" AS
SELECT
  (SELECT COUNT(*) FROM "ThreatIndicator" WHERE "active" = true) as "totalThreats",
  (SELECT COUNT(*) FROM "ThreatIntelSource" WHERE "enabled" = true) as "activeSources",
  (SELECT COUNT(DISTINCT "type") FROM "ThreatIndicator") as "indicatorTypes",
  (SELECT AVG("sourceCount") FROM "ThreatIndicator" WHERE "active" = true) as "avgSourcesPerThreat",
  (SELECT MAX("lastSyncAt") FROM "ThreatIntelSource") as "lastOverallSync",
  (SELECT COUNT(*) FROM "ThreatSyncJob" WHERE "status" = 'success' AND "startedAt" > NOW() - INTERVAL '24 hours') as "successfulSyncsToday",
  (SELECT COUNT(*) FROM "ThreatSyncJob" WHERE "status" = 'failed' AND "startedAt" > NOW() - INTERVAL '24 hours') as "failedSyncsToday"
;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_dashboard_stats_singleton" ON "ThreatIntelDashboardStats"((1));

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_threat_intel_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "ThreatIntelDashboardStats";
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. Grant permissions
-- =====================================================

-- Grant to backend service account
GRANT SELECT, INSERT, UPDATE, DELETE ON "ThreatSourceMapping" TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ThreatSyncJob" TO PUBLIC;
GRANT SELECT ON "ThreatIntelDashboardStats" TO PUBLIC;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE "ThreatSourceMapping" IS 'Tracks which sources reported each threat indicator';
COMMENT ON TABLE "ThreatSyncJob" IS 'Tracks history and status of threat feed synchronization jobs';
COMMENT ON COLUMN "ThreatIndicator"."valueHash" IS 'SHA-256 hash for deduplication';
COMMENT ON COLUMN "ThreatIndicator"."aggregateConfidence" IS 'Calculated confidence based on source count and individual confidences';
COMMENT ON COLUMN "ThreatIndicator"."sourceCount" IS 'Number of distinct sources reporting this threat';
