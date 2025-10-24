-- ========================================
-- MANUAL FIX: Create missing tables for API keys, webhooks, and social auth
-- Run this directly in PostgreSQL Explorer connected to Render DB
-- ========================================

-- Step 1: Create AuthProvider enum for social authentication
DO $$ BEGIN
 CREATE TYPE "AuthProvider" AS ENUM ('local', 'google', 'facebook', 'linkedin', 'passkey');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "rate_limit" INTEGER NOT NULL DEFAULT 1000,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create webhooks table
CREATE TABLE IF NOT EXISTS "webhooks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" JSONB NOT NULL DEFAULT '[]',
    "organization_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "headers" JSONB DEFAULT '{}',
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay" INTEGER NOT NULL DEFAULT 5000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create webauthn_credentials table (Passkeys)
CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aaguid" TEXT,
    "credentialDeviceType" TEXT,
    "credentialBackedUp" BOOLEAN NOT NULL DEFAULT false,
    "friendlyName" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "webauthn_credentials_credentialId_key" UNIQUE ("credentialId")
);

-- Step 5: Add foreign key for webauthn_credentials
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'webauthn_credentials_userId_fkey'
    ) THEN
        ALTER TABLE "webauthn_credentials"
        ADD CONSTRAINT "webauthn_credentials_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 6: Add social auth fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" "AuthProvider" DEFAULT 'local';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facebookId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedinId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "providerData" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePicture" TEXT;

-- Step 7: Make passwordHash nullable for OAuth users
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Step 8: Create indexes for api_keys
CREATE INDEX IF NOT EXISTS "api_keys_organization_id_idx" ON "api_keys"("organization_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");
CREATE INDEX IF NOT EXISTS "api_keys_hashed_key_idx" ON "api_keys"("hashed_key");
CREATE INDEX IF NOT EXISTS "api_keys_is_active_idx" ON "api_keys"("is_active");

-- Step 9: Create indexes for webhooks
CREATE INDEX IF NOT EXISTS "webhooks_organization_id_idx" ON "webhooks"("organization_id");
CREATE INDEX IF NOT EXISTS "webhooks_is_active_idx" ON "webhooks"("is_active");

-- Step 10: Create indexes for webauthn_credentials
CREATE INDEX IF NOT EXISTS "webauthn_credentials_userId_idx" ON "webauthn_credentials"("userId");
CREATE INDEX IF NOT EXISTS "webauthn_credentials_credentialId_idx" ON "webauthn_credentials"("credentialId");

-- Step 11: Create indexes for User social auth fields
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_facebookId_key" ON "User"("facebookId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_linkedinId_key" ON "User"("linkedinId");
CREATE INDEX IF NOT EXISTS "User_googleId_idx" ON "User"("googleId");
CREATE INDEX IF NOT EXISTS "User_facebookId_idx" ON "User"("facebookId");
CREATE INDEX IF NOT EXISTS "User_linkedinId_idx" ON "User"("linkedinId");
CREATE INDEX IF NOT EXISTS "User_authProvider_idx" ON "User"("authProvider");

-- Step 12: Verify tables were created
SELECT
    'api_keys' as table_name,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'api_keys') as exists
UNION ALL
SELECT
    'webhooks' as table_name,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'webhooks') as exists
UNION ALL
SELECT
    'webauthn_credentials' as table_name,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'webauthn_credentials') as exists;

-- ========================================
-- SUCCESS! All tables and indexes created.
-- ========================================
