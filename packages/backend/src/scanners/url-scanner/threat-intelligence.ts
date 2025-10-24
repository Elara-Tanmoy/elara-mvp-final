import axios from 'axios';
import { logger } from '../../config/logger.js';
import { checkURL as checkGoogleSafeBrowsing } from '../../api-integrations/google-safe-browsing.js';

export interface ThreatIntelligenceResult {
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG - Threat Intelligence (40 points max)
 * Integrates multiple threat databases
 */
export async function analyzeThreatIntelligence(url: string): Promise<ThreatIntelligenceResult> {
  const findings: any[] = [];
  let score = 0;
  const maxScore = 40;
  const evidence: any = {};

  try {
    logger.info(`[Threat Intelligence] Analyzing ${url}`);

    // 1. Google Safe Browsing (15 points)
    const safeBrowsing = await checkGoogleSafeBrowsing(url);
    evidence.safeBrowsing = safeBrowsing;

    if (safeBrowsing.listed) {
      score += 15;
      findings.push({
        severity: 'critical',
        message: `Listed in Google Safe Browsing: ${safeBrowsing.threatTypes.join(', ')}`,
        points: 15,
        source: 'Google Safe Browsing'
      });
    }

    // 2. VirusTotal (8 points)
    const vtApiKey = process.env.VIRUSTOTAL_API_KEY;
    if (vtApiKey) {
      try {
        const vtResponse = await axios.post(
          'https://www.virustotal.com/api/v3/urls',
          `url=${encodeURIComponent(url)}`,
          {
            headers: { 'x-apikey': vtApiKey, 'content-type': 'application/x-www-form-urlencoded' },
            timeout: 5000
          }
        );

        const analysisId = vtResponse.data.data.id;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for analysis

        const analysisResponse = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          { headers: { 'x-apikey': vtApiKey }, timeout: 5000 }
        );

        const stats = analysisResponse.data.data.attributes.stats;
        evidence.virusTotal = stats;

        if (stats.malicious > 0) {
          score += 8;
          findings.push({
            severity: 'critical',
            message: `VirusTotal: ${stats.malicious}/${stats.malicious + stats.harmless} engines flagged as malicious`,
            points: 8,
            source: 'VirusTotal'
          });
        }
      } catch (error) {
        logger.warn('[Threat Intelligence] VirusTotal check failed:', error);
      }
    }

    // 3. URLhaus Check (10 points) - Free API
    try {
      const urlhausResponse = await axios.post(
        'https://urlhaus-api.abuse.ch/v1/url/',
        `url=${encodeURIComponent(url)}`,
        {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          timeout: 3000
        }
      );

      if (urlhausResponse.data.query_status === 'ok') {
        score += 10;
        evidence.urlhaus = urlhausResponse.data;
        findings.push({
          severity: 'critical',
          message: `Listed in URLhaus malware database: ${urlhausResponse.data.threat}`,
          points: 10,
          source: 'URLhaus'
        });
      }
    } catch (error) {
      // Not listed or error - considered safe
    }

    // 4. PhishTank Check (7 points) - Free database
    try {
      const phishtankResponse = await axios.post(
        'https://checkurl.phishtank.com/checkurl/',
        `url=${encodeURIComponent(url)}&format=json`,
        {
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': 'phishtank/elara' },
          timeout: 3000
        }
      );

      if (phishtankResponse.data.results.in_database && phishtankResponse.data.results.valid) {
        score += 7;
        findings.push({
          severity: 'critical',
          message: 'Listed in PhishTank phishing database',
          points: 7,
          source: 'PhishTank'
        });
      }
    } catch (error) {
      // Not listed or error
    }

    if (score === 0) {
      findings.push({
        severity: 'info',
        message: 'Not found in any threat intelligence databases',
        points: 0,
        source: 'Threat Intelligence'
      });
    }

    logger.info(`[Threat Intelligence] Complete: ${score}/${maxScore} points`);
    return { score, maxScore, findings, evidence };
  } catch (error) {
    logger.error('[Threat Intelligence] Error:', error);
    return { score: 0, maxScore, findings: [], evidence: {} };
  }
}
