# SecureVPN Proxy Service - Setup Guide

## Current Issue

The SecureVPN Browser is stuck on "Connecting..." because the proxy service isn't deployed yet or the backend can't reach it.

## Quick Diagnosis

Check if the proxy service is configured:
```bash
# Open browser console and run:
fetch('https://elara-backend-64tf.onrender.com/api/v2/proxy/health', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json()).then(console.log)
```

Expected healthy response:
```json
{
  "success": true,
  "data": {
    "proxyServiceUrl": "https://elara-proxy.onrender.com",
    "proxyServiceHealthy": true,
    "proxyServiceError": null,
    "configured": true
  }
}
```

## Step-by-Step Fix

### Step 1: Create Proxy Service on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +" → "Web Service"**
3. **Connect to GitHub**: Select `elara-platform` repository
4. **Configure Service:**
   - **Name**: `elara-proxy`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `packages/proxy-service`
   - **Environment**: Docker
   - **Dockerfile Path**: `Dockerfile` (it will auto-detect)
   - **Plan**: Free

5. **Add Environment Variables:**
   ```
   PORT=8080
   CORS_ORIGIN=https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app
   ```

6. **Click "Create Web Service"**

7. **Wait for deployment** (3-5 minutes)

8. **Note the service URL** (e.g., `https://elara-proxy.onrender.com`)

### Step 2: Update Backend Environment Variable

1. **Go to Render Dashboard** → Find `elara-backend` service
2. **Click "Environment"** tab
3. **Add new environment variable:**
   ```
   Key: PROXY_SERVICE_URL
   Value: https://elara-proxy.onrender.com
   ```
   *(Replace with your actual proxy service URL from Step 1)*

4. **Click "Save Changes"**
5. **Backend will auto-redeploy** (2-3 minutes)

### Step 3: Run Database Migration

The ProxySession and ProxyRequest tables need to be created.

**Option A: Automatic (on next backend deployment)**
- Render will run `npx prisma db push` automatically
- Check logs to confirm tables were created

**Option B: Manual (if needed)**
1. Go to Render Dashboard → elara-backend → Shell
2. Run:
   ```bash
   npx prisma db push
   ```

### Step 4: Verify Setup

**1. Check Proxy Service Health:**
```bash
curl https://elara-proxy.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "elara-proxy",
  "timestamp": "2025-10-08T23:00:00.000Z"
}
```

**2. Check Backend Can Reach Proxy:**
From your browser console (logged in as Premium/Admin):
```javascript
fetch('https://elara-backend-64tf.onrender.com/api/v2/proxy/health', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(console.log)
```

Expected response:
```json
{
  "success": true,
  "data": {
    "proxyServiceUrl": "https://elara-proxy.onrender.com",
    "proxyServiceHealthy": true,
    "proxyServiceError": null,
    "configured": true
  }
}
```

**3. Test SecureVPN:**
1. Login as Premium or Admin user
2. Navigate to Home page
3. Find SecureVPN Browser widget
4. Enter URL: `https://example.com`
5. Click "Connect"
6. Should connect within 5-10 seconds

### Step 5: Troubleshooting

#### Issue: Proxy service won't deploy

**Check:**
- Docker build logs in Render dashboard
- Python dependencies in `requirements.txt`
- Dockerfile syntax

**Common fixes:**
- Redeploy the service
- Check for typos in Dockerfile
- Verify all files are committed to GitHub

#### Issue: Backend can't reach proxy service

**Check:**
- PROXY_SERVICE_URL environment variable is set correctly
- Proxy service URL is accessible (try in browser)
- No typos in the URL (should start with `https://`)

**Fix:**
- Update PROXY_SERVICE_URL in backend environment
- Restart backend service
- Check proxy service logs for errors

#### Issue: "Proxy service is not available" error

**This means:**
- PROXY_SERVICE_URL is not set (defaults to localhost:8080)
- Proxy service is down
- Network connectivity issue

**Fix:**
1. Verify proxy service is running:
   ```bash
   curl https://elara-proxy.onrender.com/health
   ```
2. If service is down, redeploy it in Render
3. If URL is wrong, update PROXY_SERVICE_URL in backend

#### Issue: Database error

**Error:** `ProxySession table doesn't exist`

**Fix:**
```bash
# In Render backend shell:
npx prisma db push
```

#### Issue: CORS error

**Error:** `Access to fetch blocked by CORS policy`

**Fix:**
Update CORS_ORIGIN in proxy service environment:
```
CORS_ORIGIN=https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app
```

## Testing Checklist

- [ ] Proxy service is deployed and accessible
- [ ] Proxy service health check returns "healthy"
- [ ] Backend environment variable PROXY_SERVICE_URL is set
- [ ] Backend can reach proxy service (health check passes)
- [ ] Database tables exist (ProxySession, ProxyRequest)
- [ ] Frontend can create session
- [ ] Frontend can make proxy requests
- [ ] Stats update in real-time
- [ ] Disconnect works properly

## Production URLs

- **Frontend**: https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app
- **Backend**: https://elara-backend-64tf.onrender.com
- **Proxy Service**: *(Will be created - update this after Step 1)*

## Support

If issues persist:
1. Check Render logs for both backend and proxy service
2. Check browser console for JavaScript errors
3. Use `/api/v2/proxy/health` endpoint for diagnostics
4. Verify all environment variables are set correctly
5. Ensure all services are deployed and running

## Quick Fix Commands

**Test proxy service locally:**
```bash
cd packages/proxy-service
pip install -r requirements.txt
python app.py
# Visit: http://localhost:8080/health
```

**Test backend connection to proxy:**
```bash
# Set environment variable
export PROXY_SERVICE_URL=https://elara-proxy.onrender.com

# Start backend
cd packages/backend
npm run dev
```

**Check database tables:**
```sql
-- Connect to PostgreSQL and run:
\dt ProxySession
\dt ProxyRequest
```
