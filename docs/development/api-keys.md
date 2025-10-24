# API Keys Setup Guide - Elara Platform

This guide helps you obtain **FREE API keys** for all external threat intelligence services.

---

## 🔑 Required API Keys (All FREE Tiers Available)

### 1. VirusTotal API Key ⭐ **RECOMMENDED**
**What it does:** Scans URLs against 89+ antivirus engines

**How to get:**
1. Go to: https://www.virustotal.com/gui/join-us
2. Sign up with email (or Google/GitHub)
3. Verify your email
4. Go to: https://www.virustotal.com/gui/user/YOUR_USERNAME/apikey
5. Copy your API key

**Free Tier:**
- 500 requests/day
- 4 requests/minute

**Add to `.env`:**
```env
VIRUSTOTAL_API_KEY="your_virustotal_api_key_here"
```

---

### 2. Google Safe Browsing API Key ⭐ **RECOMMENDED**
**What it does:** Checks URLs against Google's phishing/malware database

**How to get:**
1. Go to: https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable "Safe Browsing API":
   - Go to: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com
   - Click "Enable"
4. Create credentials:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "API Key"
   - Copy your API key
   - (Optional) Restrict key to "Safe Browsing API" only

**Free Tier:**
- 10,000 requests/day
- Unlimited requests/minute

**Add to `.env`:**
```env
GOOGLE_SAFE_BROWSING_API_KEY="your_google_api_key_here"
```

---

### 3. AbuseIPDB API Key
**What it does:** Checks IP reputation and abuse reports

**How to get:**
1. Go to: https://www.abuseipdb.com/register
2. Sign up with email
3. Verify your email
4. Go to: https://www.abuseipdb.com/account/api
5. Copy your API key

**Free Tier:**
- 1,000 checks/day
- Unlimited requests/minute

**Add to `.env`:**
```env
ABUSEIPDB_API_KEY="your_abuseipdb_api_key_here"
```

---

### 4. PhishTank API Key (Optional)
**What it does:** Checks against known phishing URL database

**How to get:**
1. Go to: https://www.phishtank.com/register.php
2. Sign up with email
3. Verify your email
4. Go to: https://www.phishtank.com/api_info.php
5. Request an application key
6. Wait for approval (usually within 24 hours)

**Free Tier:**
- Rate limited (varies)
- Community database

**Note:** Elara currently works WITHOUT PhishTank API key (falls back gracefully)

---

### 5. URLhaus (No API Key Required) ✅
**What it does:** Checks malware distribution URLs

**Free to use:** No registration required
- Already working in Elara!

---

## 🤖 AI Model API Keys (For Multi-LLM Analysis)

### 1. Anthropic API Key (Claude) ⭐ **RECOMMENDED**
**How to get:**
1. Go to: https://console.anthropic.com/
2. Sign up
3. Go to API Keys section
4. Create new key

**Pricing:**
- Pay as you go
- ~$3 per 1M input tokens
- Claude Sonnet 4.5 used in Elara

**Add to `.env`:**
```env
ANTHROPIC_API_KEY="your_anthropic_api_key_here"
```

---

### 2. OpenAI API Key (GPT-4)
**How to get:**
1. Go to: https://platform.openai.com/signup
2. Sign up
3. Add payment method
4. Go to: https://platform.openai.com/api-keys
5. Create new secret key

**Pricing:**
- Pay as you go
- ~$5 per 1M input tokens (GPT-4)
- ~$0.15 per 1M input tokens (GPT-3.5)

**Add to `.env`:**
```env
OPENAI_API_KEY="your_openai_api_key_here"
```

---

### 3. Google AI API Key (Gemini)
**How to get:**
1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Get API Key"
4. Create API key

**Free Tier:**
- 60 requests/minute
- Gemini Pro is free!

**Add to `.env`:**
```env
GOOGLE_AI_API_KEY="your_google_ai_api_key_here"
```

---

## 📝 Complete .env File Example

```env
# ============================================
# EXTERNAL THREAT INTELLIGENCE API KEYS
# ============================================

# VirusTotal (89+ antivirus engines)
# Get key: https://www.virustotal.com/gui/user/YOUR_USERNAME/apikey
VIRUSTOTAL_API_KEY="your_virustotal_api_key_here"

# Google Safe Browsing
# Get key: https://console.cloud.google.com/apis/credentials
GOOGLE_SAFE_BROWSING_API_KEY="your_google_api_key_here"

# AbuseIPDB (IP reputation)
# Get key: https://www.abuseipdb.com/account/api
ABUSEIPDB_API_KEY="your_abuseipdb_api_key_here"

# ============================================
# AI MODEL API KEYS (Multi-LLM Analysis)
# ============================================

# Anthropic Claude Sonnet 4.5
# Get key: https://console.anthropic.com/
ANTHROPIC_API_KEY="your_anthropic_api_key_here"

# OpenAI GPT-4
# Get key: https://platform.openai.com/api-keys
OPENAI_API_KEY="your_openai_api_key_here"

# Google Gemini Pro
# Get key: https://makersuite.google.com/app/apikey
GOOGLE_AI_API_KEY="your_google_ai_api_key_here"
```

---

## 🚀 Quick Start (Minimum Setup)

**To get basic threat intelligence working immediately:**

1. **VirusTotal** (Most important - 89 antivirus engines)
   - Sign up: https://www.virustotal.com/gui/join-us
   - Get key: https://www.virustotal.com/gui/user/YOUR_USERNAME/apikey

2. **Google Safe Browsing** (Google's phishing database)
   - Enable API: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com
   - Get key: https://console.cloud.google.com/apis/credentials

These 2 keys will give you **robust URL scanning** with 89+ engines + Google's database.

---

## 🔄 After Adding API Keys

1. **Update `.env` file** in `D:\Elara_MVP\elara-platform\packages\backend\.env`

2. **Restart backend:**
   - Stop current backend (Ctrl+C)
   - Run: `pnpm dev`
   - Or use: `START-ALL.ps1`

3. **Test URL scan:**
   - Go to: http://localhost:5173
   - Try scanning: `http://example.com`
   - Check "External Threat Intelligence" section

---

## 📊 What Each Service Provides

| Service | What It Checks | Free Tier | Response Time |
|---------|---------------|-----------|---------------|
| **VirusTotal** | 89+ antivirus engines | 500/day | ~2-3 seconds |
| **Google Safe Browsing** | Phishing/malware DB | 10,000/day | ~200-500ms |
| **AbuseIPDB** | IP reputation | 1,000/day | ~300-800ms |
| **PhishTank** | Known phishing URLs | Limited | ~500ms-1s |
| **URLhaus** | Malware distribution | Unlimited | ~400-600ms |

---

## ❌ Graceful Degradation

**Without API keys**, Elara will:
- ✅ Still work for URL scanning
- ✅ Show "UNAVAILABLE" for services without keys
- ✅ Use 13 built-in technical checks
- ✅ Use AI analysis (if AI keys configured)
- ✅ URLhaus and PhishTank work without keys (rate limited)

**With API keys**, you get:
- ✅ 89+ antivirus engine verdicts (VirusTotal)
- ✅ Google's global phishing database
- ✅ IP reputation scoring
- ✅ Comprehensive threat intelligence
- ✅ Higher confidence scores

---

## 🛡️ Security Best Practices

1. **Never commit API keys to Git**
   - `.env` file is already in `.gitignore`

2. **Rotate keys periodically**
   - Most services allow creating multiple keys

3. **Use environment variables**
   - Keep keys in `.env` file only

4. **Monitor usage**
   - Check API dashboards for usage limits

---

## 🐛 Troubleshooting

### "UNAVAILABLE" Status
- **Cause:** API key not configured or empty
- **Fix:** Add API key to `.env` and restart backend

### "ERROR" Status
- **Cause:** Invalid API key, rate limit exceeded, or network issue
- **Fix:** Check API key validity, check rate limits, check network

### URLhaus "ERROR"
- **Cause:** Possible rate limiting or network issue
- **Fix:** Usually temporary, will resolve on retry

### PhishTank "UNAVAILABLE"
- **Cause:** No API key (optional service)
- **Fix:** Not required for core functionality

---

## 💰 Cost Estimates

**For 1,000 URL scans per month:**

| Service | Cost | Notes |
|---------|------|-------|
| VirusTotal | $0 | Free tier (500/day) |
| Google Safe Browsing | $0 | Free tier (10k/day) |
| AbuseIPDB | $0 | Free tier (1k/day) |
| PhishTank | $0 | Free (rate limited) |
| URLhaus | $0 | Free unlimited |
| **Total Infrastructure** | **$0/month** | ✅ Completely free |
| | | |
| Claude API | ~$3-5 | Pay per use |
| OpenAI API | ~$5-10 | Pay per use |
| Gemini API | $0 | Free! |
| **Total AI** | **~$8-15/month** | For 1,000 scans |

**Most affordable setup:** Use Gemini (free) + VirusTotal (free) + Google Safe Browsing (free) = **$0/month**

---

## 📞 Support Links

- **VirusTotal:** https://support.virustotal.com/
- **Google Safe Browsing:** https://developers.google.com/safe-browsing
- **AbuseIPDB:** https://www.abuseipdb.com/faq
- **Anthropic:** https://docs.anthropic.com/
- **OpenAI:** https://help.openai.com/
- **Google AI:** https://ai.google.dev/docs

---

**Last Updated:** 2025-10-05
