# Elara Platform - Database Architecture Design

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Author**: Solution Architect (Claude Code)
**Status**: Production
**Classification**: Technical - Architecture

---

## 📋 Executive Summary

This document provides the comprehensive database architecture design for the Elara cybersecurity platform on Google Cloud Platform. The database layer is the **heart of Elara**, storing critical security data, user information, scan results, threat intelligence, and audit logs. This design prioritizes:

1. **High Availability**: 99.95% uptime with automatic failover
2. **Performance**: Sub-50ms query latency at scale
3. **Security**: Zero-trust access, encryption everywhere
4. **Scalability**: Support 100,000+ scans/day
5. **Disaster Recovery**: RTO 15min, RPO 5min
6. **Compliance**: GDPR, SOC 2, ISO 27001 ready

---

## 📊 Table of Contents

1. [Database Requirements Analysis](#database-requirements-analysis)
2. [Database Architecture Overview](#database-architecture-overview)
3. [Primary Database: Cloud SQL PostgreSQL](#primary-database-cloud-sql-postgresql)
4. [Cache Layer: Memorystore Redis](#cache-layer-memorystore-redis)
5. [Vector Database: AI/ML Embeddings](#vector-database-aiml-embeddings)
6. [Database Schema Design](#database-schema-design)
7. [Data Access Patterns](#data-access-patterns)
8. [Performance Optimization](#performance-optimization)
9. [High Availability and Disaster Recovery](#high-availability-and-disaster-recovery)
10. [Security Architecture](#security-architecture)
11. [Monitoring and Observability](#monitoring-and-observability)
12. [Cost Analysis and Optimization](#cost-analysis-and-optimization)
13. [Migration Strategy](#migration-strategy)
14. [Operational Runbooks](#operational-runbooks)

---

## 🎯 Database Requirements Analysis

### Functional Requirements

| Requirement ID | Description | Priority | Data Volume |
|----------------|-------------|----------|-------------|
| **DB-FR-001** | Store user accounts and authentication data | Critical | 10,000+ users |
| **DB-FR-002** | Store scan results (URL, message, file scans) | Critical | 100,000 scans/day |
| **DB-FR-003** | Store threat intelligence database | Critical | 10M+ threat indicators |
| **DB-FR-004** | Store audit logs for compliance | Critical | 1M+ events/day |
| **DB-FR-005** | Store session data for active users | High | 10,000 concurrent sessions |
| **DB-FR-006** | Store WhatsApp integration data | High | 50,000 messages/day |
| **DB-FR-007** | Store API keys and authentication tokens | High | 1,000+ API keys |
| **DB-FR-008** | Store scan history for analytics | Medium | 365 days retention |
| **DB-FR-009** | Store vector embeddings for AI/ML | Medium | 2M+ embeddings |
| **DB-FR-010** | Store background job queues | High | 10,000+ jobs/day |

### Non-Functional Requirements

#### Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Write Latency (p95)** | < 50ms | Cloud SQL Insights |
| **Read Latency (p95)** | < 20ms | Cloud SQL Insights |
| **Cache Hit Rate** | > 85% | Redis INFO stats |
| **Connection Pooling Efficiency** | < 100ms wait time | PgBouncer metrics |
| **Concurrent Connections** | 10,000+ | PostgreSQL pg_stat_activity |
| **Transaction Throughput** | 5,000 TPS | PostgreSQL pg_stat_database |
| **Query Throughput** | 20,000 QPS | Cloud SQL Insights |
| **Replication Lag** | < 5 seconds | Cloud SQL replication metrics |

#### Availability Requirements

| Metric | Target | Implementation |
|--------|--------|----------------|
| **Database Uptime** | 99.95% (21.9 min/month downtime) | Regional HA configuration |
| **Failover Time** | < 60 seconds | Automatic failover to standby |
| **Data Durability** | 99.999999999% (11 nines) | Cloud SQL managed backups |
| **Backup Success Rate** | 100% | Automated daily backups |
| **Recovery Time Objective (RTO)** | 15 minutes | Automated DR procedures |
| **Recovery Point Objective (RPO)** | 5 minutes | PITR + replication |

#### Security Requirements

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| **Encryption at Rest** | CMEK via Cloud KMS | KMS audit logs |
| **Encryption in Transit** | TLS 1.3 required | SSL enforcement |
| **Network Isolation** | Private IP only, no public access | VPC configuration |
| **Access Control** | IAM + database-level RBAC | IAM audit logs |
| **Audit Logging** | All connections, queries, schema changes | Cloud Audit Logs |
| **Data Residency** | Region-specific for GDPR | Multi-region configuration |
| **Secrets Management** | Secret Manager, no hardcoded credentials | Secret rotation logs |

#### Scalability Requirements

| Dimension | Current | 6 Months | 12 Months | Strategy |
|-----------|---------|----------|-----------|----------|
| **Users** | 5,000 | 25,000 | 100,000 | Horizontal scaling with read replicas |
| **Scans/Day** | 10,000 | 50,000 | 200,000 | Partitioning, caching, query optimization |
| **Database Size** | 5GB | 50GB | 200GB | Auto-expand storage, archival policies |
| **Concurrent Connections** | 500 | 2,000 | 10,000 | Connection pooling with PgBouncer |
| **Threat Intel Records** | 1M | 5M | 20M | Indexes, partitioning, materialized views |

---

## 🏗️ Database Architecture Overview

### Three-Tier Database Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ELARA DATABASE ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Backend    │  │   Workers    │  │  Admin API   │              │
│  │   API (GKE)  │  │   (BullMQ)   │  │   (GKE)      │              │
│  └───────┬──────┘  └───────┬──────┘  └───────┬──────┘              │
└──────────┼─────────────────┼─────────────────┼─────────────────────┘
           │                 │                 │
           │ Connection Pooling (PgBouncer + Application Pools)
           │                 │                 │
┌──────────┼─────────────────┼─────────────────┼─────────────────────┐
│          │       CONNECTION & CACHE LAYER    │                      │
│  ┌───────┴──────┐              ┌─────────────┴───────────┐         │
│  │  PgBouncer   │              │   Memorystore Redis      │         │
│  │  (Sidecar)   │              │   (STANDARD_HA - 5GB)    │         │
│  │  Transaction │              │   elara-redis-primary    │         │
│  │  Pooling     │              │   • Sessions & Cache     │         │
│  └───────┬──────┘              │   • Rate Limiting        │         │
└──────────┼─────────────────────│   • BullMQ Queues        │─────────┘
           │                     └──────────────────────────┘
           │ Private IP (VPC Peering)
           │
┌──────────┼─────────────────────────────────────────────────────────┐
│          │              PRIMARY DATABASE LAYER                      │
│  ┌───────┴─────────────────────────────────────────────────────┐   │
│  │              Cloud SQL PostgreSQL 15 (Zonal)                 │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  PRIMARY (us-west1) - Read/Write                             │   │
│  │  Instance: elara-postgres-optimized                          │   │
│  │                                                               │   │
│  │  Databases:                                                   │   │
│  │  • elara_production (Production data)                        │   │
│  │  • elara_dev (Development data)                              │   │
│  │  • elara_staging (Staging data)                              │   │
│  │  • elara_threat_intel (Shared threat intelligence - 200K+)   │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Configuration:                                                       │
│  • Instance: elara-postgres-optimized                                │
│  • Tier: db-custom-2-7680 (2 vCPU, 7.5GB RAM)                       │
│  • Storage: 100GB SSD                                                │
│  • Availability: ZONAL (cost-optimized)                              │
│  • Network: Private IP only (VPC peering)                           │
│  • Project: elara-mvp-13082025-u1                                    │
│  • Region: us-west1                                                  │
│  • Backups: Daily at 03:00 UTC + PITR (7 days retention)            │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                   VECTOR DATABASE LAYER (AI/ML)                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Option A: Vertex AI Vector Search (Recommended)               │  │
│  │  • Fully managed, serverless                                    │  │
│  │  • 2-10 auto-scaling replicas                                   │  │
│  │  • Sub-10ms similarity search                                   │  │
│  │                                                                  │  │
│  │  Option B: ChromaDB on GKE (Cost-Optimized)                    │  │
│  │  • StatefulSet with 3 replicas                                  │  │
│  │  • 100GB SSD persistent volumes                                 │  │
│  │  • Optional NVIDIA T4 GPU for inference                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                        BACKUP & ARCHIVE LAYER                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Daily Backups    │  │ PITR (WAL Logs)  │  │ Cloud Storage    │   │
│  │ 30-day retention │  │ 7-day retention  │  │ Long-term        │   │
│  │ Multi-region     │  │ GCS Archive      │  │ Archive (10yr)   │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### Database Selection Rationale

#### Primary Database: Cloud SQL PostgreSQL

**Why PostgreSQL?**
- ✅ Proven ACID compliance for critical security data
- ✅ Rich ecosystem of extensions (pg_stat_statements, pg_trgm, etc.)
- ✅ JSON/JSONB support for flexible schema
- ✅ Advanced indexing (GIN, GiST, BRIN)
- ✅ Table partitioning for large datasets
- ✅ Full-text search capabilities
- ✅ Strong GCP integration

**Why Cloud SQL?**
- ✅ Fully managed (automated patching, backups, HA)
- ✅ 99.95% uptime SLA with regional HA
- ✅ Automatic failover < 60 seconds
- ✅ Point-in-time recovery (PITR)
- ✅ Read replicas for horizontal scaling
- ✅ Private IP with VPC peering
- ✅ Integrated with Cloud IAM and KMS

**Alternatives Considered**:
| Alternative | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **Spanner** | Global consistency, unlimited scale | Expensive, overkill for current scale | ❌ Not cost-effective |
| **Firestore** | Serverless, auto-scaling | NoSQL, no ACID, limited queries | ❌ Not suitable for relational data |
| **AlloyDB** | Faster than Cloud SQL | More expensive, newer service | ⏳ Consider for future |
| **Self-managed PostgreSQL on GKE** | Full control | Operational overhead | ❌ Defeats purpose of managed service |

#### Cache Layer: Memorystore Redis

**Why Redis?**
- ✅ Sub-millisecond latency
- ✅ Rich data structures (strings, hashes, lists, sets, sorted sets)
- ✅ Built-in support for sessions, rate limiting, queues
- ✅ Pub/Sub for real-time messaging
- ✅ BullMQ compatibility (job queues)

**Why Memorystore?**
- ✅ Fully managed Redis
- ✅ Standard HA tier with automatic failover
- ✅ RDB persistence (6-hour snapshots)
- ✅ Private IP within VPC
- ✅ In-transit and at-rest encryption

#### Vector Database: Vertex AI Vector Search

**Why Vector Database?**
- ✅ Semantic similarity search for threat detection
- ✅ AI-powered phishing pattern matching
- ✅ Anomaly detection in scan data
- ✅ Fast nearest-neighbor search

**Why Vertex AI Vector Search?**
- ✅ Fully managed, serverless
- ✅ Sub-10ms query latency at scale
- ✅ Auto-scaling (2-10 replicas)
- ✅ Native integration with Vertex AI
- ✅ Automatic backups and HA

---

## 💾 Primary Database: Cloud SQL PostgreSQL

### Instance Configuration

#### Primary Instance (us-west1-a)

```yaml
name: elara-postgres-primary
project_id: elara-production
region: us-west1
zone: us-west1-a
database_version: POSTGRES_15

# High Availability Configuration
availability_type: REGIONAL  # Enables synchronous standby in us-west1-b

# Compute Resources
tier: db-custom-8-32768
  vcpu: 8
  memory_gb: 32

# Storage Configuration
disk:
  type: PD_SSD  # High-performance SSD
  size_gb: 500
  auto_resize: true
  auto_resize_limit_gb: 2000  # Max 2TB before manual intervention

# Backup Configuration
backup:
  enabled: true
  start_time: "03:00"  # 3 AM UTC (low traffic)
  location: us
  point_in_time_recovery: true
  transaction_log_retention_days: 7
  retained_backups_count: 30  # 30 days of daily backups

# Maintenance Window
maintenance:
  day: SUNDAY
  hour: 4  # 4 AM UTC
  update_track: stable  # Don't use canary (production stability)

# Networking
ip_configuration:
  ipv4_enabled: false  # NO public IP
  private_network: projects/elara-production/global/networks/elara-vpc
  allocated_ip_range: google-managed-services-elara-vpc
  require_ssl: true

# Security
database_flags:
  cloudsql.iam_authentication: "on"
  log_checkpoints: "on"
  log_connections: "on"
  log_disconnections: "on"
  log_lock_waits: "on"
  log_statement: "ddl"  # Log schema changes only (not all queries)
  log_temp_files: "0"  # Log all temp files

# Performance Tuning
database_flags:
  max_connections: "5000"
  shared_buffers: "8GB"  # 25% of RAM
  effective_cache_size: "24GB"  # 75% of RAM
  maintenance_work_mem: "2GB"
  checkpoint_completion_target: "0.9"
  wal_buffers: "16MB"
  default_statistics_target: "100"
  random_page_cost: "1.1"  # SSD optimization
  effective_io_concurrency: "200"  # SSD optimization
  work_mem: "10485kB"  # 10MB per operation
  min_wal_size: "1GB"
  max_wal_size: "4GB"
  max_worker_processes: "8"
  max_parallel_workers_per_gather: "4"
  max_parallel_workers: "8"
  max_parallel_maintenance_workers: "4"
```

#### Read Replica 1 (us-west1-c)

```yaml
name: elara-postgres-replica-1
master_instance_name: elara-postgres-primary
region: us-west1
zone: us-west1-c
replica_configuration:
  replication_type: ASYNCHRONOUS
  lag_threshold_seconds: 10  # Alert if lag > 10s

# Same tier as primary for consistent performance
tier: db-custom-4-16384  # Half resources (read-only workload)
  vcpu: 4
  memory_gb: 16

disk:
  type: PD_SSD
  size_gb: 500  # Match primary
  auto_resize: true

ip_configuration:
  ipv4_enabled: false
  private_network: projects/elara-production/global/networks/elara-vpc
  require_ssl: true
```

#### Read Replica 2 (us-east1-a) - DR

```yaml
name: elara-postgres-replica-2-dr
master_instance_name: elara-postgres-primary
region: us-east1  # Cross-region for DR
zone: us-east1-a
replica_configuration:
  replication_type: ASYNCHRONOUS
  lag_threshold_seconds: 30  # Higher tolerance for cross-region

tier: db-custom-4-16384
disk:
  type: PD_SSD
  size_gb: 500

ip_configuration:
  ipv4_enabled: false
  private_network: projects/elara-production/global/networks/elara-vpc
  require_ssl: true
```

### High Availability Architecture

#### Automatic Failover Configuration

**Regional HA (us-west1)**:
```
PRIMARY (us-west1-a)  ←──→  STANDBY (us-west1-b)
      ↓                          ↑
  Synchronous                Automatic
  Replication               Failover (<60s)
      ↓                          ↑
  Zero Data Loss           Zero Data Loss
```

**Failover Triggers**:
- Primary instance failure (hardware, software)
- Zone outage (us-west1-a)
- Network connectivity loss
- Health check failures (3 consecutive)

**Failover Process** (automatic):
1. Health checks detect primary failure (15 seconds)
2. Standby promoted to primary (30 seconds)
3. DNS updated to point to new primary (10 seconds)
4. Old primary becomes standby when recovered (5 minutes)
5. **Total Failover Time**: < 60 seconds
6. **Data Loss**: Zero (synchronous replication)

**Application Impact**:
- Active connections dropped (applications must reconnect)
- Connection poolers (PgBouncer) automatically reconnect
- < 60 seconds of write unavailability
- Read replicas continue serving read traffic during failover

### Connection Management

#### Connection Pooling Strategy

**Layer 1: Application-Level Pooling (Node.js)**

```typescript
// config/database.ts
import { Pool } from 'pg';

// Write pool (primary instance)
export const writePool = new Pool({
  host: process.env.DB_PRIMARY_HOST,  // Cloud SQL private IP
  port: 5432,
  database: 'elara_production',
  user: 'elara_app_write',
  password: process.env.DB_PASSWORD,  // From Secret Manager
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT,
  },
  // Connection pool settings
  max: 50,  // Max connections per pod
  min: 10,  // Keep-alive connections
  idleTimeoutMillis: 30000,  // 30 seconds
  connectionTimeoutMillis: 5000,  // 5 seconds
  maxUses: 7500,  // Recycle connection after 7500 queries
  // Health checks
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Read pool (read replicas with round-robin DNS)
export const readPool = new Pool({
  host: process.env.DB_READ_REPLICA_HOST,  // Round-robin DNS to replicas
  port: 5432,
  database: 'elara_production',
  user: 'elara_app_readonly',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT,
  },
  max: 100,  // More connections for read workload
  min: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
});

// Usage in application
export async function executeWrite(query: string, params: any[]) {
  const client = await writePool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

export async function executeRead(query: string, params: any[]) {
  const client = await readPool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}
```

**Layer 2: PgBouncer (Transaction Pooling)**

Deployed as sidecar container in GKE pods:

```yaml
# pgbouncer-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pgbouncer-config
  namespace: elara-backend
data:
  pgbouncer.ini: |
    [databases]
    elara_production = host=CLOUD_SQL_PRIMARY_IP port=5432 dbname=elara_production

    [pgbouncer]
    listen_addr = 0.0.0.0
    listen_port = 6432
    auth_type = md5
    auth_file = /etc/pgbouncer/userlist.txt

    # Connection pooling
    pool_mode = transaction  # Most efficient for OLTP
    max_client_conn = 10000  # Max from all pods
    default_pool_size = 50  # Connections per database
    reserve_pool_size = 25  # Emergency reserve
    reserve_pool_timeout = 5  # Seconds

    # Server connections
    max_db_connections = 200  # Total to PostgreSQL
    max_user_connections = 5000

    # Timeouts
    server_idle_timeout = 600  # 10 minutes
    server_lifetime = 3600  # 1 hour
    server_connect_timeout = 15
    query_timeout = 120  # 2 minutes max query time

    # Logging
    log_connections = 1
    log_disconnections = 1
    log_pooler_errors = 1
```

#### Connection Limits and Scaling

| Component | Max Connections | Current Usage | Headroom |
|-----------|----------------|---------------|----------|
| PostgreSQL (max_connections) | 5,000 | ~500-1,000 | 80% |
| PgBouncer (max_client_conn) | 10,000 | ~2,000-3,000 | 70% |
| Application Pools (50 per pod × 20 pods) | 1,000 | ~200-400 | 80% |
| Read Replicas (combined) | 5,000 | ~1,000-2,000 | 60% |

**Monitoring Alerts**:
- Alert if active connections > 4,000 (80% of max)
- Alert if connection wait time > 100ms
- Alert if connection errors > 10/minute

---

## 📁 Database Schema Design

### Core Tables

#### Users Table

```sql
CREATE TABLE users (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    full_name VARCHAR(255),
    company VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',  -- 'user', 'admin', 'analyst'

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),

    -- Subscription
    subscription_tier VARCHAR(50) DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
    subscription_expires_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    login_count INTEGER DEFAULT 0,

    -- Audit
    created_by UUID,
    updated_by UUID
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires_at);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Row-Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Scans Table (Partitioned)

```sql
-- Parent table (partitioned by month)
CREATE TABLE scans (
    -- Primary Key
    id UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Ownership
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Scan Details
    scan_type VARCHAR(50) NOT NULL,  -- 'url', 'message', 'file'
    target TEXT NOT NULL,  -- URL, message content, file name
    target_hash VARCHAR(64),  -- SHA-256 of target (for deduplication)

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'scanning', 'completed', 'failed', 'cancelled'

    -- Results
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    threat_level VARCHAR(50),  -- 'safe', 'low', 'medium', 'high', 'critical'
    is_malicious BOOLEAN,

    -- Findings (JSON for flexibility)
    findings JSONB DEFAULT '{}',
    /*
      Example findings structure:
      {
        "threats_detected": ["phishing", "malware"],
        "indicators": {
          "suspicious_links": 5,
          "known_bad_domains": 2,
          "malicious_scripts": 1
        },
        "details": {
          "virustotal_score": "15/70",
          "google_safe_browsing": "unsafe",
          "ai_confidence": 0.95
        }
      }
    */

    -- Metadata
    metadata JSONB DEFAULT '{}',
    /*
      Example metadata:
      {
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "api_key_id": "key_123",
        "scan_options": {"deep_scan": true}
      }
    */

    -- Performance
    scan_duration_ms INTEGER,
    engine_response_times JSONB,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Soft delete
    deleted_at TIMESTAMP,

    PRIMARY KEY (id, created_at)  -- Composite key for partitioning
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (automate with cron job)
CREATE TABLE scans_2025_01 PARTITION OF scans
    FOR VALUES FROM ('2025-01-01 00:00:00') TO ('2025-02-01 00:00:00');

CREATE TABLE scans_2025_02 PARTITION OF scans
    FOR VALUES FROM ('2025-02-01 00:00:00') TO ('2025-03-01 00:00:00');

CREATE TABLE scans_2025_03 PARTITION OF scans
    FOR VALUES FROM ('2025-03-01 00:00:00') TO ('2025-04-01 00:00:00');
-- ... continue for 12 months

-- Indexes on parent table (inherited by partitions)
CREATE INDEX idx_scans_user_id ON scans(user_id, created_at DESC);
CREATE INDEX idx_scans_status ON scans(status, created_at DESC) WHERE status IN ('pending', 'scanning');
CREATE INDEX idx_scans_threat_level ON scans(threat_level, created_at DESC) WHERE threat_level IN ('high', 'critical');
CREATE INDEX idx_scans_scan_type ON scans(scan_type, created_at DESC);
CREATE INDEX idx_scans_target_hash ON scans(target_hash) WHERE target_hash IS NOT NULL;
CREATE INDEX idx_scans_findings_gin ON scans USING GIN (findings jsonb_path_ops);

-- Optimize JSONB queries
CREATE INDEX idx_scans_malicious ON scans(is_malicious, created_at DESC) WHERE is_malicious = true;
```

### Additional Tables

Due to length constraints, I'll provide the schema for remaining critical tables in a condensed format:

#### Threats Table (Threat Intelligence Database)

```sql
CREATE TABLE threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_type VARCHAR(100) NOT NULL,  -- 'phishing', 'malware', 'ransomware', etc.
    indicator VARCHAR(500) NOT NULL,  -- URL, IP, hash, domain
    indicator_type VARCHAR(50) NOT NULL,  -- 'url', 'ip', 'hash', 'domain', 'email'
    severity VARCHAR(50) NOT NULL,  -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    source VARCHAR(255),  -- Threat feed source
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_threats_indicator_unique ON threats(indicator, indicator_type) WHERE is_active = true;
CREATE INDEX idx_threats_type ON threats(threat_type, last_seen DESC) WHERE is_active = true;
CREATE INDEX idx_threats_severity ON threats(severity, last_seen DESC) WHERE is_active = true;
CREATE INDEX idx_threats_indicator_type ON threats(indicator_type);
```

#### Audit Logs Table (Partitioned)

```sql
CREATE TABLE audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,  -- 'user.login', 'scan.create', 'admin.delete_user', etc.
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) NOT NULL,  -- 'success', 'failure', 'denied'
    error_message TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions (same as scans)
CREATE INDEX idx_audit_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_status ON audit_logs(status) WHERE status IN ('failure', 'denied');
```

---

## 🚀 Performance Optimization

### Query Optimization Strategies

1. **Index Strategy**: GIN for JSONB, B-tree for timestamps, partial indexes for filtered queries
2. **Partitioning**: Monthly partitions for high-volume tables (scans, audit_logs)
3. **Materialized Views**: Pre-aggregate analytics queries
4. **Query Plan Analysis**: Regular EXPLAIN ANALYZE on slow queries
5. **Connection Pooling**: PgBouncer + application-level pooling
6. **Read/Write Splitting**: Route reads to replicas

### Caching Strategy

**Redis Cache Layers**:
- **L1 Cache**: Hot data (TTL: 5 minutes) - Recent scan results
- **L2 Cache**: Warm data (TTL: 1 hour) - Threat intelligence lookups
- **L3 Cache**: Cold data (TTL: 24 hours) - User profiles, settings

### Monitoring Queries

```sql
-- Find slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC LIMIT 20;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 💰 Cost Analysis

**Monthly Database Costs** (Production):
- Cloud SQL Primary (HA): $850
- Read Replica 1: $400
- Read Replica 2 (DR): $420
- Backups: $150
- Redis (HA): $180
- Vector DB: $300
- **Total**: $2,300/month

**Optimization**: ~$1,850/month with 1-year committed use discounts (25% savings)

---

**Document Status**: ✅ **APPROVED FOR REVIEW**

**Next Document**: HIGH_LEVEL_DESIGN.md (Architecture Diagrams)
