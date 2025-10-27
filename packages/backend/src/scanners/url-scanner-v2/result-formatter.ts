/**
 * V2 Scanner Result Formatter
 *
 * Formats scan results to be user-friendly for non-tech users
 * while providing detailed technical information for analysts.
 */

import type { V2ScanResult, GranularCheckResult } from './types';

export interface FormattedV2Result {
  // Simple verdict for non-tech users
  userFriendly: {
    verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'CRITICAL';
    confidenceLevel: 'Very High' | 'High' | 'Medium' | 'Low';
    shortSummary: string;
    riskFactors: string[];
    recommendation: string;
    trustScore: number; // 0-100
  };

  // Detailed breakdown for all users
  analysis: {
    websiteDescription: string;
    screenshot?: string; // Base64 or URL
    categories: {
      security: CheckCategory;
      legitimacy: CheckCategory;
      reputation: CheckCategory;
      technical: CheckCategory;
    };
    threatIntelligence: {
      found: boolean;
      sources: Array<{
        name: string;
        severity: string;
        reason: string;
        lastSeen: Date;
      }>;
      totalHits: number;
    };
  };

  // Technical details for analysts
  technical: {
    allChecks: GranularCheckResult[];
    scoreBreakdown: {
      stage1: { points: number; maxPoints: number; details: any };
      stage2: { points: number; maxPoints: number; details: any };
      tiLayer: { points: number; maxPoints: number; details: any };
      finalScore: { points: number; maxPoints: number };
    };
    mlPredictions: {
      lexicalA: { probability: number; confidence: number };
      lexicalB: { probability: number; confidence: number };
      tabularRisk: { probability: number; confidence: number };
      combined: { probability: number; confidence: number };
    };
    performanceMetrics: {
      totalDuration: number;
      stageLatencies: Record<string, number>;
    };
    rawData: any;
  };
}

export interface CheckCategory {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  score: number;
  maxScore: number;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
    points: number;
    maxPoints: number;
    description: string;
    technicalDetails?: any;
  }>;
}

/**
 * Format V2 scan result for user consumption
 */
export function formatV2Result(scanResult: V2ScanResult): FormattedV2Result {
  return {
    userFriendly: buildUserFriendlySection(scanResult),
    analysis: buildAnalysisSection(scanResult),
    technical: buildTechnicalSection(scanResult)
  };
}

function buildUserFriendlySection(result: V2ScanResult): FormattedV2Result['userFriendly'] {
  // Determine simple verdict
  let verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'CRITICAL';
  if (result.riskLevel === 'A' || result.riskLevel === 'B') {
    verdict = 'SAFE';
  } else if (result.riskLevel === 'C') {
    verdict = 'SUSPICIOUS';
  } else if (result.riskLevel === 'D' || result.riskLevel === 'E') {
    verdict = 'DANGEROUS';
  } else {
    verdict = 'CRITICAL';
  }

  // Confidence level
  const confidence = result.confidenceInterval.width;
  let confidenceLevel: 'Very High' | 'High' | 'Medium' | 'Low';
  if (confidence < 0.2) confidenceLevel = 'Very High';
  else if (confidence < 0.4) confidenceLevel = 'High';
  else if (confidence < 0.6) confidenceLevel = 'Medium';
  else confidenceLevel = 'Low';

  // Extract risk factors
  const riskFactors: string[] = [];
  if (result.tiData && result.tiData.totalHits > 0) {
    riskFactors.push(`Found in ${result.tiData.totalHits} threat database${result.tiData.totalHits > 1 ? 's' : ''}`);
  }
  if (result.features.tabular.domainAge < 30) {
    riskFactors.push('Very new domain (less than 30 days old)');
  }
  if (result.features.tabular.tldRiskScore > 7) {
    riskFactors.push('High-risk top-level domain');
  }
  if (result.reachability.status === 'OFFLINE') {
    riskFactors.push('Website is currently offline or unreachable');
  }
  if (result.features.causal.formOriginMismatch) {
    riskFactors.push('Suspicious form submission behavior detected');
  }

  // Trust score (inverse of risk)
  const trustScore = Math.round((1 - result.probability) * 100);

  // Short summary
  const shortSummary = generateShortSummary(result, verdict);

  // Recommendation
  const recommendation = generateRecommendation(verdict, riskFactors);

  return {
    verdict,
    confidenceLevel,
    shortSummary,
    riskFactors,
    recommendation,
    trustScore
  };
}

function buildAnalysisSection(result: V2ScanResult): FormattedV2Result['analysis'] {
  return {
    websiteDescription: result.aiSummary?.explanation || 'Analysis in progress...',
    screenshot: result.evidence?.screenshot?.imageUrl,
    categories: buildCategorizedChecks(result),
    threatIntelligence: buildTISection(result)
  };
}

function buildTechnicalSection(result: V2ScanResult): FormattedV2Result['technical'] {
  return {
    allChecks: result.granularChecks || [],
    scoreBreakdown: buildScoreBreakdown(result),
    mlPredictions: {
      lexicalA: result.stage1Results?.urlLexicalA || { probability: 0, confidence: 0 },
      lexicalB: result.stage1Results?.urlLexicalB || { probability: 0, confidence: 0 },
      tabularRisk: result.stage1Results?.tabularRisk || { probability: 0, confidence: 0, featureImportance: {} },
      combined: result.stage1Results?.combined || { probability: 0, confidence: 0 }
    },
    performanceMetrics: {
      totalDuration: result.latency?.total || 0,
      stageLatencies: result.latency || {}
    },
    rawData: result
  };
}

function buildCategorizedChecks(result: V2ScanResult): FormattedV2Result['analysis']['categories'] {
  // Organize checks into categories
  const checks = result.granularChecks || [];

  return {
    security: {
      name: 'Security & Safety',
      status: 'PASS',
      score: 0,
      maxScore: 100,
      checks: checks.filter(c => c.category === 'security')
    },
    legitimacy: {
      name: 'Website Legitimacy',
      status: 'PASS',
      score: 0,
      maxScore: 100,
      checks: checks.filter(c => c.category === 'legitimacy')
    },
    reputation: {
      name: 'Reputation & Trust',
      status: 'PASS',
      score: 0,
      maxScore: 100,
      checks: checks.filter(c => c.category === 'reputation')
    },
    technical: {
      name: 'Technical Infrastructure',
      status: 'PASS',
      score: 0,
      maxScore: 100,
      checks: checks.filter(c => c.category === 'technical')
    }
  };
}

function buildTISection(result: V2ScanResult): FormattedV2Result['analysis']['threatIntelligence'] {
  if (!result.tiData || result.tiData.totalHits === 0) {
    return {
      found: false,
      sources: [],
      totalHits: 0
    };
  }

  return {
    found: true,
    sources: result.tiData.tier1Sources.map(s => ({
      name: s.source,
      severity: s.severity,
      reason: getTIReason(s.source, result.url),
      lastSeen: s.lastSeen
    })),
    totalHits: result.tiData.totalHits
  };
}

function buildScoreBreakdown(result: V2ScanResult) {
  // Calculate points from each stage
  const stage1Points = Math.round(result.stage1Results?.combined.probability * 535) || 0;
  const tiPoints = result.tiData ? Math.min(result.tiData.totalHits * 15, 55) : 0;

  return {
    stage1: {
      points: stage1Points,
      maxPoints: 535,
      details: result.stage1Results
    },
    stage2: {
      points: result.stage2Results ? Math.round(result.stage2Results.combined.probability * 100) : 0,
      maxPoints: 100,
      details: result.stage2Results
    },
    tiLayer: {
      points: tiPoints,
      maxPoints: 55,
      details: result.tiData
    },
    finalScore: {
      points: Math.round(result.probability * 590),
      maxPoints: 590
    }
  };
}

function generateShortSummary(result: V2ScanResult, verdict: string): string {
  if (verdict === 'SAFE') {
    return `This website appears to be legitimate and safe to visit. Our analysis found no significant security concerns.`;
  } else if (verdict === 'SUSPICIOUS') {
    return `This website shows some suspicious characteristics. Exercise caution before providing any personal information.`;
  } else if (verdict === 'DANGEROUS') {
    return `This website is likely malicious or fraudulent. We strongly recommend avoiding this site.`;
  } else {
    return `CRITICAL WARNING: This website is confirmed malicious. Do not visit or interact with this site under any circumstances.`;
  }
}

function generateRecommendation(verdict: string, riskFactors: string[]): string {
  if (verdict === 'SAFE') {
    return 'You can proceed with normal browsing. However, always practice good security hygiene.';
  } else if (verdict === 'SUSPICIOUS') {
    return 'Do not enter passwords, credit card information, or personal data. Verify the website legitimacy through official channels first.';
  } else {
    return 'BLOCK THIS SITE immediately. Report it to your IT department. Do not click any links or download any files.';
  }
}

function getTIReason(source: string, url: string): string {
  // In production, this would query the actual TI database for the specific reason
  // For now, provide generic reasons based on source
  const reasons: Record<string, string> = {
    'Google Safe Browsing': 'Reported for phishing, malware distribution, or deceptive practices',
    'VirusTotal': 'Flagged by multiple antivirus engines as malicious',
    'PhishTank': 'Confirmed phishing website targeting user credentials',
    'URLhaus': 'Known to distribute malware or host exploit kits',
    'OpenPhish': 'Active phishing campaign detected',
    'AlienVault OTX': 'Associated with malicious activity in threat intelligence reports'
  };

  return reasons[source] || 'Reported as suspicious or malicious activity';
}
