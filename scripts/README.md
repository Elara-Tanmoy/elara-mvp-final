# Elara Platform - Deployment Scripts

## Overview

This directory contains deployment scripts for the Elara platform on Google Cloud Platform (GCP).

## Prerequisites

1. **GCP Project**: elara-mvp-13082025-u1
2. **gcloud CLI**: Installed and authenticated
3. **Terraform**: >= 1.9.0
4. **kubectl**: Latest version
5. **Service Account Key**: GCP service account with required permissions

## Deployment Steps

### Step 1: Enable GCP APIs

```bash
chmod +x scripts/*.sh
./scripts/00_enable_apis.sh
```

This enables all required GCP APIs:
- Compute Engine, GKE, Cloud SQL, Redis, Storage
- Secret Manager, Cloud KMS
- Logging, Monitoring
- IAM, Service Networking

### Step 2: Create Secrets

```bash
./scripts/01_create_secrets.sh
```

Uploads all secrets from `.env.secrets` to GCP Secret Manager.

### Step 3: Deploy Infrastructure

```bash
./scripts/02_deploy_infrastructure.sh
```

Deploys all infrastructure using Terraform:
- VPC network and subnets
- Cloud SQL PostgreSQL (Regional HA)
- Memorystore Redis (HA)
- GKE Autopilot cluster
- Cloud Storage buckets
- Global Load Balancer + Cloud Armor
- Monitoring and logging

**Expected Duration**: 15-20 minutes

### Step 4: Create Kubernetes Secrets

```bash
./scripts/03_create_k8s_secrets.sh
```

Creates K8s secrets from GCP Secret Manager in all namespaces.

### Step 5: Deploy Applications

```bash
./scripts/04_deploy_applications.sh
```

Deploys all Elara applications:
- Backend API (3-20 pods, HPA enabled)
- BullMQ Workers (5-30 pods, HPA enabled)
- Proxy Service (2 pods)
- ChromaDB (3 replicas)

**Expected Duration**: 5-10 minutes

## Post-Deployment

### Configure DNS

After deployment, configure DNS A records:

```bash
# Get load balancer IP
LB_IP=$(kubectl get ingress elara-ingress -n elara-backend -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Create A records
elara.com → $LB_IP
api.elara.com → $LB_IP
www.elara.com → $LB_IP
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -A

# Check services
kubectl get svc -A

# Check ingress
kubectl get ingress -n elara-backend

# View logs
kubectl logs -n elara-backend -l app=elara-api --tail=100 -f
```

### Run Database Migrations

```bash
POD=$(kubectl get pods -n elara-backend -l app=elara-api -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n elara-backend $POD -- pnpm --filter @elara/backend prisma migrate deploy
```

## Monitoring

### Cloud Console

- **GKE**: https://console.cloud.google.com/kubernetes/clusters
- **Cloud SQL**: https://console.cloud.google.com/sql/instances
- **Load Balancer**: https://console.cloud.google.com/net-services/loadbalancing
- **Monitoring**: https://console.cloud.google.com/monitoring

### kubectl Commands

```bash
# Watch all pods
kubectl get pods -A --watch

# View API logs
kubectl logs -n elara-backend -l app=elara-api -f

# View worker logs
kubectl logs -n elara-workers -l app=elara-worker -f

# Describe deployment
kubectl describe deployment elara-api -n elara-backend

# Check HPA status
kubectl get hpa -n elara-backend
```

## Rollback

```bash
# Rollback deployment
kubectl rollout undo deployment/elara-api -n elara-backend

# Check rollout history
kubectl rollout history deployment/elara-api -n elara-backend

# Rollback to specific revision
kubectl rollout undo deployment/elara-api -n elara-backend --to-revision=2
```

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Database connection issues

```bash
# Test database connectivity
POD=$(kubectl get pods -n elara-backend -l app=elara-api -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n elara-backend $POD -- nc -zv <db-host> 5432
```

### Secret issues

```bash
# Verify secrets exist
kubectl get secrets -n elara-backend

# Describe secret
kubectl describe secret elara-secrets -n elara-backend
```

## CI/CD (GitHub Actions)

Deployments are automated via GitHub Actions:

1. Push to `main` branch triggers deployment
2. Docker images are built and pushed to GCR
3. Images are scanned for vulnerabilities
4. Applications are deployed to GKE
5. Rollout status is verified

### Manual Deployment

```bash
# Trigger workflow manually
gh workflow run deploy-production.yml
```

## Cost Optimization

- **Committed Use Discounts**: Set `enable_committed_use_discounts = true` in terraform.tfvars after validation
- **Autoscaling**: HPA automatically scales based on CPU/memory
- **Storage Lifecycle**: Old scan files automatically deleted after 30 days

## Security

- All secrets stored in GCP Secret Manager
- Workload Identity enabled (no service account keys)
- Binary Authorization enforced
- Cloud Armor WAF protecting load balancer
- CMEK encryption for data at rest
- TLS 1.2+ enforced

## Support

For issues or questions, contact DevOps team at devops@elara.com
