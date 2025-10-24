-- CreateTable: AIModelDefinition
-- Configurable AI models for consensus-based threat detection
CREATE TABLE IF NOT EXISTS "ai_model_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT,

    -- Model Configuration
    "modelEndpoint" TEXT,
    "modelVersion" TEXT,
    "contextWindow" INTEGER NOT NULL DEFAULT 200000,
    "apiKey" TEXT,

    -- Performance Characteristics
    "avgResponseTime" INTEGER NOT NULL DEFAULT 2000,
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "costPer1kTokens" DOUBLE PRECISION DEFAULT 0.003,

    -- Scoring Configuration
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "minConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    -- Consensus Settings
    "useInConsensus" BOOLEAN NOT NULL DEFAULT true,
    "tieBreaker" BOOLEAN NOT NULL DEFAULT false,
    "requiredForScan" BOOLEAN NOT NULL DEFAULT false,
    "fallbackModelId" TEXT,

    -- Rate Limiting
    "maxRequestsPerMin" INTEGER NOT NULL DEFAULT 60,
    "maxConcurrentReqs" INTEGER NOT NULL DEFAULT 5,
    "cooldownOnError" INTEGER NOT NULL DEFAULT 5000,

    -- Capabilities
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportsImages" BOOLEAN NOT NULL DEFAULT false,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "supportsJsonMode" BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    "createdBy" TEXT,
    "lastEditedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndexes for AIModelDefinition
CREATE INDEX IF NOT EXISTS "ai_model_definitions_modelId_idx" ON "ai_model_definitions"("modelId");
CREATE INDEX IF NOT EXISTS "ai_model_definitions_provider_idx" ON "ai_model_definitions"("provider");
CREATE INDEX IF NOT EXISTS "ai_model_definitions_enabled_idx" ON "ai_model_definitions"("enabled");
CREATE INDEX IF NOT EXISTS "ai_model_definitions_rank_idx" ON "ai_model_definitions"("rank");

-- CreateTable: AIConsensusConfig
-- Configurable consensus strategies for AI model agreement
CREATE TABLE IF NOT EXISTS "ai_consensus_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    -- Consensus Strategy
    "strategy" TEXT NOT NULL DEFAULT 'weighted_vote',
    "minimumModels" INTEGER NOT NULL DEFAULT 2,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,

    -- Multiplier Calculation
    "multiplierMethod" TEXT NOT NULL DEFAULT 'average_confidence',
    "multiplierRange" JSONB NOT NULL DEFAULT '{"min": 0.5, "max": 1.5}',
    "penalizeDisagreement" BOOLEAN NOT NULL DEFAULT true,
    "disagreementPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0.1,

    -- Model Selection
    "enabledModels" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Advanced Settings
    "allowPartialConsensus" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "retryFailedModels" BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndexes for AIConsensusConfig
CREATE INDEX IF NOT EXISTS "ai_consensus_configs_isActive_idx" ON "ai_consensus_configs"("isActive");
CREATE INDEX IF NOT EXISTS "ai_consensus_configs_name_idx" ON "ai_consensus_configs"("name");

-- CreateTable: CheckDefinition
-- Configurable security check definitions for scan engine
CREATE TABLE IF NOT EXISTS "check_definitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,

    -- Check Configuration
    "checkType" TEXT NOT NULL,
    "defaultPoints" INTEGER NOT NULL DEFAULT 5,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    -- Execution Settings
    "timeout" INTEGER NOT NULL DEFAULT 5000,
    "retryAttempts" INTEGER NOT NULL DEFAULT 0,
    "cacheDuration" INTEGER NOT NULL DEFAULT 3600,
    "executionOrder" INTEGER NOT NULL DEFAULT 100,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Code Configuration
    "handlerFunction" TEXT,
    "validationRules" JSONB NOT NULL DEFAULT '{}',
    "customConfig" JSONB NOT NULL DEFAULT '{}',

    -- Metadata
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT,
    "createdBy" TEXT,
    "lastEditedBy" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystemCheck" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndexes for CheckDefinition
CREATE INDEX IF NOT EXISTS "check_definitions_checkId_idx" ON "check_definitions"("checkId");
CREATE INDEX IF NOT EXISTS "check_definitions_category_idx" ON "check_definitions"("category");
CREATE INDEX IF NOT EXISTS "check_definitions_enabled_idx" ON "check_definitions"("enabled");
CREATE INDEX IF NOT EXISTS "check_definitions_checkType_idx" ON "check_definitions"("checkType");
