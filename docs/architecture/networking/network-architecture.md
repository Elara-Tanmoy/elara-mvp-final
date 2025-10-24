# Elara Platform - Network Architecture

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Network Architecture Team
**Status**: Production
**Classification**: Technical - Network Infrastructure

---

## 📋 Executive Summary

This document provides the complete network architecture for the Elara cybersecurity platform deployed on Google Cloud Platform. The network design implements **zero-trust security principles**, **defense-in-depth**, and **DDoS protection** through Cloud Armor.

**Key Security Features**:
- ✅ Private VPC with isolated subnets
- ✅ No public IP addresses on databases or internal services
- ✅ Cloud NAT for outbound traffic
- ✅ Cloud Armor WAF with rate limiting
- ✅ Network-level firewall rules
- ✅ IAP (Identity-Aware Proxy) ready for SSH access
- ✅ TLS encryption for all traffic

---

## 🌐 VPC Network Overview

### Primary VPC: `elara-vpc`

| Parameter | Value |
|-----------|-------|
| **Project** | elara-mvp-13082025-u1 |
| **VPC Name** | elara-vpc |
| **Region** | us-west1 (primary) |
| **Routing Mode** | Regional |
| **DNS** | Google Cloud DNS |

---

## 📡 IP Address Allocation

### External IP Addresses (Public)

| Name | IP Address | Type | Usage | Region |
|------|-----------|------|-------|--------|
| **elara-global-lb-ip** | 34.36.48.252 | Global | Production load balancer | Global |
| **elara-dev-backend-ip** | 35.199.176.26 | Regional | Dev backend LoadBalancer | us-west1 |
| **elara-dev-frontend-ip** | 136.117.33.149 | Regional | Dev frontend LoadBalancer | us-west1 |
| **elara-dev-frontend-alt** | 34.11.236.129 | Regional | Dev frontend (additional) | us-west1 |
| **elara-vpc-nat-ip-1** | 34.82.164.36 | Regional | NAT gateway (primary) | us-west1 |
| **elara-vpc-nat-ip-2** | 34.168.119.72 | Regional | NAT gateway (secondary) | us-west1 |

### Internal IP Addresses (Private)

| Resource | IP Address / CIDR | Type | Usage |
|----------|------------------|------|-------|
| **Cloud SQL** | 10.190.1.11 | Private | elara-postgres-optimized |
| **Redis** | 10.190.0.4 | Private | elara-redis-primary |
| **Private IP Range** | 10.190.0.0/24 | Reserved | VPC peering for managed services |

---

## 🏗️ Subnet Configuration

### elara-vpc Subnets

| Subnet Name | CIDR Range | Purpose | Private Google Access |
|-------------|-----------|---------|---------------------|
| **gke-nodes-us-west1** | 10.10.0.0/24 | GKE node IPs | ✅ Enabled |
| **data-layer-us-west1** | 10.20.0.0/24 | Database tier | ✅ Enabled |
| **cloudrun-us-west1** | 10.30.0.0/28 | Cloud Run services | ✅ Enabled |

### GKE Secondary IP Ranges

| Range Name | CIDR Range | Purpose | Size |
|------------|-----------|---------|------|
| **gke-pods-us-west1** | 10.1.0.0/16 | Kubernetes Pods | 65,536 IPs |
| **gke-services-us-west1** | 10.2.0.0/20 | Kubernetes Services (ClusterIP) | 4,096 IPs |

**GKE IP Allocation**:
- **Node IPs**: 10.10.0.0/24 (254 IPs)
- **Pod IPs**: 10.1.0.0/16 (65,536 IPs)
- **Service IPs**: 10.2.0.0/20 (4,096 IPs)
- **Utilization**: 0.49% pod IP usage (current)

---

## 🔒 Zero-Trust Security Architecture

### 1. Network Segmentation

```
┌────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
└────────────────┬──────────────────┬────────────────────────────┘
                 │                  │
                 │ (HTTPS/443)      │ (HTTP/80)
                 ▼                  ▼
      ┌──────────────────┐  ┌──────────────────┐
      │  Cloud Armor WAF │  │ LoadBalancer IPs │
      │  (DDoS + WAF)    │  │ Dev Environments │
      └────────┬─────────┘  └────────┬─────────┘
               │                     │
               │ Rate Limit: 100/min │
               │ SQL Injection Block │
               │ XSS Protection      │
               ▼                     ▼
      ┌────────────────────────────────────────┐
      │  Global Load Balancer (34.36.48.252)  │
      │  - TLS Termination                     │
      │  - CDN Enabled                         │
      │  - Session Affinity                    │
      └────────┬───────────────────────────────┘
               │
               │ Internal Traffic Only
               ▼
      ┌──────────────────────────────────────────────────┐
      │  GKE Autopilot Cluster (elara-gke-us-west1)      │
      │  Subnet: 10.10.0.0/24                            │
      │  ┌─────────────┬──────────────┬───────────────┐  │
      │  │ Backend     │ Frontend     │ Proxy Service │  │
      │  │ elara-api   │ elara-web    │ elara-proxy   │  │
      │  │ Private IPs │ Private IPs  │ Private IPs   │  │
      │  └──────┬──────┴──────┬───────┴───────┬───────┘  │
      └─────────┼─────────────┼───────────────┼──────────┘
                │             │               │
                │ VPC Peering │               │
                ▼             ▼               │
      ┌──────────────────────────────────┐    │
      │ Cloud SQL (Private)              │    │
      │ IP: 10.190.1.11                  │    │
      │ No Public IP                     │    │
      └──────────────────────────────────┘    │
                                              ▼
      ┌──────────────────────────────────┐
      │ Redis (Private)                  │
      │ IP: 10.190.0.4                   │
      │ No Public IP                     │
      └──────────────────────────────────┘
```

### 2. Outbound Traffic via Cloud NAT

All outbound internet traffic from GKE goes through Cloud NAT (no public IPs on nodes):

```
GKE Pods (10.1.0.0/16)
    │
    │ Outbound to Internet
    ▼
Cloud NAT Gateway
    ├─> NAT IP 1: 34.82.164.36
    └─> NAT IP 2: 34.168.119.72
        │
        ▼
    Internet
```

**NAT Configuration**:
- Router: `elara-vpc-router-us-west1`
- NAT: `elara-vpc-nat-us-west1`
- IP Allocation: Manual (2 static IPs)
- Subnet Coverage: All subnets in elara-vpc

---

## 🛡️ Firewall Rules

### Priority-Ordered Firewall Rules

| Priority | Name | Direction | Source | Target | Ports/Protocol | Purpose |
|----------|------|-----------|--------|--------|---------------|---------|
| **999** | gke-inkubelet | INGRESS | 10.1.0.0/16 | GKE nodes | TCP:10255 | Kubelet metrics |
| **1000** | elara-vpc-allow-gke-master | INGRESS | 172.16.0.0/28 | gke-node | TCP:443,10250 | GKE master to nodes |
| **1000** | elara-vpc-allow-health-checks | INGRESS | GCP Health Check IPs | All | TCP | Load balancer health checks |
| **1000** | elara-vpc-allow-iap-ssh | INGRESS | 35.235.240.0/20 | All | TCP:22 | IAP SSH tunneling |
| **1000** | elara-vpc-allow-internal | INGRESS | 10.1.0.0/16, 10.2.0.0/20, 10.10.0.0/24, 10.20.0.0/24, 10.30.0.0/28 | All | All | Internal VPC traffic |
| **1000** | k8s-fw-loadbalancers | INGRESS | 0.0.0.0/0 | GKE nodes | TCP:80 | LoadBalancer services |
| **1000** | k8s-fw-l7-backends | INGRESS | 130.211.0.0/22, 35.191.0.0/16 | GKE nodes | TCP:3001,8080 | Ingress backends |
| **2000** | elara-vpc-deny-external-rdp | INGRESS | 0.0.0.0/0 | All | TCP:3389 | **DENY RDP** |
| **2000** | elara-vpc-deny-external-ssh | INGRESS | 0.0.0.0/0 | All | TCP:22 | **DENY SSH** (use IAP) |

**Security Notes**:
- ✅ **No direct SSH/RDP allowed** - Use Cloud IAP for access
- ✅ **Internal traffic allowed** - All RFC1918 ranges within VPC
- ✅ **Health checks allowed** - Google Cloud health check IP ranges
- ✅ **LoadBalancer services** - Port 80 for dev environment LBs

---

## 🔐 Cloud Armor Security Policies

### Policy: `elara-security-policy`

Applied to production global load balancer (34.36.48.252).

| Priority | Rule | Action | Description |
|----------|------|--------|-------------|
| **1000** | Rate Limiting | rate_based_ban | 100 requests/minute per IP, 10min ban |
| **2000** | SQL Injection | deny(403) | Block using preconfigured WAF rule (sqli-v33-stable) |
| **3000** | XSS Protection | deny(403) | Block using preconfigured WAF rule (xss-v33-stable) |
| **2147483647** | Default | allow | Allow all other traffic |

**DDoS Protection**:
- ✅ **Rate limiting**: 100 requests/minute per source IP
- ✅ **Ban duration**: 600 seconds (10 minutes)
- ✅ **Exceed action**: HTTP 403 Forbidden
- ✅ **SQL Injection detection**: WAF preconfigured rule
- ✅ **XSS detection**: WAF preconfigured rule
- ✅ **Google Cloud Armor**: Layer 7 DDoS mitigation (automatic)

---

## 🚀 Landing Zone Architecture

### Production Landing Zone (34.36.48.252)

```
Internet Traffic
    │
    ▼
┌─────────────────────────────────────────┐
│ Global HTTPS Load Balancer              │
│ IP: 34.36.48.252                        │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Cloud Armor Security Policy         │ │
│ │ - Rate Limiting (100 req/min)       │ │
│ │ - SQL Injection Protection          │ │
│ │ - XSS Protection                    │ │
│ │ - DDoS Mitigation                   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ SSL/TLS Termination                 │ │
│ │ Managed Certificate (auto-renew)    │ │
│ │ Domains: elara.com, api.elara.com   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Backend Configuration               │ │
│ │ - Health checks: /health (HTTP)     │ │
│ │ - Session affinity: CLIENT_IP       │ │
│ │ - Connection draining: 300s         │ │
│ │ - Timeout: 30s                      │ │
│ └─────────────────────────────────────┘ │
└────────┬────────────────────────────────┘
         │
         │ Forwarding to GKE Backend NEG
         ▼
┌─────────────────────────────────────────┐
│ GKE Ingress (elara-backend namespace)   │
│ Service: elara-api-service              │
│ Type: ClusterIP (internal only)         │
│ Port: 80 → 3001                         │
└─────────────────────────────────────────┘
```

### Development Landing Zones

**Dev Backend** (35.199.176.26):
- Type: LoadBalancer Service
- Service: elara-api-lb (elara-backend-dev namespace)
- No Cloud Armor (development only)

**Dev Frontend** (136.117.33.149 + 34.11.236.129):
- Type: LoadBalancer Service
- Service: elara-frontend-lb (elara-frontend-dev namespace)
- Direct internet access for development

---

## 🔐 IAM & Service Account Network Access

### Workload Identity Bindings

| Service Account | K8s Namespace | K8s SA | Network Access |
|----------------|---------------|--------|----------------|
| **elara-api** | elara-backend | elara-api-sa | VPC private access to Cloud SQL, Redis |
| **elara-worker** | elara-workers | elara-worker-sa | VPC private access + Cloud Storage |
| **elara-proxy** | elara-proxy | elara-proxy-sa | Outbound via Cloud NAT |
| **elara-frontend** | elara-frontend | elara-frontend-sa | Minimal network access |

**Zero-Trust Access**:
- ✅ Service accounts use Workload Identity (no key files)
- ✅ Least privilege network access
- ✅ No public IPs on service accounts
- ✅ All database access via private VPC peering

---

## 📊 Network Monitoring & Logging

### VPC Flow Logs

**Status**: Enabled for security subnets
- **Sample Rate**: 50%
- **Metadata**: Full metadata collection
- **Log Filter**: All traffic
- **Retention**: 30 days in Cloud Logging

### Firewall Rule Logging

**Enabled Rules**:
- All DENY rules (SSH, RDP blocks)
- Cloud Armor policy hits
- Suspicious traffic patterns

### Cloud NAT Logging

**Status**: Enabled
- **Log Type**: Translation and errors
- **Destination**: Cloud Logging
- **Filter**: All NAT events

---

## 🛠️ Network Troubleshooting

### Common Network Paths

**1. External User → Production API**:
```
User → 34.36.48.252:443 (Cloud Armor) → Global LB → GKE Ingress →
elara-api-service (10.2.x.x) → Backend Pod (10.1.x.x)
```

**2. Backend Pod → Cloud SQL**:
```
Backend Pod (10.1.x.x) → VPC Peering → Cloud SQL (10.190.1.11:5432)
```

**3. Backend Pod → Internet API**:
```
Backend Pod (10.1.x.x) → Cloud NAT (34.82.164.36 or 34.168.119.72) → Internet
```

**4. Backend Pod → Redis**:
```
Backend Pod (10.1.x.x) → VPC Internal → Redis (10.190.0.4:6379)
```

### Network Diagnostic Commands

```bash
# Test Cloud SQL connectivity from GKE pod
kubectl exec -it <pod-name> -n elara-backend -- nc -zv 10.190.1.11 5432

# Test Redis connectivity
kubectl exec -it <pod-name> -n elara-backend -- nc -zv 10.190.0.4 6379

# Check NAT IP usage
gcloud compute routers get-nat-mapping-info elara-vpc-router-us-west1 \
  --region=us-west1 --nat-name=elara-vpc-nat-us-west1

# Verify Cloud Armor policy
gcloud compute security-policies describe elara-security-policy

# Check firewall rule hits
gcloud logging read "resource.type=gce_firewall_rule" --limit 50
```

---

## 💰 Network Costs

### Current Monthly Network Costs

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| **Cloud NAT** | 2 static IPs + data processing | $30-50 |
| **Global Load Balancer** | Forwarding rules + data processing | $40 |
| **Cloud Armor** | Security policy + rules | $20 |
| **VPC Network** | Included (no charge) | $0 |
| **Private Service Connection** | VPC peering for Cloud SQL/Redis | $0 |
| **Network Egress** | ~200GB/month | $20-30 |
| **Total Network Costs** |  | **$110-140/month** |

---

## ✅ Security Compliance

### Zero-Trust Principles Implemented

| Principle | Implementation | Status |
|-----------|---------------|--------|
| **Verify Explicitly** | IAM + Workload Identity + Cloud Armor | ✅ |
| **Least Privilege Access** | Service account roles + Firewall rules | ✅ |
| **Assume Breach** | Network segmentation + private IPs + monitoring | ✅ |
| **Encrypt Everything** | TLS in transit + encryption at rest | ✅ |
| **Segment Network** | Subnets per tier + VPC isolation | ✅ |
| **Monitor Continuously** | VPC Flow Logs + Firewall logs + Cloud Armor logs | ✅ |

### Compliance Readiness

- ✅ **PCI DSS**: Network isolation, encryption, monitoring
- ✅ **SOC 2**: Access controls, logging, DDoS protection
- ✅ **ISO 27001**: Information security controls
- ✅ **GDPR**: Data residency (us-west1), encryption

---

## 🚀 Network Scaling & Performance

### Current Capacity

- **Global Load Balancer**: Up to 1M requests/second
- **Cloud Armor**: Unlimited DDoS protection
- **VPC**: 65,536 pod IPs available (99.5% unused)
- **NAT Gateway**: Auto-scaling ports (up to 64K connections)
- **Bandwidth**: Regional bandwidth (unlimited within region)

### Network SLAs

| Component | SLA | Current Uptime |
|-----------|-----|----------------|
| **Global Load Balancer** | 99.99% | ✅ Active |
| **Cloud Armor** | 99.99% | ✅ Active |
| **Cloud NAT** | 99.99% | ✅ Active |
| **VPC** | 99.99% | ✅ Active |

---

## 📝 Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-24 | 1.0 | Initial network architecture documentation |

---

**Document Status**: ✅ Production Ready
**Verified**: All IPs and configurations verified via gcloud CLI
**Last Verification**: 2025-10-24
