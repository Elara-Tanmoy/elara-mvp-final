# Troubleshooting Guide - Elara Platform

**Last Updated:** October 15, 2025
**Purpose:** Solutions to common issues in Elara platform development and deployment

---

## Table of Contents

1. [Docker Build Issues](#docker-build-issues)
2. [Deployment Issues](#deployment-issues)
3. [Frontend Issues](#frontend-issues)
4. [Backend Issues](#backend-issues)
5. [Environment Banner Issues](#environment-banner-issues)
6. [Authentication/Login Issues](#authenticationlogin-issues)
7. [Kubernetes Issues](#kubernetes-issues)
8. [CI/CD Issues](#cicd-issues)

---

## Docker Build Issues

### Issue 1: COPY Failed - File Not Found

**Symptom:**
```
ERROR [build-frontend 5/9] COPY elara-platform/packages/frontend/package.json ./
------
failed to compute cache key: "/elara-platform/packages/frontend/package.json" not found
```

**Cause:** Using `elara-platform/` prefix in Dockerfile COPY commands

**Solution:**
```dockerfile
# ❌ WRONG
COPY elara-platform/packages/frontend/package.json ./

# ✅ CORRECT
COPY packages/frontend/package.json ./
```

**Why:** The build context is already the repository root, so paths are relative to `elara-platform/`.

**Files to check:**
- `gcp-config/docker/Dockerfile.backend`
- `gcp-config/docker/Dockerfile.frontend`
- `gcp-config/docker/Dockerfile.worker`
- `gcp-config/docker/Dockerfile.proxy`

---

### Issue 2: Docker Build Context Too Large

**Symptom:**
```
Sending build context to Docker daemon  2.5GB
```

**Cause:** `.dockerignore` not configured or node_modules included

**Solution:**

Create/update `.dockerignore`:
```
node_modules
dist
build
.git
.env
*.log
```

---

### Issue 3: Multi-Architecture Build Failures

**Symptom:**
```
exec /usr/local/bin/docker-entrypoint.sh: exec format error
```

**Cause:** Building on ARM (M1 Mac) but deploying to x86

**Solution:**
```bash
docker buildx build --platform linux/amd64 -f gcp-config/docker/Dockerfile.frontend .
```

---

## Deployment Issues

### Issue 1: kubectl set image - Container Not Found

**Symptom:**
```
error: unable to find container named "elara-frontend"
```

**Cause:** Wrong container name in `kubectl set image` command

**Solution:**
```bash
# Check container name in deployment
kubectl get deployment elara-frontend -n elara-frontend-dev -o jsonpath='{.spec.template.spec.containers[*].name}'

# Output: frontend

# Use correct container name
kubectl set image deployment/elara-frontend frontend=gcr.io/... -n elara-frontend-dev
```

**Files to fix:**
- `gcp-config/cloudbuild-dev.yaml` line ~170
- `gcp-config/cloudbuild-staging.yaml` line ~170

```yaml
# ❌ WRONG
kubectl set image deployment/elara-frontend elara-frontend=...

# ✅ CORRECT
kubectl set image deployment/elara-frontend frontend=...
```

---

### Issue 2: Image Pull Errors

**Symptom:**
```
Failed to pull image "gcr.io/.../frontend:dev-4138c19": not found
```

**Cause:** Image doesn't exist in GCR (build failed or wrong tag)

**Solution:**

1. **List available images:**
   ```bash
   gcloud container images list-tags gcr.io/elara-mvp-13082025-u1/frontend --filter="tags:dev-*" --limit=10
   ```

2. **Use existing tag:**
   ```bash
   kubectl set image deployment/elara-frontend frontend=gcr.io/elara-mvp-13082025-u1/frontend:dev-latest -n elara-frontend-dev
   ```

3. **Check Cloud Build logs:**
   ```bash
   gcloud builds list --limit=5
   gcloud builds log <BUILD_ID>
   ```

---

### Issue 3: Pods Stuck in Pending

**Symptom:**
```
NAME                              READY   STATUS    RESTARTS   AGE
elara-frontend-7b88b679fc-gzjk4   0/1     Pending   0          10m
```

**Cause:** Insufficient resources (CPU/memory)

**Solution:**

1. **Check pod events:**
   ```bash
   kubectl describe pod -n elara-frontend-dev <POD_NAME>
   ```

2. **Look for:**
   ```
   Warning  FailedScheduling  ... 0/3 nodes are available: 3 Insufficient memory.
   ```

3. **Options:**
   - **Reduce resource requests** in deployment manifest
   - **Scale down other deployments** to free resources
   - **Add nodes** to GKE cluster

   ```bash
   # Scale down temporarily
   kubectl scale deployment elara-frontend --replicas=0 -n elara-frontend-staging
   ```

---

### Issue 4: Rollout Timeout

**Symptom:**
```
error: deployment "elara-frontend" exceeded its progress deadline
Waiting for deployment "elara-frontend" rollout to finish: 1 old replicas are pending termination...
```

**Cause:** Old pods not terminating (health check failing, grace period)

**Solution:**

1. **Force delete old pods:**
   ```bash
   kubectl delete pod -n elara-frontend-dev <OLD_POD_NAME>
   ```

2. **Check new pod logs for errors:**
   ```bash
   kubectl logs -n elara-frontend-dev <NEW_POD_NAME>
   ```

3. **If stuck, rollback:**
   ```bash
   kubectl rollout undo deployment/elara-frontend -n elara-frontend-dev
   ```

---

## Frontend Issues

### Issue 1: API Calls Fail (Network Error)

**Symptom:**
```
POST http://staging.elara.internal/api/v2/auth/login net::ERR_NAME_NOT_RESOLVED
```

**Cause:** `VITE_API_URL` set to non-existent hostname

**Solution:**

1. **Check current VITE_API_URL:**
   ```bash
   grep VITE_API_URL gcp-config/cloudbuild-staging.yaml
   ```

2. **Should be `/api` (relative path):**
   ```yaml
   # gcp-config/cloudbuild-dev.yaml and cloudbuild-staging.yaml
   - '--build-arg'
   - 'VITE_API_URL=/api'  # ✅ CORRECT
   ```

3. **Not an absolute URL:**
   ```yaml
   # ❌ WRONG
   - 'VITE_API_URL=http://staging.elara.internal/api'
   - 'VITE_API_URL=http://dev.elara.internal/api'
   ```

4. **Rebuild and redeploy:**
   ```bash
   git add gcp-config/cloudbuild-*.yaml
   git commit -m "fix: correct VITE_API_URL to use nginx proxy"
   git push origin staging
   ```

**Why:** The frontend pod runs nginx which proxies `/api/*` to the backend service internally. Using an absolute URL bypasses this proxy and fails.

---

### Issue 2: Environment Variables Not Available

**Symptom:**
```javascript
console.log(import.meta.env.VITE_ENVIRONMENT) // undefined
```

**Cause:** Environment variable not passed as Docker build arg

**Solution:**

1. **Check Dockerfile accepts arg:**
   ```dockerfile
   # gcp-config/docker/Dockerfile.frontend
   ARG VITE_ENVIRONMENT
   ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}
   RUN npm run build
   ```

2. **Check Cloud Build passes arg:**
   ```yaml
   # gcp-config/cloudbuild-*.yaml
   - '--build-arg'
   - 'VITE_ENVIRONMENT=development'  # or staging
   ```

3. **Rebuild after changes**

---

### Issue 3: Blank Page After Deployment

**Symptom:** Browser shows blank page, no errors in console

**Cause:** SPA routing not configured in nginx

**Solution:**

Nginx config should include:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Check:** `gcp-config/docker/Dockerfile.frontend` line ~44

---

## Backend Issues

### Issue 1: Database Connection Fails

**Symptom:**
```
Error: P1001: Can't reach database server at `10.2.3.4:5432`
```

**Cause:** DATABASE_URL incorrect or Cloud SQL Auth Proxy not running

**Solution:**

1. **Check DATABASE_URL secret:**
   ```bash
   kubectl get secret database-url -n elara-backend-dev -o jsonpath='{.data.DATABASE_URL}' | base64 -d
   ```

2. **Check Cloud SQL instance is running:**
   ```bash
   gcloud sql instances list
   ```

3. **Verify connection from pod:**
   ```bash
   kubectl run -it --rm psql --image=postgres:15 -n elara-backend-dev -- psql "$DATABASE_URL"
   ```

---

### Issue 2: Prisma Client Not Generated

**Symptom:**
```
Error: @prisma/client did not initialize yet.
```

**Cause:** Prisma generate not run in Dockerfile

**Solution:**

Add to Dockerfile:
```dockerfile
WORKDIR /app/packages/backend
RUN pnpm prisma generate
```

**File:** `gcp-config/docker/Dockerfile.backend` line ~31

---

### Issue 3: Worker Jobs Not Processing

**Symptom:** Jobs stuck in queue, not being processed

**Cause:** Worker pods not running or not connected to Redis

**Solution:**

1. **Check worker pods:**
   ```bash
   kubectl get pods -n elara-workers-dev
   ```

2. **Check worker logs:**
   ```bash
   kubectl logs -n elara-workers-dev deployment/elara-worker
   ```

3. **Check Redis connection:**
   ```bash
   # From worker pod
   kubectl exec -n elara-workers-dev deployment/elara-worker -- redis-cli -h <REDIS_HOST> ping
   ```

4. **Verify REDIS_URL secret exists:**
   ```bash
   kubectl get secret redis-url -n elara-workers-dev
   ```

---

## Environment Banner Issues

### Issue 1: Banner Not Showing on DEV/STAGING

**Symptom:** No environment banner visible on http://34.83.95.127/ or http://136.117.33.149/

**Causes & Solutions:**

#### Cause 1: VITE_ENVIRONMENT not set

**Check:**
```bash
grep VITE_ENVIRONMENT gcp-config/cloudbuild-dev.yaml
grep VITE_ENVIRONMENT gcp-config/cloudbuild-staging.yaml
```

**Should have:**
```yaml
- '--build-arg'
- 'VITE_ENVIRONMENT=development'  # for dev
# OR
- 'VITE_ENVIRONMENT=staging'  # for staging
```

#### Cause 2: Dockerfile doesn't accept arg

**Check:** `gcp-config/docker/Dockerfile.frontend`
```dockerfile
ARG VITE_ENVIRONMENT  # Must be present
ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}  # Must be before RUN npm run build
```

#### Cause 3: Component not imported correctly

**Check:** `packages/frontend/src/components/LayoutAccessible.tsx`
```typescript
// ✅ CORRECT - Import at top level
import EnvironmentBanner from './EnvironmentBanner';

const LayoutAccessible: React.FC = () => {
  // ...
  return (
    <>
      <EnvironmentBanner />
      {/* rest of layout */}
    </>
  );
};
```

```typescript
// ❌ WRONG - Import inside function
const LayoutAccessible: React.FC = () => {
  import EnvironmentBanner from './EnvironmentBanner';  // TypeScript error!
  // ...
}
```

#### Cause 4: Pods not restarted with new image

**Solution:**
```bash
# Force restart with new image
kubectl set image deployment/elara-frontend frontend=gcr.io/elara-mvp-13082025-u1/frontend:staging-latest -n elara-frontend-staging

# Wait for rollout
kubectl rollout status deployment/elara-frontend -n elara-frontend-staging
```

#### Cause 5: Browser cache

**Solution:** Hard refresh browser
- **Windows/Linux:** Ctrl + Shift + R
- **Mac:** Cmd + Shift + R

---

## Authentication/Login Issues

### Issue 1: Login Fails in DEV/STAGING

**Symptom:** "Invalid credentials" or network error when trying to log in

**Cause:** Frontend can't reach backend API

**Solution:**

1. **Check VITE_API_URL (see Frontend Issue #1)**
   ```bash
   grep VITE_API_URL gcp-config/cloudbuild-*.yaml
   # Should be: /api
   ```

2. **Check nginx proxy config:**
   ```bash
   kubectl exec -n elara-frontend-staging deployment/elara-frontend -- cat /etc/nginx/conf.d/default.conf
   ```

   Should include:
   ```nginx
   location /api/ {
       proxy_pass http://elara-api-service.elara-backend-staging.svc.cluster.local:80;
   }
   ```

3. **Test backend health:**
   ```bash
   kubectl run curl --image=curlimages/curl -it --rm -n elara-frontend-staging -- \
     curl http://elara-api-service.elara-backend-staging.svc.cluster.local/health
   ```

4. **Check backend logs:**
   ```bash
   kubectl logs -n elara-backend-staging deployment/elara-api --tail=100
   ```

---

### Issue 2: JWT Token Expired

**Symptom:** Logged in user suddenly logged out

**Cause:** Access token expired, refresh token not working

**Solution:**

1. **Check token expiration in backend:**
   ```typescript
   // packages/backend/src/utils/jwt.ts
   const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });
   const refreshToken = jwt.sign(payload, secret, { expiresIn: '7d' });
   ```

2. **Check refresh endpoint works:**
   ```bash
   curl -X POST http://34.83.95.127/api/v2/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<TOKEN>"}'
   ```

3. **Check frontend refresh logic:**
   ```typescript
   // packages/frontend/src/lib/api.ts
   api.interceptors.response.use(
     (response) => response,
     async (error) => {
       if (error.response?.status === 401 && !originalRequest._retry) {
         // Refresh token logic
       }
     }
   );
   ```

---

## Kubernetes Issues

### Issue 1: Can't Connect to Cluster

**Symptom:**
```
Unable to connect to the server: dial tcp: lookup elara-gke-us-west1 on 8.8.8.8:53: no such host
```

**Cause:** Cluster credentials not configured or expired

**Solution:**
```bash
gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1 --project=elara-mvp-13082025-u1
```

---

### Issue 2: Permission Denied

**Symptom:**
```
Error from server (Forbidden): pods is forbidden: User "..." cannot list resource "pods"
```

**Cause:** Service account lacks permissions

**Solution:**

1. **Check current user:**
   ```bash
   gcloud config get-value account
   ```

2. **Grant permissions:**
   ```bash
   gcloud projects add-iam-policy-binding elara-mvp-13082025-u1 \
     --member="user:your-email@example.com" \
     --role="roles/container.developer"
   ```

---

### Issue 3: Service Unreachable

**Symptom:**
```
curl: (7) Failed to connect to elara-api-service port 80: Connection refused
```

**Cause:** Service or pods not running

**Solution:**

1. **Check service exists:**
   ```bash
   kubectl get svc -n elara-backend-dev
   ```

2. **Check service endpoints:**
   ```bash
   kubectl get endpoints elara-api-service -n elara-backend-dev
   ```

   Should show pod IPs. If empty, no pods match selector.

3. **Check pod labels:**
   ```bash
   kubectl get pods -n elara-backend-dev --show-labels
   ```

4. **Match service selector:**
   ```bash
   kubectl get svc elara-api-service -n elara-backend-dev -o yaml | grep selector -A 2
   ```

---

## CI/CD Issues

### Issue 1: GitHub Actions Workflow Fails - Auth Error

**Symptom:**
```
Error: google-github-actions/auth failed with: retry function failed after 4 attempts
```

**Cause:** `GCP_SA_KEY` secret missing or invalid

**Solution:**

1. **Check secret exists:**
   ```bash
   cd /d/Elara_MVP/elara-platform
   gh secret list
   ```

2. **Create new service account key:**
   ```bash
   gcloud iam service-accounts keys create github-actions-key.json \
     --iam-account=terraform-deployer@elara-mvp-13082025-u1.iam.gserviceaccount.com
   ```

3. **Update GitHub secret:**
   ```bash
   gh secret set GCP_SA_KEY < github-actions-key.json
   ```

4. **Delete key file (security):**
   ```bash
   rm github-actions-key.json
   ```

---

### Issue 2: Cloud Build Timeout

**Symptom:**
```
ERROR: build step 0 "gcr.io/cloud-builders/docker" failed: timeout
```

**Cause:** Build taking too long (> 30 minutes default)

**Solution:**

Increase timeout in Cloud Build config:
```yaml
# gcp-config/cloudbuild-*.yaml
timeout: 1800s  # 30 minutes (increase if needed)
```

---

### Issue 3: Workflow Doesn't Trigger

**Symptom:** Push to branch but no workflow run

**Causes & Solutions:**

1. **Check path filters:**
   ```yaml
   # .github/workflows/deploy-development.yml
   on:
     push:
       paths:
         - 'packages/**'
         - 'gcp-config/**'
         - '.github/workflows/deploy-development.yml'
   ```

   If you changed a file outside these paths, workflow won't trigger.

2. **Check branch name:**
   ```bash
   git branch
   # Ensure you're on develop or staging branch
   ```

3. **Push to remote:**
   ```bash
   git push origin develop  # Not just 'git commit'
   ```

---

## Quick Diagnostic Commands

### Check Everything Status

```bash
#!/bin/bash
# Quick health check script

echo "=== GKE Cluster ==="
gcloud container clusters describe elara-gke-us-west1 --region=us-west1 --format="value(status)"

echo "=== DEV Environment ==="
kubectl get pods -n elara-frontend-dev
kubectl get pods -n elara-backend-dev

echo "=== STAGING Environment ==="
kubectl get pods -n elara-frontend-staging
kubectl get pods -n elara-backend-staging

echo "=== Recent Builds ==="
gcloud builds list --limit=3 --format="table(id,status,createTime)"

echo "=== Recent Workflow Runs ==="
gh run list --limit=3
```

---

## Getting Help

If none of these solutions work:

1. **Check pod logs:**
   ```bash
   kubectl logs -n <namespace> <pod-name> --tail=200
   ```

2. **Describe resources:**
   ```bash
   kubectl describe pod -n <namespace> <pod-name>
   kubectl describe svc -n <namespace> <service-name>
   ```

3. **Check events:**
   ```bash
   kubectl get events -n <namespace> --sort-by='.lastTimestamp'
   ```

4. **Review recent changes:**
   ```bash
   git log --oneline -10
   git diff HEAD~1
   ```

5. **Check this documentation:**
   - `FOR_CLAUDE_SESSIONS.md` - Common mistakes
   - `CI_CD_GUIDE.md` - Deployment pipeline
   - `REPOSITORY_STRUCTURE.md` - Project layout

---

**Last Updated:** October 15, 2025
