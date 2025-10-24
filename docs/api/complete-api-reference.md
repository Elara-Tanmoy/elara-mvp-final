# Elara Platform - Complete API Reference

**Document Version**: 2.0
**Last Updated**: 2025-10-24
**Status**: Production
**Base URL**: `https://api.elara.com/v2` (Production) | `http://35.199.176.26/api/v2` (Development)
**Total Endpoints**: 80+

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Admin Panel API](#admin-panel-api)
3. [Chatbot API](#chatbot-api)
4. [OAuth Integration](#oauth-integration)
5. [Scanning API](#scanning-api)
6. [Threat Intelligence API](#threat-intelligence-api)
7. [Proxy API](#proxy-api)
8. [Analytics API](#analytics-api)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)
11. [Webhooks](#webhooks)

---

## 🔐 Authentication

All API requests (except OAuth flows and public endpoints) require authentication.

### Authentication Methods

**1. JWT Bearer Token** (Recommended for web/mobile apps)

```http
Authorization: Bearer <access_token>
```

**2. API Key** (For server-to-server integration)

```http
X-API-Key: <api_key>
X-API-Secret: <api_secret>
```

**3. Session Cookie** (For browser-based apps)

```http
Cookie: elara_session=<session_id>
```

### Token Endpoints

#### POST `/v2/auth/register`

Register a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corp"
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "clxxx123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "organizationId": "clxxx456"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1...",
    "expiresIn": 1800
  }
}
```

---

#### POST `/v2/auth/login`

Login with email and password.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "clxxx123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "lastLoginAt": "2025-10-24T10:30:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1...",
    "expiresIn": 1800
  }
}
```

---

#### POST `/v2/auth/refresh`

Refresh access token using refresh token.

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1..."
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1...",
  "expiresIn": 1800
}
```

---

#### POST `/v2/auth/logout`

Logout and revoke tokens.

**Headers**: `Authorization: Bearer <access_token>`

**Response** (204 No Content)

---

## 🛠️ Admin Panel API

**Base Path**: `/v2/admin`
**Authentication**: Required (Admin role)
**Rate Limit**: 1000 requests/hour

### Configuration Management

#### GET `/v2/admin/schema`

Get complete scan configuration schema (categories, checks, TI sources, defaults).

**Response** (200 OK):
```json
{
  "categories": [
    {
      "name": "Domain & Registration Analysis",
      "maxPoints": 40,
      "checks": ["domain_age", "whois_privacy", "bulk_registration"]
    },
    {
      "name": "SSL/TLS Security",
      "maxPoints": 50,
      "checks": ["ssl_valid", "cert_authority", "tls_version"]
    }
    // ... 15 more categories
  ],
  "tiSources": [
    {
      "id": "phishtank",
      "name": "PhishTank",
      "weight": 20,
      "enabled": true
    }
    // ... 17 more sources
  ],
  "defaults": {
    "maxScore": 570,
    "aiMultiplierRange": { "min": 0.5, "max": 1.5 }
  }
}
```

---

#### GET `/v2/admin/config`

Get all scan configurations.

**Query Parameters**:
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 100) - Results per page
- `sortBy` (string, default: "createdAt") - Sort field
- `order` (string, default: "desc") - Sort order (asc/desc)

**Response** (200 OK):
```json
{
  "configurations": [
    {
      "id": "clxxx789",
      "name": "Default Configuration",
      "version": "1.0.0",
      "isActive": true,
      "isDefault": true,
      "maxScore": 570,
      "usageCount": 1523,
      "createdAt": "2025-10-01T00:00:00Z",
      "updatedAt": "2025-10-24T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

#### GET `/v2/admin/config/active`

Get the currently active configuration.

**Response** (200 OK):
```json
{
  "id": "clxxx789",
  "name": "Default Configuration",
  "version": "1.0.0",
  "isActive": true,
  "maxScore": 570,
  "categoryWeights": {
    "domain_registration": 40,
    "ssl_tls": 50,
    "dns": 40
    // ... 14 more
  },
  "checkWeights": {
    "domain_age": 20,
    "whois_privacy": 6,
    "ssl_valid": 15
    // ... 97 more checks
  },
  "aiModelConfig": {
    "models": ["claude-sonnet-4.5", "gpt-4o", "gemini-1.5-flash"],
    "weights": { "claude": 1.5, "gpt4": 1.2, "gemini": 1.0 }
  },
  "tiConfig": {
    "enabled": true,
    "sources": ["phishtank", "urlhaus", "virustotal"],
    "timeout": 5000
  }
}
```

---

#### GET `/v2/admin/config/:id`

Get a specific configuration by ID.

**Path Parameters**:
- `id` (string, required) - Configuration ID

**Response** (200 OK): Same as `/config/active`

---

#### POST `/v2/admin/config`

Create a new scan configuration.

**Request Body**:
```json
{
  "name": "High Security Configuration",
  "description": "Stricter thresholds for financial sector",
  "version": "1.0.0",
  "maxScore": 650,
  "categoryWeights": {
    "domain_registration": 50,
    "ssl_tls": 60,
    "threat_intelligence": 120
  },
  "checkWeights": {
    "domain_age": 25,
    "ssl_valid": 20
  },
  "aiModelConfig": {
    "models": ["claude-sonnet-4.5", "gpt-4o"],
    "requireConsensus": true
  }
}
```

**Response** (201 Created):
```json
{
  "id": "clxxx999",
  "name": "High Security Configuration",
  "version": "1.0.0",
  "isActive": false,
  "createdAt": "2025-10-24T12:00:00Z"
}
```

---

#### PUT `/v2/admin/config/:id`

Update an existing configuration.

**Path Parameters**:
- `id` (string, required) - Configuration ID

**Request Body**: Same as POST `/config`

**Response** (200 OK):
```json
{
  "id": "clxxx999",
  "name": "High Security Configuration",
  "version": "1.1.0",
  "updatedAt": "2025-10-24T12:30:00Z"
}
```

---

#### PATCH `/v2/admin/config/:id/activate`

Activate a configuration (deactivates others).

**Path Parameters**:
- `id` (string, required) - Configuration ID

**Response** (200 OK):
```json
{
  "message": "Configuration activated successfully",
  "id": "clxxx999",
  "isActive": true
}
```

---

#### DELETE `/v2/admin/config/:id`

Delete a configuration.

**Path Parameters**:
- `id` (string, required) - Configuration ID

**Response** (204 No Content)

**Error Cases**:
- `400 Bad Request` - Cannot delete active or default configuration
- `404 Not Found` - Configuration not found

---

#### GET `/v2/admin/config/:id/export`

Export configuration as JSON.

**Path Parameters**:
- `id` (string, required) - Configuration ID

**Response** (200 OK):
```json
{
  "exportVersion": "2.0",
  "exportedAt": "2025-10-24T12:45:00Z",
  "configuration": {
    "name": "High Security Configuration",
    "version": "1.1.0",
    "maxScore": 650
    // ... full config
  }
}
```

---

#### POST `/v2/admin/config/import`

Import a configuration from JSON.

**Request Body**: Output from `/config/:id/export`

**Response** (201 Created):
```json
{
  "id": "clxxx111",
  "name": "Imported Configuration",
  "message": "Configuration imported successfully"
}
```

---

#### POST `/v2/admin/config/:id/clone`

Clone an existing configuration.

**Path Parameters**:
- `id` (string, required) - Source configuration ID

**Request Body**:
```json
{
  "name": "Cloned High Security Configuration",
  "description": "Clone for testing"
}
```

**Response** (201 Created):
```json
{
  "id": "clxxx222",
  "name": "Cloned High Security Configuration",
  "clonedFrom": "clxxx999",
  "createdAt": "2025-10-24T13:00:00Z"
}
```

---

#### GET `/v2/admin/config/:id/history`

Get configuration change history.

**Path Parameters**:
- `id` (string, required) - Configuration ID

**Query Parameters**:
- `limit` (number, default: 50) - Number of history records

**Response** (200 OK):
```json
{
  "history": [
    {
      "id": "clhist123",
      "version": "1.1.0",
      "changes": {
        "categoryWeights.threat_intelligence": { "old": 100, "new": 120 }
      },
      "changedBy": "admin@elara.com",
      "changeDescription": "Increased TI weight for better detection",
      "createdAt": "2025-10-24T12:30:00Z"
    }
  ]
}
```

---

### Calibration & Testing

#### POST `/v2/admin/calibrate`

Run calibration scan with custom configuration.

**Request Body**:
```json
{
  "url": "https://example.com",
  "configurationId": "clxxx999"
}
```

**Response** (200 OK):
```json
{
  "scanId": "clscan123",
  "url": "https://example.com",
  "baseScore": 245,
  "aiMultiplier": 1.2,
  "finalScore": 294,
  "riskLevel": "medium",
  "categoryResults": {
    "domain_registration": { "score": 15, "maxPoints": 50 },
    "ssl_tls": { "score": 0, "maxPoints": 60 },
    "threat_intelligence": { "score": 40, "maxPoints": 120 }
  },
  "scanDuration": 4523
}
```

---

#### POST `/v2/admin/calibrate/compare`

Compare scan results across multiple configurations.

**Request Body**:
```json
{
  "url": "https://example.com",
  "configurationIds": ["clxxx789", "clxxx999"]
}
```

**Response** (200 OK):
```json
{
  "url": "https://example.com",
  "comparisons": [
    {
      "configurationId": "clxxx789",
      "configurationName": "Default Configuration",
      "baseScore": 210,
      "finalScore": 252,
      "riskLevel": "medium",
      "scanDuration": 4200
    },
    {
      "configurationId": "clxxx999",
      "configurationName": "High Security Configuration",
      "baseScore": 245,
      "finalScore": 294,
      "riskLevel": "medium",
      "scanDuration": 4523
    }
  ],
  "scoreDifference": 42,
  "categoryDifferences": {
    "threat_intelligence": { "default": 35, "highSec": 40, "diff": 5 }
  }
}
```

---

### Presets

#### GET `/v2/admin/presets`

Get available configuration presets.

**Response** (200 OK):
```json
{
  "presets": [
    {
      "name": "balanced",
      "displayName": "Balanced Detection",
      "description": "Standard security with balanced false positive vs detection rate"
    },
    {
      "name": "strict",
      "displayName": "High Security",
      "description": "Maximum detection, higher false positive rate"
    },
    {
      "name": "lenient",
      "displayName": "Low False Positives",
      "description": "Minimize false positives, may miss some threats"
    }
  ]
}
```

---

#### POST `/v2/admin/preset/:presetName/apply`

Apply a preset to active configuration.

**Path Parameters**:
- `presetName` (string, required) - Preset name (balanced, strict, lenient)

**Response** (200 OK):
```json
{
  "message": "Preset 'strict' applied successfully",
  "configurationId": "clxxx789",
  "changes": {
    "categoryWeights.threat_intelligence": { "old": 100, "new": 150 },
    "checkWeights.domain_age": { "old": 20, "new": 30 }
  }
}
```

---

### Statistics

#### GET `/v2/admin/stats`

Get scan statistics summary.

**Query Parameters**:
- `from` (ISO8601 date, optional) - Start date
- `to` (ISO8601 date, optional) - End date

**Response** (200 OK):
```json
{
  "totalScans": 15234,
  "averageScore": 187,
  "riskDistribution": {
    "safe": 8234,
    "low": 3421,
    "medium": 2123,
    "high": 1234,
    "critical": 222
  },
  "averageScanDuration": 4200,
  "cacheHitRate": 0.73,
  "topCategories": [
    { "category": "threat_intelligence", "avgScore": 45 },
    { "category": "domain_registration", "avgScore": 32 }
  ]
}
```

---

### Check Definition Management (Enterprise)

#### GET `/v2/admin/checks`

Get all security check definitions.

**Query Parameters**:
- `category` (string, optional) - Filter by category
- `enabled` (boolean, optional) - Filter by enabled status

**Response** (200 OK):
```json
{
  "checks": [
    {
      "id": "clchk123",
      "checkId": "ssl_valid",
      "name": "SSL Certificate Validity",
      "description": "Checks if SSL certificate is valid and not expired",
      "category": "SSL/TLS Security",
      "checkType": "active",
      "defaultPoints": 15,
      "severity": "high",
      "enabled": true,
      "timeout": 5000,
      "executionOrder": 10,
      "version": "1.0.0"
    }
    // ... 99 more checks
  ]
}
```

---

#### POST `/v2/admin/checks`

Create a new security check definition.

**Request Body**:
```json
{
  "checkId": "custom_header_check",
  "name": "Custom Security Headers",
  "description": "Check for CSP, X-Frame-Options, etc.",
  "category": "HTTP Headers & Security",
  "checkType": "active",
  "defaultPoints": 10,
  "severity": "medium",
  "timeout": 3000,
  "handlerFunction": "checkSecurityHeaders",
  "validationRules": {
    "requiredHeaders": ["Content-Security-Policy", "X-Frame-Options"]
  }
}
```

**Response** (201 Created):
```json
{
  "id": "clchk456",
  "checkId": "custom_header_check",
  "message": "Check definition created successfully"
}
```

---

#### PUT `/v2/admin/checks/:id`

Update a check definition.

**Path Parameters**:
- `id` (string, required) - Check definition ID

**Request Body**: Same as POST `/checks`

**Response** (200 OK):
```json
{
  "id": "clchk456",
  "message": "Check definition updated successfully"
}
```

---

#### DELETE `/v2/admin/checks/:id`

Delete a check definition.

**Path Parameters**:
- `id` (string, required) - Check definition ID

**Response** (204 No Content)

**Error Cases**:
- `400 Bad Request` - Cannot delete system checks (isSystemCheck: true)

---

#### POST `/v2/admin/checks/:id/toggle`

Enable/disable a check.

**Path Parameters**:
- `id` (string, required) - Check definition ID

**Request Body**:
```json
{
  "enabled": false
}
```

**Response** (200 OK):
```json
{
  "id": "clchk456",
  "enabled": false,
  "message": "Check disabled successfully"
}
```

---

#### POST `/v2/admin/checks/:id/test`

Test a check's external connection (if applicable).

**Path Parameters**:
- `id` (string, required) - Check definition ID

**Response** (200 OK):
```json
{
  "checkId": "virustotal_check",
  "connectionStatus": "success",
  "responseTime": 234,
  "apiQuota": {
    "used": 1523,
    "limit": 5000,
    "resetAt": "2025-10-25T00:00:00Z"
  }
}
```

---

### AI Model Management (Enterprise)

#### GET `/v2/admin/ai-models`

Get all AI model definitions.

**Response** (200 OK):
```json
{
  "models": [
    {
      "id": "clai123",
      "modelId": "claude-sonnet-4.5",
      "name": "Claude Sonnet 4.5",
      "provider": "anthropic",
      "enabled": true,
      "weight": 1.5,
      "rank": 1,
      "contextWindow": 200000,
      "avgResponseTime": 1800,
      "reliability": 0.98,
      "costPer1kTokens": 0.003,
      "useInConsensus": true
    },
    {
      "id": "clai456",
      "modelId": "gpt-4o",
      "name": "GPT-4o",
      "provider": "openai",
      "enabled": true,
      "weight": 1.2,
      "rank": 2,
      "contextWindow": 128000,
      "avgResponseTime": 2200,
      "reliability": 0.95,
      "costPer1kTokens": 0.005
    }
  ]
}
```

---

#### POST `/v2/admin/ai-models`

Add a new AI model.

**Request Body**:
```json
{
  "modelId": "gemini-2.0-flash",
  "name": "Gemini 2.0 Flash",
  "provider": "google",
  "modelEndpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
  "apiKey": "encrypted_key_here",
  "contextWindow": 1000000,
  "weight": 1.0,
  "rank": 3,
  "enabled": true
}
```

**Response** (201 Created):
```json
{
  "id": "clai789",
  "modelId": "gemini-2.0-flash",
  "message": "AI model added successfully"
}
```

---

#### PUT `/v2/admin/ai-models/:id`

Update AI model configuration.

**Path Parameters**:
- `id` (string, required) - AI model ID

**Request Body**: Same as POST `/ai-models`

**Response** (200 OK):
```json
{
  "id": "clai789",
  "message": "AI model updated successfully"
}
```

---

#### DELETE `/v2/admin/ai-models/:id`

Delete an AI model.

**Path Parameters**:
- `id` (string, required) - AI model ID

**Response** (204 No Content)

---

#### POST `/v2/admin/ai-models/:id/test`

Test AI model connection and performance.

**Path Parameters**:
- `id` (string, required) - AI model ID

**Request Body**:
```json
{
  "testPrompt": "Analyze this URL for phishing: https://example.com"
}
```

**Response** (200 OK):
```json
{
  "modelId": "claude-sonnet-4.5",
  "connectionStatus": "success",
  "responseTime": 1823,
  "tokensUsed": 234,
  "cost": 0.000702,
  "response": {
    "verdict": "safe",
    "confidence": 0.95,
    "reasoning": "Legitimate domain with valid SSL..."
  }
}
```

---

### Threat Intelligence Source Management (Enterprise)

#### GET `/v2/admin/ti-sources`

Get all threat intelligence sources.

**Response** (200 OK):
```json
{
  "sources": [
    {
      "id": "clti123",
      "name": "PhishTank",
      "type": "phishing",
      "enabled": true,
      "totalIndicators": 45234,
      "lastSyncAt": "2025-10-24T10:00:00Z",
      "syncFrequency": 3600,
      "defaultWeight": 20,
      "priority": 1,
      "reliability": 0.9,
      "category": "general"
    }
    // ... 17 more sources
  ]
}
```

---

#### POST `/v2/admin/ti-sources`

Add a new threat intelligence source.

**Request Body**:
```json
{
  "name": "Custom Threat Feed",
  "type": "malware",
  "url": "https://custom-feed.example.com/api/v1/indicators",
  "apiKey": "encrypted_key_here",
  "syncFrequency": 7200,
  "defaultWeight": 15,
  "priority": 5,
  "enabled": true,
  "category": "specialized"
}
```

**Response** (201 Created):
```json
{
  "id": "clti456",
  "name": "Custom Threat Feed",
  "message": "Threat intelligence source added successfully"
}
```

---

#### PUT `/v2/admin/ti-sources/:id`

Update threat intelligence source.

**Path Parameters**:
- `id` (string, required) - TI source ID

**Request Body**: Same as POST `/ti-sources`

**Response** (200 OK):
```json
{
  "id": "clti456",
  "message": "Threat intelligence source updated successfully"
}
```

---

#### DELETE `/v2/admin/ti-sources/:id`

Delete a threat intelligence source.

**Path Parameters**:
- `id` (string, required) - TI source ID

**Response** (204 No Content)

---

#### POST `/v2/admin/ti-sources/:id/test`

Test TI source connection and sync.

**Path Parameters**:
- `id` (string, required) - TI source ID

**Response** (200 OK):
```json
{
  "sourceId": "clti456",
  "connectionStatus": "success",
  "responseTime": 456,
  "indicatorsAvailable": 1234,
  "sampleIndicators": [
    { "type": "url", "value": "http://phishing-example.com", "threatType": "phishing" }
  ]
}
```

---

### AI Consensus Configuration (Enterprise)

#### GET `/v2/admin/consensus-configs`

Get all AI consensus configurations.

**Response** (200 OK):
```json
{
  "configs": [
    {
      "id": "clcon123",
      "name": "Default Consensus",
      "isActive": true,
      "strategy": "weighted_vote",
      "minimumModels": 2,
      "confidenceThreshold": 0.7,
      "enabledModels": ["claude-sonnet-4.5", "gpt-4o", "gemini-1.5-flash"]
    }
  ]
}
```

---

#### POST `/v2/admin/consensus-configs`

Create AI consensus configuration.

**Request Body**:
```json
{
  "name": "Strict Consensus",
  "strategy": "unanimous",
  "minimumModels": 3,
  "confidenceThreshold": 0.85,
  "enabledModels": ["claude-sonnet-4.5", "gpt-4o", "gemini-1.5-flash"],
  "penalizeDisagreement": true,
  "disagreementPenalty": 0.15
}
```

**Response** (201 Created):
```json
{
  "id": "clcon456",
  "name": "Strict Consensus",
  "message": "Consensus configuration created successfully"
}
```

---

#### PUT `/v2/admin/consensus-configs/:id`

Update consensus configuration.

**Path Parameters**:
- `id` (string, required) - Consensus config ID

**Request Body**: Same as POST `/consensus-configs`

**Response** (200 OK):
```json
{
  "id": "clcon456",
  "message": "Consensus configuration updated successfully"
}
```

---

#### DELETE `/v2/admin/consensus-configs/:id`

Delete consensus configuration.

**Path Parameters**:
- `id` (string, required) - Consensus config ID

**Response** (204 No Content)

---

#### POST `/v2/admin/consensus-configs/:id/activate`

Activate a consensus configuration.

**Path Parameters**:
- `id` (string, required) - Consensus config ID

**Response** (200 OK):
```json
{
  "id": "clcon456",
  "isActive": true,
  "message": "Consensus configuration activated successfully"
}
```

---

### Scan History

#### GET `/v2/admin/scans`

Get scan history with pagination and filtering.

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `riskLevel` (string, optional) - Filter by risk level
- `from` (ISO8601 date, optional) - Start date
- `to` (ISO8601 date, optional) - End date
- `sortBy` (string, default: "createdAt")
- `order` (string, default: "desc")

**Response** (200 OK):
```json
{
  "scans": [
    {
      "id": "clscan789",
      "url": "https://suspicious-site.com",
      "baseScore": 342,
      "finalScore": 410,
      "riskLevel": "critical",
      "reachabilityState": "ONLINE",
      "scanDuration": 5234,
      "createdAt": "2025-10-24T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15234,
    "totalPages": 762
  }
}
```

---

#### GET `/v2/admin/scans/stats`

Get scan statistics.

**Query Parameters**:
- `from` (ISO8601 date, optional)
- `to` (ISO8601 date, optional)

**Response** (200 OK):
```json
{
  "totalScans": 15234,
  "averageScore": 187,
  "averageDuration": 4200,
  "riskDistribution": {
    "safe": 8234,
    "low": 3421,
    "medium": 2123,
    "high": 1234,
    "critical": 222
  },
  "reachabilityDistribution": {
    "ONLINE": 13234,
    "OFFLINE": 1234,
    "PARKED": 456,
    "WAF_CHALLENGE": 234,
    "SINKHOLE": 76
  }
}
```

---

#### GET `/v2/admin/scans/recent`

Get recent scans.

**Query Parameters**:
- `limit` (number, default: 10, max: 50)

**Response** (200 OK):
```json
{
  "scans": [
    {
      "id": "clscan789",
      "url": "https://suspicious-site.com",
      "finalScore": 410,
      "riskLevel": "critical",
      "createdAt": "2025-10-24T14:30:00Z"
    }
    // ... 9 more
  ]
}
```

---

#### GET `/v2/admin/scans/:id`

Get detailed scan results.

**Path Parameters**:
- `id` (string, required) - Scan ID

**Response** (200 OK):
```json
{
  "id": "clscan789",
  "url": "https://suspicious-site.com",
  "configurationId": "clxxx789",
  "baseScore": 342,
  "aiMultiplier": 1.2,
  "finalScore": 410,
  "riskLevel": "critical",
  "reachabilityState": "ONLINE",
  "pipelineUsed": "FULL",
  "categoryResults": {
    "domain_registration": {
      "score": 35,
      "maxPoints": 40,
      "findings": [
        {
          "check": "domain_age",
          "result": "3 days old",
          "severity": "CRITICAL",
          "points": 20
        },
        {
          "check": "whois_privacy",
          "result": "Privacy protection enabled",
          "severity": "MEDIUM",
          "points": 6
        }
      ]
    }
    // ... 16 more categories
  },
  "aiAnalysis": {
    "models": [
      {
        "model": "claude-sonnet-4.5",
        "verdict": "phishing",
        "confidence": 0.95,
        "reasoning": "Suspicious domain age, mimics legitimate brand..."
      },
      {
        "model": "gpt-4o",
        "verdict": "phishing",
        "confidence": 0.92
      },
      {
        "model": "gemini-1.5-flash",
        "verdict": "suspicious",
        "confidence": 0.88
      }
    ],
    "consensus": {
      "verdict": "phishing",
      "confidence": 0.92,
      "multiplier": 1.2
    }
  },
  "tiResults": {
    "phishtank": { "match": true, "threatType": "phishing", "points": 20 },
    "urlhaus": { "match": false },
    "virustotal": { "match": true, "positives": 12, "total": 89, "points": 30 }
  },
  "performanceMetrics": {
    "totalDuration": 5234,
    "reachabilityCheck": 234,
    "passiveAnalysis": 1234,
    "activeAnalysis": 2345,
    "aiAnalysis": 1234,
    "tiChecks": 187
  },
  "createdAt": "2025-10-24T14:30:00Z"
}
```

---

#### DELETE `/v2/admin/scans/:id`

Delete a scan result.

**Path Parameters**:
- `id` (string, required) - Scan ID

**Response** (204 No Content)

---

#### POST `/v2/admin/scans/bulk-delete`

Delete multiple scan results.

**Request Body**:
```json
{
  "scanIds": ["clscan123", "clscan456", "clscan789"]
}
```

**Response** (200 OK):
```json
{
  "deleted": 3,
  "failed": 0,
  "message": "3 scans deleted successfully"
}
```

---

### Analytics & Reporting

#### GET `/v2/admin/analytics/overview`

Get analytics overview dashboard.

**Query Parameters**:
- `from` (ISO8601 date, optional)
- `to` (ISO8601 date, optional)

**Response** (200 OK):
```json
{
  "period": {
    "from": "2025-10-17T00:00:00Z",
    "to": "2025-10-24T23:59:59Z"
  },
  "totalScans": 3456,
  "uniqueUrls": 2134,
  "averageScore": 189,
  "highRiskUrls": 234,
  "topCategories": [
    { "category": "threat_intelligence", "avgScore": 45, "count": 1234 },
    { "category": "domain_registration", "avgScore": 32, "count": 987 }
  ],
  "trends": {
    "scansPerDay": [
      { "date": "2025-10-17", "count": 456 },
      { "date": "2025-10-18", "count": 512 }
      // ... 5 more days
    ]
  }
}
```

---

#### GET `/v2/admin/analytics/timeseries`

Get time-series analytics data.

**Query Parameters**:
- `metric` (string, required) - Metric to track (scans, avgScore, highRisk, etc.)
- `from` (ISO8601 date, required)
- `to` (ISO8601 date, required)
- `interval` (string, default: "day") - Granularity (hour, day, week, month)

**Response** (200 OK):
```json
{
  "metric": "scans",
  "interval": "day",
  "data": [
    { "timestamp": "2025-10-17T00:00:00Z", "value": 456 },
    { "timestamp": "2025-10-18T00:00:00Z", "value": 512 },
    { "timestamp": "2025-10-19T00:00:00Z", "value": 489 }
    // ... more data points
  ]
}
```

---

#### GET `/v2/admin/analytics/categories`

Get category-wise analytics.

**Query Parameters**:
- `from` (ISO8601 date, optional)
- `to` (ISO8601 date, optional)

**Response** (200 OK):
```json
{
  "categories": [
    {
      "name": "threat_intelligence",
      "totalScans": 3456,
      "avgScore": 45,
      "maxScore": 100,
      "percentTriggered": 0.65
    },
    {
      "name": "domain_registration",
      "totalScans": 3456,
      "avgScore": 32,
      "maxScore": 40,
      "percentTriggered": 0.78
    }
    // ... 15 more categories
  ]
}
```

---

#### GET `/v2/admin/analytics/ti-sources`

Get threat intelligence source analytics.

**Query Parameters**:
- `from` (ISO8601 date, optional)
- `to` (ISO8601 date, optional)

**Response** (200 OK):
```json
{
  "sources": [
    {
      "name": "PhishTank",
      "totalChecks": 3456,
      "matches": 234,
      "matchRate": 0.068,
      "avgResponseTime": 234,
      "uptime": 0.998
    },
    {
      "name": "VirusTotal",
      "totalChecks": 3456,
      "matches": 345,
      "matchRate": 0.099,
      "avgResponseTime": 567,
      "uptime": 0.995
    }
    // ... 16 more sources
  ]
}
```

---

#### GET `/v2/admin/analytics/ai-consensus`

Get AI consensus analytics.

**Query Parameters**:
- `from` (ISO8601 date, optional)
- `to` (ISO8601 date, optional)

**Response** (200 OK):
```json
{
  "totalScans": 3456,
  "consensusRate": 0.87,
  "avgMultiplier": 1.05,
  "modelPerformance": [
    {
      "model": "claude-sonnet-4.5",
      "totalInvocations": 3456,
      "avgResponseTime": 1823,
      "avgConfidence": 0.92,
      "uptime": 0.998
    },
    {
      "model": "gpt-4o",
      "totalInvocations": 3456,
      "avgResponseTime": 2234,
      "avgConfidence": 0.89,
      "uptime": 0.994
    }
  ],
  "consensusBreakdown": {
    "unanimous": 2134,
    "majority": 987,
    "split": 234,
    "failed": 101
  }
}
```

---

### System Health

#### GET `/v2/admin/health`

Get overall system health.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T15:00:00Z",
  "uptime": 2592000,
  "components": {
    "database": "healthy",
    "redis": "healthy",
    "tiSources": "healthy",
    "aiModels": "healthy"
  },
  "metrics": {
    "cpu": 45.2,
    "memory": 68.5,
    "diskUsage": 34.2
  }
}
```

---

#### GET `/v2/admin/health/database`

Get database health metrics.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "connections": {
    "active": 12,
    "idle": 8,
    "max": 100
  },
  "performance": {
    "avgQueryTime": 23.4,
    "slowQueries": 2
  },
  "storage": {
    "used": "150MB",
    "total": "100GB",
    "percentUsed": 0.0015
  },
  "replication": {
    "status": "synced",
    "lag": 0
  }
}
```

---

#### GET `/v2/admin/health/performance`

Get performance metrics.

**Response** (200 OK):
```json
{
  "requests": {
    "perMinute": 234,
    "perHour": 14040,
    "avgResponseTime": 234
  },
  "cache": {
    "hitRate": 0.73,
    "evictions": 45
  },
  "queue": {
    "depth": 23,
    "processed": 14023,
    "failed": 12
  }
}
```

---

#### GET `/v2/admin/health/ti-sources`

Get threat intelligence source health.

**Response** (200 OK):
```json
{
  "sources": [
    {
      "name": "PhishTank",
      "status": "healthy",
      "lastSync": "2025-10-24T14:00:00Z",
      "nextSync": "2025-10-24T15:00:00Z",
      "uptime": 0.998,
      "errorRate": 0.002
    }
    // ... 17 more sources
  ],
  "overallHealth": "healthy",
  "totalSources": 18,
  "healthySources": 18,
  "degradedSources": 0,
  "downSources": 0
}
```

---

#### GET `/v2/admin/health/realtime`

Get real-time stats (WebSocket-compatible).

**Response** (200 OK):
```json
{
  "timestamp": "2025-10-24T15:00:00Z",
  "scansPerMinute": 23,
  "activeScans": 5,
  "queueDepth": 12,
  "avgScanDuration": 4234,
  "recentScans": [
    { "id": "clscan999", "url": "https://example.com", "score": 45, "status": "completed" }
  ]
}
```

---

## 🤖 Chatbot API

**Base Path**: `/v2/chatbot`
**Authentication**: Optional (better results with authentication)
**Rate Limit**:
- Free: 100 requests/day
- Premium: 1000 requests/day
- Enterprise: Unlimited

### Chat Endpoints

#### POST `/v2/chatbot/chat`

Send a message to the chatbot.

**Request Body**:
```json
{
  "sessionToken": "clsess123",
  "message": "Is this website safe: https://example.com?",
  "context": {
    "source": "web",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Response** (200 OK):
```json
{
  "messageId": "clmsg456",
  "sessionId": "clsess123",
  "role": "assistant",
  "content": "Let me analyze that website for you... Based on my analysis, https://example.com appears to be safe. It has a valid SSL certificate, the domain is well-established (registered in 1995), and there are no known security issues.",
  "confidence": 0.95,
  "model": "claude-sonnet-4.5",
  "tokensUsed": 234,
  "latency": 1823,
  "retrievedSources": [
    {
      "title": "Understanding SSL Certificates",
      "category": "security",
      "relevance": 0.89
    }
  ]
}
```

---

#### GET `/v2/chatbot/session/:id`

Get chat session details and history.

**Path Parameters**:
- `id` (string, required) - Session token

**Response** (200 OK):
```json
{
  "sessionId": "clsess123",
  "startedAt": "2025-10-24T14:00:00Z",
  "lastActivity": "2025-10-24T14:15:00Z",
  "messageCount": 8,
  "messages": [
    {
      "id": "clmsg111",
      "role": "user",
      "content": "Is this website safe: https://example.com?",
      "createdAt": "2025-10-24T14:00:00Z"
    },
    {
      "id": "clmsg222",
      "role": "assistant",
      "content": "Let me analyze that website...",
      "confidence": 0.95,
      "createdAt": "2025-10-24T14:00:02Z"
    }
    // ... 6 more messages
  ]
}
```

---

#### POST `/v2/chatbot/session/end`

End a chat session and optionally provide feedback.

**Request Body**:
```json
{
  "sessionToken": "clsess123",
  "rating": 5,
  "feedback": "Very helpful and accurate!"
}
```

**Response** (200 OK):
```json
{
  "sessionId": "clsess123",
  "endedAt": "2025-10-24T14:20:00Z",
  "duration": 1200,
  "messageCount": 8,
  "rating": 5
}
```

---

### Configuration (Admin)

#### GET `/v2/chatbot/config`

Get chatbot configuration.

**Authentication**: Required (Admin)

**Response** (200 OK):
```json
{
  "id": "clcfg123",
  "name": "Ask Elara",
  "enabled": true,
  "model": "claude-sonnet-4.5",
  "temperature": 0.7,
  "maxTokens": 2000,
  "maxConversationHistory": 10,
  "enableConversationMemory": true,
  "enableRag": true,
  "responseStyle": "professional",
  "systemPrompt": "You are Elara, a cybersecurity assistant...",
  "updatedAt": "2025-10-24T10:00:00Z"
}
```

---

#### PUT `/v2/chatbot/config`

Update chatbot configuration.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "temperature": 0.8,
  "model": "gpt-4o",
  "customInstructions": "Always provide actionable security advice."
}
```

**Response** (200 OK):
```json
{
  "id": "clcfg123",
  "message": "Configuration updated successfully",
  "updatedAt": "2025-10-24T15:00:00Z"
}
```

---

### Knowledge Base (Admin)

#### POST `/v2/chatbot/knowledge`

Add knowledge base entry.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "title": "Understanding Phishing Attacks",
  "content": "Phishing is a type of social engineering attack...",
  "category": "phishing",
  "source": "https://blog.elara.com/phishing-guide"
}
```

**Response** (201 Created):
```json
{
  "id": "clkb123",
  "title": "Understanding Phishing Attacks",
  "indexed": false,
  "createdAt": "2025-10-24T15:10:00Z"
}
```

---

#### GET `/v2/chatbot/knowledge/search`

Search knowledge base.

**Authentication**: Required (Admin)

**Query Parameters**:
- `q` (string, required) - Search query
- `category` (string, optional) - Filter by category
- `limit` (number, default: 10)

**Response** (200 OK):
```json
{
  "results": [
    {
      "id": "clkb123",
      "title": "Understanding Phishing Attacks",
      "content": "Phishing is a type of social engineering attack...",
      "category": "phishing",
      "relevance": 0.95
    }
  ]
}
```

---

#### GET `/v2/chatbot/knowledge/stats`

Get knowledge base statistics.

**Authentication**: Required (Admin)

**Response** (200 OK):
```json
{
  "totalEntries": 1234,
  "indexedEntries": 1200,
  "pendingIndexing": 34,
  "categories": {
    "phishing": 345,
    "malware": 234,
    "passwords": 189
  }
}
```

---

#### DELETE `/v2/chatbot/knowledge/:id`

Delete knowledge base entry.

**Authentication**: Required (Admin)

**Path Parameters**:
- `id` (string, required) - Knowledge base entry ID

**Response** (204 No Content)

---

### Training (Admin)

#### POST `/v2/chatbot/training/csv`

Upload CSV training data.

**Authentication**: Required (Admin)

**Request**:
- Content-Type: multipart/form-data
- File: CSV file with columns: question, answer, category

**Response** (202 Accepted):
```json
{
  "id": "cltrain123",
  "fileName": "training-data.csv",
  "status": "processing",
  "totalEntries": 500,
  "processedEntries": 0
}
```

---

#### POST `/v2/chatbot/training/text`

Upload plain text training data.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "content": "Large block of text for training...",
  "category": "security-basics"
}
```

**Response** (202 Accepted):
```json
{
  "id": "cltrain456",
  "status": "processing",
  "chunks": 12
}
```

---

#### POST `/v2/chatbot/training/json`

Upload JSON training data.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "data": [
    { "question": "What is phishing?", "answer": "Phishing is..." },
    { "question": "How to spot scams?", "answer": "Look for..." }
  ]
}
```

**Response** (202 Accepted):
```json
{
  "id": "cltrain789",
  "status": "processing",
  "totalEntries": 2
}
```

---

#### GET `/v2/chatbot/training/:id`

Get training job status.

**Authentication**: Required (Admin)

**Path Parameters**:
- `id` (string, required) - Training job ID

**Response** (200 OK):
```json
{
  "id": "cltrain123",
  "status": "completed",
  "fileName": "training-data.csv",
  "totalEntries": 500,
  "processedEntries": 500,
  "processedAt": "2025-10-24T15:30:00Z"
}
```

---

#### GET `/v2/chatbot/training/history`

Get training job history.

**Authentication**: Required (Admin)

**Query Parameters**:
- `limit` (number, default: 20)

**Response** (200 OK):
```json
{
  "jobs": [
    {
      "id": "cltrain123",
      "fileName": "training-data.csv",
      "status": "completed",
      "totalEntries": 500,
      "processedAt": "2025-10-24T15:30:00Z"
    }
  ]
}
```

---

### Analytics

#### GET `/v2/chatbot/analytics`

Get chatbot analytics.

**Authentication**: Required (Admin)

**Query Parameters**:
- `from` (ISO8601 date, optional)
- `to` (ISO8601 date, optional)

**Response** (200 OK):
```json
{
  "period": {
    "from": "2025-10-17T00:00:00Z",
    "to": "2025-10-24T23:59:59Z"
  },
  "totalSessions": 1234,
  "totalMessages": 9876,
  "uniqueUsers": 567,
  "avgRating": 4.7,
  "avgResponseTime": 1823,
  "successfulResponses": 9754,
  "failedResponses": 122,
  "topTopics": [
    { "topic": "phishing_detection", "count": 234 },
    { "topic": "url_scanning", "count": 189 }
  ]
}
```

---

## 🔗 OAuth Integration

**Base Path**: `/v2/auth`
**Authentication**: Not required (public OAuth flow)

### OAuth Flows

#### GET `/v2/auth/google`

Initiate Google OAuth login.

**Response**: Redirect to Google OAuth consent screen

---

#### GET `/v2/auth/google/callback`

Google OAuth callback (handled automatically).

**Query Parameters**:
- `code` (string) - Authorization code from Google
- `state` (string) - CSRF protection state

**Response**: Redirect to frontend with tokens

---

#### GET `/v2/auth/facebook`

Initiate Facebook OAuth login.

**Response**: Redirect to Facebook OAuth consent screen

---

#### GET `/v2/auth/facebook/callback`

Facebook OAuth callback.

**Query Parameters**:
- `code` (string) - Authorization code
- `state` (string) - CSRF state

**Response**: Redirect to frontend with tokens

---

#### GET `/v2/auth/linkedin`

Initiate LinkedIn OAuth login.

**Response**: Redirect to LinkedIn OAuth consent screen

---

#### GET `/v2/auth/linkedin/callback`

LinkedIn OAuth callback.

**Query Parameters**:
- `code` (string) - Authorization code
- `state` (string) - CSRF state

**Response**: Redirect to frontend with tokens

---

### Account Management

#### GET `/v2/auth/oauth/linked`

Get linked OAuth accounts for current user.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "linkedAccounts": [
    {
      "provider": "google",
      "email": "user@gmail.com",
      "linkedAt": "2025-10-01T12:00:00Z"
    },
    {
      "provider": "linkedin",
      "email": "user@linkedin.com",
      "linkedAt": "2025-10-15T14:30:00Z"
    }
  ]
}
```

---

#### DELETE `/v2/auth/oauth/:provider`

Unlink OAuth account.

**Authentication**: Required

**Path Parameters**:
- `provider` (string, required) - OAuth provider (google, facebook, linkedin)

**Response** (200 OK):
```json
{
  "message": "Google account unlinked successfully",
  "provider": "google"
}
```

**Error Cases**:
- `400 Bad Request` - Cannot unlink if it's the only authentication method and no password is set

---

## ⚠️ Error Handling

All API errors follow a standard format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ],
    "timestamp": "2025-10-24T15:45:00Z",
    "requestId": "req_clxxx123"
  }
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate entry) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

---

## 🚦 Rate Limiting

Rate limits are applied per organization/API key:

| Tier | Requests/Minute | Requests/Hour | Requests/Day |
|------|----------------|---------------|--------------|
| **Free** | 10 | 100 | 1,000 |
| **Pro** | 100 | 1,000 | 10,000 |
| **Enterprise** | 1,000 | 10,000 | 100,000 |

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1698156000
```

**Rate Limit Exceeded Response** (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

---

## 🔔 Webhooks

Configure webhooks to receive real-time notifications.

### Webhook Events

- `scan.completed` - Scan finished successfully
- `scan.failed` - Scan encountered an error
- `scan.high_risk_detected` - High/Critical risk URL detected
- `ti_source.sync_completed` - TI source sync finished
- `user.registered` - New user registration
- `subscription.updated` - Subscription plan changed

### Webhook Payload

```json
{
  "event": "scan.completed",
  "timestamp": "2025-10-24T16:00:00Z",
  "data": {
    "scanId": "clscan999",
    "url": "https://example.com",
    "riskLevel": "safe",
    "finalScore": 45
  },
  "signature": "sha256=abc123..."
}
```

### Webhook Configuration

Use the Admin API to configure webhooks:

```http
POST /v2/admin/webhooks
{
  "url": "https://your-server.com/webhooks/elara",
  "events": ["scan.completed", "scan.high_risk_detected"],
  "secret": "your-webhook-secret"
}
```

---

## 📚 Additional Documentation

- **Scanning API**: See `docs/api/scanning-api.md`
- **Threat Intelligence API**: See `docs/api/threat-intelligence-api.md`
- **Proxy API**: See `docs/api/proxy-api.md`
- **WebSocket API**: See `docs/api/websocket-api.md`

---

**API Version**: 2.0
**Last Updated**: 2025-10-24
**Maintained By**: Elara Platform Team
**Support**: support@elara.com | https://docs.elara.com
