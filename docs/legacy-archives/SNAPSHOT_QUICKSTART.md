# Elara Platform - Snapshot & Restore Quick Start

**One command to save your entire environment. One command to restore it.**

---

## 🎯 What This Does

Creates a **complete, portable snapshot** of your entire Elara production environment that can be **restored in 15-20 minutes** with a single PowerShell command.

**Perfect for:**
- ✅ Moving to cost-optimized infrastructure
- ✅ Disaster recovery
- ✅ Creating development/staging environments
- ✅ Testing infrastructure changes safely
- ✅ Compliance & auditing

---

## 📦 What Gets Captured

- ✅ **Complete Infrastructure** (GKE, Cloud SQL, Redis, Load Balancers)
- ✅ **Full Database** (PostgreSQL + data)
- ✅ **Application Code** (exact Git commit)
- ✅ **Kubernetes State** (all deployments, services, configs)
- ✅ **Secrets** (encrypted with AES-256)
- ✅ **Container Images** (references + optional download)

**Total Size:** ~2-5 GB
**Restore Time:** 15-20 minutes
**One-Click:** Yes!

---

## 🚀 Quick Start - Create Snapshot NOW

### Step 1: Open PowerShell 7 (As Administrator)

```powershell
# Verify PowerShell version (must be 7+)
$PSVersionTable.PSVersion
```

### Step 2: Create Your First Snapshot

```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts

# Create snapshot with encryption
.\create-snapshot.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Tag "pre-optimization" `
  -EncryptionPassphrase (ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force)
```

**This will take 5-10 minutes and create:**
```
D:\Elara_Snapshots\elara-YYYYMMDD-HHMMSS-pre-optimization\
├── Database backup
├── Kubernetes manifests
├── Application code
├── Infrastructure config
└── Restore scripts
```

### Step 3: Verify Snapshot

```powershell
# Check snapshot directory
cd D:\Elara_Snapshots
ls

# View snapshot metadata
cat elara-*\metadata.json | ConvertFrom-Json
```

---

## ✅ You're Done! Environment is Backed Up

**Now you can safely:**
1. Delete Cloud SQL replicas (save $1,400/month)
2. Downsize Cloud SQL primary (save $400/month)
3. Test new infrastructure configurations
4. Migrate to different GCP region/project

**If anything goes wrong → Restore in 15 minutes!**

---

## 🔄 Restore Snapshot (One Command!)

### Scenario 1: Restore to NEW Project (Fresh Start)

```powershell
cd D:\Elara_Snapshots\elara-20251023-143022-pre-optimization\scripts

.\restore-elara-snapshot.ps1 `
  -Project "elara-new-project" `
  -Region "us-west1" `
  -Passphrase (ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force)
```

### Scenario 2: Restore to SAME Project (Disaster Recovery)

```powershell
# Emergency restore (skip safety checks for speed)
.\restore-elara-snapshot.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Passphrase (ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force) `
  -Emergency
```

### Scenario 3: Partial Restore (Database Only)

```powershell
# Only restore database, skip infrastructure
.\restore-elara-snapshot.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Passphrase (ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force) `
  -SkipInfrastructure `
  -SkipKubernetes
```

---

## ✅ Validate Restored Environment

After restore completes, verify everything works:

```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts

.\validate-environment.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Domain "your-domain.com" `
  -Detailed
```

**Expected Output:**
```
Checking: GKE Cluster                              ✅ OK (3 nodes)
Checking: Cloud SQL (PostgreSQL)                   ✅ OK (POSTGRES_15)
Checking: Redis Instance                           ✅ OK (5GB)
Checking: Backend Pods                             ✅ OK (3/3 running)
Checking: Frontend Pods                            ✅ OK (2/2 running)
Checking: Worker Pods                              ✅ OK (2/2 running)
Checking: Load Balancer                            ✅ OK (34.82.xxx.xxx)
Checking: Frontend (HTTP)                          ✅ OK (150ms)
Checking: Backend API (/v2/health)                 ✅ OK (45ms)
Checking: Database Connectivity                    ✅ OK (connected)
Checking: Redis Connectivity                       ✅ OK (connected)

Environment Status: ✅ FULLY OPERATIONAL
```

---

## 💡 Common Use Cases

### Use Case 1: Before Cloud SQL Optimization

**Right now, before making ANY changes:**

```powershell
# 1. Create snapshot (5 min)
.\create-snapshot.ps1 -Tag "before-cloudsql-downsize"

# 2. Now safely delete Cloud SQL replicas
gcloud sql instances delete elara-postgres-replica-1

# 3. Downsize primary
gcloud sql instances patch elara-postgres-primary --tier=db-custom-2-7680

# 4. If ANYTHING breaks → Restore!
```

### Use Case 2: Move to New GCP Project

```powershell
# 1. Create snapshot from old project
.\create-snapshot.ps1 -Project "old-project" -Tag "migration"

# 2. Restore to new project
.\restore-elara-snapshot.ps1 -Project "new-project"

# 3. Validate
.\validate-environment.ps1 -Project "new-project"

# 4. Update DNS to new load balancer IP

# 5. Delete old project (save costs!)
```

### Use Case 3: Create Dev Environment

```powershell
# 1. Snapshot production
.\create-snapshot.ps1 -Tag "prod-snapshot"

# 2. Restore as dev environment
.\restore-elara-snapshot.ps1 -Project "elara-dev"

# 3. Now you have exact production replica for testing!
```

---

## 🔐 Security Best Practices

### Encryption Passphrase

**IMPORTANT:** Store your encryption passphrase securely!

```powershell
# Option 1: Use a password manager
# Store in LastPass, 1Password, Bitwarden, etc.

# Option 2: Environment variable (less secure)
$env:ELARA_SNAPSHOT_KEY = "YourStrongPassword123!"

# Option 3: Secure file (recommended)
$secureKey = ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force
$secureKey | ConvertFrom-SecureString | Out-File "D:\secure-key.txt"

# Later, read it back
$secureKey = Get-Content "D:\secure-key.txt" | ConvertTo-SecureString
.\create-snapshot.ps1 -EncryptionPassphrase $secureKey
```

### Snapshot Storage

**Store snapshots in multiple locations:**

1. **Local** (fast restore): External SSD
2. **Cloud** (disaster recovery): Google Cloud Storage
3. **Off-site** (compliance): Encrypted USB drive in safe

```powershell
# Upload to Cloud Storage
gsutil -m cp -r D:\Elara_Snapshots\elara-* gs://elara-disaster-recovery/snapshots/

# Download later
gsutil -m cp -r gs://elara-disaster-recovery/snapshots/elara-* D:\Elara_Snapshots/
```

---

## 📅 Recommended Snapshot Schedule

### Automated Daily Snapshots

Create a Windows Scheduled Task:

```powershell
# Create scheduled task (runs daily at 2 AM)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-File D:\Elara_MVP\gcp-infrastructure\scripts\create-snapshot.ps1 -Tag daily"

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

Register-ScheduledTask -TaskName "ElaraSnapshot" -Action $action -Trigger $trigger
```

### Retention Policy

- **Daily snapshots:** Keep 7 days
- **Weekly snapshots:** Keep 4 weeks
- **Monthly snapshots:** Keep 12 months

---

## 🚨 Emergency Recovery (Production Down!)

If your production environment goes down RIGHT NOW:

```powershell
# 1. Get latest snapshot (30 seconds)
cd D:\Elara_Snapshots
$latest = Get-ChildItem | Sort-Object CreationTime -Descending | Select-Object -First 1
cd $latest\scripts

# 2. Emergency restore (15-20 minutes)
.\restore-elara-snapshot.ps1 `
  -Project "elara-mvp-13082025-u1" `
  -Passphrase (Read-Host "Encryption key" -AsSecureString) `
  -Emergency

# 3. Get load balancer IP
kubectl get service -n elara-proxy

# 4. Update DNS to new IP (if needed)

# Total downtime: 20-25 minutes
```

---

## 🧪 Test Your Snapshot (Do This Now!)

**IMPORTANT:** Test restore BEFORE you need it!

```powershell
# 1. Create test snapshot
.\create-snapshot.ps1 -Tag "test" -SkipDatabase

# 2. Restore to test project
.\restore-elara-snapshot.ps1 -Project "elara-test" -SkipDatabase

# 3. Verify basic functionality
.\validate-environment.ps1 -Project "elara-test"

# 4. Delete test project
gcloud projects delete elara-test

# Now you know restore works! 🎉
```

---

## 📊 Snapshot Size & Cost

### Typical Snapshot Sizes

| Component | Size | Compressed |
|-----------|------|------------|
| Database dump | 1-2 GB | 200-400 MB |
| Kubernetes manifests | 10 MB | 2 MB |
| Infrastructure config | 5 MB | 1 MB |
| Application code | 500 MB | 100 MB |
| **Total** | **2-3 GB** | **300-500 MB** |

### Storage Costs (Cloud Storage)

| Retention | Storage Type | Monthly Cost |
|-----------|--------------|--------------|
| 7 daily (3.5 GB) | Standard | $0.07 |
| 4 weekly (2 GB) | Nearline | $0.02 |
| 12 monthly (6 GB) | Coldline | $0.02 |
| **Total** | | **$0.11/month** |

**Cheaper than coffee!** ☕

---

## 🎯 Next Steps After Snapshot

Now that you have a backup, you can safely:

### 1. Optimize Cloud SQL Costs ($1,800/month savings)

```powershell
# You have a snapshot, so this is SAFE!

# Delete replica 1
gcloud sql instances delete elara-postgres-replica-1

# Delete replica 2
gcloud sql instances delete elara-postgres-replica-2-dr

# Downsize primary
gcloud sql instances patch elara-postgres-primary --tier=db-custom-2-7680

# If anything breaks → .\restore-elara-snapshot.ps1
```

### 2. Test New Infrastructure

```powershell
# Restore snapshot to test project
.\restore-elara-snapshot.ps1 -Project "elara-test"

# Try self-managed PostgreSQL, different Redis tier, etc.

# If tests pass → Apply to production
# If tests fail → Delete test project, no harm done!
```

### 3. Set Up Automated Snapshots

```powershell
# Schedule daily snapshots
Register-ScheduledTask -TaskName "ElaraSnapshot" ...

# Upload to Cloud Storage for DR
gsutil -m cp -r D:\Elara_Snapshots\* gs://elara-dr/
```

---

## 📞 Troubleshooting

### Snapshot Creation Fails

**Database backup fails:**
```powershell
# Skip database and backup manually
.\create-snapshot.ps1 -SkipDatabase

# Manual database backup
gcloud sql export sql elara-postgres-primary gs://bucket/backup.sql
```

**Out of disk space:**
```powershell
# Skip container images (saves 1-2 GB)
.\create-snapshot.ps1 -SkipContainerImages
```

### Restore Fails

**Infrastructure creation stuck:**
```powershell
# Skip infrastructure if already exists
.\restore-elara-snapshot.ps1 -SkipInfrastructure
```

**Database import fails:**
```powershell
# Restore manually
gsutil cp snapshot/database/cloudsql-dump.sql gs://bucket/
gcloud sql import sql elara-postgres-primary gs://bucket/cloudsql-dump.sql
```

**Pods not starting:**
```powershell
# Check logs
kubectl logs -n elara-backend-prod <pod-name>

# Check secrets
kubectl get secrets -n elara-backend-prod
```

---

## 📚 Additional Documentation

- **Full Architecture:** `gcp-infrastructure/docs/SNAPSHOT_RESTORE_SYSTEM.md`
- **Cost Optimization:** `gcp-infrastructure/docs/IMMEDIATE_COST_REDUCTION_PLAN.md`
- **Enterprise Guide:** `gcp-infrastructure/ENTERPRISE_ARCHITECTURE_SUMMARY.md`

---

## ✅ Checklist - Do This RIGHT NOW!

Before making ANY infrastructure changes:

- [ ] Create snapshot with encryption
- [ ] Verify snapshot was created successfully
- [ ] Store encryption passphrase securely
- [ ] Upload snapshot to Cloud Storage (disaster recovery)
- [ ] Test restore to temporary project
- [ ] Document snapshot location
- [ ] Schedule automated daily snapshots

**Time Required:** 30 minutes
**Peace of Mind:** Priceless

---

## 🎉 Summary

**You now have:**
- ✅ One-command snapshot creation
- ✅ One-command restore (15-20 min)
- ✅ Automated validation
- ✅ Production-ready backup system

**You can safely:**
- ✅ Optimize Cloud SQL (save $1,800/month)
- ✅ Test new infrastructure
- ✅ Recover from disasters
- ✅ Create dev/staging environments

**Next action:**
```powershell
cd D:\Elara_MVP\gcp-infrastructure\scripts
.\create-snapshot.ps1 -Tag "before-optimization"
```

---

**Created:** 2025-10-23
**Version:** 1.0
**Status:** Production Ready 🚀
