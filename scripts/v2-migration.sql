-- Elara V2 Scanner Database Migration
-- Run this on Cloud SQL to add V2 tables

-- V2ScannerConfig table
CREATE TABLE IF NOT EXISTS "V2ScannerConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "shadowMode" BOOLEAN NOT NULL DEFAULT false,
    "enabledOrganizations" JSONB NOT NULL DEFAULT '[]',
    "stage2ConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "branchThresholds" JSONB NOT NULL DEFAULT '{}',
    "stage1Weights" JSONB NOT NULL DEFAULT '{}',
    "stage2Weights" JSONB NOT NULL DEFAULT '{}',
    "vertexEndpoints" JSONB DEFAULT '{}',
    "urlLexicalBEndpoint" TEXT,
    "tabularRiskEndpoint" TEXT,
    "textPersuasionEndpoint" TEXT,
    "screenshotCnnEndpoint" TEXT,
    "combinerEndpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "V2ScannerConfig_name_key" ON "V2ScannerConfig"("name");

-- V2TrainingDataset table
CREATE TABLE IF NOT EXISTS "V2TrainingDataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "schema" JSONB NOT NULL DEFAULT '{}',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- V2ModelRegistry table
CREATE TABLE IF NOT EXISTS "V2ModelRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'development',
    "vertexModelId" TEXT,
    "vertexEndpointId" TEXT,
    "metrics" JSONB,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "V2ModelRegistry_modelName_version_key" ON "V2ModelRegistry"("modelName", "version");

-- V2CheckDefinition table
CREATE TABLE IF NOT EXISTS "V2CheckDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "threshold" DOUBLE PRECISION,
    "points" INTEGER,
    "maxPoints" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- V2Preset table
CREATE TABLE IF NOT EXISTS "V2Preset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "config" JSONB NOT NULL DEFAULT '{}',
    "checkOverrides" JSONB,
    "branchThresholds" JSONB NOT NULL DEFAULT '{}',
    "stage1Weights" JSONB NOT NULL DEFAULT '{}',
    "stage2Weights" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add V2 fields to ScanResult table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='scanEngineVersion') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "scanEngineVersion" TEXT DEFAULT 'v1';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='probability') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "probability" DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='confidenceInterval') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "confidenceInterval" JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='decisionGraph') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "decisionGraph" JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='policyOverride') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "policyOverride" JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='stage1Results') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "stage1Results" JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='ScanResult' AND column_name='stage2Results') THEN
        ALTER TABLE "ScanResult" ADD COLUMN "stage2Results" JSONB;
    END IF;
END $$;

-- Insert default V2 configuration
INSERT INTO "V2ScannerConfig" (
    "id",
    "name",
    "description",
    "isEnabled",
    "isDefault",
    "rolloutPercentage",
    "shadowMode",
    "enabledOrganizations",
    "stage2ConfidenceThreshold",
    "branchThresholds",
    "stage1Weights",
    "stage2Weights"
) VALUES (
    gen_random_uuid()::text,
    'default',
    'Default V2 Scanner Configuration',
    false,
    true,
    0,
    false,
    '[]'::jsonb,
    0.85,
    '{
        "ONLINE": [0.3, 0.5, 0.7, 0.85, 0.95],
        "OFFLINE": [0.2, 0.4, 0.6, 0.8, 0.9],
        "WAF": [0.4, 0.6, 0.75, 0.88, 0.95],
        "PARKED": [0.1, 0.3, 0.5, 0.7, 0.85],
        "SINKHOLE": [0.9, 0.95, 0.98, 0.99, 1.0]
    }'::jsonb,
    '{
        "urlLexicalA": 0.25,
        "urlLexicalB": 0.35,
        "tabularRisk": 0.40
    }'::jsonb,
    '{
        "textPersuasion": 0.60,
        "screenshotCnn": 0.40
    }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Insert strict preset
INSERT INTO "V2Preset" (
    "id",
    "name",
    "displayName",
    "description",
    "category",
    "config",
    "branchThresholds",
    "stage1Weights",
    "stage2Weights",
    "isDefault",
    "isSystem"
) VALUES (
    gen_random_uuid()::text,
    'strict',
    'Strict Security',
    'High security with low false negative tolerance',
    'security',
    '{}'::jsonb,
    '{
        "ONLINE": [0.2, 0.4, 0.6, 0.75, 0.9],
        "OFFLINE": [0.1, 0.3, 0.5, 0.7, 0.85],
        "WAF": [0.3, 0.5, 0.65, 0.8, 0.9],
        "PARKED": [0.05, 0.2, 0.4, 0.6, 0.8],
        "SINKHOLE": [0.85, 0.9, 0.95, 0.98, 1.0]
    }'::jsonb,
    '{
        "urlLexicalA": 0.20,
        "urlLexicalB": 0.30,
        "tabularRisk": 0.50
    }'::jsonb,
    '{
        "textPersuasion": 0.70,
        "screenshotCnn": 0.30
    }'::jsonb,
    false,
    true
) ON CONFLICT (name) DO NOTHING;

-- Insert balanced preset
INSERT INTO "V2Preset" (
    "id",
    "name",
    "displayName",
    "description",
    "category",
    "config",
    "branchThresholds",
    "stage1Weights",
    "stage2Weights",
    "isDefault",
    "isSystem"
) VALUES (
    gen_random_uuid()::text,
    'balanced',
    'Balanced',
    'Balanced security and user experience',
    'balanced',
    '{}'::jsonb,
    '{
        "ONLINE": [0.3, 0.5, 0.7, 0.85, 0.95],
        "OFFLINE": [0.2, 0.4, 0.6, 0.8, 0.9],
        "WAF": [0.4, 0.6, 0.75, 0.88, 0.95],
        "PARKED": [0.1, 0.3, 0.5, 0.7, 0.85],
        "SINKHOLE": [0.9, 0.95, 0.98, 0.99, 1.0]
    }'::jsonb,
    '{
        "urlLexicalA": 0.25,
        "urlLexicalB": 0.35,
        "tabularRisk": 0.40
    }'::jsonb,
    '{
        "textPersuasion": 0.60,
        "screenshotCnn": 0.40
    }'::jsonb,
    true,
    true
) ON CONFLICT (name) DO NOTHING;

-- Insert lenient preset
INSERT INTO "V2Preset" (
    "id",
    "name",
    "displayName",
    "description",
    "category",
    "config",
    "branchThresholds",
    "stage1Weights",
    "stage2Weights",
    "isDefault",
    "isSystem"
) VALUES (
    gen_random_uuid()::text,
    'lenient',
    'Lenient',
    'Low false positives, better UX',
    'ux',
    '{}'::jsonb,
    '{
        "ONLINE": [0.4, 0.6, 0.75, 0.88, 0.97],
        "OFFLINE": [0.3, 0.5, 0.7, 0.85, 0.95],
        "WAF": [0.5, 0.7, 0.85, 0.92, 0.98],
        "PARKED": [0.2, 0.4, 0.6, 0.8, 0.9],
        "SINKHOLE": [0.95, 0.97, 0.99, 0.995, 1.0]
    }'::jsonb,
    '{
        "urlLexicalA": 0.30,
        "urlLexicalB": 0.40,
        "tabularRisk": 0.30
    }'::jsonb,
    '{
        "textPersuasion": 0.50,
        "screenshotCnn": 0.50
    }'::jsonb,
    false,
    true
) ON CONFLICT (name) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'V2 Scanner migration completed successfully!';
END $$;
