# Elara Platform - Deployment Guide

## Multi-Environment Setup

The Elara platform supports three environments:
- **Development (dev)**: For active development and testing
- **Staging (staging)**: For pre-production testing and validation
- **Production (prod)**: Live production environment

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ develop  │  │   staging    │  │     main     │         │
│  │  branch  │  │    branch    │  │    branch    │         │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘         │
└───────┼────────────────┼───────────────────┼───────────────┘
        │                │                   │
        │ push           │ push              │ push
        ▼                ▼                   ▼
┌────────────────────────────────────────────────────────────┐
│              Google Cloud Build Triggers                    │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   DEV    │  │   STAGING    │  │     PROD     │        │
│  │ Trigger  │  │   Trigger    │  │   Trigger    │        │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘        │
└───────┼────────────────┼───────────────────┼───────────────┘
        │                │                   │
        │ builds         │ builds            │ builds
        ▼                ▼                   ▼
┌────────────────────────────────────────────────────────────┐
│                  GKE Cluster (us-west1)                     │
│                                                             │
│  ┌──────────────────────────────────────────────┐         │
│  │  Dev Namespaces                              │         │
│  │  • elara-backend-dev                         │         │
│  │  • elara-workers-dev                         │         │
│  │  • elara-proxy-dev                           │         │
│  │  • elara-frontend-dev                        │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────────────────────────────────┐         │
│  │  Staging Namespaces                          │         │
│  │  • elara-backend-staging                     │         │
│  │  • elara-workers-staging                     │         │
│  │  • elara-proxy-staging                       │         │
│  │  • elara-frontend-staging                    │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────────────────────────────────┐         │
│  │  Production Namespaces                       │         │
│  │  • elara-backend                             │         │
│  │  • elara-workers                             │         │
│  │  • elara-proxy                               │         │
│  │  • elara-frontend                            │         │
│  └──────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. One-Time Setup

Connect GitHub to Cloud Build and create triggers:

```bash
# Make script executable
chmod +x setup-cloud-build-triggers.sh

# Run setup script
./setup-cloud-build-triggers.sh
```

This will:
- Guide you through connecting GitHub to Cloud Build
- Create triggers for dev, staging, and prod environments
- Configure automatic deployments

### 2. Daily Workflow

#### Development
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# Make your changes
git add .
git commit -m "Add my feature"
git push origin feature/my-feature

# Create PR to develop branch
# After PR merge, auto-deploys to DEV environment
```

#### Staging
```bash
# Promote develop to staging
git checkout staging
git merge develop
git push origin staging

# Automatically deploys to STAGING environment
# Run tests and validation
```

#### Production
```bash
# Promote staging to main (after approval)
git checkout main
git merge staging
git push origin main

# Automatically deploys to PRODUCTION environment
```

## Manual Deployment

### Build and Deploy Specific Environment

```bash
# Deploy to Development
gcloud builds submit --config=cloudbuild-dev.yaml --project=elara-mvp-13082025-u1

# Deploy to Staging
gcloud builds submit --config=cloudbuild-staging.yaml --project=elara-mvp-13082025-u1

# Deploy to Production
gcloud builds submit --config=cloudbuild-prod.yaml --project=elara-mvp-13082025-u1
```

### Deploy Single Service

```bash
# Backend only
gcloud builds submit --config=build-backend-only.yaml --project=elara-mvp-13082025-u1

# Frontend only
gcloud builds submit --config=build-frontend-only.yaml --project=elara-mvp-13082025-u1

# Proxy only
gcloud builds submit --config=build-proxy-only.yaml --project=elara-mvp-13082025-u1
```

## Environment Configuration

### Environment Variables

Each environment has its own configuration:

**Development**
```bash
DATABASE_URL=postgresql://elara_app:password@10.190.1.5:5432/elara_dev
REDIS_URL=redis://10.190.1.5:6379/1
NODE_ENV=development
VITE_API_URL=http://dev.elara.internal/api
```

**Staging**
```bash
DATABASE_URL=postgresql://elara_app:password@10.190.1.5:5432/elara_staging
REDIS_URL=redis://10.190.1.5:6379/2
NODE_ENV=staging
VITE_API_URL=http://staging.elara.internal/api
```

**Production**
```bash
DATABASE_URL=postgresql://elara_app:elara_gcp_2024@10.190.1.5:5432/elara_production
REDIS_URL=redis://10.190.1.5:6379
NODE_ENV=production
VITE_API_URL=http://34.36.48.252/api
```

## Monitoring Deployments

### Check Build Status

```bash
# List recent builds
gcloud builds list --region=us-west1 --limit=10 --project=elara-mvp-13082025-u1

# View specific build
gcloud builds log <BUILD_ID> --project=elara-mvp-13082025-u1

# Stream live build logs
gcloud builds log <BUILD_ID> --stream --project=elara-mvp-13082025-u1
```

### Check Deployment Status

```bash
# Get GKE credentials
gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1 --project=elara-mvp-13082025-u1

# Check dev pods
kubectl get pods -n elara-backend-dev
kubectl get pods -n elara-workers-dev
kubectl get pods -n elara-proxy-dev
kubectl get pods -n elara-frontend-dev

# Check staging pods
kubectl get pods -n elara-backend-staging
kubectl get pods -n elara-workers-staging
kubectl get pods -n elara-proxy-staging
kubectl get pods -n elara-frontend-staging

# Check production pods
kubectl get pods -n elara-backend
kubectl get pods -n elara-workers
kubectl get pods -n elara-proxy
kubectl get pods -n elara-frontend
```

### View Logs

```bash
# Backend logs (production)
kubectl logs -f deployment/elara-api -n elara-backend

# Backend logs (dev)
kubectl logs -f deployment/elara-api -n elara-backend-dev

# Worker logs (staging)
kubectl logs -f deployment/elara-worker -n elara-workers-staging
```

## Rollback

### Rollback to Previous Deployment

```bash
# Rollback backend in production
kubectl rollout undo deployment/elara-api -n elara-backend

# Rollback to specific revision
kubectl rollout undo deployment/elara-api -n elara-backend --to-revision=2

# Check rollout history
kubectl rollout history deployment/elara-api -n elara-backend
```

### Rollback via Image Tag

```bash
# List available image tags
gcloud container images list-tags gcr.io/elara-mvp-13082025-u1/backend-api --limit=10

# Update to specific image
kubectl set image deployment/elara-api \
  elara-api=gcr.io/elara-mvp-13082025-u1/backend-api:prod-abc123 \
  -n elara-backend
```

## Troubleshooting

### Build Fails

```bash
# Check build logs
gcloud builds log <BUILD_ID> --project=elara-mvp-13082025-u1

# Common issues:
# 1. Dockerfile syntax errors
# 2. Missing dependencies
# 3. Build timeout (increase in cloudbuild.yaml)
# 4. Insufficient permissions
```

### Deployment Fails

```bash
# Check pod status
kubectl describe pod <POD_NAME> -n <NAMESPACE>

# Check deployment events
kubectl get events -n <NAMESPACE> --sort-by='.lastTimestamp'

# Common issues:
# 1. Image pull errors → Check GCR permissions
# 2. CrashLoopBackOff → Check application logs
# 3. ImagePullBackOff → Verify image exists
# 4. Insufficient resources → Scale cluster
```

### Application Not Responding

```bash
# Check pod health
kubectl get pods -n elara-backend -o wide

# Check service endpoints
kubectl get endpoints -n elara-backend

# Check ingress
kubectl get ingress -n elara-backend

# Port forward for direct testing
kubectl port-forward -n elara-backend deployment/elara-api 3001:3001

# Test locally
curl http://localhost:3001/health
```

## CI/CD Pipeline Details

### Automated Flow

1. **Code Push**: Developer pushes code to branch
2. **Trigger**: Cloud Build trigger detects push
3. **Build**: Docker images built in parallel
4. **Test**: Security scanning with Trivy
5. **Push**: Images pushed to GCR
6. **Deploy**: Kubernetes deployments updated
7. **Verify**: Health checks and smoke tests
8. **Notify**: Deployment status reported

### Build Time Estimates

- **Development**: 3-5 minutes
- **Staging**: 4-6 minutes
- **Production**: 5-8 minutes (includes smoke tests)

### Resource Limits

Each environment has different resource allocation:

**Development**
- Backend: 1 replica, 0.5 CPU, 512Mi RAM
- Workers: 1 replica, 0.5 CPU, 512Mi RAM
- Proxy: 1 replica, 0.25 CPU, 256Mi RAM

**Staging**
- Backend: 2 replicas, 1 CPU, 1Gi RAM
- Workers: 2 replicas, 1 CPU, 1Gi RAM
- Proxy: 1 replica, 0.5 CPU, 512Mi RAM

**Production**
- Backend: 3 replicas, 2 CPU, 2Gi RAM
- Workers: 3 replicas, 2 CPU, 2Gi RAM
- Proxy: 2 replicas, 1 CPU, 1Gi RAM

## Security Best Practices

1. **Never commit secrets** to Git
2. **Use Secret Manager** for sensitive data
3. **Enable Workload Identity** for GKE
4. **Scan images** before deployment (Trivy)
5. **Use least privilege** IAM roles
6. **Enable audit logging**
7. **Implement network policies**

## Cost Optimization

1. **Auto-scale** deployments based on load
2. **Use preemptible nodes** for dev/staging
3. **Clean up** old images regularly
4. **Monitor** resource usage
5. **Set resource quotas** per namespace

```bash
# Clean up old images (keep last 10)
gcloud container images list-tags gcr.io/elara-mvp-13082025-u1/backend-api \
  --format="get(digest)" --filter="NOT tags:*" | \
  head -n -10 | \
  xargs -I {} gcloud container images delete "gcr.io/elara-mvp-13082025-u1/backend-api@{}" --quiet
```

## Support

For issues or questions:
1. Check build logs in Cloud Build console
2. Review deployment logs in GKE console
3. Check application logs via kubectl
4. Contact platform team for assistance

## Quick Reference Commands

```bash
# Deploy to production
gcloud builds submit --config=cloudbuild-prod.yaml

# Check production status
kubectl get pods -A | grep elara

# View backend logs
kubectl logs -f -l app=elara-api -n elara-backend

# Scale backend
kubectl scale deployment/elara-api --replicas=5 -n elara-backend

# Restart deployment
kubectl rollout restart deployment/elara-api -n elara-backend

# Access database
kubectl run psql --rm -it --image=postgres:15 -- psql postgresql://elara_app:elara_gcp_2024@10.190.1.5:5432/elara_production
```
