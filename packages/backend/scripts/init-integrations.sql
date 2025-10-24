-- Initialize Elara Platform Integrations
-- This script populates the Integration table with available third-party integrations

INSERT INTO "Integration" (name, type, status, enabled, "lastSyncAt", config, "createdAt", "updatedAt")
VALUES
-- Security & Threat Intelligence
('VirusTotal', 'security', 'available', false, NULL,
'{"description": "Scan files and URLs against 70+ antivirus engines", "requires": ["api_key"], "endpoint": "https://www.virustotal.com/api/v3"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Google Safe Browsing', 'security', 'available', false, NULL,
'{"description": "Check URLs against Google''s list of unsafe web resources", "requires": ["api_key"], "endpoint": "https://safebrowsing.googleapis.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('URLScan.io', 'security', 'available', false, NULL,
'{"description": "Automated website scanner for suspicious and malicious URLs", "requires": ["api_key"], "endpoint": "https://urlscan.io/api/v1"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('PhishTank', 'security', 'available', false, NULL,
'{"description": "Community-based phishing website database", "requires": ["api_key"], "endpoint": "https://checkurl.phishtank.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- AI & Machine Learning
('Anthropic Claude', 'ai', 'active', true, CURRENT_TIMESTAMP,
'{"description": "AI-powered content analysis and threat detection", "requires": ["api_key"], "endpoint": "https://api.anthropic.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('OpenAI GPT', 'ai', 'available', false, NULL,
'{"description": "Alternative AI model for content analysis", "requires": ["api_key"], "endpoint": "https://api.openai.com/v1"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Email Services
('SendGrid', 'email', 'available', false, NULL,
'{"description": "Email delivery service for notifications", "requires": ["api_key", "from_email"], "endpoint": "https://api.sendgrid.com/v3"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('AWS SES', 'email', 'available', false, NULL,
'{"description": "Amazon Simple Email Service for transactional emails", "requires": ["aws_access_key", "aws_secret_key", "region"], "endpoint": "https://email.us-east-1.amazonaws.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Mailgun', 'email', 'available', false, NULL,
'{"description": "Email automation and delivery service", "requires": ["api_key", "domain"], "endpoint": "https://api.mailgun.net/v3"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Payment Processing
('Stripe', 'payment', 'available', false, NULL,
'{"description": "Payment processing for subscriptions", "requires": ["publishable_key", "secret_key"], "endpoint": "https://api.stripe.com/v1"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('PayPal', 'payment', 'available', false, NULL,
'{"description": "PayPal payment gateway integration", "requires": ["client_id", "client_secret"], "endpoint": "https://api-m.paypal.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- SMS & Communication
('Twilio', 'sms', 'available', false, NULL,
'{"description": "SMS and voice communication for 2FA and alerts", "requires": ["account_sid", "auth_token", "phone_number"], "endpoint": "https://api.twilio.com/2010-04-01"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Analytics & Monitoring
('Google Analytics', 'analytics', 'available', false, NULL,
'{"description": "Web analytics and user behavior tracking", "requires": ["tracking_id", "measurement_id"], "endpoint": "https://www.google-analytics.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Mixpanel', 'analytics', 'available', false, NULL,
'{"description": "Product analytics and user insights", "requires": ["project_token"], "endpoint": "https://api.mixpanel.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Sentry', 'monitoring', 'available', false, NULL,
'{"description": "Error tracking and performance monitoring", "requires": ["dsn"], "endpoint": "https://sentry.io/api"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Data Storage & Backup
('AWS S3', 'storage', 'available', false, NULL,
'{"description": "Cloud storage for files and backups", "requires": ["aws_access_key", "aws_secret_key", "bucket_name", "region"], "endpoint": "https://s3.amazonaws.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Google Cloud Storage', 'storage', 'available', false, NULL,
'{"description": "Google Cloud object storage", "requires": ["project_id", "credentials"], "endpoint": "https://storage.googleapis.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Social Media
('Twitter/X API', 'social', 'available', false, NULL,
'{"description": "Analyze Twitter/X profiles and posts for scams", "requires": ["api_key", "api_secret", "bearer_token"], "endpoint": "https://api.twitter.com/2"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Facebook Graph API', 'social', 'available', false, NULL,
'{"description": "Analyze Facebook profiles and content", "requires": ["app_id", "app_secret"], "endpoint": "https://graph.facebook.com"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('LinkedIn API', 'social', 'available', false, NULL,
'{"description": "Verify LinkedIn profiles against scam patterns", "requires": ["client_id", "client_secret"], "endpoint": "https://api.linkedin.com/v2"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Customer Support
('Zendesk', 'support', 'available', false, NULL,
'{"description": "Customer support ticketing system", "requires": ["subdomain", "api_token", "email"], "endpoint": "https://{subdomain}.zendesk.com/api/v2"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('Intercom', 'support', 'available', false, NULL,
'{"description": "Customer messaging and live chat platform", "requires": ["app_id", "api_key"], "endpoint": "https://api.intercom.io"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Database & Caching
('Redis Cloud', 'cache', 'available', false, NULL,
'{"description": "Redis cache for session management and rate limiting", "requires": ["host", "port", "password"], "endpoint": "redis://"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('ChromaDB', 'database', 'available', false, NULL,
'{"description": "Vector database for AI embeddings and RAG", "requires": ["host", "port"], "endpoint": "http://"}',
CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

ON CONFLICT (name) DO NOTHING;
