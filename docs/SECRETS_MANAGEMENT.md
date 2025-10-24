# Elara Platform - Secrets Management Guide

**Last Updated**: 2025-10-24
**Version**: 1.0
**Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Guide](#setup-guide)
4. [Usage in Code](#usage-in-code)
5. [Kubernetes Integration](#kubernetes-integration)
6. [Secret Rotation](#secret-rotation)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Elara Platform uses **GCP Secret Manager** for centralized, secure secret management. This ensures:

- ✅ **Zero secrets in code or configuration files**
- ✅ **Automatic secret rotation support**
- ✅ **Granular IAM access control**
- ✅ **Audit logging of all secret access**
- ✅ **Workload Identity integration with GKE**
- ✅ **Automatic fallback to environment variables in development**

### Secret Storage Locations

| Environment | Secret Storage | Access Method |
|-------------|----------------|---------------|
| **Production** | GCP Secret Manager | Workload Identity (automatic) |
| **Development** | GCP Secret Manager or .env | Environment variables or Secret Manager |
| **Local Dev** | .env file | Environment variables |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GCP Secret Manager                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ jwt-secret   │  │anthropic-api │  │database-url  │ ...  │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Workload Identity
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       GKE Cluster                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Backend Pods                                       │     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │  secrets.ts Module                           │  │     │
│  │  │  ├─ secrets.getJwtSecret()                   │  │     │
│  │  │  ├─ secrets.getAnthropicApiKey()             │  │     │
│  │  │  └─ secrets.getDatabaseUrl()                 │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Pod starts** in GKE with Workload Identity enabled
2. **Kubernetes Service Account** is mapped to **GCP Service Account**
3. **secrets.ts module** calls GCP Secret Manager API
4. **GCP validates** request via Workload Identity
5. **Secret Manager** returns secret value
6. **Secret is cached** in-memory for 5 minutes

---

## Setup Guide

### Step 1: Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com \
  --project=elara-mvp-13082025-u1
```

### Step 2: Create Secrets

Run the setup script to create all required secrets:

```bash
cd infrastructure/scripts
chmod +x setup-secrets.sh
./setup-secrets.sh
```

This creates 30+ secrets for:
- Database connections
- Redis
- JWT tokens
- AI API keys (Claude, GPT-4, Gemini)
- OAuth providers (Google, Facebook, LinkedIn)
- External APIs (VirusTotal, Safe Browsing, etc.)
- WhatsApp/Twilio
- Blockchain
- Encryption keys

### Step 3: Add Secret Values

Run the interactive script to add secret values:

```bash
chmod +x add-secrets.sh
./add-secrets.sh
```

Or add secrets manually:

```bash
# Add a secret value
echo -n "YOUR_SECRET_VALUE" | gcloud secrets versions add SECRET_NAME \
  --data-file=- \
  --project=elara-mvp-13082025-u1

# Example: Add JWT secret
echo -n "$(openssl rand -hex 32)" | gcloud secrets versions add jwt-secret \
  --data-file=- \
  --project=elara-mvp-13082025-u1
```

### Step 4: Grant Access to Service Accounts

The setup script automatically grants access, but you can manually grant:

```bash
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:elara-api@elara-mvp-13082025-u1.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=elara-mvp-13082025-u1
```

### Step 5: Verify Setup

```bash
# List all secrets
gcloud secrets list --project=elara-mvp-13082025-u1

# View a secret value
gcloud secrets versions access latest \
  --secret=jwt-secret \
  --project=elara-mvp-13082025-u1

# Check IAM policy
gcloud secrets get-iam-policy jwt-secret \
  --project=elara-mvp-13082025-u1
```

---

## Usage in Code

### Import the Secrets Module

```typescript
import secrets from '../config/secrets.js';
```

### Access Secrets (Async)

```typescript
// Get database URL
const databaseUrl = await secrets.getDatabaseUrl('prod');

// Get JWT secret
const jwtSecret = await secrets.getJwtSecret();

// Get AI API keys
const anthropicKey = await secrets.getAnthropicApiKey();
const openaiKey = await secrets.getOpenAiApiKey();
const geminiKey = await secrets.getGeminiApiKey();

// Get OAuth secrets
const googleSecret = await secrets.getOAuthClientSecret('google');
const facebookId = await secrets.getOAuthClientId('facebook');

// Get external API keys
const virusTotalKey = await secrets.getVirusTotalApiKey();
const safeBrowsingKey = await secrets.getGoogleSafeBrowsingApiKey();

// Generic accessor
const customSecret = await secrets.get('custom-secret-name', 'FALLBACK_ENV_VAR');
```

### Example: Initialize Database with Secret

```typescript
import { PrismaClient } from '@prisma/client';
import secrets from './config/secrets.js';

async function initializeDatabase() {
  const databaseUrl = await secrets.getDatabaseUrl('prod');

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });

  return prisma;
}

export const prisma = await initializeDatabase();
```

### Example: Initialize JWT with Secret

```typescript
import jwt from 'jsonwebtoken';
import secrets from '../config/secrets.js';

export async function generateAccessToken(payload: any) {
  const jwtSecret = await secrets.getJwtSecret();

  return jwt.sign(payload, jwtSecret, {
    expiresIn: '7d'
  });
}

export async function verifyAccessToken(token: string) {
  const jwtSecret = await secrets.getJwtSecret();

  return jwt.verify(token, jwtSecret);
}
```

### Development Mode (Environment Variables)

```typescript
// .env file
USE_SECRET_MANAGER=false
JWT_SECRET=my-local-jwt-secret
DATABASE_URL=postgresql://localhost:5432/elara_dev

// Code automatically falls back to environment variables
const jwtSecret = await secrets.getJwtSecret();
// Returns process.env.JWT_SECRET when USE_SECRET_MANAGER=false
```

---

## Kubernetes Integration

### Workload Identity Setup

**Service Account Binding** (already configured in production):

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: elara-api-sa
  namespace: elara-backend
  annotations:
    iam.gke.io/gcp-service-account: elara-api@elara-mvp-13082025-u1.iam.gserviceaccount.com
```

**Deployment Configuration**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elara-api
spec:
  template:
    spec:
      serviceAccountName: elara-api-sa  # Use Workload Identity
      containers:
      - name: api
        image: gcr.io/elara-mvp-13082025-u1/backend:latest
        env:
        - name: GCP_PROJECT_ID
          value: "elara-mvp-13082025-u1"
        - name: USE_SECRET_MANAGER
          value: "true"
        - name: NODE_ENV
          value: "production"
```

### No Environment Variables Needed!

With Workload Identity, you don't need to pass secrets as environment variables:

```yaml
# ❌ DON'T DO THIS
env:
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: jwt-secret
      key: value

# ✅ DO THIS INSTEAD
env:
- name: USE_SECRET_MANAGER
  value: "true"
# Secrets are fetched automatically via Workload Identity
```

---

## Secret Rotation

### Rotating a Secret

1. **Add new secret version**:
```bash
echo -n "NEW_SECRET_VALUE" | gcloud secrets versions add jwt-secret \
  --data-file=- \
  --project=elara-mvp-13082025-u1
```

2. **Restart pods** (cache expires in 5 minutes, but restart for immediate effect):
```bash
kubectl rollout restart deployment/elara-api -n elara-backend
```

3. **Disable old version** (optional):
```bash
gcloud secrets versions disable VERSION_ID \
  --secret=jwt-secret \
  --project=elara-mvp-13082025-u1
```

### Rotation Schedule

| Secret Type | Rotation Frequency | Who Rotates |
|-------------|-------------------|-------------|
| **JWT Secrets** | Monthly | Automated (planned) |
| **API Keys** | Quarterly | Manual |
| **OAuth Secrets** | On provider change | Manual |
| **Database Password** | Quarterly | Manual |
| **Encryption Keys** | Annually | Manual |

### Emergency Rotation

If a secret is compromised:

```bash
# 1. Immediately add new version
echo -n "NEW_EMERGENCY_SECRET" | gcloud secrets versions add COMPROMISED_SECRET \
  --data-file=- \
  --project=elara-mvp-13082025-u1

# 2. Restart all pods immediately
kubectl rollout restart deployment/elara-api -n elara-backend
kubectl rollout restart deployment/elara-worker -n elara-workers

# 3. Disable old version
gcloud secrets versions disable OLD_VERSION_ID \
  --secret=COMPROMISED_SECRET \
  --project=elara-mvp-13082025-u1

# 4. Audit who accessed the secret
gcloud logging read "protoPayload.resourceName:secrets/COMPROMISED_SECRET" \
  --limit=100 \
  --project=elara-mvp-13082025-u1
```

---

## Best Practices

### ✅ DO

1. **Use typed accessors**: `secrets.getJwtSecret()` instead of generic `secrets.get()`
2. **Cache secrets appropriately**: The module caches for 5 minutes automatically
3. **Use Workload Identity**: Always enable in production
4. **Rotate regularly**: Follow the rotation schedule
5. **Audit access**: Review Secret Manager logs monthly
6. **Test fallback**: Ensure environment variable fallback works in dev

### ❌ DON'T

1. **Don't hardcode secrets**: Never put real secrets in code or config
2. **Don't commit .env files**: Add `.env` to `.gitignore`
3. **Don't log secrets**: Never log secret values
4. **Don't share secrets**: Use IAM for granular access
5. **Don't skip rotation**: Rotate secrets as scheduled
6. **Don't use the same secret everywhere**: Use different secrets per environment

### Security Checklist

- [ ] All secrets stored in GCP Secret Manager
- [ ] No secrets in code, config, or Docker images
- [ ] Workload Identity enabled for all services
- [ ] IAM policies grant least-privilege access
- [ ] Secret rotation schedule documented
- [ ] Audit logging enabled
- [ ] .env files in .gitignore
- [ ] Emergency rotation procedure documented

---

## Troubleshooting

### Issue: Secret Not Found

```
Error: Secret jwt-secret not found
```

**Solution**:
1. Verify secret exists:
   ```bash
   gcloud secrets describe jwt-secret --project=elara-mvp-13082025-u1
   ```
2. If not found, create it:
   ```bash
   cd infrastructure/scripts && ./setup-secrets.sh
   ```

### Issue: Permission Denied

```
Error: Permission denied accessing secret jwt-secret
```

**Solution**:
1. Check IAM policy:
   ```bash
   gcloud secrets get-iam-policy jwt-secret --project=elara-mvp-13082025-u1
   ```
2. Grant access:
   ```bash
   gcloud secrets add-iam-policy-binding jwt-secret \
     --member="serviceAccount:elara-api@elara-mvp-13082025-u1.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

### Issue: Workload Identity Not Working

```
Error: Could not load the default credentials
```

**Solution**:
1. Verify service account annotation:
   ```bash
   kubectl get sa elara-api-sa -n elara-backend -o yaml
   ```
2. Ensure annotation exists:
   ```yaml
   annotations:
     iam.gke.io/gcp-service-account: elara-api@elara-mvp-13082025-u1.iam.gserviceaccount.com
   ```
3. Verify IAM binding:
   ```bash
   gcloud iam service-accounts get-iam-policy \
     elara-api@elara-mvp-13082025-u1.iam.gserviceaccount.com
   ```

### Issue: Secret Value Not Updating

**Cause**: 5-minute cache

**Solution**:
1. Wait 5 minutes for cache to expire, or
2. Restart pod to clear cache:
   ```bash
   kubectl rollout restart deployment/elara-api -n elara-backend
   ```

### Issue: Development Mode Not Using Secrets

**Solution**:
Set environment variables in .env:
```bash
USE_SECRET_MANAGER=false
JWT_SECRET=my-local-secret
DATABASE_URL=postgresql://localhost:5432/elara_dev
```

---

## Summary

Elara Platform uses GCP Secret Manager for enterprise-grade secret management:

✅ **Zero secrets in code or config**
✅ **Workload Identity for automatic access**
✅ **Automatic caching for performance**
✅ **Environment variable fallback for development**
✅ **Easy rotation with zero downtime**
✅ **Comprehensive audit logging**

**Next Steps**:
1. Run `infrastructure/scripts/setup-secrets.sh` to create secrets
2. Run `infrastructure/scripts/add-secrets.sh` to populate values
3. Deploy to GKE with Workload Identity enabled
4. Verify access with `kubectl logs`

For questions or issues, refer to the troubleshooting section or GCP documentation.

---

**Related Documentation**:
- GCP Deployment Blueprint: `docs/architecture/gcp-deployment-blueprint.md`
- Kubernetes Configuration: `infrastructure/kubernetes/`
- Backend Configuration: `packages/backend/src/config/secrets.ts`
