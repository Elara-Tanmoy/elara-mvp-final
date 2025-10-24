# Elara Platform - Deployment Phases

**Document Version**: 1.0
**Last Updated**: 2025-01-12
**Author**: Solution Architect (Claude Code)
**Status**: Implementation Ready
**Classification**: Internal - Operations

---

## 📋 Executive Summary

This document provides the step-by-step deployment guide for deploying the Elara platform to Google Cloud Platform. The deployment is divided into 10 phases, each with detailed procedures, validation steps, and rollback plans.

**Total Deployment Time**: ~8 hours (first-time deployment)
**Subsequent Deployments**: ~30 minutes (via CI/CD)

---

## 📊 Deployment Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT PHASE TIMELINE                                │
└─────────────────────────────────────────────────────────────────────────────────┘

Phase 0: GCP Project Setup        [████░░░░░░] 30 min
Phase 1: Networking              [████░░░░░░] 45 min
Phase 2: Security & IAM          [█████░░░░░] 60 min
Phase 3: Database Layer          [██████░░░░] 90 min
Phase 4: GKE Clusters            [█████░░░░░] 60 min
Phase 5: Application Deploy      [████░░░░░░] 45 min
Phase 6: Load Balancer & CDN     [███░░░░░░░] 30 min
Phase 7: Monitoring & Alerts     [████░░░░░░] 45 min
Phase 8: DNS & SSL               [███░░░░░░░] 30 min
Phase 9: Testing & Validation    [█████░░░░░] 60 min
                                 ──────────────
                                 Total: ~8 hours
```

---

## Phase 0: GCP Project Setup (30 minutes)

### Objectives
- Create GCP project
- Enable required APIs
- Set up billing
- Configure gcloud CLI

### Prerequisites
```bash
# Required tools
gcloud --version  # >= 450.0.0
terraform --version  # >= 1.9.0
kubectl --version  # >= 1.30.0
```

### Step-by-Step

```bash
# 1. Create GCP project
export PROJECT_ID="elara-production"
export BILLING_ACCOUNT_ID="YOUR_BILLING_ACCOUNT_ID"

gcloud projects create $PROJECT_ID \
  --name="Elara Production" \
  --set-as-default

# 2. Link billing account
gcloud billing projects link $PROJECT_ID \
  --billing-account=$BILLING_ACCOUNT_ID

# 3. Enable required APIs
gcloud services enable \
  compute.googleapis.com \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage-api.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  dns.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com \
  cloudprofiler.googleapis.com \
  securitycenter.googleapis.com \
  --project=$PROJECT_ID

# 4. Configure gcloud
gcloud config set project $PROJECT_ID
gcloud config set compute/region us-west1
gcloud config set compute/zone us-west1-a

# 5. Authenticate
gcloud auth application-default login
```

### Validation
```bash
# Verify APIs are enabled
gcloud services list --enabled | grep compute
gcloud services list --enabled | grep container
gcloud services list --enabled | grep sqladmin
```

### Rollback
```bash
# If needed, delete project
gcloud projects delete $PROJECT_ID
```

---

## Phase 1: Networking (45 minutes)

### Objectives
- Create VPC network
- Configure subnets
- Set up firewall rules
- Configure Cloud NAT

### Terraform Deployment

```bash
cd terraform

# Initialize Terraform
terraform init

# Deploy networking module
terraform apply \
  -target=module.networking \
  -var-file=environments/production/terraform.tfvars \
  -auto-approve

# Verify
terraform state list | grep google_compute_network
terraform state list | grep google_compute_subnetwork
```

### Manual Verification

```bash
# List VPC networks
gcloud compute networks list

# List subnets
gcloud compute networks subnets list \
  --network=elara-vpc \
  --project=$PROJECT_ID

# List firewall rules
gcloud compute firewall-rules list \
  --filter="network:elara-vpc"

# Verify Cloud NAT
gcloud compute routers nats list \
  --router=elara-nat-router \
  --region=us-west1
```

### Expected Output
```
VPC: elara-vpc (10.0.0.0/16)
Subnets:
  - gke-pods-us-west1 (10.1.0.0/16)
  - gke-nodes-us-west1 (10.10.0.0/24)
  - data-layer-us-west1 (10.20.0.0/24)
  - cloudrun-connector-us-west1 (10.30.0.0/28)

Firewall Rules: 12 rules created
Cloud NAT: elara-nat-gateway (active)
```

---

## Phase 2: Security & IAM (60 minutes)

### Objectives
- Create service accounts
- Configure IAM roles
- Set up Secret Manager
- Configure Cloud KMS

### Terraform Deployment

```bash
# Deploy security module
terraform apply \
  -target=module.security \
  -var-file=environments/production/terraform.tfvars \
  -auto-approve
```

### Create Initial Secrets

```bash
# Database password
echo -n "GENERATE_SECURE_PASSWORD" | \
  gcloud secrets create production-backend-db-password \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# JWT private key (generate RSA key pair)
ssh-keygen -t rsa -b 4096 -m PEM -f jwt-private-key -N ""
gcloud secrets create production-backend-jwt-private-key \
  --data-file=jwt-private-key \
  --project=$PROJECT_ID

gcloud secrets create production-backend-jwt-public-key \
  --data-file=jwt-private-key.pub \
  --project=$PROJECT_ID

# Redis password
echo -n "GENERATE_SECURE_PASSWORD" | \
  gcloud secrets create production-backend-redis-password \
  --data-file=- \
  --project=$PROJECT_ID

# API keys (VirusTotal, etc.)
echo -n "YOUR_VIRUSTOTAL_API_KEY" | \
  gcloud secrets create production-backend-virustotal-api-key \
  --data-file=- \
  --project=$PROJECT_ID
```

### Validation

```bash
# List service accounts
gcloud iam service-accounts list --project=$PROJECT_ID

# List secrets
gcloud secrets list --project=$PROJECT_ID

# Verify KMS key rings
gcloud kms keyrings list --location=us-west1
```

---

## Phase 3: Database Layer (90 minutes)

### Objectives
- Deploy Cloud SQL PostgreSQL (HA)
- Deploy Memorystore Redis (HA)
- Configure backups
- Initialize database schema

### Terraform Deployment

```bash
# Deploy database module (this takes longest ~45 min)
terraform apply \
  -target=module.cloudsql \
  -target=module.redis \
  -var-file=environments/production/terraform.tfvars \
  -auto-approve
```

### Initialize Database Schema

```bash
# Get Cloud SQL connection name
export SQL_INSTANCE=$(gcloud sql instances describe elara-postgres-primary \
  --format="value(connectionName)")

# Connect via Cloud SQL Proxy
cloud_sql_proxy -instances=$SQL_INSTANCE=tcp:5432 &

# Run migrations
cd ../elara-platform/packages/backend
npm run migrate:up

# Verify schema
psql postgresql://elara_app:PASSWORD@localhost:5432/elara_production \
  -c "\dt"
```

### Validation

```bash
# Verify Cloud SQL status
gcloud sql instances describe elara-postgres-primary \
  --format="value(state,settings.availabilityType)"
# Expected: RUNNABLE REGIONAL

# Verify Redis
gcloud redis instances describe elara-redis-primary \
  --region=us-west1 \
  --format="value(state,tier)"
# Expected: READY STANDARD_HA

# Test database connectivity
psql postgresql://elara_app:PASSWORD@<PRIVATE_IP>:5432/elara_production \
  -c "SELECT version();"
```

---

## Phase 4: GKE Clusters (60 minutes)

### Objectives
- Deploy GKE Autopilot cluster (us-west1)
- Deploy DR cluster (us-east1)
- Configure Workload Identity
- Create namespaces

### Terraform Deployment

```bash
# Deploy GKE clusters
terraform apply \
  -target=module.gke \
  -var-file=environments/production/terraform.tfvars \
  -auto-approve
```

### Configure kubectl

```bash
# Get credentials for primary cluster
gcloud container clusters get-credentials elara-gke-us-west1 \
  --region=us-west1 \
  --project=$PROJECT_ID

# Verify connection
kubectl cluster-info
kubectl get nodes

# Create namespaces
kubectl apply -f ../kubernetes/namespaces/
```

### Validation

```bash
# Check cluster status
gcloud container clusters list

# Check namespaces
kubectl get namespaces
# Expected: elara-backend, elara-workers, elara-integrations, monitoring

# Verify Workload Identity
gcloud container clusters describe elara-gke-us-west1 \
  --region=us-west1 \
  --format="value(workloadIdentityConfig.workloadPool)"
# Expected: elara-production.svc.id.goog
```

---

## Phase 5: Application Deployment (45 minutes)

### Objectives
- Build and push container images
- Deploy backend API
- Deploy workers
- Deploy proxy service
- Deploy frontend to Cloud Run

### Build Container Images

```bash
cd ../elara-platform

# Authenticate to GCR
gcloud auth configure-docker

# Build and push images
docker build -t gcr.io/$PROJECT_ID/backend-api:v1.0.0 \
  -f packages/backend/Dockerfile .
docker push gcr.io/$PROJECT_ID/backend-api:v1.0.0

docker build -t gcr.io/$PROJECT_ID/worker:v1.0.0 \
  -f packages/backend/Dockerfile.worker .
docker push gcr.io/$PROJECT_ID/worker:v1.0.0

docker build -t gcr.io/$PROJECT_ID/proxy-service:v1.0.0 \
  -f packages/proxy/Dockerfile .
docker push gcr.io/$PROJECT_ID/proxy-service:v1.0.0

docker build -t gcr.io/$PROJECT_ID/frontend:v1.0.0 \
  -f packages/frontend/Dockerfile .
docker push gcr.io/$PROJECT_ID/frontend:v1.0.0
```

### Deploy to GKE

```bash
cd ../gcp-infrastructure/kubernetes

# Update image tags in manifests
kustomize edit set image \
  backend-api=gcr.io/$PROJECT_ID/backend-api:v1.0.0

# Apply manifests
kubectl apply -k overlays/production/

# Wait for rollout
kubectl rollout status deployment/elara-api -n elara-backend
kubectl rollout status deployment/elara-worker -n elara-workers
```

### Deploy Frontend to Cloud Run

```bash
gcloud run deploy elara-frontend \
  --image gcr.io/$PROJECT_ID/frontend:v1.0.0 \
  --region us-west1 \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 512Mi \
  --set-env-vars="VITE_API_URL=https://api.elara.com"
```

### Validation

```bash
# Check pod status
kubectl get pods -n elara-backend
kubectl get pods -n elara-workers

# Check logs
kubectl logs -n elara-backend deployment/elara-api --tail=50

# Test API health
kubectl port-forward -n elara-backend svc/elara-api-service 8080:80
curl http://localhost:8080/health
```

---

## Phase 6: Load Balancer & CDN (30 minutes)

### Objectives
- Deploy Global Load Balancer
- Configure Cloud Armor WAF
- Enable Cloud CDN
- Configure SSL

### Terraform Deployment

```bash
# Deploy load balancer
terraform apply \
  -target=module.loadbalancer \
  -var-file=environments/production/terraform.tfvars \
  -auto-approve
```

### Configure Ingress

```bash
# Apply ingress manifest
kubectl apply -f kubernetes/ingress/production-ingress.yaml

# Wait for load balancer IP
kubectl get ingress -n elara-backend -w
```

### Validation

```bash
# Get load balancer IP
export LB_IP=$(kubectl get ingress elara-ingress \
  -n elara-backend \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Load Balancer IP: $LB_IP"

# Test backend
curl http://$LB_IP/api/v1/health

# Verify Cloud Armor
gcloud compute security-policies list
```

---

## Phase 7: Monitoring & Alerts (45 minutes)

### Objectives
- Configure Cloud Monitoring
- Create dashboards
- Set up alerts
- Configure log sinks

### Deploy Monitoring

```bash
# Apply monitoring configuration
terraform apply \
  -target=module.monitoring \
  -var-file=environments/production/terraform.tfvars \
  -auto-approve
```

### Create Custom Dashboards

```bash
# Import dashboards
gcloud monitoring dashboards create \
  --config-from-file=../monitoring/dashboards/elara-overview.json
```

### Configure Alerts

```bash
# Create alert policies
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="logging.googleapis.com/user/error_count"'
```

### Validation

```bash
# List dashboards
gcloud monitoring dashboards list

# List alert policies
gcloud alpha monitoring policies list

# Test alerting (trigger test alert)
gcloud alpha monitoring policies test POLICY_ID
```

---

## Phase 8: DNS & SSL (30 minutes)

### Objectives
- Configure Cloud DNS
- Set up SSL certificates
- Update DNS records

### Configure DNS

```bash
# Create DNS zone
gcloud dns managed-zones create elara-zone \
  --dns-name="elara.com." \
  --description="Elara production DNS zone"

# Add A records
gcloud dns record-sets transaction start --zone=elara-zone

gcloud dns record-sets transaction add $LB_IP \
  --name=api.elara.com. \
  --ttl=300 \
  --type=A \
  --zone=elara-zone

gcloud dns record-sets transaction add $LB_IP \
  --name=elara.com. \
  --ttl=300 \
  --type=A \
  --zone=elara-zone

gcloud dns record-sets transaction execute --zone=elara-zone
```

### Configure SSL

```bash
# Create managed SSL certificate
gcloud compute ssl-certificates create elara-ssl-cert \
  --domains=elara.com,api.elara.com,www.elara.com \
  --global

# Wait for provisioning (can take 15-60 minutes)
gcloud compute ssl-certificates describe elara-ssl-cert \
  --global \
  --format="value(managed.status)"
```

### Validation

```bash
# Test DNS resolution
dig api.elara.com +short
# Expected: $LB_IP

# Test SSL (after provisioning)
curl -I https://api.elara.com
# Expected: HTTP/2 200
```

---

## Phase 9: Testing & Validation (60 minutes)

### Smoke Tests

```bash
# Run automated smoke tests
cd ../elara-platform
npm run test:smoke:production
```

### Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run tests/load/production-load-test.js
```

### Security Testing

```bash
# Run OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.elara.com
```

### Manual Testing Checklist

```yaml
✓ User registration works
✓ User login works
✓ URL scan completes successfully
✓ Message scan works
✓ File scan works
✓ Results are stored in database
✓ WebSocket notifications work
✓ Admin dashboard accessible
✓ Logs appear in Cloud Logging
✓ Metrics appear in Cloud Monitoring
✓ Alerts are triggered correctly
```

---

## 🎯 Post-Deployment Checklist

```yaml
Documentation:
  ✓ Update runbook with actual IPs and endpoints
  ✓ Document any deviations from plan
  ✓ Create handoff document for operations team

Security:
  ✓ Rotate all default passwords
  ✓ Review IAM permissions
  ✓ Enable Security Command Center
  ✓ Schedule first penetration test

Monitoring:
  ✓ Verify all alerts are working
  ✓ Set up on-call rotation in PagerDuty
  ✓ Configure Slack notifications

Compliance:
  ✓ Start audit log retention
  ✓ Document deployment for SOC 2
  ✓ Update compliance dashboard

Operations:
  ✓ Schedule first DR drill (within 30 days)
  ✓ Create backup verification job
  ✓ Document rollback procedure
```

---

**Document Status**: ✅ **READY FOR DEPLOYMENT**

**Estimated First Deployment**: 8 hours
**Subsequent Deployments (CI/CD)**: 30 minutes
