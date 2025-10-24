# Elara Platform - Production Deployment Guide

This guide provides comprehensive instructions for deploying the Elara platform to production using Vercel (frontend) and Render.com (backend).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [One-Click Deployment](#one-click-deployment)
- [Manual Deployment](#manual-deployment)
- [Environment Variables](#environment-variables)
- [Verification Steps](#verification-steps)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

---

## Prerequisites

Before deploying, ensure you have:

### Required Accounts
- [x] **GitHub Account** - For repository hosting
- [x] **Vercel Account** - For frontend hosting (free tier available)
- [x] **Render.com Account** - For backend hosting (free tier available)

### Required Tools
- [x] **Git** - Version control ([Download](https://git-scm.com/))
- [x] **Node.js 18+** - Runtime environment ([Download](https://nodejs.org/))
- [x] **pnpm** - Package manager (`npm install -g pnpm`)
- [x] **Vercel CLI** - Deployment tool (`npm install -g vercel`)

### Required API Keys
You'll need API keys for the following services:

| Service | Required | Purpose | Get API Key |
|---------|----------|---------|-------------|
| Anthropic (Claude) | Yes | AI threat analysis | [anthropic.com](https://console.anthropic.com/) |
| OpenAI | Yes | AI threat analysis | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google AI (Gemini) | Yes | AI threat analysis | [ai.google.dev](https://ai.google.dev/) |
| VirusTotal | Yes | Malware scanning | [virustotal.com](https://www.virustotal.com/gui/join-us) |
| Google Safe Browsing | Yes | Phishing detection | [developers.google.com](https://developers.google.com/safe-browsing/v4/get-started) |
| AbuseIPDB | Yes | IP reputation | [abuseipdb.com](https://www.abuseipdb.com/api) |
| HuggingFace | Optional | Additional AI models | [huggingface.co](https://huggingface.co/settings/tokens) |
| Grok | Optional | Additional AI analysis | [x.ai](https://x.ai/) |
| Abstract API | Optional | IP geolocation | [abstractapi.com](https://www.abstractapi.com/) |

---

## Architecture Overview

The Elara platform consists of two main components:

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel (Frontend - React + Vite)           │
│           https://elara-platform.vercel.app             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│          Render.com (Backend - Express + Node.js)       │
│         https://elara-backend.onrender.com              │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  PostgreSQL Database (Render Free Tier)        │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## One-Click Deployment

We provide automated deployment scripts for both Windows and Unix-based systems.

### Windows (PowerShell)

```powershell
# Run from the project root
.\deploy-production.ps1
```

### Linux / macOS (Bash)

```bash
# Run from the project root
chmod +x deploy-production.sh
./deploy-production.sh
```

### What the Scripts Do

1. **Check Prerequisites** - Verify all required tools are installed
2. **Guide Backend Setup** - Provide instructions for Render.com deployment
3. **Update Environment** - Configure frontend with backend URL
4. **Deploy Frontend** - Build and deploy to Vercel
5. **Save URLs** - Store deployment URLs in `PRODUCTION_URLS.txt`

---

## Manual Deployment

If you prefer to deploy manually or the automated script fails, follow these steps:

### Step 1: Prepare Your Repository

```bash
# Ensure all changes are committed
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### Step 2: Deploy Backend to Render.com

1. **Login to Render.com**
   - Go to [https://dashboard.render.com/](https://dashboard.render.com/)
   - Sign in with your GitHub account

2. **Create New Blueprint**
   - Click **"New +"** → **"Blueprint"**
   - Connect your GitHub repository
   - Select the repository containing Elara platform
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables**
   - Add all required API keys (see [Environment Variables](#environment-variables))
   - The `render.yaml` file defines the infrastructure, but you must manually add secret keys

4. **Deploy**
   - Click **"Apply"** to create resources
   - Wait 5-10 minutes for deployment to complete
   - Note your backend URL (e.g., `https://elara-backend.onrender.com`)

### Step 3: Configure Frontend

Update the frontend environment file with your backend URL:

```bash
# Edit packages/frontend/.env.production
echo "VITE_API_URL=https://your-backend.onrender.com" > packages/frontend/.env.production
```

### Step 4: Deploy Frontend to Vercel

```bash
# Login to Vercel
vercel login

# Navigate to frontend directory
cd packages/frontend

# Deploy to production
vercel --prod

# Go back to root
cd ../..
```

### Step 5: Update CORS Settings

After deploying the frontend, update the `CORS_ORIGIN` environment variable in Render.com:

1. Go to your backend service in Render.com
2. Navigate to **Environment** tab
3. Update `CORS_ORIGIN` to include your Vercel frontend URL:
   ```
   https://your-actual-frontend.vercel.app
   ```
4. Save and trigger a redeploy

---

## Environment Variables

### Backend (Render.com)

These environment variables are configured in the `render.yaml` file. You must manually add the secret values in the Render.com dashboard:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection | Auto-generated by Render |
| `JWT_SECRET` | Authentication secret | Auto-generated or custom |
| `CORS_ORIGIN` | Allowed origins | `https://elara-platform.vercel.app` |
| `ANTHROPIC_API_KEY` | Claude AI API key | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `GOOGLE_AI_API_KEY` | Google AI API key | `AIza...` |
| `VIRUSTOTAL_API_KEY` | VirusTotal API key | `1dc893...` |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Safe Browsing key | `AIza...` |
| `ABUSEIPDB_API_KEY` | AbuseIPDB API key | `1b6bdd...` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUGGINGFACE_API_KEY` | HuggingFace API key | - |
| `GROK_API_KEY` | Grok AI API key | - |
| `ABSTRACT_API_KEY` | Abstract API key | - |
| `REDIS_HOST` | Redis host (if external) | `localhost` |
| `CHROMADB_URL` | ChromaDB URL (if external) | `http://localhost:8000` |

### Frontend (Vercel)

Frontend uses `.env.production` file:

```env
VITE_API_URL=https://elara-backend.onrender.com
```

This is automatically configured by the deployment script.

---

## Verification Steps

After deployment, verify everything is working:

### 1. Check Backend Health

```bash
curl https://your-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-06T10:00:00.000Z"
}
```

### 2. Check Frontend Access

Open your frontend URL in a browser:
```
https://your-frontend.vercel.app
```

You should see the Elara login page.

### 3. Test User Registration

1. Click **"Sign Up"**
2. Fill in user details
3. Submit registration
4. Verify you can login

### 4. Test URL Scanning

1. Login to your account
2. Navigate to **"Scan URL"**
3. Enter a test URL (e.g., `https://google.com`)
4. Submit scan
5. Verify scan results appear

### 5. Check Logs

#### Backend Logs (Render.com)
- Go to your service dashboard
- Click **"Logs"** tab
- Look for startup messages and errors

#### Frontend Logs (Vercel)
- Go to your deployment dashboard
- Click on the deployment
- Check **"Functions"** logs for errors

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors

**Symptom:** Browser console shows CORS policy errors

**Solution:**
- Verify `CORS_ORIGIN` in Render.com includes your Vercel frontend URL
- Ensure URL format is correct (no trailing slash)
- Redeploy backend after updating CORS settings

```bash
# Check CORS origin in Render.com
# Should include: https://your-frontend.vercel.app
```

#### 2. Database Connection Errors

**Symptom:** Backend logs show Prisma connection errors

**Solution:**
- Verify `DATABASE_URL` is correctly set in Render.com
- Check PostgreSQL database is running
- Run migrations:

```bash
# Connect to Render shell
render shell your-backend-service

# Run migrations
pnpm exec prisma migrate deploy
```

#### 3. Frontend Build Failures

**Symptom:** Vercel deployment fails during build

**Solution:**
- Check build logs in Vercel dashboard
- Verify all dependencies are listed in `package.json`
- Ensure `.env.production` exists with `VITE_API_URL`

#### 4. API Keys Not Working

**Symptom:** Features fail with API errors

**Solution:**
- Verify all API keys are added in Render.com environment variables
- Check API key validity by testing in their respective dashboards
- Ensure no extra spaces in environment variable values
- Redeploy backend after adding keys

#### 5. Render Free Tier Spindown

**Symptom:** First request takes 30+ seconds

**Solution:**
- Render free tier spins down after 15 minutes of inactivity
- First request will take longer as the service restarts
- Consider upgrading to paid tier for always-on service
- Implement a keep-alive ping (external cron service)

#### 6. Health Check Failures

**Symptom:** Render shows service as unhealthy

**Solution:**
- Verify health check endpoint exists: `/api/health`
- Check backend logs for startup errors
- Ensure port 3001 is correctly exposed
- Verify Dockerfile health check configuration

### Getting Help

If you encounter issues not covered here:

1. **Check Logs First**
   - Backend: Render.com dashboard → Logs
   - Frontend: Vercel dashboard → Deployment logs

2. **Verify Environment Variables**
   - Backend: Render.com → Environment tab
   - Frontend: `.env.production` file

3. **Review Documentation**
   - [Vercel Documentation](https://vercel.com/docs)
   - [Render Documentation](https://render.com/docs)

4. **Community Support**
   - Open an issue on GitHub
   - Check existing issues for solutions

---

## Support

### Useful Links

- **Vercel Dashboard:** [https://vercel.com/dashboard](https://vercel.com/dashboard)
- **Render Dashboard:** [https://dashboard.render.com/](https://dashboard.render.com/)
- **Vercel CLI Docs:** [https://vercel.com/docs/cli](https://vercel.com/docs/cli)
- **Render Blueprints:** [https://render.com/docs/infrastructure-as-code](https://render.com/docs/infrastructure-as-code)

### Deployment Checklist

- [ ] All API keys obtained and verified
- [ ] Code pushed to GitHub main branch
- [ ] Backend deployed to Render.com
- [ ] Database created and migrations run
- [ ] Environment variables configured in Render.com
- [ ] Frontend `.env.production` updated with backend URL
- [ ] Frontend deployed to Vercel
- [ ] CORS_ORIGIN updated with actual frontend URL
- [ ] Health check endpoint responding
- [ ] User registration tested
- [ ] URL scanning tested
- [ ] Production URLs saved to `PRODUCTION_URLS.txt`

---

## Next Steps

After successful deployment:

1. **Monitor Performance**
   - Set up error tracking (e.g., Sentry)
   - Monitor API usage and costs
   - Track response times

2. **Optimize**
   - Enable caching where appropriate
   - Optimize database queries
   - Implement CDN for static assets

3. **Secure**
   - Enable rate limiting
   - Implement request validation
   - Set up SSL/TLS certificates (auto via Vercel/Render)

4. **Scale**
   - Consider upgrading Render.com tier for better performance
   - Add Redis for session management
   - Implement load balancing if needed

---

**Deployment Date:** Use `deploy-production.ps1` or `deploy-production.sh` to deploy

**Generated URLs:** Check `PRODUCTION_URLS.txt` after deployment
