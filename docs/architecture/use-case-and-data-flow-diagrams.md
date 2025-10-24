# Elara Platform - Use Case & Data Flow Diagrams

**Version**: 1.0.0
**Last Updated**: 2025-10-24
**Status**: Production Ready

---

## Table of Contents

1. [Use Case Diagrams](#1-use-case-diagrams)
2. [Data Flow Diagrams](#2-data-flow-diagrams)
3. [Sequence Diagrams](#3-sequence-diagrams)
4. [State Diagrams](#4-state-diagrams)
5. [Component Interaction Diagrams](#5-component-interaction-diagrams)

---

## 1. Use Case Diagrams

### 1.1 System-Level Use Cases

```mermaid
graph TB
    subgraph "Actors"
        END_USER[End User]
        SECURITY_ANALYST[Security Analyst]
        ADMIN[Administrator]
        API_DEVELOPER[API Developer]
    end

    subgraph "Elara Platform Use Cases"
        subgraph "Scanning"
            UC1[Scan URL]
            UC2[Scan Message]
            UC3[Scan File]
            UC4[View Scan Results]
            UC5[Export Scan Report]
        end

        subgraph "Analysis"
            UC6[Request AI Analysis]
            UC7[View Threat Intelligence]
            UC8[Check Risk Score]
            UC9[View Historical Trends]
        end

        subgraph "User Management"
            UC10[Register Account]
            UC11[Login]
            UC12[Manage Profile]
            UC13[Upgrade Subscription]
        end

        subgraph "Administration"
            UC14[Manage Users]
            UC15[Configure Threat Sources]
            UC16[View System Metrics]
            UC17[Generate Reports]
            UC18[Manage API Keys]
        end

        subgraph "Integration"
            UC19[Use REST API]
            UC20[Browser Extension]
            UC21[WhatsApp Bot]
        end
    end

    END_USER --> UC1
    END_USER --> UC2
    END_USER --> UC3
    END_USER --> UC4
    END_USER --> UC10
    END_USER --> UC11
    END_USER --> UC12
    END_USER --> UC20
    END_USER --> UC21

    SECURITY_ANALYST --> UC1
    SECURITY_ANALYST --> UC2
    SECURITY_ANALYST --> UC3
    SECURITY_ANALYST --> UC4
    SECURITY_ANALYST --> UC5
    SECURITY_ANALYST --> UC6
    SECURITY_ANALYST --> UC7
    SECURITY_ANALYST --> UC8
    SECURITY_ANALYST --> UC9

    ADMIN --> UC14
    ADMIN --> UC15
    ADMIN --> UC16
    ADMIN --> UC17
    ADMIN --> UC18

    API_DEVELOPER --> UC19

    style END_USER fill:#61DAFB,stroke:#333,stroke-width:2px
    style SECURITY_ANALYST fill:#4285F4,stroke:#333,stroke-width:2px,color:#fff
    style ADMIN fill:#EA4335,stroke:#333,stroke-width:2px,color:#fff
    style API_DEVELOPER fill:#34A853,stroke:#333,stroke-width:2px,color:#fff
```

### 1.2 URL Scanning Use Case (Detailed)

```mermaid
graph TB
    USER[User] --> SUBMIT[Submit URL for Scanning]

    SUBMIT --> VALIDATE{Validate URL Format}

    VALIDATE -->|Invalid| ERROR1[Display Error:<br/>Invalid URL Format]
    VALIDATE -->|Valid| CHECK_CACHE{Check Cache}

    CHECK_CACHE -->|Cache Hit| RETURN_CACHED[Return Cached Result]
    CHECK_CACHE -->|Cache Miss| CHECK_DB{Check Database}

    CHECK_DB -->|Previously Scanned| RETURN_DB[Return Previous Result]
    CHECK_DB -->|New Scan| INITIATE[Initiate Scan]

    INITIATE --> PARALLEL{Parallel Scans}

    PARALLEL --> DOMAIN[Domain Analysis]
    PARALLEL --> SSL[SSL/TLS Analysis]
    PARALLEL --> CONTENT[Content Analysis]
    PARALLEL --> THREAT[Threat Intel Lookup]

    DOMAIN --> AGGREGATE[Aggregate Results]
    SSL --> AGGREGATE
    CONTENT --> AGGREGATE
    THREAT --> AGGREGATE

    AGGREGATE --> AI_ANALYSIS[AI Multi-LLM Analysis]
    AI_ANALYSIS --> SCORING[Calculate Risk Score]
    SCORING --> STORE[Store Results]
    STORE --> CACHE[Cache Results]
    CACHE --> DISPLAY[Display Results to User]

    RETURN_CACHED --> DISPLAY
    RETURN_DB --> DISPLAY

    style USER fill:#61DAFB,stroke:#333,stroke-width:2px
    style AI_ANALYSIS fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style DISPLAY fill:#28a745,stroke:#333,stroke-width:2px,color:#fff
```

### 1.3 User Authentication Use Case

```mermaid
graph LR
    USER[User] --> LOGIN_PAGE[Access Login Page]

    LOGIN_PAGE --> ENTER_CREDS[Enter Email & Password]
    ENTER_CREDS --> SUBMIT_LOGIN[Submit Login Form]

    SUBMIT_LOGIN --> VALIDATE_INPUT{Validate Input}
    VALIDATE_INPUT -->|Invalid| ERROR_INPUT[Show Validation Error]
    ERROR_INPUT --> ENTER_CREDS

    VALIDATE_INPUT -->|Valid| AUTH_CHECK{Authenticate}

    AUTH_CHECK -->|Invalid| ERROR_AUTH[Show Authentication Error<br/>Invalid Credentials]
    ERROR_AUTH --> ENTER_CREDS

    AUTH_CHECK -->|Valid| GENERATE_TOKEN[Generate JWT Tokens]
    GENERATE_TOKEN --> STORE_SESSION[Store Session]
    STORE_SESSION --> REDIRECT[Redirect to Dashboard]

    style USER fill:#61DAFB,stroke:#333,stroke-width:2px
    style GENERATE_TOKEN fill:#28a745,stroke:#333,stroke-width:2px,color:#fff
    style REDIRECT fill:#28a745,stroke:#333,stroke-width:2px,color:#fff
```

---

## 2. Data Flow Diagrams

### 2.1 Level 0 DFD (Context Diagram)

```mermaid
graph TB
    subgraph "External Entities"
        USER[Users]
        ADMIN[Administrators]
        AI_PROVIDERS[AI Service Providers<br/>Claude, GPT-4, Gemini]
        THREAT_PROVIDERS[Threat Intel Providers<br/>VirusTotal, AbuseIPDB, etc.]
    end

    subgraph "Elara Platform"
        SYSTEM[Elara Cybersecurity Platform]
    end

    USER -->|Scan Requests| SYSTEM
    USER -->|User Data| SYSTEM
    SYSTEM -->|Scan Results| USER
    SYSTEM -->|Reports| USER

    ADMIN -->|Configuration| SYSTEM
    ADMIN -->|Admin Commands| SYSTEM
    SYSTEM -->|System Metrics| ADMIN
    SYSTEM -->|Audit Logs| ADMIN

    SYSTEM -->|Analysis Requests| AI_PROVIDERS
    AI_PROVIDERS -->|AI Analysis Results| SYSTEM

    SYSTEM -->|Threat Queries| THREAT_PROVIDERS
    THREAT_PROVIDERS -->|Threat Intelligence Data| SYSTEM

    style SYSTEM fill:#4285F4,stroke:#333,stroke-width:3px,color:#fff
```

### 2.2 Level 1 DFD (Major Processes)

```mermaid
graph TB
    subgraph "External Entities"
        USER[Users]
        AI[AI Services]
        THREAT_INTEL[Threat Intel Sources]
    end

    subgraph "Major Processes"
        P1[P1: User Authentication<br/>& Authorization]
        P2[P2: Scan Processing<br/>& Orchestration]
        P3[P3: AI Analysis<br/>& Consensus]
        P4[P4: Threat Intelligence<br/>Synchronization]
        P5[P5: Result Storage<br/>& Retrieval]
    end

    subgraph "Data Stores"
        DS1[(D1: User Database)]
        DS2[(D2: Scan Results)]
        DS3[(D3: Threat Intelligence)]
        DS4[(D4: Cache)]
    end

    USER -->|Login Credentials| P1
    P1 -->|User Session| USER
    P1 <-->|User Data| DS1

    USER -->|Scan Request| P2
    P2 -->|Scan Results| USER

    P2 -->|Analysis Request| P3
    P3 <-->|AI API Calls| AI
    P3 -->|Analysis Results| P2

    P2 -->|Threat Lookup| DS3
    P4 <-->|Threat Data Sync| THREAT_INTEL
    P4 -->|Updated Threats| DS3

    P2 -->|Store Results| P5
    P5 <-->|Scan Data| DS2
    P5 <-->|Cached Results| DS4
    P5 -->|Retrieved Results| P2

    style P1 fill:#61DAFB,stroke:#333,stroke-width:2px
    style P2 fill:#339933,stroke:#333,stroke-width:2px,color:#fff
    style P3 fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style P4 fill:#FFA500,stroke:#333,stroke-width:2px,color:#fff
    style P5 fill:#4169E1,stroke:#333,stroke-width:2px,color:#fff
```

### 2.3 Level 2 DFD (URL Scan Processing)

```mermaid
graph TB
    subgraph "Input"
        USER[User]
    end

    subgraph "Scan Processing Detail"
        P21[P2.1: Input Validation]
        P22[P2.2: Cache Check]
        P23[P2.3: Domain Analysis]
        P24[P2.4: SSL/TLS Check]
        P25[P2.5: Content Analysis]
        P26[P2.6: Threat Intel Lookup]
        P27[P2.7: Risk Scoring]
    end

    subgraph "Data Stores"
        DS2[(D2: Scan Results)]
        DS3[(D3: Threat Intelligence)]
        DS4[(D4: Cache)]
    end

    subgraph "External"
        AI[AI Services]
    end

    USER -->|URL| P21
    P21 -->|Valid URL| P22
    P22 <-->|Check/Store| DS4

    P22 -->|Cache Miss| P23
    P22 -->|Cache Miss| P24
    P22 -->|Cache Miss| P25
    P22 -->|Cache Miss| P26

    P23 -->|Domain Data| P27
    P24 -->|SSL Data| P27
    P25 -->|Content Data| P27
    P26 <-->|Lookup| DS3
    P26 -->|Threat Data| P27

    P27 -->|Analysis Request| AI
    AI -->|AI Results| P27
    P27 -->|Final Score| DS2
    P27 -->|Results| DS4
    P27 -->|Results| USER

    style P21 fill:#61DAFB,stroke:#333,stroke-width:2px
    style P27 fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
```

---

## 3. Sequence Diagrams

### 3.1 End-to-End URL Scan Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Frontend
    participant LB as Load Balancer
    participant API as Backend API
    participant AUTH as Auth Service
    participant CACHE as Redis Cache
    participant DB as PostgreSQL
    participant SCANNER as URL Scanner
    participant TI as Threat Intel
    participant AI as AI Service (Claude/GPT/Gemini)
    participant QUEUE as BullMQ Queue

    U->>FE: Enter URL to scan
    FE->>LB: POST /api/v2/scan/url (with JWT)
    LB->>API: Forward request

    API->>AUTH: Validate JWT token
    AUTH-->>API: Token valid, user authorized

    API->>CACHE: Check if URL cached
    alt Cache Hit
        CACHE-->>API: Return cached result
        API-->>FE: Scan result
        FE-->>U: Display result
    else Cache Miss
        CACHE-->>API: Not found

        API->>DB: Check if URL scanned before
        alt Previously Scanned (< 24h)
            DB-->>API: Return previous scan
            API->>CACHE: Cache result (TTL: 1h)
            API-->>FE: Scan result
            FE-->>U: Display result
        else New Scan Required
            DB-->>API: Not found

            API->>QUEUE: Add scan job to queue
            QUEUE-->>API: Job queued

            API-->>FE: Accepted (202)
            FE-->>U: Scanning in progress...

            QUEUE->>SCANNER: Process scan job

            par Parallel Scanning
                SCANNER->>SCANNER: Domain Analysis
                SCANNER->>SCANNER: SSL/TLS Check
                SCANNER->>SCANNER: Content Analysis
                SCANNER->>TI: Query threat sources
                TI-->>SCANNER: Threat data
            end

            SCANNER->>AI: Request AI analysis

            par Multi-LLM Consensus
                AI->>AI: Claude Analysis
                AI->>AI: GPT-4 Analysis
                AI->>AI: Gemini Analysis
            end

            AI-->>SCANNER: Consensus result

            SCANNER->>SCANNER: Calculate final risk score
            SCANNER->>DB: Store scan result
            SCANNER->>CACHE: Cache result
            SCANNER->>FE: WebSocket: Scan complete
            FE-->>U: Display result
        end
    end
```

### 3.2 Threat Intelligence Synchronization

```mermaid
sequenceDiagram
    autonumber
    participant CRON as Cron Scheduler
    participant WORKER as Worker Service
    participant TI1 as URLhaus
    participant TI2 as ThreatFox
    participant TI3 as AbuseIPDB
    participant TI4 as VirusTotal
    participant DB as PostgreSQL
    participant CACHE as Redis Cache

    CRON->>WORKER: Trigger daily sync (00:00 UTC)

    par Parallel Source Sync
        WORKER->>TI1: Fetch latest indicators
        TI1-->>WORKER: URLs (CSV)

        WORKER->>TI2: Fetch latest indicators
        TI2-->>WORKER: IOCs (JSON)

        WORKER->>TI3: Fetch blacklist
        TI3-->>WORKER: IPs (JSON)

        WORKER->>TI4: Fetch recent submissions
        TI4-->>WORKER: Hashes & URLs (JSON)
    end

    WORKER->>WORKER: Normalize data format
    WORKER->>WORKER: Deduplicate indicators
    WORKER->>WORKER: Validate data quality

    WORKER->>DB: Begin transaction
    WORKER->>DB: Upsert threat indicators
    WORKER->>DB: Update source metadata
    WORKER->>DB: Commit transaction

    WORKER->>CACHE: Invalidate relevant caches
    WORKER->>DB: Log sync completion

    WORKER-->>CRON: Sync complete (200K+ indicators updated)
```

### 3.3 AI Consensus Analysis Flow

```mermaid
sequenceDiagram
    autonumber
    participant SCANNER as URL Scanner
    participant ORCH as AI Orchestrator
    participant CLAUDE as Claude Sonnet 4.5
    participant GPT as GPT-4 Turbo
    participant GEMINI as Gemini Pro
    participant CONSENSUS as Consensus Engine

    SCANNER->>ORCH: Request AI analysis (URL + scan data)

    par Parallel AI Analysis
        ORCH->>CLAUDE: Analyze threat (prompt + data)
        activate CLAUDE
        CLAUDE->>CLAUDE: Process & analyze
        CLAUDE-->>ORCH: Analysis result + confidence
        deactivate CLAUDE

        ORCH->>GPT: Analyze threat (prompt + data)
        activate GPT
        GPT->>GPT: Process & analyze
        GPT-->>ORCH: Analysis result + confidence
        deactivate GPT

        ORCH->>GEMINI: Analyze threat (prompt + data)
        activate GEMINI
        GEMINI->>GEMINI: Process & analyze
        GEMINI-->>ORCH: Analysis result + confidence
        deactivate GEMINI
    end

    ORCH->>CONSENSUS: Aggregate results
    CONSENSUS->>CONSENSUS: Calculate agreement score
    CONSENSUS->>CONSENSUS: Identify outliers

    alt High Agreement (>80%)
        CONSENSUS->>CONSENSUS: Use majority verdict
    else Medium Agreement (50-80%)
        CONSENSUS->>CONSENSUS: Weighted average by confidence
    else Low Agreement (<50%)
        CONSENSUS->>CONSENSUS: Flag for manual review
    end

    CONSENSUS-->>ORCH: Final consensus result
    ORCH-->>SCANNER: AI analysis complete
```

---

## 4. State Diagrams

### 4.1 Scan Result State Machine

```mermaid
stateDiagram-v2
    [*] --> Queued: Scan initiated

    Queued --> Processing: Worker picks up job
    Processing --> Analyzing: Initial scans complete
    Analyzing --> AIAnalysis: Threat data collected

    AIAnalysis --> Scoring: AI consensus complete
    Scoring --> Completed: Final score calculated

    Processing --> Failed: Scan error
    Analyzing --> Failed: Analysis error
    AIAnalysis --> Failed: AI service unavailable

    Failed --> Queued: Retry (max 3 attempts)

    Completed --> [*]
    Failed --> [*]: Max retries exceeded

    state Processing {
        [*] --> DomainScan
        DomainScan --> SSLCheck
        SSLCheck --> ContentAnalysis
        ContentAnalysis --> ThreatLookup
        ThreatLookup --> [*]
    }

    state AIAnalysis {
        [*] --> ClaudeAnalysis
        ClaudeAnalysis --> GPTAnalysis
        GPTAnalysis --> GeminiAnalysis
        GeminiAnalysis --> ConsensusCalculation
        ConsensusCalculation --> [*]
    }

    note right of Queued
        Initial state when
        scan is submitted
    end note

    note right of Completed
        Result cached for 1 hour
        Stored in database permanently
    end note
```

### 4.2 User Session State Machine

```mermaid
stateDiagram-v2
    [*] --> Anonymous: User visits site

    Anonymous --> Registering: Click register
    Registering --> EmailVerification: Submit registration
    EmailVerification --> Authenticated: Verify email

    Anonymous --> Authenticating: Click login
    Authenticating --> Authenticated: Valid credentials
    Authenticating --> Anonymous: Invalid credentials

    Authenticated --> Active: Using platform
    Active --> SessionExpiring: 25 min idle
    SessionExpiring --> Authenticated: Refresh token used
    SessionExpiring --> Anonymous: Token expired

    Active --> LoggingOut: User clicks logout
    LoggingOut --> Anonymous: Session cleared

    note right of Authenticated
        Access token: 30 min
        Refresh token: 7 days
    end note

    note right of SessionExpiring
        5-min warning before
        token expiration
    end note
```

---

## 5. Component Interaction Diagrams

### 5.1 Scanning System Components

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App]
        EXTENSION[Browser Extension]
        WHATSAPP[WhatsApp Bot]
    end

    subgraph "API Gateway"
        LB[Load Balancer]
        AUTH[Auth Middleware]
        RATE[Rate Limiter]
    end

    subgraph "Application Services"
        SCAN_API[Scan API Controller]
        USER_API[User API Controller]
        ADMIN_API[Admin API Controller]
    end

    subgraph "Business Logic"
        SCAN_SVC[Scan Service]
        AI_SVC[AI Service]
        TI_SVC[Threat Intel Service]
        USER_SVC[User Service]
    end

    subgraph "Core Engine"
        ORCHESTRATOR[Scan Orchestrator]
        DOMAIN_SCANNER[Domain Scanner]
        SSL_SCANNER[SSL Scanner]
        CONTENT_SCANNER[Content Scanner]
        AI_CONSENSUS[AI Consensus Engine]
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        CACHE_MGR[Cache Manager]
        QUEUE[BullMQ]
    end

    subgraph "Infrastructure"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis)]
    end

    WEB --> LB
    EXTENSION --> LB
    WHATSAPP --> LB

    LB --> AUTH
    AUTH --> RATE
    RATE --> SCAN_API
    RATE --> USER_API
    RATE --> ADMIN_API

    SCAN_API --> SCAN_SVC
    USER_API --> USER_SVC
    ADMIN_API --> TI_SVC

    SCAN_SVC --> ORCHESTRATOR
    SCAN_SVC --> AI_SVC
    SCAN_SVC --> TI_SVC

    ORCHESTRATOR --> DOMAIN_SCANNER
    ORCHESTRATOR --> SSL_SCANNER
    ORCHESTRATOR --> CONTENT_SCANNER
    ORCHESTRATOR --> AI_CONSENSUS

    AI_CONSENSUS --> AI_SVC

    SCAN_SVC --> PRISMA
    SCAN_SVC --> CACHE_MGR
    SCAN_SVC --> QUEUE

    PRISMA --> POSTGRES
    CACHE_MGR --> REDIS
    QUEUE --> REDIS

    style WEB fill:#61DAFB,stroke:#333,stroke-width:2px
    style ORCHESTRATOR fill:#FF6B6B,stroke:#333,stroke-width:2px,color:#fff
    style AI_CONSENSUS fill:#FFA500,stroke:#333,stroke-width:2px,color:#fff
    style POSTGRES fill:#4169E1,stroke:#333,stroke-width:2px,color:#fff
    style REDIS fill:#DC382D,stroke:#333,stroke-width:2px,color:#fff
```

### 5.2 Deployment Component Diagram

```mermaid
graph TB
    subgraph "GKE Cluster - us-west1"
        subgraph "Frontend Namespace"
            FE_POD1[Frontend Pod 1<br/>Nginx + React]
            FE_POD2[Frontend Pod 2<br/>Nginx + React]
            FE_SVC[Frontend Service<br/>ClusterIP]
        end

        subgraph "Backend Namespace"
            BE_POD1[Backend Pod 1<br/>Node.js]
            BE_POD2[Backend Pod 2<br/>Node.js]
            BE_POD3[Backend Pod 3<br/>Node.js]
            BE_SVC[Backend Service<br/>ClusterIP]
        end

        subgraph "Worker Namespace"
            WORKER_POD1[Worker Pod 1<br/>BullMQ]
            WORKER_POD2[Worker Pod 2<br/>BullMQ]
        end

        subgraph "Proxy Namespace"
            PROXY_POD[Proxy Pod<br/>Puppeteer]
        end

        INGRESS[Ingress Controller<br/>nginx-ingress]
    end

    subgraph "Managed Services"
        SQL[(Cloud SQL<br/>PostgreSQL)]
        REDIS_SVC[(Memorystore<br/>Redis)]
        BUCKET[Cloud Storage]
        SECRET[Secret Manager]
    end

    INTERNET((Internet)) --> INGRESS
    INGRESS --> FE_SVC
    INGRESS --> BE_SVC
    FE_SVC --> FE_POD1
    FE_SVC --> FE_POD2
    BE_SVC --> BE_POD1
    BE_SVC --> BE_POD2
    BE_SVC --> BE_POD3

    BE_POD1 --> SQL
    BE_POD1 --> REDIS_SVC
    BE_POD1 --> BUCKET
    BE_POD1 --> SECRET

    WORKER_POD1 --> SQL
    WORKER_POD1 --> REDIS_SVC
    WORKER_POD2 --> SQL
    WORKER_POD2 --> REDIS_SVC

    BE_POD1 --> PROXY_POD

    style INGRESS fill:#4285F4,stroke:#333,stroke-width:2px,color:#fff
    style BE_SVC fill:#339933,stroke:#333,stroke-width:2px,color:#fff
    style SQL fill:#4169E1,stroke:#333,stroke-width:2px,color:#fff
    style REDIS_SVC fill:#DC382D,stroke:#333,stroke-width:2px,color:#fff
```

---

## 6. Entity-Relationship Diagram (Conceptual)

```mermaid
erDiagram
    USER ||--o{ SCAN_RESULT : creates
    USER ||--|| ORGANIZATION : belongs_to
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ API_KEY : owns

    ORGANIZATION ||--|| SUBSCRIPTION_TIER : has
    ORGANIZATION ||--o{ USER : contains

    SCAN_RESULT ||--o{ RISK_CATEGORY : contains
    SCAN_RESULT ||--o| AI_CONSENSUS : has
    SCAN_RESULT }o--o| THREAT_INDICATOR : matches

    THREAT_INDICATOR }o--|| THREAT_SOURCE : from
    THREAT_SOURCE ||--o{ SOURCE_SYNC_LOG : logs

    AI_CONSENSUS ||--o{ AI_MODEL_RESPONSE : aggregates

    AUDIT_LOG }o--|| USER : tracked_by
    AUDIT_LOG }o--o| SCAN_RESULT : references

    USER {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        enum role
        uuid organization_id FK
        timestamp created_at
    }

    ORGANIZATION {
        uuid id PK
        string name
        uuid tier_id FK
        timestamp created_at
    }

    SCAN_RESULT {
        uuid id PK
        string url
        enum scan_type
        int total_risk_score
        enum risk_level
        uuid user_id FK
        timestamp scanned_at
    }

    RISK_CATEGORY {
        uuid id PK
        uuid scan_id FK
        string category_name
        int score
        json details
    }

    AI_CONSENSUS {
        uuid id PK
        uuid scan_id FK
        float confidence_score
        json verdict
        timestamp analyzed_at
    }

    THREAT_INDICATOR {
        uuid id PK
        string indicator_value
        enum indicator_type
        uuid source_id FK
        timestamp last_seen
    }

    THREAT_SOURCE {
        uuid id PK
        string name
        string api_endpoint
        bool enabled
        timestamp last_synced
    }
```

---

## 7. Summary

This document provides comprehensive use case and data flow diagrams for the Elara Platform, covering:

✅ **Use Case Diagrams**: System-level and detailed use cases for all actors
✅ **Data Flow Diagrams**: Level 0, 1, and 2 DFDs showing data flow through the system
✅ **Sequence Diagrams**: End-to-end flows for critical operations
✅ **State Diagrams**: State machines for scan results and user sessions
✅ **Component Diagrams**: System component interactions and deployment architecture
✅ **ERD**: Conceptual entity-relationship model

---

## Additional Diagrams

For additional architecture diagrams, see:

- [High-Level Design (HLD)](high-level-design.md)
- [Low-Level Design (LLD)](low-level-design.md) _(To be created)_
- [Solution Architecture Diagram (SAD)](solution-architecture.md) _(To be created)_
- [GCP Deployment Blueprint](gcp-deployment-blueprint.md)
- [Prisma ORM Architecture](prisma-orm-architecture.md)

---

<div align="center">

**Elara Platform - Use Case & Data Flow Diagrams**
Version 1.0.0 | Status: ✅ Production Ready

[⬆ Back to Top](#elara-platform---use-case--data-flow-diagrams)

</div>
