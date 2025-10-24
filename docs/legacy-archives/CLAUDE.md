# CLAUDE AI ORCHESTRATION SYSTEM

**Elara Platform Multi-Agent Development System**

Version: 1.0.0
Last Updated: 2025-10-18

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Agent Architecture](#agent-architecture)
4. [Usage Patterns](#usage-patterns)
5. [Command Reference](#command-reference)
6. [Development Workflows](#development-workflows)
7. [Deployment Procedures](#deployment-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Features](#advanced-features)

---

## Overview

This orchestration system enables **multi-agent AI collaboration** for Elara Platform development. It provides:

- **Specialized AI Agents**: 8 agents with distinct responsibilities
- **State Management**: SQLite database tracking all operations
- **Crash Recovery**: Automatic rollback and checkpoint restoration
- **GCP Integration**: Direct deployment to Google Cloud Platform
- **Knowledge Base**: Comprehensive repository documentation

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROJECT DIRECTOR (@pd)                      │
│                   Master AI Orchestrator                        │
│          Routes tasks, makes architectural decisions            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌────────────────┐        ┌───────────────────┐
│   APP LEAD     │        │   INFRA LEAD      │
│   (@app-lead)  │        │   (@infra-lead)   │
│                │        │                   │
│ Code, Features │        │ Deploy, GCP, CI   │
└────────┬───────┘        └─────────┬─────────┘
         │                          │
    ┌────┴─────┬──────┬──────┐    │
    ▼          ▼      ▼      ▼    ▼
┌─────────┐ ┌────┐ ┌───┐ ┌─────┐ ┌────────┐
│ Planner │ │Dev │ │QA │ │Rev  │ │Security│
└─────────┘ └────┘ └───┘ └─────┘ └────────┘
```

---

## Quick Start

### 1. Bootstrap the System

```bash
cd D:/Elara_MVP/elara-platform
bash .agent_state/bootstrap.sh
```

This will:
- Verify all directories and documentation
- Initialize the SQLite state database
- Check GCP connection
- List all configured agents

### 2. Verify Setup

```bash
# Check agent configurations
ls -la .claude/agents/

# View repository atlas
cat .claude/memory/00_REPO_ATLAS.md

# Check state database
ls -la .agent_state/live/current.db
```

### 3. First Command

In your Claude Code session, try:

```
@pd status
```

This will activate the Project Director and show current platform status.

---

## Agent Architecture

### Master Agent

#### **@Project-Director** (alias: `@pd`)

**Role:** Strategic orchestrator for all Elara Platform development

**Capabilities:**
- Analyze feature requests and break into sub-tasks
- Route to App Lead (code) or Infra Lead (infrastructure)
- Make architectural decisions for 570-point scan system
- Coordinate AI consensus optimization (Claude/GPT/Gemini)
- Oversee GCP/GKE deployment strategy

**Memory Access:**
- 00_REPO_ATLAS.md (complete file inventory)
- ARCHITECTURE.md (system architecture)
- SECURITY_STANDARDS.md (security policies)
- CI_PIPELINES.md (deployment workflows)

**Example Commands:**
```
@pd feature: add cryptocurrency wallet scanning
@pd bug: scan console not showing real-time logs
@pd deploy: latest backend to GCP dev environment
@pd analyze: why AI consensus is giving low confidence
```

---

### Lead Agents

#### **@App-Lead**

**Role:** Application development coordinator

**Capabilities:**
- Implement new scan categories (Stage 1)
- Add threat intelligence sources (Stage 2)
- Optimize AI consensus logic (Stage 4)
- Build admin panel features
- Coordinate with specialists for code changes

**Delegates To:**
- @Planner → Task breakdown
- @Developer → Implementation
- @Reviewer → Code review
- @QA-Tester → Testing
- @Security → Security analysis

**Example Commands:**
```
@app-lead implement: SSL certificate validation in Stage 1
@app-lead optimize: reduce scan latency from 8s to 5s
@app-lead refactor: modularize threat intelligence adapters
```

---

#### **@Infra-Lead**

**Role:** Infrastructure and DevOps coordinator

**Capabilities:**
- Deploy to GCP (dev/staging/prod)
- Manage Kubernetes deployments
- Configure Cloud Build pipelines
- Monitor GKE clusters
- Handle database migrations on Cloud SQL

**Delegates To:**
- @Security → Security scans before deployment
- @QA-Tester → Integration tests

**Example Commands:**
```
@infra-lead deploy dev
@infra-lead rollback prod to commit abc123
@infra-lead scale: increase backend replicas to 5
@infra-lead migrate: run Prisma migrations on Cloud SQL
```

---

### Specialist Agents

#### **@Planner**

**Role:** Task breakdown and planning

**Process:**
1. Analyze feature/bug request
2. Break into atomic tasks
3. Identify dependencies
4. Estimate complexity
5. Generate implementation plan

---

#### **@Developer**

**Role:** Code implementation

**Specializations:**
- Scan Engine (7 stages, 570 points)
- AI Consensus (Claude/GPT/Gemini)
- Admin Panel (React)
- REST API (Express)
- Database (Prisma/PostgreSQL)

---

#### **@Reviewer**

**Role:** Code review and quality assurance

**Checks:**
- Code style (ESLint, Prettier)
- TypeScript types
- Error handling
- Performance implications
- Security vulnerabilities

---

#### **@QA-Tester**

**Role:** Testing strategy and execution

**Responsibilities:**
- Write unit tests (Vitest)
- Write integration tests
- Test scan engine accuracy
- Validate admin panel workflows
- Performance testing

---

#### **@Security**

**Role:** Security analysis and hardening

**Focus Areas:**
- Input validation
- API key encryption
- SQL injection prevention
- XSS/CSRF protection
- Rate limiting
- Authentication/authorization

---

## Usage Patterns

### Pattern 1: New Feature Implementation

```
@pd feature: add phishing detection to Stage 1

→ Project Director analyzes request
→ Routes to @App-Lead
→ @App-Lead coordinates:
   1. @Planner: Create task breakdown
   2. @Developer: Implement PhishingCategory class
   3. @Reviewer: Review implementation
   4. @QA-Tester: Write tests
   5. @Security: Validate security
→ @Infra-Lead: Deploy to dev
```

### Pattern 2: Bug Fix

```
@pd bug: scan console shows blank logs

→ @Project-Director analyzes
→ Routes to @App-Lead
→ @Developer: Investigate scanLogger service
→ @Developer: Fix WebSocket integration
→ @Reviewer: Verify fix
→ @Infra-Lead: Deploy to dev
```

### Pattern 3: Infrastructure Change

```
@pd scale: backend to handle 100 req/sec

→ @Project-Director analyzes load requirements
→ Routes to @Infra-Lead
→ @Infra-Lead:
   1. Increase GKE replicas
   2. Configure horizontal pod autoscaling
   3. Optimize database connection pooling
→ @QA-Tester: Load testing
```

### Pattern 4: Security Hardening

```
@pd security: audit API key storage

→ @Project-Director routes to @Security
→ @Security:
   1. Review apiKeyEncryption service
   2. Check AES-256-GCM implementation
   3. Validate key rotation procedures
   4. Review access control
→ @Security: Generate security report
```

---

## Command Reference

### Project Director Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@pd status` | Show platform status | `@pd status` |
| `@pd feature: <description>` | Request new feature | `@pd feature: add dark mode` |
| `@pd bug: <description>` | Report bug | `@pd bug: login fails` |
| `@pd deploy: <env>` | Deploy to environment | `@pd deploy: staging` |
| `@pd analyze: <topic>` | Deep analysis | `@pd analyze: scan accuracy` |
| `@pd optimize: <target>` | Performance tuning | `@pd optimize: database queries` |

### App Lead Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@app-lead implement: <feature>` | Implement feature | `@app-lead implement: 2FA` |
| `@app-lead refactor: <component>` | Refactor code | `@app-lead refactor: scanner` |
| `@app-lead optimize: <metric>` | Optimize performance | `@app-lead optimize: latency` |

### Infra Lead Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@infra-lead deploy <env>` | Deploy to env | `@infra-lead deploy dev` |
| `@infra-lead rollback <env>` | Rollback deployment | `@infra-lead rollback prod` |
| `@infra-lead scale: <target>` | Scale resources | `@infra-lead scale: 5 replicas` |
| `@infra-lead migrate` | Run migrations | `@infra-lead migrate` |

---

## Development Workflows

### Workflow 1: Adding a New Scan Category

**Goal:** Add "Cryptocurrency Wallet Scanning" to Stage 1

**Steps:**

```
1. @pd feature: add cryptocurrency wallet scanning to Stage 1

2. Project Director creates plan:
   - New category: WalletAnalysisCategory
   - Points allocation: 25 points (out of 515 in Stage 1)
   - Detection methods: Bitcoin, Ethereum, Litecoin addresses

3. @Planner breaks down:
   Task 1: Create packages/backend/src/services/scanEngine/categories/walletAnalysis.category.ts
   Task 2: Add regex patterns for crypto wallet detection
   Task 3: Implement scoring logic (0-25 points)
   Task 4: Register in Stage1Orchestrator
   Task 5: Add unit tests
   Task 6: Update documentation

4. @Developer implements each task

5. @Reviewer checks code quality

6. @QA-Tester creates test suite:
   - Test Bitcoin address detection
   - Test Ethereum address detection
   - Test scoring accuracy

7. @Infra-Lead deploys to dev:
   - Build Docker image
   - Push to GCR
   - Deploy to GKE dev namespace
   - Run smoke tests
```

---

### Workflow 2: Fixing a Production Bug

**Scenario:** AI consensus multiplier stuck at 1.0x

**Steps:**

```
1. @pd bug: AI consensus multiplier always 1.0x in prod

2. @App-Lead investigates:
   - Check packages/backend/src/services/scanEngine/orchestrators/stage4-ai-consensus.orchestrator.ts
   - Review calculateConsensusMultiplier() logic

3. @Developer finds issue:
   - Bug in line 142: Math.max/min bounds inverted
   - Should be: Math.min(1.3, Math.max(0.7, multiplier))
   - Current: Math.max(1.3, Math.min(0.7, multiplier)) → always 1.3

4. @Developer fixes:
   - Correct the bounds logic
   - Add unit test to prevent regression

5. @Reviewer approves

6. @Infra-Lead emergency deploy:
   - Fast-track through dev environment
   - Deploy to staging
   - Verify fix with calibration scans
   - Deploy to prod
   - Monitor for 30 minutes
```

---

### Workflow 3: Database Schema Change

**Goal:** Add `aiModelResponse` field to `ScanResult` table

**Steps:**

```
1. @pd feature: store individual AI model responses in scan results

2. @Planner creates migration plan:
   Task 1: Update Prisma schema
   Task 2: Generate migration
   Task 3: Update Scanner to save responses
   Task 4: Update admin UI to display responses

3. @Developer updates schema:
   File: packages/backend/prisma/schema.prisma

   model ScanResult {
     // ... existing fields ...

     aiModelResponses Json? @db.Json  // NEW FIELD

     @@index([createdAt])
   }

4. @Developer generates migration:
   cd packages/backend
   pnpm prisma migrate dev --name add_ai_model_responses

5. @Developer updates Scanner:
   File: packages/backend/src/services/scanEngine/scanner.ts

   const result = {
     // ... existing fields ...
     aiModelResponses: {
       claude: stage4.models.claude,
       gpt4: stage4.models.gpt4,
       gemini: stage4.models.gemini
     }
   };

6. @QA-Tester verifies:
   - Run test scans
   - Check database has aiModelResponses populated
   - Verify admin UI displays correctly

7. @Infra-Lead deploys:
   - Run migration on Cloud SQL dev: kubectl exec -it <pod> -- pnpm prisma migrate deploy
   - Deploy backend
   - Run migration on Cloud SQL staging
   - Deploy to staging
   - Run migration on Cloud SQL prod
   - Deploy to prod
```

---

## Deployment Procedures

### Standard Deployment (Dev → Staging → Prod)

#### Deploy to Dev

```bash
# Trigger Cloud Build
git push origin develop

# Or use kubectl directly
kubectl set image deployment/elara-api \
  api=gcr.io/elara-mvp-13082025-u1/backend-api:dev-<commit-sha> \
  -n elara-backend-dev

# Wait for rollout
kubectl rollout status deployment/elara-api -n elara-backend-dev
```

#### Deploy to Staging

```bash
# Merge to staging branch
git checkout staging
git merge develop
git push origin staging

# Verify deployment
kubectl get pods -n elara-backend-staging
kubectl logs -n elara-backend-staging deployment/elara-api --tail=100
```

#### Deploy to Production

```bash
# Create release tag
git tag -a v1.2.3 -m "Release v1.2.3: Add wallet scanning"
git push origin v1.2.3

# This triggers production Cloud Build
# Monitor at: https://console.cloud.google.com/cloud-build

# Verify health
curl https://api.elara.com/health
```

---

### Emergency Rollback

```bash
# Find previous revision
kubectl rollout history deployment/elara-api -n elara-backend-prod

# Rollback
kubectl rollout undo deployment/elara-api -n elara-backend-prod

# Or rollback to specific revision
kubectl rollout undo deployment/elara-api -n elara-backend-prod --to-revision=5

# Verify
kubectl rollout status deployment/elara-api -n elara-backend-prod
```

---

### Database Migrations

#### Dev Environment

```bash
# Exec into pod
kubectl exec -it $(kubectl get pods -n elara-backend-dev -l app=elara-api -o jsonpath='{.items[0].metadata.name}') -n elara-backend-dev -- bash

# Run migration
cd /app/packages/backend
pnpm prisma migrate deploy

# Verify
pnpm prisma db pull
```

#### Production Environment

```bash
# IMPORTANT: Always test in dev and staging first!

# 1. Backup database
gcloud sql backups create --instance=elara-db-prod

# 2. Apply migration
kubectl exec -it <prod-pod> -n elara-backend-prod -- pnpm prisma migrate deploy

# 3. Verify
kubectl exec -it <prod-pod> -n elara-backend-prod -- pnpm prisma db pull

# 4. Monitor logs
kubectl logs -n elara-backend-prod deployment/elara-api --tail=200 -f
```

---

## Troubleshooting

### Issue 1: Agent Not Responding

**Symptoms:** `@pd status` does nothing

**Causes:**
- Agent YAML not loaded
- Memory files missing
- Syntax error in YAML

**Solution:**
```bash
# Verify YAML files
ls -la .claude/agents/

# Check for syntax errors
cat .claude/agents/project_director.yaml | head -20

# Re-run bootstrap
bash .agent_state/bootstrap.sh
```

---

### Issue 2: SQLite Database Locked

**Symptoms:** "Database is locked" error

**Solution:**
```bash
# Close all connections
rm .agent_state/live/current.db-wal
rm .agent_state/live/current.db-shm

# Reinitialize
node .agent_state/init_db.js
```

---

### Issue 3: Deployment Stuck

**Symptoms:** `kubectl rollout status` shows "Waiting for deployment..."

**Solution:**
```bash
# Check pod status
kubectl get pods -n elara-backend-dev

# Check pod logs
kubectl logs -n elara-backend-dev <pod-name>

# Check events
kubectl get events -n elara-backend-dev --sort-by='.lastTimestamp'

# If pod is CrashLoopBackOff, check logs:
kubectl logs -n elara-backend-dev <pod-name> --previous

# Force restart
kubectl rollout restart deployment/elara-api -n elara-backend-dev
```

---

### Issue 4: GCP Authentication Failed

**Symptoms:** "gcloud: command not found" or "Permission denied"

**Solution:**
```bash
# Install gcloud CLI
# Visit: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud config set project elara-mvp-13082025-u1

# Get Kubernetes credentials
gcloud container clusters get-credentials elara-gke-cluster \
  --region us-west1 \
  --project elara-mvp-13082025-u1

# Verify
kubectl cluster-info
```

---

## Advanced Features

### Feature 1: Crash Recovery

If an agent operation fails mid-execution:

```
1. Agent automatically creates checkpoint before starting
2. Saves checkpoint to .agent_state/checkpoints/<timestamp>.json
3. On crash, reads last checkpoint
4. Presents recovery options:
   - Resume from checkpoint
   - Rollback changes
   - Restart operation
```

**Manual Recovery:**
```bash
# List checkpoints
ls -lh .agent_state/checkpoints/

# View checkpoint
cat .agent_state/checkpoints/2025-10-18_14-30-00.json

# Rollback using saved script
bash .agent_state/rollback_scripts/rollback_2025-10-18_14-30-00.sh
```

---

### Feature 2: Session Management

Track all development sessions:

```sql
-- View active sessions
SELECT * FROM sessions WHERE status = 'active';

-- View session operations
SELECT o.* FROM operations o
JOIN sessions s ON o.session_id = s.session_id
WHERE s.session_id = 'session_1729266000000'
ORDER BY o.started_at DESC;

-- View file changes
SELECT * FROM file_changes
WHERE session_id = 'session_1729266000000';
```

---

### Feature 3: Agent Memory

Agents remember context across sessions:

```sql
-- Store agent knowledge
INSERT INTO agent_memory (agent_id, key, value)
VALUES ('@Project-Director', 'last_scan_optimization', '{"latency_ms": 4200, "date": "2025-10-18"}');

-- Retrieve agent memory
SELECT * FROM agent_memory
WHERE agent_id = '@Project-Director'
ORDER BY updated_at DESC;
```

---

### Feature 4: Deployment Tracking

Track all deployments:

```sql
-- View recent deployments
SELECT * FROM deployment_tracking
ORDER BY deployed_at DESC
LIMIT 10;

-- Check production health
SELECT environment, health_status, deployed_at
FROM deployment_tracking
WHERE environment = 'prod'
ORDER BY deployed_at DESC
LIMIT 1;
```

---

## System Files Reference

### Documentation (.claude/memory/)

| File | Purpose | Lines |
|------|---------|-------|
| `00_REPO_ATLAS.md` | Complete file inventory | ~800 |
| `ARCHITECTURE.md` | System architecture | ~11,000 |
| `SECURITY_STANDARDS.md` | Security policies | ~400 |
| `CI_PIPELINES.md` | Deployment workflows | ~300 |

### Agents (.claude/agents/)

| File | Agent | Lines |
|------|-------|-------|
| `project_director.yaml` | @Project-Director | ~520 |
| `app_lead.yaml` | @App-Lead | ~480 |
| `infra_lead.yaml` | @Infra-Lead | ~450 |
| `specialists/planner.yaml` | @Planner | ~380 |
| `specialists/developer.yaml` | @Developer | ~620 |
| `specialists/reviewer.yaml` | @Reviewer | ~420 |
| `specialists/qa_tester.yaml` | @QA-Tester | ~550 |
| `specialists/security.yaml` | @Security | ~530 |

### State Database (.agent_state/)

| File | Purpose |
|------|---------|
| `live/current.db` | Active session state |
| `init_db.sql` | Database schema |
| `init_db.js` | Node.js initializer |
| `bootstrap.sh` | System bootstrap |
| `checkpoints/*.json` | Operation checkpoints |
| `rollback_scripts/*.sh` | Rollback scripts |

---

## FAQ

**Q: Can I use multiple agents simultaneously?**
A: Yes! Agents can work in parallel. For example: `@app-lead implement: feature-A` and `@infra-lead deploy: dev` can run concurrently.

**Q: What happens if I make a typo in agent name?**
A: The system will suggest the closest matching agent. For example, `@project-dir` → "Did you mean @Project-Director?"

**Q: How do I add a custom agent?**
A: Create a new YAML file in `.claude/agents/` following the existing format. Add it to the bootstrap script verification.

**Q: Can agents access production database directly?**
A: No. All database access goes through the deployed backend API. Agents can trigger kubectl commands to exec into pods if needed.

**Q: How do I update agent capabilities?**
A: Edit the respective YAML file in `.claude/agents/`. Changes take effect immediately (no restart needed).

**Q: What if SQLite database is corrupted?**
A: Delete `.agent_state/live/current.db` and run `node .agent_state/init_db.js` to recreate it. Session history in checkpoints is preserved.

---

## Support & Contributing

**Issues:** Report issues in this conversation or create a checkpoint:
```
@pd checkpoint: describe the issue here
```

**Updates:** Check `.agent_state/CHANGELOG.md` for system updates

**Documentation:** All docs are in `.claude/memory/` - update as needed

---

## License

Elara Platform AI Orchestration System
Copyright © 2025 Elara AI

---

**Last Updated:** 2025-10-18
**Version:** 1.0.0
**Maintained by:** @Project-Director
