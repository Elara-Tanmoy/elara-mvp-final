-- ═══════════════════════════════════════════════════════════════════════════
-- ADVANCED URL SCAN SCORING SYSTEM (570-Point Algorithm)
-- Enterprise-grade configuration management and analytics
-- Migration: Add scan engine tables and enums
-- Created: 2025-10-15
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum: ReachabilityState
DO $$ BEGIN
 CREATE TYPE "ReachabilityState" AS ENUM ('ONLINE', 'OFFLINE', 'PARKED', 'WAF_CHALLENGE', 'SINKHOLE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- CONFIGURATION MANAGEMENT
-- ========================================

-- CreateTable: ScanConfiguration
CREATE TABLE IF NOT EXISTS "scan_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    -- Core Scoring Configuration
    "maxScore" INTEGER NOT NULL DEFAULT 570,
    "categoryWeights" JSONB NOT NULL DEFAULT '{}',
    "checkWeights" JSONB NOT NULL DEFAULT '{}',

    -- Algorithm Configuration
    "algorithmConfig" JSONB NOT NULL DEFAULT '{}',

    -- AI Model Configuration
    "aiModelConfig" JSONB NOT NULL DEFAULT '{}',

    -- Threat Intelligence Configuration
    "tiConfig" JSONB NOT NULL DEFAULT '{}',

    -- Reachability Configuration
    "reachabilityConfig" JSONB NOT NULL DEFAULT '{}',

    -- Exception Rules
    "whitelistRules" JSONB NOT NULL DEFAULT '[]',
    "blacklistRules" JSONB NOT NULL DEFAULT '[]',

    -- Metadata
    "createdBy" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable: ScanConfigurationHistory
CREATE TABLE IF NOT EXISTS "scan_configuration_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configurationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeDescription" TEXT,
    "previousSnapshot" JSONB,
    "newSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_configuration_history_configurationId_fkey"
        FOREIGN KEY ("configurationId") REFERENCES "scan_configurations"("id") ON DELETE CASCADE
);

-- ========================================
-- SCAN RESULTS & ANALYTICS
-- ========================================

-- CreateTable: AdminUrlScan
CREATE TABLE IF NOT EXISTS "admin_url_scans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,

    -- Configuration Snapshot
    "configurationId" TEXT NOT NULL,
    "configurationSnapshot" JSONB NOT NULL,

    -- Reachability State
    "reachabilityState" "ReachabilityState" NOT NULL,
    "pipelineUsed" TEXT NOT NULL,
    "reachabilityDetails" JSONB NOT NULL DEFAULT '{}',

    -- Scores
    "baseScore" INTEGER NOT NULL DEFAULT 0,
    "aiMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "finalScore" INTEGER NOT NULL DEFAULT 0,
    "activeMaxScore" INTEGER NOT NULL DEFAULT 570,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'safe',

    -- Detailed Results
    "categoryResults" JSONB NOT NULL DEFAULT '{}',
    "aiAnalysis" JSONB,
    "tiResults" JSONB NOT NULL DEFAULT '{}',

    -- Exception Handling
    "exceptionsHandled" JSONB NOT NULL DEFAULT '[]',
    "falsePositiveChecks" JSONB NOT NULL DEFAULT '{}',

    -- Performance Metrics
    "scanDuration" INTEGER,
    "performanceMetrics" JSONB NOT NULL DEFAULT '{}',
    "cacheStatus" JSONB,

    -- Metadata
    "scannedBy" TEXT,
    "organizationId" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_url_scans_configurationId_fkey"
        FOREIGN KEY ("configurationId") REFERENCES "scan_configurations"("id")
);

-- ========================================
-- WHITELIST / BLACKLIST MANAGEMENT
-- ========================================

-- CreateTable: ScanWhitelistEntry
CREATE TABLE IF NOT EXISTS "scan_whitelist_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "addedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scan_whitelist_entries_domain_organizationId_key"
        UNIQUE ("domain", "organizationId")
);

-- CreateTable: ScanBlacklistEntry
CREATE TABLE IF NOT EXISTS "scan_blacklist_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "threatType" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL DEFAULT 'high',
    "reason" TEXT NOT NULL,
    "addedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scan_blacklist_entries_domain_organizationId_key"
        UNIQUE ("domain", "organizationId")
);

-- ========================================
-- CACHING TABLES
-- ========================================

-- CreateTable: ScanTombstone
CREATE TABLE IF NOT EXISTS "scan_tombstones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urlHash" TEXT NOT NULL UNIQUE,
    "url" TEXT NOT NULL,
    "verdict" "RiskLevel" NOT NULL DEFAULT 'critical',
    "confirmedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable: ReachabilityCache
CREATE TABLE IF NOT EXISTS "reachability_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL UNIQUE,
    "state" "ReachabilityState" NOT NULL,
    "dnsResolved" BOOLEAN NOT NULL DEFAULT false,
    "tcpConnected" BOOLEAN NOT NULL DEFAULT false,
    "httpOk" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB NOT NULL DEFAULT '{}',
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable: ThreatIntelligenceCache
CREATE TABLE IF NOT EXISTS "threat_intelligence_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urlHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "score" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "threat_intelligence_cache_urlHash_source_key"
        UNIQUE ("urlHash", "source")
);

-- ========================================
-- INDEXES
-- ========================================

-- ScanConfiguration indexes
CREATE INDEX IF NOT EXISTS "scan_configurations_isActive_idx" ON "scan_configurations"("isActive");
CREATE INDEX IF NOT EXISTS "scan_configurations_isDefault_idx" ON "scan_configurations"("isDefault");
CREATE INDEX IF NOT EXISTS "scan_configurations_name_idx" ON "scan_configurations"("name");
CREATE INDEX IF NOT EXISTS "scan_configurations_createdAt_idx" ON "scan_configurations"("createdAt");

-- ScanConfigurationHistory indexes
CREATE INDEX IF NOT EXISTS "scan_configuration_history_configurationId_idx" ON "scan_configuration_history"("configurationId");
CREATE INDEX IF NOT EXISTS "scan_configuration_history_createdAt_idx" ON "scan_configuration_history"("createdAt");

-- AdminUrlScan indexes
CREATE INDEX IF NOT EXISTS "admin_url_scans_url_idx" ON "admin_url_scans"("url");
CREATE INDEX IF NOT EXISTS "admin_url_scans_configurationId_idx" ON "admin_url_scans"("configurationId");
CREATE INDEX IF NOT EXISTS "admin_url_scans_reachabilityState_idx" ON "admin_url_scans"("reachabilityState");
CREATE INDEX IF NOT EXISTS "admin_url_scans_riskLevel_idx" ON "admin_url_scans"("riskLevel");
CREATE INDEX IF NOT EXISTS "admin_url_scans_createdAt_idx" ON "admin_url_scans"("createdAt");
CREATE INDEX IF NOT EXISTS "admin_url_scans_organizationId_idx" ON "admin_url_scans"("organizationId");

-- ScanWhitelistEntry indexes
CREATE INDEX IF NOT EXISTS "scan_whitelist_entries_domain_idx" ON "scan_whitelist_entries"("domain");
CREATE INDEX IF NOT EXISTS "scan_whitelist_entries_isActive_idx" ON "scan_whitelist_entries"("isActive");
CREATE INDEX IF NOT EXISTS "scan_whitelist_entries_expiresAt_idx" ON "scan_whitelist_entries"("expiresAt");
CREATE INDEX IF NOT EXISTS "scan_whitelist_entries_organizationId_idx" ON "scan_whitelist_entries"("organizationId");

-- ScanBlacklistEntry indexes
CREATE INDEX IF NOT EXISTS "scan_blacklist_entries_domain_idx" ON "scan_blacklist_entries"("domain");
CREATE INDEX IF NOT EXISTS "scan_blacklist_entries_threatType_idx" ON "scan_blacklist_entries"("threatType");
CREATE INDEX IF NOT EXISTS "scan_blacklist_entries_severity_idx" ON "scan_blacklist_entries"("severity");
CREATE INDEX IF NOT EXISTS "scan_blacklist_entries_isActive_idx" ON "scan_blacklist_entries"("isActive");
CREATE INDEX IF NOT EXISTS "scan_blacklist_entries_organizationId_idx" ON "scan_blacklist_entries"("organizationId");

-- ScanTombstone indexes
CREATE INDEX IF NOT EXISTS "scan_tombstones_urlHash_idx" ON "scan_tombstones"("urlHash");
CREATE INDEX IF NOT EXISTS "scan_tombstones_verdict_idx" ON "scan_tombstones"("verdict");
CREATE INDEX IF NOT EXISTS "scan_tombstones_source_idx" ON "scan_tombstones"("source");
CREATE INDEX IF NOT EXISTS "scan_tombstones_confirmedDate_idx" ON "scan_tombstones"("confirmedDate");

-- ReachabilityCache indexes
CREATE INDEX IF NOT EXISTS "reachability_cache_domain_idx" ON "reachability_cache"("domain");
CREATE INDEX IF NOT EXISTS "reachability_cache_state_idx" ON "reachability_cache"("state");
CREATE INDEX IF NOT EXISTS "reachability_cache_expiresAt_idx" ON "reachability_cache"("expiresAt");
CREATE INDEX IF NOT EXISTS "reachability_cache_lastChecked_idx" ON "reachability_cache"("lastChecked");

-- ThreatIntelligenceCache indexes
CREATE INDEX IF NOT EXISTS "threat_intelligence_cache_urlHash_idx" ON "threat_intelligence_cache"("urlHash");
CREATE INDEX IF NOT EXISTS "threat_intelligence_cache_source_idx" ON "threat_intelligence_cache"("source");
CREATE INDEX IF NOT EXISTS "threat_intelligence_cache_verdict_idx" ON "threat_intelligence_cache"("verdict");
CREATE INDEX IF NOT EXISTS "threat_intelligence_cache_expiresAt_idx" ON "threat_intelligence_cache"("expiresAt");
