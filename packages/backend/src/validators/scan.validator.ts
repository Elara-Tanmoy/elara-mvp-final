import { z } from 'zod';

export const urlScanSchema = z.object({
  url: z.string().url('Invalid URL format').max(2048, 'URL too long')
});

export const messageScanSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(50000, 'Message too long'),
  sender: z.string().optional(),
  subject: z.string().optional(),
  language: z.enum(['en', 'es', 'fr', 'de', 'it']).optional().default('en')
});

export const fileScanSchema = z.object({
  fileName: z.string().min(1, 'Filename is required'),
  fileSize: z.number().positive().max(52428800, 'File size exceeds 50MB limit'),
  mimeType: z.string().min(1, 'MIME type is required')
});

export const scanQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  scanType: z.enum(['url', 'message', 'file']).optional(),
  riskLevel: z.enum(['safe', 'low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export type UrlScanInput = z.infer<typeof urlScanSchema>;
export type MessageScanInput = z.infer<typeof messageScanSchema>;
export type FileScanInput = z.infer<typeof fileScanSchema>;
export type ScanQuery = z.infer<typeof scanQuerySchema>;
