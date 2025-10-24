# Database Synchronization Architecture

## Overview

Elara implements real-time production-to-staging database synchronization to enable QA and development teams to test with production user data while maintaining isolation.

## Architecture

### Dual-Database Write Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER REGISTRATION FLOW                         │
└──────────────────────────────────────────────────────────────────┘

User Registration Request (POST /api/v2/auth/register)
    ↓
Backend API (auth.controller.ts:21-147)
    ↓
┌───────────────────────────────────────┐
│ 1. Create Organization in Production │
│    - Generate API key                 │
│    - Hash API secret                  │
└───────────────┬───────────────────────┘
                ↓
┌───────────────────────────────────────┐
│ 2. Create User in Production          │
│    - Hash password                    │
│    - Link to organization             │
└───────────────┬───────────────────────┘
                ↓
┌───────────────────────────────────────┐
│ 3. Generate JWT Tokens                │
│    - Access token (30 min)            │
│    - Refresh token (7 days)           │
└───────────────┬───────────────────────┘
                ↓
┌──────────────────────────────────────────────────────┐
│ 4. Immediate Sync to Staging (Non-blocking)          │
│    syncRegistrationToStaging(user, organization)     │
│    ├─→ syncOrganizationToStaging() [FIRST]          │
│    └─→ syncUserToStaging() [SECOND]                  │
│                                                       │
│    On Error: Log but don't fail registration         │
└──────────────────────────────────────────────────────┘
                ↓
┌───────────────────────────────────────┐
│ 5. Create Audit Log                   │
└───────────────┬───────────────────────┘
                ↓
Return success response to user
```

## Implementation Details

### Backend Code

#### Database Configuration (`database.ts`)

```typescript
// Primary Prisma client (Production database)
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Staging Prisma client (Staging database)
export const prismaStaging = globalThis.prismaStagingGlobal ??
  prismaStagingClientSingleton();

// Staging client connects to STAGING_DATABASE_URL environment variable
const prismaStagingClientSingleton = () => {
  if (!process.env.STAGING_DATABASE_URL) {
    return null; // Skip if not configured
  }
  return new PrismaClient({
    datasources: {
      db: { url: process.env.STAGING_DATABASE_URL }
    }
  });
};
```

#### Sync Utility (`database-sync.ts`)

**Key Functions:**

1. **`syncOrganizationToStaging(org)`**
   - Upserts organization to staging
   - Uses `ON CONFLICT (id) DO UPDATE`
   - Non-blocking error handling

2. **`syncUserToStaging(user)`**
   - Upserts user to staging
   - Preserves all user fields including password hash
   - Non-blocking error handling

3. **`syncRegistrationToStaging(user, organization)`**
   - Orchestrates sync in correct order
   - Organization FIRST (parent table)
   - User SECOND (child table with FK)
   - Catches errors without affecting production

#### Registration Controller (`auth.controller.ts:77-105`)

```typescript
// Sync to staging database immediately (non-blocking)
syncRegistrationToStaging(
  {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  },
  {
    id: organization.id,
    name: organization.name,
    tier: organization.tier,
    apiKey: organization.apiKey,
    apiSecret: organization.apiSecret,
    isActive: organization.isActive,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt
  }
).catch(err => {
  // Don't fail registration if staging sync fails
  logger.error(`[Registration] Staging sync failed but continuing: ${err.message}`);
});
```

### Kubernetes CronJob

**File**: `kubernetes/jobs/user-sync-cronjob.yaml`

**Purpose**: Periodic backup sync every 5 minutes to catch any missed immediate syncs.

**Schedule**: `*/5 * * * *` (every 5 minutes)

**Implementation**:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sync-users-prod-to-staging
  namespace: default
spec:
  schedule: "*/5 * * * *"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  concurrencyPolicy: Forbid  # Prevent overlapping runs
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: user-sync
            image: postgres:15-alpine
            command: ["/bin/sh", "-c"]
            args:
              - |
                # Sync Organization FIRST (parent table)
                psql "$PROD_DB" -c "
                  COPY (SELECT * FROM \"Organization\") TO STDOUT
                " | psql "$STAGING_DB" -c "
                  CREATE TEMP TABLE org_temp (LIKE \"Organization\" INCLUDING ALL);
                  COPY org_temp FROM STDIN;
                  INSERT INTO \"Organization\"
                  SELECT * FROM org_temp
                  ON CONFLICT (id) DO NOTHING;
                "

                # Then sync User table (child table)
                psql "$PROD_DB" -c "
                  COPY (SELECT * FROM \"User\") TO STDOUT
                " | psql "$STAGING_DB" -c "
                  CREATE TEMP TABLE user_temp (LIKE \"User\" INCLUDING ALL);
                  COPY user_temp FROM STDIN;
                  INSERT INTO \"User\"
                  SELECT * FROM user_temp
                  ON CONFLICT (id) DO NOTHING;
                "
            env:
            - name: PROD_DB
              value: "postgresql://elara_app:PASSWORD@10.190.1.5:5432/elara_production"
            - name: STAGING_DB
              value: "postgresql://elara_app:PASSWORD@10.190.1.5:5432/elara_staging"
```

## Database Schema

### Tables Synced

**1. Organization Table**
- Primary Key: `id` (UUID)
- Columns: name, tier, apiKey, apiSecret, isActive, createdAt, updatedAt

**2. User Table**
- Primary Key: `id` (UUID)
- Foreign Key: `organizationId` → Organization(id)
- Columns: email, passwordHash, firstName, lastName, role, isActive, emailVerified, lastLoginAt, createdAt, updatedAt

### Foreign Key Constraints

**Critical**: Must sync in correct order:
1. **Organization** (parent) FIRST
2. **User** (child) SECOND

Violating this order causes FK constraint errors.

## Environment Configuration

### Production Backend Deployment

**Kubernetes Secret**: `elara-secrets` (namespace: `elara-backend`)

```bash
# Add staging database URL to secrets
kubectl create secret generic elara-secrets \
  --from-literal=staging-database-url='postgresql://elara_app:PASSWORD@10.190.1.5:5432/elara_staging' \
  -n elara-backend
```

**Deployment Environment Variable**:
```yaml
env:
- name: STAGING_DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: elara-secrets
      key: staging-database-url
```

## Monitoring & Observability

### Logs

**Immediate Sync Logs** (Backend):
```
[DB Sync] Starting immediate sync for registration: user@example.com
[DB Sync] ✓ Organization synced to staging: Acme Corp
[DB Sync] ✓ User synced to staging: user@example.com
[DB Sync] ✓ Registration sync completed for: user@example.com
```

**CronJob Logs**:
```bash
# View latest sync job logs
kubectl logs -n default -l job-name=sync-users-prod-to-staging-<timestamp>

# Expected output:
Starting user sync from production to staging...
COPY 7    # 7 organizations synced
INSERT 0  # 0 new (all existed)
COPY 7    # 7 users synced
INSERT 0  # 0 new (all existed)
Sync completed successfully!
Production users: 7
Staging users: 7
```

### Metrics

Track via Cloud Monitoring:
- Sync success rate
- Sync latency
- Failed sync count
- Staging database lag

## Error Handling

### Immediate Sync Failures

**Behavior**: Production registration proceeds successfully even if staging sync fails.

**Error Cases**:
1. **Staging database unreachable** → Logged, registration succeeds
2. **FK constraint violation** → Logged, registration succeeds
3. **Network timeout** → Logged, registration succeeds

**Recovery**: CronJob will catch missed users in next run (max 5 minutes).

### CronJob Failures

**Behavior**: Job retries with `restartPolicy: OnFailure`

**Error Cases**:
1. **Connection failure** → Retry
2. **SQL syntax error** → Manual fix required
3. **Timeout** → Increase timeout in job spec

**Alerting**: Monitor failed jobs via Cloud Monitoring.

## Security Considerations

### Password Handling

✅ **Password hashes are synced**, not plain passwords
✅ Same hash in production and staging → users can login to both with same credentials
✅ No password decryption occurs

### Data Privacy

⚠️ **Production data in staging**
- Staging environment must have same security controls as production
- Access to staging should be restricted
- Compliance: Ensure GDPR/HIPAA requirements met

### Network Security

✅ **Private IP only** - Both databases on same Cloud SQL instance (10.190.1.5)
✅ **No public internet** - All traffic stays within VPC
✅ **Encrypted in transit** - PostgreSQL TLS connections

## Performance Impact

### Immediate Sync

- **Latency added to registration**: ~50-100ms
- **Non-blocking**: User gets response before sync completes
- **Async pattern**: Fire-and-forget with error logging

### CronJob

- **Resource usage**: Minimal (PostgreSQL COPY is very efficient)
- **Execution time**: ~2-5 seconds for 1000 users
- **Database impact**: Read-only on production, write-only on staging

## Troubleshooting

### Users not syncing to staging

```bash
# 1. Check backend logs for sync errors
kubectl logs -n elara-backend -l app=elara-api | grep "DB Sync"

# 2. Verify STAGING_DATABASE_URL configured
kubectl get secret elara-secrets -n elara-backend -o jsonpath='{.data.staging-database-url}' | base64 -d

# 3. Test staging database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h 10.190.1.5 -U elara_app -d elara_staging -c "SELECT COUNT(*) FROM \"User\";"

# 4. Check CronJob status
kubectl get cronjobs -n default
kubectl get jobs -n default | grep sync-users
kubectl logs -n default -l job-name=sync-users-prod-to-staging-<latest>
```

### Foreign key constraint errors

**Symptom**: `ERROR: insert or update on table "User" violates foreign key constraint`

**Cause**: Syncing User before Organization

**Fix**: Ensure Organization syncs FIRST in both immediate sync and CronJob

### Sync lag exceeding 5 minutes

**Causes**:
1. CronJob not running → Check `kubectl get cronjobs`
2. Immediate sync consistently failing → Check backend logs
3. Database performance issue → Check Cloud SQL metrics

## Future Enhancements

### Planned

- [ ] Selective sync (specific organizations/users)
- [ ] Bi-directional sync (staging → production for test data)
- [ ] Sync other tables (ScanResult, AuditLog, etc.)
- [ ] Real-time sync via database triggers (pglogical)
- [ ] Sync metrics dashboard

### Under Consideration

- [ ] Anonymous/redacted sync option (hash PII)
- [ ] Sync to dev environment
- [ ] Cross-region sync for DR

## References

- Backend implementation: `elara-platform/packages/backend/src/utils/database-sync.ts`
- Controller integration: `elara-platform/packages/backend/src/controllers/auth.controller.ts`
- CronJob manifest: `gcp-infrastructure/kubernetes/jobs/user-sync-cronjob.yaml`
- Database config: `elara-platform/packages/backend/src/config/database.ts`

---

**Last Updated**: 2025-10-15
**Status**: PRODUCTION
**Maintainer**: DevOps Team
