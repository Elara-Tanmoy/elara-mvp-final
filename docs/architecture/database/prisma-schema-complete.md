# Elara Platform - Complete Database Schema Documentation

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Status**: Production
**Total Models**: 45
**Total Enums**: 15

---

## 📋 Executive Summary

This document provides comprehensive documentation for the Elara Platform database schema, implemented using Prisma ORM with PostgreSQL 15. The schema consists of **45 models** spanning core functionality, threat intelligence, AI-powered scanning, chatbot interactions, WhatsApp integration, and enterprise configuration management.

**Database Instance**: `elara-postgres-optimized`
**Engine**: PostgreSQL 15
**ORM**: Prisma Client (v5.22.0)
**Current Databases**:
- `elara_production` - Production environment
- `elara_dev` - Development environment
- `elara_staging` - Staging (dormant)
- `elara_threat_intel` - Shared threat intelligence (200K+ indicators)

---

## 📊 Table of Contents

1. [Core Business Models](#core-business-models)
2. [Scanning & Risk Assessment](#scanning--risk-assessment)
3. [Chatbot & AI](#chatbot--ai)
4. [WhatsApp Integration](#whatsapp-integration)
5. [Threat Intelligence Platform](#threat-intelligence-platform)
6. [Advanced Scan Engine](#advanced-scan-engine)
7. [Enterprise Configuration](#enterprise-configuration)
8. [Authentication & Security](#authentication--security)
9. [Audit & Analytics](#audit--analytics)
10. [Literacy & Recovery](#literacy--recovery)
11. [Proxy Services](#proxy-services)
12. [Enumerations](#enumerations)
13. [Indexes & Performance](#indexes--performance)
14. [Relationships Diagram](#relationships-diagram)

---

## 🏢 Core Business Models

### Organization

**Table**: `Organization`

Represents a company or entity using the Elara platform.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique organization identifier |
| `name` | String | | Organization name |
| `tier` | OrganizationTier | Default: free | Subscription tier (free, pro, enterprise) |
| `apiKey` | String | Unique, CUID | Public API key for authentication |
| `apiSecret` | String | CUID | Secret key for API authentication |
| `isActive` | Boolean | Default: true | Whether organization is active |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `users` → `User[]` (1:N)
- `scanResults` → `ScanResult[]` (1:N)
- `datasets` → `Dataset[]` (1:N)
- `auditLogs` → `AuditLog[]` (1:N)
- `subscription` → `Subscription?` (1:1)

**Indexes**:
- `apiKey` (for fast API lookups)
- `tier` (for tier-based queries)

**Use Cases**:
- Multi-tenancy support
- API authentication and authorization
- Subscription management
- Resource isolation per organization

---

### User

**Table**: `User`

Represents individual users within an organization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique user identifier |
| `email` | String | Unique | User email address |
| `passwordHash` | String? | Nullable | Hashed password (null for OAuth/passkey users) |
| `role` | UserRole | Default: user | User role (user, admin, owner) |
| `firstName` | String | | User's first name |
| `lastName` | String | | User's last name |
| `isActive` | Boolean | Default: true | Whether user account is active |
| `walletAddress` | String? | Unique, Nullable | Web3 wallet for blockchain features (Phase 3) |
| `authProvider` | AuthProvider | Default: local | Authentication method used |
| `googleId` | String? | Unique, Nullable | Google OAuth identifier |
| `facebookId` | String? | Unique, Nullable | Facebook OAuth identifier |
| `linkedinId` | String? | Unique, Nullable | LinkedIn OAuth identifier |
| `providerData` | Json? | Nullable | Additional OAuth provider data |
| `profilePicture` | String? | Nullable | Profile picture URL from OAuth |
| `lastLoginAt` | DateTime? | Nullable | Last login timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |
| `organizationId` | String | FK | Parent organization ID |

**Relationships**:
- `organization` → `Organization` (N:1, Cascade delete)
- `scanResults` → `ScanResult[]` (1:N)
- `auditLogs` → `AuditLog[]` (1:N)
- `passkeys` → `WebAuthnCredential[]` (1:N)

**Indexes**:
- `email` (for login lookups)
- `organizationId` (for tenant queries)
- `role` (for permission checks)
- `walletAddress` (for Web3 features)
- `googleId`, `facebookId`, `linkedinId` (OAuth lookups)
- `authProvider` (authentication routing)

**Authentication Support**:
- ✅ Local (email + password)
- ✅ Google OAuth
- ✅ Facebook OAuth
- ✅ LinkedIn OAuth
- ✅ Passkey/WebAuthn (passwordless)

---

### Subscription

**Table**: `Subscription`

Manages organization subscription plans and billing.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique subscription identifier |
| `organizationId` | String | Unique, FK | Organization this subscription belongs to |
| `plan` | SubscriptionPlan | Default: free | Subscription plan tier |
| `status` | SubscriptionStatus | Default: active | Current subscription status |
| `startDate` | DateTime | Default: now | Subscription start date |
| `endDate` | DateTime? | Nullable | Subscription expiration date |
| `autoRenew` | Boolean | Default: false | Whether subscription auto-renews |
| `stripeCustomerId` | String? | Unique, Nullable | Stripe customer identifier |
| `stripeSubscriptionId` | String? | Unique, Nullable | Stripe subscription identifier |
| `pricePerMonth` | Decimal? | Decimal(10,2) | Monthly price in USD |
| `features` | Json | Default: {} | Enabled features for this plan |
| `metadata` | Json | Default: {} | Additional subscription metadata |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `organization` → `Organization` (1:1, Cascade delete)

**Indexes**:
- `organizationId`
- `plan`
- `status`
- `endDate` (for expiration checks)

**Subscription Plans**:
- `free` - Limited features, low rate limits
- `premium_monthly` - Full features, monthly billing
- `premium_annual` - Full features, annual billing (discount)
- `enterprise` - Custom features, custom pricing

---

## 🔍 Scanning & Risk Assessment

### ScanResult

**Table**: `scan_results`

Stores comprehensive scan results for URLs, messages, and files.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique scan identifier |
| `scanType` | ScanType | | Type of scan (url, message, file) |
| `contentHash` | String | | SHA-256 hash of scanned content |
| `url` | String? | Nullable | URL scanned (if scanType = url) |
| `content` | String? | Nullable | Message content (if scanType = message) |
| `fileName` | String? | Nullable | File name (if scanType = file) |
| `fileSize` | Int? | Nullable | File size in bytes |
| `fileMimeType` | String? | Nullable | MIME type of file |
| `riskScore` | Int | Default: 0 | Calculated risk score (0-570) |
| `riskLevel` | RiskLevel | Default: safe | Risk classification |
| `status` | ScanStatus | Default: pending | Scan processing status |
| `findings` | Json | Default: [] | Array of security findings |
| `aiAnalysis` | Json? | Nullable | AI model analysis results |
| `scanDuration` | Int? | Nullable | Scan duration in milliseconds |
| `verdict` | Json? | Nullable | AI verdict {simple, technical, recommendation, safetyAdvice} |
| `conversationAnalysis` | Json? | Nullable | Conversation chain analysis (for screenshots) |
| `intentAnalysis` | Json? | Nullable | Intent analysis for scam detection |
| `ocrText` | String? | Nullable | OCR-extracted text from images |
| `ocrConfidence` | Float? | Nullable | OCR confidence score (0-100) |
| `extractedText` | String? | Nullable | Text extracted from files (PDF, etc.) |
| `createdAt` | DateTime | Auto | Scan timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |
| `userId` | String | FK | User who initiated scan |
| `organizationId` | String | FK | Organization the scan belongs to |

**Relationships**:
- `user` → `User` (N:1, Cascade delete)
- `organization` → `Organization` (N:1, Cascade delete)
- `riskCategories` → `RiskCategory[]` (1:N)
- `auditLogs` → `AuditLog[]` (1:N)

**Indexes**:
- `userId` (user's scan history)
- `organizationId` (tenant queries)
- `scanType` (filter by scan type)
- `riskLevel` (filter by risk)
- `status` (processing queue)
- `contentHash` (deduplication)
- `createdAt` (time-based queries)

**Scan Types**:
- **url**: Web page/link analysis
- **message**: Text message scam detection
- **file**: Document/image file scanning with OCR

**Risk Levels**:
- `safe` (0-99 points)
- `low` (100-199 points)
- `medium` (200-299 points)
- `high` (300-399 points)
- `critical` (400+ points)

---

### RiskCategory

**Table**: `RiskCategory`

Breaks down scan results into specific risk categories with individual scores.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique category identifier |
| `category` | String | | Risk category name (e.g., "SSL/TLS Security", "Domain Age") |
| `score` | Int | Default: 0 | Points scored in this category |
| `maxWeight` | Int | | Maximum possible points for this category |
| `findings` | Json | Default: [] | Specific findings in this category |
| `evidence` | Json? | Nullable | Evidence supporting the findings |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `scanResultId` | String | FK | Parent scan result ID |

**Relationships**:
- `scanResult` → `ScanResult` (N:1, Cascade delete)

**Indexes**:
- `scanResultId` (fetch categories for a scan)
- `category` (category-based analytics)

**Common Categories** (570-point system):
1. Domain & Registration Analysis (40 points)
2. SSL/TLS Security (50 points)
3. DNS Configuration (40 points)
4. URL Structure Analysis (35 points)
5. HTTP Headers & Security (45 points)
6. Content Analysis (60 points)
7. Threat Intelligence (100 points)
8. Visual Indicators (30 points)
9. Behavioral Red Flags (40 points)
10. JavaScript & Code Analysis (25 points)
11. Form Security (20 points)
12. Third-Party Resources (20 points)
13. Mobile Security (15 points)
14. SEO & Reputation (20 points)
15. Legal Compliance (20 points)
16. Performance & Infrastructure (15 points)
17. Predictive Risk Modeling (35 points)

---

### Dataset

**Table**: `Dataset`

Stores uploaded CSV datasets for training and vectorization.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique dataset identifier |
| `name` | String | | Dataset name |
| `description` | String? | Nullable | Dataset description |
| `fileUrl` | String | | Cloud Storage URL to CSV file |
| `fileName` | String | | Original filename |
| `fileSize` | Int | | File size in bytes |
| `rowCount` | Int | Default: 0 | Number of rows in dataset |
| `columnCount` | Int | Default: 0 | Number of columns |
| `status` | DatasetStatus | Default: processing | Processing status |
| `vectorized` | Boolean | Default: false | Whether dataset is vectorized in ChromaDB |
| `uploadedAt` | DateTime | Auto | Upload timestamp |
| `processedAt` | DateTime? | Nullable | Processing completion timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |
| `organizationId` | String | FK | Organization that owns dataset |

**Relationships**:
- `organization` → `Organization` (N:1, Cascade delete)
- `entries` → `DatasetEntry[]` (1:N)

**Indexes**:
- `organizationId`
- `status` (processing queue)
- `vectorized` (filter ready datasets)

---

### DatasetEntry

**Table**: `DatasetEntry`

Individual rows from uploaded datasets.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique entry identifier |
| `content` | String | | Row content/text |
| `vectorId` | String? | Nullable | ChromaDB vector ID |
| `metadata` | Json | Default: {} | Row metadata |
| `rowNumber` | Int | | Row number in original CSV |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `datasetId` | String | FK | Parent dataset ID |

**Relationships**:
- `dataset` → `Dataset` (N:1, Cascade delete)

**Indexes**:
- `datasetId`
- `vectorId` (ChromaDB lookups)
- `rowNumber` (ordered retrieval)

---

## 🤖 Chatbot & AI

### ChatbotConfig

**Table**: `chatbot_config`

Global configuration for the Elara AI chatbot.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique config identifier |
| `name` | String | Default: "Ask Elara" | Chatbot display name |
| `temperature` | Decimal | Default: 0.7, Decimal(3,2) | LLM temperature (0.0-1.0) |
| `model` | String | Default: "claude-sonnet-4-5", Varchar(100) | AI model to use |
| `enabled` | Boolean | Default: true | Whether chatbot is enabled |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `customInstructions` | String? | Nullable | Custom system instructions |
| `enableConversationMemory` | Boolean | Default: true | Enable conversation context |
| `enableRag` | Boolean | Default: true | Enable RAG (Retrieval-Augmented Generation) |
| `maxConversationHistory` | Int | Default: 10 | Max messages to include in context |
| `maxTokens` | Int | Default: 2000 | Max tokens per response |
| `responseStyle` | String | Default: "professional", Varchar(50) | Response tone/style |
| `systemPrompt` | String? | Nullable | System prompt for AI model |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Use Cases**:
- Dynamic chatbot configuration without code changes
- A/B testing different AI models
- Tuning response quality and behavior

---

### KnowledgeBase

**Table**: `knowledge_base`

Stores knowledge articles for RAG (Retrieval-Augmented Generation).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique knowledge entry identifier |
| `title` | String | Varchar(500) | Article title |
| `content` | String | | Full article content |
| `source` | String? | Varchar(500), Nullable | Content source/URL |
| `category` | String? | Varchar(100), Nullable | Category (e.g., "phishing", "malware") |
| `metadata` | Json? | Nullable | Additional metadata |
| `indexed` | Boolean | Default: false | Whether content is vectorized |
| `chunkIndex` | Int | Default: 0 | Chunk index for long articles |
| `contentType` | String | Default: "text", Varchar(50) | Content type |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `createdBy` | String? | Nullable | User who created this entry |
| `totalChunks` | Int | Default: 1 | Total chunks for this article |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `category` (category-based retrieval)
- `indexed` (filter indexed content)

**RAG Flow**:
1. User asks question
2. Query is embedded into vector
3. ChromaDB finds most relevant knowledge entries
4. Retrieved content is added to AI prompt
5. AI generates informed response

---

### ChatSession

**Table**: `chat_sessions`

Tracks individual chat conversations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique session identifier |
| `context` | Json? | Nullable | Session context data |
| `metadata` | Json? | Nullable | Additional session metadata |
| `rating` | Int? | Nullable | User rating (1-5 stars) |
| `feedback` | String? | Nullable | User feedback text |
| `endedAt` | DateTime? | Nullable | Session end timestamp |
| `lastActivity` | DateTime | Default: now | Last message timestamp |
| `messageCount` | Int | Default: 0 | Number of messages in session |
| `sessionToken` | String | Unique, Varchar(255) | Anonymous session identifier |
| `startedAt` | DateTime | Auto | Session start timestamp |
| `userId` | String? | Nullable | User ID (if authenticated) |

**Relationships**:
- `messages` → `ChatMessage[]` (1:N)

**Indexes**:
- `userId` (user's chat history)
- `sessionToken` (session lookup)

---

### ChatMessage

**Table**: `chat_messages`

Individual messages within a chat session.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique message identifier |
| `role` | String | Varchar(20) | Message role (user, assistant, system) |
| `content` | String | | Message content |
| `model` | String? | Varchar(100), Nullable | AI model used (if assistant message) |
| `latency` | Int? | Nullable | Response latency in milliseconds |
| `confidence` | Decimal? | Decimal(3,2), Nullable | AI confidence score |
| `createdAt` | DateTime | Auto | Message timestamp |
| `retrievedSources` | Json? | Nullable | RAG sources used in response |
| `sessionId` | UUID | FK | Parent session ID |
| `tokensUsed` | Int? | Nullable | Tokens consumed by this message |

**Relationships**:
- `session` → `ChatSession` (N:1, Cascade delete)

**Indexes**:
- `sessionId` (fetch session messages)
- `createdAt` (chronological ordering)

---

### ChatbotTrainingData

**Table**: `chatbot_training_data`

Tracks uploaded training data for chatbot improvement.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique training data identifier |
| `content` | String? | Nullable | Training content |
| `status` | String | Default: "pending", Varchar(50) | Processing status |
| `createdAt` | DateTime | Auto | Upload timestamp |
| `dataType` | String | Varchar(50) | Data type (csv, json, text) |
| `errorMessage` | String? | Nullable | Error message if processing failed |
| `fileName` | String? | Varchar(500), Nullable | Original filename |
| `fileSize` | BigInt? | Nullable | File size in bytes |
| `processedAt` | DateTime? | Nullable | Processing completion timestamp |
| `processedEntries` | Int | Default: 0 | Number of entries processed |
| `totalEntries` | Int | Default: 0 | Total entries in dataset |
| `uploadedBy` | String? | Nullable | User who uploaded data |

**Indexes**:
- `status` (processing queue)

---

### ChatbotAnalytics

**Table**: `chatbot_analytics`

Daily aggregated analytics for chatbot usage.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Unique analytics record identifier |
| `date` | DateTime | Date type | Analytics date |
| `avgRating` | Decimal? | Decimal(3,2), Nullable | Average user rating |
| `avgResponseTime` | Int? | Nullable | Average response time in ms |
| `createdAt` | DateTime | Auto | Record creation timestamp |
| `failedResponses` | Int | Default: 0 | Number of failed responses |
| `successfulResponses` | Int | Default: 0 | Number of successful responses |
| `topTopics` | Json? | Nullable | Most discussed topics |
| `totalMessages` | Int | Default: 0 | Total messages sent |
| `totalSessions` | Int | Default: 0 | Total chat sessions |
| `uniqueUsers` | Int | Default: 0 | Number of unique users |

**Indexes**:
- `date` (time-series queries)

---

## 📱 WhatsApp Integration

### WhatsAppUser

**Table**: `whatsapp_users`

Tracks WhatsApp users and their usage limits.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique WhatsApp user identifier |
| `phoneNumber` | String | Unique | User's WhatsApp phone number |
| `displayName` | String? | Nullable | User's display name |
| `tier` | String | Default: "free" | User tier (free, pro, enterprise) |
| `dailyMessageLimit` | Int | Default: 5 | Messages allowed per day |
| `messagesUsed` | Int | Default: 0 | Messages used today |
| `lastResetAt` | DateTime | Default: now | Last daily limit reset timestamp |
| `totalMessages` | Int | Default: 0 | Total messages scanned (lifetime) |
| `threatsBlocked` | Int | Default: 0 | Total threats blocked |
| `isActive` | Boolean | Default: true | Whether user is active |
| `onboardedAt` | DateTime | Auto | User onboarding timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `messages` → `WhatsAppMessage[]` (1:N)

**Indexes**:
- `phoneNumber` (user lookup)

**Tier Limits**:
- Free: 5 messages/day
- Pro: 50 messages/day
- Enterprise: Unlimited

---

### WhatsAppMessage

**Table**: `whatsapp_messages`

Stores WhatsApp messages scanned via Twilio webhook.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique message identifier |
| `userId` | String | FK | WhatsApp user ID |
| `messageSid` | String | Unique | Twilio message SID |
| `messageBody` | String? | Nullable | Message text content |
| `mediaCount` | Int | Default: 0 | Number of media attachments |
| `mediaUrls` | String[] | Default: [] | Array of media URLs |
| `riskLevel` | String? | Nullable | Overall risk level |
| `overallScore` | Int? | Nullable | Overall risk score |
| `processingTime` | Int? | Nullable | Processing time in milliseconds |
| `status` | String | Default: "received" | Message status |
| `errorMessage` | String? | Nullable | Error message if processing failed |
| `scanResultIds` | String[] | Default: [] | Array of ScanResult IDs |
| `responseMessage` | String? | Nullable | Response sent back to user |
| `analysisDetails` | Json? | Nullable | Detailed analysis results |
| `createdAt` | DateTime | Auto | Message receive timestamp |
| `processedAt` | DateTime? | Nullable | Processing completion timestamp |

**Relationships**:
- `user` → `WhatsAppUser` (N:1, Cascade delete)
- `mediaFiles` → `WhatsAppMediaFile[]` (1:N)

**Indexes**:
- `userId` (user's messages)
- `messageSid` (Twilio lookup)
- `status` (processing queue)
- `createdAt` (time-based queries)
- `riskLevel` (threat analytics)

---

### WhatsAppMediaFile

**Table**: `whatsapp_media_files`

Stores media files from WhatsApp messages (images, PDFs, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique media file identifier |
| `messageId` | String | FK | Parent message ID |
| `fileName` | String? | Nullable | Original filename |
| `fileSize` | Int? | Nullable | File size in bytes |
| `mimeType` | String? | Nullable | MIME type |
| `mediaUrl` | String? | Nullable | Twilio media URL |
| `localPath` | String? | Nullable | Local storage path |
| `fileData` | Bytes? | Nullable | Binary file data (for small files) |
| `thumbnailData` | Bytes? | Nullable | Thumbnail preview (for images) |
| `scanResultId` | String? | Nullable | Associated scan result ID |
| `riskLevel` | String? | Nullable | Risk level from scan |
| `createdAt` | DateTime | Auto | File receive timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `message` → `WhatsAppMessage` (N:1, Cascade delete)

**Indexes**:
- `messageId` (fetch message media)
- `scanResultId` (link to scan results)
- `createdAt`

---

## 🛡️ Threat Intelligence Platform

### ThreatIntelSource

**Table**: `threat_intel_sources`

Defines threat intelligence data sources (PhishTank, URLhaus, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique source identifier |
| `name` | String | Unique | Source name (PhishTank, URLhaus, OpenPhish) |
| `type` | String | | Threat type (phishing, malware, spam) |
| `url` | String? | Nullable | API/feed URL |
| `enabled` | Boolean | Default: true | Whether source is active |
| `lastSyncAt` | DateTime? | Nullable | Last successful sync timestamp |
| `lastError` | String? | Nullable | Last error message |
| `totalIndicators` | Int | Default: 0 | Total indicators from this source |
| `syncFrequency` | Int | Default: 3600 | Sync frequency in seconds |
| `apiKey` | String? | Nullable | API key if required |
| `metadata` | Json | Default: {} | Additional source metadata |
| `defaultWeight` | Int | Default: 5 | Points for matches from this source |
| `priority` | Int | Default: 1 | Check priority (higher = checked first) |
| `reliability` | Float | Default: 0.8 | Reliability score (0.0-1.0) |
| `requiresAuth` | Boolean | Default: false | Whether API requires authentication |
| `rateLimit` | Int | Default: 100 | Max requests per minute |
| `cacheTimeout` | Int | Default: 3600 | Cache duration in seconds |
| `autoSync` | Boolean | Default: true | Auto-sync on schedule |
| `description` | String? | Nullable | Source description |
| `category` | String | Default: "general" | Source category |
| `costPerQuery` | Float? | Nullable | Cost in USD if paid API |
| `createdBy` | String? | Nullable | User who added source |
| `lastEditedBy` | String? | Nullable | User who last edited |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `indicators` → `ThreatIndicator[]` (1:N)
- `syncHistory` → `ThreatFeedSync[]` (1:N)

**Indexes**:
- `name`
- `enabled` (active sources)
- `type` (threat type filtering)
- `priority` (execution order)
- `category`

**Default Sources** (18+ configured):
1. PhishTank - Community phishing database
2. URLhaus - Malware URL database
3. OpenPhish - Phishing feed
4. Google Safe Browsing - Google's threat database
5. VirusTotal - Multi-AV scanning
6. AbuseIPDB - IP reputation
7. AlienVault OTX - Open Threat Exchange
8. MISP - Malware Information Sharing Platform
9. ThreatFox - Malware IOC database
10. Emerging Threats - Proofpoint threat feed
11. SANS ISC - Internet Storm Center
12. FBI InfraGard - FBI threat sharing
13. CISA AIS - US government threat feed
14. Spamhaus - Spam/malware blocklists
15. MalwareBazaar - Malware samples
16. Feodo Tracker - Botnet C2 tracker
17. SSL Blacklist - SSL cert abuse tracker
18. CyberCrime Tracker - C2 panel tracker

---

### ThreatIndicator

**Table**: `threat_indicators`

Individual threat indicators (URLs, IPs, hashes, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique indicator identifier |
| `type` | String | | Indicator type (url, domain, ip, hash, email) |
| `value` | String | | The actual indicator (URL, IP, etc.) |
| `valueHash` | String | | SHA-256 hash of value (for indexing) |
| `threatType` | String | | Threat classification (phishing, malware, spam, c2, ransomware) |
| `severity` | String | Default: "medium" | Severity (low, medium, high, critical) |
| `confidence` | Int | Default: 50 | Confidence score (0-100) |
| `description` | String? | Nullable | Threat description |
| `tags` | String[] | Default: [] | Additional tags |
| `firstSeen` | DateTime | Default: now | First observation timestamp |
| `lastSeen` | DateTime | Default: now | Last observation timestamp |
| `sourceId` | String | FK | Source feed ID |
| `expiresAt` | DateTime? | Nullable | Expiration timestamp |
| `metadata` | Json | Default: {} | Additional data from source |
| `active` | Boolean | Default: true | Whether indicator is still active |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `source` → `ThreatIntelSource` (N:1, Cascade delete)

**Unique Constraint**: `[type, valueHash, sourceId]` (prevents duplicates)

**Indexes**:
- `type` (indicator type filtering)
- `valueHash` (fast lookups)
- `threatType` (threat classification)
- `severity` (severity filtering)
- `active` (only check active indicators)
- `firstSeen`, `expiresAt` (temporal queries)
- `sourceId` (source-specific queries)

**Current Scale**: 200,000+ indicators in `elara_threat_intel` database

---

### ThreatFeedSync

**Table**: `threat_feed_syncs`

Tracks sync history for threat intelligence feeds.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique sync record identifier |
| `sourceId` | String | FK | Source feed ID |
| `status` | String | | Sync status (success, failed, in_progress) |
| `indicatorsAdded` | Int | Default: 0 | New indicators added |
| `indicatorsUpdated` | Int | Default: 0 | Indicators updated |
| `indicatorsRemoved` | Int | Default: 0 | Indicators removed |
| `duration` | Int? | Nullable | Sync duration in milliseconds |
| `errorMessage` | String? | Nullable | Error message if failed |
| `startedAt` | DateTime | Auto | Sync start timestamp |
| `completedAt` | DateTime? | Nullable | Sync completion timestamp |
| `metadata` | Json | Default: {} | Additional sync metadata |

**Relationships**:
- `source` → `ThreatIntelSource` (N:1, Cascade delete)

**Indexes**:
- `sourceId` (source history)
- `status` (filter by status)
- `startedAt` (time-based queries)

---

## 🎯 Advanced Scan Engine

### ScanConfiguration

**Table**: `scan_configurations`

Manages different scan configurations for the advanced 570-point URL scan system.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique configuration identifier |
| `name` | String | | Configuration name |
| `description` | String? | Nullable | Configuration description |
| `version` | String | Default: "1.0.0" | Version number |
| `isActive` | Boolean | Default: false | Whether config is currently active |
| `isDefault` | Boolean | Default: false | Whether this is the default config |
| `maxScore` | Int | Default: 570 | Maximum possible score (100-1000) |
| `categoryWeights` | Json | Default: {} | 17 category weight configuration |
| `checkWeights` | Json | Default: {} | 100+ individual check weights |
| `algorithmConfig` | Json | Default: {} | Scoring algorithm settings |
| `aiModelConfig` | Json | Default: {} | AI model configuration |
| `tiConfig` | Json | Default: {} | Threat intelligence API settings |
| `reachabilityConfig` | Json | Default: {} | Reachability check settings |
| `whitelistRules` | Json | Default: [] | Domain whitelist overrides |
| `blacklistRules` | Json | Default: [] | Domain blacklist overrides |
| `createdBy` | String? | Nullable | User who created config |
| `usageCount` | Int | Default: 0 | Number of times used |
| `lastUsedAt` | DateTime? | Nullable | Last usage timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `adminScans` → `AdminUrlScan[]` (1:N)
- `history` → `ScanConfigurationHistory[]` (1:N)

**Indexes**:
- `isActive` (find active configs)
- `isDefault` (get default config)
- `name`
- `createdAt`

---

### AdminUrlScan

**Table**: `admin_url_scans`

Stores detailed results from advanced admin URL scans.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique scan identifier |
| `url` | String | | URL scanned |
| `configurationId` | String | FK | Configuration used for scan |
| `configurationSnapshot` | Json | | Full config snapshot at scan time |
| `reachabilityState` | ReachabilityState | | Site reachability (ONLINE, OFFLINE, PARKED, WAF_CHALLENGE, SINKHOLE) |
| `pipelineUsed` | String | | Pipeline executed (FULL, PASSIVE, PARKED, WAF, SINKHOLE) |
| `reachabilityDetails` | Json | Default: {} | Detailed reachability results |
| `baseScore` | Int | Default: 0 | Base score before AI multiplier |
| `aiMultiplier` | Float | Default: 1.0 | AI consensus multiplier (0.5-1.5) |
| `finalScore` | Int | Default: 0 | Final score (baseScore * aiMultiplier) |
| `activeMaxScore` | Int | Default: 570 | Dynamic max score based on categories run |
| `riskLevel` | RiskLevel | Default: safe | Risk classification |
| `categoryResults` | Json | Default: {} | All 17 categories with sub-checks |
| `aiAnalysis` | Json? | Nullable | 3 AI model verdicts + consensus |
| `tiResults` | Json | Default: {} | 11 TI API results |
| `exceptionsHandled` | Json | Default: [] | Exceptions handled during scan |
| `falsePositiveChecks` | Json | Default: {} | CDN, RIOT, gov validation results |
| `scanDuration` | Int? | Nullable | Total scan duration in milliseconds |
| `performanceMetrics` | Json | Default: {} | Timing breakdown per category |
| `cacheStatus` | Json? | Nullable | Cache hit/miss status and age |
| `scannedBy` | String? | Nullable | User who initiated scan |
| `organizationId` | String? | Nullable | Organization ID |
| `notes` | String? | Nullable | Admin notes |
| `tags` | String[] | Default: [] | Tags for categorization |
| `createdAt` | DateTime | Auto | Scan timestamp |

**Relationships**:
- `configuration` → `ScanConfiguration` (N:1)

**Indexes**:
- `url` (URL-based queries)
- `configurationId` (config usage)
- `reachabilityState` (state filtering)
- `riskLevel` (risk filtering)
- `createdAt` (time-based queries)
- `organizationId` (tenant queries)

---

### ReachabilityCache

**Table**: `reachability_cache`

Caches domain reachability results to improve performance.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique cache entry identifier |
| `domain` | String | Unique | Domain name |
| `state` | ReachabilityState | | Reachability state |
| `dnsResolved` | Boolean | Default: false | Whether DNS resolved |
| `tcpConnected` | Boolean | Default: false | Whether TCP connection succeeded |
| `httpOk` | Boolean | Default: false | Whether HTTP request succeeded |
| `details` | Json | Default: {} | IP, status code, headers, etc. |
| `lastChecked` | DateTime | Default: now | Last check timestamp |
| `expiresAt` | DateTime | | Cache expiration (TTL: 1 hour default) |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `domain` (domain lookup)
- `state` (state filtering)
- `expiresAt` (expiration cleanup)
- `lastChecked` (freshness queries)

---

### ThreatIntelligenceCache

**Table**: `threat_intelligence_cache`

Caches threat intelligence API results.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique cache entry identifier |
| `urlHash` | String | | SHA-256 hash of canonical URL |
| `source` | String | | TI source (google_safe_browsing, virustotal, etc.) |
| `verdict` | String | | Verdict (safe, malicious, suspicious) |
| `confidence` | Int | Default: 50 | Confidence score (0-100) |
| `score` | Int | Default: 0 | Points contributed to scan |
| `details` | Json | Default: {} | Full API response |
| `expiresAt` | DateTime | | Cache expiration (varies by source: 5 min - 24 hours) |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Unique Constraint**: `[urlHash, source]`

**Indexes**:
- `urlHash` (URL lookups)
- `source` (source-specific queries)
- `verdict` (verdict filtering)
- `expiresAt` (expiration cleanup)

---

### CheckDefinition

**Table**: `check_definitions`

Defines all individual security checks used in URL scanning.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique check identifier |
| `checkId` | String | Unique | Check identifier (e.g., "ssl_valid", "domain_age_check") |
| `name` | String | | Display name |
| `description` | String? | Nullable | Check description |
| `category` | String | | Category (SSL/TLS, Domain Age, DNS, etc.) |
| `checkType` | String | | Check type (passive, active, external_api) |
| `defaultPoints` | Int | Default: 5 | Default points for this check |
| `severity` | String | Default: "medium" | Severity (low, medium, high, critical) |
| `enabled` | Boolean | Default: true | Whether check is enabled |
| `timeout` | Int | Default: 5000 | Timeout in milliseconds |
| `retryAttempts` | Int | Default: 0 | Number of retry attempts |
| `cacheDuration` | Int | Default: 3600 | Cache duration in seconds |
| `executionOrder` | Int | Default: 100 | Execution order (lower = earlier) |
| `dependencies` | String[] | Default: [] | Other checkIds that must run first |
| `handlerFunction` | String? | Nullable | Function name or path |
| `validationRules` | Json | Default: {} | Validation rules |
| `customConfig` | Json | Default: {} | Check-specific configuration |
| `version` | String | Default: "1.0.0" | Check version |
| `author` | String? | Nullable | Check author |
| `createdBy` | String? | Nullable | User who created check |
| `lastEditedBy` | String? | Nullable | User who last edited |
| `tags` | String[] | Default: [] | Tags for categorization |
| `isSystemCheck` | Boolean | Default: false | Cannot be deleted if true |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `checkId`
- `category`
- `enabled`
- `checkType`

---

### AIModelDefinition

**Table**: `ai_model_definitions`

Manages AI models used for URL analysis with rankings and consensus.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique model identifier |
| `modelId` | String | Unique | Model identifier (e.g., "claude-sonnet-4", "gpt-4o") |
| `name` | String | | Display name |
| `provider` | String | | Provider (anthropic, openai, google) |
| `description` | String? | Nullable | Model description |
| `modelEndpoint` | String? | Nullable | API endpoint |
| `modelVersion` | String? | Nullable | Version identifier |
| `contextWindow` | Int | Default: 200000 | Token context window |
| `apiKey` | String? | Nullable | Encrypted API key |
| `avgResponseTime` | Int | Default: 2000 | Average response time in ms |
| `reliability` | Float | Default: 0.95 | Reliability score (0.0-1.0) |
| `costPer1kTokens` | Float | Default: 0.003 | Cost in USD per 1k tokens |
| `enabled` | Boolean | Default: true | Whether model is enabled |
| `weight` | Float | Default: 1.0 | Weight in consensus (0.0-2.0) |
| `rank` | Int | Default: 1 | Priority ranking (1=highest) |
| `minConfidence` | Float | Default: 0.5 | Minimum confidence to use (0.0-1.0) |
| `useInConsensus` | Boolean | Default: true | Include in consensus voting |
| `tieBreaker` | Boolean | Default: false | Use as tie-breaker |
| `requiredForScan` | Boolean | Default: false | Scan fails if unavailable |
| `fallbackModelId` | String? | Nullable | Fallback model ID |
| `maxRequestsPerMin` | Int | Default: 60 | Rate limit |
| `maxConcurrentReqs` | Int | Default: 5 | Concurrent request limit |
| `cooldownOnError` | Int | Default: 5000 | Cooldown in ms after error |
| `capabilities` | String[] | Default: [] | Model capabilities |
| `supportsImages` | Boolean | Default: false | Image input support |
| `supportsStreaming` | Boolean | Default: false | Streaming support |
| `supportsJsonMode` | Boolean | Default: false | JSON mode support |
| `createdBy` | String? | Nullable | User who created config |
| `lastEditedBy` | String? | Nullable | User who last edited |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `modelId`
- `provider`
- `enabled`
- `rank` (priority ordering)

**Configured Models**:
1. Claude Sonnet 4.5 (rank 1, weight 1.5)
2. GPT-4o (rank 2, weight 1.2)
3. Gemini 1.5 Flash (rank 3, weight 1.0)

---

## ⚙️ Enterprise Configuration

### GlobalSetting

**Table**: `global_settings`

Manages ALL environment variables and global configuration, replacing hardcoded process.env calls.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique setting identifier |
| `key` | String | Unique | ENV variable name (e.g., "ANTHROPIC_API_KEY") |
| `value` | String? | Nullable | Setting value (encrypted if sensitive) |
| `category` | String | | Category (api_keys, database, services, features, performance, security) |
| `isSensitive` | Boolean | Default: false | If true, value is encrypted |
| `description` | String? | Nullable | Setting description |
| `validation` | String? | Nullable | Regex or JSON schema for validation |
| `required` | Boolean | Default: false | Whether setting is required |
| `isActive` | Boolean | Default: true | Whether setting is active |
| `environment` | String | Default: "all" | Environment (all, dev, staging, prod) |
| `version` | Int | Default: 1 | Version number |
| `previousValue` | String? | Nullable | Last value before update |
| `createdBy` | String? | Nullable | User who created setting |
| `lastEditedBy` | String? | Nullable | User who last edited |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `key`
- `category`
- `isActive`
- `environment`

**Categories**:
- `api_keys` - Third-party API keys (Anthropic, OpenAI, Google, VirusTotal, etc.)
- `database` - Database connection strings
- `services` - External service URLs (ChromaDB, Redis, etc.)
- `features` - Feature flags
- `performance` - Performance tuning (timeouts, caching, etc.)
- `security` - Security settings (JWT secrets, rate limits, etc.)

---

### MessageScanConfig

**Table**: `message_scan_configs`

Configures message scanning for scam/phishing detection.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique config identifier |
| `name` | String | | Config name |
| `description` | String? | Nullable | Config description |
| `isActive` | Boolean | Default: false | Whether config is active |
| `maxMessageLength` | Int | Default: 10000 | Max message length to scan |
| `minConfidence` | Float | Default: 0.7 | Minimum confidence threshold |
| `languageDetection` | Boolean | Default: true | Enable language detection |
| `supportedLanguages` | String[] | Default: ["en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko"] | Supported languages |
| `models` | String[] | Default: ["claude-sonnet-4.5", "gpt-4", "gemini-1.5-flash"] | AI models to use |
| `modelWeights` | Json | Default: {"claude": 0.35, "gpt4": 0.35, "gemini": 0.30} | Model weight distribution |
| `keywordRules` | Json | Default: {} | urgencyKeywords, scamKeywords, phishingKeywords |
| `regexPatterns` | Json | Default: {} | phoneNumbers, urls, emails patterns |
| `threatIntelEnabled` | Boolean | Default: true | Enable TI checking |
| `knownScamDatabaseEnabled` | Boolean | Default: true | Check against known scams |
| `timeout` | Int | Default: 30000 | Timeout in ms |
| `cacheEnabled` | Boolean | Default: true | Enable result caching |
| `cacheDuration` | Int | Default: 3600 | Cache duration in seconds |
| `asyncProcessing` | Boolean | Default: true | Enable async processing |
| `rateLimits` | Json | Default: {"free": 100, "basic": 500, "premium": 2000, "enterprise": 10000} | Rate limits by tier |
| `createdBy` | String? | Nullable | User who created config |
| `lastEditedBy` | String? | Nullable | User who last edited |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `isActive`
- `name`

---

### FileScanConfig

**Table**: `file_scan_configs`

Configures file scanning and OCR for document/image analysis.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique config identifier |
| `name` | String | Unique | Config name |
| `description` | String? | Nullable | Config description |
| `isActive` | Boolean | Default: false | Whether config is active |
| `allowedTypes` | String[] | Default: ["pdf", "png", "jpg", "jpeg", "docx", "txt"] | Allowed file types |
| `maxFileSizeFree` | Int | Default: 5242880 | Max file size for free tier (5MB) |
| `maxFileSizePro` | Int | Default: 26214400 | Max file size for pro tier (25MB) |
| `maxFileSizeEnterprise` | Int | Default: 104857600 | Max file size for enterprise (100MB) |
| `ocrEngine` | String | Default: "tesseract" | OCR engine (tesseract, google_vision, aws_textract) |
| `googleVisionApiKey` | String? | Nullable | Google Vision API key (encrypted) |
| `awsAccessKey` | String? | Nullable | AWS access key (encrypted) |
| `awsSecretKey` | String? | Nullable | AWS secret key (encrypted) |
| `ocrLanguages` | String[] | Default: ["eng"] | OCR languages |
| `ocrConfidence` | Float | Default: 0.8 | Minimum OCR confidence |
| `imagePreprocessing` | Boolean | Default: true | Enable image preprocessing |
| `deskewEnabled` | Boolean | Default: true | Enable deskewing |
| `noiseReduction` | Boolean | Default: true | Enable noise reduction |
| `piiDetection` | Boolean | Default: true | Enable PII detection |
| `piiPatterns` | Json | Default: [] | SSN, CC, passport patterns |
| `malwareScanning` | Boolean | Default: true | Enable malware scanning |
| `virusDbEnabled` | Boolean | Default: true | Use virus database |
| `aiModels` | String[] | Default: ["claude-sonnet-4.5", "gpt-4"] | AI models for content analysis |
| `modelWeights` | Json | Default: {"claude": 0.5, "gpt4": 0.5} | Model weights |
| `extractExif` | Boolean | Default: true | Extract EXIF metadata |
| `extractAuthor` | Boolean | Default: true | Extract author metadata |
| `extractGps` | Boolean | Default: true | Extract GPS coordinates |
| `timeout` | Int | Default: 60000 | Timeout for large files (60s) |
| `cacheEnabled` | Boolean | Default: true | Enable caching |
| `cacheDuration` | Int | Default: 3600 | Cache duration in seconds |
| `rateLimits` | Json | Default: {"free": 10, "basic": 50, "premium": 200, "enterprise": 1000} | Rate limits |
| `createdBy` | String? | Nullable | User who created config |
| `lastEditedBy` | String? | Nullable | User who last edited |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `isActive`
- `name`

---

## 🔐 Authentication & Security

### WebAuthnCredential

**Table**: `webauthn_credentials`

Stores WebAuthn credentials for passwordless authentication (passkeys).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique credential identifier |
| `userId` | String | FK | User ID |
| `credentialId` | String | Unique | Base64URL encoded credential ID |
| `publicKey` | String | | Base64URL encoded public key |
| `counter` | BigInt | Default: 0 | Signature counter for replay protection |
| `transports` | String[] | Default: [] | Supported transports (usb, nfc, ble, internal) |
| `aaguid` | String? | Nullable | Authenticator AAGUID |
| `credentialDeviceType` | String? | Nullable | Device type (singleDevice, multiDevice) |
| `credentialBackedUp` | Boolean | Default: false | Whether credential is backed up |
| `friendlyName` | String? | Nullable | User-defined name (e.g., "Touch ID on iPhone") |
| `lastUsedAt` | DateTime? | Nullable | Last usage timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `user` → `User` (N:1, Cascade delete)

**Indexes**:
- `userId` (user's credentials)
- `credentialId` (credential lookup)

**Supported Authenticators**:
- Apple Touch ID / Face ID
- Windows Hello
- YubiKey
- Google Titan Key
- Built-in platform authenticators

---

### RefreshToken

**Table**: `RefreshToken`

Stores JWT refresh tokens for session management.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique token identifier |
| `token` | String | Unique | Refresh token value |
| `userId` | String | | User ID |
| `expiresAt` | DateTime | | Token expiration timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `revokedAt` | DateTime? | Nullable | Revocation timestamp |

**Indexes**:
- `token` (token lookup)
- `userId` (user's tokens)
- `expiresAt` (expiration cleanup)

---

### ApiKey

**Table**: `api_keys`

Manages API keys for programmatic access.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique API key identifier |
| `name` | String | | API key name/label |
| `keyPrefix` | String | | Key prefix (first 8 chars, visible) |
| `hashedKey` | String | | Full hashed key (bcrypt) |
| `organizationId` | String | FK | Organization ID |
| `permissions` | Json | Default: [] | Array of permission strings |
| `rateLimit` | Int | Default: 1000 | Rate limit (requests/hour) |
| `expiresAt` | DateTime? | Nullable | Expiration timestamp |
| `lastUsedAt` | DateTime? | Nullable | Last usage timestamp |
| `isActive` | Boolean | Default: true | Whether key is active |
| `createdBy` | String | | User who created key |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `organizationId`
- `keyPrefix` (fast prefix matching)
- `hashedKey` (authentication)
- `isActive` (filter active keys)

---

## 📊 Audit & Analytics

### AuditLog

**Table**: `AuditLog`

Comprehensive audit trail for all platform actions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique log entry identifier |
| `action` | String | | Action performed (CREATE, UPDATE, DELETE, LOGIN, etc.) |
| `entityType` | String | | Entity type (User, ScanResult, Organization, etc.) |
| `entityId` | String? | Nullable | Entity ID affected |
| `details` | Json | Default: {} | Additional action details |
| `ipAddress` | String? | Nullable | Client IP address |
| `userAgent` | String? | Nullable | Client user agent |
| `timestamp` | DateTime | Auto | Action timestamp |
| `userId` | String? | Nullable, FK | User who performed action |
| `organizationId` | String? | Nullable, FK | Organization context |
| `scanResultId` | String? | Nullable, FK | Associated scan result |

**Relationships**:
- `user` → `User` (N:1)
- `organization` → `Organization` (N:1, Cascade delete)
- `scanResult` → `ScanResult` (N:1)

**Indexes**:
- `userId` (user activity)
- `organizationId` (organization activity)
- `action` (action type filtering)
- `entityType` (entity filtering)
- `timestamp` (time-based queries)

**Common Actions**:
- `USER_LOGIN`, `USER_LOGOUT`
- `SCAN_CREATE`, `SCAN_DELETE`
- `ORGANIZATION_UPDATE`
- `API_KEY_CREATE`, `API_KEY_REVOKE`
- `SETTINGS_UPDATE`

---

### ApiUsage

**Table**: `api_usage`

Tracks API usage for billing and analytics.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique usage record identifier |
| `organizationId` | String | | Organization ID |
| `userId` | String? | Nullable | User ID (if authenticated) |
| `endpoint` | String | | API endpoint called |
| `method` | String | | HTTP method (GET, POST, etc.) |
| `statusCode` | Int | | HTTP status code |
| `responseTime` | Int | | Response time in milliseconds |
| `ipAddress` | String? | Nullable | Client IP address |
| `userAgent` | String? | Nullable | Client user agent |
| `requestSize` | Int? | Nullable | Request size in bytes |
| `responseSize` | Int? | Nullable | Response size in bytes |
| `metadata` | Json | Default: {} | Additional metadata |
| `timestamp` | DateTime | Auto | Request timestamp |

**Indexes**:
- `organizationId` (organization usage)
- `userId` (user usage)
- `endpoint` (endpoint analytics)
- `timestamp` (time-based queries)
- `statusCode` (error analytics)

---

### AdminActivity

**Table**: `AdminActivity`

Tracks administrator actions for security auditing.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique activity identifier |
| `adminId` | String | | Admin user ID |
| `action` | String | | Action performed |
| `category` | String | | Category (users, settings, security, etc.) |
| `entityType` | String? | Nullable | Entity type affected |
| `entityId` | String? | Nullable | Entity ID |
| `changes` | Json | Default: {} | Before/after changes |
| `ipAddress` | String? | Nullable | Admin IP address |
| `userAgent` | String? | Nullable | Admin user agent |
| `timestamp` | DateTime | Auto | Action timestamp |

**Indexes**:
- `adminId` (admin activity)
- `action` (action filtering)
- `category` (category filtering)
- `timestamp` (time-based queries)

---

## 📚 Literacy & Recovery

### LiteracyQuizResult

**Table**: `LiteracyQuizResult`

Stores cybersecurity literacy quiz results.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique result identifier |
| `userId` | String | | User ID |
| `score` | Int | | Total score achieved |
| `totalQuestions` | Int | | Total questions in quiz |
| `correctAnswers` | Int | | Number of correct answers |
| `literacyLevel` | LiteracyLevel | | User's literacy level |
| `knowledgeGaps` | String[] | | Identified knowledge gaps |
| `answers` | Json | | Full answer details |
| `createdAt` | DateTime | Auto | Quiz completion timestamp |

**Indexes**:
- `userId` (user's quiz history)
- `literacyLevel` (level distribution)
- `createdAt` (time-based queries)

**Literacy Levels**:
- `beginner` - Basic cybersecurity awareness
- `intermediate` - Moderate knowledge
- `advanced` - Strong cybersecurity understanding

---

### LiteracyProgress

**Table**: `LiteracyProgress`

Tracks user progress through literacy lessons.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique progress identifier |
| `userId` | String | | User ID |
| `lessonId` | String | | Lesson ID |
| `completed` | Boolean | Default: false | Whether lesson is completed |
| `timeSpent` | Int | Default: 0 | Time spent in seconds |
| `completedAt` | DateTime? | Nullable | Completion timestamp |
| `createdAt` | DateTime | Auto | Progress start timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Unique Constraint**: `[userId, lessonId]` (one progress record per user per lesson)

**Indexes**:
- `userId` (user progress)
- `lessonId` (lesson analytics)
- `completed` (completion tracking)

---

### RecoveryIncident

**Table**: `RecoveryIncident`

Tracks scam victim recovery incidents.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique incident identifier |
| `userId` | String | | User ID |
| `scamType` | ScamType | | Type of scam |
| `description` | String | | Incident description |
| `financialLoss` | Float? | Nullable | Financial loss amount |
| `personalInfoShared` | String[] | | Types of personal info shared |
| `whenOccurred` | String? | Nullable | When incident occurred |
| `alreadyReported` | Boolean | Default: false | Whether already reported to authorities |
| `emotionalState` | String? | Nullable | User's emotional state |
| `distressLevel` | DistressLevel | Default: moderate | User's distress level |
| `suicidalIdeation` | Boolean | Default: false | Flag for critical mental health concern |
| `status` | IncidentStatus | Default: reported | Incident status |
| `recoveryPlanSteps` | Json | | Recovery plan steps |
| `createdAt` | DateTime | Auto | Incident report timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `followUps` → `RecoveryFollowUp[]` (1:N)

**Indexes**:
- `userId` (user's incidents)
- `scamType` (scam type analytics)
- `distressLevel` (prioritization)
- `suicidalIdeation` (critical cases)
- `status` (status filtering)
- `createdAt` (time-based queries)

**Scam Types**:
- `phishing`, `investment`, `romance`, `tech_support`, `lottery`, `employment`, `other`

**Distress Levels**:
- `low`, `moderate`, `high`, `severe`

**CRITICAL**: If `suicidalIdeation` is true, immediate mental health resources are provided.

---

### RecoveryFollowUp

**Table**: `RecoveryFollowUp`

Tracks follow-up actions for recovery incidents.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique follow-up identifier |
| `incidentId` | String | FK | Parent incident ID |
| `status` | IncidentStatus | | Current status |
| `notes` | String? | Nullable | Follow-up notes |
| `emotionalState` | String? | Nullable | User's emotional state |
| `distressLevel` | DistressLevel? | Nullable | User's distress level |
| `scheduledFor` | DateTime? | Nullable | Scheduled follow-up time |
| `completedAt` | DateTime? | Nullable | Follow-up completion timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |

**Relationships**:
- `incident` → `RecoveryIncident` (N:1, Cascade delete)

**Indexes**:
- `incidentId` (incident follow-ups)
- `scheduledFor` (upcoming follow-ups)
- `completedAt` (completion tracking)

---

## 🌐 Proxy Services

### ProxySession

**Table**: `ProxySession`

Tracks proxy browsing sessions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique session identifier |
| `userId` | String | | User ID |
| `sessionToken` | String | Unique, CUID | Session token |
| `targetUrl` | String | | Target URL being proxied |
| `status` | String | Default: "active" | Session status (active, disconnected, expired) |
| `requestCount` | Int | Default: 0 | Number of requests in session |
| `bytesTransferred` | BigInt | Default: 0 | Total bytes transferred |
| `startedAt` | DateTime | Auto | Session start timestamp |
| `endedAt` | DateTime? | Nullable | Session end timestamp |
| `lastActivityAt` | DateTime | Default: now | Last activity timestamp |
| `metadata` | Json | Default: {} | Additional session metadata |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Indexes**:
- `userId` (user sessions)
- `sessionToken` (session lookup)
- `status` (active sessions)
- `startedAt` (time-based queries)

---

### ProxyRequest

**Table**: `ProxyRequest`

Logs individual proxy requests.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique request identifier |
| `sessionToken` | String | | Parent session token |
| `requestUrl` | String | | Request URL |
| `method` | String | Default: "GET" | HTTP method |
| `statusCode` | Int? | Nullable | HTTP status code |
| `bytesTransferred` | BigInt | Default: 0 | Bytes transferred |
| `responseTime` | Int? | Nullable | Response time in milliseconds |
| `success` | Boolean | Default: true | Whether request succeeded |
| `errorMessage` | String? | Nullable | Error message if failed |
| `timestamp` | DateTime | Auto | Request timestamp |

**Indexes**:
- `sessionToken` (session requests)
- `timestamp` (time-based queries)

---

## 📐 Domain History & Intelligence

### DomainHistory

**Table**: `DomainHistory`

Tracks historical changes for domains to detect compromise risk.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique history record identifier |
| `domain` | String | | Domain name |
| `timestamp` | DateTime | Auto | Snapshot timestamp |
| `ipAddress` | String? | Nullable | IP address |
| `registrar` | String? | Nullable | Domain registrar |
| `whoisData` | Json? | Nullable | Full WHOIS data |
| `sslFingerprint` | String? | Nullable | SSL certificate fingerprint |
| `contentHash` | String? | Nullable | SHA-256 of homepage HTML |
| `pageTitle` | String? | Nullable | Page title |
| `technologies` | String[] | | Detected technologies (Wappalyzer-style) |
| `paymentMethods` | String[] | | Detected payment methods |
| `ownershipChange` | Boolean | Default: false | Ownership change detected |
| `contentChange` | Boolean | Default: false | Content change detected |
| `ipChange` | Boolean | Default: false | IP address change detected |
| `trafficSpike` | Boolean | Default: false | Traffic spike detected |
| `riskScore` | Int | Default: 0 | Calculated risk score |
| `anomalyScore` | Float | Default: 0.0 | Anomaly detection score |
| `createdAt` | DateTime | Auto | Creation timestamp |

**Indexes**:
- `domain, timestamp` (composite)
- `domain` (domain history)
- `timestamp` (time-series)

**Use Cases**:
- Detect domain hijacking
- Identify infrastructure changes
- Predictive scam scoring
- Historical risk analysis

---

### IntelligenceData

**Table**: `intelligence_data`

Captures all user activity for LLM training and analytics.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, CUID | Unique intelligence record identifier |
| `eventType` | String | | Event type (search, scan, interaction) |
| `userId` | String | | Anonymized user ID |
| `organizationId` | String? | Nullable | Organization ID |
| `data` | Json | | Full event data (JSONB searchable) |
| `riskScore` | Float? | Nullable | Associated risk score |
| `riskLevel` | String? | Nullable | Associated risk level |
| `timestamp` | DateTime | | Event timestamp |
| `createdAt` | DateTime | Auto | Creation timestamp |

**Indexes**:
- `eventType` (event filtering)
- `userId` (user analytics)
- `timestamp` (time-based queries)
- `riskLevel` (risk analytics)
- `organizationId` (organization analytics)
- `eventType, timestamp` (composite for efficient queries)

---

## 🔢 Enumerations

### OrganizationTier

```prisma
enum OrganizationTier {
  free
  pro
  enterprise
}
```

---

### UserRole

```prisma
enum UserRole {
  user    // Regular user
  admin   // Organization admin
  owner   // Organization owner
}
```

---

### ScanType

```prisma
enum ScanType {
  url      // Web page/link analysis
  message  // Text message scam detection
  file     // Document/image file scanning
}
```

---

### RiskLevel

```prisma
enum RiskLevel {
  safe      // 0-99 points
  low       // 100-199 points
  medium    // 200-299 points
  high      // 300-399 points
  critical  // 400+ points
}
```

---

### ScanStatus

```prisma
enum ScanStatus {
  pending     // Queued for processing
  processing  // Currently being scanned
  completed   // Scan completed successfully
  failed      // Scan failed
}
```

---

### DatasetStatus

```prisma
enum DatasetStatus {
  processing  // Being processed
  ready       // Ready for use
  failed      // Processing failed
}
```

---

### LiteracyLevel

```prisma
enum LiteracyLevel {
  beginner      // Basic cybersecurity awareness
  intermediate  // Moderate knowledge
  advanced      // Strong understanding
}
```

---

### ScamType

```prisma
enum ScamType {
  phishing      // Phishing/fake websites
  investment    // Investment scams
  romance       // Romance scams
  tech_support  // Tech support scams
  lottery       // Lottery/prize scams
  employment    // Fake job offers
  other         // Other scam types
}
```

---

### DistressLevel

```prisma
enum DistressLevel {
  low       // Low distress
  moderate  // Moderate distress
  high      // High distress
  severe    // Severe distress (requires immediate support)
}
```

---

### IncidentStatus

```prisma
enum IncidentStatus {
  reported     // Just reported
  in_progress  // Being handled
  resolved     // Resolved
  needs_help   // Requires additional support
}
```

---

### SubscriptionStatus

```prisma
enum SubscriptionStatus {
  active     // Active subscription
  expired    // Subscription expired
  cancelled  // Cancelled by user
  suspended  // Suspended (payment issue, etc.)
}
```

---

### SubscriptionPlan

```prisma
enum SubscriptionPlan {
  free              // Free tier
  premium_monthly   // Monthly premium
  premium_annual    // Annual premium (discount)
  enterprise        // Custom enterprise plan
}
```

---

### AuthProvider

```prisma
enum AuthProvider {
  local     // Email + password
  google    // Google OAuth
  facebook  // Facebook OAuth
  linkedin  // LinkedIn OAuth
  passkey   // WebAuthn passkey
}
```

---

### ReachabilityState

```prisma
enum ReachabilityState {
  ONLINE        // Full analysis available
  OFFLINE       // DNS/TCP/HTTP failed - passive only
  PARKED        // Parking page detected
  WAF_CHALLENGE // WAF/CAPTCHA detected
  SINKHOLE      // Sinkhole/takedown detected - auto-critical
}
```

---

## 📊 Indexes & Performance

### Critical Indexes for Performance

**High-Traffic Queries**:

1. **User Authentication**:
   - `User.email` (unique) - Login lookups
   - `User.googleId, facebookId, linkedinId` (unique) - OAuth lookups
   - `Organization.apiKey` (unique) - API authentication

2. **Scan Lookups**:
   - `ScanResult.userId` - User's scan history
   - `ScanResult.organizationId` - Organization scans
   - `ScanResult.contentHash` - Deduplication
   - `ScanResult.createdAt` - Recent scans

3. **Threat Intelligence**:
   - `ThreatIndicator.valueHash` - Fast TI lookups (200K+ indicators)
   - `ThreatIndicator.type, active` - Active indicator filtering
   - `ThreatIntelSource.enabled` - Active sources

4. **Caching**:
   - `ReachabilityCache.domain` (unique) - Domain reachability cache
   - `ThreatIntelligenceCache.[urlHash, source]` (unique) - TI result cache
   - `ReachabilityCache.expiresAt`, `ThreatIntelligenceCache.expiresAt` - Expiration cleanup

5. **Chatbot**:
   - `ChatSession.sessionToken` (unique) - Session lookup
   - `ChatMessage.sessionId` - Session messages
   - `KnowledgeBase.indexed, category` - RAG retrieval

**Composite Indexes**:
- `DomainHistory.[domain, timestamp]` - Time-series domain history
- `IntelligenceData.[eventType, timestamp]` - Event analytics

---

## 🔗 Relationships Diagram

### Core Entity Relationships

```
Organization (1) ──────< (N) User
     │                        │
     │                        │
     ├──< ScanResult >────────┤
     │         │              │
     │         └──< RiskCategory
     │
     ├──< Dataset ───< DatasetEntry
     ├──< AuditLog
     └──< Subscription (1:1)

User ──< WebAuthnCredential (Passkeys)
User ──< RefreshToken (JWT)

ScanResult ──< AuditLog

ThreatIntelSource (1) ───< (N) ThreatIndicator
ThreatIntelSource (1) ───< (N) ThreatFeedSync

ChatSession (1) ───< (N) ChatMessage

WhatsAppUser (1) ───< (N) WhatsAppMessage
WhatsAppMessage (1) ───< (N) WhatsAppMediaFile

RecoveryIncident (1) ───< (N) RecoveryFollowUp

ScanConfiguration (1) ───< (N) AdminUrlScan
ScanConfiguration (1) ───< (N) ScanConfigurationHistory
```

---

## 📈 Database Size Estimates

**Current Production Data** (as of 2025-10-24):

| Table | Estimated Rows | Size |
|-------|---------------|------|
| `threat_indicators` | 200,000+ | ~50MB |
| `chat_messages` | ~10,000 | ~5MB |
| `scan_results` | ~5,000 | ~10MB |
| `audit_logs` | ~20,000 | ~8MB |
| `api_usage` | ~50,000 | ~15MB |
| `whatsapp_messages` | ~2,000 | ~3MB |
| **Total Database** | ~287,000+ | **~150MB** |

**Growth Projections**:
- Threat indicators: +10,000/month (auto-synced)
- Scan results: +500/day in production
- Chat messages: +200/day
- API usage: +1,000/day

---

## 🎯 Schema Highlights

**Enterprise Features**:
✅ Multi-tenancy (Organization isolation)
✅ RBAC (Role-Based Access Control)
✅ Comprehensive audit logging
✅ API key management
✅ Webhook support
✅ Rate limiting configuration
✅ Subscription management with Stripe

**AI/ML Integration**:
✅ AI model configuration and consensus
✅ RAG (Retrieval-Augmented Generation) with ChromaDB
✅ Multiple AI provider support (Anthropic, OpenAI, Google)
✅ Training data management

**Security**:
✅ WebAuthn/Passkey support
✅ Multi-provider OAuth (Google, Facebook, LinkedIn)
✅ JWT with refresh tokens
✅ Encrypted sensitive fields
✅ Comprehensive security audit trail

**Threat Intelligence**:
✅ 18+ threat intelligence sources
✅ 200K+ threat indicators
✅ Auto-sync with caching
✅ Configurable weights and priorities

**Advanced Scanning**:
✅ 570-point scoring system
✅ 17 risk categories
✅ 100+ individual security checks
✅ Reachability detection (ONLINE, OFFLINE, PARKED, WAF, SINKHOLE)
✅ AI-powered verdict consensus

---

## 📚 Additional Resources

- **Prisma Schema**: `packages/backend/prisma/schema.prisma`
- **Database Architecture**: `docs/architecture/database/architecture.md`
- **Migrations**: `packages/backend/prisma/migrations/`
- **Seed Data**: `packages/backend/prisma/seed.ts`

---

**Document Maintained By**: Platform Team
**Review Frequency**: Quarterly or with major schema changes
**Last Schema Migration**: 2025-10-20
**Next Planned Changes**: None (production stable)
