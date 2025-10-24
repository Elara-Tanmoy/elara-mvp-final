# Elara Platform - Repository Structure

**Last Updated:** October 15, 2025
**Purpose:** Guide for understanding the Elara platform monorepo structure

---

## Overview

This is a **monorepo** containing all Elara platform components:
- Frontend (React/Vite)
- Backend API (Node.js/Express)
- Background Workers (BullMQ)
- Proxy Service (Python/Flask)
- Shared code and types
- Infrastructure-as-Code (Terraform)
- CI/CD configurations

---

## Repository Root Structure

```
elara-platform/
├── .github/                    # GitHub Actions workflows
│   └── workflows/
│       ├── deploy-development.yml   # Auto-deploy to DEV on push to develop branch
│       └── deploy-staging.yml       # Auto-deploy to STAGING on push to staging branch
│
├── gcp-config/                 # GCP deployment configurations
│   ├── cloudbuild-dev.yaml     # Cloud Build config for DEV environment
│   ├── cloudbuild-staging.yaml # Cloud Build config for STAGING environment
│   ├── docker/                 # Dockerfiles for all services
│   │   ├── Dockerfile.backend  # Backend API container
│   │   ├── Dockerfile.frontend # Frontend (Nginx + React build)
│   │   ├── Dockerfile.worker   # BullMQ worker container
│   │   └── Dockerfile.proxy    # Python proxy service
│   └── k8s/                    # Kubernetes manifests (if any)
│
├── gcp-infrastructure/         # Terraform infrastructure code
│   ├── main.tf                 # Main Terraform configuration
│   ├── variables.tf            # Variable definitions
│   ├── outputs.tf              # Output values
│   └── modules/                # Terraform modules
│
├── packages/                   # Monorepo packages
│   ├── backend/               # Node.js Backend API
│   ├── frontend/              # React Frontend
│   ├── shared/                # Shared TypeScript types/utilities
│   └── proxy-service/         # Python proxy service
│
├── package.json               # Root package.json (workspace config)
├── pnpm-workspace.yaml        # pnpm workspace configuration
├── pnpm-lock.yaml            # pnpm lockfile
└── [Multiple .md files]      # Documentation (see below)
```

---

## Package Details

### 1. packages/backend/

**Tech Stack:** Node.js, Express, TypeScript, Prisma, PostgreSQL

```
packages/backend/
├── src/
│   ├── index.ts              # Main entry point
│   ├── routes/               # API route handlers
│   │   └── v2/              # API v2 routes
│   │       ├── auth.ts      # Authentication routes
│   │       ├── scan.ts      # URL scanning routes
│   │       ├── admin.ts     # Admin panel routes
│   │       └── ...
│   ├── services/             # Business logic services
│   ├── workers/              # BullMQ worker definitions
│   │   └── index.ts         # Worker entry point
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utility functions
│   └── config/               # Configuration files
│
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
│
├── package.json
└── tsconfig.json
```

**Key Files:**
- `src/index.ts`: Express server setup, starts on port 3001
- `src/workers/index.ts`: BullMQ workers for background jobs
- `prisma/schema.prisma`: Database schema (PostgreSQL)

**Environment Variables:** See `.env` file (not in repo, created during setup)

---

### 2. packages/frontend/

**Tech Stack:** React, TypeScript, Vite, TailwindCSS

```
packages/frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component
│   ├── components/           # React components
│   │   ├── EnvironmentBanner.tsx  # DEV/STAGING banner
│   │   ├── LayoutAccessible.tsx   # Main layout
│   │   └── ...
│   ├── contexts/             # React contexts (auth, etc.)
│   ├── lib/
│   │   └── api.ts           # Axios API client
│   ├── pages/                # Page components
│   └── styles/               # CSS/Tailwind styles
│
├── public/                   # Static assets
├── .env.development          # Dev environment vars
├── .env.staging              # Staging environment vars
├── .env.production           # Production environment vars
├── package.json
├── vite.config.ts           # Vite configuration
└── tailwind.config.js       # Tailwind CSS config
```

**Key Files:**
- `src/lib/api.ts`: Axios instance with baseURL from `VITE_API_URL`
- `src/components/EnvironmentBanner.tsx`: Shows banner in DEV/STAGING
- `vite.config.ts`: Build configuration

**Environment Variables:**
- `VITE_API_URL`: Backend API URL (e.g., `/api` for relative proxy)
- `VITE_ENVIRONMENT`: Environment name (development, staging, production)

---

### 3. packages/shared/

**Tech Stack:** TypeScript

```
packages/shared/
├── src/
│   ├── types/                # Shared TypeScript types
│   ├── utils/                # Shared utility functions
│   └── constants/            # Shared constants
│
├── package.json
└── tsconfig.json
```

Used by both backend and frontend for type safety.

---

### 4. packages/proxy-service/

**Tech Stack:** Python, Flask, Gunicorn

```
packages/proxy-service/
├── app.py                    # Flask application
├── requirements.txt          # Python dependencies
├── config.py                 # Configuration
└── services/                 # Proxy logic
```

**Purpose:** Enterprise browser isolation proxy service

---

## GCP Deployment Structure

### Environments

1. **Production** (`main` branch)
   - Frontend: http://34.36.48.252/ (via Vercel fallback)
   - Backend: GKE cluster `elara-backend` namespace
   - Database: Cloud SQL PostgreSQL (production instance)

2. **Staging** (`staging` branch)
   - Frontend: http://34.83.95.127/
   - Backend: GKE `elara-backend-staging` namespace
   - Database: Shared with production (same Cloud SQL)
   - Workflow: `.github/workflows/deploy-staging.yml`

3. **Development** (`develop` branch)
   - Frontend: http://136.117.33.149/
   - Backend: GKE `elara-backend-dev` namespace
   - Database: Shared with production (same Cloud SQL)
   - Workflow: `.github/workflows/deploy-development.yml`

### GCP Resources

**Project ID:** `elara-mvp-13082025-u1`
**Region:** `us-west1`
**GKE Cluster:** `elara-gke-us-west1`

**Namespaces:**
- `elara-backend` (production)
- `elara-backend-staging`
- `elara-backend-dev`
- `elara-frontend` (production)
- `elara-frontend-staging`
- `elara-frontend-dev`
- `elara-workers`, `elara-workers-staging`, `elara-workers-dev`
- `elara-proxy`, `elara-proxy-staging`, `elara-proxy-dev`

**Container Registry:** `gcr.io/elara-mvp-13082025-u1/`

Images:
- `backend-api:dev-latest`, `backend-api:staging-latest`, etc.
- `frontend:dev-latest`, `frontend:staging-latest`, etc.
- `worker:dev-latest`, `worker:staging-latest`, etc.
- `proxy:dev-latest`, `proxy:staging-latest`, etc.

---

## CI/CD Workflow

### How It Works

1. **Code Push**
   - Push to `develop` → Triggers `deploy-development.yml`
   - Push to `staging` → Triggers `deploy-staging.yml`
   - Push to `main` → Manual deployment (not automated yet)

2. **GitHub Actions**
   - Authenticates to GCP using `GCP_SA_KEY` secret
   - Triggers Cloud Build with appropriate config file

3. **Cloud Build**
   - Builds 4 Docker images in parallel:
     - Backend API (Node.js with tsx)
     - Frontend (React build + Nginx)
     - Worker (BullMQ workers)
     - Proxy (Python Flask)
   - Tags images with `${ENV}-${SHORT_SHA}` and `${ENV}-latest`
   - Pushes to GCR
   - Deploys to GKE using `kubectl set image`

4. **Deployment**
   - Kubernetes rolling update
   - Pods pull new images from GCR
   - Health checks verify deployment

---

## Important Configuration Files

### Docker Build Context

**CRITICAL:** All Dockerfiles use the **repository root** as build context.

**Correct COPY paths in Dockerfiles:**
```dockerfile
# ✅ CORRECT
COPY packages/backend ./packages/backend
COPY packages/frontend ./packages/frontend

# ❌ WRONG (will fail)
COPY elara-platform/packages/backend ./packages/backend
```

### Frontend API Configuration

**Frontend must use relative `/api` path:**

In `gcp-config/cloudbuild-dev.yaml` and `cloudbuild-staging.yaml`:
```yaml
--build-arg
VITE_API_URL=/api  # ✅ CORRECT - uses nginx proxy
```

**NOT:**
```yaml
VITE_API_URL=http://dev.elara.internal/api  # ❌ WRONG - doesn't exist
```

The frontend pod has nginx configured to proxy `/api/*` to the backend service.

### Container Names in Deployments

When using `kubectl set image`:
```bash
# ✅ CORRECT
kubectl set image deployment/elara-frontend frontend=gcr.io/...

# ❌ WRONG
kubectl set image deployment/elara-frontend elara-frontend=gcr.io/...
```

The container name is `frontend`, not `elara-frontend`.

---

## Documentation Files

The root directory contains many `.md` files documenting various features and fixes. Key files:

- `README.md` - Main project overview
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `COMPREHENSIVE_PROJECT_DOCUMENTATION.md` - Detailed project docs
- `REPOSITORY_STRUCTURE.md` (this file) - Repository structure guide
- `CI_CD_GUIDE.md` - CI/CD workflow guide
- `TROUBLESHOOTING.md` - Common issues and solutions
- `FOR_CLAUDE_SESSIONS.md` - Instructions for AI assistants

---

## Branch Strategy

- `main` - Production releases
- `staging` - Pre-production testing
- `develop` - Active development
- Feature branches → `develop` → `staging` → `main`

---

## Common Paths for Claude Sessions

When navigating this repository, these are the most frequently accessed files:

**Backend:**
- `packages/backend/src/index.ts`
- `packages/backend/src/routes/v2/`
- `packages/backend/prisma/schema.prisma`

**Frontend:**
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/components/`

**CI/CD:**
- `.github/workflows/deploy-development.yml`
- `.github/workflows/deploy-staging.yml`
- `gcp-config/cloudbuild-dev.yaml`
- `gcp-config/cloudbuild-staging.yaml`

**Docker:**
- `gcp-config/docker/Dockerfile.backend`
- `gcp-config/docker/Dockerfile.frontend`
- `gcp-config/docker/Dockerfile.worker`
- `gcp-config/docker/Dockerfile.proxy`

---

## Next Steps

For new Claude Code sessions:
1. Read this file first
2. Read `FOR_CLAUDE_SESSIONS.md` for specific instructions
3. Check `TROUBLESHOOTING.md` if issues arise
4. Review `CI_CD_GUIDE.md` before modifying workflows

---

**Remember:** This is a **monorepo**. Never add path prefixes like `elara-platform/` in Docker COPY commands or imports.
