/**
 * V2 Scan Result Formatters
 *
 * Formats raw V2 scan results into user-friendly outputs:
 * - Non-technical user summary (simple warnings)
 * - Technical analyst summary (forensic details)
 */

import type { EnhancedScanResult, GranularCheckResult, RiskLevel } from './types';

export interface NonTechSummary {
  verdict: string;  // e.g., "🚨 DANGEROUS - DO NOT VISIT"
  riskLevel: RiskLevel;
  confidence: string;  // e.g., "Very High (94%)"
  simpleSummary: string;
  keyWarnings: string[];
  whatToDo: string[];
  whyDangerous: string;
  visualIndicators?: {
    hasScreenshot: boolean;
    screenshotUrl?: string;
    annotations?: Array<{ type: string; text: string }>;
  };
}

export interface TechSummary {
  verdict: string;
  riskScore: number;
  riskLevel: RiskLevel;
  probability: number;
  confidenceInterval: { lower: number; upper: number; width: number };
  executiveSummary: string;
  threatIntelligence: any;
  infrastructure: any;
  behavioralAnalysis: any;
  brandImpersonation?: any;
  mlPredictions: any;
  policyDecision?: any;
  granularScores: any;
  recommendations: {
    immediate: string[];
    investigative: string[];
    preventive: string[];
  };
  forensics: any;
}

export function formatNonTechSummary(result: EnhancedScanResult): NonTechSummary {
  const verdictMap: Record<RiskLevel, string> = {
    A: '✅ SAFE - No threats detected',
    B: '⚠️ LOW RISK - Proceed with caution',
    C: '🔶 SUSPICIOUS - Be very careful',
    D: '🔴 LIKELY DANGEROUS - Avoid this site',
    E: '🚨 DANGEROUS - High threat level',
    F: '🚨 DANGEROUS - DO NOT VISIT'
  };

  const confidenceMap = (prob: number): string => {
    if (prob >= 0.9) return 'Very High';
    if (prob >= 0.75) return 'High';
    if (prob >= 0.5) return 'Medium';
    return 'Low';
  };

  const simpleSummary = generateSimpleSummary(result);
  const keyWarnings = generateKeyWarnings(result);
  const whatToDo = generateActionItems(result);
  const whyDangerous = generateWhyDangerous(result);

  return {
    verdict: verdictMap[result.riskLevel],
    riskLevel: result.riskLevel,
    confidence: `${confidenceMap(result.probability)} (${Math.round(result.probability * 100)}%)`,
    simpleSummary,
    keyWarnings,
    whatToDo,
    whyDangerous,
    visualIndicators: result.screenshotUrl ? {
      hasScreenshot: true,
      screenshotUrl: result.screenshotUrl,
      annotations: []
    } : undefined
  };
}

export function formatTechSummary(result: EnhancedScanResult): TechSummary {
  return {
    verdict: getVerdictText(result.riskLevel),
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    probability: result.probability,
    confidenceInterval: result.confidenceInterval,
    executiveSummary: generateExecutiveSummary(result),
    threatIntelligence: extractTIDetails(result),
    infrastructure: extractInfraDetails(result),
    behavioralAnalysis: extractBehavioralDetails(result),
    brandImpersonation: extractBrandDetails(result),
    mlPredictions: {
      stage1: result.stage1,
      stage2: result.stage2
    },
    policyDecision: result.policyOverride,
    granularScores: extractGranularScores(result),
    recommendations: generateRecommendations(result),
    forensics: extractForensics(result)
  };
}

// Helper functions
function generateSimpleSummary(result: EnhancedScanResult): string {
  // Generate 2-3 sentence summary for non-tech users
  const { riskLevel, evidenceSummary } = result;

  if (riskLevel === 'A') {
    return 'This website appears to be legitimate and safe to visit. No security threats were detected.';
  }

  if (riskLevel === 'F' || riskLevel === 'E') {
    return `This website is dangerous and trying to harm you. It was registered only ${evidenceSummary.domainAge} days ago and has been flagged by security systems as a threat.`;
  }

  return `This website shows suspicious characteristics. It may not be trustworthy. Proceed with extreme caution.`;
}

function generateKeyWarnings(result: EnhancedScanResult): string[] {
  const warnings: string[] = [];
  const { evidenceSummary, granularChecks } = result;

  // TI hits
  if (evidenceSummary.tiHits > 0) {
    warnings.push(`🔴 Flagged by ${evidenceSummary.tiHits} security database(s) as malicious`);
  }

  // Young domain
  if (evidenceSummary.domainAge < 30) {
    warnings.push(`🔴 Very new website (only ${evidenceSummary.domainAge} days old)`);
  }

  // Login form
  if (evidenceSummary.hasLoginForm) {
    const formCheck = granularChecks?.find(c => c.checkId === 'phishing_form_origin');
    if (formCheck && formCheck.status === 'FAIL') {
      warnings.push('🔴 Login form sends your password to a different website');
    }
  }

  // TLS
  if (!evidenceSummary.tlsValid) {
    warnings.push('🔴 No valid security certificate (connection not secure)');
  }

  return warnings;
}

function generateActionItems(result: EnhancedScanResult): string[] {
  const actions: string[] = [];

  if (result.riskLevel === 'F' || result.riskLevel === 'E') {
    actions.push('✋ DO NOT enter your username or password');
    actions.push('✋ DO NOT download anything from this site');
    actions.push('✅ Close this website immediately');
    actions.push('✅ If you entered credentials, change your password immediately');
    actions.push('✅ Enable two-factor authentication on your account');
  } else if (result.riskLevel === 'D' || result.riskLevel === 'C') {
    actions.push('⚠️ Verify the website address is correct');
    actions.push('⚠️ Do not enter sensitive information');
    actions.push('✅ Look for trust indicators (padlock icon, reviews)');
  } else {
    actions.push('✅ This website appears safe to use');
  }

  return actions;
}

function generateWhyDangerous(result: EnhancedScanResult): string {
  if (result.riskLevel === 'A' || result.riskLevel === 'B') {
    return 'This website passed security checks and appears legitimate.';
  }

  return 'Criminals may have created this website to steal your personal information, passwords, or money. The security warnings indicate this is not trustworthy.';
}

// Tech summary helpers
function getVerdictText(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    A: 'SAFE',
    B: 'LOW_RISK',
    C: 'SUSPICIOUS',
    D: 'LIKELY_THREAT',
    E: 'CRITICAL_THREAT',
    F: 'CONFIRMED_THREAT'
  };
  return map[level];
}

function generateExecutiveSummary(result: EnhancedScanResult): string {
  // Generate 3-4 sentence technical summary
  return `High-confidence threat detected. Domain age: ${result.evidenceSummary.domainAge} days. TI hits: ${result.evidenceSummary.tiHits}. Final verdict: ${result.riskLevel} (${Math.round(result.probability * 100)}%).`;
}

function extractTIDetails(result: EnhancedScanResult): any {
  const tiChecks = result.granularChecks?.filter(c => c.category === 'security' && c.checkId.startsWith('ti_')) || [];
  return {
    tier1Hits: tiChecks.filter(c => c.status === 'FAIL').length,
    sources: tiChecks.map(c => ({
      name: c.name,
      severity: c.status === 'FAIL' ? 'HIGH' : 'MEDIUM',
      details: c.evidence
    }))
  };
}

function extractInfraDetails(result: EnhancedScanResult): any {
  return {
    domain: {
      age: result.evidenceSummary.domainAge,
      tlsValid: result.evidenceSummary.tlsValid
    }
  };
}

function extractBehavioralDetails(result: EnhancedScanResult): any {
  return {
    hasLoginForm: result.evidenceSummary.hasLoginForm,
    autoDownload: result.evidenceSummary.autoDownload
  };
}

function extractBrandDetails(result: EnhancedScanResult): any {
  const brandCheck = result.granularChecks?.find(c => c.checkId.includes('brand'));
  return brandCheck ? { detected: brandCheck.status === 'FAIL', evidence: brandCheck.evidence } : undefined;
}

function extractGranularScores(result: EnhancedScanResult): any {
  const byCategory: Record<string, any> = {};

  result.granularChecks?.forEach(check => {
    if (!byCategory[check.category]) {
      byCategory[check.category] = { points: 0, max: 0, checks: [] };
    }
    byCategory[check.category].points += check.points;
    byCategory[check.category].max += check.maxPoints;
    byCategory[check.category].checks.push(check);
  });

  return { byCategory };
}

function generateRecommendations(result: EnhancedScanResult): any {
  const immediate: string[] = [];
  const investigative: string[] = [];
  const preventive: string[] = [];

  if (result.riskLevel === 'F' || result.riskLevel === 'E') {
    immediate.push('BLOCK at perimeter (firewall/proxy)');
    immediate.push('Add to organizational deny list');
    immediate.push('Alert all users who accessed this domain');

    investigative.push('Check SIEM logs for access attempts');
    investigative.push('Search for related campaign domains');

    preventive.push('Deploy browser warnings for similar domains');
    preventive.push('User awareness training on phishing');
  }

  return { immediate, investigative, preventive };
}

function extractForensics(result: EnhancedScanResult): any {
  return {
    scanTimestamp: result.timestamp,
    scanDuration: result.latency.total,
    screenshotUrl: result.screenshotUrl,
    scanId: result.scanId
  };
}
