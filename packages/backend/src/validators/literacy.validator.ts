import { z } from 'zod';

/**
 * Digital Literacy Coach Validation Schemas
 */

export const quizQuerySchema = z.object({
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional()
});

export const quizSubmissionSchema = z.object({
  answers: z.array(z.number().min(0).max(4))
    .min(1, 'At least one answer is required')
    .max(50, 'Too many answers')
});

export const lessonsQuerySchema = z.object({
  category: z.enum(['phishing', 'passwords', 'social_engineering', 'malware', 'privacy']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional()
});

export const progressTrackingSchema = z.object({
  lessonId: z.string().min(1, 'Lesson ID is required').max(50),
  completed: z.boolean().optional().default(false),
  timeSpent: z.number().min(0).max(36000, 'Time spent exceeds 10 hours').optional().default(0)
});

export const exerciseSubmissionSchema = z.object({
  lessonId: z.string().min(1, 'Lesson ID is required').max(50),
  answer: z.number().min(0).max(10)
});

export type QuizQuery = z.infer<typeof quizQuerySchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
export type LessonsQuery = z.infer<typeof lessonsQuerySchema>;
export type ProgressTracking = z.infer<typeof progressTrackingSchema>;
export type ExerciseSubmission = z.infer<typeof exerciseSubmissionSchema>;
