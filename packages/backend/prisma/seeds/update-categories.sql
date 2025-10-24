-- Update category names to match CATEGORY_METADATA
UPDATE "CheckType" SET category = 'SSL/TLS Security' WHERE category = 'SSL/TLS Certificate Validation';
UPDATE "CheckType" SET category = 'Domain, WHOIS & TLD Analysis' WHERE category = 'Domain Age and Registration';
UPDATE "CheckType" SET category = 'Domain, WHOIS & TLD Analysis' WHERE category = 'DNS Record Analysis';
UPDATE "CheckType" SET category = 'Domain, WHOIS & TLD Analysis' WHERE category = 'URL Structure Pattern Analysis';
UPDATE "CheckType" SET category = 'Content Analysis' WHERE category = 'Content Security Policy (CSP)';
UPDATE "CheckType" SET category = 'SSL/TLS Security' WHERE category = 'HTTP Security Headers';
UPDATE "CheckType" SET category = 'Content Analysis' WHERE category = 'External Resource Loading';
UPDATE "CheckType" SET category = 'Phishing Patterns' WHERE category = 'Form and Input Analysis';
UPDATE "CheckType" SET category = 'Phishing Patterns' WHERE category = 'Redirect Chain Analysis';
UPDATE "CheckType" SET category = 'Social Engineering' WHERE category = 'Social Engineering Indicators';
UPDATE "CheckType" SET category = 'Malware Detection' WHERE category = 'Advanced Threat Detection';
UPDATE "CheckType" SET category = 'Technical Exploits' WHERE category = 'Browser Fingerprinting Detection';
UPDATE "CheckType" SET category = 'Technical Exploits' WHERE category = 'Cookie and Storage Analysis';
UPDATE "CheckType" SET category = 'Content Analysis' WHERE category = 'Performance Metrics';
UPDATE "CheckType" SET category = 'Brand Impersonation' WHERE category = 'SEO and Metadata';
