import { z } from 'zod';

/**
 * Fact Checking Validation Schemas
 */

export const factCheckSchema = z.object({
  claim: z.string()
    .min(10, 'Claim must be at least 10 characters')
    .max(10000, 'Claim too long (max 10,000 characters)'),
  articleUrl: z.string().url('Invalid URL format').max(2048, 'URL too long').optional(),
  category: z.enum(['health', 'political', 'financial', 'scientific', 'general']).optional().default('general'),
  context: z.string().max(5000, 'Context too long').optional()
});

export const extractClaimsSchema = z.object({
  articleUrl: z.string().url('Invalid URL format').max(2048, 'URL too long').optional(),
  articleText: z.string()
    .min(50, 'Article text must be at least 50 characters')
    .max(50000, 'Article text too long (max 50,000 characters)')
    .optional()
}).refine(
  (data) => data.articleUrl || data.articleText,
  {
    message: 'Either articleUrl or articleText must be provided',
    path: ['articleUrl']
  }
);

export type FactCheckInput = z.infer<typeof factCheckSchema>;
export type ExtractClaimsInput = z.infer<typeof extractClaimsSchema>;
