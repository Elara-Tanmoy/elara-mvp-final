-- Add V2 Scanner fields to scan_results table
ALTER TABLE "scan_results"
ADD COLUMN IF NOT EXISTS "scanEngineVersion" TEXT DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS "probability" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "confidenceInterval" JSONB,
ADD COLUMN IF NOT EXISTS "decisionGraph" JSONB,
ADD COLUMN IF NOT EXISTS "policyOverride" JSONB,
ADD COLUMN IF NOT EXISTS "stage1Results" JSONB,
ADD COLUMN IF NOT EXISTS "stage2Results" JSONB;

-- Create index on scanEngineVersion
CREATE INDEX IF NOT EXISTS "scan_results_scanEngineVersion_idx" ON "scan_results"("scanEngineVersion");

-- Create V2 Scanner Config table
CREATE TABLE IF NOT EXISTS "v2_scanner_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE DEFAULT 'default',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "enabledForOrgs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "shadowMode" BOOLEAN NOT NULL DEFAULT true,
    "urlLexicalBEndpoint" TEXT,
    "tabularRiskEndpoint" TEXT,
    "textPersuasionEndpoint" TEXT,
    "screenshotCnnEndpoint" TEXT,
    "combinerEndpoint" TEXT,
    "stage2ConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "branchThresholds" JSONB NOT NULL DEFAULT '{"ONLINE":{"safe":0.15,"low":0.30,"medium":0.50,"high":0.75,"critical":0.90},"OFFLINE":{"safe":0.25,"low":0.45,"medium":0.65,"high":0.85,"critical":0.95}}'::jsonb,
    "stage1Weights" JSONB NOT NULL DEFAULT '{"lexicalA":0.25,"lexicalB":0.35,"tabular":0.40}'::jsonb,
    "stage2Weights" JSONB NOT NULL DEFAULT '{"text":0.60,"screenshot":0.40}'::jsonb,
    "calibrationMethod" TEXT NOT NULL DEFAULT 'ICP',
    "calibrationAlpha" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "calibrationDataPath" TEXT,
    "featureStoreType" TEXT NOT NULL DEFAULT 'firestore',
    "firestoreCollection" TEXT NOT NULL DEFAULT 'v2_features',
    "vertexFeatureStore" TEXT,
    "featureCacheTTL" INTEGER NOT NULL DEFAULT 3600,
    "timeoutReachability" INTEGER NOT NULL DEFAULT 10000,
    "timeoutEvidence" INTEGER NOT NULL DEFAULT 30000,
    "timeoutStage1" INTEGER NOT NULL DEFAULT 5000,
    "timeoutStage2" INTEGER NOT NULL DEFAULT 10000,
    "timeoutTotal" INTEGER NOT NULL DEFAULT 60000,
    "geminiProjectId" TEXT NOT NULL DEFAULT 'elara-mvp-13082025-u1',
    "geminiLocation" TEXT NOT NULL DEFAULT 'us-central1',
    "geminiCacheTTL" INTEGER NOT NULL DEFAULT 3600,
    "geminiEnableCaching" BOOLEAN NOT NULL DEFAULT true,
    "geminiEnableCostTracking" BOOLEAN NOT NULL DEFAULT true,
    "enableTIGate" BOOLEAN NOT NULL DEFAULT true,
    "tiDualTier1Threshold" INTEGER NOT NULL DEFAULT 2,
    "enableMetrics" BOOLEAN NOT NULL DEFAULT true,
    "enableLogging" BOOLEAN NOT NULL DEFAULT true,
    "logLevel" TEXT NOT NULL DEFAULT 'info',
    "abTestingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "abTestVariant" TEXT,
    "createdBy" TEXT,
    "lastEditedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "v2_scanner_configs_isActive_idx" ON "v2_scanner_configs"("isActive");
CREATE INDEX IF NOT EXISTS "v2_scanner_configs_isDefault_idx" ON "v2_scanner_configs"("isDefault");

-- Create V2 Training Datasets table
CREATE TABLE IF NOT EXISTS "v2_training_datasets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "datasetType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "bigQueryDataset" TEXT,
    "bigQueryTable" TEXT,
    "gcsPath" TEXT,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "phishingCount" INTEGER NOT NULL DEFAULT 0,
    "benignCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "usedForTraining" BOOLEAN NOT NULL DEFAULT false,
    "trainingJobId" TEXT,
    "modelVersion" TEXT,
    "uploadedBy" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "v2_training_datasets_datasetType_idx" ON "v2_training_datasets"("datasetType");
CREATE INDEX IF NOT EXISTS "v2_training_datasets_status_idx" ON "v2_training_datasets"("status");
CREATE INDEX IF NOT EXISTS "v2_training_datasets_usedForTraining_idx" ON "v2_training_datasets"("usedForTraining");

-- Create V2 Model Registry table
CREATE TABLE IF NOT EXISTS "v2_model_registry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "vertexModelId" TEXT,
    "vertexEndpoint" TEXT,
    "vertexLocation" TEXT NOT NULL DEFAULT 'us-central1',
    "trainingDataset" TEXT,
    "trainingJobId" TEXT,
    "trainingMetrics" JSONB,
    "deploymentStatus" TEXT NOT NULL DEFAULT 'not_deployed',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "endpointUrl" TEXT,
    "avgLatency" INTEGER,
    "throughput" INTEGER,
    "errorRate" DOUBLE PRECISION,
    "deployedBy" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "v2_model_registry_modelName_modelVersion_key" UNIQUE ("modelName", "modelVersion")
);

CREATE INDEX IF NOT EXISTS "v2_model_registry_modelName_idx" ON "v2_model_registry"("modelName");
CREATE INDEX IF NOT EXISTS "v2_model_registry_isActive_idx" ON "v2_model_registry"("isActive");
CREATE INDEX IF NOT EXISTS "v2_model_registry_deploymentStatus_idx" ON "v2_model_registry"("deploymentStatus");

-- Insert default V2 config
INSERT INTO "v2_scanner_configs" ("id", "name", "description", "isActive", "isDefault", "createdAt", "updatedAt")
VALUES ('v2-default-config', 'default', 'Default V2 Scanner Configuration', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;
