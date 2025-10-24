# 🚀 Deploy Ask Elara Chatbot - ONE COMMAND

## Quick Deploy (5 Minutes)

### Step 1: Get Production Database URL

1. Go to https://dashboard.render.com
2. Click on your PostgreSQL database
3. Copy the "External Database URL"

### Step 2: Run Deployment Script

**Windows:**
```bash
cd packages\backend
set DATABASE_URL=<paste-your-url-here>
npm run deploy:chatbot
```

**Mac/Linux:**
```bash
cd packages/backend
export DATABASE_URL="<paste-your-url-here>"
npm run deploy:chatbot
```

The script will automatically:
- Connect to production database
- Enable pgvector extension
- Create 6 chatbot tables
- Insert 10 knowledge entries
- Verify setup

### Step 3: Wait for Render

Check: https://dashboard.render.com → Events tab
Wait for: "Deploy succeeded" (~10 minutes)

### Step 4: Test

1. Open frontend URL
2. Click chatbot button (bottom-right)
3. Send: "What is phishing?"
4. Login as admin → Test admin panel

---

**Total Time:** 15 minutes ✅
