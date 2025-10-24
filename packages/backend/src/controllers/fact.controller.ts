import { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { factCheckerService } from '../services/analyzers/fact-checker.service.js';
import { realFactCheckerService } from '../services/fact-check/real-fact-checker.service.js';
import { bigQueryLoggerService } from '../services/logging/bigquery-logger.service.js';

/**
 * Fact Checker Controller
 * Handles fact-checking requests for claims and articles
 */

export interface FactCheckRequest {
  claim: string;
  articleUrl?: string;
  category?: 'health' | 'political' | 'financial' | 'scientific' | 'general';
  context?: string;
}

export class FactController {
  /**
   * Check fact/claim
   * POST /api/v2/analyze/fact
   */
  async checkFact(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const requestData: FactCheckRequest = req.body;

      // Validate request
      if (!requestData.claim || requestData.claim.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Claim text is required'
        });
        return;
      }

      if (requestData.claim.length > 10000) {
        res.status(400).json({
          success: false,
          error: 'Claim text too long (max 10,000 characters)'
        });
        return;
      }

      logger.info(`Fact check requested by user ${userId}: "${requestData.claim.substring(0, 100)}..."`);

      // Use REAL fact checker with Google Fact Check API and News API
      logger.info(`[Fact Controller] Using REAL fact checker with Google API and news sources`);

      const realFactCheckResult = await realFactCheckerService.checkFact(requestData.claim);

      // Calculate latency
      const latency = Date.now() - startTime;

      // Estimate cost (Google API calls + News API)
      const estimatedCost = this.estimateApiCost(requestData.claim.length);

      logger.info(`[Fact Controller] Real fact check complete: ${realFactCheckResult.verdict} (${realFactCheckResult.confidence}% confidence, ${realFactCheckResult.sources.length} sources)`);

      // Log to BigQuery for ML training (async, don't await)
      bigQueryLoggerService.logAnalysis({
        userId,
        type: 'fact',
        input: {
          text: requestData.claim,
          type: 'fact_check',
          length: requestData.claim.length,
          metadata: {
            category: requestData.category || 'general',
            hasArticleUrl: !!requestData.articleUrl
          }
        },
        verdict: realFactCheckResult.verdict,
        specificData: {
          confidence: realFactCheckResult.confidence,
          sourcesCount: realFactCheckResult.sources.length,
          newsArticlesCount: realFactCheckResult.newsArticles.length,
          verdict: realFactCheckResult.verdict
        },
        latency,
        cost: estimatedCost,
        timestamp: new Date()
      }).catch(err => logger.error('BigQuery logging failed:', err));

      // Transform response to match frontend expectations
      const evidence: any[] = [];

      // Add fact check sources as evidence
      realFactCheckResult.sources.forEach(source => {
        evidence.push({
          source: source.publisher,
          url: source.url,
          excerpt: source.claimReview,
          supports: source.rating === 'TRUE' || source.rating === 'MOSTLY_TRUE',
          credibilityScore: source.credibility,
          publishedDate: source.publishedDate
        });
      });

      // Add news articles as evidence
      realFactCheckResult.newsArticles.forEach(article => {
        evidence.push({
          source: article.source,
          url: article.url,
          excerpt: article.description,
          supports: true, // Neutral - just informative
          credibilityScore: 75, // Average credibility for news
          publishedDate: article.publishedAt
        });
      });

      // Determine harm level
      let harmLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'SEVERE' = 'NONE';
      if (realFactCheckResult.verdict === 'FALSE') {
        const category = requestData.category || 'general';
        if (category === 'health') harmLevel = 'SEVERE';
        else if (category === 'financial' || category === 'political') harmLevel = 'MEDIUM';
        else harmLevel = 'LOW';
      }

      // Return response matching frontend structure
      res.status(200).json({
        success: true,
        data: {
          veracity: realFactCheckResult.verdict,
          confidence: realFactCheckResult.confidence / 100, // Convert to 0-1 range
          explanation: realFactCheckResult.aiAnalysis || realFactCheckResult.summary,
          harmAssessment: {
            level: harmLevel,
            description: harmLevel === 'SEVERE'
              ? 'This misinformation could cause serious harm if believed or acted upon.'
              : harmLevel === 'MEDIUM'
              ? 'This misinformation could lead to poor decisions or financial loss.'
              : harmLevel === 'LOW'
              ? 'This misinformation has limited potential for direct harm.'
              : 'No significant harm detected.'
          },
          evidence,
          expertConsensus: realFactCheckResult.sources.length > 0
            ? `${realFactCheckResult.sources.length} fact-checking organizations have reviewed this claim.`
            : 'No expert fact-checking reviews found. Analysis based on news coverage and AI assessment.',
          recommendations: [realFactCheckResult.recommendation],
          category: requestData.category || 'general',

          // Additional metadata
          analysisMetadata: {
            analyzedAt: new Date().toISOString(),
            latency,
            estimatedCost,
            claimLength: requestData.claim.length,
            factCheckSourcesCount: realFactCheckResult.sources.length,
            newsArticlesCount: realFactCheckResult.newsArticles.length,
            usedRealAPIs: true
          }
        }
      });

    } catch (error) {
      logger.error('Fact checking error:', error);

      res.status(500).json({
        success: false,
        error: 'Fact checking failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Extract claims from article
   * POST /api/v2/analyze/fact/extract-claims
   */
  async extractClaims(req: Request, res: Response): Promise<void> {
    try {
      const { articleUrl, articleText } = req.body;

      if (!articleUrl && !articleText) {
        res.status(400).json({
          success: false,
          error: 'Either articleUrl or articleText is required'
        });
        return;
      }

      logger.info(`Claim extraction requested: ${articleUrl || 'text input'}`);

      let textToAnalyze = articleText;

      // If URL provided, fetch article content (would need web scraping)
      if (articleUrl && !articleText) {
        // For now, return error - would need web scraping implementation
        res.status(501).json({
          success: false,
          error: 'Article URL fetching not yet implemented. Please provide articleText instead.'
        });
        return;
      }

      // Extract claims using fact checker service (would need implementation in service)
      const claims = this.extractClaimsFromText(textToAnalyze);

      res.status(200).json({
        success: true,
        data: {
          claims,
          totalClaims: claims.length,
          articleLength: textToAnalyze.length
        }
      });

    } catch (error) {
      logger.error('Claim extraction error:', error);

      res.status(500).json({
        success: false,
        error: 'Claim extraction failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get fact-checking statistics for user
   * GET /api/v2/analyze/fact/stats
   */
  async getFactCheckStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };

      // This would query database for user's fact-checking history
      // For now, return mock structure
      const stats = {
        totalFactChecks: 0,
        trueCount: 0,
        falseCount: 0,
        misleadingCount: 0,
        unverifiedCount: 0,
        mostCheckedCategory: 'general',
        averageConfidence: 0
      };

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Get fact check stats error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
  }

  /**
   * Get supported categories
   * GET /api/v2/analyze/fact/categories
   */
  async getSupportedCategories(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          categories: [
            { id: 'health', name: 'Health & Medicine', icon: '🏥', color: '#4CAF50' },
            { id: 'political', name: 'Political', icon: '🏛️', color: '#2196F3' },
            { id: 'financial', name: 'Financial', icon: '💰', color: '#FF9800' },
            { id: 'scientific', name: 'Scientific', icon: '🔬', color: '#9C27B0' },
            { id: 'general', name: 'General', icon: '📰', color: '#607D8B' }
          ]
        }
      });
    } catch (error) {
      logger.error('Get categories error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
  }

  /**
   * Helper: Extract claims from text (basic implementation)
   */
  private extractClaimsFromText(text: string): Array<{ claim: string; category: string }> {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const claims: Array<{ claim: string; category: string }> = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();

      // Skip short sentences
      if (trimmed.length < 20) continue;

      // Identify factual claims (sentences with numbers, specific assertions)
      const hasNumbers = /\d+/.test(trimmed);
      const hasFactualIndicators = /(study shows|research indicates|according to|reports that|found that)/i.test(trimmed);

      if (hasNumbers || hasFactualIndicators) {
        // Categorize claim
        let category = 'general';
        if (/(virus|vaccine|health|medical|disease|cure)/i.test(trimmed)) {
          category = 'health';
        } else if (/(election|government|president|congress|vote)/i.test(trimmed)) {
          category = 'political';
        } else if (/(stock|investment|economy|financial|market)/i.test(trimmed)) {
          category = 'financial';
        } else if (/(study|research|science|climate|experiment)/i.test(trimmed)) {
          category = 'scientific';
        }

        claims.push({
          claim: trimmed,
          category
        });
      }
    }

    return claims.slice(0, 10); // Limit to 10 claims
  }

  /**
   * Helper: Estimate API cost based on text length
   */
  private estimateApiCost(textLength: number): number {
    // Google AI API: ~$0.002 per 1K characters for analysis
    // Fact checking typically requires multiple API calls (claim extraction, evidence gathering)
    const charactersInK = textLength / 1000;
    const apiCallsEstimate = 3; // Estimate 3 API calls per fact check
    const costPerCall = 0.002;

    return charactersInK * apiCallsEstimate * costPerCall;
  }
}

export const factController = new FactController();
