-- Drop the problematic value index that causes PostgreSQL size limit errors
-- PostgreSQL B-tree indexes have an 8191-byte limit per row
-- Long URLs from PhishTank exceed this limit
-- We keep valueHash index which is always fixed-length SHA-256

DROP INDEX IF EXISTS "threat_indicators_value_idx";
