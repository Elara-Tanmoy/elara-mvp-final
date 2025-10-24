-- Initialize Elara Platform System Settings
-- This script populates the SystemSetting table with all controllable platform configurations

-- Platform General Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('platform.name', '"Elara Platform"', 'general', 'Platform display name', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('platform.tagline', '"Comprehensive Scam Protection with AI-Powered Threat Detection"', 'general', 'Platform tagline', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('platform.maintenance_mode', 'false', 'general', 'Enable maintenance mode to disable user access', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('platform.allow_registration', 'true', 'general', 'Allow new user registrations', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('platform.default_tier', '"free"', 'general', 'Default tier for new users', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Security Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('security.session_timeout', '3600', 'security', 'Session timeout in seconds (1 hour)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('security.max_login_attempts', '5', 'security', 'Maximum login attempts before lockout', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('security.lockout_duration', '1800', 'security', 'Account lockout duration in seconds (30 minutes)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('security.password_min_length', '8', 'security', 'Minimum password length', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('security.require_email_verification', 'true', 'security', 'Require email verification for new accounts', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('security.enable_2fa', 'true', 'security', 'Enable two-factor authentication support', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Feature Flags
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('features.url_scanner', 'true', 'features', 'Enable URL scanning feature', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.message_scanner', 'true', 'features', 'Enable message/email scanning feature', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.file_scanner', 'true', 'features', 'Enable file scanning feature', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.profile_analyzer', 'true', 'features', 'Enable social media profile analysis', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.fact_checker', 'true', 'features', 'Enable fact checking feature', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.digital_literacy', 'true', 'features', 'Enable digital literacy coaching', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.recovery_support', 'true', 'features', 'Enable recovery support and resources', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.chatbot', 'true', 'features', 'Enable Ask Elara chatbot', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.webhooks', 'true', 'features', 'Enable webhook integrations', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('features.api_keys', 'true', 'features', 'Enable API key management', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- AI/ML Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('ai.model', '"claude-sonnet-4-5"', 'ai', 'Default AI model for analysis', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ai.temperature', '0.7', 'ai', 'AI temperature for generation', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ai.max_tokens', '2000', 'ai', 'Maximum tokens per AI response', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ai.enable_caching', 'true', 'ai', 'Enable response caching for common queries', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ai.cache_ttl', '3600', 'ai', 'Cache time-to-live in seconds', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ai.confidence_threshold', '0.7', 'ai', 'Minimum confidence threshold for threat detection', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Rate Limiting Settings (Global)
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('rate_limit.free.requests_per_minute', '10', 'rate_limit', 'Free tier: Requests per minute', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.free.requests_per_hour', '100', 'rate_limit', 'Free tier: Requests per hour', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.free.requests_per_day', '500', 'rate_limit', 'Free tier: Requests per day', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.free.max_scans_per_day', '50', 'rate_limit', 'Free tier: Maximum scans per day', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.free.max_file_size_mb', '5', 'rate_limit', 'Free tier: Maximum file size in MB', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.premium.requests_per_minute', '50', 'rate_limit', 'Premium tier: Requests per minute', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.premium.requests_per_hour', '1000', 'rate_limit', 'Premium tier: Requests per hour', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.premium.requests_per_day', '10000', 'rate_limit', 'Premium tier: Requests per day', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.premium.max_scans_per_day', '500', 'rate_limit', 'Premium tier: Maximum scans per day', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.premium.max_file_size_mb', '25', 'rate_limit', 'Premium tier: Maximum file size in MB', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.enterprise.requests_per_minute', '200', 'rate_limit', 'Enterprise tier: Requests per minute', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.enterprise.requests_per_hour', '10000', 'rate_limit', 'Enterprise tier: Requests per hour', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.enterprise.requests_per_day', '999999', 'rate_limit', 'Enterprise tier: Requests per day (unlimited)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.enterprise.max_scans_per_day', '10000', 'rate_limit', 'Enterprise tier: Maximum scans per day', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rate_limit.enterprise.max_file_size_mb', '100', 'rate_limit', 'Enterprise tier: Maximum file size in MB', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Email Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('email.from_name', '"Elara Platform"', 'email', 'Email sender name', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('email.from_address', '"noreply@elara-platform.com"', 'email', 'Email sender address', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('email.support_email', '"support@elara-platform.com"', 'email', 'Support email address', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('email.enable_notifications', 'true', 'email', 'Enable email notifications', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('email.notification_types', '["scan_complete","threat_detected","subscription_update","security_alert"]', 'email', 'Enabled notification types', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Payment/Billing Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('billing.currency', '"USD"', 'billing', 'Default billing currency', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('billing.free_trial_days', '14', 'billing', 'Free trial period in days for premium', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('billing.premium_monthly_price', '9.99', 'billing', 'Premium subscription monthly price', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('billing.premium_yearly_price', '99.99', 'billing', 'Premium subscription yearly price', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('billing.enterprise_base_price', '299.99', 'billing', 'Enterprise subscription base monthly price', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('billing.enable_payment', 'false', 'billing', 'Enable payment processing (requires payment gateway setup)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('billing.payment_provider', '"stripe"', 'billing', 'Payment provider (stripe, paypal, etc)', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Analytics Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('analytics.enable_tracking', 'true', 'analytics', 'Enable platform analytics tracking', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('analytics.data_retention_days', '365', 'analytics', 'Analytics data retention period in days', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('analytics.enable_user_tracking', 'true', 'analytics', 'Track individual user behavior', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('analytics.anonymize_ip', 'true', 'analytics', 'Anonymize user IP addresses', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Content Moderation Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('moderation.auto_flag_threshold', '0.8', 'moderation', 'Auto-flag content with threat score above this threshold', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('moderation.enable_auto_block', 'false', 'moderation', 'Automatically block high-risk URLs/content', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('moderation.enable_reporting', 'true', 'moderation', 'Allow users to report false positives/negatives', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Integration Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('integrations.enable_third_party', 'true', 'integrations', 'Allow third-party integrations', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('integrations.api_version', '"v2"', 'integrations', 'Current API version', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('integrations.max_webhooks_per_org', '10', 'integrations', 'Maximum webhooks per organization', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('integrations.max_api_keys_per_org', '5', 'integrations', 'Maximum API keys per organization', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Mobile App Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('mobile.ios_version', '"1.0.0"', 'mobile', 'Current iOS app version', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mobile.android_version', '"1.0.0"', 'mobile', 'Current Android app version', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mobile.force_update', 'false', 'mobile', 'Force users to update to latest version', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mobile.enable_push_notifications', 'true', 'mobile', 'Enable push notifications for mobile apps', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Support Settings
INSERT INTO "SystemSetting" (key, value, category, description, "isPublic", "createdAt", "updatedAt")
VALUES
('support.enable_live_chat', 'true', 'support', 'Enable live chat support', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('support.enable_email_support', 'true', 'support', 'Enable email support tickets', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('support.priority_response_hours', '24', 'support', 'Priority support response time in hours', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('support.standard_response_hours', '72', 'support', 'Standard support response time in hours', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
