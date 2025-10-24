# Elara API Documentation

**Version:** 2.0
**Base URL Production:** `https://api.elara.com/api/v2`
**Base URL Development:** `http://34.36.48.252/api/v2` (via Load Balancer)
**Last Updated:** October 24, 2025

---

## Overview

The Elara API is a comprehensive RESTful API for cybersecurity threat detection, URL scanning, message analysis, and threat intelligence management. Built on Node.js/Express with TypeScript, it provides enterprise-grade security scanning capabilities powered by multi-LLM AI consensus and integration with 18+ threat intelligence sources.

### Key Features

- **Multi-LLM AI Analysis**: Claude Sonnet 4.5, GPT-4, Gemini consensus-based threat detection
- **Real-time URL Scanning**: 570-point comprehensive scoring algorithm
- **Message/SMS Scanning**: Phishing and social engineering detection
- **File Scanning**: OCR-based analysis for images and PDFs
- **WhatsApp Integration**: Bot-based threat scanning
- **Threat Intelligence**: 200K+ indicators from 18 sources
- **Admin Panel APIs**: Complete enterprise management
- **Ask Elara Chatbot**: AI-powered security assistant

---

## Authentication

All API endpoints (except public webhooks) require JWT authentication.

### Obtaining Access Tokens

```http
POST /v2/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Using Access Tokens

Include the access token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration

- **Access Token**: 24 hours
- **Refresh Token**: 7 days

### Refresh Token

```http
POST /v2/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Rate Limiting

Rate limits are applied per organization tier:

| Tier | Requests/Minute | Requests/Hour | Requests/Day |
|------|-----------------|---------------|--------------|
| Free | 10 | 100 | 1,000 |
| Pro | 100 | 1,000 | 10,000 |
| Enterprise | 500 | 5,000 | Unlimited |

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

**Rate Limit Exceeded Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## API Endpoints

### Authentication & User Management

- [Authentication Endpoints](./endpoints/auth.md)
  - User registration, login, token refresh
  - OAuth SSO (Google, Facebook, LinkedIn)
  - Passkey (WebAuthn) authentication
  - Password recovery

### Scanning APIs

- [URL Scanning](./endpoints/scan.md#url-scanning)
  - Comprehensive 570-point threat analysis
  - Multi-LLM AI consensus
  - Threat intelligence database checks
  - Pre-browse scanning for Secure Browser

- [Message Scanning](./endpoints/scan.md#message-scanning)
  - Phishing detection
  - Social engineering analysis
  - Urgency/emotional manipulation detection

- [File Scanning](./endpoints/scan.md#file-scanning)
  - OCR text extraction from images
  - PDF document analysis
  - Conversation chain detection
  - Intent analysis for scams

### Threat Intelligence

- [Threat Intel APIs](./endpoints/threat-intel.md)
  - View 200K+ threat indicators
  - 18 integrated sources (URLhaus, PhishTank, AbuseIPDB, etc.)
  - Real-time threat feed sync
  - Custom threat indicator management

### Admin Panel

- [Admin APIs](./endpoints/admin.md)
  - User management
  - Organization tier management
  - System settings configuration
  - Analytics and reporting
  - API key management
  - Webhook management

### WhatsApp Integration

- [WhatsApp APIs](./endpoints/whatsapp.md)
  - WhatsApp Bot integration
  - Message scanning via WhatsApp
  - User tier management
  - Media file handling
  - Admin statistics

### Chatbot (Ask Elara)

- [Chatbot APIs](./endpoints/chatbot.md)
  - AI-powered security assistant
  - RAG-enhanced knowledge base
  - Training data upload (CSV, text, JSON)
  - Session management
  - Analytics

### Analytics & Reporting

- [Analytics APIs](./endpoints/analytics.md)
  - Scan statistics
  - Threat distribution analysis
  - User activity metrics
  - Real-time dashboards

### Advanced Features

- [AI Consensus APIs](./endpoints/ai-consensus.md)
  - Multi-LLM configuration
  - Consensus strategy management
  - AI model rankings

- [Blockchain Verification](./endpoints/blockchain.md)
  - Scam report verification
  - Immutable audit trail

---

## Response Format

All API responses follow a consistent structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details",
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

---

## HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Request accepted for processing (async operations) |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

---

## Pagination

List endpoints support pagination:

**Request:**
```http
GET /v2/scans?page=1&limit=20
```

**Response:**
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Filtering & Sorting

Many endpoints support filtering and sorting:

**Example:**
```http
GET /v2/scans?scanType=url&riskLevel=high&sortBy=createdAt&order=desc
```

---

## WebSocket API

Real-time scan status updates via WebSocket:

```javascript
const ws = new WebSocket('wss://api.elara.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'scans',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Scan update:', data);
};
```

---

## SDK & Libraries

Official SDKs coming soon:
- JavaScript/TypeScript SDK
- Python SDK
- Go SDK

---

## Code Examples

See [examples.md](./examples.md) for complete curl and code examples for all endpoints.

---

## API Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API version history.

---

## Support

- **Documentation**: https://docs.elara.com
- **API Status**: https://status.elara.com
- **Email**: api-support@elara.com
- **Discord**: https://discord.gg/elara
