-- Create SystemSetting table if it doesn't exist
CREATE TABLE IF NOT EXISTS "SystemSetting" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fix Integration table ID to auto-generate UUIDs
ALTER TABLE "Integration" ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
