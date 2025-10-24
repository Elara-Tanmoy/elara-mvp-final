-- AlterTable: Add verdict, OCR, and analysis fields to scan_results
ALTER TABLE "scan_results" ADD COLUMN IF NOT EXISTS "verdict" JSONB;
ALTER TABLE "scan_results" ADD COLUMN IF NOT EXISTS "conversationAnalysis" JSONB;
ALTER TABLE "scan_results" ADD COLUMN IF NOT EXISTS "intentAnalysis" JSONB;
ALTER TABLE "scan_results" ADD COLUMN IF NOT EXISTS "ocrText" TEXT;
ALTER TABLE "scan_results" ADD COLUMN IF NOT EXISTS "ocrConfidence" DOUBLE PRECISION;
ALTER TABLE "scan_results" ADD COLUMN IF NOT EXISTS "extractedText" TEXT;
