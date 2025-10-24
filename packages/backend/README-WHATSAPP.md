# 📱 ELARA WHATSAPP INTEGRATION

**Complete production-ready WhatsApp bot for threat scanning via Twilio**

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Database Setup](#database-setup)
8. [Testing Locally](#testing-locally)
9. [Deployment](#deployment)
10. [API Endpoints](#api-endpoints)
11. [Message Flow](#message-flow)
12. [Security](#security)
13. [Troubleshooting](#troubleshooting)

---

## 🎯 OVERVIEW

The Elara WhatsApp integration allows users to scan suspicious messages, URLs, and content directly through WhatsApp without requiring registration or login.

**User Experience:**
1. User sends suspicious message to Elara WhatsApp number
2. Elara scans content using AI-powered threat detection
3. User receives instant security analysis with risk level
4. All scans tracked with rate limits (5/day for free tier)

---

## ✨ FEATURES

### Core Capabilities
- ✅ **Auto-Onboarding** - New users automatically registered on first message
- ✅ **Message Scanning** - AI-powered analysis of text content
- ✅ **URL Scanning** - Parallel scanning of up to 5 URLs per message
- ✅ **Rate Limiting** - Tier-based limits (Free: 5/day, Premium: 50/day, Enterprise: Unlimited)
- ✅ **Welcome Messages** - Automated onboarding for new users
- ✅ **Mobile-Optimized** - Emoji-rich, formatted responses under 1600 chars
- ✅ **Security** - Twilio signature validation, CSRF protection
- ✅ **Analytics** - Complete tracking of messages, users, threats blocked

### Advanced Features
- **Parallel Processing** - Multiple API calls executed simultaneously
- **Token Management** - Automatic Elara API authentication with refresh
- **Error Handling** - Graceful degradation with user-friendly error messages
- **Logging** - Comprehensive Winston logging for debugging
- **Database Tracking** - All messages and scans stored for analysis

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────┐
│         WHATSAPP USER                   │
│   (Sends suspicious message)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         TWILIO WEBHOOK                  │
│  POST /api/webhook/whatsapp             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    VALIDATE TWILIO SIGNATURE            │
│  (HMAC-SHA1 verification)               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      AUTO-ONBOARD USER                  │
│  (Get/create WhatsAppUser)              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      CHECK RATE LIMIT                   │
│  (5 messages/day for free tier)         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   LOGIN TO ELARA (Get Bearer Token)     │
│  (Cached for 25 minutes)                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    EXTRACT URLs & PROCESS               │
│  - Extract URLs with regex              │
│  - Validate and deduplicate             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    CALL ELARA APIs (PARALLEL)           │
│  1. POST /v2/scan/message               │
│  2. POST /v2/scan/url (for each URL)    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    AGGREGATE RESULTS                    │
│  (Determine overall risk level)         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    FORMAT FOR WHATSAPP                  │
│  (Emoji-rich, mobile-friendly)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    SEND VIA TWILIO API                  │
│  (WhatsApp message back to user)        │
└─────────────────────────────────────────┘
```

---

## 📦 PROJECT STRUCTURE

```
packages/backend/src/
├── services/whatsapp/
│   ├── elara-auth.service.ts        # Elara API authentication
│   ├── user-manager.service.ts      # User auto-onboarding
│   ├── rate-limiter.service.ts      # Tier-based rate limiting
│   ├── url-extractor.service.ts     # URL extraction & validation
│   ├── message-processor.service.ts # Message scanning orchestration
│   ├── response-formatter.service.ts # WhatsApp message formatting
│   ├── twilio-sender.service.ts     # Send WhatsApp messages
│   └── webhook-handler.service.ts   # Main webhook orchestrator
│
├── controllers/
│   └── whatsapp-webhook.controller.ts
│
├── routes/
│   └── index.ts                     # Route registration
│
└── prisma/schema.prisma             # Database models
```

---

## 📝 PREREQUISITES

### 1. Twilio Account Setup

**Step 1: Create Twilio Account**
- Go to https://www.twilio.com/try-twilio
- Sign up for free trial ($15 credit included)
- Verify your email and phone number

**Step 2: Get Credentials**
- Log in to https://console.twilio.com/
- Find your **Account SID** and **Auth Token** on the dashboard
- Copy both credentials

**Step 3: Enable WhatsApp Sandbox**
- Go to: Messaging → Try it out → Send a WhatsApp message
- Follow instructions to join the sandbox:
  1. Open WhatsApp on your phone
  2. Send the join code to +1 415-523-8886
  3. Example: `join <your-code>`
- Your WhatsApp number: `whatsapp:+14155238886`

### 2. Elara Bot Account

You need a dedicated Elara account for the WhatsApp bot:
- Email: `elara-bot@yourdomain.com` (or use test@example.com)
- Password: Strong password
- This account will authenticate with Elara APIs

### 3. Production Database

- PostgreSQL database (already configured in your Render backend)
- Accessible connection string

---

## 🚀 INSTALLATION

### Step 1: Install Dependencies

```bash
cd D:\Elara_MVP\elara-platform\packages\backend
pnpm install
```

This will install Twilio SDK (`twilio@^4.20.0`)

### Step 2: Run Database Migration

```bash
npx prisma migrate dev --name add_whatsapp_integration
```

This creates:
- `whatsapp_users` table
- `whatsapp_messages` table

---

## ⚙️ CONFIGURATION

### Environment Variables

Your `.env` file already has WhatsApp configuration. Verify these values:

```bash
# Elara API Configuration
ELARA_API_BASE_URL="https://elara-backend-64tf.onrender.com/api"
ELARA_BOT_EMAIL="test@example.com"
ELARA_BOT_PASSWORD="TestPassword123!"

# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID_HERE"
TWILIO_AUTH_TOKEN="3bd33f3cfd18d475b7d26554932e201b"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"

# Rate Limiting
WHATSAPP_FREE_TIER_DAILY_LIMIT=5
WHATSAPP_PREMIUM_TIER_DAILY_LIMIT=50
WHATSAPP_ENTERPRISE_TIER_DAILY_LIMIT=-1

# Encryption
WHATSAPP_ENCRYPTION_KEY="98C2C90D066C791C89D3972118B44AAFA19C655276D1BAC10F57BCE53EB3B564"

# Webhook URL (Render backend)
WEBHOOK_BASE_URL="https://elara-backend-64tf.onrender.com"
```

---

## 🗄️ DATABASE SETUP

### Tables Created

#### `whatsapp_users`
Stores WhatsApp user information with rate limiting.

| Column            | Type     | Description                    |
|-------------------|----------|--------------------------------|
| id                | String   | Primary key (cuid)             |
| phoneNumber       | String   | WhatsApp phone number (unique) |
| displayName       | String   | User's display name            |
| tier              | String   | free/premium/enterprise        |
| dailyMessageLimit | Int      | Messages per day limit         |
| messagesUsed      | Int      | Messages used today            |
| lastResetAt       | DateTime | Last rate limit reset          |
| totalMessages     | Int      | Total messages ever sent       |
| threatsBlocked    | Int      | Total threats detected         |
| isActive          | Boolean  | Account active status          |
| onboardedAt       | DateTime | When user was created          |

#### `whatsapp_messages`
Stores all incoming messages and scan results.

| Column         | Type     | Description                      |
|----------------|----------|----------------------------------|
| id             | String   | Primary key (cuid)               |
| userId         | String   | Foreign key to whatsapp_users    |
| messageSid     | String   | Twilio message SID (unique)      |
| messageBody    | String   | Message text content             |
| mediaCount     | Int      | Number of media attachments      |
| riskLevel      | String   | safe/low/medium/high/critical    |
| overallScore   | Int      | Overall risk score (0-100)       |
| processingTime | Int      | Processing time in milliseconds  |
| status         | String   | received/processed/failed        |
| errorMessage   | String   | Error message if failed          |
| processedAt    | DateTime | When processing completed        |

---

## 🧪 TESTING LOCALLY

### Step 1: Start Local Server

```bash
cd packages/backend
npm run dev
```

Server starts on `http://localhost:3001`

### Step 2: Expose Local Server with ngrok

```bash
# Install ngrok (if not installed)
npm install -g ngrok

# Expose local server
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 3: Configure Twilio Webhook

1. Go to: https://console.twilio.com/
2. Navigate to: Messaging → WhatsApp Sandbox Settings
3. Under "WHEN A MESSAGE COMES IN":
   - URL: `https://abc123.ngrok.io/api/webhook/whatsapp`
   - Method: `POST`
4. Click "Save"

### Step 4: Test End-to-End

**Test 1: Welcome Message**
```
Open WhatsApp
Send to: +1 415-523-8886
Message: "Hello Elara"

Expected Response:
👋 Welcome!
✅ Your Elara account is activated!
...
```

**Test 2: Safe Message**
```
Message: "How are you doing today?"

Expected Response:
✅ ELARA SECURITY SCAN
Risk Level: SAFE
...
```

**Test 3: URL Scan**
```
Message: "Is this safe? https://google.com"

Expected Response:
✅ ELARA SECURITY SCAN
Risk Level: SAFE
📄 Message Analysis
🔗 URLs Detected (1)
...
```

**Test 4: Rate Limiting**
```
Send 6 messages rapidly

6th message response:
⏳ DAILY LIMIT REACHED
You've used all 5 scans for today.
...
```

---

## 🚀 DEPLOYMENT

### Option A: Deploy to Existing Render Backend (Recommended)

Your WhatsApp integration is already added to the existing Render backend.

**Step 1: Push to GitHub**
```bash
cd D:\Elara_MVP\elara-platform
git add .
git commit -m "feat: Add WhatsApp integration with Twilio"
git push origin main
```

**Step 2: Render Auto-Deploys**
- Render detects the push and redeploys automatically
- Wait 3-5 minutes for deployment

**Step 3: Configure Twilio for Production**
1. Go to: https://console.twilio.com/
2. Navigate to: Messaging → WhatsApp Sandbox Settings
3. Update webhook URL:
   - URL: `https://elara-backend-64tf.onrender.com/api/webhook/whatsapp`
   - Method: `POST`
4. Save

**Step 4: Test Production**
- Send test message via WhatsApp
- Should receive response from production server

### Option B: Separate Service on Render

If you prefer a dedicated service for WhatsApp:

**Step 1: Create New Web Service**
- Repository: Your GitHub repo
- Branch: `main`
- Root Directory: `packages/backend`
- Build Command: `pnpm install && npx prisma generate`
- Start Command: `pnpm start`

**Step 2: Add Environment Variables**
Copy all variables from current Render service + WhatsApp-specific ones.

**Step 3: Configure Twilio**
Point webhook to new service URL.

---

## 📡 API ENDPOINTS

### WhatsApp Webhook Endpoints

#### POST `/api/webhook/whatsapp`
**Description:** Main webhook endpoint for Twilio

**Request (from Twilio):**
```
Form Data:
- From: whatsapp:+1234567890
- Body: Message text
- ProfileName: User's name
- MessageSid: Twilio message ID
- NumMedia: Number of media files
```

**Response:** 200 OK (immediately)

**Processing:** Async (after 200 OK sent)

---

#### GET `/api/webhook/whatsapp/health`
**Description:** Health check for WhatsApp service

**Response:**
```json
{
  "status": "ok",
  "service": "whatsapp-webhook",
  "timestamp": "2025-10-11T...",
  "database": "connected",
  "twilio": "connected"
}
```

---

#### GET `/api/webhook/whatsapp/status`
**Description:** Service status

**Response:**
```json
{
  "service": "whatsapp-webhook",
  "status": "running",
  "timestamp": "2025-10-11T...",
  "version": "1.0.0"
}
```

---

## 📋 MESSAGE FLOW

### 1. User Sends Message
```
WhatsApp User → Twilio → Elara Backend
```

### 2. Webhook Receives & Validates
```typescript
// Validate Twilio signature (HMAC-SHA1)
if (!validateSignature(request)) {
  return 403 Forbidden
}
```

### 3. Auto-Onboard User
```typescript
// Get or create WhatsAppUser
const user = await getOrCreateUser(phoneNumber, displayName)

// If new user, send welcome message
if (user.totalMessages === 0) {
  await sendWelcomeMessage(phoneNumber)
}
```

### 4. Rate Limit Check
```typescript
// Check if user exceeded daily limit
if (user.messagesUsed >= user.dailyMessageLimit) {
  await sendRateLimitMessage(phoneNumber)
  return
}
```

### 5. Authenticate with Elara
```typescript
// Login to Elara (cached for 25 min)
const token = await elaraAuthService.getToken()
```

### 6. Extract & Scan
```typescript
// Extract URLs
const urls = urlExtractor.extractURLs(messageBody)

// Scan in parallel
const [textResult, ...urlResults] = await Promise.all([
  scanMessage(messageBody),
  ...urls.map(url => scanURL(url))
])
```

### 7. Aggregate & Format
```typescript
// Determine overall risk
const { overallRisk, overallScore } = aggregateRisks(textResult, urlResults)

// Format for WhatsApp
const response = formatResponse(overallRisk, overallScore, ...)
```

### 8. Send Response
```typescript
// Send via Twilio
await twilioSender.sendMessage(phoneNumber, response)
```

---

## 🔒 SECURITY

### Implemented Security Measures

1. **Twilio Signature Validation**
   - HMAC-SHA1 verification of all webhooks
   - Prevents spoofed requests
   - Rejects invalid signatures with 403

2. **Rate Limiting**
   - Tier-based limits (5/day, 50/day, unlimited)
   - 24-hour rolling window
   - Prevents abuse

3. **Token Management**
   - Elara Bearer tokens cached for 25 minutes
   - Automatic token refresh
   - Prevents token leakage

4. **URL Validation**
   - Rejects localhost and private IPs
   - Validates URL format
   - Max 5 URLs per message

5. **Error Handling**
   - No sensitive data in error messages
   - User-friendly error responses
   - Comprehensive logging

6. **Database Security**
   - Parameterized queries (Prisma)
   - SQL injection prevention
   - Audit trail for all operations

---

## 🐛 TROUBLESHOOTING

### Issue: "Invalid Twilio Signature"

**Symptoms:** Webhook returns 403 Forbidden

**Causes:**
- Incorrect Twilio Auth Token in .env
- Using HTTP instead of HTTPS
- Proxy or reverse proxy interfering

**Solutions:**
1. Verify `TWILIO_AUTH_TOKEN` matches Twilio console
2. Ensure webhook URL uses HTTPS (required by Twilio)
3. Check Render/ngrok proxy settings

---

### Issue: "Rate Limit Reached"

**Symptoms:** User gets rate limit message before hitting limit

**Causes:**
- `lastResetAt` not resetting after 24 hours
- Incorrect tier configuration

**Solutions:**
1. Check user's `lastResetAt` in database
2. Verify tier limits in .env
3. Manually reset: `UPDATE whatsapp_users SET messagesUsed = 0, lastResetAt = NOW() WHERE phoneNumber = '...'`

---

### Issue: "Elara Login Failed"

**Symptoms:** Logs show "Elara login failed: 401"

**Causes:**
- Incorrect bot credentials
- Bot account doesn't exist
- API endpoint changed

**Solutions:**
1. Verify `ELARA_BOT_EMAIL` and `ELARA_BOT_PASSWORD`
2. Test login manually:
   ```bash
   curl -X POST https://elara-backend-64tf.onrender.com/api/v2/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"TestPassword123!"}'
   ```
3. Check API logs on Render

---

### Issue: "No Response from Bot"

**Symptoms:** User sends message but receives nothing

**Causes:**
- Webhook not configured
- Server crashed
- Twilio credentials invalid

**Solutions:**
1. Check Twilio webhook configuration
2. Check server logs on Render
3. Test health endpoint: `GET https://elara-backend-64tf.onrender.com/api/webhook/whatsapp/health`

---

### Issue: "Scan Timeout"

**Symptoms:** User gets "Analysis timeout" message

**Causes:**
- Elara API slow response
- Network issues
- Large number of URLs

**Solutions:**
1. Reduce number of URLs (limit is 5)
2. Check Elara API health
3. Increase timeout in message-processor.service.ts

---

## 📊 MONITORING & ANALYTICS

### Database Queries

**Active Users:**
```sql
SELECT COUNT(*) FROM whatsapp_users WHERE "isActive" = true;
```

**Today's Messages:**
```sql
SELECT COUNT(*) FROM whatsapp_messages WHERE "createdAt" >= CURRENT_DATE;
```

**Threats Blocked:**
```sql
SELECT SUM("threatsBlocked") FROM whatsapp_users;
```

**Top Users:**
```sql
SELECT "phoneNumber", "totalMessages", "threatsBlocked"
FROM whatsapp_users
ORDER BY "totalMessages" DESC
LIMIT 10;
```

---

## 🎯 NEXT STEPS

### Enhancements to Consider

1. **File Scanning** - Add support for image/document scanning
2. **Multi-language** - Support messages in different languages
3. **Premium Tiers** - Implement subscription system
4. **Analytics Dashboard** - Admin panel for WhatsApp analytics
5. **Automated Reports** - Daily/weekly threat reports
6. **User Profiles** - Allow users to view their scan history

---

## 📞 SUPPORT

### Getting Help

**Check Logs:**
- Render Dashboard → Your service → Logs
- Look for `[WhatsApp*]` prefixed messages

**Test Endpoints:**
```bash
# Health check
curl https://elara-backend-64tf.onrender.com/api/webhook/whatsapp/health

# Status
curl https://elara-backend-64tf.onrender.com/api/webhook/whatsapp/status
```

**Contact:**
- GitHub Issues: (your repo)
- Email: support@yourdomain.com

---

## ✅ SUCCESS CRITERIA

WhatsApp integration is working when:

- ✅ New users receive welcome message
- ✅ Text message scanning works
- ✅ URL extraction and scanning works
- ✅ Multiple URLs scanned correctly
- ✅ Rate limiting enforced (6th message blocked)
- ✅ Responses arrive within 30 seconds
- ✅ No crashes or 500 errors
- ✅ Twilio signature validation passing
- ✅ Database tracking all messages

---

**🚀 You're all set! Start testing your WhatsApp integration now!**
