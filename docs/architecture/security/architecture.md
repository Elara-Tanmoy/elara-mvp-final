# Elara Platform - Security Architecture

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Author**: Solution Architect (Claude Code)
**Status**: Production
**Classification**: Confidential - Security

---

## 📋 Executive Summary

This document defines the comprehensive security architecture for the Elara cybersecurity platform on Google Cloud Platform. The architecture implements a **defense-in-depth** strategy with zero-trust principles, ensuring enterprise-grade security across all layers.

**Security Posture**: Enterprise-grade, Zero-Trust, Defense-in-Depth

**Key Security Controls**:
- 🔒 End-to-end encryption (data in transit and at rest)
- 🛡️ Cloud Armor WAF with DDoS protection
- 🔐 Multi-factor authentication (MFA)
- 🎯 Zero-trust network architecture
- 📝 Comprehensive audit logging
- 🚨 Real-time threat detection
- 🔑 Customer-managed encryption keys (CMEK)
- ✅ Binary authorization for containers

---

## 📊 Table of Contents

1. [Security Principles](#security-principles)
2. [Threat Model](#threat-model)
3. [Defense-in-Depth Architecture](#defense-in-depth-architecture)
4. [Network Security](#network-security)
5. [Application Security](#application-security)
6. [Data Security](#data-security)
7. [Identity and Access Management](#identity-and-access-management)
8. [Container Security](#container-security)
9. [API Security](#api-security)
10. [Secrets Management](#secrets-management)
11. [Security Monitoring and Detection](#security-monitoring-and-detection)
12. [Incident Response](#incident-response)
13. [Compliance and Audit](#compliance-and-audit)
14. [Security Testing](#security-testing)

---

## 🎯 Security Principles

### Core Security Principles

1. **Zero Trust**: Never trust, always verify
   - No implicit trust based on network location
   - Verify every request regardless of source
   - Micro-segmentation with strict access controls

2. **Defense in Depth**: Multiple layers of security
   - If one layer is compromised, others remain intact
   - Security at edge, network, application, and data layers
   - No single point of failure in security controls

3. **Least Privilege**: Minimal necessary access
   - Users and services get only required permissions
   - Just-in-time access for administrative tasks
   - Regular access reviews and revocation

4. **Security by Default**: Secure out of the box
   - Secure defaults in all configurations
   - Opt-in for less secure options (not opt-out)
   - Fail-safe: fail securely rather than openly

5. **Privacy by Design**: Privacy built into architecture
   - Data minimization (collect only what's needed)
   - Purpose limitation (use data only for stated purpose)
   - User control over their data

6. **Assume Breach**: Design for compromise
   - Limit blast radius of any breach
   - Quick detection and response capabilities
   - Regular security drills and tabletop exercises

---

## 🎭 Threat Model

### STRIDE Threat Analysis

| Threat Category | Attack Vectors | Mitigation |
|----------------|----------------|------------|
| **Spoofing** | Impersonating legitimate users, API key theft | JWT tokens, MFA, API key rotation, mTLS |
| **Tampering** | Modifying data in transit/at rest | TLS 1.3, signed containers, CMEK encryption |
| **Repudiation** | Denying actions taken | Comprehensive audit logs, immutable logs |
| **Information Disclosure** | Data exfiltration, credential leaks | VPC Service Controls, DLP, encryption everywhere |
| **Denial of Service** | DDoS attacks, resource exhaustion | Cloud Armor, rate limiting, auto-scaling |
| **Elevation of Privilege** | Privilege escalation, lateral movement | RBAC, IAM policies, network segmentation |

### Attack Surface Analysis

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ATTACK SURFACE MAP                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

EXTERNAL ATTACK SURFACE (Internet-Facing)
├── Global Load Balancer (HTTPS endpoints)
│   ├── Risk: DDoS, Web attacks, Bot attacks
│   └── Controls: Cloud Armor WAF, Rate limiting, Bot management
│
├── Frontend (Cloud Run)
│   ├── Risk: XSS, CSRF, Clickjacking
│   └── Controls: CSP headers, CSRF tokens, X-Frame-Options
│
├── Backend API (via LB)
│   ├── Risk: API abuse, Injection attacks, Broken auth
│   └── Controls: Input validation, Parameterized queries, JWT auth
│
└── WhatsApp Webhook
    ├── Risk: Spoofed webhooks, Message injection
    └── Controls: Webhook signature verification, Rate limiting

INTERNAL ATTACK SURFACE (VPC)
├── GKE Nodes
│   ├── Risk: Container escape, Node compromise
│   └── Controls: Binary Authorization, CIS benchmarks, GKE Autopilot
│
├── Cloud SQL
│   ├── Risk: SQL injection, Unauthorized access
│   └── Controls: Private IP only, IAM auth, Parameterized queries
│
└── Redis (Memorystore)
    ├── Risk: Cache poisoning, Unauthorized access
    └── Controls: Private IP, VPC peering, AUTH password

SUPPLY CHAIN
├── Third-party Dependencies (npm, Python packages)
│   ├── Risk: Malicious packages, Known vulnerabilities
│   └── Controls: Snyk scanning, npm audit, SBOM generation
│
├── Container Base Images
│   ├── Risk: Vulnerable base images
│   └── Controls: Distroless images, Vulnerability scanning
│
└── CI/CD Pipeline
    ├── Risk: Pipeline compromise, Credential theft
    └── Controls: Workload Identity, Code signing, Protected branches
```

### Risk Register

| Risk ID | Risk Description | Likelihood | Impact | Risk Score | Mitigation |
|---------|-----------------|------------|--------|------------|------------|
| **R-001** | DDoS attack causing service unavailability | High | High | Critical | Cloud Armor auto-scaling, CDN |
| **R-002** | SQL injection leading to data breach | Medium | Critical | High | Parameterized queries, WAF, Input validation |
| **R-003** | Credential theft via phishing | High | High | Critical | MFA enforcement, Security awareness training |
| **R-004** | Container vulnerability exploitation | Medium | High | High | Vulnerability scanning, Binary Authorization |
| **R-005** | Insider threat (malicious employee) | Low | Critical | High | RBAC, Audit logging, Background checks |
| **R-006** | API key leakage in public repos | Medium | High | High | Secret scanning, Automated rotation |
| **R-007** | Supply chain attack (malicious package) | Medium | Critical | High | Dependency scanning, SBOM, Review process |
| **R-008** | Data exfiltration via compromised account | Medium | Critical | High | VPC Service Controls, DLP, Anomaly detection |

---

## 🛡️ Defense-in-Depth Architecture

### 7-Layer Security Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      DEFENSE-IN-DEPTH SECURITY LAYERS                            │
└─────────────────────────────────────────────────────────────────────────────────┘

LAYER 1: PERIMETER SECURITY (Edge/Internet Boundary)
├── Cloud Armor WAF
│   ├── OWASP Top 10 protection
│   ├── Custom security rules
│   ├── Rate limiting (adaptive)
│   ├── Geo-blocking capabilities
│   └── Bot management (reCAPTCHA integration)
│
├── Cloud CDN
│   ├── DDoS mitigation (absorption)
│   ├── Edge caching (reduces origin load)
│   └── SSL/TLS termination
│
└── Cloud DNS with DNSSEC
    ├── Protection against DNS poisoning
    └── Signed DNS records

LAYER 2: NETWORK SECURITY (VPC/Transport Layer)
├── VPC Firewall Rules
│   ├── Default deny all ingress
│   ├── Explicit allow rules only
│   ├── Egress filtering (allow-list)
│   └── Priority-based rule evaluation
│
├── VPC Service Controls
│   ├── Data perimeter (prevent exfiltration)
│   ├── Restrict API access to VPC
│   ├── Private Google Access
│   └── Ingress/egress policies
│
├── Private Service Connect
│   ├── No public IPs for databases
│   ├── VPC peering for managed services
│   └── Private endpoints only
│
└── Cloud NAT
    ├── Outbound-only internet access
    ├── Static IP for allowlisting
    └── Logging enabled

LAYER 3: COMPUTE SECURITY (GKE/Cloud Run)
├── GKE Security Posture
│   ├── Autopilot mode (Google-managed nodes)
│   ├── Shielded GKE nodes
│   ├── Workload Identity (no service account keys)
│   ├── Pod Security Standards (restricted)
│   └── Network policies (Kubernetes)
│
├── Binary Authorization
│   ├── Only signed containers allowed
│   ├── Attestation from CI/CD
│   ├── Block vulnerabilities (critical/high)
│   └── Break-glass mechanism
│
└── Container Security
    ├── Non-root containers
    ├── Read-only root filesystem
    ├── Minimal base images (distroless)
    ├── No privileged containers
    └── Resource limits enforced

LAYER 4: APPLICATION SECURITY
├── Authentication & Authorization
│   ├── JWT tokens (RS256 signing)
│   ├── Multi-factor authentication (MFA)
│   ├── OAuth 2.0 / OIDC
│   ├── Session management (secure cookies)
│   └── Password policies (strong passwords)
│
├── Input Validation
│   ├── Schema validation (Joi/Zod)
│   ├── Sanitization (DOMPurify)
│   ├── Content Security Policy (CSP)
│   └── Type checking (TypeScript)
│
├── Output Encoding
│   ├── HTML encoding
│   ├── JavaScript encoding
│   ├── URL encoding
│   └── SQL parameterization
│
├── API Security
│   ├── Rate limiting per user/IP
│   ├── API key authentication
│   ├── Request signing
│   └── CORS policies
│
└── Secure Development
    ├── OWASP Top 10 mitigation
    ├── Secure coding guidelines
    ├── Code review (security focus)
    └── SAST/DAST in CI/CD

LAYER 5: DATA SECURITY
├── Encryption at Rest
│   ├── Cloud SQL: CMEK (Cloud KMS)
│   ├── Cloud Storage: CMEK
│   ├── Persistent Disks: CMEK
│   ├── Redis: Default encryption
│   └── Key rotation (automatic)
│
├── Encryption in Transit
│   ├── TLS 1.3 (all connections)
│   ├── Strong cipher suites only
│   ├── Certificate pinning (mobile apps)
│   └── mTLS for service-to-service (optional)
│
├── Data Classification
│   ├── Public (no special handling)
│   ├── Internal (access controls)
│   ├── Confidential (encryption + audit)
│   └── Restricted (CMEK + DLP + strict access)
│
└── Data Loss Prevention (DLP)
    ├── Scan for PII/PHI/PCI
    ├── Redaction policies
    ├── Anomaly detection
    └── Egress controls

LAYER 6: IDENTITY & ACCESS MANAGEMENT
├── Cloud IAM
│   ├── Principle of least privilege
│   ├── Service accounts for services
│   ├── User accounts for humans
│   ├── IAM Conditions (time, IP-based)
│   └── Regular access reviews
│
├── Workload Identity
│   ├── GKE pods authenticate to GCP
│   ├── No service account keys
│   ├── Automatic credential rotation
│   └── Namespace isolation
│
├── Role-Based Access Control (RBAC)
│   ├── Predefined roles (minimal)
│   ├── Custom roles (fine-grained)
│   ├── Group-based assignments
│   └── Separation of duties
│
└── Secrets Management
    ├── Secret Manager (GCP)
    ├── No hardcoded secrets
    ├── Automatic secret rotation
    ├── Audit logs for all access
    └── Encryption at rest (CMEK)

LAYER 7: MONITORING & DETECTION
├── Security Command Center (SCC)
│   ├── Asset inventory
│   ├── Vulnerability scanning
│   ├── Threat detection
│   ├── Security Health Analytics
│   └── Event Threat Detection
│
├── Cloud Audit Logs
│   ├── Admin activity logs
│   ├── Data access logs
│   ├── System event logs
│   ├── Policy denied logs
│   └── 10-year retention
│
├── Cloud IDS (Intrusion Detection)
│   ├── Network traffic analysis
│   ├── Threat signature matching
│   ├── Anomaly detection
│   └── Real-time alerts
│
├── SIEM Integration
│   ├── Log aggregation (Cloud Logging)
│   ├── BigQuery for log analysis
│   ├── Correlation rules
│   └── Threat intelligence feeds
│
└── Application Logging
    ├── Structured JSON logs
    ├── Correlation IDs (tracing)
    ├── Security events logged
    └── PII redaction in logs
```

---

## 🌐 Network Security

### VPC Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SECURE VPC ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

VPC: elara-vpc (10.0.0.0/16)
├── Subnets (Private IP only)
│   ├── gke-pods-us-west1 (10.1.0.0/16)
│   ├── gke-nodes-us-west1 (10.10.0.0/24)
│   ├── data-layer-us-west1 (10.20.0.0/24)
│   └── cloudrun-connector-us-west1 (10.30.0.0/28)
│
├── Firewall Rules (Default Deny)
│   ├── allow-gke-to-cloudsql (10.1.0.0/16 → 10.20.0.0/24:5432)
│   ├── allow-gke-to-redis (10.1.0.0/16 → 10.20.0.0/24:6379)
│   ├── allow-health-checks (GCP ranges → all:80,443)
│   ├── allow-internal (10.0.0.0/16 → 10.0.0.0/16)
│   └── deny-all (priority: 65534)
│
├── Cloud NAT
│   ├── Outbound-only internet
│   ├── Static IPs for allowlisting
│   └── Logging: all traffic
│
└── Private Google Access
    └── Access GCP APIs without public IP
```

### VPC Service Controls

**Perimeter Configuration**:

```yaml
name: elara-production-perimeter
resources:
  - projects/elara-production

restricted_services:
  - storage.googleapis.com
  - sql-component.googleapis.com
  - sqladmin.googleapis.com
  - redis.googleapis.com
  - secretmanager.googleapis.com

access_levels:
  - name: elara_internal_access
    conditions:
      ip_subnetworks:
        - 10.0.0.0/16  # Internal VPC
      members:
        - serviceAccount:elara-api@elara-production.iam.gserviceaccount.com

ingress_policies:
  - from:
      identities:
        - serviceAccount:elara-api@elara-production.iam.gserviceaccount.com
      sources:
        - access_level: elara_internal_access
    to:
      resources:
        - projects/elara-production
      operations:
        - service_name: storage.googleapis.com
          method_selectors:
            - method: google.storage.objects.get
            - method: google.storage.objects.create

egress_policies:
  - from:
      identities:
        - serviceAccount:elara-api@elara-production.iam.gserviceaccount.com
    to:
      resources:
        - projects/elara-production
      operations:
        - service_name: storage.googleapis.com
```

### Cloud Armor Security Policies

```yaml
name: elara-production-armor-policy
description: WAF rules for Elara platform

rules:
  # Rule 1: Rate limiting
  - priority: 1000
    action: rate_based_ban
    match:
      versioned_expr: SRC_IPS_V1
      config:
        src_ip_ranges:
          - "*"
    rate_limit_options:
      conform_action: allow
      exceed_action: deny_403
      enforce_on_key: IP
      rate_limit_threshold:
        count: 100
        interval_sec: 60
      ban_duration_sec: 600
    description: "Rate limit: 100 req/min per IP, ban for 10 min"

  # Rule 2: Block SQL injection attempts
  - priority: 2000
    action: deny_403
    match:
      expr:
        expression: |
          evaluatePreconfiguredExpr('sqli-stable',
            ['owasp-crs-v030001-id942251-sqli',
             'owasp-crs-v030001-id942420-sqli',
             'owasp-crs-v030001-id942431-sqli'])
    description: "Block SQL injection attacks"

  # Rule 3: Block XSS attempts
  - priority: 3000
    action: deny_403
    match:
      expr:
        expression: |
          evaluatePreconfiguredExpr('xss-stable',
            ['owasp-crs-v030001-id941150-xss',
             'owasp-crs-v030001-id941320-xss'])
    description: "Block XSS attacks"

  # Rule 4: Block known bad IPs (threat intelligence)
  - priority: 4000
    action: deny_403
    match:
      versioned_expr: SRC_IPS_V1
      config:
        src_ip_ranges:
          - 192.0.2.0/24  # Example bad IP range
    description: "Block known malicious IPs"

  # Rule 5: Geo-blocking (optional)
  - priority: 5000
    action: deny_403
    match:
      expr:
        expression: 'origin.region_code == "CN" || origin.region_code == "RU"'
    description: "Block traffic from specific countries"
    preview: true  # Test mode, not enforcing

  # Rule 6: Allow all (default)
  - priority: 2147483647
    action: allow
    match:
      versioned_expr: SRC_IPS_V1
      config:
        src_ip_ranges:
          - "*"
    description: "Default allow rule"

# Additional settings
adaptive_protection:
  enabled: true
  auto_deploy:
    confidence_threshold: 0.8
    impacted_baseline_threshold: 0.1
```

---

## 🔐 Application Security

### Authentication Flow

```typescript
// src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getSecret } from '../config/secrets';
import { redis } from '../config/redis';
import { userRepository } from '../repositories/user.repository';
import { auditLog } from '../utils/audit';

export class AuthService {
  private readonly JWT_EXPIRY = '24h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly SALT_ROUNDS = 12;

  async login(email: string, password: string, ipAddress: string) {
    // Rate limiting check
    const rateLimitKey = `ratelimit:login:${email}`;
    const attempts = await redis.incr(rateLimitKey);

    if (attempts === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }

    if (attempts > 5) {
      await auditLog({
        action: 'auth.login_rate_limit',
        email,
        ipAddress,
        status: 'denied'
      });
      throw new Error('Too many login attempts. Please try again later.');
    }

    // Find user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      await auditLog({
        action: 'auth.login_failed',
        email,
        ipAddress,
        status: 'failure',
        reason: 'user_not_found'
      });
      throw new Error('Invalid credentials');
    }

    // Verify password (constant-time comparison via bcrypt)
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await auditLog({
        action: 'auth.login_failed',
        userId: user.id,
        email,
        ipAddress,
        status: 'failure',
        reason: 'invalid_password'
      });
      throw new Error('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Generate JWT token
    const privateKey = await getSecret('jwt-private-key');
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: this.JWT_EXPIRY,
        issuer: 'elara-api',
        audience: 'elara-platform'
      }
    );

    // Generate refresh token
    const refreshToken = await this.generateRefreshToken(user.id);

    // Store session in Redis
    const sessionId = crypto.randomUUID();
    await redis.setex(
      `session:${sessionId}`,
      86400, // 24 hours
      JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role,
        ipAddress,
        createdAt: new Date().toISOString()
      })
    );

    // Update user last login
    await userRepository.updateLastLogin(user.id);

    // Audit log
    await auditLog({
      action: 'auth.login_success',
      userId: user.id,
      email,
      ipAddress,
      status: 'success'
    });

    // Clear rate limit on successful login
    await redis.del(rateLimitKey);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        subscriptionTier: user.subscriptionTier
      }
    };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(refreshToken, this.SALT_ROUNDS);

    // Store hashed refresh token in database
    await userRepository.storeRefreshToken(userId, hashedToken);

    return refreshToken;
  }
}
```

### Input Validation

```typescript
// src/validators/scan.validator.ts
import Joi from 'joi';

export const createUrlScanValidator = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .required()
    .messages({
      'string.uri': 'Must be a valid HTTP or HTTPS URL',
      'string.max': 'URL must not exceed 2048 characters',
      'any.required': 'URL is required'
    }),

  options: Joi.object({
    deepScan: Joi.boolean().default(false),
    screenshotEnabled: Joi.boolean().default(true),
    priority: Joi.string()
      .valid('low', 'normal', 'high')
      .default('normal')
  }).optional()
});

export const createMessageScanValidator = Joi.object({
  message: Joi.string()
    .min(1)
    .max(10000)
    .required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message must not exceed 10000 characters'
    }),

  sender: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Sender must be a valid E.164 phone number'
    }),

  receivedAt: Joi.date().iso().optional()
});

// SQL Injection prevention example
export async function executeQuery(query: string, params: any[]) {
  // NEVER do this:
  // const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`);

  // ALWAYS use parameterized queries:
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  return result.rows;
}
```

### Content Security Policy

```typescript
// src/middleware/security.ts
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React
        "https://www.google.com/recaptcha/",
        "https://www.gstatic.com/recaptcha/"
      ],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind CSS
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.elara.com",
        "wss://api.elara.com"
      ],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [
        "https://www.google.com/recaptcha/",
        "https://recaptcha.google.com/recaptcha/"
      ],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny' // Prevent clickjacking
  },
  noSniff: true, // Prevent MIME sniffing
  xssFilter: true, // Enable XSS filter
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});
```

---

## 🔒 Data Security

### Encryption at Rest (CMEK)

```hcl
# terraform/modules/security/kms.tf
resource "google_kms_key_ring" "elara_keyring" {
  name     = "elara-keyring"
  location = var.region
  project  = var.project_id
}

# Cloud SQL encryption key
resource "google_kms_crypto_key" "cloudsql_key" {
  name     = "cloudsql-encryption-key"
  key_ring = google_kms_key_ring.elara_keyring.id

  purpose = "ENCRYPT_DECRYPT"

  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
}

# Cloud Storage encryption key
resource "google_kms_crypto_key" "storage_key" {
  name     = "storage-encryption-key"
  key_ring = google_kms_key_ring.elara_keyring.id

  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# Grant Cloud SQL service account access to key
resource "google_kms_crypto_key_iam_member" "cloudsql_key_user" {
  crypto_key_id = google_kms_crypto_key.cloudsql_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
}
```

### Data Classification and Handling

```typescript
// src/utils/dataClassification.ts

export enum DataClassification {
  PUBLIC = 'public',           // No special handling
  INTERNAL = 'internal',       // Access controls
  CONFIDENTIAL = 'confidential', // Encryption + audit
  RESTRICTED = 'restricted'    // CMEK + DLP + strict access
}

export interface ClassifiedData {
  classification: DataClassification;
  data: any;
  owner: string;
  accessLog: boolean;
}

export function classifyData(data: any, type: string): DataClassification {
  // Email addresses, passwords, API keys = RESTRICTED
  if (type === 'password' || type === 'apiKey' || type === 'privateKey') {
    return DataClassification.RESTRICTED;
  }

  // PII (names, addresses, phone numbers) = CONFIDENTIAL
  if (type === 'email' || type === 'phone' || type === 'address') {
    return DataClassification.CONFIDENTIAL;
  }

  // Scan results, threat data = INTERNAL
  if (type === 'scanResult' || type === 'threatData') {
    return DataClassification.INTERNAL;
  }

  // Everything else = PUBLIC
  return DataClassification.PUBLIC;
}

// PII Redaction for logs
export function redactPII(logMessage: string): string {
  // Redact email addresses
  logMessage = logMessage.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );

  // Redact phone numbers
  logMessage = logMessage.replace(
    /\+?[1-9]\d{1,14}/g,
    '[PHONE_REDACTED]'
  );

  // Redact credit card numbers
  logMessage = logMessage.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '[CC_REDACTED]'
  );

  // Redact API keys
  logMessage = logMessage.replace(
    /elara_[a-z]{2}_[A-Za-z0-9]{32}/g,
    '[API_KEY_REDACTED]'
  );

  return logMessage;
}
```

---

## 🔑 Secrets Management

### Secret Manager Integration

```typescript
// src/config/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

const secretCache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 3600000; // 1 hour

export async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const secretPath = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await secretClient.accessSecretVersion({
      name: secretPath
    });

    const secretValue = version.payload?.data?.toString() || '';

    // Cache the secret
    secretCache.set(secretName, {
      value: secretValue,
      expiry: Date.now() + CACHE_TTL
    });

    return secretValue;
  } catch (error) {
    console.error(`Failed to fetch secret ${secretName}:`, error);
    throw new Error(`Secret ${secretName} not found`);
  }
}

// Rotate secret programmatically
export async function rotateSecret(
  secretName: string,
  newValue: string
): Promise<void> {
  const projectId = process.env.GCP_PROJECT_ID;
  const secretPath = `projects/${projectId}/secrets/${secretName}`;

  // Add new version
  await secretClient.addSecretVersion({
    parent: secretPath,
    payload: {
      data: Buffer.from(newValue, 'utf8')
    }
  });

  // Invalidate cache
  secretCache.delete(secretName);

  // Audit log
  console.log(`Secret ${secretName} rotated successfully`);
}
```

### Secret Naming Convention

```
Format: {environment}-{service}-{secret-type}

Examples:
- production-backend-db-password
- production-backend-jwt-private-key
- production-backend-jwt-public-key
- production-backend-redis-password
- production-backend-stripe-api-key
- production-backend-sendgrid-api-key
- production-backend-virustotal-api-key
```

---

## 🔍 Security Monitoring and Detection

### Security Command Center Configuration

```yaml
# Security Command Center Premium Tier

enabled_modules:
  - SECURITY_HEALTH_ANALYTICS
  - EVENT_THREAT_DETECTION
  - WEB_SECURITY_SCANNER
  - CONTAINER_THREAT_DETECTION

security_health_analytics:
  detectors:
    - OPEN_FIREWALL_RULE
    - PUBLIC_SQL_INSTANCE
    - PUBLIC_BUCKET_ACL
    - WEAK_SSL_POLICY
    - ADMIN_SERVICE_ACCOUNT
    - KMS_KEY_NOT_ROTATED
    - BUCKET_LOGGING_DISABLED
    - AUDIT_LOGGING_DISABLED

event_threat_detection:
  detectors:
    - MALWARE_DETECTED
    - CRYPTOMINING_DETECTED
    - BRUTE_FORCE_ATTACK
    - DATA_EXFILTRATION
    - IAM_ANOMALOUS_GRANT
    - PRIVILEGE_ESCALATION

notification_config:
  pubsub_topic: projects/elara-production/topics/scc-notifications
  description: "Security findings notifications"
  streaming_config:
    filter: 'severity="HIGH" OR severity="CRITICAL"'
```

### SIEM Integration

```typescript
// src/utils/siem.ts
import { Logging } from '@google-cloud/logging';

const logging = new Logging();
const securityLog = logging.log('elara-security-events');

export interface SecurityEvent {
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ipAddress?: string;
  resource?: string;
  action?: string;
  result?: 'success' | 'failure' | 'denied';
  details?: Record<string, any>;
}

export async function logSecurityEvent(event: SecurityEvent) {
  const metadata = {
    severity: event.severity,
    labels: {
      event_type: event.eventType,
      environment: process.env.NODE_ENV || 'production'
    }
  };

  const entry = securityLog.entry(metadata, {
    timestamp: new Date().toISOString(),
    ...event,
    // Add correlation ID for tracing
    correlationId: crypto.randomUUID()
  });

  await securityLog.write(entry);

  // Send to alerting if HIGH or CRITICAL
  if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
    await sendSecurityAlert(event);
  }
}

// Example usage
await logSecurityEvent({
  eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  severity: 'HIGH',
  userId: 'user_123',
  ipAddress: '203.0.113.5',
  resource: '/api/v1/admin/users',
  action: 'DELETE',
  result: 'denied',
  details: {
    reason: 'Insufficient permissions',
    userRole: 'user',
    requiredRole: 'admin'
  }
});
```

---

## 🚨 Incident Response

### Incident Response Plan

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        INCIDENT RESPONSE LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: DETECTION & ANALYSIS (15 minutes)
├── Alert triggered (SCC, Cloud Logging, Monitoring)
├── On-call engineer receives notification (PagerDuty)
├── Initial triage
│   ├── Classify severity (P0-P4)
│   ├── Determine scope
│   └── Assess impact
└── Create incident ticket

PHASE 2: CONTAINMENT (30 minutes)
├── Short-term containment
│   ├── Isolate affected resources
│   ├── Block malicious IPs (Cloud Armor)
│   ├── Revoke compromised credentials
│   └── Enable additional logging
├── Long-term containment
│   ├── Patch vulnerabilities
│   ├── Update firewall rules
│   └── Rotate secrets
└── Evidence preservation
    ├── Snapshot VMs
    ├── Export logs
    └── Document timeline

PHASE 3: ERADICATION (1-2 hours)
├── Remove threat actor access
├── Delete malware/backdoors
├── Patch vulnerabilities
├── Strengthen controls
└── Verify clean state

PHASE 4: RECOVERY (2-4 hours)
├── Restore services from backups
├── Verify functionality
├── Gradual traffic restoration
├── Enhanced monitoring
└── Document changes

PHASE 5: POST-INCIDENT (1 week)
├── Root cause analysis (RCA)
├── Lessons learned meeting
├── Update runbooks
├── Implement preventive measures
└── Report to stakeholders
```

### Incident Severity Classification

| Severity | Definition | Response Time | Example |
|----------|-----------|---------------|---------|
| **P0 - Critical** | Complete service outage, data breach | 15 minutes | Database compromised, all services down |
| **P1 - High** | Major functionality impaired | 1 hour | API unavailable, authentication failing |
| **P2 - Medium** | Minor functionality impaired | 4 hours | Scan service slow, non-critical feature broken |
| **P3 - Low** | Cosmetic issues, low impact | 1 business day | UI bug, documentation error |
| **P4 - Informational** | No customer impact | Best effort | Security scan finding (informational) |

---

## ✅ Security Testing

### Security Testing Strategy

```yaml
Security Testing Layers:

1. STATIC APPLICATION SECURITY TESTING (SAST)
   Tools:
     - ESLint (with security plugins)
     - Semgrep (custom security rules)
     - SonarQube
   Frequency: Every commit (CI/CD)
   Coverage: 100% of code

2. DYNAMIC APPLICATION SECURITY TESTING (DAST)
   Tools:
     - OWASP ZAP
     - Burp Suite
     - Google Cloud Security Scanner
   Frequency: Weekly (staging environment)
   Coverage: All public endpoints

3. SOFTWARE COMPOSITION ANALYSIS (SCA)
   Tools:
     - Snyk
     - npm audit
     - Dependabot
   Frequency: Every commit + daily scans
   Coverage: All dependencies

4. CONTAINER SECURITY SCANNING
   Tools:
     - Trivy
     - Google Container Analysis
   Frequency: Every build (CI/CD)
   Coverage: All container images

5. INFRASTRUCTURE SECURITY SCANNING
   Tools:
     - Terraform Sentinel
     - Checkov
     - tfsec
   Frequency: Every Terraform change
   Coverage: All infrastructure code

6. PENETRATION TESTING
   Scope: External + Internal
   Frequency: Quarterly
   Provider: Third-party security firm
   Coverage: Full platform

7. BUG BOUNTY PROGRAM
   Platform: HackerOne / Bugcrowd
   Scope: Production environment
   Frequency: Continuous
   Coverage: All public-facing services
```

---

**Document Status**: ✅ **APPROVED FOR SECURITY REVIEW**

**Next Document**: COMPLIANCE_GOVERNANCE.md

**Security Posture**: Enterprise-grade, Zero-Trust, Defense-in-Depth
**Compliance**: SOC 2, ISO 27001, GDPR, CCPA ready
