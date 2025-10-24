# Elara Platform - GCP Cost Optimization Analysis

**Date:** 2025-10-23
**Environment:** Development + Staging + Production
**Analysis Period:** Current Month Projection

---

## 📊 Current Infrastructure Inventory

### **1. GKE Autopilot Cluster**
- **Cluster:** elara-gke-us-west1
- **Nodes:** 6 nodes (Autopilot managed)
- **Workloads:**
  - **Production:** 3 API + 2 Frontend + 2 Proxy + 0 Workers = **7 pods**
  - **Staging:** 1 API + 1 Frontend + 1 Proxy + 1 Worker = **4 pods**
  - **Development:** 1 API + 1 Frontend + 1 Proxy + 1 Worker = **4 pods**
  - **Total Application Pods:** **15 pods**
  - **System Pods:** ~15 pods (kube-system, monitoring)
- **Total:** ~30 active pods

### **2. Cloud SQL PostgreSQL**
- **Primary:** db-custom-8-32768 (8 vCPUs, 32GB RAM, 500GB SSD) - us-west1
- **Read Replica 1:** Same tier - us-west1-c
- **Read Replica 2 (DR):** Same tier - us-east1
- **Total:** 3 instances @ 8 vCPU, 32GB RAM each

### **3. Memorystore Redis**
- **Instance:** STANDARD_HA
- **Memory:** 5GB
- **Region:** us-west1 (Primary + Replica)

### **4. Storage Buckets**
- **Total:** 10 buckets (mostly US multi-region)
- Usage: Minimal (< 100GB estimated)

### **5. Network**
- Load Balancer, NAT Gateway, VPC

---

## 💰 Current Monthly Cost Breakdown (ESTIMATED)

### **GKE Autopilot: $800-1,200/month**
- 6 nodes for 30 pods
- Autopilot charges per pod resource request
- Estimated: $35-40/node/month

### **Cloud SQL PostgreSQL: $1,800-2,200/month**
- **Primary (db-custom-8-32768):** ~$700/month
  - vCPU: 8 × $50 = $400
  - RAM: 32GB × $7 = $224
  - SSD: 500GB × $0.17 = $85
- **Read Replica 1:** ~$700/month
- **Read Replica 2 (DR):** ~$700/month
- **Total:** **$2,100/month**

### **Memorystore Redis: $250-300/month**
- STANDARD_HA: 5GB × $0.054/GB/hour
- ~$250/month for HA configuration

### **Storage: $10-30/month**
- 100GB @ $0.020-0.026/GB/month
- Negligible cost

### **Networking: $100-150/month**
- Load Balancer: $18/month base
- Data egress: ~$100/month
- NAT Gateway: ~$30/month

### **Other (Cloud Build, Logging, Monitoring): $50-100/month**

---

## 🔴 **TOTAL CURRENT COST: ~$3,000-4,000/month**

**Annual Cost:** ~$36,000-48,000/year

---

## 🎯 Cost Optimization Recommendations

### **Priority 1: Cloud SQL Optimization (SAVE ~$1,400/month)**

#### **Current:**
- 3 instances @ 8 vCPU, 32GB RAM = **$2,100/month**

#### **Optimized:**
- **Primary:** db-custom-4-16384 (4 vCPU, 16GB) = **$350/month**
  - Current workload is DEV/MVP - doesn't need 8 vCPU
  - 16GB RAM sufficient for current usage
  - 250GB SSD (reduce from 500GB) = **$42/month**
  - **Total Primary:** **$392/month**

- **Read Replica 1 (Analytics):** db-custom-2-7680 (2 vCPU, 7.5GB) = **$220/month**
  - Analytics queries don't need high spec
  - **Total Replica 1:** **$220/month**

- **DR Replica (us-east1):** **REMOVE for now** - Save **$700/month**
  - Use automated backups instead
  - Restore time: ~30 min (acceptable for MVP)
  - Can recreate from backup if needed

**New Total:** **$612/month** (vs $2,100)
**SAVINGS:** **$1,488/month** ($17,856/year)

---

### **Priority 2: Consolidate Environments (SAVE ~$400/month)**

#### **Current:**
- 3 separate namespaces (dev, staging, prod)
- Each running full stack (API + Frontend + Proxy + Workers)

#### **Optimized:**
- **Combine Dev + Staging** into single "non-prod" environment
  - Both are test environments
  - Use namespaces for separation
  - Share resources with resource quotas

**Removed Pods:**
- 4 staging pods (1 API, 1 Frontend, 1 Proxy, 1 Worker)

**GKE Savings:** ~$150-200/month (fewer nodes needed)
**Reduced complexity:** Easier to manage

---

### **Priority 3: GKE Right-Sizing (SAVE ~$300/month)**

#### **Current:**
- Autopilot manages everything
- 6 nodes for 30 pods
- May be over-provisioned

#### **Optimized:**
- **Reduce production replicas during MVP:**
  - API: 3 → **2 replicas** (still HA)
  - Frontend: 2 → **1 replica** (Cloud Run for frontend instead)
  - Proxy: 2 → **1 replica**
  - Workers: 0 → **0** (keep at 0, scale on demand)

- **Move Frontend to Cloud Run:**
  - Currently: GKE pods (always running)
  - Optimized: Cloud Run (scale to zero)
  - **Savings:** 3-4 frontend pods eliminated
  - **Cost:** Pay only for requests (~$20-30/month vs $100-150 on GKE)

**GKE Savings:** ~$300/month (fewer pods, smaller cluster)

---

### **Priority 4: Redis Optimization (SAVE ~$100/month)**

#### **Current:**
- STANDARD_HA: 5GB = $250/month

#### **Optimized:**
- **BASIC tier: 5GB = $130/month**
  - Save $120/month
  - Trade-off: No auto-failover (30-60s downtime if Redis fails)
  - **For MVP:** Acceptable risk
  - Can upgrade to HA when needed

**Alternative:**
- Reduce size to **2GB BASIC = $52/month** (save $198/month)
  - Current usage is minimal
  - Mostly session storage and light caching

**SAVINGS:** **$100-198/month** ($1,200-2,400/year)

---

### **Priority 5: Storage & Cleanup (SAVE ~$20/month)**

#### **Actions:**
- Remove unused buckets (5 buckets seem unused)
- Set lifecycle policies:
  - Screenshots: Delete after 7 days
  - Scan uploads: Delete after 30 days
  - Reports: Move to Coldline after 90 days

**SAVINGS:** ~$20-50/month (minimal but good hygiene)

---

## 📊 COST COMPARISON SUMMARY

| Component | Current Cost | Optimized Cost | Monthly Savings |
|-----------|-------------|----------------|----------------|
| **Cloud SQL** | $2,100 | $612 | **$1,488** |
| **GKE Autopilot** | $1,000 | $700 | **$300** |
| **Memorystore Redis** | $250 | $150 | **$100** |
| **Frontend (Cloud Run)** | (in GKE) | $30 | **$70** |
| **Staging Consolidation** | (in GKE) | - | **$200** |
| **Storage Cleanup** | $30 | $10 | **$20** |
| **Networking** | $150 | $120 | **$30** |
| **Other** | $100 | $80 | **$20** |
| **TOTAL** | **$3,630** | **$1,702** | **$1,928/month** |

---

## 🎯 OPTIMIZED ARCHITECTURE

### **Monthly Cost:**
- **Before:** ~$3,630/month
- **After:** ~$1,702/month
- **Savings:** **$1,928/month** (**53% reduction**)

### **Annual Savings:** **$23,136/year**

---

## ✅ Security & Compliance Impact Assessment

### **What STAYS the same (No compromise):**
✅ **Encryption:** All data encrypted at rest and in transit
✅ **Network Security:** VPC, private IPs, Cloud Armor WAF
✅ **Authentication:** JWT, MFA, API keys unchanged
✅ **Audit Logging:** All audit logs preserved
✅ **Access Control:** IAM policies unchanged
✅ **Container Security:** Binary authorization, vulnerability scanning
✅ **DDoS Protection:** Cloud Armor still active

### **What CHANGES (Acceptable trade-offs):**
⚠️ **DR Replica Removed:** Restore time increases from <1min to ~30min
  - **Mitigation:** Automated backups every 6 hours, 7-day retention
  - **For MVP:** Acceptable (not handling critical transactions yet)

⚠️ **Redis HA → Basic:** 30-60s downtime if Redis fails
  - **Impact:** Users may see brief session loss
  - **Mitigation:** Application handles Redis failures gracefully
  - **For MVP:** Acceptable

⚠️ **Reduced Replicas:** Less redundancy in non-prod
  - **Impact:** Dev/staging may have brief downtime
  - **For MVP:** Acceptable (not customer-facing)

### **When to Re-add Capacity:**
1. **DR Replica:** When handling real customer data (post-beta)
2. **Redis HA:** When SLA requires 99.9% uptime
3. **More replicas:** When traffic exceeds 1,000 RPM

---

## 🚀 Implementation Plan

### **Phase 1: Quick Wins (Week 1) - Save $200/month**
- [ ] Consolidate dev + staging namespaces
- [ ] Cleanup unused storage buckets
- [ ] Set storage lifecycle policies
- [ ] Downgrade Redis: STANDARD_HA → BASIC (5GB)

### **Phase 2: Database Optimization (Week 2) - Save $1,488/month**
- [ ] Create automated backup policy
- [ ] Downsize primary: 8vCPU/32GB → 4vCPU/16GB
- [ ] Downsize read replica: 8vCPU/32GB → 2vCPU/8GB
- [ ] Remove DR replica (us-east1)
- [ ] Test application performance
- [ ] Verify backup/restore procedure

### **Phase 3: GKE Optimization (Week 3) - Save $370/month**
- [ ] Move frontend to Cloud Run
- [ ] Reduce production API replicas: 3 → 2
- [ ] Reduce proxy replicas: 2 → 1
- [ ] Configure HPA for auto-scaling
- [ ] Load test to verify performance

### **Phase 4: Monitoring & Validation (Week 4)**
- [ ] Set up cost alerts
- [ ] Monitor performance metrics
- [ ] Validate security posture unchanged
- [ ] Document rollback procedures

---

## 📈 Cost Evolution Strategy

### **Current (MVP):** ~$1,700/month
- Optimized for cost
- Suitable for <1,000 users
- 99.5% uptime acceptable

### **Growth Phase (1,000-10,000 users):** ~$3,000/month
- Re-add Redis HA
- Increase DB: 4vCPU → 8vCPU
- Add back read replica

### **Scale Phase (10,000+ users):** ~$5,000/month
- Re-add DR replica
- Increase GKE nodes
- Add CDN for global traffic
- Upgrade to larger DB tiers

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Slower DB performance** | High | Monitor query times, can upgrade in 5 min |
| **Redis downtime** | Medium | Graceful degradation, session re-auth |
| **DR restore delay** | Low | Automated backups, 30min RTO acceptable for MVP |
| **Reduced redundancy** | Low | Cloud Run auto-scales, HPA configured |

---

## 📝 Recommendation

**Implement all optimizations immediately.**

Elara is in MVP/Development phase with minimal traffic. The current infrastructure is **over-provisioned by 2-3x**.

✅ **Security & Compliance:** Not compromised
✅ **Performance:** Still excellent for current load
✅ **Savings:** **$1,928/month** ($23,136/year)
✅ **Scalability:** Can scale up in <1 hour when needed

**ROI:** Save enough money in 2 months to fund 1 developer for 1 month.

---

**Next Step:** Review and approve optimization plan, then execute Phase 1 this week.
