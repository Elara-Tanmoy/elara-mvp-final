import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';

// Levenshtein distance for typosquatting detection
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const KNOWN_BRANDS = [
  'paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook', 'netflix',
  'ebay', 'alibaba', 'walmart', 'target', 'bestbuy', 'bankofamerica', 'chase',
  'wellsfargo', 'citibank', 'americanexpress', 'discover', 'capitalone'
];

export interface BrandProtectionResult {
  score: number;
  maxScore: number;
  findings: any[];
  evidence: any;
}

/**
 * RYAN RAG - Brand Protection (30 points max)
 */
export async function analyzeBrandProtection(url: string, hostname: string): Promise<BrandProtectionResult> {
  const findings: any[] = [];
  let score = 0;
  const maxScore = 30;
  const evidence: any = {};

  try {
    const domain = hostname.replace('www.', '').split('.')[0];

    // Typosquatting detection (10 points)
    for (const brand of KNOWN_BRANDS) {
      const distance = levenshteinDistance(domain, brand);
      if (distance > 0 && distance <= 2) {
        score += 10;
        evidence.typosquatting = brand;
        findings.push({ severity: 'critical', message: `Possible typosquatting of '${brand}' (similarity: ${distance})`, points: 10, source: 'Typosquatting Detection' });
        break;
      }
    }

    // Homograph attacks (8 points)
    const suspiciousChars = /[а-яА-Я]/;  // Cyrillic characters
    if (suspiciousChars.test(hostname)) {
      score += 8;
      findings.push({ severity: 'high', message: 'Uses lookalike characters (homograph attack)', points: 8, source: 'Homograph Detection' });
    }

    // Content plagiarism check
    try {
      const response = await axios.get(url, { timeout: 5000, validateStatus: () => true });
      const $ = cheerio.load(response.data);

      // Logo theft detection (12 points)
      const images = $('img');
      const brandLogos = images.filter((_, el) => {
        const src = $(el).attr('src') || '';
        const alt = $(el).attr('alt') || '';
        return KNOWN_BRANDS.some(brand => src.includes(brand) || alt.toLowerCase().includes(brand));
      }).length;

      if (brandLogos > 0 && !KNOWN_BRANDS.some(b => hostname.includes(b))) {
        score += 12;
        findings.push({ severity: 'critical', message: `Using ${brandLogos} brand logo(s) without authorization`, points: 12, source: 'Logo Theft Detection' });
      }
    } catch (error) {
      // Content fetch failed, skip this check
    }

    logger.info(`[Brand Protection] Complete: ${score}/${maxScore} points`);
    return { score, maxScore, findings, evidence };
  } catch (error) {
    logger.error('[Brand Protection] Error:', error);
    return { score: 0, maxScore, findings: [], evidence: {} };
  }
}
