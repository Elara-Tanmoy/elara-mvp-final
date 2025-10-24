import { URL } from 'url';
import { logger } from '../../config/logger.js';
import { aiService } from '../../services/ai/ai.service.js';
import { analyzeDomain } from './domain-analysis.js';
import { analyzeNetworkSecurity } from './network-security.js';
import { analyzeContent } from './content-analysis.js';
import { analyzePrivacy } from './privacy-analysis.js';
import { analyzeEmailSecurity } from './email-security.js';
import { analyzeLegalCompliance } from './legal-compliance.js';
import { analyzeBrandProtection } from './brand-protection.js';
import { analyzeThreatIntelligence } from './threat-intelligence.js';
import { analyzeSecurityHeaders } from './security-headers.js';

export interface EnhancedScanResult {
  url: string;
  riskScore: number;
  maxScore: number;
  riskLevel: string;
  categories: CategoryResult[];
  findings: any[];
  scanDuration: number;
  summary: {
    totalChecks: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  verdict: {
    simple: string;
    technical: string;
    recommendation: string;
    safetyAdvice: string[];
  };
}

export interface CategoryResult {
  name: string;
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG Enhanced URL Scanner - Main Orchestrator
 *
 * Runs all 9 category scanners in parallel:
 * 1. Domain Analysis (40 pts)
 * 2. Network Security (45 pts)
 * 3. Content Analysis (60 pts)
 * 4. Privacy Analysis (50 pts)
 * 5. Email Security (25 pts)
 * 6. Legal Compliance (35 pts)
 * 7. Brand Protection (30 pts)
 * 8. Threat Intelligence (40 pts)
 * 9. Security Headers (25 pts)
 *
 * Total: 350 points max
 */
export async function enhancedScanURL(urlString: string): Promise<EnhancedScanResult> {
  const startTime = Date.now();

  try {
    logger.info('╔═══════════════════════════════════════════════════════════╗');
    logger.info('║     RYAN RAG ENHANCED URL SCANNER - Starting Analysis     ║');
    logger.info('╚═══════════════════════════════════════════════════════════╝');
    logger.info(`URL: ${urlString}`);

    const urlObj = new URL(urlString);
    const hostname = urlObj.hostname;

    // Run all 9 category scanners in parallel for maximum speed
    const [
      domainResult,
      networkResult,
      contentResult,
      privacyResult,
      emailResult,
      legalResult,
      brandResult,
      threatResult,
      headersResult
    ] = await Promise.all([
      analyzeDomain(hostname).catch(err => {
        logger.error('[Orchestrator] Domain analysis failed:', err);
        return { score: 0, maxScore: 40, findings: [], evidence: {} };
      }),
      analyzeNetworkSecurity(urlString, hostname).catch(err => {
        logger.error('[Orchestrator] Network security failed:', err);
        return { score: 0, maxScore: 45, findings: [], evidence: {} };
      }),
      analyzeContent(urlString, hostname).catch(err => {
        logger.error('[Orchestrator] Content analysis failed:', err);
        return { score: 0, maxScore: 60, findings: [], evidence: {} };
      }),
      analyzePrivacy(urlString, hostname).catch(err => {
        logger.error('[Orchestrator] Privacy analysis failed:', err);
        return { score: 0, maxScore: 50, findings: [], evidence: {} };
      }),
      analyzeEmailSecurity(hostname).catch(err => {
        logger.error('[Orchestrator] Email security failed:', err);
        return { score: 0, maxScore: 25, findings: [], evidence: {} };
      }),
      analyzeLegalCompliance(urlString).catch(err => {
        logger.error('[Orchestrator] Legal compliance failed:', err);
        return { score: 0, maxScore: 35, findings: [], evidence: {} };
      }),
      analyzeBrandProtection(urlString, hostname).catch(err => {
        logger.error('[Orchestrator] Brand protection failed:', err);
        return { score: 0, maxScore: 30, findings: [], evidence: {} };
      }),
      analyzeThreatIntelligence(urlString).catch(err => {
        logger.error('[Orchestrator] Threat intelligence failed:', err);
        return { score: 0, maxScore: 40, findings: [], evidence: {} };
      }),
      analyzeSecurityHeaders(urlString).catch(err => {
        logger.error('[Orchestrator] Security headers failed:', err);
        return { score: 0, maxScore: 25, findings: [], evidence: {} };
      })
    ]);

    // Build category results
    const categories: CategoryResult[] = [
      { name: 'Domain Analysis', ...domainResult },
      { name: 'Network Security', ...networkResult },
      { name: 'Content Analysis', ...contentResult },
      { name: 'Privacy Analysis', ...privacyResult },
      { name: 'Email Security', ...emailResult },
      { name: 'Legal Compliance', ...legalResult },
      { name: 'Brand Protection', ...brandResult },
      { name: 'Threat Intelligence', ...threatResult },
      { name: 'Security Headers', ...headersResult }
    ];

    // Calculate total risk score
    const riskScore = categories.reduce((sum, cat) => sum + cat.score, 0);
    const maxScore = categories.reduce((sum, cat) => sum + cat.maxScore, 0);

    // Collect all findings
    const allFindings = categories.flatMap(cat => cat.findings);

    // Count findings by severity
    const summary = {
      totalChecks: allFindings.length,
      criticalFindings: allFindings.filter(f => f.severity === 'critical').length,
      highFindings: allFindings.filter(f => f.severity === 'high').length,
      mediumFindings: allFindings.filter(f => f.severity === 'medium').length,
      lowFindings: allFindings.filter(f => f.severity === 'low').length
    };

    // Determine risk level based on score
    let riskLevel: string;
    if (riskScore >= 200) {
      riskLevel = 'critical';
    } else if (riskScore >= 120) {
      riskLevel = 'high';
    } else if (riskScore >= 60) {
      riskLevel = 'medium';
    } else if (riskScore >= 20) {
      riskLevel = 'low';
    } else {
      riskLevel = 'safe';
    }

    const scanDuration = Date.now() - startTime;

    // Generate comprehensive AI-powered verdict and recommendations
    const verdict = await generateAIVerdict(urlString, hostname, riskScore, maxScore, riskLevel, summary, allFindings, categories);

    logger.info('╔═══════════════════════════════════════════════════════════╗');
    logger.info(`║  SCAN COMPLETE: ${riskScore}/${maxScore} points | Risk: ${riskLevel.toUpperCase()}`);
    logger.info(`║  Findings: ${summary.criticalFindings} critical, ${summary.highFindings} high, ${summary.mediumFindings} medium`);
    logger.info(`║  Duration: ${scanDuration}ms`);
    logger.info('╚═══════════════════════════════════════════════════════════╝');

    return {
      url: urlString,
      riskScore,
      maxScore,
      riskLevel,
      categories,
      findings: allFindings,
      scanDuration,
      summary,
      verdict
    };

  } catch (error) {
    logger.error('[RYAN RAG] Critical error:', error);
    throw error;
  }
}

/**
 * Generate AI-powered comprehensive verdict and recommendations
 * Uses Claude AI to create detailed, contextual explanations for both technical and non-technical users
 */
async function generateAIVerdict(
  url: string,
  hostname: string,
  riskScore: number,
  maxScore: number,
  riskLevel: string,
  summary: any,
  findings: any[],
  categories: CategoryResult[]
): Promise<{
  simple: string;
  technical: string;
  recommendation: string;
  safetyAdvice: string[];
}> {
  try {
    logger.info('[AI Verdict] Generating comprehensive analysis...');

    // Get critical and high severity findings
    const criticalIssues = findings.filter(f => f.severity === 'critical');
    const highIssues = findings.filter(f => f.severity === 'high');
    const mediumIssues = findings.filter(f => f.severity === 'medium');

    // Build category summary
    const categorySummary = categories.map(cat =>
      `${cat.name}: ${cat.score}/${cat.maxScore} points (${cat.findings.length} findings)`
    ).join('\n');

    // Create detailed findings summary
    const findingsSummary = [
      ...criticalIssues.slice(0, 5).map(f => `CRITICAL: ${f.message} (${f.source})`),
      ...highIssues.slice(0, 5).map(f => `HIGH: ${f.message} (${f.source})`),
      ...mediumIssues.slice(0, 3).map(f => `MEDIUM: ${f.message} (${f.source})`)
    ].join('\n');

    // Build comprehensive evidence details from all categories
    const evidenceDetails = categories.map(cat => {
      const evidence = cat.evidence || {};
      const evidenceStr = Object.keys(evidence).length > 0
        ? `Evidence: ${JSON.stringify(evidence).substring(0, 200)}`
        : '';

      return `${cat.name} (${cat.score}/${cat.maxScore} pts):
  Findings: ${cat.findings.map(f => `${f.severity.toUpperCase()}: ${f.message}`).join('; ')}
  ${evidenceStr}`;
    }).join('\n\n');

    const prompt = `You are an elite cybersecurity analyst providing a COMPREHENSIVE verdict on website security. You MUST synthesize ALL the data below into a detailed, accurate analysis.

═══════════════════════════════════════════════════════
🌐 WEBSITE BEING ANALYZED
═══════════════════════════════════════════════════════
URL: ${url}
Domain: ${hostname}

═══════════════════════════════════════════════════════
📊 OVERALL RISK ASSESSMENT
═══════════════════════════════════════════════════════
Total Risk Score: ${riskScore} / ${maxScore} points
Risk Level: ${riskLevel.toUpperCase()}
Total Security Checks: ${summary.totalChecks}

Finding Distribution:
• CRITICAL Issues: ${summary.criticalFindings}
• HIGH Severity: ${summary.highFindings}
• MEDIUM Severity: ${summary.mediumFindings}
• LOW Severity: ${summary.lowFindings}

═══════════════════════════════════════════════════════
🔍 DETAILED CATEGORY ANALYSIS (9 Categories)
═══════════════════════════════════════════════════════
${evidenceDetails}

═══════════════════════════════════════════════════════
🚨 CRITICAL & HIGH SEVERITY FINDINGS
═══════════════════════════════════════════════════════
${findingsSummary}

═══════════════════════════════════════════════════════
📝 YOUR TASK - SYNTHESIZE EVERYTHING ABOVE
═══════════════════════════════════════════════════════

YOU MUST analyze ALL 9 categories, ALL findings, and ALL evidence above to create a comprehensive, accurate verdict. Reference SPECIFIC findings, evidence, and categories in your analysis.

Provide your response in EXACTLY this format:

**SIMPLE EXPLANATION (For Non-Technical Users):**
Start with a clear verdict emoji and label (🚨 DANGER / ⚠️ HIGH RISK / ⚡ MODERATE RISK / ✓ LOW RISK / ✅ SAFE).
Write 3-4 sentences explaining:
1. What we found (mention SPECIFIC threats found - e.g., "phishing indicators", "malicious scripts", "SSL issues")
2. What this means for them (real-world danger - money loss, data theft, malware, etc.)
3. The PRIMARY risk (what's the #1 concern)
Use simple, clear language a non-technical person can understand. NO jargon.

**TECHNICAL ANALYSIS (For Security Professionals):**
Provide a detailed 4-6 sentence technical assessment covering:
1. Domain & Infrastructure Issues (age, WHOIS, DNS, IP reputation)
2. Network Security Posture (SSL/TLS, headers, open ports)
3. Content & Code Analysis (malicious patterns, phishing tactics, scripts)
4. Threat Intelligence (VirusTotal, Google Safe Browsing, known threats)
5. Privacy & Compliance (GDPR, policies, data exposure)
6. Overall Attack Surface & Risk Justification

Reference SPECIFIC categories, scores, and evidence. Use technical terms. Cite actual findings.

**RECOMMENDATION (Immediate User Action):**
Provide 2-3 clear, prioritized actions:
1. Primary action (what to do RIGHT NOW)
2. If already interacted (what to do if they've already visited/entered info)
3. Prevention (how to avoid similar threats)

Be SPECIFIC and ACTIONABLE. Start each with a strong verb (AVOID, CLOSE, CHANGE, REPORT, etc.)

**SAFETY ADVICE:**
List exactly 5 safety tips. Each MUST:
- Start with an emoji (🚨 ⚠️ 🔒 💳 📧 🔍 ✅ 🛡️ 💡 etc.)
- Be specific and actionable
- Relate to the ACTUAL findings (not generic advice)
- Be ordered by priority (most important first)

Format as:
🚨 [Specific action based on actual finding]
⚠️ [Specific action based on actual finding]
[etc.]

═══════════════════════════════════════════════════════
⚠️ CRITICAL REQUIREMENTS:
═══════════════════════════════════════════════════════
- SYNTHESIZE all 9 categories into your analysis
- REFERENCE specific findings and evidence
- EXPLAIN the risk score (${riskScore}/${maxScore})
- BE ACCURATE to the actual data provided
- DO NOT make generic statements - be specific to THIS scan
- PRIORITIZE based on severity (critical > high > medium)

BEGIN YOUR COMPREHENSIVE ANALYSIS NOW:`;

    const aiResponse = await aiService.query({
      query: prompt,
      model: 'claude',
      useRAG: false
    });

    // Parse AI response
    const text = aiResponse.response;

    // Extract sections using regex
    const simpleMatch = text.match(/\*\*SIMPLE EXPLANATION.*?\*\*\s*:?\s*\n([\s\S]*?)(?=\*\*TECHNICAL ANALYSIS|\*\*RECOMMENDATION|$)/i);
    const technicalMatch = text.match(/\*\*TECHNICAL ANALYSIS.*?\*\*\s*:?\s*\n([\s\S]*?)(?=\*\*RECOMMENDATION|\*\*SAFETY ADVICE|$)/i);
    const recommendationMatch = text.match(/\*\*RECOMMENDATION.*?\*\*\s*:?\s*\n([\s\S]*?)(?=\*\*SAFETY ADVICE|$)/i);
    const safetyMatch = text.match(/\*\*SAFETY ADVICE.*?\*\*\s*:?\s*\n([\s\S]*?)$/i);

    const simple = simpleMatch ? simpleMatch[1].trim() : getFallbackSimple(riskLevel, summary);
    const technical = technicalMatch ? technicalMatch[1].trim() : getFallbackTechnical(riskLevel, riskScore, maxScore, hostname, findings);
    const recommendation = recommendationMatch ? recommendationMatch[1].trim() : getFallbackRecommendation(riskLevel);

    // Parse safety advice bullet points
    let safetyAdvice: string[] = [];
    if (safetyMatch) {
      const safetyText = safetyMatch[1].trim();
      safetyAdvice = safetyText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^[🔒🔍✅❌⚠️🛡️💡📧💳📞👀💾🔐⚡✓]/u.test(line)))
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .slice(0, 5);
    }

    if (safetyAdvice.length === 0) {
      safetyAdvice = getFallbackSafetyAdvice(riskLevel);
    }

    logger.info('[AI Verdict] Successfully generated AI-powered verdict');

    return {
      simple,
      technical,
      recommendation,
      safetyAdvice
    };

  } catch (error) {
    logger.error('[AI Verdict] Error generating AI verdict, using fallback:', error);
    // Fallback to static verdict if AI fails
    return getFallbackVerdict(riskLevel, riskScore, maxScore, summary, findings, hostname);
  }
}

/**
 * Fallback verdict generators if AI fails
 */
function getFallbackSimple(riskLevel: string, summary: any): string {
  if (riskLevel === 'critical') {
    return `🚨 DANGER - DO NOT VISIT: This website is extremely dangerous with ${summary.criticalFindings} critical security threats detected. Our comprehensive analysis found severe vulnerabilities including phishing indicators, malware signatures, and suspicious network infrastructure. Visiting this site could result in data theft, financial loss, or malware infection.`;
  } else if (riskLevel === 'high') {
    return `⚠️ HIGH RISK - AVOID THIS SITE: We detected ${summary.criticalFindings + summary.highFindings} serious security issues across multiple categories including domain reputation, content security, and threat intelligence databases. This site shows strong indicators of malicious intent and could compromise your personal information or device security.`;
  } else if (riskLevel === 'medium') {
    return `⚡ MODERATE RISK - PROCEED WITH CAUTION: Our analysis found ${summary.mediumFindings} suspicious indicators including missing security features, questionable privacy practices, or minor red flags. While not definitively malicious, exercise caution and verify legitimacy before sharing any personal information.`;
  } else if (riskLevel === 'low') {
    return `✓ LOW RISK - Generally Safe: This website appears mostly legitimate with only ${summary.lowFindings} minor concerns detected across our security checks. The site follows most security best practices, though you should still exercise standard online safety precautions.`;
  } else {
    return `✅ SAFE - No Threats Detected: Excellent news! This website passed all ${summary.totalChecks} security checks across 9 security categories. The site demonstrates strong security posture with proper SSL/TLS, clean threat intelligence records, and follows security best practices.`;
  }
}

function getFallbackTechnical(riskLevel: string, riskScore: number, maxScore: number, hostname: string, findings: any[]): string {
  const criticalIssues = findings.filter(f => f.severity === 'critical');
  const highIssues = findings.filter(f => f.severity === 'high');
  const categories = [...new Set(findings.map(f => f.source))];

  if (riskLevel === 'critical' || riskLevel === 'high') {
    return `${riskLevel.toUpperCase()} RISK ASSESSMENT (${riskScore}/${maxScore} points): Comprehensive analysis of "${hostname}" revealed ${criticalIssues.length} critical and ${highIssues.length} high-severity vulnerabilities across ${categories.length} security categories. Primary threats: ${criticalIssues.slice(0, 3).map(i => i.message).join('; ')}. Attack surface includes compromised domain infrastructure, inadequate security controls, and positive threat intelligence indicators. Immediate remediation required.`;
  }

  return `${riskLevel.toUpperCase()} RISK ASSESSMENT (${riskScore}/${maxScore} points): Domain "${hostname}" evaluated across 9 security categories including domain analysis, network security, content analysis, privacy compliance, threat intelligence, and brand protection. ${findings.length > 0 ? `Findings identified: ${findings.slice(0, 3).map(f => f.message).join('; ')}` : 'All security checks passed successfully'}. Overall security posture: ${riskLevel.toUpperCase()}.`;
}

function getFallbackRecommendation(riskLevel: string): string {
  if (riskLevel === 'critical' || riskLevel === 'high') {
    return 'DO NOT proceed to this website. Do not enter any personal information or credentials.';
  } else if (riskLevel === 'medium') {
    return 'Exercise caution. Verify legitimacy before sharing any information.';
  } else {
    return 'Site appears safe, but follow standard online security practices.';
  }
}

function getFallbackSafetyAdvice(riskLevel: string): string[] {
  if (riskLevel === 'critical' || riskLevel === 'high') {
    return [
      '❌ Close this page immediately',
      '🔒 Change passwords if you entered credentials',
      '💳 Contact your bank if you entered payment info',
      '📧 Report the suspicious link',
      '🛡️ Run a security scan on your device'
    ];
  } else {
    return [
      '✅ Verify HTTPS connection',
      '🔍 Check URL for typos',
      '🔐 Use strong passwords',
      '💡 Be cautious with personal data',
      '🛡️ Keep security software updated'
    ];
  }
}

function getFallbackVerdict(
  riskLevel: string,
  riskScore: number,
  maxScore: number,
  summary: any,
  findings: any[],
  hostname: string
): {
  simple: string;
  technical: string;
  recommendation: string;
  safetyAdvice: string[];
} {
  return {
    simple: getFallbackSimple(riskLevel, summary),
    technical: getFallbackTechnical(riskLevel, riskScore, maxScore, hostname, findings),
    recommendation: getFallbackRecommendation(riskLevel),
    safetyAdvice: getFallbackSafetyAdvice(riskLevel)
  };
}
