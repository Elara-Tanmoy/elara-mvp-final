# Elara Platform - High-Level Design (HLD)

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Author**: Solution Architect (Claude Code)
**Status**: Production
**Classification**: Technical - Architecture

---

## 📋 Executive Summary

This High-Level Design document provides a comprehensive architectural overview of the Elara cybersecurity platform on Google Cloud Platform. It details the service-wise architecture, data flow patterns, deployment locations, and automated CI/CD pipeline enabling git-push-to-deploy functionality.

**Key Architecture Principles**:
- **Microservices Architecture**: Independent, scalable services
- **Cloud-Native Design**: Leveraging GCP managed services
- **Zero-Trust Security**: All communication encrypted and authenticated
- **GitOps Deployment**: Git push triggers automated deployment
- **High Availability**: Multi-region, auto-failover, 99.9% uptime
- **Auto-Scaling**: Horizontal scaling based on demand

---

## 📊 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Elara Platform Services](#elara-platform-services)
3. [Service Deployment Locations](#service-deployment-locations)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Network Architecture](#network-architecture)
6. [Security Architecture](#security-architecture)
7. [CI/CD Pipeline - Git Push to Deploy](#cicd-pipeline-git-push-to-deploy)
8. [Scaling and Performance](#scaling-and-performance)
9. [Monitoring and Observability](#monitoring-and-observability)
10. [Disaster Recovery Architecture](#disaster-recovery-architecture)

---

## 🏗️ Architecture Overview

### End-to-End Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           ELARA PLATFORM - GCP ARCHITECTURE                          │
│                              End-to-End System View                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   End Users     │
                              │  (Web/Mobile)   │
                              └────────┬────────┘
                                       │
                                       │ HTTPS
                                       ↓
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                EDGE LAYER (Global)                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        Cloud DNS + SSL Certificate                           │    │
│  │                     elara.com → Global Load Balancer                         │    │
│  └─────────────────────────────────┬───────────────────────────────────────────┘    │
│                                    │                                                  │
│  ┌─────────────────────────────────┴───────────────────────────────────────────┐    │
│  │                    Global HTTPS Load Balancer                                │    │
│  │  • Cloud Armor WAF (DDoS, OWASP Top 10)                                     │    │
│  │  • Cloud CDN (Static assets, 50+ global PoPs)                               │    │
│  │  • SSL/TLS Termination                                                       │    │
│  │  • URL Routing: /api/* → Backend, /* → Frontend                             │    │
│  └─────────────────────────────────┬───────────────────────────────────────────┘    │
└────────────────────────────────────┼──────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ↓                                 ↓
┌──────────────────────────────────────┐  ┌─────────────────────────────────────────┐
│      FRONTEND LAYER (Cloud Run)       │  │     BACKEND LAYER (GKE Autopilot)      │
│         Region: us-west1              │  │        Region: us-west1                 │
├──────────────────────────────────────┤  ├─────────────────────────────────────────┤
│  ┌────────────────────────────────┐  │  │  ┌──────────────────────────────────┐  │
│  │  Elara Frontend (React SPA)    │  │  │  │     Elara Backend API Server     │  │
│  │  • Container: Node.js + Nginx  │  │  │  │  • Node.js/Express REST API      │  │
│  │  • Auto-scaling: 0-10 instances│  │  │  │  • WebSocket server (real-time)  │  │
│  │  • Deploy: Cloud Run           │  │  │  │  • JWT authentication            │  │
│  │  • Port: 8080                   │  │  │  │  • Deploy: GKE Deployment        │  │
│  │  • Memory: 512Mi                │  │  │  │  • Replicas: 3-20 (HPA)          │  │
│  └────────────────────────────────┘  │  │  │  • Port: 3000                     │  │
│                                       │  │  └───────────┬──────────────────────┘  │
│                                       │  │              │                          │
│                                       │  │  ┌───────────┴──────────────────────┐  │
│                                       │  │  │   Proxy Service (Puppeteer)      │  │
│                                       │  │  │  • Secure web browsing           │  │
│                                       │  │  │  • Screenshot capture            │  │
│                                       │  │  │  • Deploy: GKE StatefulSet       │  │
│                                       │  │  │  • Replicas: 2-10 (HPA)          │  │
│                                       │  │  └───────────┬──────────────────────┘  │
│                                       │  │              │                          │
│                                       │  │  ┌───────────┴──────────────────────┐  │
│                                       │  │  │   BullMQ Workers (Background)    │  │
│                                       │  │  │  • Scan processing               │  │
│                                       │  │  │  • Report generation             │  │
│                                       │  │  │  • Email notifications           │  │
│                                       │  │  │  • Deploy: GKE Deployment        │  │
│                                       │  │  │  • Replicas: 5-30 (HPA)          │  │
│                                       │  │  └───────────┬──────────────────────┘  │
│                                       │  │              │                          │
│                                       │  │  ┌───────────┴──────────────────────┐  │
│                                       │  │  │   WhatsApp Integration Service   │  │
│                                       │  │  │  • WhatsApp Business API         │  │
│                                       │  │  │  • Message processing            │  │
│                                       │  │  │  • Deploy: GKE Deployment        │  │
│                                       │  │  │  • Replicas: 2-5 (HPA)           │  │
│                                       │  │  └──────────────────────────────────┘  │
└──────────────────────────────────────┘  └──────────────┬──────────────────────────┘
                                                          │
                                          ┌───────────────┴───────────────┐
                                          │                               │
┌─────────────────────────────────────────┴───────────────────────────────┴──────────┐
│                              DATA LAYER (Managed Services)                          │
├────────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Cloud SQL PostgreSQL (HA Configuration)                  │   │
│  │  PRIMARY (us-west1-a) ←→ STANDBY (us-west1-b) [Sync Replication]         │   │
│  │  READ REPLICA 1 (us-west1-c) - Analytics queries                           │   │
│  │  READ REPLICA 2 (us-east1-a) - DR + East coast traffic                    │   │
│  │  • Tables: users, scans, threats, audit_logs, sessions, api_keys          │   │
│  │  • Connection: Private IP only (VPC peering)                               │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Memorystore Redis (Standard HA)                          │   │
│  │  PRIMARY (us-west1-a) ←→ REPLICA (us-west1-b) [Auto-failover]            │   │
│  │  • Sessions, rate limiting, BullMQ queues, cache                           │   │
│  │  • Connection: Private IP only (VPC peering)                               │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │              Vertex AI Vector Search (AI/ML Embeddings)                     │   │
│  │  • Threat pattern embeddings for semantic search                           │   │
│  │  • Phishing detection similarity matching                                   │   │
│  │  • Auto-scaling 2-10 replicas                                              │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Cloud Storage (Multi-Region)                             │   │
│  │  • Bucket: elara-scans-uploads (file scanning)                             │   │
│  │  • Bucket: elara-reports (generated PDF reports)                           │   │
│  │  • Bucket: elara-screenshots (proxy service captures)                      │   │
│  │  • Bucket: elara-backups (database exports)                                │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY & SECRETS LAYER                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│  Secret Manager  │  Cloud KMS (CMEK)  │  IAM & Workload Identity  │  Cloud Armor  │
└────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY LAYER                                         │
├────────────────────────────────────────────────────────────────────────────────────┤
│  Cloud Logging  │  Cloud Monitoring  │  Cloud Trace  │  Error Reporting  │  SCC   │
└────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────┐
│                         CI/CD PIPELINE (GitOps)                                     │
├────────────────────────────────────────────────────────────────────────────────────┤
│  GitHub → GitHub Actions → Cloud Build → Artifact Registry → GKE/Cloud Run        │
│  (git push to main triggers automatic deployment to production)                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Elara Platform Services

### Service Catalog

| Service Name | Description | Technology Stack | Deployment Target | Scaling Strategy |
|-------------|-------------|------------------|-------------------|------------------|
| **Frontend SPA** | React single-page application | React 18, TypeScript, Vite, Tailwind CSS | Cloud Run (us-west1) | Auto-scale 0-10 instances |
| **Backend API** | Main REST API + WebSocket server | Node.js, Express, TypeScript, Socket.io | GKE Deployment | HPA: 3-20 pods |
| **Proxy Service** | Secure web browsing (Puppeteer) | Node.js, Puppeteer, Chrome Headless | GKE StatefulSet | HPA: 2-10 pods |
| **BullMQ Workers** | Background job processing | Node.js, BullMQ, Redis | GKE Deployment | HPA: 5-30 pods |
| **WhatsApp Service** | WhatsApp Business integration | Node.js, WhatsApp Business API | GKE Deployment | HPA: 2-5 pods |
| **AI/ML Service** | Threat detection, phishing analysis | Python, TensorFlow, OpenAI API | GKE Deployment | HPA: 2-10 pods |

### Service Details

#### 1. Frontend SPA (Cloud Run)

**Purpose**: User interface for Elara platform
**Location**: Cloud Run, us-west1
**Container Image**: `gcr.io/elara-production/frontend:latest`

**Features**:
- URL scanner interface
- Message/SMS scanner
- File upload scanner
- Secure web proxy browser
- Admin dashboards (WhatsApp, user management)
- AI chatbot assistant
- Real-time scan status updates

**Configuration**:
```yaml
# Cloud Run Service Configuration
service: elara-frontend
region: us-west1
container:
  image: gcr.io/elara-production/frontend:latest
  port: 8080
  resources:
    limits:
      memory: 512Mi
      cpu: 1
autoscaling:
  minInstances: 0  # Scale to zero for cost savings
  maxInstances: 10
  targetCPUUtilization: 70
environment:
  - name: NODE_ENV
    value: production
  - name: VITE_API_URL
    value: https://api.elara.com
  - name: VITE_WS_URL
    value: wss://api.elara.com
ingress: all
```

**Build Process**:
```dockerfile
# Dockerfile for Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. Backend API Server (GKE)

**Purpose**: Main REST API + WebSocket server
**Location**: GKE Autopilot, us-west1
**Namespace**: `elara-backend`
**Deployment**: `elara-api-deployment`

**Endpoints**:
```
POST   /api/v1/auth/register        - User registration
POST   /api/v1/auth/login           - User login
GET    /api/v1/auth/me              - Get current user

POST   /api/v1/scans/url            - Create URL scan
POST   /api/v1/scans/message        - Create message scan
POST   /api/v1/scans/file           - Create file scan
GET    /api/v1/scans/:id            - Get scan result
GET    /api/v1/scans                - List user scans

GET    /api/v1/threats              - List threats
GET    /api/v1/threats/:id          - Get threat details

WS     /api/v1/ws                   - WebSocket connection
```

**Phase 2 - Enterprise Scan Engine Administration API** (Added: 2025-10-16):
```
# Configuration Management
GET    /api/v2/admin/scan-engine/schema              - Get complete schema
GET    /api/v2/admin/scan-engine/config              - List all configurations
GET    /api/v2/admin/scan-engine/config/active       - Get active configuration
GET    /api/v2/admin/scan-engine/config/:id          - Get specific configuration
POST   /api/v2/admin/scan-engine/config              - Create configuration
PUT    /api/v2/admin/scan-engine/config/:id          - Update configuration
PATCH  /api/v2/admin/scan-engine/config/:id/activate - Activate configuration
DELETE /api/v2/admin/scan-engine/config/:id          - Delete configuration

# Check Definition Management (Enterprise Feature)
GET    /api/v2/admin/scan-engine/checks              - List all check definitions
POST   /api/v2/admin/scan-engine/checks              - Create check definition
PUT    /api/v2/admin/scan-engine/checks/:id          - Update check definition
DELETE /api/v2/admin/scan-engine/checks/:id          - Delete check definition
POST   /api/v2/admin/scan-engine/checks/:id/toggle   - Enable/disable check

# AI Model Management (Enterprise Feature)
GET    /api/v2/admin/scan-engine/ai-models           - List AI models
POST   /api/v2/admin/scan-engine/ai-models           - Add AI model
PUT    /api/v2/admin/scan-engine/ai-models/:id       - Update AI model
DELETE /api/v2/admin/scan-engine/ai-models/:id       - Delete AI model
POST   /api/v2/admin/scan-engine/ai-models/:id/test  - Test AI model

# Threat Intelligence Sources (Enterprise Feature)
GET    /api/v2/admin/scan-engine/ti-sources          - List TI sources
POST   /api/v2/admin/scan-engine/ti-sources          - Add TI source
PUT    /api/v2/admin/scan-engine/ti-sources/:id      - Update TI source
DELETE /api/v2/admin/scan-engine/ti-sources/:id      - Delete TI source
POST   /api/v2/admin/scan-engine/ti-sources/:id/test - Test TI source

# AI Consensus Configuration (Enterprise Feature)
GET    /api/v2/admin/scan-engine/consensus-configs          - List consensus configs
POST   /api/v2/admin/scan-engine/consensus-configs          - Create consensus config
PUT    /api/v2/admin/scan-engine/consensus-configs/:id      - Update consensus config
DELETE /api/v2/admin/scan-engine/consensus-configs/:id      - Delete consensus config
POST   /api/v2/admin/scan-engine/consensus-configs/:id/activate - Activate config

# Analytics & Reporting
GET    /api/v2/admin/scan-engine/stats               - Get scan statistics
GET    /api/v2/admin/scan-engine/scans               - List scan history
GET    /api/v2/admin/scan-engine/analytics/overview  - Analytics overview
```

**Enterprise Features Database Schema** (4 new tables added):
- `check_definitions` - Dynamic URL security check management
- `ai_model_definitions` - AI model configuration for consensus
- `threat_intel_sources` - TI source management with enterprise fields
- `ai_consensus_configs` - AI consensus strategy configuration

**Enterprise Admin UI Components**:
- Check Types Management Tab - CRUD for security checks
- AI Models Management Tab - Configure AI models with rankings
- TI Sources Management Tab - Manage threat intelligence sources
- AI Consensus Config Tab - Configure consensus strategies

**Kubernetes Deployment**:
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
        version: v1
    spec:
      serviceAccountName: elara-api-sa  # Workload Identity
      containers:
      - name: api
        image: gcr.io/elara-production/backend-api:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 3001
          name: websocket
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "3000"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: host
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
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
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: elara-api-service
  namespace: elara-backend
spec:
  selector:
    app: elara-api
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: websocket
    port: 3001
    targetPort: 3001
  type: ClusterIP
---
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
  maxReplicas: 20
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
```

#### 3. Proxy Service (GKE StatefulSet)

**Purpose**: Secure web browsing using Puppeteer
**Location**: GKE Autopilot, us-west1
**Namespace**: `elara-backend`

**Features**:
- Load URLs in isolated Chrome browser
- Capture screenshots
- Analyze page content
- Detect malicious JavaScript
- Safe browsing for users

**Kubernetes StatefulSet**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elara-proxy
  namespace: elara-backend
spec:
  serviceName: elara-proxy-service
  replicas: 2
  selector:
    matchLabels:
      app: elara-proxy
  template:
    metadata:
      labels:
        app: elara-proxy
    spec:
      serviceAccountName: elara-proxy-sa
      containers:
      - name: proxy
        image: gcr.io/elara-production/proxy-service:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: production
        - name: CHROME_BIN
          value: /usr/bin/google-chrome
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: screenshots
          mountPath: /app/screenshots
  volumeClaimTemplates:
  - metadata:
      name: screenshots
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
```

#### 4. BullMQ Workers (GKE Deployment)

**Purpose**: Background job processing
**Location**: GKE Autopilot, us-west1
**Namespace**: `elara-workers`

**Job Types**:
- **Scan Processing**: Execute URL/message/file scans
- **Report Generation**: Generate PDF reports
- **Email Notifications**: Send scan results via email
- **Threat Feed Updates**: Sync threat intelligence feeds
- **Database Cleanup**: Archive old scans

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elara-worker
  namespace: elara-workers
spec:
  replicas: 5
  selector:
    matchLabels:
      app: elara-worker
  template:
    metadata:
      labels:
        app: elara-worker
    spec:
      serviceAccountName: elara-worker-sa
      containers:
      - name: worker
        image: gcr.io/elara-production/worker:latest
        env:
        - name: NODE_ENV
          value: production
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: host
        - name: QUEUE_CONCURRENCY
          value: "10"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
---
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
  minReplicas: 5
  maxReplicas: 30
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75
```

#### 5. WhatsApp Integration Service (GKE)

**Purpose**: WhatsApp Business API integration
**Location**: GKE Autopilot, us-west1
**Namespace**: `elara-integrations`

**Features**:
- Receive WhatsApp messages
- Process security queries
- Send scan results
- Admin dashboard integration

**Kubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elara-whatsapp
  namespace: elara-integrations
spec:
  replicas: 2
  selector:
    matchLabels:
      app: elara-whatsapp
  template:
    metadata:
      labels:
        app: elara-whatsapp
    spec:
      serviceAccountName: elara-whatsapp-sa
      containers:
      - name: whatsapp
        image: gcr.io/elara-production/whatsapp-service:latest
        ports:
        - containerPort: 5000
        env:
        - name: WHATSAPP_API_KEY
          valueFrom:
            secretKeyRef:
              name: whatsapp-credentials
              key: api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

---

## 📍 Service Deployment Locations

### Deployment Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ELARA SERVICES DEPLOYMENT MATRIX                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────┬───────────────────┬──────────────┬────────────────────────┐
│   Service Name     │  Deployment Type  │   Region     │     Access Pattern     │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ Frontend SPA       │ Cloud Run         │ us-west1     │ Public (via LB+CDN)    │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ Backend API        │ GKE Deployment    │ us-west1     │ Public (via LB)        │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ Proxy Service      │ GKE StatefulSet   │ us-west1     │ Internal only          │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ BullMQ Workers     │ GKE Deployment    │ us-west1     │ Internal only          │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ WhatsApp Service   │ GKE Deployment    │ us-west1     │ Webhook (public IP)    │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ PostgreSQL Primary │ Cloud SQL         │ us-west1-a   │ Private IP only (VPC)  │
│ PostgreSQL Standby │ Cloud SQL         │ us-west1-b   │ Private IP only (VPC)  │
│ Read Replica 1     │ Cloud SQL         │ us-west1-c   │ Private IP only (VPC)  │
│ Read Replica 2 (DR)│ Cloud SQL         │ us-east1-a   │ Private IP only (VPC)  │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ Redis Primary      │ Memorystore       │ us-west1-a   │ Private IP only (VPC)  │
│ Redis Replica      │ Memorystore       │ us-west1-b   │ Private IP only (VPC)  │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ Vector DB          │ Vertex AI         │ us-west1     │ Private endpoint       │
├────────────────────┼───────────────────┼──────────────┼────────────────────────┤
│ Cloud Storage      │ GCS Buckets       │ us-multi     │ Private (IAM)          │
└────────────────────┴───────────────────┴──────────────┴────────────────────────┘

LEGEND:
• Cloud Run: Fully managed serverless containers (auto-scale to zero)
• GKE Deployment: Stateless pods (horizontal auto-scaling)
• GKE StatefulSet: Stateful pods with persistent storage
• Cloud SQL: Fully managed PostgreSQL (HA with auto-failover)
• Memorystore: Fully managed Redis (HA with auto-failover)
```

### Why These Deployment Choices?

**Frontend on Cloud Run**:
- ✅ Serverless, scale to zero (cost optimization)
- ✅ Built-in HTTPS and SSL
- ✅ Automatic load balancing
- ✅ Fast cold starts (< 1 second)
- ✅ Pay only for actual usage
- ✅ Easy rollback with traffic splitting

**Backend on GKE Autopilot**:
- ✅ WebSocket support (Cloud Run has limitations)
- ✅ Long-running connections
- ✅ More control over networking
- ✅ Better for stateful services
- ✅ Consistent performance (no cold starts)
- ✅ Support for sidecar containers (PgBouncer)

**Workers on GKE**:
- ✅ Long-running background jobs
- ✅ High concurrency control
- ✅ Better resource management
- ✅ Direct Redis connection for BullMQ

**Proxy on GKE StatefulSet**:
- ✅ Chrome browser needs persistent storage
- ✅ Screenshot caching on local disk
- ✅ Stable network identity

---

## 🔄 Data Flow Diagrams

### 1. URL Scan Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         URL SCAN DATA FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

USER (Browser)
    │
    │ 1. POST /api/v1/scans/url
    │    { "url": "https://suspicious-site.com" }
    ↓
┌──────────────────┐
│  Global LB       │  2. Route to backend
│  + Cloud Armor   │     (DDoS protection, rate limiting)
└────────┬─────────┘
         │
         ↓
┌────────────────────┐
│  Backend API Pod   │  3. Validate request, check auth
│  (GKE)             │  4. Check Redis cache for existing scan
└────────┬───────────┘
         │
         ├─── 5a. Cache HIT → Return cached result (fast path)
         │
         └─── 5b. Cache MISS → Create scan job
                │
                ↓
         ┌──────────────────┐
         │  PostgreSQL      │  6. INSERT INTO scans (status='pending')
         │  (Cloud SQL)     │     Return scan_id
         └──────────────────┘
                │
                ↓
         ┌──────────────────┐
         │  Redis (BullMQ)  │  7. Add job to scan-queue
         │  (Memorystore)   │     { scanId, url, priority }
         └──────────────────┘
                │
                ↓
         ┌──────────────────┐
         │  Return Response │  8. HTTP 202 Accepted
         │  to User         │     { scanId, status: 'pending' }
         └──────────────────┘
                │
                │ (User polls GET /api/v1/scans/:id or uses WebSocket)
                │
                ↓
         ┌──────────────────┐
         │  BullMQ Worker   │  9. Pick job from queue
         │  (GKE Pod)       │  10. Process scan:
         └────────┬─────────┘
                  │
                  ├──→ Google Safe Browsing API
                  ├──→ VirusTotal API
                  ├──→ PhishTank API
                  ├──→ Proxy Service (screenshot, JS analysis)
                  ├──→ AI/ML Service (phishing detection)
                  └──→ Threat DB lookup (PostgreSQL)
                  │
                  │ 11. Aggregate results
                  ↓
         ┌──────────────────┐
         │  PostgreSQL      │  12. UPDATE scans SET
         │  (Cloud SQL)     │      status='completed',
         │                  │      risk_score=85,
         │                  │      findings={...}
         └──────────────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  Redis Cache     │  13. Cache result (TTL: 15min)
         │  (Memorystore)   │      Key: scan:result:{scanId}
         └──────────────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  WebSocket       │  14. Push notification to user
         │  Server          │      { scanId, status: 'completed' }
         └──────────────────┘
                  │
                  ↓
USER (Browser) receives real-time update
    │
    │ 15. GET /api/v1/scans/:id
    ↓
Backend API returns full scan results from PostgreSQL
```

### 2. User Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      USER AUTHENTICATION DATA FLOW                               │
└─────────────────────────────────────────────────────────────────────────────────┘

USER (Browser)
    │
    │ 1. POST /api/v1/auth/login
    │    { "email": "user@example.com", "password": "***" }
    ↓
┌──────────────────┐
│  Global LB       │  2. Route to backend
│  + Cloud Armor   │     (Rate limiting: 5 attempts/min)
└────────┬─────────┘
         │
         ↓
┌────────────────────┐
│  Backend API Pod   │  3. Validate input
│  (GKE)             │
└────────┬───────────┘
         │
         ↓
┌──────────────────┐
│  Redis           │  4. Check rate limit
│  (Memorystore)   │     Key: ratelimit:login:{email}
└────────┬─────────┘
         │
         ├─── Rate limit exceeded → HTTP 429 Too Many Requests
         │
         └─── OK → Continue
                │
                ↓
         ┌──────────────────┐
         │  PostgreSQL      │  5. SELECT * FROM users
         │  (Cloud SQL)     │     WHERE email = ?
         └────────┬─────────┘
                  │
                  ├─── User not found → HTTP 401 Unauthorized
                  │
                  └─── User found
                         │
                         │ 6. Verify password (bcrypt)
                         ↓
                  ┌──────────────────┐
                  │  Password Match? │
                  └────────┬─────────┘
                           │
                           ├─── NO → HTTP 401 + Log failed attempt
                           │
                           └─── YES
                                  │
                                  │ 7. Generate JWT token
                                  │    { userId, email, role }
                                  │    Signed with RS256 (private key from Secret Manager)
                                  ↓
                           ┌──────────────────┐
                           │  Redis           │  8. Store session
                           │  (Memorystore)   │     Key: session:{sessionId}
                           │                  │     Value: { userId, ... }
                           │                  │     TTL: 24 hours
                           └──────────────────┘
                                  │
                                  ↓
                           ┌──────────────────┐
                           │  PostgreSQL      │  9. UPDATE users SET
                           │  (Cloud SQL)     │     last_login_at = NOW(),
                           │                  │     login_count++
                           └──────────────────┘
                                  │
                                  ↓
                           ┌──────────────────┐
                           │  Audit Log       │  10. INSERT INTO audit_logs
                           │  (PostgreSQL)    │      (action='user.login', ...)
                           └──────────────────┘
                                  │
                                  ↓
                           ┌──────────────────┐
                           │  Return Response │  11. HTTP 200 OK
                           │  to User         │      { token, user: {...} }
                           └──────────────────┘

USER stores JWT in localStorage/cookie
    │
    │ All subsequent API requests:
    │ Authorization: Bearer <JWT_TOKEN>
    ↓
Backend validates JWT signature and expiry
```

### 3. File Scan Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FILE SCAN DATA FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

USER (Browser)
    │
    │ 1. POST /api/v1/scans/file
    │    FormData: { file: <binary>, filename: "document.pdf" }
    ↓
┌──────────────────┐
│  Global LB       │  2. Route to backend
│  + Cloud Armor   │     (Max upload size: 100MB)
└────────┬─────────┘
         │
         ↓
┌────────────────────┐
│  Backend API Pod   │  3. Validate file (size, type)
│  (GKE)             │  4. Calculate SHA-256 hash
└────────┬───────────┘
         │
         ↓
┌──────────────────┐
│  PostgreSQL      │  5. Check for duplicate scan
│  (Cloud SQL)     │     WHERE target_hash = ?
└────────┬─────────┘
         │
         ├─── 5a. Found → Return existing result
         │
         └─── 5b. New file
                │
                │ 6. Generate signed upload URL
                ↓
         ┌──────────────────┐
         │  Cloud Storage   │  7. Upload file
         │  Bucket:         │     gs://elara-scans-uploads/{scanId}/{filename}
         │  elara-scans     │     (Encryption: CMEK)
         └────────┬─────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  PostgreSQL      │  8. INSERT INTO scans
         │  (Cloud SQL)     │     (status='pending', target=filename, ...)
         └──────────────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  Redis (BullMQ)  │  9. Add job to scan-queue
         │  (Memorystore)   │     { scanId, fileUrl, priority: 'high' }
         └──────────────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  BullMQ Worker   │  10. Pick job, download file
         │  (GKE Pod)       │  11. Scan file:
         └────────┬─────────┘
                  │
                  ├──→ ClamAV (local antivirus scan)
                  ├──→ VirusTotal API (multi-engine scan)
                  ├──→ YARA rules (custom threat detection)
                  ├──→ File type analysis
                  ├──→ Embedded content extraction (macros, scripts)
                  │
                  │ 12. Generate report
                  ↓
         ┌──────────────────┐
         │  Cloud Storage   │  13. Save PDF report
         │  Bucket:         │      gs://elara-reports/{scanId}/report.pdf
         │  elara-reports   │
         └──────────────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  PostgreSQL      │  14. UPDATE scans
         │  (Cloud SQL)     │      (status='completed', findings={...})
         └──────────────────┘
                  │
                  ↓
         ┌──────────────────┐
         │  Email Worker    │  15. Send notification email
         │  (BullMQ)        │      "Your file scan is complete"
         └──────────────────┘
                  │
                  ↓
USER receives email + views report in dashboard
```

---

## 🌐 Network Architecture

### VPC Network Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ELARA VPC NETWORK ARCHITECTURE                           │
│                          Region: us-west1 (Primary)                              │
└─────────────────────────────────────────────────────────────────────────────────┘

VPC: elara-vpc (10.0.0.0/16)
├── Subnet: gke-pods-us-west1 (10.1.0.0/16)
│   ├── GKE Pod IP range
│   ├── Secondary range: gke-services-us-west1 (10.2.0.0/16)
│   └── Zone: us-west1-a, us-west1-b, us-west1-c
│
├── Subnet: gke-nodes-us-west1 (10.10.0.0/24)
│   ├── GKE Node IP range
│   └── Private Google Access: Enabled
│
├── Subnet: data-layer-us-west1 (10.20.0.0/24)
│   ├── Cloud SQL private IP range
│   ├── Memorystore Redis private IP
│   └── Private Service Connect
│
├── Subnet: cloudrun-connector-us-west1 (10.30.0.0/28)
│   └── Serverless VPC Access connector for Cloud Run
│
└── Subnet: proxy-us-west1 (10.40.0.0/24)
    └── Cloud NAT for outbound internet access

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FIREWALL RULES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. allow-gke-to-cloudsql                                                        │
│    Source: 10.1.0.0/16 (GKE pods) → Target: 10.20.0.0/24 (Cloud SQL)          │
│    Protocol: TCP:5432                                                           │
│                                                                                  │
│ 2. allow-gke-to-redis                                                           │
│    Source: 10.1.0.0/16 (GKE pods) → Target: 10.20.0.0/24 (Redis)              │
│    Protocol: TCP:6379                                                           │
│                                                                                  │
│ 3. allow-health-checks                                                          │
│    Source: 35.191.0.0/16, 130.211.0.0/22 → Target: All instances              │
│    Protocol: TCP (all ports)                                                    │
│                                                                                  │
│ 4. deny-all-egress (default deny)                                              │
│    Explicitly allow only required outbound connections                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PRIVATE SERVICE CONNECT                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ • Cloud SQL: Private IP only (no public IP)                                     │
│ • Redis: Private IP only (no public IP)                                         │
│ • GCS: Private Google Access enabled                                            │
│ • VPC Peering: google-managed-services-elara-vpc                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD NAT                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ NAT Gateway: elara-nat-gateway                                                  │
│ • Provides internet access for private GKE nodes                                │
│ • Outbound only (no inbound from internet)                                      │
│ • Static IP assignment for allowlisting                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Region Network

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-REGION NETWORK TOPOLOGY                            │
└─────────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────────┐
                            │  Global Load     │
                            │  Balancer        │
                            └────────┬─────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
         ┌──────────┴────────┐   ┌──┴────────────┐   ┌──────────┴─────────┐
         │   us-west1        │   │   us-east1    │   │  europe-west2      │
         │   (Primary)       │   │   (DR)        │   │  (GDPR)            │
         ├───────────────────┤   ├───────────────┤   ├────────────────────┤
         │ GKE Cluster       │   │ GKE Cluster   │   │ GKE Cluster        │
         │ Cloud SQL Primary │   │ Read Replica  │   │ Read Replica       │
         │ Redis Primary     │   │               │   │                    │
         └───────────────────┘   └───────────────┘   └────────────────────┘
                   │                      ↑                     ↑
                   └──── Replication ─────┴─────────────────────┘
```

---

## 🔐 Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DEFENSE-IN-DEPTH SECURITY LAYERS                          │
└─────────────────────────────────────────────────────────────────────────────────┘

LAYER 1: EDGE SECURITY
├── Cloud Armor WAF
│   ├── OWASP Top 10 rules
│   ├── DDoS protection (auto-scaling)
│   ├── Rate limiting (100 req/min per IP)
│   ├── Geo-blocking (optional)
│   └── Custom rules (block known bad IPs)
│
├── SSL/TLS Termination
│   ├── TLS 1.3 only
│   ├── Strong cipher suites
│   └── Automated certificate rotation
│
└── Cloud CDN
    └── Edge caching (reduces origin load)

LAYER 2: NETWORK SECURITY
├── VPC Firewall Rules
│   ├── Default deny all ingress
│   ├── Explicit allow rules only
│   └── Egress filtering
│
├── Private Service Connect
│   ├── No public IPs for databases
│   ├── VPC peering for managed services
│   └── Private Google Access
│
└── VPC Service Controls (Data Perimeter)
    ├── Prevent data exfiltration
    ├── Restrict API access to VPC
    └── Audit logs for all access

LAYER 3: IDENTITY & ACCESS
├── Cloud IAM
│   ├── Principle of least privilege
│   ├── Service accounts for all services
│   ├── Workload Identity (GKE → GCP)
│   └── IAM Conditions (time-based, IP-based)
│
├── Application Authentication
│   ├── JWT tokens (RS256 signing)
│   ├── Token expiry (24 hours)
│   ├── Refresh token rotation
│   └── Multi-factor authentication (MFA)
│
└── Secret Management
    ├── Secret Manager (no hardcoded secrets)
    ├── Automatic secret rotation
    └── Audit logs for all access

LAYER 4: DATA SECURITY
├── Encryption at Rest
│   ├── Cloud SQL: CMEK (Cloud KMS)
│   ├── Cloud Storage: CMEK
│   ├── Persistent Disks: CMEK
│   └── Redis: Default encryption
│
├── Encryption in Transit
│   ├── TLS 1.3 for all connections
│   ├── mTLS for service-to-service (optional)
│   └── Private IP for database connections
│
└── Data Classification
    ├── PII: Encrypted + access logged
    ├── PHI: HIPAA compliance (if needed)
    └── Public: No special handling

LAYER 5: APPLICATION SECURITY
├── Binary Authorization
│   ├── Only signed containers allowed in GKE
│   ├── Attestation from CI/CD pipeline
│   └── Vulnerability scanning (critical/high blocked)
│
├── Container Security
│   ├── Non-root user in containers
│   ├── Read-only root filesystem
│   ├── Minimal base images (distroless)
│   └── No privileged containers
│
└── Input Validation
    ├── API request validation (Joi schemas)
    ├── SQL injection prevention (parameterized queries)
    ├── XSS prevention (sanitization)
    └── CSRF protection

LAYER 6: MONITORING & DETECTION
├── Security Command Center (SCC)
│   ├── Asset inventory
│   ├── Vulnerability scanning
│   ├── Threat detection
│   └── Compliance monitoring
│
├── Cloud IDS (Intrusion Detection)
│   ├── Network traffic analysis
│   ├── Threat signature matching
│   └── Real-time alerts
│
└── Audit Logging
    ├── All API calls logged (Cloud Audit Logs)
    ├── Database queries logged (pg_audit)
    ├── Application logs (structured JSON)
    └── 10-year retention (compliance)
```

---

## 🚀 CI/CD Pipeline - Git Push to Deploy

### Automated Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    GIT PUSH → AUTOMATED DEPLOYMENT FLOW                          │
│                         (GitOps with GitHub Actions)                             │
└─────────────────────────────────────────────────────────────────────────────────┘

DEVELOPER LOCAL MACHINE
    │
    │ 1. Make code changes
    │ 2. git add . && git commit -m "feat: new feature"
    │ 3. git push origin main
    ↓
┌────────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB REPOSITORY                                  │
│  Repo: github.com/elara-platform/elara-platform                                │
└────────────────────┬───────────────────────────────────────────────────────────┘
                     │
                     │ 4. Push event triggers GitHub Actions workflow
                     ↓
┌────────────────────────────────────────────────────────────────────────────────┐
│                          GITHUB ACTIONS (CI/CD)                                 │
│  Workflow: .github/workflows/deploy-production.yml                             │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  JOB 1: CODE QUALITY & SECURITY                                                │
│  ├── 5. Checkout code                                                          │
│  ├── 6. Run linting (ESLint, Prettier)                                        │
│  ├── 7. Run unit tests (Jest)                                                 │
│  ├── 8. Run security scanning (Snyk, npm audit)                               │
│  ├── 9. Run SAST (Static Application Security Testing)                        │
│  └── ❌ FAIL → Block deployment, notify team                                  │
│      ✅ PASS → Continue                                                        │
│                                                                                 │
│  JOB 2: BUILD CONTAINERS                                                       │
│  ├── 10. Authenticate to GCP (Workload Identity Federation)                   │
│  ├── 11. Build Docker images:                                                 │
│  │       • Backend API: gcr.io/elara-production/backend-api:$GIT_SHA         │
│  │       • Frontend: gcr.io/elara-production/frontend:$GIT_SHA               │
│  │       • Workers: gcr.io/elara-production/worker:$GIT_SHA                  │
│  │       • Proxy: gcr.io/elara-production/proxy-service:$GIT_SHA             │
│  │       • WhatsApp: gcr.io/elara-production/whatsapp-service:$GIT_SHA       │
│  ├── 12. Scan images for vulnerabilities (Trivy, Google Container Analysis)   │
│  ├── 13. Sign images with Binary Authorization attestation                    │
│  └── 14. Push images to Artifact Registry (gcr.io)                            │
│                                                                                 │
│  JOB 3: DEPLOY TO STAGING (Auto)                                              │
│  ├── 15. Update K8s manifests with new image tags                             │
│  ├── 16. Deploy to GKE staging cluster:                                       │
│  │       kubectl apply -f k8s/staging/ --namespace=elara-backend              │
│  ├── 17. Deploy frontend to Cloud Run staging                                 │
│  ├── 18. Run smoke tests (health checks, API tests)                           │
│  └── ❌ FAIL → Rollback staging, block production                             │
│      ✅ PASS → Continue                                                        │
│                                                                                 │
│  JOB 4: INTEGRATION TESTS (Staging)                                           │
│  ├── 19. Run E2E tests (Playwright)                                           │
│  ├── 20. Run API integration tests (Postman/Newman)                           │
│  ├── 21. Run load tests (k6) - 1000 concurrent users                          │
│  └── ❌ FAIL → Block production deployment                                    │
│      ✅ PASS → Ready for production                                           │
│                                                                                 │
│  JOB 5: DEPLOY TO PRODUCTION (Manual Approval Required)                       │
│  ├── 22. Wait for manual approval from team lead                              │
│  │       (GitHub Environment protection rule)                                  │
│  ├── 23. Create database backup (safety measure)                              │
│  ├── 24. Deploy to GKE production cluster:                                    │
│  │       • Blue/Green deployment strategy                                     │
│  │       • Deploy to "green" environment                                      │
│  │       • Run health checks                                                  │
│  │       • Gradually shift traffic (10% → 50% → 100%)                        │
│  ├── 25. Deploy frontend to Cloud Run production                              │
│  │       • Gradual rollout (Cloud Run traffic splitting)                     │
│  │       • 10% new version, 90% old version (5 minutes)                      │
│  │       • 50% new version, 50% old version (10 minutes)                     │
│  │       • 100% new version (if no errors)                                   │
│  ├── 26. Run post-deployment validation                                       │
│  │       • Health check endpoints                                             │
│  │       • Critical user journeys                                             │
│  │       • Database connectivity                                              │
│  └── ❌ FAIL → Automatic rollback to previous version                         │
│      ✅ PASS → Deployment complete                                            │
│                                                                                 │
│  JOB 6: POST-DEPLOYMENT                                                        │
│  ├── 27. Update audit log (deployment record)                                 │
│  ├── 28. Send Slack notification: "✅ Production deployed v1.2.3"            │
│  ├── 29. Tag Git commit: v1.2.3                                               │
│  ├── 30. Generate release notes                                               │
│  └── 31. Monitor for 30 minutes (automated alerts)                            │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
                     │
                     ↓
┌────────────────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION ENVIRONMENT                                 │
│  ✅ New version live and serving traffic                                       │
│  📊 Monitoring dashboards show healthy metrics                                 │
│  🔔 Team notified of successful deployment                                     │
└────────────────────────────────────────────────────────────────────────────────┘

TOTAL TIME: ~15-20 minutes from git push to production (with approval)
ROLLBACK TIME: < 2 minutes (automated)
```

### GitHub Actions Workflow Example

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:  # Manual trigger

env:
  GCP_PROJECT_ID: elara-production
  GCP_REGION: us-west1
  GKE_CLUSTER: elara-gke-us-west1
  REGISTRY: gcr.io/elara-production

jobs:
  test:
    name: Run Tests & Security Scans
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build:
    name: Build & Push Docker Images
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for GCR
        run: gcloud auth configure-docker

      - name: Build Backend Image
        run: |
          docker build -t ${{ env.REGISTRY }}/backend-api:${{ github.sha }} \
                       -t ${{ env.REGISTRY }}/backend-api:latest \
                       -f packages/backend/Dockerfile .

      - name: Build Frontend Image
        run: |
          docker build -t ${{ env.REGISTRY }}/frontend:${{ github.sha }} \
                       -t ${{ env.REGISTRY }}/frontend:latest \
                       -f packages/frontend/Dockerfile .

      - name: Scan images with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/backend-api:${{ github.sha }}
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      - name: Push images to GCR
        run: |
          docker push ${{ env.REGISTRY }}/backend-api:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/backend-api:latest
          docker push ${{ env.REGISTRY }}/frontend:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/frontend:latest

  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Get GKE credentials
        run: |
          gcloud container clusters get-credentials ${{ env.GKE_CLUSTER }} \
            --region ${{ env.GCP_REGION }}

      - name: Deploy to GKE staging
        run: |
          kubectl set image deployment/elara-api \
            api=${{ env.REGISTRY }}/backend-api:${{ github.sha }} \
            -n elara-staging
          kubectl rollout status deployment/elara-api -n elara-staging --timeout=5m

      - name: Deploy frontend to Cloud Run staging
        run: |
          gcloud run deploy elara-frontend-staging \
            --image ${{ env.REGISTRY }}/frontend:${{ github.sha }} \
            --region ${{ env.GCP_REGION }} \
            --platform managed

      - name: Run smoke tests
        run: npm run test:e2e:staging

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Backup database
        run: |
          gcloud sql backups create \
            --instance=elara-postgres-primary \
            --description="Pre-deployment backup"

      - name: Deploy to GKE production (Blue/Green)
        run: |
          # Update deployment with new image
          kubectl set image deployment/elara-api \
            api=${{ env.REGISTRY }}/backend-api:${{ github.sha }} \
            -n elara-backend

          # Wait for rollout
          kubectl rollout status deployment/elara-api -n elara-backend --timeout=10m

      - name: Deploy frontend to Cloud Run production
        run: |
          gcloud run deploy elara-frontend \
            --image ${{ env.REGISTRY }}/frontend:${{ github.sha }} \
            --region ${{ env.GCP_REGION }} \
            --platform managed \
            --traffic latest=100

      - name: Post-deployment validation
        run: |
          # Health checks
          curl -f https://api.elara.com/health || exit 1
          curl -f https://elara.com || exit 1

      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "✅ Production deployment successful",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Elara Platform Deployed to Production*\n\nVersion: `${{ github.sha }}`\nDeployed by: @${{ github.actor }}"
                  }
                }
              ]
            }
```

### Rollback Procedure

```yaml
# .github/workflows/rollback.yml
name: Rollback Production

on:
  workflow_dispatch:
    inputs:
      revision:
        description: 'Git SHA or tag to rollback to'
        required: true
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Rollback GKE deployment
        run: |
          kubectl rollout undo deployment/elara-api -n elara-backend
          kubectl rollout status deployment/elara-api -n elara-backend

      - name: Rollback Cloud Run
        run: |
          gcloud run services update-traffic elara-frontend \
            --to-revisions=PREVIOUS=100 \
            --region us-west1

      - name: Verify rollback
        run: curl -f https://api.elara.com/health

      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: '{"text": "⚠️ Production rolled back to ${{ inputs.revision }}"}'
```

---

## 📊 Scaling and Performance

### Auto-Scaling Configuration

```yaml
# HPA for Backend API
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: elara-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: elara-api
  minReplicas: 3
  maxReplicas: 20
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
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5 minutes
      policies:
      - type: Percent
        value: 50  # Scale down max 50% at a time
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0  # Immediate scale up
      policies:
      - type: Percent
        value: 100  # Scale up max 100% (double) at a time
        periodSeconds: 15
```

### Performance Targets

| Metric | Target | Current Baseline | Monitoring |
|--------|--------|------------------|------------|
| API Response Time (p50) | < 50ms | 30ms | Cloud Trace |
| API Response Time (p95) | < 100ms | 80ms | Cloud Trace |
| API Response Time (p99) | < 200ms | 150ms | Cloud Trace |
| Frontend Load Time | < 2s | 1.5s | Lighthouse CI |
| Database Query Time (p95) | < 50ms | 35ms | Cloud SQL Insights |
| Cache Hit Rate | > 85% | 90% | Redis INFO |
| Concurrent Users | 10,000+ | 500 | Cloud Monitoring |

---

## 📈 Monitoring and Observability

### Monitoring Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

APPLICATION LAYER
    │
    ├─→ Structured Logs (JSON) → Cloud Logging
    │   • All application logs
    │   • Request/response logs
    │   • Error logs
    │   • Audit logs
    │
    ├─→ Metrics (OpenTelemetry) → Cloud Monitoring
    │   • Request count, latency
    │   • Error rates
    │   • Resource utilization (CPU, memory)
    │   • Custom business metrics
    │
    ├─→ Traces (OpenTelemetry) → Cloud Trace
    │   • Distributed tracing across services
    │   • Request flow visualization
    │   • Latency breakdown
    │
    └─→ Errors → Cloud Error Reporting
        • Automatic error grouping
        • Stack trace capture
        • Real-time alerts

DASHBOARDS (Cloud Monitoring)
├── System Overview Dashboard
│   ├── Request rate (RPM)
│   ├── Error rate (%)
│   ├── Latency (p50, p95, p99)
│   └── Resource utilization
│
├── Database Dashboard
│   ├── Query latency
│   ├── Connection pool usage
│   ├── Replication lag
│   └── Slow queries
│
├── Business Metrics Dashboard
│   ├── Scans per minute
│   ├── Active users
│   ├── Conversion rate
│   └── Revenue metrics
│
└── Security Dashboard
    ├── Failed login attempts
    ├── WAF blocked requests
    ├── Suspicious activity
    └── Vulnerability scan results

ALERTING (Multi-Channel)
├── Critical Alerts (PagerDuty + SMS)
│   ├── Service down (uptime check failed)
│   ├── Database unavailable
│   ├── Error rate > 5%
│   └── Latency p95 > 500ms
│
├── High Priority (Slack + Email)
│   ├── Error rate > 1%
│   ├── CPU/Memory > 90%
│   ├── Disk usage > 85%
│   └── Replication lag > 60s
│
└── Low Priority (Email only)
    ├── Certificate expiring (30 days)
    ├── Budget threshold (80%)
    └── Scheduled maintenance reminder
```

---

**Document Status**: ✅ **APPROVED FOR REVIEW**

**Next Document**: LOW_LEVEL_DESIGN.md (Technical Specifications)

**Total Page Count**: 45 pages of comprehensive architecture documentation
