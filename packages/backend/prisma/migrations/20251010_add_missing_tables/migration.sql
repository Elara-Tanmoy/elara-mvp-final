-- CreateEnum for subscriptions
DO $$ BEGIN
 CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "SubscriptionPlan" AS ENUM ('free', 'premium_monthly', 'premium_annual', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- THREAT INTELLIGENCE TABLES (moved from failed 20250110 migration)
-- ========================================

-- CreateTable: ThreatIntelSource
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

-- CreateTable: ThreatIndicator
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

-- CreateTable: ThreatFeedSync
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

-- Threat Intel Indexes
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

-- Seed Threat Intel Sources
INSERT INTO "threat_intel_sources" ("id", "name", "type", "url", "enabled", "syncFrequency", "metadata", "createdAt", "updatedAt")
VALUES
    ('phishtank', 'PhishTank', 'phishing', 'http://data.phishtank.com/data/online-valid.json', true, 3600, '{"format": "json"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('urlhaus', 'URLhaus', 'malware', 'https://urlhaus.abuse.ch/downloads/csv_recent/', true, 3600, '{"format": "csv"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('openphish', 'OpenPhish', 'phishing', 'https://openphish.com/feed.txt', true, 3600, '{"format": "txt"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('malware_bazaar', 'MalwareBazaar', 'malware', 'https://bazaar.abuse.ch/export/csv/recent/', true, 7200, '{"format": "csv"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('threatfox', 'ThreatFox', 'c2', 'https://threatfox.abuse.ch/export/json/recent/', true, 3600, '{"format": "json"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- END THREAT INTELLIGENCE TABLES
-- ========================================

-- CreateTable: Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'free',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "pricePerMonth" DECIMAL(10,2),
    "features" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemSettings
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RateLimitConfig
CREATE TABLE IF NOT EXISTS "RateLimitConfig" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 10,
    "requestsPerHour" INTEGER NOT NULL DEFAULT 100,
    "requestsPerDay" INTEGER NOT NULL DEFAULT 1000,
    "maxFileSize" INTEGER NOT NULL DEFAULT 5,
    "maxScansPerDay" INTEGER NOT NULL DEFAULT 50,
    "features" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Integration
CREATE TABLE IF NOT EXISTS "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApiUsage
CREATE TABLE IF NOT EXISTS "ApiUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminActivity
CREATE TABLE IF NOT EXISTS "AdminActivity" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProxySession
CREATE TABLE IF NOT EXISTS "ProxySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "bytesTransferred" BIGINT NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProxySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProxyRequest
CREATE TABLE IF NOT EXISTS "ProxyRequest" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "requestUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "statusCode" INTEGER,
    "bytesTransferred" BIGINT NOT NULL DEFAULT 0,
    "responseTime" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProxyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DomainHistory
CREATE TABLE IF NOT EXISTS "DomainHistory" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "registrar" TEXT,
    "whoisData" JSONB,
    "sslFingerprint" TEXT,
    "contentHash" TEXT,
    "pageTitle" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownershipChange" BOOLEAN NOT NULL DEFAULT false,
    "contentChange" BOOLEAN NOT NULL DEFAULT false,
    "ipChange" BOOLEAN NOT NULL DEFAULT false,
    "trafficSpike" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "anomalyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainHistory_pkey" PRIMARY KEY ("id")
);

-- Add walletAddress column to User if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'walletAddress') THEN
        ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;
    END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_organizationId_idx" ON "Subscription"("organizationId");
CREATE INDEX IF NOT EXISTS "Subscription_plan_idx" ON "Subscription"("plan");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_endDate_idx" ON "Subscription"("endDate");

CREATE UNIQUE INDEX IF NOT EXISTS "SystemSettings_key_key" ON "SystemSettings"("key");
CREATE INDEX IF NOT EXISTS "SystemSettings_category_idx" ON "SystemSettings"("category");
CREATE INDEX IF NOT EXISTS "SystemSettings_key_idx" ON "SystemSettings"("key");

CREATE UNIQUE INDEX IF NOT EXISTS "RateLimitConfig_tier_key" ON "RateLimitConfig"("tier");
CREATE INDEX IF NOT EXISTS "RateLimitConfig_tier_idx" ON "RateLimitConfig"("tier");

CREATE UNIQUE INDEX IF NOT EXISTS "Integration_name_key" ON "Integration"("name");
CREATE INDEX IF NOT EXISTS "Integration_name_idx" ON "Integration"("name");
CREATE INDEX IF NOT EXISTS "Integration_type_idx" ON "Integration"("type");
CREATE INDEX IF NOT EXISTS "Integration_enabled_idx" ON "Integration"("enabled");

CREATE INDEX IF NOT EXISTS "ApiUsage_organizationId_idx" ON "ApiUsage"("organizationId");
CREATE INDEX IF NOT EXISTS "ApiUsage_userId_idx" ON "ApiUsage"("userId");
CREATE INDEX IF NOT EXISTS "ApiUsage_endpoint_idx" ON "ApiUsage"("endpoint");
CREATE INDEX IF NOT EXISTS "ApiUsage_timestamp_idx" ON "ApiUsage"("timestamp");
CREATE INDEX IF NOT EXISTS "ApiUsage_statusCode_idx" ON "ApiUsage"("statusCode");

CREATE INDEX IF NOT EXISTS "AdminActivity_adminId_idx" ON "AdminActivity"("adminId");
CREATE INDEX IF NOT EXISTS "AdminActivity_action_idx" ON "AdminActivity"("action");
CREATE INDEX IF NOT EXISTS "AdminActivity_category_idx" ON "AdminActivity"("category");
CREATE INDEX IF NOT EXISTS "AdminActivity_timestamp_idx" ON "AdminActivity"("timestamp");

CREATE UNIQUE INDEX IF NOT EXISTS "ProxySession_sessionToken_key" ON "ProxySession"("sessionToken");
CREATE INDEX IF NOT EXISTS "ProxySession_userId_idx" ON "ProxySession"("userId");
CREATE INDEX IF NOT EXISTS "ProxySession_sessionToken_idx" ON "ProxySession"("sessionToken");
CREATE INDEX IF NOT EXISTS "ProxySession_status_idx" ON "ProxySession"("status");
CREATE INDEX IF NOT EXISTS "ProxySession_startedAt_idx" ON "ProxySession"("startedAt");

CREATE INDEX IF NOT EXISTS "ProxyRequest_sessionToken_idx" ON "ProxyRequest"("sessionToken");
CREATE INDEX IF NOT EXISTS "ProxyRequest_timestamp_idx" ON "ProxyRequest"("timestamp");

CREATE INDEX IF NOT EXISTS "DomainHistory_domain_timestamp_idx" ON "DomainHistory"("domain", "timestamp");
CREATE INDEX IF NOT EXISTS "DomainHistory_domain_idx" ON "DomainHistory"("domain");
CREATE INDEX IF NOT EXISTS "DomainHistory_timestamp_idx" ON "DomainHistory"("timestamp");

CREATE UNIQUE INDEX IF NOT EXISTS "User_walletAddress_key" ON "User"("walletAddress");
CREATE INDEX IF NOT EXISTS "User_walletAddress_idx" ON "User"("walletAddress");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_organizationId_fkey') THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
