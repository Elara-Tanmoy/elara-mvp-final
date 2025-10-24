-- Create Intelligence Data table for capturing all user activity
CREATE TABLE IF NOT EXISTS "intelligence_data" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "data" JSONB NOT NULL,
    "risk_score" DOUBLE PRECISION,
    "risk_level" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS "intelligence_data_event_type_idx" ON "intelligence_data"("event_type");
CREATE INDEX IF NOT EXISTS "intelligence_data_user_id_idx" ON "intelligence_data"("user_id");
CREATE INDEX IF NOT EXISTS "intelligence_data_timestamp_idx" ON "intelligence_data"("timestamp");
CREATE INDEX IF NOT EXISTS "intelligence_data_risk_level_idx" ON "intelligence_data"("risk_level");
CREATE INDEX IF NOT EXISTS "intelligence_data_organization_id_idx" ON "intelligence_data"("organization_id");

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS "intelligence_data_type_time_idx" ON "intelligence_data"("event_type", "timestamp");

-- GIN index for JSONB data queries
CREATE INDEX IF NOT EXISTS "intelligence_data_data_gin_idx" ON "intelligence_data" USING GIN ("data");

-- Comments
COMMENT ON TABLE "intelligence_data" IS 'Captures all user activity for LLM training and analytics';
COMMENT ON COLUMN "intelligence_data"."event_type" IS 'Type: search, scan, interaction';
COMMENT ON COLUMN "intelligence_data"."data" IS 'Full event data (searchable via JSONB)';
COMMENT ON COLUMN "intelligence_data"."user_id" IS 'Anonymized user ID (hashed in production)';
