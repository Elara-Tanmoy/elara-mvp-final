import { z } from 'zod';

/**
 * Recovery Support Validation Schemas
 */

export const incidentReportSchema = z.object({
  scamType: z.enum([
    'phishing',
    'investment',
    'romance',
    'tech_support',
    'lottery',
    'employment',
    'other'
  ]),
  description: z.string()
    .min(20, 'Please provide more details (at least 20 characters)')
    .max(5000, 'Description too long (max 5,000 characters)'),
  financialLoss: z.number()
    .min(0, 'Financial loss cannot be negative')
    .max(10000000, 'Financial loss value too large')
    .optional(),
  personalInfoShared: z.array(z.string().max(100))
    .max(20, 'Too many items')
    .optional(),
  whenOccurred: z.string().max(200).optional(),
  alreadyReported: z.boolean().optional().default(false),
  emotionalState: z.string().max(1000).optional()
});

export const resourcesQuerySchema = z.object({
  type: z.enum(['reporting', 'financial', 'emotional', 'legal']).optional(),
  available24_7: z.enum(['true', 'false']).optional()
});

export const followUpSchema = z.object({
  incidentId: z.string()
    .min(1, 'Incident ID is required')
    .max(100, 'Incident ID too long'),
  status: z.enum(['in_progress', 'resolved', 'needs_help']).optional(),
  notes: z.string().max(2000, 'Notes too long').optional(),
  emotionalState: z.string().max(1000).optional()
});

export type IncidentReport = z.infer<typeof incidentReportSchema>;
export type ResourcesQuery = z.infer<typeof resourcesQuerySchema>;
export type FollowUp = z.infer<typeof followUpSchema>;
