# CI/CD Guide - Elara Platform

**Last Updated:** October 15, 2025
**Purpose:** Complete guide to the CI/CD pipeline for Elara platform

---

## Overview

The Elara platform uses **GitHub Actions** + **Google Cloud Build** for continuous deployment to DEV and STAGING environments.

**Flow:**
```
Git Push → GitHub Actions → Cloud Build → GKE Deployment
```

---

## Environments

| Environment | Branch | Trigger | Frontend URL | Namespace Prefix |
|------------|--------|---------|--------------|------------------|
| **Production** | `main` | Manual | http://34.36.48.252/ | `elara-*` |
| **Staging** | `staging` | Auto on push | http://34.83.95.127/ | `elara-*-staging` |
| **Development** | `develop` | Auto on push | http://136.117.33.149/ | `elara-*-dev` |

---

## GitHub Actions Workflows

### Location

- `.github/workflows/deploy-development.yml`
- `.github/workflows/deploy-staging.yml`

### Workflow Structure

```yaml
name: Deploy to Development  # or Staging

on:
  push:
    branches:
      - develop  # or staging
    paths:
      - 'packages/**'
      - 'gcp-config/**'
      - '.github/workflows/deploy-development.yml'

env:
  PROJECT_ID: elara-mvp-13082025-u1
  REGION: us-west1
  CLOUD_BUILD_CONFIG: gcp-config/cloudbuild-dev.yaml  # or cloudbuild-staging.yaml

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      # 1. Checkout code
      - uses: actions/checkout@v4

      # 2. Authenticate to GCP using service account key
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      # 3. Setup gcloud CLI
      - uses: google-github-actions/setup-gcloud@v2

      # 4. Trigger Cloud Build
      - run: |
          gcloud builds submit \
            --config=${{ env.CLOUD_BUILD_CONFIG }} \
            --project=${{ env.PROJECT_ID }} \
            --region=${{ env.REGION }} \
            --substitutions=SHORT_SHA=$(git rev-parse --short HEAD) \
            .
```

### Key Points

1. **Trigger:** Pushes to `develop` or `staging` branch
2. **Path filters:** Only triggers if changes in `packages/`, `gcp-config/`, or workflow file itself
3. **Authentication:** Uses `GCP_SA_KEY` GitHub secret (service account JSON)
4. **Build context:** Submits entire repository (`.`) as build context

---

## GitHub Secrets

### Required Secrets

| Secret Name | Description | How to Create |
|-------------|-------------|---------------|
| `GCP_SA_KEY` | GCP service account JSON key | See below |

### Creating GCP_SA_KEY

```bash
# 1. Create service account key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=terraform-deployer@elara-mvp-13082025-u1.iam.gserviceaccount.com

# 2. Add to GitHub (using gh CLI)
gh secret set GCP_SA_KEY < github-actions-key.json

# 3. Verify
gh secret list
# Should show: GCP_SA_KEY
```

**Service Account Permissions:**
- Cloud Build Editor
- Kubernetes Engine Developer
- Storage Admin (for GCR)

---

## Cloud Build Configuration

### Files

- `gcp-config/cloudbuild-dev.yaml`
- `gcp-config/cloudbuild-staging.yaml`

### Structure

```yaml
timeout: 1800s  # 30 minutes

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

substitutions:
  _PROJECT_ID: 'elara-mvp-13082025-u1'
  _ENV: 'dev'  # or 'staging'
  _CLUSTER_NAME: 'elara-gke-us-west1'
  _REGION: 'us-west1'
  _NAMESPACE_BACKEND: 'elara-backend-dev'
  _NAMESPACE_WORKERS: 'elara-workers-dev'
  _NAMESPACE_PROXY: 'elara-proxy-dev'
  _NAMESPACE_FRONTEND: 'elara-frontend-dev'

steps:
  # Build steps (see below)

images:
  # Images to push to GCR
```

### Build Steps

Cloud Build executes these steps in order:

#### 1. Build Docker Images (Parallel)

```yaml
# Backend API
- name: 'gcr.io/cloud-builders/docker'
  id: 'build-backend-api'
  args:
    - 'build'
    - '-t'
    - 'gcr.io/${_PROJECT_ID}/backend-api:${_ENV}-${SHORT_SHA}'
    - '-t'
    - 'gcr.io/${_PROJECT_ID}/backend-api:${_ENV}-latest'
    - '-f'
    - 'gcp-config/docker/Dockerfile.backend'
    - '.'
  waitFor: ['-']  # Start immediately (parallel)

# Worker (same pattern)
- name: 'gcr.io/cloud-builders/docker'
  id: 'build-worker'
  # ... similar args
  waitFor: ['-']

# Proxy (same pattern)
- name: 'gcr.io/cloud-builders/docker'
  id: 'build-proxy'
  # ... similar args
  waitFor: ['-']

# Frontend
- name: 'gcr.io/cloud-builders/docker'
  id: 'build-frontend'
  args:
    - 'build'
    - '--build-arg'
    - 'VITE_API_URL=/api'  # ✅ CRITICAL: Must be /api
    - '--build-arg'
    - 'VITE_ENVIRONMENT=development'  # or staging
    - '-t'
    - 'gcr.io/${_PROJECT_ID}/frontend:${_ENV}-${SHORT_SHA}'
    - '-t'
    - 'gcr.io/${_PROJECT_ID}/frontend:${_ENV}-latest'
    - '-f'
    - 'gcp-config/docker/Dockerfile.frontend'
    - '.'
  waitFor: ['-']
```

**Key Points:**
- `waitFor: ['-']` means "don't wait, start immediately" (parallel execution)
- Each image gets two tags: `{env}-{sha}` and `{env}-latest`
- Frontend requires build args for Vite environment variables
- Build context (`.`) is the repository root

#### 2. Get GKE Credentials

```yaml
- name: 'gcr.io/cloud-builders/gcloud'
  id: 'get-gke-credentials'
  args:
    - 'container'
    - 'clusters'
    - 'get-credentials'
    - '${_CLUSTER_NAME}'
    - '--region=${_REGION}'
    - '--project=${_PROJECT_ID}'
  waitFor: ['build-backend-api', 'build-worker', 'build-proxy', 'build-frontend']
```

**Note:** Waits for all builds to complete before proceeding.

#### 3. Create Namespaces

```yaml
- name: 'gcr.io/cloud-builders/kubectl'
  id: 'create-namespaces'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      kubectl create namespace ${_NAMESPACE_BACKEND} --dry-run=client -o yaml | kubectl apply -f -
      kubectl create namespace ${_NAMESPACE_WORKERS} --dry-run=client -o yaml | kubectl apply -f -
      kubectl create namespace ${_NAMESPACE_PROXY} --dry-run=client -o yaml | kubectl apply -f -
      kubectl create namespace ${_NAMESPACE_FRONTEND} --dry-run=client -o yaml | kubectl apply -f -
  env:
    - 'CLOUDSDK_COMPUTE_REGION=${_REGION}'
    - 'CLOUDSDK_CONTAINER_CLUSTER=${_CLUSTER_NAME}'
  waitFor: ['get-gke-credentials']
```

**Purpose:** Ensures namespaces exist (idempotent operation).

#### 4. Deploy Services

```yaml
# Backend
- name: 'gcr.io/cloud-builders/kubectl'
  id: 'deploy-backend'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      kubectl set image deployment/elara-api elara-api=gcr.io/${_PROJECT_ID}/backend-api:${_ENV}-${SHORT_SHA} -n ${_NAMESPACE_BACKEND} || echo "Deployment may not exist yet"
      kubectl rollout status deployment/elara-api -n ${_NAMESPACE_BACKEND} --timeout=5m || echo "Rollout status check skipped"
  env:
    - 'CLOUDSDK_COMPUTE_REGION=${_REGION}'
    - 'CLOUDSDK_CONTAINER_CLUSTER=${_CLUSTER_NAME}'
  waitFor: ['create-namespaces']

# Worker (same pattern)
# Proxy (same pattern)

# Frontend
- name: 'gcr.io/cloud-builders/kubectl'
  id: 'deploy-frontend'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      kubectl set image deployment/elara-frontend frontend=gcr.io/${_PROJECT_ID}/frontend:${_ENV}-${SHORT_SHA} -n ${_NAMESPACE_FRONTEND} || echo "Deployment may not exist yet"
      kubectl rollout status deployment/elara-frontend -n ${_NAMESPACE_FRONTEND} --timeout=5m || echo "Rollout status check skipped"
  env:
    - 'CLOUDSDK_COMPUTE_REGION=${_REGION}'
    - 'CLOUDSDK_CONTAINER_CLUSTER=${_CLUSTER_NAME}'
  waitFor: ['create-namespaces']
```

**Key Points:**
- Uses `kubectl set image` to update deployment with new image
- Container name must match deployment spec (e.g., `frontend`, not `elara-frontend`)
- `|| echo "..."` prevents failures if deployment doesn't exist yet (first time)
- Waits up to 5 minutes for rollout to complete

#### 5. Push Images

```yaml
images:
  - 'gcr.io/${_PROJECT_ID}/backend-api:${_ENV}-${SHORT_SHA}'
  - 'gcr.io/${_PROJECT_ID}/backend-api:${_ENV}-latest'
  - 'gcr.io/${_PROJECT_ID}/worker:${_ENV}-${SHORT_SHA}'
  - 'gcr.io/${_PROJECT_ID}/worker:${_ENV}-latest'
  - 'gcr.io/${_PROJECT_ID}/proxy:${_ENV}-${SHORT_SHA}'
  - 'gcr.io/${_PROJECT_ID}/proxy:${_ENV}-latest'
  - 'gcr.io/${_PROJECT_ID}/frontend:${_ENV}-${SHORT_SHA}'
  - 'gcr.io/${_PROJECT_ID}/frontend:${_ENV}-latest'
```

**Purpose:** Declares which images to push to GCR after build completes.

---

## Docker Build Configuration

### Dockerfiles

Located in `gcp-config/docker/`:
- `Dockerfile.backend`
- `Dockerfile.frontend`
- `Dockerfile.worker`
- `Dockerfile.proxy`

### Build Context

**CRITICAL:** All Dockerfiles use the **repository root** as build context.

```bash
docker build -f gcp-config/docker/Dockerfile.frontend .
#                                                     ^
#                                         Build context = repo root
```

**This means:**
- COPY paths are relative to repo root
- `COPY packages/frontend ./` works
- `COPY elara-platform/packages/frontend ./` FAILS

### Frontend Dockerfile

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build

# Accept build arguments
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_ENVIRONMENT

# Copy package files
COPY packages/frontend/package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY packages/frontend ./

# Build with environment variables
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /build/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 8080;' >> /etc/nginx/conf.d/default.conf && \
    # ... (see full file for complete config)

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
```

**Key Points:**
- Multi-stage build (builder + production)
- Accepts `VITE_*` args for build-time configuration
- Nginx serves static files and proxies `/api/*` to backend

### Backend Dockerfile

```dockerfile
FROM node:20-alpine AS production

RUN apk add --no-cache openssl openssl-dev
RUN npm install -g pnpm@latest tsx@latest

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy package.json files
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Generate Prisma client
WORKDIR /app/packages/backend
RUN pnpm prisma generate

USER node

EXPOSE 3001

CMD ["tsx", "src/index.ts"]
```

**Key Points:**
- Uses `tsx` for TypeScript execution (no build step)
- Installs all dependencies (dev + prod) for runtime type execution
- Generates Prisma client at build time

---

## Image Tagging Strategy

### Tag Format

```
gcr.io/{project}/{service}:{env}-{tag}
```

**Examples:**
- `gcr.io/elara-mvp-13082025-u1/frontend:dev-4138c19`
- `gcr.io/elara-mvp-13082025-u1/frontend:dev-latest`
- `gcr.io/elara-mvp-13082025-u1/backend-api:staging-95e284c`
- `gcr.io/elara-mvp-13082025-u1/backend-api:staging-latest`

### Tag Meanings

- `{env}-{SHORT_SHA}` - Specific commit (immutable)
- `{env}-latest` - Latest build for environment (moves with each build)

**Usage:**
- Deployments reference `-latest` for automatic updates
- Can pin to specific SHA for rollback: `kubectl set image ... :dev-4138c19`

---

## Monitoring Deployments

### Via GitHub Actions

```bash
cd /d/Elara_MVP/elara-platform

# List recent runs
gh run list --limit=10

# View run details
gh run view <RUN_ID>

# Watch run in real-time
gh run watch <RUN_ID>

# View logs
gh run view <RUN_ID> --log
```

### Via Cloud Build

```bash
# List builds
gcloud builds list --limit=10

# View build details
gcloud builds describe <BUILD_ID>

# Stream build logs
gcloud builds log <BUILD_ID> --stream
```

### Via Kubernetes

```bash
# Get GKE credentials
gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1

# Check deployment status
kubectl get deployments -n elara-frontend-dev

# Check pod status
kubectl get pods -n elara-frontend-dev

# See which image is running
kubectl get pods -n elara-frontend-dev -o jsonpath='{.items[0].spec.containers[0].image}'

# View logs
kubectl logs -n elara-backend-dev deployment/elara-api --tail=100 --follow
```

---

## Rollback Procedure

### Automatic Rollback (Kubernetes)

Kubernetes automatically performs rolling updates. If new pods fail health checks, the rollout will pause.

### Manual Rollback

```bash
# Option 1: Roll back to previous revision
kubectl rollout undo deployment/elara-frontend -n elara-frontend-dev

# Option 2: Deploy specific image tag
kubectl set image deployment/elara-frontend frontend=gcr.io/elara-mvp-13082025-u1/frontend:dev-95e284c -n elara-frontend-dev

# Wait for rollout
kubectl rollout status deployment/elara-frontend -n elara-frontend-dev
```

### Finding Previous Image Tags

```bash
# List image tags
gcloud container images list-tags gcr.io/elara-mvp-13082025-u1/frontend --filter="tags:dev-*" --limit=10

# Check git history for commit SHAs
git log --oneline develop -n 10
```

---

## Common Issues

### Build Fails: File Not Found

**Error:**
```
COPY failed: file not found in build context
```

**Cause:** Using `elara-platform/` prefix in Dockerfile

**Fix:** Remove prefix
```dockerfile
# ❌ WRONG
COPY elara-platform/packages/backend ./

# ✅ CORRECT
COPY packages/backend ./
```

---

### Deployment Fails: Container Not Found

**Error:**
```
error: unable to find container named "elara-frontend"
```

**Cause:** Wrong container name in `kubectl set image`

**Fix:** Use correct container name
```yaml
# ❌ WRONG
kubectl set image deployment/elara-frontend elara-frontend=...

# ✅ CORRECT
kubectl set image deployment/elara-frontend frontend=...
```

---

### Frontend Can't Reach Backend

**Cause:** VITE_API_URL set to non-existent hostname

**Fix:**
```yaml
# In gcp-config/cloudbuild-*.yaml
--build-arg
VITE_API_URL=/api  # ✅ Use relative path for nginx proxy
```

---

## Adding a New Environment

To add a new environment (e.g., `qa`):

1. **Create workflow:** `.github/workflows/deploy-qa.yml`
   - Copy from `deploy-development.yml`
   - Change branch trigger to `qa`
   - Change `CLOUD_BUILD_CONFIG` to `gcp-config/cloudbuild-qa.yaml`

2. **Create Cloud Build config:** `gcp-config/cloudbuild-qa.yaml`
   - Copy from `cloudbuild-dev.yaml`
   - Change `_ENV` to `qa`
   - Update namespace substitutions to `elara-*-qa`
   - Set `VITE_ENVIRONMENT=qa`

3. **Create GKE namespaces:**
   ```bash
   kubectl create namespace elara-backend-qa
   kubectl create namespace elara-frontend-qa
   kubectl create namespace elara-workers-qa
   kubectl create namespace elara-proxy-qa
   ```

4. **Create deployments and services in new namespaces**

5. **Create LoadBalancer service for frontend:**
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: elara-frontend-lb
     namespace: elara-frontend-qa
   spec:
     type: LoadBalancer
     selector:
       app: elara-frontend
     ports:
       - port: 80
         targetPort: 8080
   ```

6. **Push to `qa` branch to trigger deployment**

---

## Best Practices

### 1. Test Locally Before Pushing

```bash
# Build Docker image locally
docker build -f gcp-config/docker/Dockerfile.frontend \
  --build-arg VITE_API_URL=/api \
  --build-arg VITE_ENVIRONMENT=development \
  .

# Test that it runs
docker run -p 8080:8080 <IMAGE_ID>
```

### 2. Use Feature Branches

```
feature/add-dashboard → develop → staging → main
```

### 3. Review Cloud Build Config Changes Carefully

Changes to `cloudbuild-*.yaml` affect deployments. Always review:
- Build arg values (especially `VITE_API_URL`)
- Container names in `kubectl set image`
- COPY paths in Dockerfiles

### 4. Monitor Deployments

Don't assume deployment succeeded. Check:
```bash
kubectl get pods -n elara-frontend-dev
kubectl logs -n elara-frontend-dev deployment/elara-frontend
```

### 5. Keep Secrets Secure

- Never commit service account keys to git
- Rotate `GCP_SA_KEY` periodically
- Use least-privilege service accounts

---

## Summary

**Pipeline Flow:**
1. Push to `develop` or `staging`
2. GitHub Actions authenticates to GCP
3. Cloud Build builds 4 Docker images in parallel
4. Images tagged with `{env}-{sha}` and `{env}-latest`
5. Images pushed to GCR
6. Kubernetes deployments updated via `kubectl set image`
7. Rolling update performed
8. New pods start, old pods terminate

**Key Files:**
- `.github/workflows/deploy-*.yml` - GitHub Actions workflows
- `gcp-config/cloudbuild-*.yaml` - Cloud Build configurations
- `gcp-config/docker/Dockerfile.*` - Docker image definitions

**Critical Rules:**
- Build context is repo root
- No `elara-platform/` prefix in COPY commands
- `VITE_API_URL` must be `/api` in deployed environments
- Container name is `frontend`, not `elara-frontend`

---

**Last Updated:** October 15, 2025
