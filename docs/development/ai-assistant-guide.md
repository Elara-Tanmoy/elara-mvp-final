# Instructions for Claude Code Sessions

**Purpose:** Prevent common mistakes and ensure continuity across Claude sessions
**Last Updated:** October 15, 2025

---

## START HERE - First Steps for New Sessions

When you (Claude Code) start a new session:

1. **Read these files in order:**
   - `FOR_CLAUDE_SESSIONS.md` (this file) ← START HERE
   - `REPOSITORY_STRUCTURE.md` - Understand the monorepo structure
   - `TROUBLESHOOTING.md` - Common issues and solutions
   - `CI_CD_GUIDE.md` - If working with deployments

2. **Confirm current directory:**
   ```bash
   pwd
   # Should be: D:\Elara_MVP\elara-platform (Windows) or /d/Elara_MVP/elara-platform (Git Bash)
   ```

3. **Check current branch:**
   ```bash
   git branch
   # Usually: develop, staging, or main
   ```

---

## Critical Rules - DO NOT VIOLATE

### ❌ NEVER Do These Things

1. **NEVER use `elara-platform/` prefix in Docker COPY commands**
   ```dockerfile
   # ❌ WRONG - Will cause Docker build to fail
   COPY elara-platform/packages/backend ./

   # ✅ CORRECT - Build context is already at repo root
   COPY packages/backend ./
   ```

2. **NEVER set VITE_API_URL to internal hostnames**
   ```yaml
   # ❌ WRONG - These don't exist
   VITE_API_URL=http://dev.elara.internal/api
   VITE_API_URL=http://staging.elara.internal/api

   # ✅ CORRECT - Use relative path for nginx proxy
   VITE_API_URL=/api
   ```

3. **NEVER use wrong container names in kubectl**
   ```bash
   # ❌ WRONG - Container name is "frontend", not "elara-frontend"
   kubectl set image deployment/elara-frontend elara-frontend=gcr.io/...

   # ✅ CORRECT
   kubectl set image deployment/elara-frontend frontend=gcr.io/...
   ```

4. **NEVER commit without using the exact commit message format**
   ```bash
   # ✅ CORRECT - Always include this footer
   git commit -m "$(cat <<'EOF'
   Your commit message here

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

5. **NEVER modify infrastructure files without reading them first**
   - Always `Read` the file before `Edit`
   - Check for recent changes (system-reminder tags)
   - Understand the full context

---

## Common Mistakes and Fixes

### Mistake 1: Docker Build Failures

**Symptom:** `COPY failed: file not found in build context`

**Cause:** Using `elara-platform/` prefix in Dockerfile COPY commands

**Fix:**
```dockerfile
# All Dockerfiles use repository root as build context
COPY packages/backend ./packages/backend  # ✅
COPY packages/frontend ./packages/frontend  # ✅
```

**Files to check:**
- `gcp-config/docker/Dockerfile.backend`
- `gcp-config/docker/Dockerfile.frontend`
- `gcp-config/docker/Dockerfile.worker`
- `gcp-config/docker/Dockerfile.proxy`

---

### Mistake 2: Frontend Can't Reach Backend

**Symptom:** Login fails, API calls fail, 404 errors

**Cause:** Frontend using wrong API URL

**Fix:**
Ensure `gcp-config/cloudbuild-dev.yaml` and `cloudbuild-staging.yaml` have:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-frontend'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_API_URL=/api'  # ✅ CORRECT
      - '--build-arg'
      - 'VITE_ENVIRONMENT=development'  # or staging
```

**Why:** The frontend pod runs nginx which proxies `/api/*` to the backend service internally.

---

### Mistake 3: Environment Banners Not Showing

**Symptom:** No DEV/STAGING banner on deployed environments

**Root Causes & Fixes:**

1. **VITE_ENVIRONMENT not passed as build arg:**
   ```yaml
   # In gcp-config/cloudbuild-*.yaml
   --build-arg
   VITE_ENVIRONMENT=development  # or staging
   ```

2. **Dockerfile doesn't accept the arg:**
   ```dockerfile
   # In gcp-config/docker/Dockerfile.frontend
   ARG VITE_ENVIRONMENT
   ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}
   RUN npm run build
   ```

3. **Pods not restarted after rebuild:**
   ```bash
   kubectl set image deployment/elara-frontend frontend=gcr.io/.../frontend:dev-latest -n elara-frontend-dev
   ```

**Check:**
- `packages/frontend/src/components/EnvironmentBanner.tsx` exists
- `packages/frontend/src/components/LayoutAccessible.tsx` imports it at top-level (not inside function)

---

### Mistake 4: Cloud Build Deployment Fails

**Symptom:** `kubectl set image` in Cloud Build fails with "container not found"

**Cause:** Wrong container name in kubectl command

**Fix:**
```yaml
# In gcp-config/cloudbuild-*.yaml
- name: 'gcr.io/cloud-builders/kubectl'
  id: 'deploy-frontend'
  args:
    - '-c'
    - |
      kubectl set image deployment/elara-frontend frontend=gcr.io/... # ✅ "frontend" not "elara-frontend"
```

---

## Understanding the Repository

### This is a MONOREPO

The `elara-platform` directory is the **repository root** containing multiple packages:
- `packages/backend/` - Node.js API
- `packages/frontend/` - React app
- `packages/shared/` - Shared TypeScript types
- `packages/proxy-service/` - Python proxy

**Implication:** Never add `elara-platform/` in paths. The root is already `elara-platform/`.

---

### Build Context for Docker

When Cloud Build runs:
```bash
# Command in cloudbuild.yaml
docker build -f gcp-config/docker/Dockerfile.frontend .
#                                                     ^
#                                    Build context = repo root
```

Inside `Dockerfile.frontend`:
```dockerfile
WORKDIR /build
COPY packages/frontend/package.json ./  # Copies from elara-platform/packages/frontend/
```

**The dot (`.`) in `docker build` means the repository root is the context.**

---

### Frontend Nginx Proxy

The frontend container has this nginx config:
```nginx
location /api/ {
    proxy_pass http://elara-api-service.elara-backend-{env}.svc.cluster.local:80;
}
```

So when frontend code calls `/api/v2/auth/login`, nginx proxies it to the backend service in the same cluster.

**This is why VITE_API_URL must be `/api`, not a full URL.**

---

## GCP Deployment Architecture

### Namespaces

Each environment has 4 namespaces:
- `elara-backend-{env}` - Backend API pods
- `elara-frontend-{env}` - Frontend (nginx) pods
- `elara-workers-{env}` - BullMQ worker pods
- `elara-proxy-{env}` - Python proxy pods

Where `{env}` is: (empty for prod), `dev`, or `staging`

### Services

- `elara-api-service` (port 80) → Backend API (internal port 3001)
- `elara-frontend-lb` (LoadBalancer) → Frontend nginx (port 8080)
- Worker and proxy services are ClusterIP (internal only)

### Image Tags

Format: `{env}-{git-short-sha}` and `{env}-latest`

Examples:
- `dev-4138c19` - Specific commit on develop branch
- `dev-latest` - Latest dev build
- `staging-4138c19` - Specific commit on staging branch
- `staging-latest` - Latest staging build

---

## CI/CD Workflow

### Push → Deploy Flow

1. Developer pushes to `develop` or `staging` branch
2. GitHub Actions workflow triggered (`.github/workflows/deploy-{env}.yml`)
3. Workflow runs `gcloud builds submit` with `gcp-config/cloudbuild-{env}.yaml`
4. Cloud Build:
   - Builds 4 Docker images in parallel
   - Tags with `{env}-${SHORT_SHA}` and `{env}-latest`
   - Pushes to GCR
   - Runs `kubectl set image` to update deployments
   - Waits for rollout to complete
5. Kubernetes performs rolling update
6. New pods start, old pods terminate

### Manual Deployment

If you need to manually deploy a specific image:
```bash
# Get GKE credentials
gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1

# Update deployment
kubectl set image deployment/elara-frontend frontend=gcr.io/elara-mvp-13082025-u1/frontend:dev-latest -n elara-frontend-dev

# Wait for rollout
kubectl rollout status deployment/elara-frontend -n elara-frontend-dev
```

---

## Checking Deployment Status

### See what's deployed

```bash
# Check pods
kubectl get pods -n elara-frontend-dev

# Check which image is running
kubectl get pods -n elara-frontend-dev -o jsonpath='{.items[0].spec.containers[0].image}'

# Check pod logs
kubectl logs -n elara-backend-dev deployment/elara-api --tail=100
```

### Check Cloud Build history

```bash
# List recent builds
gcloud builds list --limit=10

# View build logs
gcloud builds log <BUILD_ID>
```

### Check GitHub Actions

```bash
cd /d/Elara_MVP/elara-platform

# List recent workflow runs
gh run list --limit=10

# View workflow details
gh run view <RUN_ID>

# Watch workflow in real-time
gh run watch <RUN_ID>
```

---

## Environment URLs

### Frontend

- **Production:** http://34.36.48.252/ (also on Vercel)
- **Staging:** http://34.83.95.127/
- **Development:** http://136.117.33.149/

### Backend (Internal)

- **Production:** `elara-api-service.elara-backend.svc.cluster.local:80`
- **Staging:** `elara-api-service.elara-backend-staging.svc.cluster.local:80`
- **Development:** `elara-api-service.elara-backend-dev.svc.cluster.local:80`

---

## File Path Conventions

### Windows vs Git Bash

```bash
# Windows style (native PowerShell)
D:\Elara_MVP\elara-platform

# Git Bash style (MINGW64)
/d/Elara_MVP/elara-platform

# Both are valid in Git Bash, use the /d/ style for consistency
```

### Absolute Paths in Tools

Always use absolute paths for Read, Write, Edit tools:
```
D:\Elara_MVP\elara-platform\packages\backend\src\index.ts  ✅
packages/backend/src/index.ts  ❌ (will fail)
```

---

## When Things Go Wrong

### Cloud Build Fails

1. Check build logs: `gh run view <RUN_ID> --log`
2. Look for specific error (Docker, kubectl, etc.)
3. Check `TROUBLESHOOTING.md` for that error type
4. Fix the issue in the config file
5. Push fix to trigger new build

### Pods Crash or ImagePullBackOff

```bash
# Describe pod to see error
kubectl describe pod -n elara-frontend-dev <POD_NAME>

# Common issues:
# - Image doesn't exist (wrong tag)
# - Pod out of resources (insufficient memory/CPU)
# - Config error (environment variables)
```

### Login Fails in Deployed Environment

1. Check frontend can reach backend:
   ```bash
   # From inside frontend pod
   kubectl exec -n elara-frontend-dev deployment/elara-frontend -- curl http://elara-api-service.elara-backend-dev.svc.cluster.local/health
   ```

2. Check VITE_API_URL is `/api`:
   ```bash
   # Should be /api, not http://...
   grep VITE_API_URL gcp-config/cloudbuild-dev.yaml
   ```

3. Check nginx proxy config is correct (see TROUBLESHOOTING.md)

---

## Working with Git

### Branch Management

```bash
# Check current branch
git branch

# Switch branches
git checkout develop
git checkout staging

# Merge changes
git checkout staging
git merge develop  # Merge develop into staging
```

### Commit Format

**ALWAYS use this format:**
```bash
git commit -m "$(cat <<'EOF'
{type}: {description}

{Detailed explanation if needed}

Changes:
1. {Change 1}
2. {Change 2}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

---

## Testing Changes Before Pushing

### Frontend Changes

```bash
cd packages/frontend
npm run dev
# Test at http://localhost:5173
```

### Backend Changes

```bash
cd packages/backend
npm run dev
# Test at http://localhost:3001
```

### Docker Build Test (Local)

```bash
# From repo root
docker build -f gcp-config/docker/Dockerfile.frontend --build-arg VITE_API_URL=/api --build-arg VITE_ENVIRONMENT=development .
```

---

## Quick Reference

### Key Files to Know

| File | Purpose |
|------|---------|
| `.github/workflows/deploy-development.yml` | Auto-deploy to DEV |
| `.github/workflows/deploy-staging.yml` | Auto-deploy to STAGING |
| `gcp-config/cloudbuild-dev.yaml` | Cloud Build config for DEV |
| `gcp-config/cloudbuild-staging.yaml` | Cloud Build config for STAGING |
| `gcp-config/docker/Dockerfile.frontend` | Frontend Docker image |
| `gcp-config/docker/Dockerfile.backend` | Backend Docker image |
| `packages/frontend/src/lib/api.ts` | Frontend API client |
| `packages/backend/src/index.ts` | Backend API server |

### Key Commands

```bash
# Deploy to DEV
git push origin develop

# Deploy to STAGING
git push origin staging

# Check deployment status
kubectl get pods -n elara-frontend-dev
kubectl get pods -n elara-frontend-staging

# View logs
kubectl logs -n elara-backend-dev deployment/elara-api --tail=50

# Update deployment manually
kubectl set image deployment/elara-frontend frontend=gcr.io/elara-mvp-13082025-u1/frontend:dev-latest -n elara-frontend-dev
```

---

## Summary

**Remember:**
1. Read this file first in every new session
2. Never use `elara-platform/` prefix in Docker COPY
3. Always use `/api` for VITE_API_URL in deployed environments
4. Container name is `frontend`, not `elara-frontend`
5. Read files before editing them
6. Test locally before pushing
7. Check TROUBLESHOOTING.md if stuck

**When in doubt:**
- Read the existing code
- Check recent git history: `git log --oneline -10`
- Ask the user for clarification

---

**Last Updated:** October 15, 2025
**Maintained by:** Claude Code sessions with user oversight
