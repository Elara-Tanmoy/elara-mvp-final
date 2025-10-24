import { z } from 'zod';

export const datasetUploadSchema = z.object({
  name: z.string().min(1, 'Dataset name is required').max(200),
  description: z.string().optional()
});

export const datasetQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
  status: z.enum(['processing', 'ready', 'failed']).optional(),
  vectorized: z.string().optional().transform(val => val === 'true')
});

export const aiQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000),
  useRAG: z.boolean().optional().default(true),
  model: z.enum(['claude', 'gpt4', 'gemini']).optional().default('claude')
});

export type DatasetUploadInput = z.infer<typeof datasetUploadSchema>;
export type DatasetQuery = z.infer<typeof datasetQuerySchema>;
export type AIQueryInput = z.infer<typeof aiQuerySchema>;
