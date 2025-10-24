# Elara Platform - High-Level Design (HLD)

**Version**: 1.0.0
**Last Updated**: 2025-10-24
**Status**: Production Ready

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [High-Level Architecture](#3-high-level-architecture)
4. [System Components](#4-system-components)
5. [Data Flow](#5-data-flow)
6. [Integration Architecture](#6-integration-architecture)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Scalability & Performance](#9-scalability--performance)
10. [Technology Decisions](#10-technology-decisions)

---

## 1. System Overview

### 1.1 Purpose

Elara is an enterprise-grade cybersecurity platform that provides real-time threat intelligence, automated security scanning, and AI-powered threat analysis to protect organizations from phishing, malware, and advanced cyber threats.

### 1.2 Scope

```mermaid
mindmap
  root((Elara Platform))
    Core Services
      Threat Detection
      AI Analysis
      Threat Intelligence
      Scanning Engine
    Access Channels
      Web Application
      Browser Extension
      WhatsApp Bot
      REST API
    Enterprise Features
      Multi-tenancy
      Role-Based Access
      Audit Logging
      SLA Management
    Infrastructure
      Cloud Native
      Auto-scaling
      High Availability
      Disaster Recovery
```

### 1.3 Stakeholders

| Stakeholder | Role | Primary Concerns |
|------------|------|-----------------|
| **End Users** | Individual security users | Ease of use, accuracy, speed |
| **Security Analysts** | Enterprise security teams | Threat intelligence, analysis depth |
| **Administrators** | System administrators | Configuration, monitoring, reporting |
| **Developers** | API consumers | API availability, documentation |
| **DevOps Team** | Infrastructure management | Reliability, scalability, cost |
| **Compliance Officers** | Regulatory compliance | Audit logs, data protection, GDPR |

---

## 2. Architecture Principles

### 2.1 Core Principles

```mermaid
graph LR
    A[Cloud-Native] --> B[Microservices]
    B --> C[API-First]
    C --> D[Security-First]
    D --> E[Scalability]
    E --> F[Observability]
    F --> G[Cost-Efficiency]
    G --> A

    style A fill:#4285F4,stroke:#333,stroke-width:2px,color:#fff
    style D fill:#EA4335,stroke:#333,stroke-width:2px,color:#fff
    style E fill:#34A853,stroke:#333,stroke-width:2px,color:#fff
```

### 2.2 Design Principles

- **Separation of Concerns**: Clear boundaries between components
- **Loose Coupling**: Components communicate via well-defined APIs
- **High Cohesion**: Related functionality grouped together
- **Fail-Fast**: Early error detection and graceful degradation
- **Statelessness**: API services maintain no session state
- **Idempotency**: Safe retry of operations
- **Eventual Consistency**: Asynchronous processing for scalability

### 2.3 Quality Attributes

| Attribute | Target | Strategy |
|-----------|--------|----------|
| **Availability** | 99.9% uptime | Multi-region deployment, health checks, auto-healing |
| **Scalability** | 10K concurrent users | Horizontal scaling, caching, queue-based processing |
| **Performance** | < 2s response time | Redis caching, CDN, database indexing |
| **Security** | Enterprise-grade | JWT auth, RBAC, encryption, audit logging |
| **Maintainability** | < 1 day for fixes | Modular architecture, comprehensive logging |
| **Cost** | < $1000/month | Serverless where possible, auto-scaling, cost monitoring |

---

## 3. High-Level Architecture

### 3.1 System Context Diagram

```mermaid
graph TB
    subgraph "External Users"
        EU[End Users]
        SA[Security Analysts]
        ADMIN[Administrators]
        DEV[API Developers]
    end

    subgraph "Elara Platform"
        WEB[Web Application]
        API[Backend API]
        WORKER[Worker Services]
        DB[(Database)]
        CACHE[(Cache)]
    end

    subgraph "External Services"
        CLAUDE[Claude AI]
        GPT[GPT-4]
        GEMINI[Gemini]
        VT[VirusTotal]
        ABUSE[AbuseIPDB]
        URL[URLhaus]
    end

    EU --> WEB
    SA --> WEB
    ADMIN --> WEB
    DEV --> API

    WEB --> API
    API --> DB
    API --> CACHE
    API --> WORKER
    WORKER --> DB

    API --> CLAUDE
    API --> GPT
    API --> GEMINI
    API --> VT
    API --> ABUSE
    API --> URL

    style WEB fill:#61DAFB,stroke:#333,stroke-width:2px
    style API fill:#339933,stroke:#333,stroke-width:2px,color:#fff
    style DB fill:#4169E1,stroke:#333,stroke-width:2px,color:#fff
    style CACHE fill:#DC382D,stroke:#333,stroke-width:2px,color:#fff
```

### 3.2 Logical Architecture

```mermaid
graph TB
    subgraph "Presentation Layer"
        WEBAPP[Web Application<br/>React SPA]
        MOBILE[Browser Extension<br/>Chrome/Firefox]
        WHATSAPP[WhatsApp Interface<br/>Business API]
    end

    subgraph "API Gateway Layer"
        GATEWAY[API Gateway<br/>Load Balancer]
        AUTH[Authentication<br/>JWT Service]
        RATELIMIT[Rate Limiter<br/>Tier-based]
    end

    subgraph "Application Layer"
        SCAN[Scan Service]
        AI[AI Analysis Service]
        INTEL[Threat Intel Service]
        USER[User Service]
        ADMIN[Admin Service]
    end

    subgraph "Business Logic Layer"
        ORCHESTRATOR[Scan Orchestrator]
        CONSENSUS[AI Consensus Engine]
        DEDUP[Deduplication Service]
        SCORING[Risk Scoring Engine]
    end

    subgraph "Data Access Layer"
        ORM[Prisma ORM]
        CACHE_MGR[Cache Manager]
        QUEUE_MGR[Queue Manager]
    end

    subgraph "Infrastructure Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis)]
        STORAGE[Cloud Storage]
        SECRET[Secret Manager]
    end

    WEBAPP --> GATEWAY
    MOBILE --> GATEWAY
    WHATSAPP --> GATEWAY

    GATEWAY --> AUTH
    GATEWAY --> RATELIMIT
    RATELIMIT --> SCAN
    RATELIMIT --> AI
    RATELIMIT --> INTEL
    RATELIMIT --> USER
    RATELIMIT --> ADMIN

    SCAN --> ORCHESTRATOR
    AI --> CONSENSUS
    INTEL --> DEDUP

    ORCHESTRATOR --> SCORING
    CONSENSUS --> SCORING
    DEDUP --> SCORING

    SCORING --> ORM
    SCORING --> CACHE_MGR
    SCORING --> QUEUE_MGR

    ORM --> POSTGRES
    CACHE_MGR --> REDIS
    QUEUE_MGR --> REDIS
    SCAN --> STORAGE
    AUTH --> SECRET

    style WEBAPP fill:#61DAFB,stroke:#333,stroke-width:2px
    style ORCHESTRATOR fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style POSTGRES fill:#4169E1,stroke:#333,stroke-width:2px,color:#fff
    style REDIS fill:#DC382D,stroke:#333,stroke-width:2px,color:#fff
```

---

## 4. System Components

### 4.1 Component Overview

```mermaid
graph LR
    subgraph "Frontend Components"
        UI[UI Components<br/>React]
        ROUTER[Router<br/>React Router]
        STATE[State Management<br/>Context API]
        HTTP[HTTP Client<br/>Axios]
    end

    subgraph "Backend Components"
        ROUTES[Route Handlers]
        CONTROLLERS[Controllers]
        SERVICES[Business Services]
        MIDDLEWARE[Middleware]
    end

    subgraph "Core Services"
        SCANNER[URL Scanner]
        FILE_SCANNER[File Scanner]
        MSG_SCANNER[Message Scanner]
        AI_SVC[AI Service]
        TI_SVC[Threat Intel Service]
    end

    subgraph "Support Services"
        LOGGER[Logging Service]
        MONITOR[Monitoring Service]
        AUDIT[Audit Service]
        NOTIF[Notification Service]
    end

    UI --> ROUTER
    ROUTER --> STATE
    STATE --> HTTP
    HTTP --> ROUTES

    ROUTES --> CONTROLLERS
    CONTROLLERS --> MIDDLEWARE
    MIDDLEWARE --> SERVICES

    SERVICES --> SCANNER
    SERVICES --> FILE_SCANNER
    SERVICES --> MSG_SCANNER
    SERVICES --> AI_SVC
    SERVICES --> TI_SVC

    SCANNER --> LOGGER
    AI_SVC --> MONITOR
    CONTROLLERS --> AUDIT
    SERVICES --> NOTIF

    style UI fill:#61DAFB,stroke:#333,stroke-width:2px
    style SERVICES fill:#339933,stroke:#333,stroke-width:2px,color:#fff
    style SCANNER fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
```

### 4.2 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Web Application** | User interface for scanning and results | React 18, TypeScript, Tailwind CSS |
| **Browser Extension** | Real-time URL scanning in browser | Chrome/Firefox Extensions API |
| **WhatsApp Bot** | Messaging interface for scans | WhatsApp Business API |
| **Backend API** | Business logic and data management | Node.js 20, Express.js, TypeScript |
| **Worker Service** | Asynchronous job processing | BullMQ, Node.js |
| **Proxy Service** | Headless browser scanning | Puppeteer, Chrome |
| **Database** | Persistent data storage | PostgreSQL 15, Prisma ORM |
| **Cache** | Session and result caching | Redis 7.0 |
| **Secret Manager** | Credential management | GCP Secret Manager |

---

## 5. Data Flow

### 5.1 URL Scanning Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend
    participant API
    participant Cache
    participant Scanner
    participant ThreatIntel
    participant AI
    participant DB

    User->>Frontend: Submit URL for scanning
    Frontend->>API: POST /api/v2/scan/url
    API->>Cache: Check if URL cached

    alt Cache Hit (< 1 hour)
        Cache-->>API: Return cached result
        API-->>Frontend: Return scan result
    else Cache Miss
        API->>DB: Check if scanned before

        alt Previously Scanned
            DB-->>API: Return previous result
            API->>Cache: Cache result (TTL: 1h)
        else Never Scanned
            API->>Scanner: Initiate scan

            par Parallel Scanning
                Scanner->>ThreatIntel: Query 18+ sources
                Scanner->>Scanner: Analyze domain
                Scanner->>Scanner: Check SSL/TLS
                Scanner->>Scanner: Analyze content
            end

            ThreatIntel-->>Scanner: Threat data
            Scanner->>AI: Send for AI analysis

            par Multi-LLM Consensus
                AI->>AI: Claude analysis
                AI->>AI: GPT-4 analysis
                AI->>AI: Gemini analysis
            end

            AI-->>Scanner: Consensus result
            Scanner->>Scanner: Calculate risk score
            Scanner->>DB: Store scan result
            Scanner->>Cache: Cache result
            Scanner-->>API: Return result
        end

        API-->>Frontend: Return scan result
    end

    Frontend-->>User: Display risk score and details
```

### 5.2 Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend
    participant API
    participant Auth
    participant DB
    participant Cache

    User->>Frontend: Login with credentials
    Frontend->>API: POST /api/v2/auth/login
    API->>Auth: Validate credentials
    Auth->>DB: Query user by email
    DB-->>Auth: Return user data
    Auth->>Auth: Verify password (bcrypt)

    alt Valid Credentials
        Auth->>Auth: Generate JWT tokens
        Auth->>DB: Store refresh token
        Auth->>Cache: Cache user session
        Auth-->>API: Return tokens
        API-->>Frontend: Return tokens + user data
        Frontend->>Frontend: Store tokens in localStorage
        Frontend-->>User: Redirect to dashboard
    else Invalid Credentials
        Auth-->>API: Authentication failed
        API-->>Frontend: Error 401
        Frontend-->>User: Show error message
    end
```

---

## 6. Integration Architecture

### 6.1 External Integrations

```mermaid
graph TB
    subgraph "Elara Platform"
        API[Backend API]
        WORKER[Worker Service]
    end

    subgraph "AI Services"
        ANTHROPIC[Anthropic<br/>Claude Sonnet 4.5]
        OPENAI[OpenAI<br/>GPT-4 Turbo]
        GEMINI[Google AI<br/>Gemini Pro]
    end

    subgraph "Threat Intelligence"
        VT[VirusTotal]
        ABUSE[AbuseIPDB]
        URL_HAUS[URLhaus]
        THREAT_FOX[ThreatFox]
        OTX[AlienVault OTX]
        PHISH_TANK[PhishTank]
        SAFE_BROWSE[Safe Browsing]
        URLSCAN[URLScan.io]
    end

    subgraph "Communication"
        TWILIO[Twilio]
        WHATSAPP_BIZ[WhatsApp Business]
        SENDGRID[SendGrid]
    end

    API --> ANTHROPIC
    API --> OPENAI
    API --> GEMINI

    WORKER --> VT
    WORKER --> ABUSE
    WORKER --> URL_HAUS
    WORKER --> THREAT_FOX
    WORKER --> OTX
    WORKER --> PHISH_TANK
    WORKER --> SAFE_BROWSE
    WORKER --> URLSCAN

    API --> TWILIO
    API --> WHATSAPP_BIZ
    API --> SENDGRID

    style API fill:#339933,stroke:#333,stroke-width:2px,color:#fff
    style ANTHROPIC fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style VT fill:#4285F4,stroke:#333,stroke-width:2px,color:#fff
```

### 6.2 Integration Patterns

| Service | Pattern | Protocol | Authentication |
|---------|---------|----------|---------------|
| **Claude AI** | Request/Response | HTTPS/REST | API Key |
| **GPT-4** | Request/Response | HTTPS/REST | API Key |
| **Gemini** | Request/Response | HTTPS/REST | API Key |
| **VirusTotal** | Request/Response | HTTPS/REST | API Key |
| **AbuseIPDB** | Request/Response | HTTPS/REST | API Key |
| **URLhaus** | Data Sync | HTTPS/CSV | Public |
| **ThreatFox** | Data Sync | HTTPS/JSON | Public |
| **WhatsApp** | Webhook | HTTPS/POST | Token |

---

## 7. Deployment Architecture

### 7.1 GCP Deployment

```mermaid
graph TB
    subgraph "Global Infrastructure"
        DNS[Cloud DNS<br/>elara-platform.com]
        CDN[Cloud CDN<br/>Static Assets]
        GLB[Global Load Balancer<br/>HTTPS + SSL]
    end

    subgraph "us-west1 Region"
        subgraph "GKE Autopilot Cluster"
            BACKEND[Backend Pods<br/>2-10 replicas]
            FRONTEND[Frontend Pods<br/>2-5 replicas]
            WORKER[Worker Pods<br/>1-5 replicas]
            PROXY[Proxy Pods<br/>1-3 replicas]
        end

        subgraph "Managed Services"
            SQL[(Cloud SQL<br/>PostgreSQL 15)]
            REDIS[(Memorystore<br/>Redis 7.0)]
            BUCKET[Cloud Storage<br/>Uploads]
            SECRET[Secret Manager<br/>Credentials]
        end

        subgraph "Networking"
            VPC[VPC Network<br/>10.0.0.0/16]
            FW[Firewall Rules]
            NAT[Cloud NAT]
        end
    end

    subgraph "CI/CD"
        GITHUB[GitHub Actions]
        CLOUDBUILD[Cloud Build]
        GCR[Container Registry]
    end

    DNS --> GLB
    GLB --> CDN
    GLB --> BACKEND
    GLB --> FRONTEND

    BACKEND --> SQL
    BACKEND --> REDIS
    BACKEND --> BUCKET
    BACKEND --> SECRET
    WORKER --> SQL
    WORKER --> REDIS
    PROXY --> BACKEND

    VPC --> FW
    FW --> NAT

    GITHUB --> CLOUDBUILD
    CLOUDBUILD --> GCR
    GCR --> BACKEND
    GCR --> WORKER
    GCR --> PROXY

    style GLB fill:#4285F4,stroke:#333,stroke-width:2px,color:#fff
    style BACKEND fill:#339933,stroke:#333,stroke-width:2px,color:#fff
    style SQL fill:#4169E1,stroke:#333,stroke-width:2px,color:#fff
    style REDIS fill:#DC382D,stroke:#333,stroke-width:2px,color:#fff
```

### 7.2 Environment Strategy

| Environment | Purpose | Branch | URL | Auto-Deploy |
|------------|---------|--------|-----|-------------|
| **Development** | Active development | `develop` | http://136.117.33.149 | Yes |
| **Staging** | Pre-production testing | `staging` | _Not deployed_ | Yes (planned) |
| **Production** | Live system | `main` | http://34.36.48.252 | Yes |

---

## 8. Security Architecture

### 8.1 Security Layers

```mermaid
graph TB
    subgraph "Network Security"
        VPC[Private VPC]
        FW[Firewall Rules]
        DDoS[DDoS Protection]
    end

    subgraph "Application Security"
        WAF[Web Application Firewall]
        RATE[Rate Limiting]
        INPUT[Input Validation]
    end

    subgraph "Authentication & Authorization"
        JWT[JWT Tokens]
        RBAC[Role-Based Access]
        MFA[MFA - Planned]
    end

    subgraph "Data Security"
        ENCRYPT[Encryption at Rest]
        TLS[TLS 1.3 in Transit]
        SECRET_MGR[Secret Manager]
    end

    subgraph "Monitoring & Audit"
        LOGGING[Audit Logging]
        SIEM[SIEM Integration - Planned]
        ALERT[Security Alerts]
    end

    VPC --> FW
    FW --> DDoS
    DDoS --> WAF

    WAF --> RATE
    RATE --> INPUT
    INPUT --> JWT

    JWT --> RBAC
    RBAC --> MFA

    ENCRYPT --> TLS
    TLS --> SECRET_MGR

    JWT --> LOGGING
    RBAC --> LOGGING
    LOGGING --> ALERT

    style VPC fill:#4285F4,stroke:#333,stroke-width:2px,color:#fff
    style JWT fill:#28a745,stroke:#333,stroke-width:2px,color:#fff
    style ENCRYPT fill:#28a745,stroke:#333,stroke-width:2px,color:#fff
    style LOGGING fill:#EA4335,stroke:#333,stroke-width:2px,color:#fff
```

### 8.2 Security Controls

| Control | Implementation | Status |
|---------|---------------|--------|
| **Authentication** | JWT with 30min access + 7day refresh tokens | ✅ Implemented |
| **Authorization** | RBAC with 3 roles (User, Admin, Owner) | ✅ Implemented |
| **Encryption in Transit** | TLS 1.3 for all connections | ✅ Implemented |
| **Encryption at Rest** | AES-256 for database and storage | ✅ Implemented |
| **Secret Management** | GCP Secret Manager with Workload Identity | ✅ Implemented |
| **Input Validation** | Zod schema validation | ✅ Implemented |
| **Rate Limiting** | Tier-based (Free: 100/hr, Pro: 1000/hr, Enterprise: 10K/hr) | ✅ Implemented |
| **Audit Logging** | Complete audit trail in database | ✅ Implemented |
| **MFA** | Two-factor authentication | 🔄 Planned |
| **SIEM Integration** | Security event monitoring | 🔄 Planned |

---

## 9. Scalability & Performance

### 9.1 Scalability Strategy

```mermaid
graph LR
    subgraph "Horizontal Scaling"
        HPA[Kubernetes HPA]
        AUTO[Auto-scaling]
        LB[Load Balancing]
    end

    subgraph "Caching Strategy"
        L1[L1: Application Cache]
        L2[L2: Redis Cache]
        CDN_CACHE[L3: CDN Cache]
    end

    subgraph "Database Optimization"
        INDEX[Indexing]
        POOL[Connection Pooling]
        READONLY[Read Replicas - Planned]
    end

    subgraph "Asynchronous Processing"
        QUEUE[BullMQ Queues]
        WORKER_POOL[Worker Pool]
        BATCH[Batch Processing]
    end

    HPA --> AUTO
    AUTO --> LB

    L1 --> L2
    L2 --> CDN_CACHE

    INDEX --> POOL
    POOL --> READONLY

    QUEUE --> WORKER_POOL
    WORKER_POOL --> BATCH

    style HPA fill:#326CE5,stroke:#333,stroke-width:2px,color:#fff
    style L2 fill:#DC382D,stroke:#333,stroke-width:2px,color:#fff
    style QUEUE fill:#339933,stroke:#333,stroke-width:2px,color:#fff
```

### 9.2 Performance Targets

| Metric | Target | Current | Strategy |
|--------|--------|---------|----------|
| **API Response Time** | < 200ms (p95) | ~150ms | Caching, indexing |
| **Scan Processing Time** | < 30s | ~20-25s | Parallel processing |
| **Concurrent Users** | 10,000 | 1,000 tested | Horizontal scaling |
| **Requests per Second** | 1,000 RPS | 500 tested | Load balancing |
| **Cache Hit Rate** | > 80% | ~75% | Cache optimization |
| **Database Query Time** | < 50ms (p95) | ~30ms | Indexing, pooling |

---

## 10. Technology Decisions

### 10.1 Technology Stack Rationale

| Technology | Reason | Alternatives Considered |
|------------|--------|------------------------|
| **Node.js** | Async I/O, large ecosystem, team expertise | Python (slower for I/O), Go (smaller ecosystem) |
| **TypeScript** | Type safety, better IDE support, maintainability | JavaScript (no type safety) |
| **React** | Component-based, large community, performance | Vue (smaller community), Angular (steeper learning curve) |
| **PostgreSQL** | ACID compliance, JSON support, reliability | MongoDB (eventual consistency), MySQL (less features) |
| **Redis** | High performance, pub/sub, job queues | Memcached (fewer features), RabbitMQ (more complex) |
| **Prisma** | Type-safe ORM, migrations, excellent DX | TypeORM (less type-safe), Sequelize (older) |
| **GKE Autopilot** | Managed Kubernetes, auto-scaling, cost-effective | EKS (AWS lock-in), AKS (less mature) |
| **Terraform** | Infrastructure as Code, multi-cloud, state management | Pulumi (smaller community), CloudFormation (AWS only) |

### 10.2 Key Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Monorepo** | Shared code, simplified dependencies | Larger repository size |
| **Serverless Functions** _(Avoided)_ | Cost concerns, cold starts | Less operational overhead |
| **Microservices** _(Partial)_ | Scalability, independent deployment | Increased complexity |
| **Multi-LLM Consensus** | Accuracy, redundancy, no vendor lock-in | Higher API costs |
| **Asynchronous Scanning** | Better UX, scalability | Eventual consistency |
| **GCP vs AWS** | Expertise, Autopilot cost savings, better AI integration | AWS has more services |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-24 | Elara Team | Initial HLD creation |

---

## Appendices

### A. Glossary

- **HLD**: High-Level Design
- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token
- **SLA**: Service Level Agreement
- **HPA**: Horizontal Pod Autoscaler
- **CDN**: Content Delivery Network
- **ORM**: Object-Relational Mapping

### B. References

- [GCP Deployment Blueprint](gcp-deployment-blueprint.md)
- [Prisma ORM Architecture](prisma-orm-architecture.md)
- [Secrets Management Guide](../SECRETS_MANAGEMENT.md)
- [API Documentation](../api/complete-api-reference.md)

---

<div align="center">

**Elara Platform - High-Level Design**
Version 1.0.0 | Status: ✅ Production Ready

[⬆ Back to Top](#elara-platform---high-level-design-hld)

</div>
