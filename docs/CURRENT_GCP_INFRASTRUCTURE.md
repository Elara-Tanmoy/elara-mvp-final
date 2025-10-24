# Current GCP Infrastructure - VERIFIED STATE

**Last Verified**: 2025-10-24
**Project**: elara-mvp-13082025-u1
**Region**: us-west1

---

## ✅ VERIFIED CURRENT DEPLOYMENT

### 1. Cloud SQL PostgreSQL

**Instance Name**: `elara-postgres-optimized`

| Configuration | Current Value |
|--------------|---------------|
| **Database Version** | POSTGRES_15 |
| **Tier** | db-custom-2-7680 (2 vCPU, 7.5GB RAM) |
| **Storage** | 100GB SSD |
| **Availability** | ZONAL (NOT Regional HA) |
| **Region** | us-west1 |
| **Status** | RUNNABLE |
| **Backup Retention** | 7 days |
| **PITR** | 7 days transaction logs |
| **Backup Time** | 03:00 UTC daily |

**Databases**:
- `elara_production` - Production database
- `elara_dev` - Development database
- `elara_staging` - Staging database
- `elara_threat_intel` - Shared threat intelligence database
- `postgres` - Default PostgreSQL database

### 2. Redis (Cloud Memorystore)

**Instance Name**: `elara-redis-primary`

| Configuration | Current Value |
|--------------|---------------|
| **Tier** | STANDARD_HA |
| **Memory Size** | 5 GB |
| **Redis Version** | REDIS_7_0 |
| **Status** | READY |
| **Host** | 10.190.0.4 (Private IP) |
| **Region** | us-west1 |

### 3. GKE Cluster

**Cluster Name**: `elara-gke-us-west1`

| Configuration | Current Value |
|--------------|---------------|
| **Location** | us-west1 |
| **Mode** | Autopilot |
| **Master Version** | 1.33.5-gke.1080000 |
| **Node Count** | 5 nodes (auto-managed) |
| **Status** | RUNNING |

**Deployed Namespaces** (showing Elara-specific only):

#### Production Environment:
- `elara-backend` - Backend API
- `elara-frontend` - Frontend application
- `elara-proxy` - Proxy service
- `elara-workers` - Background workers (BullMQ)

#### Development Environment:
- `elara-backend-dev` - Dev backend API
- `elara-frontend-dev` - Dev frontend
- `elara-proxy-dev` - Dev proxy service
- `elara-workers-dev` - Dev workers

**NOTE**: There is NO separate staging namespace deployment, but `elara_staging` database exists.

### 4. Load Balancers & Static IPs

| Name | IP Address | Type | Purpose |
|------|-----------|------|---------|
| **elara-global-lb-ip** | 34.36.48.252 | Global | Production ingress |
| **elara-dev-backend-ip** | 35.199.176.26 | Regional | Dev backend |
| **elara-dev-frontend-ip** | 136.117.33.149 | Regional | Dev frontend |
| **elara-vpc-nat-ip-1** | 34.82.164.36 | Regional | NAT gateway |
| **elara-vpc-nat-ip-2** | 34.168.119.72 | Regional | NAT gateway |

**Additional Frontend Dev IP**: 34.11.236.129

### 5. Deployed Services

#### Production (elara-backend namespace):
- `elara-api-service` - ClusterIP (internal): 10.2.11.210
- `elara-frontend-direct-svc` - ClusterIP (internal): 10.2.8.29
- **Ingress**: Uses global load balancer (34.36.48.252)

#### Development (elara-backend-dev namespace):
- `elara-api-lb` - LoadBalancer: 35.199.176.26
- `elara-api-service` - ClusterIP: 10.2.10.202

#### Development (elara-frontend-dev namespace):
- `elara-frontend` - LoadBalancer: 34.11.236.129
- `elara-frontend-lb` - LoadBalancer: 136.117.33.149

---

## 🔄 CURRENT DEPLOYMENT ENVIRONMENTS

### Production
- **Backend API**: http://34.36.48.252/api
- **Frontend**: http://34.36.48.252/
- **Database**: elara_production
- **Namespace**: elara-backend, elara-frontend, elara-proxy, elara-workers

### Development
- **Backend API**: http://35.199.176.26/api
- **Frontend**: http://136.117.33.149/ (or http://34.11.236.129/)
- **Database**: elara_dev
- **Namespace**: elara-backend-dev, elara-frontend-dev, elara-proxy-dev, elara-workers-dev

### Staging
- **Status**: Database exists (`elara_staging`) but NO K8s namespaces deployed
- **Database**: elara_threat_intel (shared across environments)

---

## ⚠️ DISCREPANCIES WITH TERRAFORM CODE

### Terraform Shows (Planned State):
- Instance name: `elara-postgres-primary`
- Tier: `db-custom-8-32768` (8 vCPU, 32GB RAM)
- Storage: 500GB SSD with auto-expand to 2TB
- Availability: REGIONAL (HA with standby)
- Read replicas: 2 replicas planned

### Actually Deployed (Current State):
- Instance name: `elara-postgres-optimized`
- Tier: `db-custom-2-7680` (2 vCPU, 7.5GB RAM)
- Storage: 100GB SSD
- Availability: ZONAL (no HA standby)
- Read replicas: NONE

**Conclusion**: Terraform represents the PLANNED OPTIMIZED infrastructure, but actual deployment uses a cost-optimized smaller configuration. This is the CORRECT current production state.

---

## 📊 Prisma Schema (40+ Models)

The database schema is defined in `packages/backend/prisma/schema.prisma` with 40+ models including:

**Core Models**:
- Organization, User, Subscription
- ScanResult, RiskCategory
- ThreatIntelSource, ThreatIndicator
- AuditLog, ApiUsage

**Authentication**:
- RefreshToken, WebAuthnCredential (Passkey support)
- OAuth: Google, Facebook, LinkedIn

**Chatbot/AI**:
- ChatSession, ChatMessage, ChatbotConfig
- KnowledgeBase, ChatbotAnalytics

**Threat Intelligence**:
- ThreatFeedSync, DomainHistory
- IntelligenceData

**Advanced Scanning**:
- ScanConfiguration, AdminUrlScan
- CheckDefinition, AIModelDefinition
- ReachabilityCache, ThreatIntelligenceCache

**WhatsApp Integration**:
- WhatsAppUser, WhatsAppMessage, WhatsAppMediaFile

**Recovery & Literacy**:
- RecoveryIncident, LiteracyQuizResult

---

## 🔐 IAM & Service Accounts

Based on Terraform configuration, the following service accounts are defined:

1. **elara-api** - Backend API (Workload Identity)
   - Roles: Cloud SQL Client, Secret Manager Accessor, Storage Viewer/Creator, Logging, Monitoring

2. **elara-worker** - BullMQ Workers
   - Roles: Cloud SQL Client, Secret Manager Accessor, Storage Admin, Pub/Sub Publisher, Logging

3. **elara-proxy** - Proxy Service
   - Roles: Storage Object Creator, Logging

4. **elara-frontend** - Frontend (Cloud Run)
   - Roles: Logging

---

## 📦 Container Registry

Images stored in:
- `gcr.io/elara-mvp-13082025-u1/backend-api:latest`
- `gcr.io/elara-mvp-13082025-u1/frontend:latest`
- `gcr.io/elara-mvp-13082025-u1/proxy-service:latest`
- `gcr.io/elara-mvp-13082025-u1/worker:latest`

---

## 🌐 Networking

### VPC Configuration
- **VPC Name**: elara-vpc
- **Region**: us-west1

### Subnets
- **gke-nodes-us-west1**: 10.10.0.0/24 (GKE nodes)
- **data-layer-us-west1**: 10.20.0.0/24 (Database tier)
- **cloudrun-us-west1**: 10.30.0.0/28 (Cloud Run)
- **GKE Pods**: 10.1.0.0/16 (secondary range)
- **GKE Services**: 10.2.0.0/20 (secondary range)

### Private IPs
- **Cloud SQL**: 10.190.1.11 (private via VPC peering)
- **Redis**: 10.190.0.4 (private)
- **VPC Peering Range**: 10.190.0.0/24

### NAT Gateway
- **Router**: elara-vpc-router-us-west1
- **NAT**: elara-vpc-nat-us-west1
- **NAT IP 1**: 34.82.164.36
- **NAT IP 2**: 34.168.119.72

### Security
- **Cloud Armor**: elara-security-policy (Rate limiting, SQL injection, XSS protection)
- **Firewall Rules**: 14 rules (priority 999-2147483647)
- **Zero Trust**: No direct SSH/RDP, IAP for admin access
- **DDoS Protection**: Cloud Armor + rate limiting (100 req/min per IP)

**Full Network Details**: See `docs/architecture/networking/network-architecture.md`

---

## ✅ VALIDATION COMPLETE

This document reflects the **actual deployed infrastructure** as of 2025-10-24.

**Next Steps**: Update all architecture documentation to match this verified current state.
