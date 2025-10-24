# FIX DUPLICATE VERCEL DEPLOYMENTS

**Issue:** Two Vercel projects deploying on every push
**Solution:** Keep one project, delete the other

---

## 🔍 **IDENTIFYING THE DUPLICATE**

You likely have these two projects on Vercel:
1. **"elara-mvp"** (the one we want to keep)
2. **"elara-platform"** (duplicate, needs to be deleted)

---

## ✅ **STEP-BY-STEP FIX**

### **Step 1: Go to Vercel Dashboard**
1. Open: https://vercel.com/dashboard
2. You should see both projects listed

### **Step 2: Identify Which Project to KEEP**
- **Keep:** The project that's currently working
- **Usually:** "elara-mvp" (the original one you created)
- **Delete:** The duplicate project (likely "elara-platform")

### **Step 3: Delete the Duplicate Project**

1. Click on the **duplicate project** (the one you DON'T want)
2. Go to: **Settings** → **Advanced**
3. Scroll to bottom: **"Delete Project"**
4. Type the project name to confirm
5. Click **Delete**

### **Step 4: Verify Remaining Project Settings**

In your **KEPT project** (e.g., "elara-mvp"):

1. **Go to Settings → General:**
   - Root Directory: `./` (leave blank or set to root)
   - Build Command: Auto-detected (Vite)
   - Output Directory: Auto-detected (`packages/frontend/dist`)

2. **Go to Settings → Git:**
   - Repository: Should be your GitHub repo
   - Production Branch: `main`
   - Make sure only ONE project is connected to this repo

3. **Go to Settings → Environment Variables:**
   - Add: `VITE_API_BASE_URL` = `https://your-backend-url.onrender.com`
   - **IMPORTANT:** Replace with your actual Render backend URL!

### **Step 5: Trigger Deployment**

Option A - Manual:
1. In Vercel project → Go to **Deployments** tab
2. Click **"Redeploy"** on latest deployment
3. Check "Use existing Build Cache" is OFF
4. Click **Redeploy**

Option B - Git Push:
1. Make a small change (e.g., add a comment in a file)
2. Commit and push
3. Vercel will auto-deploy

---

## 🎯 **HOW TO PREVENT DUPLICATES**

### **Option A: Use vercel.json (Already Configured)**

Your root `vercel.json` is already correctly configured:
```json
{
  "buildCommand": "cd packages/frontend && npm install && npm run build",
  "outputDirectory": "packages/frontend/dist",
  "installCommand": "npm install --prefix packages/frontend",
  "framework": "vite"
}
```

### **Option B: Vercel Dashboard Settings**

If you ever create a NEW project:
1. Import from GitHub
2. **Root Directory:** Leave blank (uses root)
3. **Build Command:** Use the one from vercel.json
4. **Output Directory:** `packages/frontend/dist`
5. **Install Command:** `npm install --prefix packages/frontend`

---

## 🔧 **VERCEL PROJECT CONFIGURATION**

### **Correct Settings for Your Monorepo:**

```
Project Name: elara-mvp
Repository: Elara-Tanmoy/elara-platform
Production Branch: main

Build Settings:
  Framework Preset: Vite
  Root Directory: ./
  Build Command: cd packages/frontend && npm install && npm run build
  Output Directory: packages/frontend/dist
  Install Command: npm install --prefix packages/frontend

Environment Variables:
  VITE_API_BASE_URL = https://your-backend.onrender.com
```

---

## ⚠️ **COMMON CAUSES OF DUPLICATES**

1. **Imported same repo twice** from GitHub
   - Solution: Delete one project

2. **Created project via CLI and Dashboard**
   - Solution: Use only dashboard, delete CLI-created project

3. **Multiple branches connected**
   - Solution: Keep only `main` as production branch

4. **Two different Vercel accounts**
   - Solution: Delete project from one account

---

## 🧪 **VERIFY FIX WORKED**

After deleting duplicate:

1. **Push a small change:**
   ```bash
   cd elara-platform
   echo "# Test" >> README.md
   git add .
   git commit -m "Test single deployment"
   git push
   ```

2. **Check Vercel Dashboard:**
   - Should see deployment in ONLY ONE project
   - Not in two projects

3. **Check Deployment Logs:**
   - Should see: "Building..."
   - Should complete successfully
   - Only ONE deployment URL

---

## 🆘 **IF STILL DEPLOYING TWICE**

### **Check GitHub Integration:**

1. Go to: https://github.com/settings/installations
2. Find "Vercel" integration
3. Click **Configure**
4. Check which repositories are connected
5. Make sure your repo only appears once

### **Check Vercel Git Integration:**

1. In Vercel Dashboard
2. Go to: Settings → Git
3. Make sure only ONE GitHub connection exists
4. If multiple connections, remove duplicates

---

## 📊 **EXPECTED RESULT**

**Before Fix:**
- Push to GitHub → 2 deployments start
- Vercel dashboard shows 2 projects
- Wasted build minutes

**After Fix:**
- Push to GitHub → 1 deployment starts
- Vercel dashboard shows 1 project
- Clean, single deployment

---

## ✅ **CHECKLIST**

- [ ] Identified duplicate project name
- [ ] Deleted duplicate project from Vercel
- [ ] Verified remaining project settings
- [ ] Added VITE_API_BASE_URL environment variable
- [ ] Triggered test deployment
- [ ] Confirmed only ONE deployment happens
- [ ] Frontend connects to backend successfully

---

## 🚀 **AFTER FIXING DUPLICATES**

Once you have only ONE project:

1. **Update Environment Variable:**
   - Add `VITE_API_BASE_URL` pointing to your Render backend

2. **Test Deployment:**
   - Push this commit
   - Wait for deployment
   - Test URL scanner on deployed site

3. **Should Work:**
   - URL scanner completes in 5 seconds
   - No more connection errors
   - Mobile UI responsive

---

## 📝 **NOTES**

- The `.vercel` directory in your local repo links to ONE project
- It shows: `projectName: "elara-platform"`
- If your actual project is named "elara-mvp", the .vercel directory might be outdated
- This doesn't affect deployments, just local linking
- To fix: Delete `.vercel` directory locally (it will regenerate when needed)

---

**Generated:** 2025-10-09
**Status:** Ready to fix duplicate deployments
**Action Required:** Delete duplicate project on Vercel Dashboard
