/**
 * Verdict Generator for URL Scanner V2
 *
 * Generates ScamAdviser-style verdicts with:
 * - Trust score (0-100, inverted from risk score)
 * - Human-readable verdict (SAFE, SUSPICIOUS, DANGEROUS)
 * - Positive and negative highlights
 * - Final summary and recommendation
 */

import type {
  EnhancedScanResult,
  GranularCheckResult,
  ReachabilityStatus,
  RiskLevel
} from './types';

export interface FinalVerdict {
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
  trustScore: number; // 0-100 (inverse of risk score)
  summary: string;
  recommendation: string;
  positiveHighlights: string[];
  negativeHighlights: string[];
  badges: Verdict Badge[];
}

export interface VerdictBadge {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  text: string;
}

/**
 * Generate final verdict from scan result
 */
export function generateVerdict(scan: EnhancedScanResult): FinalVerdict {
  // Trust score is inverse of risk score (100 - riskScore)
  const trustScore = Math.max(0, Math.min(100, 100 - scan.riskScore));

  // Determine verdict category
  const verdict = determineVerdict(trustScore, scan.riskLevel);

  // Extract highlights from granular checks
  const positiveHighlights = extractPositiveHighlights(scan.granularChecks || [], scan);
  const negativeHighlights = extractNegativeHighlights(scan.granularChecks || [], scan);

  // Generate summary
  const summary = generateSummary(scan, verdict, trustScore, positiveHighlights, negativeHighlights);

  // Generate recommendation
  const recommendation = generateRecommendation(verdict, scan);

  // Generate badges
  const badges = generateBadges(scan);

  return {
    verdict,
    trustScore,
    summary,
    recommendation,
    positiveHighlights,
    negativeHighlights,
    badges
  };
}

/**
 * Determine verdict category from trust score and risk level
 */
function determineVerdict(trustScore: number, riskLevel: RiskLevel): 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN' {
  // Map risk levels to verdict
  if (riskLevel === RiskLevel.F || riskLevel === RiskLevel.E) {
    return 'DANGEROUS';
  }

  if (riskLevel === RiskLevel.D || riskLevel === RiskLevel.C) {
    return 'SUSPICIOUS';
  }

  if (riskLevel === RiskLevel.A || riskLevel === RiskLevel.B) {
    return 'SAFE';
  }

  // Also check trust score
  if (trustScore >= 70) return 'SAFE';
  if (trustScore >= 40) return 'SUSPICIOUS';
  if (trustScore >= 0) return 'DANGEROUS';

  return 'UNKNOWN';
}

/**
 * Extract positive highlights (things that passed checks)
 */
function extractPositiveHighlights(checks: GranularCheckResult[], scan: EnhancedScanResult): string[] {
  const highlights: string[] = [];

  // Domain age
  if (scan.evidenceSummary.domainAge > 365) {
    const years = Math.floor(scan.evidenceSummary.domainAge / 365);
    highlights.push(`Domain is ${years}+ year${years > 1 ? 's' : ''} old - established website`);
  }

  // Valid SSL
  if (scan.evidenceSummary.tlsValid) {
    highlights.push('Valid SSL certificate from trusted authority');
  }

  // No threat intelligence hits
  if (scan.evidenceSummary.tiHits === 0) {
    highlights.push('No threat intelligence hits - clean reputation');
  }

  // Check reputation if available
  if (scan.reputationInfo && scan.reputationInfo.rank) {
    if (scan.reputationInfo.rank <= 10000) {
      highlights.push(`Top ${(scan.reputationInfo.rank / 1000).toFixed(0)}K globally ranked site - highly trusted`);
    } else if (scan.reputationInfo.rank <= 100000) {
      highlights.push(`Top 100K globally ranked site - well-established`);
    }
  }

  // HTTPS
  if (scan.url.startsWith('https://')) {
    highlights.push('Uses secure HTTPS connection');
  }

  // Check specific checks that passed
  const passedChecks = checks.filter(c => c.status === 'PASS');

  // Look for important passed checks
  const importantPasses = passedChecks.filter(c =>
    c.checkId.includes('ti_') ||
    c.checkId.includes('tls_') ||
    c.checkId.includes('domain_age') ||
    c.checkId.includes('brand_impersonation') ||
    c.checkId.includes('free_hosting')
  );

  // Add a few important passed checks
  importantPasses.slice(0, 5).forEach(check => {
    if (check.description && !highlights.some(h => h.includes(check.description))) {
      highlights.push(check.description);
    }
  });

  return highlights.slice(0, 8); // Max 8 highlights
}

/**
 * Extract negative highlights (things that failed checks)
 */
function extractNegativeHighlights(checks: GranularCheckResult[], scan: EnhancedScanResult): string[] {
  const highlights: string[] = [];

  // Threat intelligence hits
  if (scan.evidenceSummary.tiHits > 0) {
    highlights.push(`Flagged by ${scan.evidenceSummary.tiHits} threat intelligence source${scan.evidenceSummary.tiHits > 1 ? 's' : ''} - known malicious`);
  }

  // Young domain
  if (scan.evidenceSummary.domainAge < 30) {
    highlights.push(`Very new domain (${scan.evidenceSummary.domainAge} days old) - high phishing risk`);
  } else if (scan.evidenceSummary.domainAge < 90) {
    highlights.push(`Recently created domain (${scan.evidenceSummary.domainAge} days old) - proceed with caution`);
  }

  // Invalid SSL
  if (!scan.evidenceSummary.tlsValid && scan.url.startsWith('https://')) {
    highlights.push('Invalid or untrusted SSL certificate');
  }

  // Login form detected
  if (scan.evidenceSummary.hasLoginForm) {
    highlights.push('Login form detected - verify site authenticity before entering credentials');
  }

  // Auto download
  if (scan.evidenceSummary.autoDownload) {
    highlights.push('Automatic file download detected - potential malware risk');
  }

  // Check specific failed checks
  const failedChecks = checks.filter(c => c.status === 'FAIL');

  // Sort by points lost (higher penalty = more important)
  const criticalFailures = failedChecks
    .filter(c => c.maxPoints - c.points >= 10) // Only failures with significant penalty
    .sort((a, b) => (b.maxPoints - b.points) - (a.maxPoints - a.points))
    .slice(0, 10); // Top 10 critical failures

  // Add critical failure descriptions
  criticalFailures.forEach(check => {
    if (check.description && !highlights.some(h => h.includes(check.description))) {
      highlights.push(check.description);
    }
  });

  return highlights.slice(0, 10); // Max 10 negative highlights
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  scan: EnhancedScanResult,
  verdict: string,
  trustScore: number,
  positiveHighlights: string[],
  negativeHighlights: string[]
): string {
  const hostname = new URL(scan.url).hostname;
  const domainAge = scan.evidenceSummary.domainAge;
  const tiHits = scan.evidenceSummary.tiHits;

  // Build summary based on verdict
  if (verdict === 'DANGEROUS') {
    const reasons: string[] = [];

    if (tiHits > 0) {
      reasons.push(`flagged by ${tiHits} threat intelligence source${tiHits > 1 ? 's' : ''}`);
    }
    if (domainAge < 30) {
      reasons.push('extremely new domain');
    }
    if (negativeHighlights.length > 3) {
      reasons.push(`${negativeHighlights.length} security red flags`);
    }

    if (reasons.length > 0) {
      return `This website is DANGEROUS. It has been ${reasons.join(', ')}. Our analysis gave it a trust score of ${trustScore}/100. We strongly recommend avoiding this site.`;
    }

    return `This website is DANGEROUS with a trust score of ${trustScore}/100. Multiple security red flags detected. We strongly recommend avoiding this site.`;
  }

  if (verdict === 'SUSPICIOUS') {
    const concerns: string[] = [];

    if (domainAge < 90) {
      concerns.push('relatively new');
    }
    if (negativeHighlights.length > 0) {
      concerns.push(`has ${negativeHighlights.length} warning sign${negativeHighlights.length > 1 ? 's' : ''}`);
    }
    if (scan.evidenceSummary.hasLoginForm && !scan.evidenceSummary.tlsValid) {
      concerns.push('requests credentials without proper security');
    }

    if (concerns.length > 0) {
      return `This website is SUSPICIOUS. It is ${concerns.join(', ')}. Our analysis gave it a trust score of ${trustScore}/100. Exercise caution if using this site.`;
    }

    return `This website is SUSPICIOUS with a trust score of ${trustScore}/100. Some security concerns detected. Exercise caution if using this site.`;
  }

  if (verdict === 'SAFE') {
    const strengths: string[] = [];

    if (scan.reputationInfo && scan.reputationInfo.rank && scan.reputationInfo.rank <= 100000) {
      strengths.push(`globally ranked #${scan.reputationInfo.rank.toLocaleString()}`);
    }
    if (domainAge > 365) {
      const years = Math.floor(domainAge / 365);
      strengths.push(`${years}+ year${years > 1 ? 's' : ''} old`);
    }
    if (scan.evidenceSummary.tlsValid) {
      strengths.push('secure SSL certificate');
    }
    if (tiHits === 0) {
      strengths.push('clean reputation');
    }

    if (strengths.length > 0) {
      return `This website appears SAFE. It is ${strengths.join(', ')}. Our analysis gave it a trust score of ${trustScore}/100. No significant security concerns detected.`;
    }

    return `This website appears SAFE with a trust score of ${trustScore}/100. No significant security concerns detected.`;
  }

  return `Unable to determine safety of this website. Trust score: ${trustScore}/100. Analysis incomplete.`;
}

/**
 * Generate recommendation
 */
function generateRecommendation(verdict: string, scan: EnhancedScanResult): string {
  if (verdict === 'DANGEROUS') {
    return '⛔ DO NOT USE THIS WEBSITE. Block access and report to security team. Do not enter any personal information or credentials.';
  }

  if (verdict === 'SUSPICIOUS') {
    const warnings: string[] = [];

    if (scan.evidenceSummary.hasLoginForm) {
      warnings.push('Do not enter credentials unless you can verify site authenticity');
    }
    if (scan.evidenceSummary.domainAge < 90) {
      warnings.push('Verify legitimacy before making purchases or sharing information');
    }
    if (!scan.evidenceSummary.tlsValid) {
      warnings.push('Avoid entering sensitive data on this site');
    }

    if (warnings.length > 0) {
      return `⚠️ PROCEED WITH CAUTION. ${warnings.join('. ')}.`;
    }

    return '⚠️ PROCEED WITH CAUTION. Verify site legitimacy before sharing sensitive information.';
  }

  if (verdict === 'SAFE') {
    return '✅ This site appears legitimate and safe to use. Continue to practice standard internet safety precautions.';
  }

  return 'ℹ️ Unable to verify site safety. Exercise standard caution when using this website.';
}

/**
 * Generate badges for quick visual indicators
 */
function generateBadges(scan: EnhancedScanResult): VerdictBadge[] {
  const badges: VerdictBadge[] = [];

  // Domain age badge
  const domainAge = scan.evidenceSummary.domainAge;
  if (domainAge > 1825) { // 5+ years
    badges.push({ type: 'success', icon: '🎂', text: `${Math.floor(domainAge / 365)}+ Years Old` });
  } else if (domainAge < 30) {
    badges.push({ type: 'danger', icon: '🆕', text: 'Brand New Domain' });
  } else if (domainAge < 90) {
    badges.push({ type: 'warning', icon: '📅', text: 'Recently Created' });
  }

  // SSL badge
  if (scan.evidenceSummary.tlsValid) {
    badges.push({ type: 'success', icon: '🔒', text: 'Secure SSL' });
  } else if (scan.url.startsWith('https://')) {
    badges.push({ type: 'danger', icon: '⚠️', text: 'Invalid SSL' });
  }

  // Reputation badge
  if (scan.reputationInfo && scan.reputationInfo.rank) {
    if (scan.reputationInfo.rank <= 10000) {
      badges.push({ type: 'success', icon: '🏆', text: 'Top 10K Site' });
    } else if (scan.reputationInfo.rank <= 100000) {
      badges.push({ type: 'success', icon: '⭐', text: 'Popular Site' });
    }
  }

  // Threat intel badge
  if (scan.evidenceSummary.tiHits > 0) {
    badges.push({ type: 'danger', icon: '🚨', text: `${scan.evidenceSummary.tiHits} Threat Alert${scan.evidenceSummary.tiHits > 1 ? 's' : ''}` });
  } else {
    badges.push({ type: 'success', icon: '✅', text: 'Clean Reputation' });
  }

  // Reachability badge
  if (scan.reachability === 'ONLINE') {
    badges.push({ type: 'success', icon: '🌐', text: 'Online' });
  } else if (scan.reachability === 'OFFLINE') {
    badges.push({ type: 'warning', icon: '📡', text: 'Offline' });
  } else if (scan.reachability === 'SINKHOLE') {
    badges.push({ type: 'danger', icon: '🕳️', text: 'Sinkholed' });
  }

  return badges;
}
