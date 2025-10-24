# Elara Platform - IAM & RBAC Design

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Author**: Solution Architect (Claude Code)
**Status**: Production
**Classification**: Confidential - Security

---

## 📋 Executive Summary

This document defines the Identity and Access Management (IAM) and Role-Based Access Control (RBAC) design for the Elara platform on Google Cloud Platform. The design implements the principle of least privilege and zero-trust access controls.

**Key Features**:
- 🔑 Workload Identity (no service account keys)
- 🎯 Role-based access control (RBAC)
- 🔒 Least privilege principle
- 🚀 Just-in-time (JIT) access
- 📊 Comprehensive access auditing

---

## 📊 Table of Contents

1. [IAM Architecture Overview](#iam-architecture-overview)
2. [GCP IAM Roles](#gcp-iam-roles)
3. [Service Accounts](#service-accounts)
4. [Workload Identity](#workload-identity)
5. [Application RBAC](#application-rbac)
6. [Kubernetes RBAC](#kubernetes-rbac)
7. [Access Management](#access-management)

---

## 🏗️ IAM Architecture Overview

### Three-Layer Access Control

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         IAM ARCHITECTURE LAYERS                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

LAYER 1: GCP IAM (Cloud Platform Access)
├── Human Users (Google Workspace accounts)
│   ├── developers@elara.com → roles/viewer
│   ├── devops@elara.com → roles/editor + custom roles
│   └── admins@elara.com → roles/owner (restricted)
│
└── Service Accounts (Workload Identity)
    ├── elara-api-sa → Cloud SQL, Secret Manager, Storage
    ├── elara-worker-sa → Cloud SQL, Storage, Pub/Sub
    └── elara-proxy-sa → Storage

LAYER 2: Kubernetes RBAC (Cluster Access)
├── Namespaces
│   ├── elara-backend (API, proxy, workers)
│   ├── elara-integrations (WhatsApp service)
│   └── monitoring (Prometheus, Grafana)
│
└── Roles
    ├── namespace-admin → Full access within namespace
    ├── namespace-developer → Read/update deployments
    └── namespace-viewer → Read-only access

LAYER 3: Application RBAC (User Access)
├── Roles
│   ├── user → Own scans only
│   ├── analyst → All scans (read)
│   ├── admin → User management
│   └── superadmin → Full platform access
│
└── Permissions (granular)
    ├── scans:read, scans:write
    ├── users:read, users:write
    └── settings:read, settings:write
```

---

## 🔐 GCP IAM Roles

### Service Account Roles

```yaml
# Backend API Service Account
service_account: elara-api@elara-production.iam.gserviceaccount.com
roles:
  - roles/cloudsql.client              # Connect to Cloud SQL
  - roles/secretmanager.secretAccessor # Read secrets
  - roles/storage.objectViewer         # Read from GCS buckets
  - roles/storage.objectCreator        # Write to GCS buckets
  - roles/logging.logWriter            # Write logs
  - roles/monitoring.metricWriter      # Write metrics
  - roles/cloudtrace.agent             # Write traces

# Worker Service Account
service_account: elara-worker@elara-production.iam.gserviceaccount.com
roles:
  - roles/cloudsql.client
  - roles/secretmanager.secretAccessor
  - roles/storage.objectAdmin          # Full access to scan buckets
  - roles/pubsub.publisher             # Publish notifications
  - roles/logging.logWriter

# Proxy Service Account
service_account: elara-proxy@elara-production.iam.gserviceaccount.com
roles:
  - roles/storage.objectCreator        # Upload screenshots
  - roles/logging.logWriter

# CI/CD Service Account (GitHub Actions)
service_account: github-actions@elara-production.iam.gserviceaccount.com
roles:
  - roles/container.developer          # Push images to GCR
  - roles/run.admin                    # Deploy Cloud Run
  - roles/container.admin              # Manage GKE deployments
  - roles/cloudbuild.builds.editor     # Trigger builds
```

### Custom IAM Roles

```hcl
# terraform/modules/iam/custom_roles.tf

# DevOps Engineer Role
resource "google_project_iam_custom_role" "devops_engineer" {
  role_id     = "devopsEngineer"
  title       = "DevOps Engineer"
  description = "Custom role for DevOps team with specific permissions"
  permissions = [
    # Compute
    "compute.instances.list",
    "compute.instances.get",
    "compute.instances.start",
    "compute.instances.stop",

    # GKE
    "container.clusters.get",
    "container.clusters.list",
    "container.pods.get",
    "container.pods.list",
    "container.pods.getLogs",

    # Cloud SQL
    "cloudsql.instances.get",
    "cloudsql.instances.list",
    "cloudsql.databases.get",
    "cloudsql.databases.list",

    # Logging
    "logging.logEntries.list",
    "logging.logs.list",
    "logging.views.access",

    # Monitoring
    "monitoring.timeSeries.list",
    "monitoring.dashboards.get",

    # Secret Manager (read-only)
    "secretmanager.secrets.list",
    "secretmanager.versions.list"
  ]
}

# Security Analyst Role
resource "google_project_iam_custom_role" "security_analyst" {
  role_id     = "securityAnalyst"
  title       = "Security Analyst"
  description = "Read-only access for security investigations"
  permissions = [
    # Logging & Audit
    "logging.logEntries.list",
    "logging.logs.list",

    # Security Command Center
    "securitycenter.findings.list",
    "securitycenter.sources.get",

    # IAM (read-only)
    "iam.serviceAccounts.list",
    "iam.roles.list",

    # Firewall rules (read-only)
    "compute.firewalls.list",
    "compute.firewalls.get"
  ]
}
```

---

## 🤖 Service Accounts

### Service Account Naming Convention

```
Format: {service}-{environment}@{project-id}.iam.gserviceaccount.com

Examples:
- elara-api-prod@elara-production.iam.gserviceaccount.com
- elara-worker-prod@elara-production.iam.gserviceaccount.com
- elara-api-staging@elara-staging.iam.gserviceaccount.com
```

### Service Account Configuration

```hcl
# terraform/modules/iam/service_accounts.tf

# Backend API Service Account
resource "google_service_account" "elara_api" {
  account_id   = "elara-api-prod"
  display_name = "Elara API Service Account"
  description  = "Service account for Elara backend API pods"
  project      = var.project_id
}

# Grant Cloud SQL access
resource "google_project_iam_member" "api_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.elara_api.email}"
}

# Grant Secret Manager access
resource "google_secret_manager_secret_iam_member" "api_secrets" {
  for_each  = toset(var.api_secrets)
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.elara_api.email}"
}

# Grant Storage access (specific buckets only)
resource "google_storage_bucket_iam_member" "api_scans_bucket" {
  bucket = google_storage_bucket.scans.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.elara_api.email}"
}

resource "google_storage_bucket_iam_member" "api_reports_bucket" {
  bucket = google_storage_bucket.reports.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.elara_api.email}"
}
```

---

## 🔗 Workload Identity

### Workload Identity Configuration

```hcl
# Link Kubernetes Service Account to GCP Service Account

# 1. Enable Workload Identity on GKE cluster
resource "google_container_cluster" "primary" {
  name     = "elara-gke-us-west1"
  location = "us-west1"

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

# 2. Create IAM binding
resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.elara_api.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[elara-backend/elara-api-ksa]"
}
```

### Kubernetes Service Account Annotation

```yaml
# kubernetes/base/backend/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: elara-api-ksa
  namespace: elara-backend
  annotations:
    iam.gke.io/gcp-service-account: elara-api-prod@elara-production.iam.gserviceaccount.com
---
# Deployment using the service account
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elara-api
  namespace: elara-backend
spec:
  template:
    spec:
      serviceAccountName: elara-api-ksa  # Links to GCP SA via Workload Identity
      containers:
      - name: api
        image: gcr.io/elara-production/backend-api:latest
        # No need for service account key JSON file!
```

---

## 👥 Application RBAC

### Role Definitions

```typescript
// src/types/rbac.types.ts

export enum Role {
  USER = 'user',
  ANALYST = 'analyst',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin'
}

export enum Permission {
  // Scans
  SCANS_READ_OWN = 'scans:read:own',
  SCANS_READ_ALL = 'scans:read:all',
  SCANS_WRITE_OWN = 'scans:write:own',
  SCANS_WRITE_ALL = 'scans:write:all',
  SCANS_DELETE_OWN = 'scans:delete:own',
  SCANS_DELETE_ALL = 'scans:delete:all',

  // Users
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',

  // Threats
  THREATS_READ = 'threats:read',
  THREATS_WRITE = 'threats:write',

  // Reports
  REPORTS_GENERATE = 'reports:generate',
  REPORTS_EXPORT = 'reports:export',

  // Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_WRITE = 'settings:write',

  // Admin
  ADMIN_AUDIT_LOGS = 'admin:audit_logs',
  ADMIN_ANALYTICS = 'admin:analytics',
  ADMIN_SYSTEM_SETTINGS = 'admin:system_settings',

  // Wildcard
  ALL = '*'
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.SCANS_READ_OWN,
    Permission.SCANS_WRITE_OWN,
    Permission.SCANS_DELETE_OWN,
    Permission.THREATS_READ
  ],

  [Role.ANALYST]: [
    Permission.SCANS_READ_ALL,
    Permission.SCANS_WRITE_OWN,
    Permission.THREATS_READ,
    Permission.THREATS_WRITE,
    Permission.REPORTS_GENERATE,
    Permission.REPORTS_EXPORT
  ],

  [Role.ADMIN]: [
    Permission.SCANS_READ_ALL,
    Permission.SCANS_WRITE_ALL,
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_WRITE,
    Permission.ADMIN_AUDIT_LOGS,
    Permission.ADMIN_ANALYTICS
  ],

  [Role.SUPERADMIN]: [
    Permission.ALL
  ]
};
```

---

## ☸️ Kubernetes RBAC

### Namespace-Level RBAC

```yaml
# kubernetes/rbac/namespace-admin.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: namespace-admin
  namespace: elara-backend
rules:
- apiGroups: ["", "apps", "batch", "extensions"]
  resources: ["*"]
  verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devops-admin-binding
  namespace: elara-backend
subjects:
- kind: Group
  name: devops@elara.com
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: namespace-admin
  apiGroup: rbac.authorization.k8s.io

---
# kubernetes/rbac/namespace-developer.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: namespace-developer
  namespace: elara-backend
rules:
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "update", "patch"]
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developers-binding
  namespace: elara-backend
subjects:
- kind: Group
  name: developers@elara.com
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: namespace-developer
  apiGroup: rbac.authorization.k8s.io
```

---

## 🔧 Access Management

### Just-in-Time (JIT) Access

```typescript
// Just-in-time access implementation
export class JITAccessService {
  async requestAccess(
    userId: string,
    resource: string,
    duration: number // minutes
  ): Promise<AccessGrant> {
    // Validate request
    const user = await userRepository.findById(userId);
    if (!user.canRequestJIT) {
      throw new Error('User not eligible for JIT access');
    }

    // Check if approval required
    const requiresApproval = this.requiresApproval(resource);

    if (requiresApproval) {
      // Create approval request
      const request = await accessRequestRepository.create({
        userId,
        resource,
        duration,
        status: 'pending',
        requestedAt: new Date()
      });

      // Notify approvers
      await notifyApprovers(request);

      return {
        status: 'pending_approval',
        requestId: request.id
      };
    }

    // Auto-approve for low-risk resources
    return await this.grantAccess(userId, resource, duration);
  }

  async grantAccess(
    userId: string,
    resource: string,
    duration: number
  ): Promise<AccessGrant> {
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // Create temporary IAM binding
    await this.createTemporaryIAMBinding(userId, resource, expiresAt);

    // Log access grant
    await auditLog({
      action: 'jit.access.granted',
      userId,
      resource,
      duration,
      expiresAt
    });

    // Schedule automatic revocation
    await scheduleAccessRevocation(userId, resource, expiresAt);

    return {
      status: 'granted',
      expiresAt,
      resource
    };
  }
}
```

---

**Document Status**: ✅ **APPROVED**
**Next**: DISASTER_RECOVERY.md
