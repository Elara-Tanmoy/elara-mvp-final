# Threat Intelligence API Configurations

**ACTUAL configurations used by Elara Platform**

This document reflects the real API endpoints, headers, and authentication methods currently implemented in the codebase.

---

## 1. URLhaus (Abuse.ch)

### Connection Details
- **URL:** `https://urlhaus-api.abuse.ch/v1/urls/recent/`
- **Method:** GET
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** API Key (Header-based)
- **Header:** `Auth-Key: <API_KEY>`
- **Environment Variable:** `ABUSECH_API_KEY`
- **Required:** YES
- **Get Key:** https://auth.abuse.ch/

### Headers
```
Auth-Key: <ABUSECH_API_KEY>
User-Agent: Elara-Cybersecurity-Platform/1.0
```

### Response Format
- JSON
- Field: `data.urls[]`

### Test Command
```bash
curl -H "Auth-Key: YOUR_KEY" \
     -H "User-Agent: Elara-Cybersecurity-Platform/1.0" \
     https://urlhaus-api.abuse.ch/v1/urls/recent/
```

---

## 2. ThreatFox (Abuse.ch)

### Connection Details
- **URL:** `https://threatfox-api.abuse.ch/api/v1/`
- **Method:** POST
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** API Key (Header-based)
- **Header:** `Auth-Key: <API_KEY>`
- **Environment Variable:** `ABUSECH_API_KEY`
- **Required:** YES
- **Get Key:** https://auth.abuse.ch/

### Headers
```
Auth-Key: <ABUSECH_API_KEY>
Content-Type: application/json
User-Agent: Elara-Cybersecurity-Platform/1.0
```

### Request Body
```json
{
  "query": "get_iocs",
  "days": 1
}
```

### Response Format
- JSON
- Field: `data.data[]`

### Test Command
```bash
curl -X POST \
     -H "Auth-Key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -H "User-Agent: Elara-Cybersecurity-Platform/1.0" \
     -d '{"query":"get_iocs","days":1}' \
     https://threatfox-api.abuse.ch/api/v1/
```

---

## 3. MalwareBazaar (Abuse.ch)

### Connection Details
- **URL:** `https://mb-api.abuse.ch/api/v1/`
- **Method:** POST
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** API Key (Header-based)
- **Header:** `Auth-Key: <API_KEY>`
- **Environment Variable:** `ABUSECH_API_KEY`
- **Required:** YES
- **Get Key:** https://auth.abuse.ch/

### Headers
```
Auth-Key: <ABUSECH_API_KEY>
Content-Type: application/x-www-form-urlencoded
User-Agent: Elara-Cybersecurity-Platform/1.0
```

### Request Body (URL-encoded)
```
query=get_recent&selector=100
```

### Response Format
- JSON
- Field: `data.data[]`

### Test Command
```bash
curl -X POST \
     -H "Auth-Key: YOUR_KEY" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "User-Agent: Elara-Cybersecurity-Platform/1.0" \
     -d 'query=get_recent&selector=100' \
     https://mb-api.abuse.ch/api/v1/
```

---

## 4. SSL Blacklist (Abuse.ch)

### Connection Details
- **URL:** `https://sslbl.abuse.ch/blacklist/sslblacklist.csv`
- **Method:** GET
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** Optional API Key (Header-based)
- **Header:** `API-KEY: <API_KEY>`
- **Environment Variable:** `ABUSECH_API_KEY`
- **Required:** NO (works without key)
- **Get Key:** https://auth.abuse.ch/

### Headers
```
API-KEY: <ABUSECH_API_KEY>  # Optional
User-Agent: Elara-Cybersecurity-Platform/1.0
```

### Response Format
- CSV
- Format: `Listingdate,SHA1,Listingreason`

### Test Command
```bash
curl -H "User-Agent: Elara-Cybersecurity-Platform/1.0" \
     https://sslbl.abuse.ch/blacklist/sslblacklist.csv
```

---

## 5. AbuseIPDB

### Connection Details
- **URL:** `https://api.abuseipdb.com/api/v2/blacklist`
- **Method:** GET
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** API Key (Header-based)
- **Header:** `Key: <API_KEY>`
- **Environment Variable:** `ABUSEIPDB_API_KEY`
- **Required:** YES
- **Get Key:** https://www.abuseipdb.com/account/api

### Headers
```
Key: <ABUSEIPDB_API_KEY>
Accept: application/json
```

### Query Parameters
```
confidenceMinimum=90
limit=10000
```

### Response Format
- JSON
- Field: `data.data[]`

### Test Command
```bash
curl -G \
     -H "Key: YOUR_KEY" \
     -H "Accept: application/json" \
     --data-urlencode "confidenceMinimum=90" \
     --data-urlencode "limit=10000" \
     https://api.abuseipdb.com/api/v2/blacklist
```

---

## 6. AlienVault OTX

### Connection Details
- **URL:** `https://otx.alienvault.com/api/v1/pulses/subscribed`
- **Method:** GET
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** API Key (Header-based)
- **Header:** `X-OTX-API-KEY: <API_KEY>`
- **Environment Variable:** `ALIENVAULT_OTX_API_KEY`
- **Required:** YES
- **Get Key:** https://otx.alienvault.com/api

### Headers
```
X-OTX-API-KEY: <ALIENVAULT_OTX_API_KEY>
```

### Query Parameters
```
limit=50
modified_since=<ISO_TIMESTAMP>
```

### Response Format
- JSON
- Field: `results[]`

### Test Command
```bash
curl -H "X-OTX-API-KEY: YOUR_KEY" \
     "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=50"
```

---

## 7. PhishTank

### Connection Details
- **URL:** `https://data.phishtank.com/data/online-valid.json`
- **Method:** GET
- **Timeout:** 60000ms (60 seconds - large file)

### Authentication
- **Type:** None
- **Required:** NO
- **Public Feed:** YES

### Headers
```
User-Agent: Elara-Cybersecurity-Platform/1.0
```

### Response Format
- JSON Array
- Direct array of phishing URLs

### Test Command
```bash
curl -H "User-Agent: Elara-Cybersecurity-Platform/1.0" \
     https://data.phishtank.com/data/online-valid.json
```

---

## 8. OpenPhish

### Connection Details
- **URL:** `https://openphish.com/feed.txt`
- **Method:** GET
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** None
- **Required:** NO
- **Public Feed:** YES

### Headers
```
User-Agent: Elara-Cybersecurity-Platform/1.0
```

### Response Format
- Plain Text
- One URL per line

### Test Command
```bash
curl -H "User-Agent: Elara-Cybersecurity-Platform/1.0" \
     https://openphish.com/feed.txt
```

---

## 9. GreyNoise

### Connection Details
- **URL:** `https://api.greynoise.io/v3/community`
- **Method:** GET
- **Timeout:** 30000ms (30 seconds)

### Authentication
- **Type:** API Key (Header-based)
- **Header:** `key: <API_KEY>`
- **Environment Variable:** `GREYNOISE_API_KEY`
- **Required:** YES
- **Get Key:** https://viz.greynoise.io/account

### Headers
```
key: <GREYNOISE_API_KEY>
```

### Note
⚠️ **Community API Limitation:** The community API requires specific IP lookups and doesn't provide bulk feed access. For production use, Enterprise API is required with `/v3/tags` endpoint for bulk feeds.

### Test Command
```bash
curl -H "key: YOUR_KEY" \
     https://api.greynoise.io/v3/community/8.8.8.8
```

---

## Environment Variables Summary

```bash
# Abuse.ch (shared key for all 4 sources)
ABUSECH_API_KEY=your_key_here

# AbuseIPDB
ABUSEIPDB_API_KEY=your_key_here

# AlienVault OTX
ALIENVAULT_OTX_API_KEY=your_key_here

# GreyNoise
GREYNOISE_API_KEY=your_key_here

# No keys needed for:
# - PhishTank
# - OpenPhish
```

---

## API Rate Limits

| Source | Rate Limit | Notes |
|--------|-----------|-------|
| URLhaus | 200 req/day | With API key |
| ThreatFox | 200 req/day | With API key |
| MalwareBazaar | 200 req/day | With API key |
| SSL Blacklist | Unlimited | Public feed |
| AbuseIPDB | 1000 req/day | Free tier |
| AlienVault OTX | 10,000 req/day | Free tier |
| PhishTank | Unlimited | Public JSON feed |
| OpenPhish | Unlimited | Public feed |
| GreyNoise | 50 req/day | Community tier |

---

## Current Sync Intervals

| Source | Interval | Rationale |
|--------|----------|-----------|
| URLhaus | 5 minutes | High-frequency malware URLs |
| ThreatFox | 10 minutes | Active IOCs |
| MalwareBazaar | 24 hours | Large sample database |
| SSL Blacklist | 24 hours | Slow-changing data |
| AbuseIPDB | 6 hours | Blacklist updates |
| AlienVault OTX | 30 minutes | Active threat pulses |
| PhishTank | 1 hour | Verified phishing URLs |
| OpenPhish | 30 minutes | Real-time phishing |
| GreyNoise | 24 hours | Community API limits |

---

## Security Considerations

1. **API Keys Storage:**
   - Stored in Kubernetes secrets (`elara-secrets`)
   - Accessed via environment variables
   - Never logged or exposed in responses

2. **TLS/SSL:**
   - All connections use HTTPS
   - Certificate validation enabled

3. **User-Agent:**
   - All requests identify as `Elara-Cybersecurity-Platform/1.0`
   - Required for abuse prevention

4. **Error Handling:**
   - Connection timeouts configured
   - Retry logic not implemented (to avoid rate limit issues)
   - Errors logged but don't crash sync process

5. **Data Validation:**
   - All indicator values normalized (lowercase)
   - Metadata fields sanitized to prevent injection
   - Circular JSON references prevented

---

## Troubleshooting

### Common Issues

1. **401 Unauthorized (Abuse.ch sources)**
   - Cause: Missing or invalid `ABUSECH_API_KEY`
   - Fix: Ensure API key is set in Kubernetes secret and CronJob has access

2. **404 Not Found (PhishTank)**
   - Cause: 302 redirects not followed
   - Fix: Axios configured with `maxRedirects: 5`

3. **Timeout Errors**
   - Cause: Large feed files (PhishTank: 60s timeout)
   - Fix: Increase timeout or implement streaming

4. **Rate Limit Exceeded**
   - Cause: Too frequent sync intervals
   - Fix: Respect rate limits in sync intervals table

---

**Last Updated:** 2025-10-23
**Maintained by:** Elara Platform Team
