import axios from 'axios';
import { logger } from '../../config/logger.js';
import { aiService } from '../ai/ai.service.js';

/**
 * Real Fact Checker Service
 * Uses Google Fact Check API, News API, and AI to verify claims
 */

export interface FactCheckSource {
  title: string;
  url: string;
  publisher: string;
  publishedDate: string;
  claim: string;
  claimReview: string;
  rating: string;
  credibility: number;
}

export interface RealFactCheckResult {
  claim: string;
  verdict: 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED' | 'PARTIALLY_TRUE';
  confidence: number;
  summary: string;
  sources: FactCheckSource[];
  aiAnalysis: string;
  newsArticles: Array<{
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    description: string;
  }>;
  recommendation: string;
}

export class RealFactCheckerService {
  private readonly GOOGLE_FACT_CHECK_API_KEY = process.env.GOOGLE_FACT_CHECK_API_KEY || '';
  private readonly NEWS_API_KEY = process.env.NEWS_API_KEY || '';

  /**
   * Check fact using Google Fact Check Tools API
   */
  async checkFactWithGoogle(query: string): Promise<FactCheckSource[]> {
    if (!this.GOOGLE_FACT_CHECK_API_KEY) {
      logger.warn('[Fact Check] No Google Fact Check API key configured');
      return [];
    }

    try {
      const url = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
      const response = await axios.get(url, {
        params: {
          query,
          key: this.GOOGLE_FACT_CHECK_API_KEY,
          languageCode: 'en'
        },
        timeout: 10000
      });

      const claims = response.data.claims || [];
      const sources: FactCheckSource[] = [];

      for (const claim of claims) {
        const claimReview = claim.claimReview?.[0];
        if (!claimReview) continue;

        sources.push({
          title: claim.text || query,
          url: claimReview.url || '',
          publisher: claimReview.publisher?.name || 'Unknown',
          publishedDate: claimReview.reviewDate || '',
          claim: claim.text || query,
          claimReview: claimReview.textualRating || '',
          rating: this.normalizeRating(claimReview.textualRating || ''),
          credibility: this.calculatePublisherCredibility(claimReview.publisher?.name || '')
        });
      }

      logger.info(`[Fact Check] Found ${sources.length} fact check sources from Google`);
      return sources;
    } catch (error) {
      logger.error('[Fact Check] Google Fact Check API error:', error);
      return [];
    }
  }

  /**
   * Search news articles related to claim
   */
  async searchNewsArticles(query: string): Promise<RealFactCheckResult['newsArticles']> {
    if (!this.NEWS_API_KEY) {
      logger.warn('[Fact Check] No News API key configured');
      return [];
    }

    try {
      const url = 'https://newsapi.org/v2/everything';
      const response = await axios.get(url, {
        params: {
          q: query,
          apiKey: this.NEWS_API_KEY,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: 10
        },
        timeout: 10000
      });

      const articles = response.data.articles || [];
      const newsArticles = articles.map((article: any) => ({
        title: article.title || '',
        url: article.url || '',
        source: article.source?.name || 'Unknown',
        publishedAt: article.publishedAt || '',
        description: article.description || ''
      }));

      logger.info(`[Fact Check] Found ${newsArticles.length} news articles`);
      return newsArticles;
    } catch (error) {
      logger.error('[Fact Check] News API error:', error);
      return [];
    }
  }

  /**
   * Use AI to analyze claim with web search
   */
  async analyzeClaimWithAI(claim: string, sources: FactCheckSource[], newsArticles: any[]): Promise<{
    verdict: RealFactCheckResult['verdict'];
    confidence: number;
    summary: string;
    analysis: string;
    recommendation: string;
  }> {
    try {
      // Build comprehensive prompt with all evidence
      const sourcesText = sources.map((s, i) =>
        `${i + 1}. ${s.publisher} (${s.publishedDate})\n   Claim: "${s.claim}"\n   Rating: ${s.rating}\n   Review: ${s.claimReview}\n   URL: ${s.url}`
      ).join('\n\n');

      const newsText = newsArticles.slice(0, 5).map((article, i) =>
        `${i + 1}. ${article.title} - ${article.source} (${article.publishedAt.substring(0, 10)})\n   ${article.description}\n   URL: ${article.url}`
      ).join('\n\n');

      const prompt = `You are a professional fact checker analyzing the following claim:

CLAIM: "${claim}"

═══════════════════════════════════════════════════════
FACT CHECK SOURCES FROM AUTHORITATIVE DATABASES:
═══════════════════════════════════════════════════════
${sourcesText || 'No fact check sources found in databases.'}

═══════════════════════════════════════════════════════
RECENT NEWS ARTICLES ABOUT THIS TOPIC:
═══════════════════════════════════════════════════════
${newsText || 'No recent news articles found.'}

═══════════════════════════════════════════════════════
YOUR TASK:
═══════════════════════════════════════════════════════
Analyze all the evidence above and provide your verdict in EXACTLY this format:

**VERDICT:** [TRUE | FALSE | MISLEADING | PARTIALLY_TRUE | UNVERIFIED]

**CONFIDENCE:** [Number from 0-100]%

**SUMMARY:** [2-3 sentence summary of what the evidence shows]

**DETAILED ANALYSIS:**
[Comprehensive analysis covering:
1. What fact checkers found
2. What news sources report
3. Contradictions or confirmations
4. Context and nuance
5. Why you reached this verdict]

**RECOMMENDATION:**
[Specific advice about whether to believe/share this claim]

**SOURCES CITED:**
[List the most credible sources you relied on]

CRITICAL RULES:
- Base verdict ONLY on evidence provided
- If no solid evidence exists, verdict must be UNVERIFIED
- Cite specific sources and their findings
- Explain reasoning clearly
- Be accurate, not sensational`;

      const aiResponse = await aiService.query({
        query: prompt,
        model: 'claude',
        useRAG: false
      });

      const text = aiResponse.response;

      // Parse AI response
      const verdictMatch = text.match(/\*\*VERDICT:\*\*\s*\[?(TRUE|FALSE|MISLEADING|PARTIALLY_TRUE|UNVERIFIED)\]?/i);
      const confidenceMatch = text.match(/\*\*CONFIDENCE:\*\*\s*\[?(\d+)\]?%?/i);
      const summaryMatch = text.match(/\*\*SUMMARY:\*\*\s*\[?([\s\S]*?)\]?(?=\n\*\*DETAILED ANALYSIS|$)/i);
      const analysisMatch = text.match(/\*\*DETAILED ANALYSIS:\*\*\s*\[?([\s\S]*?)\]?(?=\n\*\*RECOMMENDATION|$)/i);
      const recommendationMatch = text.match(/\*\*RECOMMENDATION:\*\*\s*\[?([\s\S]*?)\]?(?=\n\*\*SOURCES|$)/i);

      let verdict: RealFactCheckResult['verdict'] = 'UNVERIFIED';
      if (verdictMatch) {
        const v = verdictMatch[1].toUpperCase();
        if (['TRUE', 'FALSE', 'MISLEADING', 'PARTIALLY_TRUE', 'UNVERIFIED'].includes(v)) {
          verdict = v as RealFactCheckResult['verdict'];
        }
      }

      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 50;
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Unable to generate summary';
      const analysis = analysisMatch ? analysisMatch[1].trim() : text;
      const recommendation = recommendationMatch ? recommendationMatch[1].trim() : 'Verify with authoritative sources';

      return { verdict, confidence, summary, analysis, recommendation };
    } catch (error) {
      logger.error('[Fact Check] AI analysis error:', error);

      // Fallback verdict based on source ratings
      if (sources.length > 0) {
        const falseCount = sources.filter(s => s.rating === 'FALSE').length;
        const trueCount = sources.filter(s => s.rating === 'TRUE').length;

        if (falseCount >= 2) {
          return {
            verdict: 'FALSE',
            confidence: 75,
            summary: `${falseCount} fact checkers have rated this claim as false.`,
            analysis: `Multiple fact checking organizations have debunked this claim: ${sources.map(s => s.publisher).join(', ')}`,
            recommendation: 'This claim has been debunked by multiple authoritative sources. Do not share.'
          };
        } else if (trueCount >= 2) {
          return {
            verdict: 'TRUE',
            confidence: 75,
            summary: `${trueCount} fact checkers have verified this claim.`,
            analysis: `Multiple fact checking organizations have verified this claim: ${sources.map(s => s.publisher).join(', ')}`,
            recommendation: 'This claim is supported by authoritative fact checkers.'
          };
        }
      }

      return {
        verdict: 'UNVERIFIED',
        confidence: 30,
        summary: 'Unable to find sufficient evidence to verify this claim.',
        analysis: 'No reliable fact check sources or news coverage found for this specific claim.',
        recommendation: 'Treat this claim with skepticism until verified by authoritative sources.'
      };
    }
  }

  /**
   * Main fact check function
   */
  async checkFact(claim: string): Promise<RealFactCheckResult> {
    try {
      logger.info(`[Real Fact Checker] Checking claim: ${claim.substring(0, 100)}...`);

      // 1. Search Google Fact Check API
      const factCheckSources = await this.checkFactWithGoogle(claim);

      // 2. Search news articles
      const newsArticles = await this.searchNewsArticles(claim);

      // 3. Use AI to synthesize all evidence
      const aiResult = await this.analyzeClaimWithAI(claim, factCheckSources, newsArticles);

      const result: RealFactCheckResult = {
        claim,
        verdict: aiResult.verdict,
        confidence: aiResult.confidence,
        summary: aiResult.summary,
        sources: factCheckSources,
        aiAnalysis: aiResult.analysis,
        newsArticles,
        recommendation: aiResult.recommendation
      };

      logger.info(`[Real Fact Checker] Result: ${result.verdict} (confidence: ${result.confidence}%)`);
      return result;

    } catch (error) {
      logger.error('[Real Fact Checker] Error:', error);
      throw new Error(`Fact check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize rating from various fact checkers
   */
  private normalizeRating(rating: string): string {
    const ratingLower = rating.toLowerCase();

    if (ratingLower.includes('false') || ratingLower.includes('pants on fire')) return 'FALSE';
    if (ratingLower.includes('mostly false')) return 'MOSTLY_FALSE';
    if (ratingLower.includes('mostly true') || ratingLower.includes('mostly correct')) return 'MOSTLY_TRUE';
    if (ratingLower.includes('true') || ratingLower.includes('correct')) return 'TRUE';
    if (ratingLower.includes('misleading') || ratingLower.includes('lacks context')) return 'MISLEADING';
    if (ratingLower.includes('unverified') || ratingLower.includes('unproven')) return 'UNVERIFIED';
    if (ratingLower.includes('mixture') || ratingLower.includes('mixed')) return 'PARTIALLY_TRUE';

    return rating;
  }

  /**
   * Calculate publisher credibility
   */
  private calculatePublisherCredibility(publisher: string): number {
    const highCredibility = ['snopes', 'politifact', 'factcheck.org', 'ap fact check', 'reuters fact check', 'afp fact check'];
    const mediumCredibility = ['fullfact', 'leadstories', 'truthorfiction'];

    const publisherLower = publisher.toLowerCase();

    if (highCredibility.some(p => publisherLower.includes(p))) return 95;
    if (mediumCredibility.some(p => publisherLower.includes(p))) return 85;

    return 70; // Default credibility
  }
}

export const realFactCheckerService = new RealFactCheckerService();
