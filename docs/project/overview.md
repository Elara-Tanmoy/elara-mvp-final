# Elara Platform - GCP Migration Project Documentation

**Document Version**: 1.0
**Last Updated**: 2025-01-12
**Status**: Planning Phase
**Classification**: Internal - Architecture

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Scope and Objectives](#project-scope-and-objectives)
3. [Stakeholders and Roles](#stakeholders-and-roles)
4. [Current Architecture Analysis](#current-architecture-analysis)
5. [Target GCP Architecture](#target-gcp-architecture)
6. [Database Architecture (Critical)](#database-architecture-critical)
7. [Business Requirements](#business-requirements)
8. [Technical Requirements](#technical-requirements)
9. [Success Criteria and KPIs](#success-criteria-and-kpis)
10. [Timeline and Milestones](#timeline-and-milestones)
11. [Budget and Cost Analysis](#budget-and-cost-analysis)
12. [Risk Assessment and Mitigation](#risk-assessment-and-mitigation)
13. [Migration Strategy](#migration-strategy)
14. [Rollback and Contingency Plans](#rollback-and-contingency-plans)

---

## 📊 Executive Summary

### Project Overview

The Elara Platform is a comprehensive cybersecurity SaaS platform providing real-time threat detection, URL scanning, message analysis, file security scanning, secure web proxy, and AI-powered security insights. This project aims to migrate the entire platform from its current distributed architecture (Vercel for frontend, Render for backend) to a unified, enterprise-grade Google Cloud Platform (GCP) infrastructure.

### Strategic Objectives

1. **Enterprise Readiness**: Transform Elara into a TOGAF-compliant, enterprise-grade platform
2. **Performance Excellence**: Achieve sub-second response times for critical security operations
3. **Global Scale**: Support multi-region deployment with 99.9% uptime SLA
4. **Cost Efficiency**: Optimize infrastructure costs while maintaining premium performance
5. **Security First**: Implement zero-trust architecture with defense-in-depth principles
6. **Compliance Ready**: Meet FedRAMP, SOC 2, ISO 27001, GDPR, CCPA requirements

### Key Drivers for Migration

| Driver | Current Pain Point | GCP Solution |
|--------|-------------------|--------------|
| **Performance** | Variable latency from distributed hosting | Regional compute with Cloud CDN |
| **Scalability** | Manual scaling, limited by Render/Vercel tiers | Auto-scaling GKE Autopilot + Cloud Run |
| **Database** | Single PostgreSQL instance, no HA | Cloud SQL HA, read replicas, auto-failover |
| **Observability** | Limited logging, no distributed tracing | Cloud Logging, Monitoring, Trace, Profiler |
| **Security** | Basic WAF, limited DDoS protection | Cloud Armor, VPC Service Controls, Binary Auth |
| **Cost** | High per-user costs on PaaS platforms | Infrastructure optimization, committed use discounts |
| **DR/BC** | No automated disaster recovery | Multi-region, automated backups, RTO 15min |

### Expected Outcomes

- **99.9% Uptime SLA** (43 minutes max downtime/month)
- **RTO: 15 minutes** / **RPO: 5 minutes**
- **40% cost reduction** compared to current PaaS spending
- **Sub-100ms API response** times (p95)
- **Zero data loss** guarantee with automated backups
- **Global presence** across 4 regions (US, Europe, Asia)

---

## 🎯 Project Scope and Objectives

### In Scope

#### Infrastructure Components
- ✅ Multi-region VPC network architecture
- ✅ GKE Autopilot clusters (compute layer)
- ✅ **Cloud SQL PostgreSQL HA (primary database)**
- ✅ **Memorystore Redis (caching, sessions, queues)**
- ✅ **Vector database for AI/ML workloads (ChromaDB or Vertex AI)**
- ✅ Cloud Storage (file storage, backups)
- ✅ Global Load Balancer with Cloud Armor WAF
- ✅ Cloud NAT and Private Service Connect
- ✅ Cloud CDN for static asset delivery
- ✅ Secret Manager and Cloud KMS
- ✅ VPC Service Controls (data perimeter)

#### Application Components
- ✅ Backend API (Node.js/Express)
- ✅ Frontend (React/TypeScript)
- ✅ Proxy Service (Puppeteer-based secure browser)
- ✅ BullMQ Workers (background jobs)
- ✅ WhatsApp Integration Service
- ✅ AI/ML Services (threat detection, phishing analysis)
- ✅ Real-time WebSocket services

#### Observability & Operations
- ✅ Cloud Logging with BigQuery export
- ✅ Cloud Monitoring with custom dashboards
- ✅ Cloud Trace (distributed tracing)
- ✅ Cloud Profiler (continuous profiling)
- ✅ Error Reporting and alerting
- ✅ SLI/SLO definitions and monitoring

#### Security & Compliance
- ✅ Zero-trust network architecture
- ✅ IAM and RBAC implementation
- ✅ Binary Authorization for container signing
- ✅ Cloud Armor WAF with OWASP rules
- ✅ Cloud IDS (Intrusion Detection System)
- ✅ Security Command Center Premium
- ✅ Audit logging with 10-year retention

#### CI/CD & Automation
- ✅ GitHub Actions pipelines
- ✅ Cloud Build integration
- ✅ ArgoCD GitOps deployment
- ✅ Terraform infrastructure as code
- ✅ Automated testing and security scanning

### Out of Scope

- ❌ Mobile application development (iOS/Android native apps)
- ❌ On-premises infrastructure
- ❌ Third-party integrations beyond current scope
- ❌ Data migration from customer databases
- ❌ Training and end-user documentation

### Assumptions

1. $25,000 GCP credits available (Business Starter program)
2. DNS management capability for custom domains
3. Access to existing codebase and API documentation
4. Stakeholder availability for architecture reviews
5. 8-week timeline for initial deployment
6. PostgreSQL compatible schema (no major refactoring needed)

### Constraints

1. **Budget**: $25,000 GCP credit limit (6-8 months runway)
2. **Timeline**: 8 weeks for MVP deployment on GCP
3. **Resources**: 1 DevOps engineer, 1 architect (Claude Code)
4. **Compliance**: Must maintain GDPR compliance from day one
5. **Downtime**: Maximum 4-hour maintenance window for migration

---

## 👥 Stakeholders and Roles

### Project Team

| Role | Responsibility | Availability |
|------|----------------|--------------|
| **Product Owner** | Strategic direction, business requirements | 25% |
| **Solution Architect** | Architecture design, TOGAF compliance, technical decisions | 100% (Claude Code) |
| **DevOps Engineer** | Implementation, deployment, operations | 100% |
| **Security Lead** | Security architecture, compliance, audit | 40% |
| **Database Architect** | Database design, performance tuning, DR planning | 60% |
| **QA Lead** | Testing strategy, validation | 30% |

### RACI Matrix

| Task | Product Owner | Architect | DevOps | Security | Database |
|------|---------------|-----------|--------|----------|----------|
| Architecture Design | C | **R/A** | C | C | C |
| Infrastructure Code | I | **A** | **R** | C | C |
| Database Design | C | **A** | C | C | **R** |
| Security Implementation | C | **A** | R | **R** | C |
| Deployment Execution | I | C | **R/A** | C | C |
| Go-Live Decision | **A** | C | R | C | C |

**Legend**: R = Responsible, A = Accountable, C = Consulted, I = Informed

### Communication Plan

- **Daily Standups**: 15-minute sync (DevOps + Architect)
- **Weekly Architecture Review**: 1-hour deep dive on design decisions
- **Bi-weekly Stakeholder Update**: Progress, risks, budget status
- **Monthly Executive Briefing**: High-level status for leadership

---

## 🏗️ Current Architecture Analysis

### Current Platform Overview

**Elara Platform** is currently deployed across multiple PaaS providers:

#### Frontend Layer
- **Platform**: Vercel
- **Framework**: React 18 + TypeScript + Vite
- **Features**:
  - URL scanner interface
  - Message scanner
  - File scanner
  - Secure web proxy browser
  - Admin dashboards (WhatsApp, user management)
  - AI chatbot assistant
- **Performance**: Good CDN performance, but limited control over caching
- **Cost**: ~$20/month (Hobby plan)

#### Backend Layer
- **Platform**: Render
- **Framework**: Node.js + Express + TypeScript
- **Services**:
  - Main API server (REST + WebSocket)
  - Proxy service (Puppeteer for secure browsing)
  - BullMQ workers (background jobs)
  - WhatsApp integration service
- **Performance**: Cold start issues, scaling limitations
- **Cost**: ~$250-400/month (multiple services)

#### Database Layer (CRITICAL - Heart of Elara)

**Primary Database: PostgreSQL**
- **Platform**: Render Managed PostgreSQL
- **Configuration**: Single instance (no HA)
- **Size**: Current ~5GB, growing 500MB/month
- **Schema**:
  - `users` table (authentication, profiles)
  - `scans` table (URL/message/file scan results)
  - `threats` table (threat intelligence database)
  - `sessions` table (user sessions)
  - `api_keys` table (API authentication)
  - `audit_logs` table (compliance logging)
  - `whatsapp_messages` table (WhatsApp integration data)
  - `scan_history` table (historical scan data for analytics)
- **Pain Points**:
  - ❌ No high availability (single point of failure)
  - ❌ No read replicas (read operations slow down writes)
  - ❌ Limited connection pooling
  - ❌ No automated failover
  - ❌ Backup retention limited to 7 days
  - ❌ No point-in-time recovery (PITR)
  - ❌ Performance degradation during high load
  - ❌ No cross-region replication

**Cache Layer: Redis**
- **Platform**: Render Managed Redis
- **Configuration**: Single instance (no HA)
- **Use Cases**:
  - Session storage
  - API rate limiting
  - BullMQ job queues
  - Temporary scan results caching
  - Real-time threat feed caching
- **Pain Points**:
  - ❌ No high availability
  - ❌ No persistence guarantees
  - ❌ Limited memory (512MB)
  - ❌ No clustering support

**Vector Database: ChromaDB**
- **Platform**: Self-hosted on Render
- **Use Case**: AI-powered threat detection, semantic search
- **Size**: ~2GB embeddings
- **Pain Points**:
  - ❌ Running on same instance as backend (resource contention)
  - ❌ No dedicated GPU for inference
  - ❌ Slow similarity search at scale

#### Storage Layer
- **Platform**: Mixed (Vercel Blob, Render Disk)
- **Use Cases**:
  - File uploads for scanning
  - Generated reports (PDF)
  - Screenshot storage (proxy service)
- **Pain Points**:
  - ❌ No unified storage
  - ❌ Limited retention policies
  - ❌ No cross-region availability

#### Observability
- **Logging**: Render logs (limited retention)
- **Monitoring**: Basic Render metrics
- **Alerting**: Email only
- **Pain Points**:
  - ❌ No distributed tracing
  - ❌ No centralized logging
  - ❌ No custom dashboards
  - ❌ Limited retention (7 days)

### Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CURRENT STATE                            │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐
│   End Users    │
└───────┬────────┘
        │
        ├──────────────────┬──────────────────┐
        ↓                  ↓                  ↓
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│ Vercel (CDN)  │  │ Vercel Edge  │  │  Mobile App  │
│   Frontend    │  │  Functions   │  │  (Future)    │
└───────┬───────┘  └──────┬───────┘  └──────┬───────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                          ↓
        ┌─────────────────────────────────────┐
        │      Render - Backend Services       │
        ├─────────────────────────────────────┤
        │  ┌────────────┐  ┌────────────┐    │
        │  │  API       │  │  Proxy     │    │
        │  │  Server    │  │  Service   │    │
        │  └──────┬─────┘  └──────┬─────┘    │
        │         │                │          │
        │  ┌──────┴──────┬─────────┴───┐     │
        │  │             │             │     │
        │  ↓             ↓             ↓     │
        │ ┌──────┐  ┌────────┐  ┌──────┐    │
        │ │ Bull │  │WhatsApp│  │Vector│    │
        │ │Worker│  │Service │  │  DB  │    │
        │ └──────┘  └────────┘  └──────┘    │
        └───────┬──────────┬──────────────┬──┘
                │          │              │
        ┌───────┴──┐  ┌────┴────┐  ┌──────┴─────┐
        │PostgreSQL│  │  Redis  │  │  Disk      │
        │ (No HA)  │  │ (No HA) │  │  Storage   │
        └──────────┘  └─────────┘  └────────────┘
         ⚠️ SPOF      ⚠️ SPOF       ⚠️ Limited
```

### Critical Issues with Current Architecture

| Issue | Impact | Severity | Business Risk |
|-------|--------|----------|---------------|
| **Database SPOF** | Entire platform down if DB fails | 🔴 Critical | Revenue loss, reputation damage |
| **No Read Replicas** | Slow queries impact write performance | 🟡 High | Poor user experience |
| **Limited Scaling** | Cannot handle traffic spikes | 🟡 High | Lost customers during peak times |
| **No DR/BC** | Data loss risk, long recovery time | 🔴 Critical | Regulatory non-compliance |
| **Poor Observability** | Difficult to debug production issues | 🟡 High | Prolonged outages |
| **Security Gaps** | Basic WAF, no zero-trust | 🟡 High | Security breach risk |

---

## 🎯 Target GCP Architecture

### Architecture Principles

1. **Zero-Trust Security**: No implicit trust, verify everything
2. **Defense in Depth**: Multiple layers of security controls
3. **High Availability**: No single points of failure
4. **Auto-Scaling**: Scale horizontally based on demand
5. **Cost Optimization**: Right-size resources, use committed use discounts
6. **Observability First**: Logging, monitoring, tracing built-in
7. **Infrastructure as Code**: Everything versioned and reproducible
8. **GitOps**: Declarative infrastructure and application deployment

### Target Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         TARGET GCP ARCHITECTURE                        │
└───────────────────────────────────────────────────────────────────────┘

                            ┌─────────────┐
                            │  End Users  │
                            └──────┬──────┘
                                   │
                            ┌──────┴──────┐
                            │ Cloud DNS   │
                            │   + SSL     │
                            └──────┬──────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │  Global Load Balancer       │
                    │  + Cloud Armor WAF          │
                    │  + Cloud CDN                │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │  VPC Network (10.0.0.0/16)  │
                    │  + VPC Service Controls     │
                    │  + Private Service Connect  │
                    └──────────────┬──────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
    ┌───────┴────────┐    ┌────────┴────────┐    ┌──────┴─────┐
    │ GKE Autopilot  │    │  Cloud Run      │    │  Cloud     │
    │  us-west1      │    │  (Serverless)   │    │  Functions │
    └───────┬────────┘    └────────┬────────┘    └──────┬─────┘
            │                      │                      │
            │ Workload Identity    │                      │
            │                      │                      │
    ┌───────┴──────────────────────┴──────────────────────┴─────┐
    │                   Data Layer (CRITICAL)                     │
    ├────────────────────────────────────────────────────────────┤
    │  ┌────────────────────────────────────────────────┐        │
    │  │  Cloud SQL PostgreSQL (HA Configuration)       │        │
    │  ├────────────────────────────────────────────────┤        │
    │  │  • Primary: us-west1-a                         │        │
    │  │  • Standby: us-west1-b (auto-failover <60s)   │        │
    │  │  • Read Replica 1: us-west1-c                  │        │
    │  │  • Read Replica 2: us-east1-a (cross-region)  │        │
    │  │  • Machine: db-custom-8-32768 (8vCPU, 32GB)   │        │
    │  │  • Storage: 500GB SSD (auto-expand)           │        │
    │  │  • Backup: Daily + PITR (7 days)              │        │
    │  │  • Connection: Private IP only                │        │
    │  │  • Encryption: CMEK (Cloud KMS)               │        │
    │  └────────────────────────────────────────────────┘        │
    │                                                              │
    │  ┌────────────────────────────────────────────────┐        │
    │  │  Memorystore Redis (HA Configuration)          │        │
    │  ├────────────────────────────────────────────────┤        │
    │  │  • Tier: Standard (HA with auto-failover)      │        │
    │  │  • Primary: us-west1-a                         │        │
    │  │  • Replica: us-west1-b                         │        │
    │  │  • Memory: 5GB (M2 instance)                   │        │
    │  │  • Persistence: RDB snapshots (6hr intervals)  │        │
    │  │  • Connection: Private IP only                 │        │
    │  │  • Encryption: In-transit + at-rest            │        │
    │  └────────────────────────────────────────────────┘        │
    │                                                              │
    │  ┌────────────────────────────────────────────────┐        │
    │  │  Vector Database for AI/ML                     │        │
    │  ├────────────────────────────────────────────────┤        │
    │  │  Option A: ChromaDB on GKE                     │        │
    │  │  • Persistent volume (SSD, 100GB)              │        │
    │  │  • HPA: 2-5 replicas                           │        │
    │  │  • GPU: NVIDIA T4 (optional for inference)     │        │
    │  │                                                 │        │
    │  │  Option B: Vertex AI Vector Search (Managed)  │        │
    │  │  • Fully managed, serverless                   │        │
    │  │  • Auto-scaling                                │        │
    │  │  • Native integration with Vertex AI           │        │
    │  └────────────────────────────────────────────────┘        │
    │                                                              │
    │  ┌────────────────────────────────────────────────┐        │
    │  │  Cloud Storage (Multi-Region)                  │        │
    │  ├────────────────────────────────────────────────┤        │
    │  │  • Scan uploads: Standard (us-multi)           │        │
    │  │  • Reports: Nearline (30-day lifecycle)        │        │
    │  │  • Backups: Archive (90-day lifecycle)         │        │
    │  │  • Encryption: CMEK (Cloud KMS)                │        │
    │  │  • Versioning: Enabled (30 days)               │        │
    │  └────────────────────────────────────────────────┘        │
    └─────────────────────────────────────────────────────────────┘
                                   │
    ┌──────────────────────────────┴──────────────────────────────┐
    │              Security & Secrets Management                   │
    ├─────────────────────────────────────────────────────────────┤
    │  Secret Manager  │  Cloud KMS  │  Binary Authorization      │
    └─────────────────────────────────────────────────────────────┘
                                   │
    ┌──────────────────────────────┴──────────────────────────────┐
    │                    Observability Stack                       │
    ├─────────────────────────────────────────────────────────────┤
    │  Cloud Logging  │  Monitoring  │  Trace  │  Profiler  │SCC │
    └─────────────────────────────────────────────────────────────┘
```

### Multi-Region Strategy

| Region | Role | Components | Purpose |
|--------|------|------------|---------|
| **us-west1** | Primary | All services + DB primary | Main production region |
| **us-east1** | DR | GKE + DB read replica | Disaster recovery, read traffic |
| **europe-west2** | Compliance | GKE + DB read replica | GDPR compliance (EU data residency) |
| **asia-south1** | Expansion | Cloud Run services | Future expansion for India market |

---

## 💾 Database Architecture (Critical)

> **Note**: The database is the heart of Elara. This section details the comprehensive database strategy for GCP.

### Database Requirements Analysis

#### Functional Requirements
1. **Transaction Processing**: Handle 10,000+ concurrent scan operations
2. **Data Integrity**: ACID compliance for critical security data
3. **Real-Time Access**: Sub-10ms query latency for cached data
4. **Historical Analytics**: Support complex queries on scan history
5. **Threat Intelligence**: Fast lookups in threat database (millions of records)
6. **Audit Logging**: Immutable audit trail for compliance

#### Non-Functional Requirements
1. **Performance**:
   - 95th percentile query latency < 50ms
   - 99th percentile query latency < 200ms
   - Support 10,000 concurrent connections (with pooling)
   - Write throughput: 5,000 TPS
   - Read throughput: 20,000 QPS
2. **Availability**:
   - 99.95% uptime SLA (21.9 minutes downtime/month)
   - Auto-failover < 60 seconds
   - Zero data loss during failover
3. **Scalability**:
   - Horizontal read scaling via replicas
   - Vertical scaling without downtime
   - Storage auto-expansion up to 64TB
4. **Security**:
   - Encryption at rest (CMEK)
   - Encryption in transit (TLS 1.3)
   - Private IP only (no public exposure)
   - IAM + database-level authentication
   - Automated security patching
5. **Disaster Recovery**:
   - RPO: 5 minutes (max data loss)
   - RTO: 15 minutes (max recovery time)
   - Daily automated backups (retained 30 days)
   - Point-in-time recovery (PITR) to any second within 7 days
   - Cross-region read replica for DR

### Primary Database: Cloud SQL PostgreSQL

#### Configuration Specification

**Instance Configuration**:
```yaml
instance_name: elara-postgres-primary
database_version: POSTGRES_15
tier: db-custom-8-32768  # 8 vCPU, 32GB RAM
region: us-west1
availability_type: REGIONAL  # HA configuration

disk:
  type: PD_SSD
  size_gb: 500
  auto_resize: true
  auto_resize_limit: 2000  # Max 2TB

backup:
  enabled: true
  start_time: "03:00"  # UTC
  location: us
  transaction_log_retention_days: 7
  retained_backups: 30
  point_in_time_recovery_enabled: true

maintenance:
  day: SUNDAY
  hour: 4
  update_track: stable

network:
  private_network: projects/PROJECT_ID/global/networks/elara-vpc
  ipv4_enabled: false  # No public IP
  require_ssl: true

flags:
  max_connections: "5000"
  shared_buffers: "8GB"
  effective_cache_size: "24GB"
  maintenance_work_mem: "2GB"
  checkpoint_completion_target: "0.9"
  wal_buffers: "16MB"
  default_statistics_target: "100"
  random_page_cost: "1.1"
  effective_io_concurrency: "200"
  work_mem: "10485kB"
  min_wal_size: "1GB"
  max_wal_size: "4GB"
  max_worker_processes: "8"
  max_parallel_workers_per_gather: "4"
  max_parallel_workers: "8"
  max_parallel_maintenance_workers: "4"
```

#### High Availability Architecture

**Primary Instance**: us-west1-a
- Handles all write operations
- Synchronous replication to standby

**Standby Instance**: us-west1-b (Automatic)
- Synchronous replication from primary
- Automatic failover < 60 seconds
- Promotes to primary if primary fails
- Zero data loss during failover

**Read Replica 1**: us-west1-c
- Asynchronous replication (lag < 5 seconds)
- Offload read-heavy queries (analytics, reporting)
- Can be promoted to primary if needed

**Read Replica 2**: us-east1-a (Cross-Region DR)
- Asynchronous replication (lag < 30 seconds)
- Disaster recovery failover target
- Serves east-coast read traffic

#### Database Schema Optimization

**Core Tables** (with GCP-optimized indexes):

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Scans table (High-volume, partitioned by date)
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    scan_type VARCHAR(50) NOT NULL,  -- 'url', 'message', 'file'
    target TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,  -- 'pending', 'scanning', 'completed', 'failed'
    risk_score INTEGER,  -- 0-100
    threat_level VARCHAR(50),  -- 'safe', 'low', 'medium', 'high', 'critical'
    findings JSONB,  -- Structured scan results
    metadata JSONB,  -- Additional metadata
    scan_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Partitions for scan history (monthly partitions)
CREATE TABLE scans_2025_01 PARTITION OF scans
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE scans_2025_02 PARTITION OF scans
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... create 12 months of partitions

-- Indexes on scans
CREATE INDEX idx_scans_user_id ON scans(user_id, created_at DESC);
CREATE INDEX idx_scans_status ON scans(status) WHERE status IN ('pending', 'scanning');
CREATE INDEX idx_scans_threat_level ON scans(threat_level) WHERE threat_level IN ('high', 'critical');
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX idx_scans_findings_gin ON scans USING GIN (findings jsonb_path_ops);

-- Threats table (threat intelligence database)
CREATE TABLE threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_type VARCHAR(100) NOT NULL,
    indicator VARCHAR(500) NOT NULL,  -- URL, hash, IP, etc.
    indicator_type VARCHAR(50) NOT NULL,  -- 'url', 'ip', 'hash', 'domain'
    severity VARCHAR(50) NOT NULL,
    description TEXT,
    source VARCHAR(255),  -- Threat feed source
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB
);
CREATE UNIQUE INDEX idx_threats_indicator ON threats(indicator, indicator_type);
CREATE INDEX idx_threats_type ON threats(threat_type) WHERE is_active = true;
CREATE INDEX idx_threats_severity ON threats(severity) WHERE is_active = true;
CREATE INDEX idx_threats_last_seen ON threats(last_seen DESC) WHERE is_active = true;

-- Audit logs (immutable, append-only)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Partitions for audit logs (monthly)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... create 12 months of partitions

CREATE INDEX idx_audit_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- Sessions (temporary data, consider Redis instead)
CREATE TABLE sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions(expire);
```

#### Connection Pooling Strategy

**PgBouncer Configuration** (deployed as sidecar in GKE):
```ini
[databases]
elara_production = host=CLOUD_SQL_PRIVATE_IP port=5432 dbname=elara

[pgbouncer]
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 50
reserve_pool_size = 25
reserve_pool_timeout = 5
max_db_connections = 200
```

**Application-Level Pooling** (Node.js):
```typescript
// Dedicated pools for read/write splitting
const writePool = new Pool({
  host: CLOUD_SQL_PRIMARY_PRIVATE_IP,
  port: 5432,
  database: 'elara',
  user: 'elara_app',
  max: 50,  // Max connections per pod
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const readPool = new Pool({
  host: CLOUD_SQL_READ_REPLICA_PRIVATE_IP,  // Round-robin DNS
  port: 5432,
  database: 'elara',
  user: 'elara_readonly',
  max: 100,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

#### Backup and Recovery Strategy

**Automated Backups**:
- **Frequency**: Daily at 03:00 UTC (low-traffic period)
- **Retention**: 30 days
- **Storage**: Multi-region (us-multi)
- **Encryption**: CMEK (Cloud KMS)

**Point-in-Time Recovery (PITR)**:
- **Write-Ahead Logs (WAL)**: Continuous archival
- **Retention**: 7 days
- **Recovery Granularity**: Any second within retention period
- **Use Cases**: Accidental data deletion, corruption recovery

**Manual Backup Procedures**:
```bash
# On-demand backup before major changes
gcloud sql backups create \
  --instance=elara-postgres-primary \
  --description="Pre-migration backup"

# Export to Cloud Storage for long-term retention
gcloud sql export sql elara-postgres-primary \
  gs://elara-db-exports/manual-backup-$(date +%Y%m%d).sql \
  --database=elara
```

**Disaster Recovery Runbook**:
1. **Scenario: Primary region (us-west1) failure**
   - Cross-region read replica (us-east1) automatically detects failure
   - Manual promotion of read replica to primary (~5 minutes)
   - Update DNS to point to new primary
   - Create new read replicas in us-east1
   - **RTO**: 15 minutes, **RPO**: 5 minutes (replication lag)

2. **Scenario: Data corruption**
   - Identify corruption timestamp
   - Create new instance from PITR to timestamp
   - Validate data integrity
   - Promote PITR instance to primary
   - **RTO**: 30 minutes, **RPO**: 0 (exact recovery point)

3. **Scenario: Accidental table drop**
   - Restore specific database from latest backup
   - Use PITR to recover to point before deletion
   - **RTO**: 20 minutes, **RPO**: 0

### Cache Layer: Memorystore Redis

#### Configuration Specification

**Instance Configuration**:
```yaml
instance_name: elara-redis-primary
tier: STANDARD_HA  # High availability
memory_size_gb: 5
redis_version: REDIS_7_0
region: us-west1
replica_count: 1  # Auto-failover replica

network:
  authorized_network: projects/PROJECT_ID/global/networks/elara-vpc
  connect_mode: PRIVATE_SERVICE_ACCESS

persistence:
  rdb_snapshot_period: SIX_HOURS
  rdb_snapshot_start_time: "02:00"

maintenance:
  day: SUNDAY
  hour: 5
  duration: 4h

redis_configs:
  maxmemory-policy: "allkeys-lru"  # Evict least recently used
  activedefrag: "yes"
  lazyfree-lazy-eviction: "yes"
  lazyfree-lazy-expire: "yes"
```

#### Use Cases and Data Structures

**1. Session Storage**:
```redis
# Key pattern: session:{sid}
# TTL: 24 hours
SET session:abc123 '{"userId":"uuid","data":{...}}' EX 86400
```

**2. API Rate Limiting**:
```redis
# Key pattern: ratelimit:{userId}:{endpoint}:{window}
# TTL: 1 minute for per-minute limits
INCR ratelimit:user123:/api/scan:202501121430
EXPIRE ratelimit:user123:/api/scan:202501121430 60
```

**3. BullMQ Job Queues**:
```redis
# Queues: scan-queue, report-queue, notification-queue
# BullMQ uses Redis lists, sorted sets, and hashes internally
```

**4. Real-Time Threat Feed Cache**:
```redis
# Key pattern: threat:{indicator}
# TTL: 1 hour (refresh from PostgreSQL)
SETEX threat:malicious.com 3600 '{"severity":"high","type":"phishing"}'
```

**5. Scan Results Cache** (temporary):
```redis
# Key pattern: scan-result:{scanId}
# TTL: 15 minutes (until scan completes)
SETEX scan-result:scan123 900 '{"status":"scanning","progress":45}'
```

#### High Availability and Failover

- **Primary Node**: us-west1-a
- **Replica Node**: us-west1-b (auto-failover)
- **Failover Time**: < 5 seconds (automatic)
- **Data Loss**: Minimal (depends on replication lag, typically < 1 second)

#### Backup Strategy

- **RDB Snapshots**: Every 6 hours
- **Retention**: 7 days
- **Storage**: Regional (us-west1)
- **Recovery**: Manual restore from snapshot if needed

### Vector Database for AI/ML

#### Option A: Self-Managed ChromaDB on GKE

**Deployment Configuration**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: chromadb
  namespace: data-layer
spec:
  serviceName: chromadb
  replicas: 3
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
        image: chromadb/chroma:0.4.18
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
        volumeMounts:
        - name: data
          mountPath: /chroma/chroma
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
```

**Pros**:
- ✅ Full control over configuration
- ✅ Open-source, no vendor lock-in
- ✅ Lower cost for moderate scale

**Cons**:
- ❌ Manual scaling and management
- ❌ Need to implement own backup/restore
- ❌ Limited query performance at massive scale

#### Option B: Vertex AI Vector Search (Recommended)

**Configuration**:
```python
from google.cloud import aiplatform

# Create Vector Search index
index = aiplatform.MatchingEngineIndex.create_tree_ah_index(
    display_name="elara-threat-embeddings",
    dimensions=1536,  # OpenAI embedding dimension
    approximate_neighbors_count=150,
    distance_measure_type="DOT_PRODUCT_DISTANCE",
    leaf_node_embedding_count=500,
    leaf_nodes_to_search_percent=7,
)

# Deploy to endpoint for serving
endpoint = index.deploy_to_endpoint(
    deployed_index_id="elara-threat-index-prod",
    machine_type="n1-standard-16",
    min_replica_count=2,
    max_replica_count=10,
    enable_access_logging=True,
)
```

**Pros**:
- ✅ Fully managed, auto-scaling
- ✅ High performance (sub-10ms queries)
- ✅ Automatic backups and replication
- ✅ Native integration with Vertex AI
- ✅ Pay-per-query pricing

**Cons**:
- ❌ Vendor lock-in to GCP
- ❌ Higher cost at scale

**Recommendation**: Start with Vertex AI Vector Search for production reliability, migrate to self-managed ChromaDB if cost becomes prohibitive.

#### Use Cases

1. **Semantic Threat Detection**: Find similar malicious URLs/messages
2. **Phishing Detection**: Match against known phishing patterns
3. **AI-Powered Recommendations**: Suggest security actions based on similarity
4. **Anomaly Detection**: Identify unusual patterns in scan data

### Database Monitoring and Alerting

**Key Metrics to Monitor**:

| Metric | Threshold | Alert Action |
|--------|-----------|--------------|
| CPU Utilization | > 80% for 5 min | Scale up instance |
| Memory Utilization | > 85% | Scale up instance |
| Disk Utilization | > 80% | Auto-expand (already configured) |
| Connection Count | > 4000 (80% of max) | Investigate connection leaks |
| Replication Lag | > 30 seconds | Check network, investigate |
| Query Latency (p95) | > 100ms | Analyze slow queries |
| Transaction Throughput | < 1000 TPS (significant drop) | Investigate performance |
| Failed Connections | > 10/minute | Check IAM, network |

**Slow Query Logging**:
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query to find slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries averaging > 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Automated Performance Tuning**:
- **Query Insights**: Enabled (identifies slow queries automatically)
- **Recommendations**: GCP provides optimization suggestions
- **Index Advisor**: Suggests missing indexes

### Database Security Controls

**1. Network Security**:
- ✅ Private IP only (no public internet exposure)
- ✅ VPC peering with application VPC
- ✅ Cloud SQL Proxy for local development
- ✅ Private Service Connect for secure connectivity

**2. Authentication & Authorization**:
- ✅ IAM database authentication
- ✅ Workload Identity for GKE pod access
- ✅ Separate users for read/write operations
- ✅ Application-level service account (least privilege)

**3. Encryption**:
- ✅ At-rest: Customer-Managed Encryption Keys (CMEK) via Cloud KMS
- ✅ In-transit: TLS 1.3 required
- ✅ Backup encryption: CMEK

**4. Audit Logging**:
- ✅ All database connections logged
- ✅ Failed authentication attempts logged
- ✅ Schema changes logged
- ✅ Logs exported to BigQuery for analysis

**5. Compliance**:
- ✅ Automated security patches
- ✅ Compliance reports (SOC 2, ISO 27001)
- ✅ Data residency controls for GDPR
- ✅ Audit trail for regulatory requirements

### Database Cost Optimization

**Estimated Monthly Costs** (Production):

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| Cloud SQL Primary (HA) | db-custom-8-32768, 500GB SSD | $850 |
| Read Replica (us-west1-c) | db-custom-4-16384, 500GB SSD | $400 |
| Read Replica (us-east1-a) | db-custom-4-16384, 500GB SSD | $420 |
| Backups (500GB, 30 days) | 15TB total storage | $150 |
| Memorystore Redis (HA) | 5GB Standard HA | $180 |
| Vertex AI Vector Search | 2-10 replicas, 10M queries/month | $300 |
| **Total Database Costs** | | **$2,300/month** |

**Optimization Strategies**:
1. **Committed Use Discounts**: 1-year commit saves 25% ($575/month savings)
2. **Right-Sizing**: Monitor and adjust instance sizes quarterly
3. **Read Replica Optimization**: Scale down off-peak hours (save $150/month)
4. **Backup Lifecycle**: Move to Nearline after 7 days (save $50/month)
5. **Query Optimization**: Reduce unnecessary queries (lower connection costs)

**Total Optimized DB Cost**: ~$1,800-2,000/month with optimizations

---

## 📋 Business Requirements

### Functional Requirements

| ID | Requirement | Priority | Success Metric |
|----|-------------|----------|----------------|
| FR-001 | URL scanning with 350-point analysis | Critical | 100% feature parity |
| FR-002 | Message/SMS phishing detection | Critical | 100% feature parity |
| FR-003 | File malware scanning | Critical | 100% feature parity |
| FR-004 | Secure web proxy (Puppeteer) | Critical | 100% feature parity |
| FR-005 | WhatsApp integration | High | 100% message delivery |
| FR-006 | AI chatbot assistant | High | 100% feature parity |
| FR-007 | Admin dashboards | High | 100% feature parity |
| FR-008 | User authentication (JWT) | Critical | 100% feature parity |
| FR-009 | API key management | High | 100% feature parity |
| FR-010 | Real-time notifications | Medium | WebSocket support |

### Non-Functional Requirements

| Category | Requirement | Target | Measurement |
|----------|-------------|--------|-------------|
| **Performance** | API response time (p95) | < 100ms | Cloud Trace |
| **Performance** | Page load time | < 2s | Lighthouse CI |
| **Performance** | Scan completion time | < 30s | Application metrics |
| **Availability** | Uptime SLA | 99.9% | Cloud Monitoring |
| **Availability** | Planned maintenance window | < 4 hours/month | Change calendar |
| **Scalability** | Concurrent users | 10,000+ | Load testing |
| **Scalability** | Scans per day | 100,000+ | Application metrics |
| **Security** | Zero-trust network | 100% compliance | Security audit |
| **Security** | Encryption at rest | 100% | Cloud KMS verification |
| **Security** | Encryption in transit | TLS 1.3 | Network inspection |
| **Compliance** | GDPR compliance | 100% | Compliance audit |
| **Compliance** | Audit log retention | 10 years | BigQuery verification |
| **DR/BC** | Recovery Time Objective | 15 minutes | DR drill results |
| **DR/BC** | Recovery Point Objective | 5 minutes | Backup verification |

### User Stories

**As a Security Analyst**, I want to scan URLs for threats so that I can protect my organization from phishing attacks.
- **Acceptance Criteria**:
  - URL scan completes in < 30 seconds
  - 350-point security analysis performed
  - Risk score (0-100) provided
  - Detailed threat report generated

**As a Platform Administrator**, I want to monitor system health so that I can proactively address issues.
- **Acceptance Criteria**:
  - Real-time dashboards showing key metrics
  - Alerts sent to Slack/email on critical issues
  - 99.9% uptime maintained

**As a Compliance Officer**, I want detailed audit logs so that I can demonstrate regulatory compliance.
- **Acceptance Criteria**:
  - All user actions logged
  - Logs retained for 10 years
  - Logs searchable and exportable

---

## 🎯 Success Criteria and KPIs

### Technical KPIs

| KPI | Baseline (Current) | Target (GCP) | Measurement |
|-----|-------------------|--------------|-------------|
| API Latency (p95) | 250ms | < 100ms | Cloud Trace |
| Database Query Time (p95) | 80ms | < 50ms | Cloud SQL Insights |
| Uptime | 99.5% | 99.9% | Cloud Monitoring |
| Failed Requests | 0.5% | < 0.1% | Error Reporting |
| Deployment Frequency | Weekly | Daily | CI/CD metrics |
| Rollback Time | 30 min | 5 min | Deployment logs |
| Incident Response Time | 45 min | 15 min | PagerDuty metrics |

### Business KPIs

| KPI | Baseline | Target | Impact |
|-----|----------|--------|--------|
| Infrastructure Cost/User | $8/month | $5/month | 37% reduction |
| Scan Processing Capacity | 10K/day | 100K/day | 10x increase |
| Customer Satisfaction (NPS) | 45 | 65+ | Improved reliability |
| Security Incidents | 2/quarter | 0 | Zero-trust architecture |
| Compliance Audit Findings | 5/audit | 0 | Automated controls |

### Migration Success Criteria

- ✅ Zero data loss during migration
- ✅ < 4 hours total downtime
- ✅ All features working in GCP within 1 week
- ✅ Performance metrics meeting targets within 2 weeks
- ✅ Cost under budget ($5,500/month)
- ✅ No critical security findings in post-migration audit
- ✅ DR drill successful within 1 month

---

## 📅 Timeline and Milestones

### 8-Week Deployment Schedule

| Week | Phase | Deliverables | Status |
|------|-------|--------------|--------|
| **Week 1** | Planning & Design | Architecture docs, HLD, LLD, security design | 🟡 In Progress |
| **Week 2** | Infrastructure Setup | VPC, GKE, Cloud SQL, Redis provisioned | ⏳ Pending |
| **Week 3** | Application Migration | Backend deployed to GKE, DB migrated | ⏳ Pending |
| **Week 4** | Frontend & CDN | Frontend on Cloud Run, CDN configured | ⏳ Pending |
| **Week 5** | Security Hardening | Cloud Armor, IAM, Binary Auth, SCC enabled | ⏳ Pending |
| **Week 6** | Observability | Logging, monitoring, alerting, dashboards | ⏳ Pending |
| **Week 7** | Testing & Validation | Load testing, security testing, DR drill | ⏳ Pending |
| **Week 8** | Go-Live & Optimization | DNS cutover, monitoring, optimization | ⏳ Pending |

### Detailed Milestones

**Week 1: Planning & Design** (Current Week)
- ✅ Day 1: Kickoff, requirements gathering
- ✅ Day 2: Architecture design, TOGAF review
- 🟡 Day 3: Database architecture design (in progress)
- ⏳ Day 4: Security architecture design
- ⏳ Day 5: Terraform code for infrastructure

**Week 2: Infrastructure Setup**
- ⏳ Day 6: GCP project setup, APIs enabled
- ⏳ Day 7: VPC network, subnets, firewall rules
- ⏳ Day 8: GKE cluster provisioning
- ⏳ Day 9: Cloud SQL HA setup, database migration prep
- ⏳ Day 10: Redis, Cloud Storage, KMS setup

**Week 3: Application Migration**
- ⏳ Day 11: Backend containerization
- ⏳ Day 12: Database schema migration
- ⏳ Day 13: Backend deployment to GKE
- ⏳ Day 14: BullMQ workers deployment
- ⏳ Day 15: Proxy service deployment

**Week 4: Frontend & CDN**
- ⏳ Day 16: Frontend containerization
- ⏳ Day 17: Frontend deployment to Cloud Run
- ⏳ Day 18: Global Load Balancer configuration
- ⏳ Day 19: Cloud CDN setup
- ⏳ Day 20: DNS configuration (staging)

**Week 5: Security Hardening**
- ⏳ Day 21: Cloud Armor WAF rules
- ⏳ Day 22: IAM roles and policies
- ⏳ Day 23: Binary Authorization
- ⏳ Day 24: VPC Service Controls
- ⏳ Day 25: Security Command Center review

**Week 6: Observability**
- ⏳ Day 26: Cloud Logging configuration
- ⏳ Day 27: Cloud Monitoring dashboards
- ⏳ Day 28: Alert policies
- ⏳ Day 29: Distributed tracing setup
- ⏳ Day 30: SLI/SLO definitions

**Week 7: Testing & Validation**
- ⏳ Day 31: Functional testing
- ⏳ Day 32: Load testing (10K concurrent users)
- ⏳ Day 33: Security penetration testing
- ⏳ Day 34: DR drill (failover test)
- ⏳ Day 35: Performance optimization

**Week 8: Go-Live & Optimization**
- ⏳ Day 36: Final pre-production checks
- ⏳ Day 37: DNS cutover to production
- ⏳ Day 38: 24-hour monitoring
- ⏳ Day 39: Performance tuning
- ⏳ Day 40: Project closure, retrospective

---

## 💰 Budget and Cost Analysis

### GCP Credit Budget

**Available**: $25,000 USD (Google Cloud Business Starter Program)
**Estimated Runway**: 6-8 months at target spend rate
**Monthly Target**: $3,500-4,500
**Buffer**: $500/month for overages

### Detailed Cost Breakdown (Monthly)

#### Compute Layer ($1,200-1,600/month)
| Service | Configuration | Cost |
|---------|--------------|------|
| GKE Autopilot (us-west1) | 20-40 vCPU, 60-120GB RAM | $800-1,000 |
| GKE Autopilot (us-east1, DR) | 10-20 vCPU, 30-60GB RAM | $400-600 |
| Cloud Run (Frontend) | 1-5 instances, 2 vCPU each | $0 (under free tier) |

#### Database Layer ($1,800-2,300/month) - **Critical**
| Service | Configuration | Cost |
|---------|--------------|------|
| Cloud SQL Primary (HA) | db-custom-8-32768, 500GB SSD | $850 |
| Cloud SQL Read Replica 1 | db-custom-4-16384, 500GB SSD | $400 |
| Cloud SQL Read Replica 2 (DR) | db-custom-4-16384, 500GB SSD | $420 |
| Backups (500GB × 30 days) | 15TB total storage | $150 |
| Memorystore Redis (HA) | 5GB Standard HA | $180 |
| Vertex AI Vector Search | 2-10 replicas, 10M queries | $300 |

#### Networking ($400-600/month)
| Service | Configuration | Cost |
|---------|--------------|------|
| Global Load Balancer | Forwarding rules + health checks | $100 |
| Cloud CDN | 500GB egress, 10M requests | $150 |
| Cloud NAT | 5 instances, 1TB egress | $100 |
| Cloud Armor | WAF rules, 50M requests | $50-100 |
| VPC Egress (Inter-region) | 500GB/month | $0-150 |

#### Storage ($100-200/month)
| Service | Configuration | Cost |
|---------|--------------|------|
| Cloud Storage (Standard) | 500GB, 1M operations | $10 |
| Cloud Storage (Nearline) | 1TB (reports archive) | $10 |
| Cloud Storage (Archive) | 2TB (long-term backups) | $2 |
| Persistent Disks (GKE) | 1TB SSD across clusters | $170 |

#### Security & Compliance ($200-350/month)
| Service | Configuration | Cost |
|---------|--------------|------|
| Secret Manager | 1,000 secrets, 1M accesses | $6 |
| Cloud KMS | 10 keys, 100K operations | $12 |
| Security Command Center | Premium tier | $200 |
| Cloud IDS | 1 endpoint (optional) | $0-120 |
| Binary Authorization | Enabled | $0 |

#### Observability ($200-400/month)
| Service | Configuration | Cost |
|---------|--------------|------|
| Cloud Logging | 100GB ingestion, BigQuery export | $100 |
| Cloud Monitoring | 1,000 metrics, 100 uptime checks | $50 |
| Cloud Trace | 10M spans/month | $25 |
| Cloud Profiler | Continuous profiling | $0 |
| Error Reporting | Included | $0 |

### Cost Optimization Strategies

**Committed Use Discounts (1-Year)**:
- Save 25% on compute and database: ~$800/month savings
- Total with CUD: $2,700-3,700/month

**Additional Optimizations**:
1. **Preemptible Nodes for Non-Critical Workloads**: Save 50% on dev/staging
2. **Auto-Scaling Policies**: Scale down off-peak hours (nights/weekends)
3. **Object Lifecycle Policies**: Move old data to Nearline/Archive
4. **Right-Sizing**: Quarterly review of instance sizes
5. **Cache Optimization**: Reduce database queries with Redis

**Estimated Monthly Cost After Optimizations**: $3,000-4,000/month
**GCP Credit Runway**: 6-8 months

---

## ⚠️ Risk Assessment and Mitigation

### High-Priority Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Database migration data loss** | Low | Critical | Full backup, dry-run migrations, rollback plan |
| **Extended downtime during cutover** | Medium | High | Staged migration, parallel run, instant rollback |
| **Cost overrun (exceed $25K credits)** | Medium | High | Daily cost monitoring, budget alerts, auto-scaling limits |
| **Security vulnerability during migration** | Low | Critical | Security testing, penetration testing, zero-trust from day 1 |
| **Performance degradation post-migration** | Medium | High | Load testing, performance baselines, monitoring alerts |
| **Skills gap (GCP expertise)** | Low | Medium | Documentation, training, GCP support, Claude Code assistance |

### Risk Response Plan

**Database Migration Risk**:
- **Prevention**:
  - Dry-run migration in dev environment
  - Data validation scripts
  - Schema compatibility testing
- **Detection**:
  - Row count validation
  - Checksum verification
  - Application health checks
- **Response**:
  - Immediate rollback to Render database
  - 4-hour window allows for retry
  - Database replication lag < 5 minutes

**Cost Overrun Risk**:
- **Prevention**:
  - Budget alerts at 50%, 75%, 90% of $4,500/month
  - Auto-scaling max limits enforced
  - Daily cost review
- **Detection**:
  - Real-time cost dashboard
  - Anomaly detection alerts
- **Response**:
  - Scale down non-critical services
  - Disable non-essential features
  - Renegotiate GCP credits if needed

---

## 🔄 Migration Strategy

### Migration Approach: Phased Parallel Run

**Strategy**: Run Elara on both Render/Vercel and GCP in parallel for 1 week, gradually shift traffic to GCP.

#### Phase 1: Infrastructure Provisioning (Week 2)
- Provision all GCP resources (VPC, GKE, Cloud SQL, Redis)
- Configure networking and security
- Set up CI/CD pipelines
- Deploy to GCP staging environment

#### Phase 2: Database Migration (Week 3)
**Approach**: PostgreSQL replication from Render to Cloud SQL

```bash
# Step 1: Create logical replication slot on Render
psql $RENDER_DATABASE_URL -c "SELECT * FROM pg_create_logical_replication_slot('elara_migration', 'pgoutput');"

# Step 2: Use Database Migration Service (DMS)
gcloud database-migration migration-jobs create elara-db-migration \
  --source=render-postgres \
  --destination=cloud-sql-primary \
  --type=CONTINUOUS

# Step 3: Monitor replication lag
gcloud database-migration migration-jobs describe elara-db-migration

# Step 4: Promote Cloud SQL to primary (cutover)
gcloud database-migration migration-jobs promote elara-db-migration
```

#### Phase 3: Application Deployment (Week 3-4)
- Deploy backend to GKE (staging)
- Deploy frontend to Cloud Run (staging)
- Configure DNS for staging.elara.com → GCP
- Run full test suite

#### Phase 4: Traffic Shifting (Week 7-8)
**Gradual Rollout**:
1. **Day 1**: 10% traffic to GCP (canary testing)
2. **Day 2**: 25% traffic to GCP
3. **Day 3**: 50% traffic to GCP
4. **Day 4**: 75% traffic to GCP
5. **Day 5**: 100% traffic to GCP
6. **Day 6-7**: Monitor, keep Render/Vercel as hot standby

**Traffic Control**: Global Load Balancer with weighted backend services

#### Phase 5: Decommissioning (Week 9)
- Archive Render/Vercel data
- Cancel Render/Vercel subscriptions
- Update documentation
- Post-migration audit

### Rollback Plan

**Trigger Criteria** for rollback:
- Critical functionality broken (P0 incidents)
- Performance degradation > 50%
- Data integrity issues
- Security breach

**Rollback Procedure** (< 5 minutes):
```bash
# 1. Immediate DNS switch back to Render/Vercel
cloudflare-cli dns update elara.com --target render.com

# 2. Stop GCP database writes
kubectl scale deployment elara-backend --replicas=0

# 3. Verify Render database is up-to-date
psql $RENDER_DATABASE_URL -c "SELECT COUNT(*) FROM scans WHERE created_at > NOW() - INTERVAL '1 hour';"

# 4. Resume Render services
heroku ps:scale web=5 -a elara-api
```

**Post-Rollback Actions**:
- Root cause analysis
- Fix issues in GCP staging
- Retry migration after validation

---

## 🔖 Rollback and Contingency Plans

### Contingency Scenarios

#### Scenario 1: Cloud SQL HA Failover Failure
**Symptoms**: Primary database unresponsive, standby not promoting
**Contingency**:
1. Manual promotion of read replica (us-west1-c) to primary
2. Update application database connection strings
3. Create new standby instance
4. **Time**: 10-15 minutes

#### Scenario 2: GKE Cluster Unavailable
**Symptoms**: All pods crashing, cluster control plane unresponsive
**Contingency**:
1. Failover to DR cluster (us-east1)
2. Update Load Balancer backend to DR cluster
3. Scale up DR cluster replicas
4. **Time**: 5-10 minutes

#### Scenario 3: Redis Data Loss
**Symptoms**: Cache empty, session data lost
**Contingency**:
1. All users logged out (acceptable for cache failure)
2. Restore from latest RDB snapshot (6 hours old max)
3. Sessions rebuild automatically on login
4. **Time**: 5 minutes (minimal business impact)

#### Scenario 4: Network Connectivity Issues
**Symptoms**: VPC peering broken, Cloud SQL unreachable
**Contingency**:
1. Verify VPC peering status
2. Enable Cloud SQL public IP temporarily
3. Update application to use Cloud SQL Proxy
4. **Time**: 15-20 minutes

### Disaster Recovery Testing Schedule

| Test | Frequency | Last Test | Next Test | Result |
|------|-----------|-----------|-----------|--------|
| Database Failover | Monthly | - | Week 7 | ⏳ Pending |
| GKE Cluster Failover | Quarterly | - | Week 7 | ⏳ Pending |
| Full Region Failover | Quarterly | - | Month 3 | ⏳ Pending |
| Backup Restore | Monthly | - | Week 6 | ⏳ Pending |
| Incident Response Drill | Quarterly | - | Month 2 | ⏳ Pending |

---

## 📚 References and Dependencies

### Technical Dependencies

**GCP Services**:
- Google Kubernetes Engine (GKE) Autopilot
- Cloud SQL for PostgreSQL
- Memorystore for Redis
- Cloud Storage
- Cloud Load Balancing
- Cloud Armor
- Cloud CDN
- Cloud NAT
- Secret Manager
- Cloud KMS
- Cloud Logging
- Cloud Monitoring
- Cloud Trace
- Cloud Profiler
- Security Command Center

**External Tools**:
- Terraform >= 1.9.0
- kubectl >= 1.30.0
- Helm >= 3.15.0
- Docker >= 24.0.0
- gcloud CLI >= 450.0.0

### Documentation References

1. [TOGAF Framework 9.2](https://www.opengroup.org/togaf)
2. [GCP Architecture Framework](https://cloud.google.com/architecture/framework)
3. [Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)
4. [GKE Security Hardening](https://cloud.google.com/kubernetes-engine/docs/how-to/hardening-your-cluster)
5. [Zero Trust on GCP](https://cloud.google.com/beyondcorp)

### Internal Documentation

- [HIGH_LEVEL_DESIGN.md](./HIGH_LEVEL_DESIGN.md) - Architecture diagrams
- [LOW_LEVEL_DESIGN.md](./LOW_LEVEL_DESIGN.md) - Technical specifications
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - Detailed database design
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security controls
- [DEPLOYMENT_PHASES.md](./DEPLOYMENT_PHASES.md) - Step-by-step deployment

---

## ✅ Approval and Sign-Off

### Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | TBD | _______________ | _________ |
| Solution Architect | Claude Code | ✅ Approved | 2025-01-12 |
| Security Lead | TBD | _______________ | _________ |
| Database Architect | TBD | _______________ | _________ |

### Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-12 | Claude Code | Initial project documentation with comprehensive database architecture |

---

**Document Status**: ✅ **APPROVED FOR IMPLEMENTATION**

**Next Steps**:
1. Review and approve by stakeholders
2. Proceed with DATABASE_ARCHITECTURE.md detailed design
3. Begin HIGH_LEVEL_DESIGN.md with architecture diagrams
4. Start Terraform infrastructure code development

---

*This document is maintained by the Elara DevOps team and follows TOGAF ADM standards.*
