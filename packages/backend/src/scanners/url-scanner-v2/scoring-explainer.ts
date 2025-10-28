/**
 * Scoring Explanation Generator
 * Provides human-readable explanations of risk scoring decisions
 */

import { ScoringExplanation, ReputationInfo } from './types';
import { reputationWhitelist } from './reputation-whitelist';

export function generateScoringExplanation(
  hostname: string,
  domainAge: number,
  riskLevel: string,
  probability: number,
  decisionGraph: any[],
  categoryPoints: number,
  categoryPossible: number
): ScoringExplanation {

  const reputation = reputationWhitelist.getReputation(hostname);

  // Extract adjustments from decision graph
  const stage1 = decisionGraph.find(d => d.component === 'Stage-1 Models');
  const causal = decisionGraph.find(d => d.component === 'Causal Signals');
  const branch = decisionGraph.find(d => d.component === 'Branch Correction');
  const category = decisionGraph.find(d => d.component === 'Category Risk Boost');
  const repDiscount = decisionGraph.find(d => d.component === 'Reputation Override' || d.component === 'Reputation Discount');
  const ageDiscount = decisionGraph.find(d => d.component === 'Domain Age Trust');

  const probabilityBreakdown = {
    stage1Combined: stage1?.output?.probability || 0,
    stage2Combined: null,
    causalAdjustments: causal?.contribution || 0,
    branchCorrection: branch?.contribution || 0,
    categoryBoost: category?.contribution || 0,
    reputationDiscount: repDiscount?.contribution || 0,
    domainAgeDiscount: ageDiscount?.contribution || 0,
    final: probability
  };

  // Build key factors
  const keyFactors: any[] = [];

  if (reputation && reputation.trustScore >= 70) {
    keyFactors.push({
      factor: 'Domain Reputation',
      impact: 'positive',
      weight: Math.abs(probabilityBreakdown.reputationDiscount),
      description: `Ranked #${reputation.rank.toLocaleString()} globally (Tranco Top 1M), trust score: ${reputation.trustScore}/100`
    });
  }

  if (domainAge > 1825) {
    keyFactors.push({
      factor: 'Domain Age',
      impact: 'positive',
      weight: Math.abs(probabilityBreakdown.domainAgeDiscount),
      description: `Domain is ${Math.floor(domainAge/365)} years old - well-established`
    });
  }

  const categoryRisk = categoryPoints / categoryPossible;
  if (categoryRisk < 0.15) {
    keyFactors.push({
      factor: 'Security Checks',
      impact: 'positive',
      weight: 0.15,
      description: `Passed security checks with minimal penalties (${categoryPoints}/${categoryPossible} points)`
    });
  } else if (categoryRisk > 0.30) {
    keyFactors.push({
      factor: 'Security Warnings',
      impact: 'negative',
      weight: Math.abs(probabilityBreakdown.categoryBoost),
      description: `Failed multiple security checks (${categoryPoints}/${categoryPossible} penalty points)`
    });
  }

  // Generate risk reasoning
  let riskReasoning = '';

  if (riskLevel === 'A' || riskLevel === 'B') {
    riskReasoning = `This site is marked as Risk ${riskLevel} (Safe) because `;

    const reasons: string[] = [];
    if (reputation && reputation.rank <= 100000) {
      reasons.push(`it's a well-known domain ranked #${reputation.rank.toLocaleString()} globally`);
    }
    if (domainAge > 1825) {
      reasons.push(`it's been registered for ${Math.floor(domainAge/365)}+ years`);
    }
    if (categoryRisk < 0.15) {
      reasons.push(`it passed all security checks with minimal warnings`);
    }

    riskReasoning += reasons.length > 0
      ? reasons.join(', ') + '.'
      : 'no significant phishing indicators were detected.';

  } else if (riskLevel === 'C') {
    riskReasoning = `This site is marked as Risk ${riskLevel} (Caution) due to some suspicious patterns detected, but it may be legitimate. Exercise caution when entering sensitive information.`;
  } else {
    riskReasoning = `This site is marked as Risk ${riskLevel} (Dangerous) because multiple phishing indicators were detected: ${categoryPoints} penalty points across security checks, probability score of ${(probability * 100).toFixed(1)}%.`;
  }

  return {
    finalVerdict: `Risk ${riskLevel} - ${getRiskLabel(riskLevel)}`,
    riskReasoning,
    probabilityBreakdown,
    keyFactors
  };
}

function getRiskLabel(riskLevel: string): string {
  const labels: Record<string, string> = {
    'A': 'Safe',
    'B': 'Low Risk',
    'C': 'Caution',
    'D': 'High Risk',
    'E': 'Very High Risk',
    'F': 'Dangerous'
  };
  return labels[riskLevel] || 'Unknown';
}

export function getReputationInfo(hostname: string): ReputationInfo {
  const rep = reputationWhitelist.getReputation(hostname);
  const trustLevel = reputationWhitelist.getTrustLevel(hostname);

  return {
    rank: rep?.rank || null,
    trustScore: rep?.trustScore || null,
    trustLevel,
    source: rep?.source || 'none'
  };
}
