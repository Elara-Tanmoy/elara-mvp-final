# Current Elara Platform → GCP Infrastructure Mapping

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Purpose**: Map current working Elara platform to GCP infrastructure

---

## 📋 Current Platform Analysis

### Monorepo Structure
```
elara-platform/ (pnpm workspaces)
├── packages/admin/           # Admin dashboard
├── packages/backend/         # Node.js + Express API
├── packages/blockchain/      # Web3 integration (Phase 3)
├── packages/frontend/        # React + Vite
└── packages/shared/          # Shared utilities
```

### Technology Stack

#### Backend (@elara/backend)
```yaml
Runtime: Node.js 20.x
Framework: Express 4.21
Type: ES Modules (type: module)
Build: TypeScript 5.6

Dependencies:
  Database & ORM:
    - @prisma/client: 5.22.0 (PostgreSQL ORM)
    - pg: 8.13.1 (PostgreSQL driver)
    - neo4j-driver: 5.15.0 (Graph database - Phase 1)

  Queue & Cache:
    - bullmq: 5.13.2 (Background jobs)
    - ioredis: 5.4.1 (Redis client)
    - node-cache: 5.1.2 (In-memory cache)

  AI & ML:
    - @anthropic-ai/sdk: 0.27.3 (Claude API)
    - openai: 4.104.0 (OpenAI API)
    - @google/generative-ai: 0.24.1 (Gemini API)
    - chromadb: 1.8.1 (Vector database for RAG)
    - langchain: 0.3.2 (LLM orchestration)
    - tesseract.js: 5.1.1 (OCR)

  Security & Auth:
    - jsonwebtoken: 9.0.2 (JWT authentication)
    - bcryptjs: 2.4.3 (Password hashing)
    - helmet: 7.1.0 (Security headers)
    - express-rate-limit: 7.4.0 (Rate limiting)
    - cors: 2.8.5 (CORS handling)

  Web Scraping & Analysis:
    - cheerio: 1.0.0 (HTML parsing)
    - axios: 1.12.2 (HTTP client)
    - whois-json: 2.0.4 (WHOIS lookups)

  File Processing:
    - multer: 1.4.5 (File uploads)
    - sharp: 0.33.5 (Image processing)
    - pdf-parse: 1.1.1 (PDF parsing)
    - papaparse: 5.4.1 (CSV parsing)

  Blockchain (Phase 3):
    - ethers: 6.13.0 (Ethereum/Polygon interaction)

  Utilities:
    - winston: 3.14.2 (Logging)
    - dotenv: 16.4.5 (Environment variables)
    - zod: 3.23.8 (Schema validation)
```

#### Frontend (@elara/frontend)
```yaml
Framework: React 18.3.1
Build Tool: Vite 5.4.8
Styling: Tailwind CSS 3.4.13
Routing: React Router DOM 6.26.2

Dependencies:
  - lucide-react: 0.447.0 (Icons)
  - recharts: 2.15.4 (Charts)
  - axios: 1.7.7 (HTTP client)
  - @tensorflow/tfjs: 4.17.0 (Client-side ML)
  - react-dropzone: 14.2.3 (File uploads)
  - date-fns: 4.1.0 (Date utilities)
```

---

## 🌐 Current Environment Variables

### Backend Required Variables

```bash
# ========== DATABASE ==========
DATABASE_URL="postgresql://elara:PASSWORD@localhost:5432/elara_db"

# ========== REDIS ==========
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="elara_redis_pass"

# ========== NEO4J (Phase 1 - Trust Graph) ==========
NEO4J_URI="neo4j+s://your-instance.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="your-neo4j-password"

# ========== BLOCKCHAIN (Phase 3) ==========
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
BLOCKCHAIN_PRIVATE_KEY="your-private-key-here"
SCAM_REPORT_REGISTRY_ADDRESS=""
ELARA_TOKEN_ADDRESS=""
REPUTATION_BADGES_ADDRESS=""

# ========== CHROMADB (RAG Chatbot) ==========
CHROMADB_URL="http://localhost:8000"

# ========== JWT AUTHENTICATION ==========
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="30m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# ========== AI API KEYS ==========
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-proj-..."
GOOGLE_AI_API_KEY="AIza..."

# ========== THREAT INTELLIGENCE APIs (Optional) ==========
VIRUSTOTAL_API_KEY=""
GOOGLE_SAFE_BROWSING_API_KEY=""
ABUSEIPDB_API_KEY=""

# ========== SERVER CONFIGURATION ==========
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="https://elara.com"

# ========== RATE LIMITING ==========
RATE_LIMIT_FREE=100
RATE_LIMIT_PRO=1000
RATE_LIMIT_ENTERPRISE=10000

# ========== FILE UPLOAD ==========
MAX_FILE_SIZE=52428800  # 50MB
UPLOAD_DIR="./uploads"
```

### Frontend Environment Variables

```bash
# ========== API ENDPOINT ==========
VITE_API_URL="https://api.elara.com"
VITE_WS_URL="wss://api.elara.com"
```

---

## 🗄️ Database Schema (Prisma)

### Current Databases

1. **PostgreSQL (Primary Database)**
   - ORM: Prisma
   - Schema Location: `packages/backend/prisma/schema.prisma`
   - Tables: Users, Scans, Threats, AuditLogs, Sessions, ApiKeys, WhatsAppMessages, etc.
   - Migrations: `prisma/migrations/`

2. **Redis (Cache & Queue)**
   - Use Case: BullMQ job queues, rate limiting, session storage
   - Client: ioredis

3. **ChromaDB (Vector Database)**
   - Use Case: RAG (Retrieval-Augmented Generation) for AI chatbot
   - Client: chromadb npm package

4. **Neo4j (Optional - Phase 1)**
   - Use Case: Trust graph for reputation system
   - Client: neo4j-driver

---

## 🚀 Services to Deploy

### Service Matrix

| Service Name | Current Stack | GCP Deployment | Port | Replicas | Notes |
|--------------|---------------|----------------|------|----------|-------|
| **Frontend** | React + Vite | Cloud Run | 8080 | 0-10 | Stateless, auto-scale |
| **Backend API** | Express + Prisma | GKE Deployment | 3001 | 3-20 | Main API + WebSocket |
| **BullMQ Workers** | Node.js + BullMQ | GKE Deployment | N/A | 5-30 | Background jobs |
| **ChromaDB** | Python + FastAPI | GKE StatefulSet | 8000 | 2-5 | Vector database |
| **PostgreSQL** | Prisma ORM | Cloud SQL (HA) | 5432 | HA | Managed database |
| **Redis** | ioredis | Memorystore (HA) | 6379 | HA | Managed Redis |
| **Neo4j** | (Optional) | Neo4j Aura | 7687 | Managed | Phase 1 feature |

---

## 📊 GCP Resource Mapping

### Compute Resources

```yaml
Frontend (Cloud Run):
  Service: elara-frontend
  Image: gcr.io/elara-production/frontend:latest
  Region: us-west1
  Config:
    memory: 512Mi
    cpu: 1
    max_instances: 10
    min_instances: 0  # Scale to zero
  Environment:
    VITE_API_URL: https://api.elara.com
    VITE_WS_URL: wss://api.elara.com

Backend API (GKE):
  Deployment: elara-api
  Namespace: elara-backend
  Image: gcr.io/elara-production/backend-api:latest
  Config:
    replicas: 3-20 (HPA)
    memory: 1Gi
    cpu: 500m
  Environment:
    DATABASE_URL: From Secret Manager
    REDIS_URL: From Secret Manager
    CHROMADB_URL: http://chromadb-service:8000
    JWT_SECRET: From Secret Manager
    ANTHROPIC_API_KEY: From Secret Manager
    OPENAI_API_KEY: From Secret Manager
    GOOGLE_AI_API_KEY: From Secret Manager
    NODE_ENV: production
    PORT: 3001

BullMQ Workers (GKE):
  Deployment: elara-worker
  Namespace: elara-workers
  Image: gcr.io/elara-production/worker:latest
  Config:
    replicas: 5-30 (HPA)
    memory: 2Gi
    cpu: 1000m
  Environment:
    DATABASE_URL: From Secret Manager
    REDIS_URL: From Secret Manager
    # Same API keys as backend

ChromaDB (GKE StatefulSet):
  StatefulSet: chromadb
  Namespace: elara-backend
  Image: chromadb/chroma:0.4.18
  Config:
    replicas: 2-5
    memory: 4Gi
    cpu: 2
    storage: 100Gi SSD
  Port: 8000
```

### Database Resources

```yaml
Cloud SQL PostgreSQL:
  Instance: elara-postgres-primary
  Version: POSTGRES_15
  Tier: db-custom-8-32768 (8 vCPU, 32GB RAM)
  Storage: 500GB SSD (auto-expand)
  HA: Regional (us-west1-a + us-west1-b standby)
  Replicas:
    - us-west1-c (read replica)
    - us-east1-a (DR replica)
  Backup: Daily + PITR (7 days)
  Encryption: CMEK (Cloud KMS)

Memorystore Redis:
  Instance: elara-redis-primary
  Version: REDIS_7_0
  Tier: STANDARD_HA
  Memory: 5GB
  Region: us-west1
  Replicas: Automatic (us-west1-b)
  Persistence: RDB snapshots (6 hours)
```

### Storage Resources

```yaml
Cloud Storage Buckets:
  elara-scan-uploads:
    Location: us-multi
    Storage Class: Standard
    Purpose: File upload scans (temporary)
    Lifecycle: Delete after 30 days
    Encryption: CMEK

  elara-scan-reports:
    Location: us-multi
    Storage Class: Nearline
    Purpose: Generated PDF reports
    Lifecycle: Move to Archive after 90 days
    Encryption: CMEK

  elara-screenshots:
    Location: us-multi
    Storage Class: Standard
    Purpose: Proxy service screenshots
    Lifecycle: Delete after 7 days
    Encryption: CMEK

  elara-backups:
    Location: us-multi
    Storage Class: Archive
    Purpose: Database exports, long-term backups
    Retention: 10 years
    Encryption: CMEK
```

---

## 🔐 Secret Manager Secrets

### Secrets to Create

```yaml
Secrets Required:
  # Database
  - production-backend-db-password
  - production-backend-db-connection-string

  # Redis
  - production-backend-redis-password
  - production-backend-redis-url

  # JWT
  - production-backend-jwt-secret
  - production-backend-jwt-private-key (RS256)
  - production-backend-jwt-public-key (RS256)

  # AI APIs
  - production-backend-anthropic-api-key
  - production-backend-openai-api-key
  - production-backend-google-ai-api-key

  # Threat Intelligence (Optional)
  - production-backend-virustotal-api-key
  - production-backend-google-safe-browsing-api-key
  - production-backend-abuseipdb-api-key

  # Neo4j (Optional - Phase 1)
  - production-backend-neo4j-uri
  - production-backend-neo4j-username
  - production-backend-neo4j-password

  # Blockchain (Phase 3)
  - production-blockchain-private-key
  - production-blockchain-polygon-rpc-url
```

---

## 📈 Monitoring & Logging

### Logging Requirements

```yaml
Application Logs:
  Backend API:
    - Request/response logs (express-winston)
    - Error logs
    - Security events
    - Performance metrics
    Destination: Cloud Logging

  Workers:
    - Job processing logs
    - Success/failure events
    - Performance metrics
    Destination: Cloud Logging

Metrics to Collect:
  - Request rate (RPM)
  - Response time (p50, p95, p99)
  - Error rate (%)
  - Database query time
  - Redis cache hit rate
  - Queue depth (BullMQ)
  - Active connections
  - Memory usage
  - CPU usage
```

---

## 🔄 CI/CD Pipeline Requirements

### GitHub Actions Workflow

```yaml
Triggers:
  - Push to main branch
  - Pull request to main
  - Manual workflow dispatch

Jobs:
  1. Test & Lint
     - npm test
     - npm run lint
     - Security scan (Snyk)

  2. Build Docker Images
     - Build frontend image
     - Build backend API image
     - Build worker image
     - Scan images (Trivy)
     - Push to GCR

  3. Deploy to Staging
     - Deploy to GKE staging
     - Run smoke tests

  4. Deploy to Production (manual approval)
     - Deploy to GKE production
     - Gradual rollout (10% → 50% → 100%)
     - Post-deployment validation
```

---

## 🎯 Migration Strategy

### Phase-by-Phase Deployment

```yaml
Phase 0: Infrastructure Setup (Week 1)
  - Create GCP project
  - Set up VPC, subnets, firewall rules
  - Deploy Cloud SQL, Redis, Cloud Storage
  - Configure Secret Manager

## ✅ Migration Status: COMPLETED

**All infrastructure has been successfully migrated to GCP.**

Current Production State (as of 2025-10-24):
  ✅ Database: Cloud SQL PostgreSQL (elara-postgres-optimized)
  ✅ Backend API: Deployed on GKE (elara-backend namespace)
  ✅ Frontend: Deployed on GKE (elara-frontend namespace)
  ✅ Proxy Service: Deployed on GKE (elara-proxy namespace)
  ✅ Workers: Deployed on GKE (elara-workers namespace)
  ✅ Redis: Cloud Memorystore (elara-redis-primary)
  ✅ Monitoring: Cloud Monitoring & Logging configured
  ✅ CI/CD: GitHub Actions → Cloud Build → GKE

Development Environment:
  ✅ All services deployed with "-dev" suffix namespaces
  ✅ Separate dev database (elara_dev)
  ✅ LoadBalancer services for external access
```

---

## ✅ Validation Checklist

### Pre-Deployment
```
☐ All secrets created in Secret Manager
☐ Database schema matches Prisma models
☐ Environment variables mapped correctly
☐ Docker images build successfully
☐ Kubernetes manifests validated
☐ DNS records prepared
☐ SSL certificates ready
```

### Post-Deployment
```
☐ Frontend loads correctly
☐ User registration works
☐ User login works
☐ URL scan completes
☐ File scan completes
☐ Message scan works
☐ WebSocket connections work
☐ Background jobs process
☐ Logs flowing to Cloud Logging
☐ Metrics visible in Cloud Monitoring
☐ Alerts triggering correctly
```

---

**Document Status**: ✅ **READY FOR INFRASTRUCTURE GENERATION**

**Next Steps**:
1. Generate Terraform code (Checkpoint 2)
2. Generate Kubernetes manifests
3. Generate Dockerfiles
4. Generate CI/CD pipeline
5. Generate deployment scripts
6. Commit Checkpoint 3
