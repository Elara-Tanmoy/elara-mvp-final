# 🌱 GCP Database Seed Instructions

**Date:** October 17, 2025
**Purpose:** Seed AI models and consensus config to GCP Cloud SQL database
**Commit:** 287a88d - Database-driven AI model configuration with seeds

---

## 📋 What Was Deployed

**Commit 287a88d includes:**
1. ✅ `ai-models-seed.ts` - Seeds 3 AI models (Claude, GPT-4, Gemini) from env variables
2. ✅ `consensus-config-seed.ts` - Creates consensus configurations
3. ✅ Updated `seed.ts` - Orchestrates all seeds
4. ✅ `CHECKPOINT_ADMIN_CONTROL_OCT17_2025.md` - Full roadmap for database-driven config

**GitHub Actions Status:**
- Triggered automatically on push to `develop`
- Deploying to: `elara-backend-dev` namespace
- Image: `gcr.io/elara-mvp-13082025-u1/backend-api:dev-287a88d`

---

## 🚀 STEP 1: Wait for Deployment

Monitor deployment progress:

```bash
# Watch GitHub Actions
gh run list --limit 3 --branch develop

# Or check Cloud Build directly
gcloud builds list --limit=3
```

**Expected Timeline:** ~8-10 minutes

---

## 🗄️ STEP 2: Run Seed on GCP Database

### **Option A: Using kubectl exec (Recommended)**

```bash
# 1. Get GKE credentials
gcloud container clusters get-credentials elara-gke-us-west1 \
  --region=us-west1 \
  --project=elara-mvp-13082025-u1

# 2. Find backend pod name
kubectl get pods -n elara-backend-dev

# 3. Run seed (replace POD_NAME)
kubectl exec -it <POD_NAME> -n elara-backend-dev -- pnpm db:seed

# Example:
kubectl exec -it elara-api-7d9f8c6b5d-x4m2p -n elara-backend-dev -- pnpm db:seed
```

### **Option B: Using Cloud SQL Proxy**

```bash
# 1. Start Cloud SQL Proxy (in separate terminal)
cloud_sql_proxy -instances=elara-mvp-13082025-u1:us-west1:elara-db=tcp:5432

# 2. Set database URL for local connection
export DATABASE_URL="postgresql://user:pass@localhost:5432/elara_db"

# 3. Run seed locally (connects to GCP database)
cd packages/backend
pnpm db:seed
```

### **Option C: Using GCP Cloud Shell**

```bash
# 1. Open Cloud Shell: https://console.cloud.google.com
# 2. Clone repo and checkout develop
git clone https://github.com/Elara-Tanmoy/elara-platform.git
cd elara-platform
git checkout develop

# 3. Install dependencies
cd packages/backend
npm install -g pnpm
pnpm install

# 4. Run seed (DATABASE_URL from environment)
pnpm db:seed
```

---

## 📝 STEP 3: Verify Seed Success

### **Expected Output:**

```
🌱 Starting database seed...

👤 Seeding admin user...
  ✅ Admin user already exists

🔒 Seeding threat intelligence sources...
  ✅ Seeded threat source: PhishTank
  ✅ Seeded threat source: URLhaus
  ✅ Seeded threat source: OpenPhish
  ✅ Seeded threat source: MalwareBazaar
  ✅ Seeded threat source: ThreatFox
✅ Seeded 5 threat intelligence sources

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Seeding AI Models from environment variables...
  ✓ Claude Sonnet 4.5 seeded (weight: 0.35, rank: 1)
  ✓ GPT-4 seeded (weight: 0.35, rank: 2)
  ✓ Gemini 1.5 Flash seeded (weight: 0.30, rank: 3)

✅ AI Models seed complete: 3/3 models seeded

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ Seeding AI Consensus Configuration...
  ✓ Production Consensus config created/updated
    - Strategy: weighted_vote
    - Enabled Models: 3
    - Multiplier Range: 0.7 - 1.3
    - Is Active: true
  ✓ Strict Consensus preset created/updated
  ✓ Fast Consensus preset created/updated
  ✓ Balanced Consensus preset created/updated

✅ Consensus configuration seed complete
   Active: Production Consensus (3 models)
   Presets: 3 additional configurations available

✅ Database seed completed successfully!

📝 Next steps:
   1. Go to Admin Panel → Scan Engine Admin → AI Models tab
   2. Click "Test Connection" on each model
   3. All 3 models should show green ✓ status
   4. Run a URL scan to verify AI consensus works
```

---

## ✅ STEP 4: Verify in Admin Panel

### **1. Access Admin Panel**

```
URL: http://136.117.33.149/admin/scan-engine
Tab: AI Models
```

### **2. Verify AI Models Are Visible**

You should see **3 AI models** listed:

| Model | Provider | Weight | Rank | Status |
|-------|----------|--------|------|--------|
| Claude Sonnet 4.5 | anthropic | 0.35 | 1 | ✅ Enabled |
| OpenAI GPT-4 | openai | 0.35 | 2 | ✅ Enabled |
| Google Gemini 1.5 Flash | google | 0.30 | 3 | ✅ Enabled |

### **3. Test Connection (CRITICAL)**

For **each model**, click the **"Test Connection"** button:

**Expected Result:**
```
✓ Connected successfully
Response: ~2000ms
```

**If it fails:**
```
✗ Connection failed
Error: [error message]
```

Common issues:
- API key not in environment variables
- API key encryption/decryption issue
- API endpoint incorrect
- Network connectivity issue

---

## 🧪 STEP 5: Test URL Scan with AI Consensus

### **1. Navigate to URL Scanner**
```
URL: http://136.117.33.149/
Tool: URL Scanner
```

### **2. Scan a Test URL**
```
Test URL: https://google.com
Click: Scan URL
```

### **3. Verify AI Consensus Working**

In scan results, you should see:
- **AI Analysis section** with 3 model responses
- **Consensus Multiplier:** 0.7x - 1.3x
- **Agreement Rate:** percentage
- **Individual Model Results:**
  - Claude: [multiplier, confidence, reasoning]
  - GPT-4: [multiplier, confidence, reasoning]
  - Gemini: [multiplier, confidence, reasoning]

---

## 🔍 Troubleshooting

### **Issue: Seed fails with "API key not found"**

**Solution:** Ensure environment variables are set in GKE deployment:

```bash
kubectl get deployment elara-api -n elara-backend-dev -o yaml | grep -A 20 env:
```

Should show:
```yaml
env:
  - name: ANTHROPIC_API_KEY
    value: sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...
  - name: OPENAI_API_KEY
    value: sk-proj-...
  - name: GOOGLE_AI_API_KEY
    value: AIzaSyD...
```

### **Issue: Models seeded but Test Connection fails**

**Solution:** Check analyzer is reading from database:

1. Check scanner logs:
```bash
kubectl logs -n elara-backend-dev deployment/elara-api --tail=100 | grep "AI Orchestrator"
```

2. Look for:
```
[AI Orchestrator] Loaded 3 models from database
[AI Orchestrator] Using database config for: claude, gpt4, gemini
```

3. If still using hardcoded:
```
[AI Orchestrator] No models in database, using defaults
```

### **Issue: Empty admin panel (no models showing)**

**Solution:** Check database query:

```bash
kubectl exec -it <POD_NAME> -n elara-backend-dev -- \
  npx prisma studio

# Navigate to AIModelDefinition table
# Should show 3 records
```

---

## 📊 Success Criteria

After completing all steps, you should have:

- ✅ 3 AI models visible in admin panel
- ✅ All 3 models show ✓ on Test Connection
- ✅ URL scans show AI consensus analysis
- ✅ Can enable/disable models via UI
- ✅ Can adjust weights via UI
- ✅ Scanner reads models from database

---

## 🚧 Next Steps (After This Works)

Once AI models are working from database, proceed with:

1. **Update Analyzers** - Read API keys from database instead of env
2. **Global Settings** - Migrate all env variables to database
3. **Message Scan Admin** - Implement admin panel
4. **File Scan Admin** - Implement admin panel
5. **Fact Check Admin** - Implement admin panel

See `CHECKPOINT_ADMIN_CONTROL_OCT17_2025.md` for full roadmap.

---

## 📞 Need Help?

**Check these logs:**

```bash
# Backend logs
kubectl logs -n elara-backend-dev deployment/elara-api --tail=200

# Database migration status
kubectl exec -it <POD_NAME> -n elara-backend-dev -- pnpm prisma migrate status

# Seed status (if ran via kubectl)
kubectl logs -n elara-backend-dev <POD_NAME> | grep "Seeding"
```

**Database connection test:**

```bash
kubectl exec -it <POD_NAME> -n elara-backend-dev -- \
  npx prisma db execute --stdin <<< "SELECT * FROM \"AIModelDefinition\";"
```

---

**Last Updated:** October 17, 2025
**Deploy Commit:** 287a88d
**Status:** Waiting for deployment + seed execution
