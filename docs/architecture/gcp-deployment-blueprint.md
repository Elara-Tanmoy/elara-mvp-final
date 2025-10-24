# Elara Platform - GCP End-to-End Deployment Blueprint

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Solution Architect (Claude Code)
**Status**: Production
**Classification**: Technical Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure Architecture](#infrastructure-architecture)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Deployment Flow](#deployment-flow)
5. [Container Build Process](#container-build-process)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Network Architecture](#network-architecture)
8. [Security & IAM](#security--iam)
9. [Monitoring & Logging](#monitoring--logging)
10. [Disaster Recovery](#disaster-recovery)
11. [Scaling Strategies](#scaling-strategies)
12. [Cost Optimization](#cost-optimization)
13. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

This document provides a comprehensive end-to-end blueprint for deploying the Elara platform on Google Cloud Platform (GCP). It covers the complete deployment lifecycle from code commit to production rollout.

### Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Version Control** | GitHub | Source code repository |
| **CI/CD** | GitHub Actions + Cloud Build | Automated deployment pipeline |
| **Container Registry** | Google Container Registry (GCR) | Docker image storage |
| **Orchestration** | Google Kubernetes Engine (GKE) | Container orchestration |
| **Database** | Cloud SQL PostgreSQL 15 | Primary database |
| **Cache** | Cloud Memorystore Redis 7.0 | Cache and job queue |
| **Load Balancing** | Cloud Load Balancer | Traffic distribution |
| **Security** | Cloud Armor | DDoS protection, WAF |
| **Monitoring** | Cloud Monitoring/Logging | Observability |

### Deployment Environments

| Environment | Branch | Database | Namespaces | Load Balancer |
|-------------|--------|----------|-----------|---------------|
| **Production** | `main` | elara_production | elara-backend, elara-frontend, elara-proxy, elara-workers | 34.36.48.252 |
| **Development** | `develop` | elara_dev | elara-backend-dev, elara-frontend-dev, elara-proxy-dev, elara-workers-dev | 35.199.176.26 (backend), 136.117.33.149 (frontend) |
| **Staging** | N/A | elara_staging | None (dormant) | N/A |

---

## Infrastructure Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                ┌────────▼─────────┐
                │  Cloud Armor     │ ← DDoS Protection, WAF
                │  Rate Limiting   │
                └────────┬─────────┘
                         │
                ┌────────▼─────────┐
                │  Cloud Load      │ ← Global HTTPS LB
                │  Balancer        │   34.36.48.252
                └────────┬─────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼────┐                   ┌──────▼──────┐
    │ Frontend│                   │   Ingress   │
    │ Pods    │                   │   (Backend) │
    └─────────┘                   └──────┬──────┘
                                          │
                    ┌─────────────────────┼─────────────────┐
                    │                     │                 │
               ┌────▼────┐         ┌──────▼──────┐   ┌─────▼─────┐
               │ Backend │         │   Workers   │   │   Proxy   │
               │  Pods   │         │    Pods     │   │   Pods    │
               └────┬────┘         └──────┬──────┘   └─────┬─────┘
                    │                     │                 │
         ┌──────────┴──────────┬──────────┴──────┬──────────┴────┐
         │                     │                 │                │
    ┌────▼────┐          ┌─────▼─────┐    ┌─────▼─────┐   ┌──────▼─────┐
    │Cloud SQL│          │   Redis   │    │  ChromaDB │   │   Secrets  │
    │PostgreSQL│         │Memorystore│    │StatefulSet│   │  Manager   │
    └─────────┘          └───────────┘    └───────────┘   └────────────┘
```

### Core Infrastructure Components

#### 1. GCP Project

**Project ID**: `elara-mvp-13082025-u1`
**Region**: `us-west1`
**Zone**: `us-west1-a` (for zonal resources)

#### 2. Cloud SQL PostgreSQL

| Configuration | Value |
|--------------|-------|
| **Instance Name** | elara-postgres-optimized |
| **Version** | PostgreSQL 15 |
| **Tier** | db-custom-2-7680 (2 vCPU, 7.5GB RAM) |
| **Storage** | 100GB SSD |
| **Availability** | ZONAL |
| **Backup** | Daily at 03:00 UTC, 7-day retention |
| **PITR** | 7-day transaction log retention |
| **Private IP** | 10.190.1.11 |

**Databases**:
- `elara_production` - Production data
- `elara_dev` - Development data
- `elara_staging` - Staging data (dormant)
- `elara_threat_intel` - Shared threat intelligence (200K+ indicators)

#### 3. Cloud Memorystore Redis

| Configuration | Value |
|--------------|-------|
| **Instance Name** | elara-redis-primary |
| **Version** | Redis 7.0 |
| **Tier** | STANDARD_HA (High Availability) |
| **Memory** | 5 GB |
| **Private IP** | 10.190.0.4 |

**Use Cases**:
- Session storage
- Cache layer
- BullMQ job queue
- Rate limiting

#### 4. Google Kubernetes Engine (GKE)

| Configuration | Value |
|--------------|-------|
| **Cluster Name** | elara-gke-us-west1 |
| **Mode** | Autopilot |
| **Location** | us-west1 (regional) |
| **Master Version** | 1.33.5-gke.1080000 |
| **Node Count** | 5 nodes (auto-scaled) |
| **Workload Identity** | Enabled |

**Autopilot Benefits**:
- Fully managed nodes
- Automatic scaling
- Built-in security hardening
- Optimized resource allocation
- No node maintenance required

#### 5. Networking

**VPC**: `elara-vpc`

**Subnets**:
| Subnet | CIDR | Purpose |
|--------|------|---------|
| gke-nodes-us-west1 | 10.10.0.0/24 | GKE node primary IPs |
| data-layer-us-west1 | 10.20.0.0/24 | Database tier |
| cloudrun-us-west1 | 10.30.0.0/28 | Cloud Run (if needed) |
| GKE pods (secondary) | 10.1.0.0/16 | Pod IPs |
| GKE services (secondary) | 10.2.0.0/20 | ClusterIP service IPs |

**VPC Peering**:
- Range: 10.190.0.0/24 (for Cloud SQL and Redis)

**NAT Gateway**:
- Router: elara-vpc-router-us-west1
- NAT: elara-vpc-nat-us-west1
- Static IPs: 34.82.164.36, 34.168.119.72

**Load Balancers**:
| Name | IP | Type | Purpose |
|------|-----|------|---------|
| elara-global-lb-ip | 34.36.48.252 | Global HTTPS | Production |
| elara-dev-backend-ip | 35.199.176.26 | Regional L4 | Dev backend |
| elara-dev-frontend-ip | 136.117.33.149 | Regional L4 | Dev frontend |

---

## CI/CD Pipeline

### Pipeline Architecture

```
┌──────────────┐
│   Git Push   │
│  to Branch   │
└──────┬───────┘
       │
       ├─── main branch ──────────────────────┐
       │                                      │
       │    ┌───────────────────────┐  ┌──────▼──────┐
       │    │  GitHub Actions       │  │   Build     │
       │    │  .github/workflows/   │  │   Matrix    │
       │    │  deploy-production.yml│  │   Strategy  │
       │    └───────────────────────┘  └──────┬──────┘
       │                                      │
       │              ┌───────────────────────┼────────────────┬─────────┐
       │              │                       │                │         │
       │         ┌────▼────┐           ┌──────▼──────┐  ┌──────▼───┐ ┌──▼─────┐
       │         │ Backend │           │   Worker    │  │  Proxy   │ │Frontend│
       │         │  Build  │           │    Build    │  │  Build   │ │ Build  │
       │         └────┬────┘           └──────┬──────┘  └──────┬───┘ └──┬─────┘
       │              │                       │                │         │
       │         ┌────▼────┐           ┌──────▼──────┐  ┌──────▼───┐ ┌──▼─────┐
       │         │  Trivy  │           │   Trivy     │  │  Trivy   │ │ Trivy  │
       │         │  Scan   │           │   Scan      │  │  Scan    │ │ Scan   │
       │         └────┬────┘           └──────┬──────┘  └──────┬───┘ └──┬─────┘
       │              │                       │                │         │
       │              └───────────────────────┴────────────────┴─────────┘
       │                                      │
       │                              ┌───────▼────────┐
       │                              │  Push to GCR   │
       │                              │  gcr.io/...    │
       │                              └───────┬────────┘
       │                                      │
       │                              ┌───────▼────────┐
       │                              │ Kustomize Set  │
       │                              │  Image Tags    │
       │                              └───────┬────────┘
       │                                      │
       │                              ┌───────▼────────┐
       │                              │  kubectl apply │
       │                              │    -k prod     │
       │                              └───────┬────────┘
       │                                      │
       │                              ┌───────▼────────┐
       │                              │  Rollout Wait  │
       │                              │  Smoke Tests   │
       │                              └───────┬────────┘
       │                                      │
       │                              ┌───────▼────────┐
       │                              │    Notify      │
       │                              └────────────────┘
       │
       └─── develop branch ──────────────────┐
                                             │
                        ┌────────────────────▼────────────────┐
                        │  GitHub Actions                     │
                        │  .github/workflows/deploy-dev.yml   │
                        └────────────────────┬────────────────┘
                                             │
                        ┌────────────────────▼────────────────┐
                        │  Cloud Build                        │
                        │  infrastructure/cloudbuild/dev.yaml │
                        └────────────────────┬────────────────┘
                                             │
                        ┌────────────────────▼────────────────┐
                        │  Deploy to GKE Dev Namespace        │
                        └─────────────────────────────────────┘
```

### GitHub Actions Workflows

#### Production Workflow

**File**: `.github/workflows/deploy-production.yml`

**Trigger**:
- Push to `main` branch
- Manual dispatch with service selection

**Jobs**:

1. **Build Job** (Matrix Strategy)
   - Runs for each service: backend, worker, proxy, frontend
   - Checks out code from 3 repositories
   - Builds Docker images
   - Scans with Trivy (security vulnerabilities)
   - Pushes to GCR with version tags
   - Parallel execution (4 builds simultaneously)

2. **Deploy Job**
   - Waits for build completion
   - Authenticates to GCP
   - Gets GKE credentials
   - Updates Kustomize image tags
   - Applies Kubernetes manifests
   - Waits for rollout completion
   - Runs smoke tests

3. **Notify Job**
   - Sends deployment status notification
   - Always runs (success or failure)

**Environment Variables**:
```yaml
PROJECT_ID: elara-mvp-13082025-u1
GKE_CLUSTER: elara-gke-us-west1
GKE_REGION: us-west1
GCR_REGISTRY: gcr.io
```

#### Development Workflow

**File**: `.github/workflows/deploy-dev.yml`

**Trigger**:
- Push to `develop` branch
- Manual dispatch

**Process**:
1. Checkout code
2. Authenticate to GCP
3. Trigger Cloud Build with `dev.yaml` config
4. Cloud Build handles build + deploy
5. Output deployment summary

### Secrets Configuration

**GitHub Secrets Required**:

| Secret | Description | Usage |
|--------|-------------|-------|
| `GCP_SA_KEY` | Service account JSON key | GCP authentication |
| `GCP_PROJECT_ID` | Project ID | GCP project identification |
| `GH_PAT` | GitHub Personal Access Token | Cross-repo checkout |

**Service Account Permissions**:
- Storage Admin (GCR push)
- Kubernetes Engine Admin (GKE deploy)
- Cloud Build Editor (trigger builds)
- Service Account User

---

## Deployment Flow

### Production Deployment (main branch)

#### Step-by-Step Flow

```
Developer → Git Commit → Git Push (main) → GitHub → GitHub Actions
                                                            ↓
                                                    ┌───────────────┐
                                                    │  1. Checkout  │
                                                    │     Code      │
                                                    └───────┬───────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  2. Build Matrix (4x)     │
                                              │     - Backend             │
                                              │     - Worker              │
                                              │     - Proxy               │
                                              │     - Frontend            │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  3. Docker Build          │
                                              │     docker/Dockerfile.*   │
                                              │     Build args:           │
                                              │     VITE_API_URL          │
                                              │     VITE_WS_URL           │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  4. Security Scan         │
                                              │     Trivy (CRITICAL/HIGH) │
                                              │     Upload SARIF          │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  5. Push to GCR           │
                                              │     gcr.io/PROJECT/       │
                                              │       SERVICE:VERSION     │
                                              │       SERVICE:latest      │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  6. Update Kustomize      │
                                              │     Set image tags        │
                                              │     in overlays/prod      │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  7. kubectl apply         │
                                              │     -k kubernetes/        │
                                              │     overlays/production   │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  8. Rollout Status        │
                                              │     Wait for:             │
                                              │     - elara-api           │
                                              │     - elara-worker        │
                                              │     - elara-proxy         │
                                              │     - chromadb            │
                                              │     Timeout: 5min each    │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  9. Smoke Tests           │
                                              │     Health check          │
                                              │     GET /health           │
                                              └─────────────┬─────────────┘
                                                            ↓
                                              ┌─────────────┴─────────────┐
                                              │  10. Notify               │
                                              │      Success/Failure      │
                                              └───────────────────────────┘
```

#### Timeline Breakdown

| Stage | Duration | Notes |
|-------|----------|-------|
| Checkout | ~30s | Download code from 3 repos |
| Docker Build (parallel) | 5-8 min | 4 services built simultaneously |
| Security Scan | 2-3 min | Trivy vulnerability scan |
| Push to GCR | 1-2 min | Upload images to registry |
| Kustomize + Apply | 30s | Update manifests and apply |
| Rollout Wait | 2-5 min | Wait for pods to be ready |
| Smoke Tests | 30s | Health check verification |
| **Total** | **12-20 min** | End-to-end deployment time |

### Development Deployment (develop branch)

#### Step-by-Step Flow

```
Developer → Git Commit → Git Push (develop) → GitHub → GitHub Actions
                                                               ↓
                                                    ┌──────────┴────────┐
                                                    │  1. Checkout Code │
                                                    └──────────┬────────┘
                                                               ↓
                                                    ┌──────────┴────────┐
                                                    │  2. Auth GCP      │
                                                    └──────────┬────────┘
                                                               ↓
                                                    ┌──────────┴────────┐
                                                    │  3. Trigger       │
                                                    │     Cloud Build   │
                                                    │     dev.yaml      │
                                                    └──────────┬────────┘
                                                               ↓
                          ┌────────────────────────────────────┴────────────────────┐
                          │              Cloud Build Execution                      │
                          │  ┌──────────────────────────────────────────────────┐  │
                          │  │  1. Build Docker Images                          │  │
                          │  │  2. Push to GCR                                  │  │
                          │  │  3. Deploy to GKE (dev namespaces)               │  │
                          │  │  4. Update LoadBalancer services                 │  │
                          │  └──────────────────────────────────────────────────┘  │
                          └────────────────────────────┬────────────────────────────┘
                                                       ↓
                                            ┌──────────┴────────┐
                                            │  4. Deployment    │
                                            │     Summary       │
                                            │  Backend: IP      │
                                            │  Frontend: IP     │
                                            └───────────────────┘
```

#### Timeline Breakdown

| Stage | Duration | Notes |
|-------|----------|-------|
| Checkout + Auth | ~30s | Authenticate to GCP |
| Cloud Build | 8-12 min | Build all services, push to GCR |
| Deploy to GKE | 2-3 min | Apply manifests, wait for rollout |
| **Total** | **11-16 min** | End-to-end dev deployment |

---

## Container Build Process

### Docker Build Strategy

#### Multi-Stage Builds

All services use multi-stage Docker builds for optimization:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

#### Service-Specific Dockerfiles

**Backend** (`docker/Dockerfile.backend`):
- Base: node:20-alpine
- Prisma client generation
- Exposes port 3000
- Runs Express server

**Worker** (`docker/Dockerfile.worker`):
- Base: node:20-alpine
- BullMQ worker initialization
- No exposed ports (connects to Redis)
- Processes background jobs

**Proxy** (`docker/Dockerfile.proxy`):
- Base: node:20-alpine
- Reverse proxy configuration
- Exposes port 8080
- Handles request routing

**Frontend** (`docker/Dockerfile.frontend`):
- Base: node:20-alpine (build), nginx:alpine (runtime)
- Vite build process
- Build args: VITE_API_URL, VITE_WS_URL
- Exposes port 80
- Serves static assets via nginx

### Image Tagging Strategy

```
gcr.io/PROJECT_ID/SERVICE:VERSION
gcr.io/PROJECT_ID/SERVICE:latest
```

**Version Format**: `v1.0.YYYYMMDD-HHMMSS`

Example:
```
gcr.io/elara-mvp-13082025-u1/backend:v1.0.20251024-143022
gcr.io/elara-mvp-13082025-u1/backend:latest
```

**Benefits**:
- Immutable versioned images
- Easy rollback to specific versions
- Latest tag for quick reference

### Security Scanning (Trivy)

**Configuration**:
```yaml
- name: Image scan (Trivy)
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: gcr.io/PROJECT/SERVICE:VERSION
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '0'  # Log only, don't fail
```

**Scan Results**:
- Uploaded to GitHub Security tab
- SARIF format for integration
- Scans for: CVEs, misconfigurations, secrets
- Reports CRITICAL and HIGH vulnerabilities
- Non-blocking (informational)

### Build Caching

**GitHub Actions Cache**:
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**Benefits**:
- Speeds up builds by 40-60%
- Caches Docker layers across runs
- Shared across branches
- Automatic cache invalidation

---

## Kubernetes Deployment

### Namespace Architecture

#### Production Namespaces

| Namespace | Services | Purpose |
|-----------|----------|---------|
| **elara-backend** | elara-api, chromadb | Backend API and vector DB |
| **elara-frontend** | elara-frontend | React frontend application |
| **elara-proxy** | elara-proxy | Reverse proxy service |
| **elara-workers** | elara-worker | BullMQ background workers |

#### Development Namespaces

| Namespace | Services | Purpose |
|-----------|----------|---------|
| **elara-backend-dev** | elara-api, chromadb | Dev backend API |
| **elara-frontend-dev** | elara-frontend | Dev frontend |
| **elara-proxy-dev** | elara-proxy | Dev proxy |
| **elara-workers-dev** | elara-worker | Dev workers |

### Deployment Manifests

**Kustomize Structure**:
```
kubernetes/
├── base/
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── worker/
│   ├── proxy/
│   └── frontend/
└── overlays/
    ├── production/
    │   └── kustomization.yaml
    └── development/
        └── kustomization.yaml
```

**Example Deployment** (backend):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elara-api
  namespace: elara-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: elara-api
  template:
    metadata:
      labels:
        app: elara-api
    spec:
      serviceAccountName: elara-api-sa
      containers:
      - name: api
        image: gcr.io/elara-mvp-13082025-u1/backend:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: elara-db-secret
              key: connection-string
        - name: REDIS_URL
          value: "redis://10.190.0.4:6379"
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "1000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service Configuration

**Backend Service** (ClusterIP):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: elara-api-service
  namespace: elara-backend
spec:
  type: ClusterIP
  selector:
    app: elara-api
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
```

**Frontend Service** (Dev LoadBalancer):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: elara-frontend-lb
  namespace: elara-frontend-dev
spec:
  type: LoadBalancer
  loadBalancerIP: 136.117.33.149
  selector:
    app: elara-frontend
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
```

### Ingress Configuration

**Production Ingress** (Global Load Balancer):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: elara-ingress
  namespace: elara-backend
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "elara-global-lb-ip"
    networking.gke.io/managed-certificates: "elara-ssl-cert"
    kubernetes.io/ingress.class: "gce"
    cloud.google.com/backend-config: '{"default": "elara-backend-config"}'
    cloud.google.com/armor-config: '{"elara-security-policy": ""}'
spec:
  rules:
  - http:
      paths:
      - path: /api/*
        pathType: ImplementationSpecific
        backend:
          service:
            name: elara-api-service
            port:
              number: 80
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: elara-frontend-direct-svc
            port:
              number: 80
```

### StatefulSet (ChromaDB)

**Vector Database**:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: chromadb
  namespace: elara-backend
spec:
  serviceName: chromadb
  replicas: 1
  selector:
    matchLabels:
      app: chromadb
  template:
    metadata:
      labels:
        app: chromadb
    spec:
      containers:
      - name: chromadb
        image: chromadb/chroma:latest
        ports:
        - containerPort: 8000
          name: http
        volumeMounts:
        - name: chromadb-data
          mountPath: /chroma/data
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
  volumeClaimTemplates:
  - metadata:
      name: chromadb-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### ConfigMaps and Secrets

**ConfigMap Example**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: elara-config
  namespace: elara-backend
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "http://34.36.48.252"
  RATE_LIMIT_WINDOW_MS: "60000"
  RATE_LIMIT_MAX_REQUESTS: "100"
```

**Secret Management**:
- Stored in Google Secret Manager
- Mounted as Kubernetes secrets via Workload Identity
- Never committed to Git
- Rotated quarterly

### Rollout Strategy

**Rolling Update**:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

**Zero Downtime Deployment**:
1. New ReplicaSet created with updated image
2. New pods spun up (1 at a time)
3. Wait for readiness probe success
4. Route traffic to new pods
5. Terminate old pods (1 at a time)
6. Total time: 2-5 minutes

**Rollback**:
```bash
# Automatic rollback on failure
kubectl rollout undo deployment/elara-api -n elara-backend

# Rollback to specific revision
kubectl rollout undo deployment/elara-api -n elara-backend --to-revision=3

# Check rollout history
kubectl rollout history deployment/elara-api -n elara-backend
```

---

## Network Architecture

### VPC Design

**CIDR Allocation**:

```
elara-vpc (us-west1)
│
├── gke-nodes-us-west1 (10.10.0.0/24)
│   └── 254 IPs for GKE nodes
│
├── data-layer-us-west1 (10.20.0.0/24)
│   └── 254 IPs for database tier
│
├── cloudrun-us-west1 (10.30.0.0/28)
│   └── 14 IPs for Cloud Run
│
├── GKE Pods (10.1.0.0/16) [Secondary Range]
│   └── 65,534 IPs for pods
│
└── GKE Services (10.2.0.0/20) [Secondary Range]
    └── 4,094 IPs for ClusterIP services

VPC Peering Range (10.190.0.0/24)
├── Cloud SQL (10.190.1.11)
└── Redis (10.190.0.4)
```

### Firewall Rules

**Key Rules** (14 total):

| Name | Priority | Direction | Target | Source | Ports | Purpose |
|------|----------|-----------|--------|--------|-------|---------|
| allow-health-checks | 1000 | INGRESS | All | 35.191.0.0/16, 130.211.0.0/22 | 80, 443 | GLB health checks |
| allow-internal | 1001 | INGRESS | All | 10.0.0.0/8 | All | Internal VPC traffic |
| allow-ssh-iap | 1002 | INGRESS | All | 35.235.240.0/20 | 22 | IAP for SSH |
| deny-all-egress | 65535 | EGRESS | All | 0.0.0.0/0 | All | Default deny |

**Security Posture**:
- Default deny all
- Explicit allow for required traffic
- IAP-only SSH access (no direct SSH)
- No public RDP/SSH endpoints

### Cloud Armor (WAF)

**Security Policy**: `elara-security-policy`

**Rules**:

1. **Rate Limiting**
   - Limit: 100 requests/min per IP
   - Action: Throttle (429 response)
   - Priority: 1000

2. **SQL Injection Protection**
   - OWASP ModSecurity CRS
   - Block: SQLi patterns
   - Priority: 2000

3. **XSS Protection**
   - Block: JavaScript injection patterns
   - Priority: 2001

4. **Geo-Blocking** (Optional)
   - Allow: US, EU, select countries
   - Deny: High-risk countries
   - Priority: 3000

5. **Default Rule**
   - Action: Allow
   - Priority: 2147483647

**Applied To**:
- Global Load Balancer backend services
- All ingress traffic to production

### NAT Gateway Configuration

**Purpose**: Provide outbound internet for GKE pods

**Configuration**:
- Router: elara-vpc-router-us-west1
- NAT: elara-vpc-nat-us-west1
- Static IPs:
  - 34.82.164.36
  - 34.168.119.72

**Use Cases**:
- Outbound API calls (threat intelligence feeds)
- Package downloads during pod startup
- External webhook notifications
- AI model API calls (Claude, GPT-4, Gemini)

---

## Security & IAM

### Workload Identity

**Enabled for all services** to securely access GCP resources without service account keys.

**Mapping**:
```
Kubernetes SA → GCP SA → IAM Roles

elara-api-sa (K8s)
  ↓
elara-api@PROJECT.iam.gserviceaccount.com (GCP)
  ↓
roles/cloudsql.client
roles/secretmanager.secretAccessor
roles/storage.objectViewer
roles/storage.objectCreator
```

### Service Accounts

#### 1. Backend API Service Account

**Name**: `elara-api@elara-mvp-13082025-u1.iam.gserviceaccount.com`

**Roles**:
- `roles/cloudsql.client` - Cloud SQL connection
- `roles/secretmanager.secretAccessor` - Access secrets
- `roles/storage.objectViewer` - Read from GCS
- `roles/storage.objectCreator` - Write to GCS
- `roles/logging.logWriter` - Write logs
- `roles/monitoring.metricWriter` - Write metrics

**Bound to**:
- K8s SA: `elara-api-sa` in `elara-backend` namespace
- K8s SA: `elara-api-sa` in `elara-backend-dev` namespace

#### 2. Worker Service Account

**Name**: `elara-worker@elara-mvp-13082025-u1.iam.gserviceaccount.com`

**Roles**:
- `roles/cloudsql.client` - Cloud SQL connection
- `roles/secretmanager.secretAccessor` - Access secrets
- `roles/storage.admin` - Full GCS access (large file processing)
- `roles/pubsub.publisher` - Publish events
- `roles/logging.logWriter` - Write logs

**Bound to**:
- K8s SA: `elara-worker-sa` in `elara-workers` namespace
- K8s SA: `elara-worker-sa` in `elara-workers-dev` namespace

#### 3. Proxy Service Account

**Name**: `elara-proxy@elara-mvp-13082025-u1.iam.gserviceaccount.com`

**Roles**:
- `roles/storage.objectCreator` - Upload scanned content
- `roles/logging.logWriter` - Write logs

**Bound to**:
- K8s SA: `elara-proxy-sa` in `elara-proxy` namespace

#### 4. Frontend Service Account

**Name**: `elara-frontend@elara-mvp-13082025-u1.iam.gserviceaccount.com`

**Roles**:
- `roles/logging.logWriter` - Write logs

**Bound to**:
- K8s SA: `elara-frontend-sa` in `elara-frontend` namespace

### Secret Management

**Google Secret Manager**:

| Secret Name | Description | Accessed By |
|-------------|-------------|-------------|
| `database-url-prod` | PostgreSQL connection string (production) | Backend, Worker |
| `database-url-dev` | PostgreSQL connection string (development) | Backend Dev, Worker Dev |
| `redis-url` | Redis connection string | Backend, Worker |
| `jwt-secret` | JWT signing secret | Backend |
| `anthropic-api-key` | Claude API key | Backend, Worker |
| `openai-api-key` | GPT-4 API key | Backend, Worker |
| `gemini-api-key` | Gemini API key | Backend, Worker |
| `oauth-google-client-secret` | Google OAuth secret | Backend |
| `oauth-facebook-client-secret` | Facebook OAuth secret | Backend |
| `oauth-linkedin-client-secret` | LinkedIn OAuth secret | Backend |

**Access Pattern**:
```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: elara-db-secret
      key: connection-string
```

**Rotation Policy**:
- Quarterly rotation for API keys
- Monthly rotation for JWT secrets
- Automatic rotation for OAuth credentials (via provider)

### Network Policies

**Example: Backend Network Policy**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: elara-api-netpol
  namespace: elara-backend
spec:
  podSelector:
    matchLabels:
      app: elara-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Allow from ingress controller
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  # Allow to Cloud SQL
  - to:
    - ipBlock:
        cidr: 10.190.1.11/32
    ports:
    - protocol: TCP
      port: 5432
  # Allow to Redis
  - to:
    - ipBlock:
        cidr: 10.190.0.4/32
    ports:
    - protocol: TCP
      port: 6379
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
  # Allow HTTPS egress (for API calls)
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
    ports:
    - protocol: TCP
      port: 443
```

---

## Monitoring & Logging

### Cloud Monitoring

**Metrics Collected**:

| Metric Type | Examples | Frequency |
|-------------|----------|-----------|
| **Infrastructure** | CPU, Memory, Disk, Network | 60s |
| **GKE** | Pod count, node health, PVC usage | 60s |
| **Database** | Connections, queries/sec, latency | 60s |
| **Redis** | Memory usage, hit rate, ops/sec | 60s |
| **Load Balancer** | Request rate, latency, errors | 60s |
| **Application** | Custom metrics via OpenTelemetry | 60s |

**Dashboards**:

1. **Infrastructure Overview**
   - GKE cluster health
   - Node utilization
   - Pod status across namespaces

2. **Application Performance**
   - Request latency (p50, p95, p99)
   - Error rate
   - Request volume

3. **Database Performance**
   - Query performance
   - Connection pool utilization
   - Slow query log

4. **Cost Analysis**
   - Compute costs by namespace
   - Storage costs
   - Network egress costs

### Cloud Logging

**Log Types**:

| Log Type | Source | Retention |
|----------|--------|-----------|
| **Application Logs** | Stdout/stderr from pods | 30 days |
| **Audit Logs** | GCP API calls | 400 days |
| **Access Logs** | Load balancer requests | 30 days |
| **System Logs** | GKE cluster events | 30 days |
| **Security Logs** | Cloud Armor events | 90 days |

**Log Aggregation**:
```json
{
  "jsonPayload": {
    "level": "info",
    "message": "User login successful",
    "userId": "clxxx123",
    "email": "user@example.com",
    "ipAddress": "203.0.113.1"
  },
  "resource": {
    "type": "k8s_container",
    "labels": {
      "project_id": "elara-mvp-13082025-u1",
      "namespace_name": "elara-backend",
      "pod_name": "elara-api-abc123",
      "container_name": "api"
    }
  },
  "timestamp": "2025-10-24T10:30:00.123Z"
}
```

**Structured Logging** (Winston):

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'elara-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console()
  ]
});

// Usage
logger.info('User registered', {
  userId: user.id,
  email: user.email,
  organizationId: org.id
});
```

### Alerting

**Alert Policies**:

1. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Notification: PagerDuty, Email
   - Severity: Critical

2. **High Latency**
   - Condition: P95 latency > 2s for 10 minutes
   - Notification: Slack, Email
   - Severity: Warning

3. **Low Memory**
   - Condition: Pod memory > 90% for 5 minutes
   - Notification: Slack
   - Severity: Warning

4. **Database Connection Pool Exhausted**
   - Condition: Active connections > 95% for 3 minutes
   - Notification: PagerDuty, Email
   - Severity: Critical

5. **SSL Certificate Expiry**
   - Condition: Certificate expires in < 30 days
   - Notification: Email
   - Severity: Warning

6. **Cloud Armor Threat Detected**
   - Condition: > 100 blocked requests/min
   - Notification: Security team email
   - Severity: High

### Health Checks

**Liveness Probe**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Implementation**:
```typescript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION
  });
});
```

**Readiness Probe**:
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

**Implementation**:
```typescript
app.get('/ready', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok',
        redis: 'ok'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});
```

---

## Disaster Recovery

### Backup Strategy

#### Database Backups

**Automated Backups**:
- **Frequency**: Daily at 03:00 UTC
- **Retention**: 7 days
- **Type**: Full backup
- **Location**: us-west1 region
- **Encryption**: Google-managed encryption

**Point-in-Time Recovery (PITR)**:
- **Enabled**: Yes
- **Window**: Last 7 days
- **Transaction Log Archiving**: Continuous
- **Recovery Time**: < 1 hour

**Manual Backup**:
```bash
gcloud sql backups create \
  --instance=elara-postgres-optimized \
  --project=elara-mvp-13082025-u1 \
  --description="Manual backup before migration"
```

**Restore from Backup**:
```bash
# List backups
gcloud sql backups list --instance=elara-postgres-optimized

# Restore from specific backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=elara-postgres-optimized \
  --backup-project=elara-mvp-13082025-u1
```

**Restore to Point-in-Time**:
```bash
gcloud sql backups restore \
  --instance=elara-postgres-optimized \
  --backup-project=elara-mvp-13082025-u1 \
  --point-in-time=2025-10-24T08:00:00.000Z
```

#### Application State Backups

**Persistent Volumes**:
- ChromaDB data: Daily snapshots
- Uploaded files: Stored in GCS (versioned)
- Redis: AOF persistence enabled

**GCS Versioning**:
```bash
gsutil versioning set on gs://elara-uploads-prod
gsutil versioning set on gs://elara-scan-results
```

### Recovery Procedures

#### Scenario 1: Pod Failure

**Detection**: Kubernetes liveness probe failure

**Automatic Recovery**:
1. Liveness probe fails 3 times
2. Kubernetes kills unhealthy pod
3. ReplicaSet creates new pod
4. Readiness probe validates new pod
5. Traffic routed to healthy pods

**Time to Recovery**: 30-60 seconds
**Data Loss**: None (stateless pods)

#### Scenario 2: Node Failure

**Detection**: Node becomes NotReady

**Automatic Recovery** (GKE Autopilot):
1. Kubernetes detects node failure
2. Pods marked as Unknown
3. After 5 minutes, pods evicted
4. Pods rescheduled to healthy nodes
5. GKE creates new node if needed

**Time to Recovery**: 5-10 minutes
**Data Loss**: None (pods rescheduled)

#### Scenario 3: Database Failure

**Detection**: Connection errors, monitoring alerts

**Recovery Steps**:
```bash
# 1. Verify issue
gcloud sql instances describe elara-postgres-optimized

# 2. Check logs
gcloud logging read "resource.type=cloudsql_database" --limit 100

# 3. Restart instance (if needed)
gcloud sql instances restart elara-postgres-optimized

# 4. If corruption detected, restore from backup
gcloud sql backups restore <BACKUP_ID> \
  --backup-instance=elara-postgres-optimized
```

**Time to Recovery**: 10-60 minutes (depending on restore)
**Data Loss**: Up to last 5 minutes (transaction log lag)

#### Scenario 4: Complete Region Failure

**Current State**: Single region (us-west1), ZONAL Cloud SQL

**Manual Recovery**:
1. Create new Cloud SQL instance in different region
2. Restore from latest backup
3. Update DNS to point to new region
4. Deploy application to new GKE cluster

**Time to Recovery**: 2-4 hours
**Data Loss**: Up to 24 hours (last backup)

**Recommendation for Production**: Upgrade to REGIONAL Cloud SQL for automatic HA

#### Scenario 5: Accidental Data Deletion

**Detection**: User report, audit logs

**Recovery Steps**:
```bash
# 1. Identify deletion time from audit logs
# 2. Stop application to prevent more changes
kubectl scale deployment/elara-api --replicas=0 -n elara-backend

# 3. Restore database to point before deletion
gcloud sql backups restore \
  --instance=elara-postgres-optimized \
  --point-in-time=2025-10-24T08:00:00.000Z

# 4. Verify data restored
# 5. Resume application
kubectl scale deployment/elara-api --replicas=3 -n elara-backend
```

**Time to Recovery**: 30-90 minutes
**Data Loss**: Data between PITR time and current time

### RTO and RPO Targets

| Scenario | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|----------|-------------------------------|--------------------------------|
| **Pod Failure** | 1 minute | 0 (no data loss) |
| **Node Failure** | 10 minutes | 0 (no data loss) |
| **Database Failure** | 30 minutes | 5 minutes |
| **Region Failure** | 4 hours | 24 hours |
| **Data Deletion** | 1 hour | Based on PITR window |

### Disaster Recovery Testing

**Quarterly DR Drills**:
1. Simulate database failure and restore
2. Test regional failover procedures
3. Validate backup integrity
4. Update runbooks based on findings

---

## Scaling Strategies

### Horizontal Pod Autoscaling (HPA)

**Backend API HPA**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: elara-api-hpa
  namespace: elara-backend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: elara-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
```

**Scaling Behavior**:
- Scale up: Aggressive (double pods or +2, whichever is less)
- Scale down: Conservative (50% reduction, wait 5 min)
- CPU threshold: 70%
- Memory threshold: 80%

**Worker HPA**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: elara-worker-hpa
  namespace: elara-workers
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: elara-worker
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: External
    external:
      metric:
        name: redis.queue.waiting_jobs
      target:
        type: AverageValue
        averageValue: "10"  # Scale up if >10 jobs per worker
```

**Custom Metrics**:
- Queue length from Redis
- BullMQ waiting jobs count
- Scale based on workload

### Vertical Pod Autoscaling (VPA)

**Recommendation Mode** (not applied automatically):

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: elara-api-vpa
  namespace: elara-backend
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: elara-api
  updatePolicy:
    updateMode: "Off"  # Recommendation only
  resourcePolicy:
    containerPolicies:
    - containerName: api
      minAllowed:
        cpu: "250m"
        memory: "512Mi"
      maxAllowed:
        cpu: "2000m"
        memory: "4Gi"
```

**Usage**: Review VPA recommendations monthly, adjust resource requests/limits

### GKE Autopilot Autoscaling

**Node Autoscaling**: Fully managed by GKE Autopilot

- Automatically adds nodes when pods can't be scheduled
- Automatically removes nodes when utilization is low
- No manual node pool configuration needed
- Cost-optimized machine types selected automatically

**Current State**: 5 nodes (auto-scaled from initial 3)

### Database Scaling

**Current Tier**: db-custom-2-7680 (2 vCPU, 7.5GB RAM)

**Vertical Scaling**:
```bash
# Upgrade to larger tier (requires downtime)
gcloud sql instances patch elara-postgres-optimized \
  --tier=db-custom-4-15360 \
  --project=elara-mvp-13082025-u1

# Downtime: 5-10 minutes
```

**Read Replicas** (not currently deployed):
```bash
# Create read replica for read-heavy workloads
gcloud sql instances create elara-postgres-replica-1 \
  --master-instance-name=elara-postgres-optimized \
  --tier=db-custom-2-7680 \
  --region=us-west1
```

**Connection Pooling**:
- Prisma default: 10 connections per pod
- 3 backend pods × 10 = 30 connections
- 3 worker pods × 10 = 30 connections
- Total: ~60 connections (60% of 100 max)
- Headroom: 40 connections available

### Redis Scaling

**Current Tier**: STANDARD_HA, 5GB

**Vertical Scaling**:
```bash
# Upgrade memory size
gcloud redis instances update elara-redis-primary \
  --size=10 \
  --region=us-west1

# No downtime with HA tier
```

**Horizontal Scaling**: Not supported in Memorystore, consider Redis Cluster if needed

### Load Balancer Capacity

**Global Load Balancer**: Automatically scales to handle traffic

- No capacity planning needed
- Handles millions of requests per second
- Automatic DDoS mitigation
- Global anycast IP

---

## Cost Optimization

### Current Monthly Costs (Estimated)

| Resource | Configuration | Est. Monthly Cost | Notes |
|----------|---------------|-------------------|-------|
| **GKE Autopilot** | 5 nodes (~20 vCPU, 40GB RAM) | $150-200 | Pay for pods, not nodes |
| **Cloud SQL** | db-custom-2-7680, 100GB | $120 | ZONAL (not HA) |
| **Redis** | STANDARD_HA, 5GB | $100 | HA enabled |
| **Load Balancer** | Global HTTPS | $20-30 | Forwarding rules + traffic |
| **Container Registry** | ~50GB storage | $10 | Image storage |
| **Cloud Monitoring** | Standard tier | $5-10 | Logs + metrics |
| **Network Egress** | ~500GB/month | $40-60 | Data transfer out |
| **Cloud Armor** | Policy + rules | $10-15 | WAF rules |
| **NAT Gateway** | 2 IPs + traffic | $30-40 | Outbound connectivity |
| **Total** | | **$485-585/month** | |

### Cost Optimization Strategies

#### 1. Use Committed Use Discounts

**GKE**:
```bash
# Purchase 1-year or 3-year commitments
# Save 25% (1-year) or 52% (3-year)
# Estimated savings: $40-100/month
```

#### 2. Rightsize Resources

**Current Overprovisioned**:
- Backend pods: 1GB memory requested, average usage 600MB
- Workers: 512MB requested, average usage 300MB

**Recommendation**:
```yaml
resources:
  requests:
    cpu: "250m"      # Reduced from 500m
    memory: "512Mi"  # Reduced from 1Gi
  limits:
    cpu: "500m"      # Reduced from 1000m
    memory: "1Gi"    # Reduced from 2Gi
```

**Estimated savings**: $30-50/month

#### 3. Use Preemptible Nodes for Dev

**Not applicable in Autopilot**, but for standard GKE:
- Use preemptible VMs for dev environment
- Save 60-80% on compute costs
- Automatically recreated when preempted

#### 4. Clean Up Old Images

```bash
# Delete images older than 90 days
gcloud container images list-tags gcr.io/elara-mvp-13082025-u1/backend \
  --format="get(digest)" \
  --filter="timestamp.datetime < $(date -d '90 days ago' --iso-8601)" \
  | xargs -I {} gcloud container images delete gcr.io/elara-mvp-13082025-u1/backend@{} --quiet
```

**Estimated savings**: $5-10/month

#### 5. Use Log Exclusion Filters

**Exclude non-essential logs**:
```
resource.type="k8s_container"
severity<="INFO"
NOT textPayload:"error"
```

**Estimated savings**: $3-5/month

#### 6. Optimize Network Egress

**Strategies**:
- Use Cloud CDN for static assets
- Compress responses
- Cache frequently accessed data
- Use regional load balancers for dev (not global)

**Estimated savings**: $10-20/month

#### 7. Downgrade Cloud SQL for Dev

**Current**: Both prod and dev use same db-custom-2-7680

**Recommendation**:
- Dev: db-f1-micro (shared CPU, 0.6GB RAM) - $8/month
- Prod: Keep current tier

**Estimated savings**: $110/month

#### 8. Schedule Dev Environment Downtime

```bash
# Scale down dev environment after hours (6pm-8am weekdays, weekends)
# Save ~50% on dev environment costs
kubectl scale deployment --all --replicas=0 -n elara-backend-dev
kubectl scale deployment --all --replicas=0 -n elara-workers-dev

# Automate with CronJob
```

**Estimated savings**: $30-40/month

### Total Potential Savings

**Aggressive Optimization**: $220-335/month (40-55% reduction)
**Conservative Optimization**: $90-130/month (18-22% reduction)

---

## Troubleshooting Guide

### Common Issues and Resolutions

#### Issue 1: Pod CrashLoopBackOff

**Symptoms**:
```bash
$ kubectl get pods -n elara-backend
NAME                        READY   STATUS             RESTARTS   AGE
elara-api-abc123            0/1     CrashLoopBackOff   5          5m
```

**Diagnosis**:
```bash
# Check logs
kubectl logs elara-api-abc123 -n elara-backend

# Check previous container logs
kubectl logs elara-api-abc123 -n elara-backend --previous

# Describe pod for events
kubectl describe pod elara-api-abc123 -n elara-backend
```

**Common Causes**:
1. Missing environment variables
2. Database connection failure
3. Out of memory
4. Application startup error

**Resolution**:
```bash
# Fix environment variables
kubectl edit deployment elara-api -n elara-backend

# Verify secrets exist
kubectl get secrets -n elara-backend

# Check resource limits
kubectl describe pod elara-api-abc123 -n elara-backend | grep -A 5 "Limits"
```

#### Issue 2: Database Connection Refused

**Symptoms**:
```
Error: connect ECONNREFUSED 10.190.1.11:5432
```

**Diagnosis**:
```bash
# Test connectivity from pod
kubectl exec -it elara-api-abc123 -n elara-backend -- sh
nc -zv 10.190.1.11 5432

# Check Cloud SQL proxy
kubectl logs -l app=cloud-sql-proxy -n elara-backend

# Verify database instance is running
gcloud sql instances describe elara-postgres-optimized
```

**Common Causes**:
1. Cloud SQL proxy not running
2. Incorrect database URL
3. Firewall blocking connection
4. Database instance stopped

**Resolution**:
```bash
# Restart Cloud SQL proxy
kubectl rollout restart deployment cloud-sql-proxy -n elara-backend

# Verify DATABASE_URL secret
kubectl get secret elara-db-secret -n elara-backend -o jsonpath='{.data.connection-string}' | base64 -d

# Check database status
gcloud sql instances list
```

#### Issue 3: Ingress 502 Bad Gateway

**Symptoms**:
```bash
$ curl http://34.36.48.252/api/health
502 Bad Gateway
```

**Diagnosis**:
```bash
# Check backend pods
kubectl get pods -n elara-backend

# Check service endpoints
kubectl get endpoints elara-api-service -n elara-backend

# Check ingress
kubectl describe ingress elara-ingress -n elara-backend

# Check backend service health
kubectl exec -it elara-api-abc123 -n elara-backend -- curl localhost:3000/health
```

**Common Causes**:
1. No healthy backend pods
2. Service selector mismatch
3. Backend pods failing readiness probe
4. Ingress backend configuration error

**Resolution**:
```bash
# Verify service selector matches pod labels
kubectl get svc elara-api-service -n elara-backend -o yaml | grep -A 5 "selector"
kubectl get pods -n elara-backend --show-labels

# Fix readiness probe issues
kubectl logs elara-api-abc123 -n elara-backend

# Check backend config
kubectl get backendconfig -n elara-backend -o yaml
```

#### Issue 4: High Memory Usage / OOMKilled

**Symptoms**:
```bash
$ kubectl get pods -n elara-backend
NAME                        READY   STATUS      RESTARTS   AGE
elara-api-abc123            0/1     OOMKilled   3          10m
```

**Diagnosis**:
```bash
# Check memory usage
kubectl top pod elara-api-abc123 -n elara-backend

# Check resource limits
kubectl describe pod elara-api-abc123 -n elara-backend | grep -A 10 "Limits"

# Check events
kubectl get events -n elara-backend --sort-by='.lastTimestamp' | grep OOM
```

**Resolution**:
```bash
# Increase memory limits
kubectl edit deployment elara-api -n elara-backend

# Update resources:
# limits:
#   memory: "2Gi"  # Increased from 1Gi
# requests:
#   memory: "1Gi"  # Increased from 512Mi

# Investigate memory leaks
# Connect to pod and analyze
kubectl exec -it elara-api-abc123 -n elara-backend -- node --expose-gc --inspect=0.0.0.0:9229 dist/server.js
```

#### Issue 5: Slow Database Queries

**Symptoms**:
- API response times > 2 seconds
- Database CPU > 80%

**Diagnosis**:
```bash
# Check slow queries in Cloud SQL
gcloud sql operations list --instance=elara-postgres-optimized --limit=10

# Connect to database and analyze
kubectl exec -it elara-api-abc123 -n elara-backend -- sh
psql $DATABASE_URL

# Run in PostgreSQL:
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

**Resolution**:
```sql
-- Add missing indexes
CREATE INDEX idx_scan_results_org_created ON scan_results(organization_id, created_at);
CREATE INDEX idx_users_org_active ON users(organization_id, is_active);

-- Analyze tables
ANALYZE scan_results;
ANALYZE users;

-- Check query plan
EXPLAIN ANALYZE SELECT * FROM scan_results WHERE organization_id = 'xxx';
```

#### Issue 6: Deployment Stuck

**Symptoms**:
```bash
$ kubectl rollout status deployment/elara-api -n elara-backend
Waiting for deployment "elara-api" rollout to finish: 1 out of 3 new replicas have been updated...
```

**Diagnosis**:
```bash
# Check deployment status
kubectl describe deployment elara-api -n elara-backend

# Check ReplicaSet
kubectl get rs -n elara-backend
kubectl describe rs elara-api-xyz -n elara-backend

# Check pod events
kubectl get events -n elara-backend --sort-by='.lastTimestamp'
```

**Common Causes**:
1. Image pull errors (ImagePullBackOff)
2. Insufficient resources
3. Pod failing readiness probe
4. Node affinity/anti-affinity issues

**Resolution**:
```bash
# Check for image pull errors
kubectl describe pod elara-api-new-abc -n elara-backend | grep -A 10 "Events"

# If image not found, verify GCR
gcloud container images list --repository=gcr.io/elara-mvp-13082025-u1

# Rollback if needed
kubectl rollout undo deployment/elara-api -n elara-backend

# Resume rollout
kubectl rollout resume deployment/elara-api -n elara-backend
```

#### Issue 7: SSL Certificate Issues

**Symptoms**:
- HTTPS not working
- "Your connection is not private" browser error

**Diagnosis**:
```bash
# Check managed certificate status
kubectl get managedcertificate -n elara-backend

# Check certificate details
kubectl describe managedcertificate elara-ssl-cert -n elara-backend

# Check ingress
kubectl describe ingress elara-ingress -n elara-backend | grep -A 5 "Certificate"
```

**Common Causes**:
1. Certificate provisioning in progress (can take 15-60 min)
2. DNS not pointing to load balancer IP
3. Ingress annotation missing

**Resolution**:
```bash
# Wait for provisioning
# Status should be "Active"

# Verify DNS
nslookup yourdomain.com
# Should return 34.36.48.252

# Check ingress annotations
kubectl get ingress elara-ingress -n elara-backend -o yaml | grep -A 5 "annotations"

# Ensure this exists:
# networking.gke.io/managed-certificates: "elara-ssl-cert"
```

### Debugging Commands Cheat Sheet

```bash
# ===== POD DEBUGGING =====
kubectl get pods -n NAMESPACE
kubectl describe pod POD_NAME -n NAMESPACE
kubectl logs POD_NAME -n NAMESPACE
kubectl logs POD_NAME -n NAMESPACE --previous
kubectl logs POD_NAME -n NAMESPACE -f  # Follow logs
kubectl exec -it POD_NAME -n NAMESPACE -- sh

# ===== SERVICE DEBUGGING =====
kubectl get svc -n NAMESPACE
kubectl describe svc SERVICE_NAME -n NAMESPACE
kubectl get endpoints SERVICE_NAME -n NAMESPACE

# ===== DEPLOYMENT DEBUGGING =====
kubectl get deployments -n NAMESPACE
kubectl describe deployment DEPLOYMENT_NAME -n NAMESPACE
kubectl rollout status deployment/DEPLOYMENT_NAME -n NAMESPACE
kubectl rollout history deployment/DEPLOYMENT_NAME -n NAMESPACE
kubectl rollout undo deployment/DEPLOYMENT_NAME -n NAMESPACE

# ===== INGRESS DEBUGGING =====
kubectl get ingress -n NAMESPACE
kubectl describe ingress INGRESS_NAME -n NAMESPACE

# ===== EVENTS =====
kubectl get events -n NAMESPACE --sort-by='.lastTimestamp'
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# ===== RESOURCE USAGE =====
kubectl top nodes
kubectl top pods -n NAMESPACE

# ===== CLOUD SQL DEBUGGING =====
gcloud sql instances describe elara-postgres-optimized
gcloud sql operations list --instance=elara-postgres-optimized
gcloud sql instances restart elara-postgres-optimized

# ===== GKE DEBUGGING =====
gcloud container clusters describe elara-gke-us-west1 --region=us-west1
gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1

# ===== LOGS =====
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=elara-backend" --limit=50 --format=json
```

---

## Summary

This comprehensive GCP deployment blueprint covers:

✅ **Complete infrastructure architecture** (GKE, Cloud SQL, Redis, networking)
✅ **End-to-end CI/CD pipeline** (GitHub Actions → Cloud Build → GKE)
✅ **Detailed deployment flow** (git push to production in 12-20 min)
✅ **Container build process** (multi-stage Docker, Trivy scanning, GCR)
✅ **Kubernetes manifests** (deployments, services, ingress, HPA)
✅ **Network architecture** (VPC, subnets, firewalls, Cloud Armor)
✅ **Security & IAM** (Workload Identity, service accounts, secrets)
✅ **Monitoring & logging** (Cloud Monitoring, structured logs, alerts)
✅ **Disaster recovery** (backups, PITR, RTO/RPO targets)
✅ **Scaling strategies** (HPA, VPA, GKE Autopilot autoscaling)
✅ **Cost optimization** (potential 40-55% reduction)
✅ **Troubleshooting guide** (7 common issues with resolutions)

**Related Documentation**:
- Infrastructure: `docs/CURRENT_GCP_INFRASTRUCTURE.md`
- Database: `docs/architecture/database/prisma-schema-complete.md`
- Prisma ORM: `docs/architecture/prisma-orm-architecture.md`
- API Reference: `docs/api/complete-api-reference.md`

---

**End of Document**
