-- Threat Intelligence Sources Seed SQL
-- Seeds all 7 threat intelligence sources into the database

-- URLhaus
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'URLhaus',
  'URLhaus is a project from abuse.ch with the goal of sharing malicious URLs that are being used for malware distribution.',
  'api',
  'https://urlhaus-api.abuse.ch/v1/urls/recent/',
  true,
  5,
  false,
  1,
  ARRAY['malware', 'urls', 'free'],
  '{"format": "json", "timeout": 30000, "rateLimit": "1000/day"}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

-- ThreatFox
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'ThreatFox',
  'ThreatFox is a free platform from abuse.ch to share indicators of compromise (IOCs).',
  'api',
  'https://threatfox-api.abuse.ch/api/v1/',
  true,
  10,
  false,
  1,
  ARRAY['iocs', 'malware', 'free'],
  '{"format": "json", "timeout": 30000}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

-- MalwareBazaar
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'MalwareBazaar',
  'MalwareBazaar is a project from abuse.ch to share malware samples with the infosec community.',
  'api',
  'https://mb-api.abuse.ch/api/v1/',
  true,
  1440,
  false,
  2,
  ARRAY['malware', 'hashes', 'free'],
  '{"format": "json", "timeout": 30000}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

-- OpenPhish
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'OpenPhish',
  'OpenPhish is a fully automated platform for phishing intelligence. It provides actionable intelligence data through feeds.',
  'feed',
  'https://openphish.com/feed.txt',
  true,
  30,
  false,
  1,
  ARRAY['phishing', 'urls', 'free'],
  '{"format": "txt", "timeout": 30000}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

-- PhishTank
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'PhishTank',
  'PhishTank is a collaborative clearing house for data and information about phishing on the Internet.',
  'feed',
  'http://data.phishtank.com/data/online-valid.json',
  true,
  60,
  false,
  1,
  ARRAY['phishing', 'urls', 'free'],
  '{"format": "json", "timeout": 60000}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

-- AlienVault OTX
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'AlienVault OTX',
  'AlienVault Open Threat Exchange is an open threat information sharing and analysis network. Free API with 10K calls/month.',
  'api',
  'https://otx.alienvault.com/api/v1/pulses/subscribed',
  true,
  30,
  true,
  2,
  ARRAY['threat-intelligence', 'multi-source', 'free-api-key'],
  '{"format": "json", "timeout": 30000, "requiresApiKey": true, "signupUrl": "https://otx.alienvault.com/api"}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

-- Emerging Threats
INSERT INTO "ThreatIntelSource" ("id", "name", "description", "type", "url", "enabled", "updateFrequency", "credentialsRequired", "priority", "tags", "config", "totalIndicators", "consecutiveFailures", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Emerging Threats',
  'Proofpoint Emerging Threats provides intelligence on malicious IPs and domains.',
  'feed',
  'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
  true,
  1440,
  false,
  3,
  ARRAY['ips', 'malware', 'free'],
  '{"format": "txt", "timeout": 30000}'::jsonb,
  0,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "url" = EXCLUDED."url",
  "enabled" = EXCLUDED."enabled",
  "updateFrequency" = EXCLUDED."updateFrequency",
  "updatedAt" = NOW();

SELECT 'Seeded 7 threat intelligence sources' AS result;
