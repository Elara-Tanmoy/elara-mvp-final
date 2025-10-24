# Threat Intel Configuration - Deployment Instructions

## Overview

The Threat Intel configuration system has been enhanced to display **actual API endpoints, headers, and authentication details** from the codebase, replacing placeholder values.

## What Was Changed

### Backend Changes
1. **Enhanced API Response** (`threatIntel.controller.ts`)
   - `GET /api/v2/threat-intel/sources/:id/config` now returns full API configuration
   - Exposes: HTTP method, headers, query params, body params, auth details
   - Extracts from `metadata` JSON field in database

2. **Configuration Script** (`scripts/update-ti-source-configs.ts`)
   - Populates database with actual API configurations from connector code
   - Updates `url`, `requiresAuth`, `description`, `metadata` fields
   - Covers all 9 threat intel sources

3. **API Documentation** (`API_CONFIGURATIONS.md`)
   - Complete reference of all actual API endpoints
   - Headers, authentication methods, rate limits
   - Test commands for each source

### Frontend Changes
1. **Enhanced UI** (`ThreatIntelConfig.tsx`)
   - New "Current API Configuration" section
   - Shows HTTP method, timeout, headers, query params, body params
   - Color-coded display for different config types
   - Displays environment variable names

## Deployment Steps

### Step 1: Deploy Code (COMPLETED)

```bash
git push origin develop
# Wait for GitHub Actions deployment to complete
```

### Step 2: Run Configuration Update Script

After deployment completes, run this script to populate the database with actual API configurations:

```bash
# Option A: From local machine (requires database connection)
cd packages/backend
npx tsx src/scripts/update-ti-source-configs.ts

# Option B: From Kubernetes pod (RECOMMENDED for production)
kubectl exec -it deployment/elara-api -n elara-backend-prod -- \
  node -r esbuild-register src/scripts/update-ti-source-configs.ts
```

**Expected Output:**
```
Starting Threat Intel source configuration update...
Updating source: URLhaus...
✓ Updated URLhaus
Updating source: ThreatFox...
✓ Updated ThreatFox
...
Update complete: 9 sources updated, 0 errors
```

### Step 3: Verify Configuration

1. **Check Database:**
```bash
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "
    SELECT name, url, requiresAuth, metadata->>'method' as method
    FROM \"ThreatIntelSource\"
    ORDER BY name;
  "
```

2. **Test API Endpoint:**
```bash
# Get a source ID first
SOURCEID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.elara.com/v2/threat-intel/sources | jq -r '.sources[0].id')

# Get configuration
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.elara.com/v2/threat-intel/sources/$SOURCEID/config" | jq '.config.apiConfig'
```

3. **Check Frontend:**
   - Navigate to: https://app.elara.com/admin/threat-intel-config
   - Each source card should now show "Current API Configuration" section
   - Verify HTTP method, headers, timeout are displayed

## Configuration Format

Each source now has this metadata structure:

```json
{
  "method": "POST",
  "timeout": 30000,
  "headers": {
    "Auth-Key": "{ABUSECH_API_KEY}",
    "Content-Type": "application/json",
    "User-Agent": "Elara-Cybersecurity-Platform/1.0"
  },
  "queryParams": {},
  "bodyParams": "{\"query\":\"get_iocs\",\"days\":1}",
  "authHeaderName": "Auth-Key",
  "envVarName": "ABUSECH_API_KEY"
}
```

## Troubleshooting

### Issue: Script fails with "Database connection error"

**Solution:** Run from Kubernetes pod instead:
```bash
kubectl exec -it deployment/elara-api -n elara-backend-prod -- sh
cd /app/packages/backend
node -r esbuild-register src/scripts/update-ti-source-configs.ts
```

### Issue: Frontend shows empty apiConfig

**Cause:** Database not populated yet

**Solution:** Run Step 2 to populate database

### Issue: "apiConfig is undefined" in UI

**Cause:** Old source records without metadata

**Solution:** Run update script which will add metadata to existing sources

## API Configuration Reference

| Source | Method | Auth Header | Env Var |
|--------|--------|-------------|---------|
| URLhaus | GET | Auth-Key | ABUSECH_API_KEY |
| ThreatFox | POST | Auth-Key | ABUSECH_API_KEY |
| MalwareBazaar | POST | Auth-Key | ABUSECH_API_KEY |
| SSL Blacklist | GET | API-KEY | ABUSECH_API_KEY |
| AbuseIPDB | GET | Key | ABUSEIPDB_API_KEY |
| AlienVault OTX | GET | X-OTX-API-KEY | ALIENVAULT_OTX_API_KEY |
| PhishTank | GET | None | None |
| OpenPhish | GET | None | None |
| GreyNoise | GET | key | GREYNOISE_API_KEY |

## Post-Deployment Verification

Run this checklist after deployment:

- [ ] Configuration script executed successfully
- [ ] Database contains API configurations (check metadata field)
- [ ] Frontend displays "Current API Configuration" section
- [ ] HTTP method visible for each source
- [ ] Headers displayed correctly
- [ ] Query parameters shown when applicable
- [ ] Body parameters visible for POST requests
- [ ] Environment variable names displayed
- [ ] Test connection still works

## Rollback Plan

If issues occur:

1. **Frontend rollback:** Previous version shows basic config (no apiConfig section)
2. **Backend rollback:** Previous endpoint still works, just doesn't include apiConfig
3. **Database rollback:** Not needed - metadata field is additive

The changes are backward compatible. Old UI will simply not show the new apiConfig section.

## Future Enhancements

Planned improvements:
- [ ] Allow editing API configurations from UI
- [ ] Validate API endpoints on save
- [ ] Store multiple API key versions with rotation
- [ ] Add API key expiry tracking
- [ ] Implement config change audit log

---

**Last Updated:** 2025-10-23
**Version:** 1.0
**Status:** Ready for Production
