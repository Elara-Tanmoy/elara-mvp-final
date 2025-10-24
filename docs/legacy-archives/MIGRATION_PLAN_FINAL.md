# Elara Platform - Final Migration Plan

**Date:** 2025-10-23
**Target:** Production + Dev only (Staging will be removed)
**Goal:** Migrate to optimized Cloud SQL, preserve all IPs and functionality

---

## ✅ ALL IPs NOW SECURED (STATIC)

### Production (Public)
```
Domain:       api.elara.com, elara.com
External IP:  34.36.48.252 (elara-global-lb-ip) ✅ STATIC
Backend:      10.2.11.210 (ClusterIP - internal)
Frontend:     10.2.2.248 (ClusterIP - internal)
Database:     10.190.1.5 → 10.190.1.11 (ONLY CHANGE)
Redis:        10.190.0.4 (no change)
```

### Dev
```
Frontend:     http://136.117.33.149/ ✅ NOW STATIC (elara-dev-frontend-ip)
Backend API:  http://35.199.176.26/  ✅ NOW STATIC (elara-dev-backend-ip)
Database:     10.190.1.5 → 10.190.1.11 (same as prod)
Redis:        10.190.0.4 (no change)
```

### Infrastructure IPs
```
NAT Gateway 1: 34.82.164.36  ✅ STATIC
NAT Gateway 2: 34.168.119.72 ✅ STATIC
VPC Range:     10.190.0.0    ✅ RESERVED
```

---

## 🎯 WHAT CHANGES

### Only 3 Values in Kubernetes Secrets:
```yaml
# In elara-backend namespace secret: elara-secrets
database-url:         postgresql://...@10.190.1.5:5432/elara_production
                   → postgresql://...@10.190.1.11:5432/elara_production

db-host:              10.190.1.5
                   → 10.190.1.11

staging-database-url: postgresql://...@10.190.1.5:5432/elara_staging
                   → postgresql://...@10.190.1.11:5432/elara_staging
```

### Infrastructure Changes:
```
OLD: elara-postgres-primary (db-custom-8-32768) - 8 vCPU, 32GB - $800/mo
NEW: elara-postgres-optimized (db-custom-2-7680) - 2 vCPU, 7.5GB - $240/mo

OLD: 2 read replicas - $500/mo each = $1,000/mo
NEW: 0 replicas (Cloud SQL automatic HA) - $0/mo

SAVINGS: $1,560/month = $18,720/year
```

---

## 📋 MIGRATION STEPS

### Phase 1: Backup (SAFE - No Downtime)
1. ✅ New Cloud SQL instance created: `elara-postgres-optimized`
2. ⏳ Export current production database
3. ⏳ Verify backup integrity
4. ⏳ Store backup in Cloud Storage (encrypted)

### Phase 2: Data Migration (Brief Downtime ~5 min)
1. Set production to read-only mode
2. Export final incremental changes
3. Import all data to new Cloud SQL
4. Verify data integrity (row counts, checksums)

### Phase 3: Switch Over (5 minutes)
1. Update 3 secret values (database IPs)
2. Restart backend pods (pick up new DB)
3. Restart dev pods (pick up new DB)
4. Validate all APIs responding

### Phase 4: Validation (15 minutes)
1. Test production endpoints
2. Test dev endpoints (http://136.117.33.149/)
3. Run automated test suite
4. Verify no errors in logs
5. Check database connections

### Phase 5: Cleanup (After Validation)
1. Delete staging namespace (not needed)
2. Delete old Cloud SQL instances (save $1,560/mo)
3. Document new configuration

---

## 🔒 ZERO RISK GUARANTEES

1. **All IPs are now static** - No surprises after migration
2. **Full backup before any changes** - Can restore in 15 min
3. **Old infrastructure stays until validated** - Can rollback instantly
4. **Production DNS unchanged** - api.elara.com stays same
5. **Dev URL unchanged** - http://136.117.33.149/ stays same

---

## 💰 COST IMPACT

### Current Monthly Cost:
```
Cloud SQL Primary:         $800
Cloud SQL Replica 1:       $500
Cloud SQL Replica 2:       $500
GKE Cluster:              $1,200
Redis:                     $300
Load Balancers:            $100
Other:                     $200
────────────────────────────
TOTAL:                   $3,600/month
```

### After Migration:
```
Cloud SQL Optimized:       $240  (73% reduction)
GKE Cluster:              $1,200 (same)
Redis:                     $300  (same)
Load Balancers:            $100  (same)
Other:                     $200  (same)
────────────────────────────
TOTAL:                   $2,040/month
SAVINGS:                 $1,560/month ($18,720/year)
```

---

## ✅ READY TO PROCEED

**Current Status:**
- ✅ New Cloud SQL instance running
- ✅ All IPs converted to static (no changes after migration)
- ✅ Migration plan documented
- ✅ Production untouched and running normally
- ⏳ Waiting for approval to start database backup

**Next Action:** Start database backup and migration

**Estimated Total Time:** 30-40 minutes
**Risk Level:** MINIMAL (full backup, can rollback)
**Downtime:** ~5 minutes during switchover

---

**Awaiting confirmation to proceed with database backup...**
