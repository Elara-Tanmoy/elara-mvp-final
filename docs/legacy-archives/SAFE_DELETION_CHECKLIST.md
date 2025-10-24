# Safe Production Deletion Checklist

**Use this checklist to safely delete Cloud SQL replicas and save $1,800/month**

Print this page and check off each step as you complete it.

---

## Phase 1: Pre-Flight Verification (15 minutes)

### Prerequisites
- [ ] PowerShell 7+ installed (`$PSVersionTable.PSVersion`)
- [ ] gcloud SDK authenticated (`gcloud auth list`)
- [ ] kubectl working (`kubectl version --client`)
- [ ] 10 GB free disk space (`Get-PSDrive D`)
- [ ] 45-60 minutes available (uninterrupted)
- [ ] Test project name chosen: `____________________`
- [ ] Strong passphrase ready: `____________________`

### Production Health Check
- [ ] Production is currently running normally
- [ ] No active incidents or issues
- [ ] All services responding
- [ ] Recent backups exist (check Cloud SQL backups)

**If all checked → Proceed to Phase 2**

---

## Phase 2: Comprehensive Test (45-60 minutes)

### Create Test Project

- [ ] **Option A:** Create via console (https://console.cloud.google.com/)
  - Project name: `____________________`
  - Billing enabled: Yes

- [ ] **Option B:** Create via command
  ```powershell
  gcloud projects create your-test-project-name
  ```

### Run Comprehensive Test

```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts

$passphrase = ConvertTo-SecureString "YourPassphrase" -AsPlainText -Force

.\test-snapshot-restore-complete.ps1 `
  -ProductionProject "elara-mvp-13082025-u1" `
  -TestProject "your-test-project-name" `
  -EncryptionPassphrase $passphrase `
  -OutputDir "D:\Elara_Test_Results"
```

- [ ] Test started at: `____:____ AM/PM`
- [ ] Test completed at: `____:____ AM/PM`
- [ ] Total duration: `______` minutes

### Review Test Results

- [ ] Total Tests: `______`
- [ ] Passed: `______`
- [ ] Failed: `______`
- [ ] Warnings: `______`

- [ ] **Final Verdict:** ✅ PASS  or  ❌ FAIL  (circle one)

- [ ] Detailed report reviewed: `test-report-*.md`
- [ ] Test evidence saved to: `D:\Elara_Test_Results`

### Critical Checks (ALL must be checked)

- [ ] ✅ Snapshot Creation - PASS
- [ ] ✅ Database Dump - PASS
- [ ] ✅ Kubernetes Manifests - PASS
- [ ] ✅ Snapshot Restore - PASS
- [ ] ✅ Test Database Connectivity - PASS
- [ ] ✅ Database Schema Match - PASS

**If all critical checks PASS → Proceed to Phase 3**
**If ANY critical check FAILS → STOP! Fix issues before proceeding**

### Cleanup Test Project

- [ ] Test project deleted (to avoid costs)
  ```powershell
  gcloud projects delete your-test-project-name
  ```

**Test completed and verified: Date `__/__/____` Time `____:____`**

---

## Phase 3: Create Production Snapshot (5-10 minutes)

### Before ANY Changes to Production

```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts

$passphrase = ConvertTo-SecureString "YourPassphrase" -AsPlainText -Force

.\create-snapshot.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Region "us-west1" `
  -Tag "certified-pre-optimization-$(Get-Date -Format 'yyyyMMdd')" `
  -EncryptionPassphrase $passphrase
```

- [ ] Snapshot started at: `____:____ AM/PM`
- [ ] Snapshot completed at: `____:____ AM/PM`
- [ ] Snapshot location: `D:\Elara_Snapshots\elara-__________`
- [ ] Snapshot size: `______` MB

### Verify Snapshot

- [ ] `metadata.json` exists
- [ ] `database/cloudsql-dump.sql` exists
- [ ] `kubernetes/` directory has files
- [ ] `scripts/restore-elara-snapshot.ps1` exists
- [ ] `checksums.sha256` exists

### Store Snapshot Safely

```powershell
# Upload to Cloud Storage
gsutil -m cp -r D:\Elara_Snapshots\elara-* gs://elara-disaster-recovery/snapshots/
```

- [ ] Uploaded to Cloud Storage
- [ ] Copied to external drive (optional): `E:\______`
- [ ] Encryption passphrase stored securely

**Snapshot verified: Date `__/__/____` Time `____:____`**

---

## Phase 4: Delete Cloud SQL Replicas (10 minutes)

### Pre-Deletion Checklist

- [ ] ✅ Test PASSED (Phase 2)
- [ ] ✅ Production snapshot created (Phase 3)
- [ ] ✅ Snapshot stored in multiple locations
- [ ] ✅ Encryption passphrase saved securely
- [ ] ✅ No active production incidents
- [ ] ✅ Change window scheduled (low-traffic time)

### Record Current State

```powershell
# List current instances
gcloud sql instances list --project=elara-mvp-13082025-u1
```

**Current Cloud SQL instances:**
- [ ] Primary: `elara-postgres-primary` (Status: `________`)
- [ ] Replica 1: `elara-postgres-replica-1` (Status: `________`)
- [ ] Replica 2: `elara-postgres-replica-2-dr` (Status: `________`)

**Monthly cost BEFORE:** $2,100

### Delete Replica 1

```powershell
gcloud sql instances delete elara-postgres-replica-1 \
  --project=elara-mvp-13082025-u1 \
  --quiet
```

- [ ] Deletion command executed
- [ ] Deletion completed
- [ ] Verified deleted: `gcloud sql instances list`
- [ ] Time: `____:____ AM/PM`

**Savings: $700/month**

### Delete Replica 2 (DR)

```powershell
gcloud sql instances delete elara-postgres-replica-2-dr \
  --project=elara-mvp-13082025-u1 \
  --quiet
```

- [ ] Deletion command executed
- [ ] Deletion completed
- [ ] Verified deleted: `gcloud sql instances list`
- [ ] Time: `____:____ AM/PM`

**Savings: $1,400/month (cumulative)**

### Verify Production Still Works

```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts
.\validate-environment.ps1 -Project "elara-mvp-13082025-u1"
```

- [ ] All validation checks PASS
- [ ] Frontend accessible
- [ ] Backend API responding
- [ ] Database connectivity OK
- [ ] No errors in logs

**Replicas deleted successfully: Date `__/__/____` Time `____:____`**

---

## Phase 5: Downsize Primary Instance (10 minutes)

### Current Primary Configuration

```powershell
gcloud sql instances describe elara-postgres-primary --project=elara-mvp-13082025-u1
```

**Before:**
- Tier: `db-custom-8-32768` (8 vCPU, 32 GB)
- Storage: `500` GB
- Monthly cost: $700

### Downsize Primary

```powershell
# Conservative downsize (recommended)
gcloud sql instances patch elara-postgres-primary \
  --tier=db-custom-2-7680 \
  --storage-size=100GB \
  --project=elara-mvp-13082025-u1
```

- [ ] Downsize command executed
- [ ] Downsize completed (takes 5-10 minutes)
- [ ] Time: `____:____ AM/PM`

**After:**
- Tier: `db-custom-2-7680` (2 vCPU, 7.5 GB)
- Storage: `100` GB
- Monthly cost: $300

**Additional savings: $400/month**
**Total savings: $1,800/month**

### Verify Production After Downsize

```powershell
.\validate-environment.ps1 -Project "elara-mvp-13082025-u1"
```

- [ ] All validation checks PASS
- [ ] Application responsive
- [ ] No performance degradation
- [ ] No errors

**Primary downsized successfully: Date `__/__/____` Time `____:____`**

---

## Phase 6: Monitor & Validate (24 hours)

### Immediate Checks (First Hour)

- [ ] Hour 1: Application accessible
- [ ] Hour 1: No errors in logs
- [ ] Hour 1: Database queries fast (<100ms)
- [ ] Hour 1: Users report no issues

### Extended Monitoring (24 Hours)

- [ ] Hour 4: Check Cloud Console metrics
  - CPU usage: `_____`% (should be <50%)
  - Memory usage: `_____`% (should be <70%)
  - Connection count: `_____` (should be <100)

- [ ] Hour 8: No performance issues reported

- [ ] Hour 24: Final health check
  ```powershell
  .\validate-environment.ps1 -Project "elara-mvp-13082025-u1"
  ```

### Performance Metrics

**Database Performance (Cloud Console):**
- [ ] CPU utilization: <50% average
- [ ] Memory utilization: <70% average
- [ ] Query latency: <100ms average
- [ ] Connection count: <100

**Application Performance:**
- [ ] API response time: <200ms
- [ ] Frontend load time: <2 seconds
- [ ] No timeout errors
- [ ] No database connection errors

**If ALL metrics good → Success!**
**If ANY metrics concerning → Consider upgrading tier**

---

## Phase 7: Create Post-Optimization Snapshot (5-10 minutes)

### After 24 Hours Stable

```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts

.\create-snapshot.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Tag "post-optimization-verified-$(Get-Date -Format 'yyyyMMdd')" `
  -EncryptionPassphrase $passphrase
```

- [ ] Post-optimization snapshot created
- [ ] Snapshot uploaded to Cloud Storage
- [ ] Both snapshots (pre & post) retained

**Optimization complete: Date `__/__/____` Time `____:____`**

---

## 📊 Final Summary

### Changes Made

**Before Optimization:**
- Cloud SQL instances: 3 (primary + 2 replicas)
- Primary tier: `db-custom-8-32768`
- Storage: `500` GB
- **Monthly cost: $2,100**

**After Optimization:**
- Cloud SQL instances: 1 (primary only)
- Primary tier: `db-custom-2-7680`
- Storage: `100` GB
- **Monthly cost: $300**

### Cost Savings

**Monthly savings:** $1,800
**Annual savings:** $21,600

**Breakdown:**
- Replica 1 deleted: $700/month
- Replica 2 deleted: $700/month
- Primary downsized: $400/month

### Verification

- [ ] Test PASSED with 0 failures
- [ ] Pre-optimization snapshot created
- [ ] Changes applied successfully
- [ ] 24-hour monitoring completed
- [ ] Post-optimization snapshot created
- [ ] Application stable and performant

### Recovery Plan

**If anything goes wrong:**
```powershell
cd D:\Elara_Snapshots\elara-*-pre-optimization\scripts
.\restore-elara-snapshot.ps1 -Project "elara-mvp-13082025-u1" -Emergency
```

**Recovery time:** 15-20 minutes

---

## ✅ Completion Certificate

```
╔═══════════════════════════════════════════════════════════════╗
║          ELARA CLOUD SQL OPTIMIZATION CERTIFICATE             ║
╚═══════════════════════════════════════════════════════════════╝

Completed By:    ______________________
Date:            ____ / ____ / ________
Project:         elara-mvp-13082025-u1

CHANGES COMPLETED:
✅ Comprehensive test performed (PASSED)
✅ Production snapshot created (verified)
✅ Cloud SQL replica 1 deleted
✅ Cloud SQL replica 2 deleted
✅ Cloud SQL primary downsized
✅ 24-hour monitoring completed
✅ Application stable and performant

COST SAVINGS:
Monthly:  $1,800
Annual:   $21,600

SAFETY MEASURES:
✅ Snapshot tested and verified
✅ Pre-optimization snapshot stored
✅ Post-optimization snapshot stored
✅ Recovery procedure documented

RECOVERY GUARANTEE:
Restore from snapshot in 15-20 minutes if needed.

═══════════════════════════════════════════════════════════════
This certification confirms that Cloud SQL optimization was
completed successfully with full backup and recovery capability.
```

---

## 🎉 Congratulations!

**You have successfully:**
- ✅ Verified snapshot/restore works 100%
- ✅ Created production backup
- ✅ Deleted Cloud SQL replicas safely
- ✅ Downsized primary instance
- ✅ Saved $1,800/month ($21,600/year)
- ✅ Maintained full recovery capability

**Your infrastructure is now:**
- 💰 More cost-effective (53% reduction)
- 🛡️ Equally safe (backup + restore tested)
- ⚡ Right-sized for your workload
- 📈 Ready to scale when needed (upgrade in 5 min)

---

**Keep this checklist for your records!**

**Signed:** __________________ Date: ____/____/____
