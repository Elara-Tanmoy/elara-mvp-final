-- Add chatbot tables for Ask Elara conversational AI
-- Note: Vector embeddings disabled until pgvector extension is installed

-- Chatbot Configuration
CREATE TABLE IF NOT EXISTS chatbot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL DEFAULT 'Ask Elara',
  system_prompt TEXT NOT NULL,
  custom_instructions TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  model VARCHAR(100) DEFAULT 'claude-sonnet-4-5',
  enable_rag BOOLEAN DEFAULT true,
  enable_conversation_memory BOOLEAN DEFAULT true,
  max_conversation_history INTEGER DEFAULT 10,
  response_style VARCHAR(50) DEFAULT 'professional',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base for RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text', -- text, csv, pdf, json
  source VARCHAR(500), -- file name or URL
  category VARCHAR(100), -- cybersecurity, phishing, malware, etc.
  -- embedding vector(1536), -- OpenAI embedding dimension - disabled until pgvector installed
  metadata JSONB,
  chunk_index INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 1,
  indexed BOOLEAN DEFAULT false,
  created_by TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
-- CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
-- Disabled until pgvector extension is installed

-- Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE,
  context JSONB, -- Store conversation context
  metadata JSONB, -- User info, device, etc.
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  rating INTEGER, -- 1-5 user rating
  feedback TEXT
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  retrieved_sources JSONB, -- RAG sources used
  model VARCHAR(100),
  tokens_used INTEGER,
  latency INTEGER, -- milliseconds
  confidence DECIMAL(3,2), -- 0.00-1.00
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training Data
CREATE TABLE IF NOT EXISTS chatbot_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type VARCHAR(50) NOT NULL, -- csv, text, json, conversation
  file_name VARCHAR(500),
  file_size BIGINT,
  content TEXT,
  processed_entries INTEGER DEFAULT 0,
  total_entries INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  uploaded_by TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- Chatbot Analytics
CREATE TABLE IF NOT EXISTS chatbot_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  avg_response_time INTEGER, -- milliseconds
  avg_rating DECIMAL(3,2),
  successful_responses INTEGER DEFAULT 0,
  failed_responses INTEGER DEFAULT 0,
  top_topics JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_token ON chat_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_indexed ON knowledge_base(indexed);
CREATE INDEX IF NOT EXISTS idx_training_data_status ON chatbot_training_data(status);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON chatbot_analytics(date);

-- Insert default chatbot configuration
INSERT INTO chatbot_config (
  name,
  system_prompt,
  custom_instructions,
  temperature,
  max_tokens,
  model,
  enable_rag,
  enable_conversation_memory
) VALUES (
  'Ask Elara - Cybersecurity Assistant',
  'You are Ask Elara, an expert cybersecurity and online safety assistant. You help users understand and protect themselves from cyber threats, scams, phishing, malware, and other online dangers.

Your expertise includes:
- Identifying phishing emails and scam messages
- Analyzing suspicious URLs and websites
- Explaining malware and ransomware threats
- Teaching social engineering tactics
- Providing online safety best practices
- Helping victims of cyber attacks
- Digital literacy education
- Privacy and data protection advice

Always:
- Provide clear, actionable advice
- Use simple language that non-technical users can understand
- Include specific examples when helpful
- Cite credible sources when available
- Be empathetic and supportive, especially with scam victims
- Prioritize user safety above all else
- Explain technical concepts in plain English
- Provide step-by-step guidance when appropriate

Never:
- Provide advice that could harm users
- Share techniques that could be used maliciously
- Make guarantees about absolute security
- Recommend illegal activities
- Share personal information
- Give financial or legal advice beyond basic safety tips',
  'When answering questions:
1. Start with a direct answer to the user''s question
2. Provide context and explanation
3. Include practical examples if relevant
4. Suggest next steps or preventive measures
5. Offer to clarify or provide more details

For elderly or non-technical users:
- Use simple, everyday language
- Avoid jargon or explain technical terms
- Provide analogies to familiar concepts
- Break complex topics into simple steps
- Be extra patient and encouraging

Tone: Professional yet friendly, empathetic, reassuring',
  0.7,
  2000,
  'claude-sonnet-4-5',
  true,
  true
);

-- Insert initial cybersecurity knowledge base entries
INSERT INTO knowledge_base (title, content, category, indexed) VALUES
('What is Phishing?', 'Phishing is a cybercrime where attackers impersonate legitimate organizations to steal sensitive information like passwords, credit card numbers, or personal data. Common signs include: urgent language, suspicious sender email, requests for personal info, spelling errors, mismatched URLs, too-good-to-be-true offers. Always verify sender identity, check URLs carefully, never click suspicious links, and report phishing attempts.', 'phishing', false),

('How to Identify Scam Emails', 'Scam emails often have these characteristics: Generic greetings (Dear Customer), urgent threats (Account will be closed), poor grammar and spelling, suspicious attachments, requests for passwords or financial info, mismatched sender domains, too-good-to-be-true offers. Always hover over links before clicking, verify sender email domain, be skeptical of urgent requests, and contact companies directly using official channels.', 'phishing', false),

('What is Ransomware?', 'Ransomware is malicious software that encrypts your files and demands payment for decryption. Protection steps: Keep software updated, backup data regularly (offline backups), use antivirus software, be cautious with email attachments, avoid suspicious downloads, enable firewall. If infected: Disconnect from internet immediately, do NOT pay ransom, report to authorities, restore from backups if available, seek professional help.', 'malware', false),

('Social Engineering Tactics', 'Social engineering manipulates people into divulging confidential information. Common tactics: Pretexting (fake scenarios), Baiting (free offers), Tailgating (physical access), Phishing (fake emails), Vishing (phone scams), Smishing (SMS scams). Defense: Verify identities, question unusual requests, never share passwords, be skeptical of urgency, trust your instincts, report suspicious behavior.', 'social-engineering', false),

('Password Security Best Practices', 'Strong password guidelines: Use 12+ characters, mix uppercase/lowercase/numbers/symbols, avoid personal info, use unique passwords per account, enable two-factor authentication (2FA), use password manager, change passwords if breached, never share passwords. Avoid: Dictionary words, sequential numbers (123456), personal dates, reusing passwords across sites.', 'best-practices', false),

('Two-Factor Authentication (2FA)', '2FA adds extra security by requiring two verification methods. Types: SMS codes (good), authenticator apps (better), hardware keys (best). Enable 2FA on: Email accounts, banking, social media, work accounts. Benefits: Protects even if password stolen, prevents unauthorized access, required for sensitive accounts. Setup: Enable in account settings, save backup codes, use authenticator app like Google Authenticator or Authy.', 'best-practices', false),

('Recognizing Fake Websites', 'Fake websites impersonate legitimate sites to steal credentials. Warning signs: Wrong URL (slight misspellings), no HTTPS padlock, poor design quality, suspicious payment methods, too-good-to-be-true prices, no contact information, recently registered domain, pop-up requests for info. Always: Check URL carefully, verify HTTPS, research company, use official links, avoid clicking email links.', 'phishing', false),

('What to Do If You''re Scammed', 'Immediate steps: Stop all contact with scammer, do NOT send more money, preserve all evidence (emails, messages, receipts), contact your bank immediately if you sent money, change all passwords, enable 2FA everywhere, scan devices for malware. Report to: Local police, FBI IC3 (ic3.gov), FTC (reportfraud.ftc.gov), your bank''s fraud department. Seek support from family or organizations.', 'recovery', false),

('Safe Online Shopping Tips', 'Secure shopping practices: Use known retailers, verify HTTPS on checkout, use credit cards (better fraud protection), avoid public WiFi for purchases, check seller reviews, be wary of huge discounts, save receipts and confirmations, monitor bank statements, use virtual card numbers, research unfamiliar sites. Red flags: No contact info, pressure to buy quickly, wire transfer requests, too cheap prices.', 'best-practices', false),

('Protecting Personal Information Online', 'Data protection strategies: Limit info shared on social media, use privacy settings, be selective with app permissions, avoid oversharing location, don''t post travel plans in real-time, review what''s public, use different emails for important accounts, opt out of data brokers, read privacy policies, use VPN on public WiFi. Remember: Once online, information can be permanent.', 'privacy', false);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chatbot_config_updated_at BEFORE UPDATE ON chatbot_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
