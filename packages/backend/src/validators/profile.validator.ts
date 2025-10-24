import { z } from 'zod';

/**
 * Profile Analysis Validation Schemas
 */

export const profileAnalysisSchema = z.object({
  profileUrl: z.string().url('Invalid URL format').max(2048, 'URL too long').optional(),
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'twitter', 'telegram', 'other']).optional(),
  username: z.string().min(1, 'Username required').max(100, 'Username too long').optional(),
  displayName: z.string().max(200, 'Display name too long').optional(),
  bio: z.string().max(5000, 'Bio too long').optional(),
  followerCount: z.number().min(0).max(1000000000).optional(),
  followingCount: z.number().min(0).max(1000000000).optional(),
  postCount: z.number().min(0).max(1000000000).optional(),
  accountAge: z.string().max(100).optional(),
  verified: z.boolean().optional(),
  profilePhotoUrl: z.string().url('Invalid photo URL').max(2048).optional(),
  recentPosts: z.array(z.object({
    content: z.string().max(10000),
    likes: z.number().min(0),
    comments: z.number().min(0),
    timestamp: z.coerce.date()
  })).max(50, 'Too many posts').optional()
}).refine(
  (data) => data.profileUrl || data.username,
  {
    message: 'Either profileUrl or username must be provided',
    path: ['profileUrl']
  }
);

export type ProfileAnalysisInput = z.infer<typeof profileAnalysisSchema>;
