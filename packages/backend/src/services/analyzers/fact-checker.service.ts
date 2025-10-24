import axios from 'axios';
import { logger } from '../../config/logger.js';

/**
 * Fact Checker Service
 * Verifies factual claims using authoritative sources
 */

export enum Veracity {
  TRUE = "true",
  FALSE = "false",
  MISLEADING = "misleading",
  UNVERIFIED = "unverified",
  OUTDATED = "outdated"
}

export enum HarmLevel {
  NONE = "none",
  LOW = "low",
  MEDIUM = "medium",
  SEVERE = "severe"
}

export enum ClaimCategory {
  HEALTH = "health",
  POLITICAL = "political",
  FINANCIAL = "financial",
  SCIENTIFIC = "scientific",
  GENERAL = "general"
}

export interface SourceCredibility {
  domainAuthority: number; // 0-100
  domainAge: number; // days
  priorMisinformation: boolean;
  authorCredentials: string;
  publicationHistory: string[];
}

export interface Evidence {
  organization: string;
  url: string;
  quote: string;
  supports: boolean; // true if supports claim, false if opposes
  credibilityScore: number;
  publicationDate?: Date;
}

export interface HarmAssessment {
  potentialHarm: HarmLevel;
  category: ClaimCategory;
  reasoning: string;
}

export interface FactCheckResult {
  claim: string;
  veracity: Veracity;
  confidence: number;
  harmLevel: HarmLevel;
  category: ClaimCategory;
  evidenceSummary: {
    supportingSources: number;
    opposingSources: number;
    authoritativeSources: string[];
    totalSources: number;
  };
  expertConsensus: "accepted" | "rejected" | "debated" | "unknown";
  sources: Evidence[];
  harmAssessment: HarmAssessment;
  recommendation: string;
  relatedClaims?: string[];
}

export class FactCheckerService {
  // Authoritative source lists by category
  private readonly authoritativeSources = {
    health: [
      { domain: 'who.int', name: 'WHO', credibility: 98 },
      { domain: 'cdc.gov', name: 'CDC', credibility: 98 },
      { domain: 'fda.gov', name: 'FDA', credibility: 97 },
      { domain: 'mayoclinic.org', name: 'Mayo Clinic', credibility: 95 },
      { domain: 'nih.gov', name: 'NIH', credibility: 97 },
      { domain: 'healthline.com', name: 'Healthline', credibility: 85 }
    ],
    political: [
      { domain: 'reuters.com', name: 'Reuters', credibility: 95 },
      { domain: 'apnews.com', name: 'AP News', credibility: 95 },
      { domain: 'bbc.com', name: 'BBC', credibility: 93 },
      { domain: 'factcheck.org', name: 'FactCheck.org', credibility: 92 },
      { domain: 'politifact.com', name: 'PolitiFact', credibility: 90 }
    ],
    financial: [
      { domain: 'sec.gov', name: 'SEC', credibility: 98 },
      { domain: 'bloomberg.com', name: 'Bloomberg', credibility: 92 },
      { domain: 'wsj.com', name: 'Wall Street Journal', credibility: 93 },
      { domain: 'ft.com', name: 'Financial Times', credibility: 92 },
      { domain: 'forbes.com', name: 'Forbes', credibility: 85 }
    ],
    scientific: [
      { domain: 'nature.com', name: 'Nature', credibility: 98 },
      { domain: 'science.org', name: 'Science', credibility: 98 },
      { domain: 'scientificamerican.com', name: 'Scientific American', credibility: 90 },
      { domain: 'pnas.org', name: 'PNAS', credibility: 95 }
    ]
  };

  // Known dangerous misinformation patterns
  private readonly dangerousPatterns = [
    {
      pattern: /bleach|chlorine dioxide.*cures?.*covid/i,
      harm: HarmLevel.SEVERE,
      category: ClaimCategory.HEALTH
    },
    {
      pattern: /vaccines?.*autism/i,
      harm: HarmLevel.SEVERE,
      category: ClaimCategory.HEALTH
    },
    {
      pattern: /5g.*coronavirus|5g.*covid/i,
      harm: HarmLevel.MEDIUM,
      category: ClaimCategory.HEALTH
    },
    {
      pattern: /election.*stolen|voter fraud.*widespread/i,
      harm: HarmLevel.MEDIUM,
      category: ClaimCategory.POLITICAL
    }
  ];

  /**
   * Detect claim category from content
   */
  private detectCategory(claim: string): ClaimCategory {
    const claimLower = claim.toLowerCase();

    const healthKeywords = ['vaccine', 'cure', 'disease', 'medical', 'health', 'covid', 'virus', 'treatment'];
    const politicalKeywords = ['election', 'president', 'vote', 'government', 'policy', 'law'];
    const financialKeywords = ['stock', 'investment', 'crypto', 'market', 'economy', 'profit'];
    const scientificKeywords = ['study', 'research', 'scientist', 'climate', 'experiment'];

    if (healthKeywords.some(kw => claimLower.includes(kw))) return ClaimCategory.HEALTH;
    if (politicalKeywords.some(kw => claimLower.includes(kw))) return ClaimCategory.POLITICAL;
    if (financialKeywords.some(kw => claimLower.includes(kw))) return ClaimCategory.FINANCIAL;
    if (scientificKeywords.some(kw => claimLower.includes(kw))) return ClaimCategory.SCIENTIFIC;

    return ClaimCategory.GENERAL;
  }

  /**
   * Calculate source credibility score
   */
  calculateCredibilityScore(source: SourceCredibility): number {
    let score = 0;

    // Domain authority (40% weight)
    score += source.domainAuthority * 0.4;

    // Domain age bonus (20 points max)
    if (source.domainAge > 365 * 5) { // 5+ years
      score += 20;
    } else if (source.domainAge > 365) { // 1+ year
      score += 10;
    } else if (source.domainAge > 30) { // 1+ month
      score += 5;
    }

    // Prior misinformation penalty (-40 points)
    if (source.priorMisinformation) {
      score -= 40;
    }

    // Author credentials bonus (10 points each, max 20)
    const credentials = source.authorCredentials.toLowerCase();
    if (credentials.includes('phd')) score += 10;
    if (credentials.includes('md') || credentials.includes('doctor')) score += 10;

    // Publication history bonus (up to 10 points)
    if (source.publicationHistory.length > 100) score += 10;
    else if (source.publicationHistory.length > 50) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Search for evidence from authoritative sources
   * In production, this would use real search APIs
   */
  private async searchEvidence(
    claim: string,
    category: ClaimCategory
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Get authoritative sources for this category
    const sources = this.authoritativeSources[category] || [];

    // In production, use Google Custom Search API or similar
    // For now, return mock evidence based on known patterns
    for (const dangerousPattern of this.dangerousPatterns) {
      if (dangerousPattern.pattern.test(claim)) {
        // This is known misinformation - add opposing evidence
        evidence.push({
          organization: 'WHO',
          url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters',
          quote: 'Drinking or injecting bleach or disinfectant is extremely dangerous and can be fatal.',
          supports: false,
          credibilityScore: 98,
          publicationDate: new Date('2020-04-01')
        });

        evidence.push({
          organization: 'CDC',
          url: 'https://www.cdc.gov/coronavirus/2019-ncov/prevent-getting-sick/prevention.html',
          quote: 'Never ingest disinfectants or cleaning products. They are toxic and can cause serious harm or death.',
          supports: false,
          credibilityScore: 98
        });

        evidence.push({
          organization: 'FDA',
          url: 'https://www.fda.gov/consumers/consumer-updates/danger-dont-drink-miracle-mineral-solution-or-similar-products',
          quote: 'The FDA warns that drinking these products is the same as drinking bleach and can cause serious harm.',
          supports: false,
          credibilityScore: 97
        });
      }
    }

    return evidence;
  }

  /**
   * Determine veracity based on evidence
   */
  private determineVeracity(evidence: Evidence[]): { veracity: Veracity; confidence: number } {
    if (evidence.length === 0) {
      return { veracity: Veracity.UNVERIFIED, confidence: 0.5 };
    }

    const supporting = evidence.filter(e => e.supports);
    const opposing = evidence.filter(e => !e.supports);

    const supportRatio = supporting.length / evidence.length;
    const avgCredibility = evidence.reduce((sum, e) => sum + e.credibilityScore, 0) / evidence.length;

    // All sources oppose (with high credibility)
    if (opposing.length >= 3 && supporting.length === 0 && avgCredibility > 90) {
      return { veracity: Veracity.FALSE, confidence: 0.95 };
    }

    // All sources support (with high credibility)
    if (supporting.length >= 3 && opposing.length === 0 && avgCredibility > 90) {
      return { veracity: Veracity.TRUE, confidence: 0.95 };
    }

    // Mixed but more oppose
    if (supportRatio < 0.3 && opposing.length >= 2) {
      return { veracity: Veracity.FALSE, confidence: 0.80 };
    }

    // Mixed but more support
    if (supportRatio > 0.7 && supporting.length >= 2) {
      return { veracity: Veracity.TRUE, confidence: 0.80 };
    }

    // Contradictory evidence
    if (supportRatio > 0.3 && supportRatio < 0.7) {
      return { veracity: Veracity.MISLEADING, confidence: 0.70 };
    }

    // Check if evidence is old (outdated claim)
    const hasOldEvidence = evidence.some(e => {
      if (!e.publicationDate) return false;
      const daysSince = (Date.now() - e.publicationDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 365 * 2; // 2+ years old
    });

    if (hasOldEvidence && supporting.length > 0) {
      return { veracity: Veracity.OUTDATED, confidence: 0.75 };
    }

    return { veracity: Veracity.UNVERIFIED, confidence: 0.60 };
  }

  /**
   * Assess potential harm of misinformation
   */
  private assessHarm(claim: string, category: ClaimCategory, veracity: Veracity): HarmAssessment {
    // Check against known dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.pattern.test(claim)) {
        return {
          potentialHarm: pattern.harm,
          category: pattern.category,
          reasoning: veracity === Veracity.FALSE
            ? 'This is dangerous misinformation that could cause serious harm if believed or acted upon.'
            : 'This claim relates to a topic with potential for serious harm.'
        };
      }
    }

    // Category-based harm assessment
    if (category === ClaimCategory.HEALTH && veracity === Veracity.FALSE) {
      return {
        potentialHarm: HarmLevel.SEVERE,
        category,
        reasoning: 'False health information can lead to delayed treatment, incorrect self-medication, or dangerous behaviors.'
      };
    }

    if (category === ClaimCategory.FINANCIAL && veracity === Veracity.FALSE) {
      return {
        potentialHarm: HarmLevel.MEDIUM,
        category,
        reasoning: 'False financial information can lead to poor investment decisions and monetary losses.'
      };
    }

    if (category === ClaimCategory.POLITICAL && veracity === Veracity.FALSE) {
      return {
        potentialHarm: HarmLevel.MEDIUM,
        category,
        reasoning: 'False political information can undermine democratic processes and public trust.'
      };
    }

    return {
      potentialHarm: HarmLevel.LOW,
      category,
      reasoning: 'This claim has limited potential for direct harm but should still be verified.'
    };
  }

  /**
   * Determine expert consensus
   */
  private determineExpertConsensus(evidence: Evidence[]): FactCheckResult['expertConsensus'] {
    if (evidence.length === 0) return 'unknown';

    const supporting = evidence.filter(e => e.supports);
    const opposing = evidence.filter(e => !e.supports);

    if (supporting.length >= 3 && opposing.length === 0) return 'accepted';
    if (opposing.length >= 3 && supporting.length === 0) return 'rejected';
    if (supporting.length > 0 && opposing.length > 0) return 'debated';

    return 'unknown';
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    veracity: Veracity,
    harmLevel: HarmLevel,
    confidence: number
  ): string {
    if (harmLevel === HarmLevel.SEVERE && veracity === Veracity.FALSE) {
      return 'DANGER: This is extremely dangerous misinformation. Do not follow this advice. Consult qualified professionals instead.';
    }

    if (veracity === Veracity.FALSE && confidence > 0.9) {
      return 'This claim has been thoroughly debunked by authoritative sources. Do not share or act on this information.';
    }

    if (veracity === Veracity.FALSE && confidence > 0.7) {
      return 'Strong evidence suggests this claim is false. Verify with authoritative sources before believing or sharing.';
    }

    if (veracity === Veracity.MISLEADING) {
      return 'This claim contains misleading information or lacks important context. Seek additional authoritative sources.';
    }

    if (veracity === Veracity.OUTDATED) {
      return 'This claim may have been true in the past but is now outdated. Check for current information from authoritative sources.';
    }

    if (veracity === Veracity.TRUE && confidence > 0.9) {
      return 'This claim is supported by strong evidence from authoritative sources.';
    }

    if (veracity === Veracity.UNVERIFIED) {
      return 'This claim cannot be verified with available evidence. Treat with skepticism until confirmed by authoritative sources.';
    }

    return 'Exercise caution and verify this claim with multiple authoritative sources before accepting it as fact.';
  }

  /**
   * Check fact claim
   * Main entry point for fact checking
   */
  async checkFact(claim: string): Promise<FactCheckResult> {
    try {
      logger.info(`Starting fact check for claim: ${claim.substring(0, 100)}...`);

      // Detect category
      const category = this.detectCategory(claim);
      logger.info(`Claim category detected: ${category}`);

      // Search for evidence
      const evidence = await this.searchEvidence(claim, category);
      logger.info(`Found ${evidence.length} pieces of evidence`);

      // Determine veracity
      const { veracity, confidence } = this.determineVeracity(evidence);
      logger.info(`Veracity determined: ${veracity} (confidence: ${confidence})`);

      // Assess harm
      const harmAssessment = this.assessHarm(claim, category, veracity);

      // Determine expert consensus
      const expertConsensus = this.determineExpertConsensus(evidence);

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        veracity,
        harmAssessment.potentialHarm,
        confidence
      );

      // Build evidence summary
      const supporting = evidence.filter(e => e.supports);
      const opposing = evidence.filter(e => !e.supports);
      const authoritativeSources = [
        ...new Set(evidence.map(e => e.organization))
      ];

      const result: FactCheckResult = {
        claim,
        veracity,
        confidence,
        harmLevel: harmAssessment.potentialHarm,
        category,
        evidenceSummary: {
          supportingSources: supporting.length,
          opposingSources: opposing.length,
          authoritativeSources,
          totalSources: evidence.length
        },
        expertConsensus,
        sources: evidence,
        harmAssessment,
        recommendation
      };

      logger.info(`Fact check complete: ${veracity} (harm level: ${harmAssessment.potentialHarm})`);
      return result;

    } catch (error) {
      logger.error('Fact check error:', error);
      throw error;
    }
  }
}

export const factCheckerService = new FactCheckerService();
