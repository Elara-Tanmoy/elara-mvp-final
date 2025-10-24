-- Populate Threat Intel Source Configurations with Actual API Details
-- Run this after deployment to show real API configurations in dashboard

-- URLhaus
UPDATE "ThreatIntelSource" SET
  url = 'https://urlhaus-api.abuse.ch/v1/urls/recent/',
  "requiresAuth" = true,
  description = 'Abuse.ch URLhaus - Recent malware distribution URLs. Requires API key from https://auth.abuse.ch/',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":30000,"headers":{"Auth-Key":"{ABUSECH_API_KEY}","User-Agent":"Elara-Cybersecurity-Platform/1.0"},"queryParams":{},"bodyParams":null,"authHeaderName":"Auth-Key","envVarName":"ABUSECH_API_KEY"}'::jsonb
  )
WHERE name = 'URLhaus';

-- ThreatFox
UPDATE "ThreatIntelSource" SET
  url = 'https://threatfox-api.abuse.ch/api/v1/',
  "requiresAuth" = true,
  description = 'Abuse.ch ThreatFox - Indicators of Compromise (IOCs). Requires API key from https://auth.abuse.ch/',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"POST","timeout":30000,"headers":{"Auth-Key":"{ABUSECH_API_KEY}","Content-Type":"application/json","User-Agent":"Elara-Cybersecurity-Platform/1.0"},"queryParams":{},"bodyParams":"{\"query\":\"get_iocs\",\"days\":1}","authHeaderName":"Auth-Key","envVarName":"ABUSECH_API_KEY"}'::jsonb
  )
WHERE name = 'ThreatFox';

-- MalwareBazaar
UPDATE "ThreatIntelSource" SET
  url = 'https://mb-api.abuse.ch/api/v1/',
  "requiresAuth" = true,
  description = 'Abuse.ch MalwareBazaar - Malware sample hashes. Requires API key from https://auth.abuse.ch/',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"POST","timeout":30000,"headers":{"Auth-Key":"{ABUSECH_API_KEY}","Content-Type":"application/x-www-form-urlencoded","User-Agent":"Elara-Cybersecurity-Platform/1.0"},"queryParams":{},"bodyParams":"query=get_recent&selector=100","authHeaderName":"Auth-Key","envVarName":"ABUSECH_API_KEY"}'::jsonb
  )
WHERE name = 'MalwareBazaar';

-- SSL Blacklist
UPDATE "ThreatIntelSource" SET
  url = 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',
  "requiresAuth" = false,
  description = 'Abuse.ch SSL Blacklist - Malicious SSL certificate fingerprints. API key optional.',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":30000,"headers":{"API-KEY":"{ABUSECH_API_KEY}","User-Agent":"Elara-Cybersecurity-Platform/1.0"},"queryParams":{},"bodyParams":null,"authHeaderName":"API-KEY","envVarName":"ABUSECH_API_KEY"}'::jsonb
  )
WHERE name = 'SSL Blacklist';

-- AbuseIPDB
UPDATE "ThreatIntelSource" SET
  url = 'https://api.abuseipdb.com/api/v2/blacklist',
  "requiresAuth" = true,
  description = 'AbuseIPDB Blacklist - Abusive IP addresses. Requires API key from https://www.abuseipdb.com/account/api',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":30000,"headers":{"Key":"{ABUSEIPDB_API_KEY}","Accept":"application/json"},"queryParams":{"confidenceMinimum":"90","limit":"10000"},"bodyParams":null,"authHeaderName":"Key","envVarName":"ABUSEIPDB_API_KEY"}'::jsonb
  )
WHERE name = 'AbuseIPDB';

-- AlienVault OTX
UPDATE "ThreatIntelSource" SET
  url = 'https://otx.alienvault.com/api/v1/pulses/subscribed',
  "requiresAuth" = true,
  description = 'AlienVault Open Threat Exchange - Threat intelligence pulses. Requires API key from https://otx.alienvault.com/api',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":30000,"headers":{"X-OTX-API-KEY":"{ALIENVAULT_OTX_API_KEY}"},"queryParams":{"limit":"50"},"bodyParams":null,"authHeaderName":"X-OTX-API-KEY","envVarName":"ALIENVAULT_OTX_API_KEY"}'::jsonb
  )
WHERE name = 'AlienVault OTX';

-- PhishTank
UPDATE "ThreatIntelSource" SET
  url = 'https://data.phishtank.com/data/online-valid.json',
  "requiresAuth" = false,
  description = 'PhishTank - Verified phishing URLs. Public feed, no API key required.',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":60000,"headers":{"User-Agent":"Elara-Cybersecurity-Platform/1.0"},"queryParams":{},"bodyParams":null,"authHeaderName":null,"envVarName":null}'::jsonb
  )
WHERE name = 'PhishTank';

-- OpenPhish
UPDATE "ThreatIntelSource" SET
  url = 'https://openphish.com/feed.txt',
  "requiresAuth" = false,
  description = 'OpenPhish - Active phishing URLs. Public feed, no API key required.',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":30000,"headers":{"User-Agent":"Elara-Cybersecurity-Platform/1.0"},"queryParams":{},"bodyParams":null,"authHeaderName":null,"envVarName":null}'::jsonb
  )
WHERE name = 'OpenPhish';

-- GreyNoise
UPDATE "ThreatIntelSource" SET
  url = 'https://api.greynoise.io/v3/community',
  "requiresAuth" = true,
  description = 'GreyNoise - Internet-wide scan detection. Community API requires specific IP lookups. Enterprise API recommended for bulk feeds. Get key from https://viz.greynoise.io/account',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{apiConfig}',
    '{"method":"GET","timeout":30000,"headers":{"key":"{GREYNOISE_API_KEY}"},"queryParams":{},"bodyParams":null,"authHeaderName":"key","envVarName":"GREYNOISE_API_KEY"}'::jsonb
  )
WHERE name = 'GreyNoise';

-- Verify updates
SELECT
  name,
  url,
  "requiresAuth",
  metadata->'apiConfig'->>'method' as method,
  metadata->'apiConfig'->>'authHeaderName' as auth_header
FROM "ThreatIntelSource"
ORDER BY name;
