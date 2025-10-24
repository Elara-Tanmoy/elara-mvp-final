import { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { literacyCoachService } from '../services/analyzers/literacy-coach.service.js';

/**
 * Digital Literacy Coach Controller
 * Handles quiz, lessons, and progress tracking
 */

export class LiteracyController {
  /**
   * Get assessment quiz
   * GET /api/v2/literacy/quiz
   */
  async getQuiz(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { difficulty } = req.query;

      logger.info(`Quiz requested by user ${userId}`);

      // Get quiz from service
      const quiz = literacyCoachService.getAssessmentQuiz(difficulty as string);

      res.status(200).json({
        success: true,
        data: {
          quiz,
          totalQuestions: quiz.length,
          estimatedTime: '15-20 minutes',
          instructions: 'Answer all questions honestly to get an accurate assessment of your digital literacy level.'
        }
      });

    } catch (error) {
      logger.error('Get quiz error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch quiz',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Submit quiz answers and get assessment
   * POST /api/v2/literacy/quiz/submit
   */
  async submitQuiz(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { answers } = req.body;

      // Validate request
      if (!answers || !Array.isArray(answers)) {
        res.status(400).json({
          success: false,
          error: 'Answers array is required'
        });
        return;
      }

      if (answers.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one answer is required'
        });
        return;
      }

      logger.info(`Quiz submitted by user ${userId}: ${answers.length} answers`);

      // Grade quiz
      const quizResult = literacyCoachService.gradeQuiz(answers);

      // Generate personalized learning path
      const learningPath = literacyCoachService.generateLearningPath(quizResult);

      // Calculate latency
      const latency = Date.now() - startTime;

      // Save progress to database (would need implementation)
      // await this.saveQuizProgress(userId, quizResult, learningPath);

      res.status(200).json({
        success: true,
        data: {
          quizResult,
          learningPath,
          metadata: {
            submittedAt: new Date().toISOString(),
            latency,
            totalQuestions: answers.length
          }
        }
      });

    } catch (error) {
      logger.error('Submit quiz error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit quiz',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all available lessons
   * GET /api/v2/literacy/lessons
   */
  async getLessons(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { category, difficulty } = req.query;

      logger.info(`Lessons requested by user ${userId}`);

      // Get lessons from service
      let lessons = literacyCoachService.getAllLessons();

      // Filter by category if provided
      if (category && typeof category === 'string') {
        lessons = lessons.filter(l => l.category === category);
      }

      // Filter by difficulty if provided
      if (difficulty && typeof difficulty === 'string') {
        lessons = lessons.filter(l => l.difficulty === difficulty);
      }

      res.status(200).json({
        success: true,
        data: {
          lessons,
          totalLessons: lessons.length,
          categories: ['phishing', 'passwords', 'social_engineering', 'malware', 'privacy'],
          difficulties: ['beginner', 'intermediate', 'advanced']
        }
      });

    } catch (error) {
      logger.error('Get lessons error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lessons',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get specific lesson by ID
   * GET /api/v2/literacy/lessons/:lessonId
   */
  async getLesson(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { lessonId } = req.params;

      logger.info(`Lesson ${lessonId} requested by user ${userId}`);

      // Get lesson from service
      const lesson = literacyCoachService.getLessonById(lessonId);

      if (!lesson) {
        res.status(404).json({
          success: false,
          error: 'Lesson not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          lesson,
          // Would include user's progress on this lesson if tracked
          userProgress: {
            completed: false,
            completedAt: null,
            timeSpent: 0
          }
        }
      });

    } catch (error) {
      logger.error('Get lesson error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lesson',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Track lesson progress
   * POST /api/v2/literacy/progress
   */
  async trackProgress(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { lessonId, completed, timeSpent } = req.body;

      // Validate request
      if (!lessonId) {
        res.status(400).json({
          success: false,
          error: 'lessonId is required'
        });
        return;
      }

      logger.info(`Progress update for user ${userId}, lesson ${lessonId}`);

      // Track progress
      const progress = await literacyCoachService.trackProgress({
        userId,
        lessonId,
        completed: completed || false,
        timeSpent: timeSpent || 0,
        completedAt: completed ? new Date() : undefined
      });

      res.status(200).json({
        success: true,
        data: {
          progress,
          message: completed ? 'Lesson completed! 🎉' : 'Progress saved'
        }
      });

    } catch (error) {
      logger.error('Track progress error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track progress',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's overall progress
   * GET /api/v2/literacy/progress
   */
  async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };

      logger.info(`Progress requested by user ${userId}`);

      // Get progress from database (would need implementation)
      const progress = await literacyCoachService.getUserProgress(userId);

      res.status(200).json({
        success: true,
        data: progress
      });

    } catch (error) {
      logger.error('Get progress error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch progress',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get exercise for lesson
   * GET /api/v2/literacy/exercise/:lessonId
   */
  async getExercise(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { lessonId } = req.params;

      logger.info(`Exercise requested for lesson ${lessonId} by user ${userId}`);

      // Get lesson to find exercise
      const lesson = literacyCoachService.getLessonById(lessonId);

      if (!lesson) {
        res.status(404).json({
          success: false,
          error: 'Lesson not found'
        });
        return;
      }

      // Return exercise
      res.status(200).json({
        success: true,
        data: {
          exercise: lesson.exercise,
          lessonTitle: lesson.title,
          category: lesson.category
        }
      });

    } catch (error) {
      logger.error('Get exercise error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exercise',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Submit exercise answer
   * POST /api/v2/literacy/exercise/submit
   */
  async submitExercise(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { lessonId, answer } = req.body;

      // Validate request
      if (!lessonId || !answer) {
        res.status(400).json({
          success: false,
          error: 'lessonId and answer are required'
        });
        return;
      }

      logger.info(`Exercise submitted for lesson ${lessonId} by user ${userId}`);

      // Get lesson
      const lesson = literacyCoachService.getLessonById(lessonId);

      if (!lesson) {
        res.status(404).json({
          success: false,
          error: 'Lesson not found'
        });
        return;
      }

      // Check answer
      const isCorrect = lesson.exercise.correctAnswer === answer;

      res.status(200).json({
        success: true,
        data: {
          correct: isCorrect,
          explanation: lesson.exercise.explanation,
          correctAnswer: isCorrect ? undefined : lesson.exercise.correctAnswer,
          message: isCorrect
            ? '✅ Correct! Well done!'
            : '❌ Not quite. Review the explanation and try again.'
        }
      });

    } catch (error) {
      logger.error('Submit exercise error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit exercise',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get literacy statistics
   * GET /api/v2/literacy/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };

      logger.info(`Literacy stats requested by user ${userId}`);

      // Get stats from database (would need implementation)
      const stats = {
        totalLessonsCompleted: 0,
        totalTimeSpent: 0,
        currentLevel: 'beginner',
        quizzesTaken: 0,
        averageScore: 0,
        strongestCategory: 'phishing',
        weakestCategory: 'privacy',
        completionRate: 0,
        streak: 0 // Days in a row
      };

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Get literacy stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recommended lessons based on user's progress
   * GET /api/v2/literacy/recommendations
   */
  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };

      logger.info(`Lesson recommendations requested by user ${userId}`);

      // Get user's progress to determine recommendations
      const userProgress = await literacyCoachService.getUserProgress(userId);

      // Get lessons user hasn't completed
      const allLessons = literacyCoachService.getAllLessons();
      const completedLessonIds = new Set(
        userProgress.lessonsCompleted.map(l => l.lessonId)
      );

      const recommendations = allLessons
        .filter(lesson => !completedLessonIds.has(lesson.id))
        .filter(lesson => lesson.difficulty === userProgress.literacyLevel)
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5); // Top 5 recommendations

      res.status(200).json({
        success: true,
        data: {
          recommendations,
          totalRecommendations: recommendations.length,
          basedOn: {
            literacyLevel: userProgress.literacyLevel,
            completedLessons: userProgress.lessonsCompleted.length,
            knowledgeGaps: userProgress.knowledgeGaps
          }
        }
      });

    } catch (error) {
      logger.error('Get recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const literacyController = new LiteracyController();
