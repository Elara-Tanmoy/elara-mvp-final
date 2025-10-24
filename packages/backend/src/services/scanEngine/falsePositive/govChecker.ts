/**
 * Government & Educational Domain Checker
 *
 * Verifies if a domain belongs to:
 * - Government entities (.gov, .mil, country-specific gov domains)
 * - Educational institutions (.edu, .ac.uk, etc.)
 * - International organizations (.int)
 *
 * These domains are highly regulated and trustworthy
 */

import { logger } from '../../../config/logger.js';

export interface GovCheckResult {
  isGovernment: boolean;
  isEducational: boolean;
  isInternational: boolean;
  type?: string;
  country?: string;
  confidence: number;
  evidence: string[];
}

export class GovChecker {
  // US Government TLDs
  private static readonly US_GOV_TLDS = [
    '.gov',      // US Federal/State/Local government
    '.mil',      // US Military
    '.fed.us',   // US Federal agencies
    '.state.us', // US State governments
  ];

  // Educational TLDs
  private static readonly EDU_TLDS = [
    '.edu',      // US Educational institutions
    '.ac.uk',    // UK Academic
    '.edu.au',   // Australian Educational
    '.edu.cn',   // Chinese Educational
    '.ac.jp',    // Japanese Academic
    '.edu.in',   // Indian Educational
    '.ac.in',    // Indian Academic
    '.edu.br',   // Brazilian Educational
    '.edu.mx',   // Mexican Educational
  ];

  // International organization TLDs
  private static readonly INTL_TLDS = [
    '.int',      // International organizations (UN, NATO, etc.)
  ];

  // Country-specific government TLDs
  private static readonly COUNTRY_GOV_TLDS = [
    { tld: '.gov.uk', country: 'United Kingdom', confidence: 100 },
    { tld: '.gov.au', country: 'Australia', confidence: 100 },
    { tld: '.gov.ca', country: 'Canada', confidence: 100 },
    { tld: '.gc.ca', country: 'Canada (Government of Canada)', confidence: 100 },
    { tld: '.gov.in', country: 'India', confidence: 100 },
    { tld: '.nic.in', country: 'India (NIC)', confidence: 95 },
    { tld: '.gov.cn', country: 'China', confidence: 100 },
    { tld: '.gov.sg', country: 'Singapore', confidence: 100 },
    { tld: '.gov.my', country: 'Malaysia', confidence: 100 },
    { tld: '.gov.za', country: 'South Africa', confidence: 100 },
    { tld: '.gov.nz', country: 'New Zealand', confidence: 100 },
    { tld: '.gov.br', country: 'Brazil', confidence: 100 },
    { tld: '.gob.mx', country: 'Mexico', confidence: 100 },
    { tld: '.gov.ar', country: 'Argentina', confidence: 100 },
    { tld: '.gov.jp', country: 'Japan', confidence: 100 },
    { tld: '.go.jp', country: 'Japan', confidence: 100 },
    { tld: '.gouv.fr', country: 'France', confidence: 100 },
    { tld: '.gov.it', country: 'Italy', confidence: 100 },
    { tld: '.gob.es', country: 'Spain', confidence: 100 },
    { tld: '.bund.de', country: 'Germany (Federal)', confidence: 100 },
  ];

  // Well-known government domains
  private static readonly KNOWN_GOV_DOMAINS = [
    // US Federal
    { pattern: /^(www\.)?whitehouse\.gov$/i, name: 'The White House', confidence: 100 },
    { pattern: /^(www\.)?irs\.gov$/i, name: 'IRS', confidence: 100 },
    { pattern: /^(www\.)?fbi\.gov$/i, name: 'FBI', confidence: 100 },
    { pattern: /^(www\.)?cia\.gov$/i, name: 'CIA', confidence: 100 },
    { pattern: /^(www\.)?nasa\.gov$/i, name: 'NASA', confidence: 100 },
    { pattern: /^(www\.)?usa\.gov$/i, name: 'USA.gov', confidence: 100 },

    // International
    { pattern: /^(www\.)?un\.org$/i, name: 'United Nations', confidence: 100 },
    { pattern: /^(www\.)?who\.int$/i, name: 'World Health Organization', confidence: 100 },
    { pattern: /^(www\.)?europa\.eu$/i, name: 'European Union', confidence: 100 },
  ];

  // Well-known educational institutions
  private static readonly KNOWN_EDU_DOMAINS = [
    { pattern: /^(www\.)?harvard\.edu$/i, name: 'Harvard University', confidence: 100 },
    { pattern: /^(www\.)?mit\.edu$/i, name: 'MIT', confidence: 100 },
    { pattern: /^(www\.)?stanford\.edu$/i, name: 'Stanford University', confidence: 100 },
    { pattern: /^(www\.)?ox\.ac\.uk$/i, name: 'Oxford University', confidence: 100 },
    { pattern: /^(www\.)?cam\.ac\.uk$/i, name: 'Cambridge University', confidence: 100 },
  ];

  /**
   * Check if domain is government, educational, or international
   */
  async check(domain: string): Promise<GovCheckResult> {
    const evidence: string[] = [];
    let isGovernment = false;
    let isEducational = false;
    let isInternational = false;
    let type: string | undefined;
    let country: string | undefined;
    let maxConfidence = 0;

    logger.debug(`[Gov Checker] Checking: ${domain}`);

    // Check US Government TLDs
    for (const tld of GovChecker.US_GOV_TLDS) {
      if (domain.endsWith(tld)) {
        isGovernment = true;
        type = 'US Government';
        country = 'United States';
        maxConfidence = 100;
        evidence.push(`Domain uses US Government TLD: ${tld}`);
        logger.info(`[Gov Checker] US Government domain detected: ${domain}`);
        break;
      }
    }

    // Check Educational TLDs
    if (!isGovernment) {
      for (const tld of GovChecker.EDU_TLDS) {
        if (domain.endsWith(tld)) {
          isEducational = true;
          type = 'Educational Institution';
          maxConfidence = 95;
          evidence.push(`Domain uses Educational TLD: ${tld}`);
          logger.info(`[Gov Checker] Educational domain detected: ${domain}`);
          break;
        }
      }
    }

    // Check International TLDs
    if (!isGovernment && !isEducational) {
      for (const tld of GovChecker.INTL_TLDS) {
        if (domain.endsWith(tld)) {
          isInternational = true;
          type = 'International Organization';
          maxConfidence = 100;
          evidence.push(`Domain uses International TLD: ${tld}`);
          logger.info(`[Gov Checker] International organization detected: ${domain}`);
          break;
        }
      }
    }

    // Check Country-specific Government TLDs
    if (!isGovernment && !isEducational && !isInternational) {
      for (const { tld, country: govCountry, confidence } of GovChecker.COUNTRY_GOV_TLDS) {
        if (domain.endsWith(tld)) {
          isGovernment = true;
          type = 'Government';
          country = govCountry;
          maxConfidence = confidence;
          evidence.push(`Domain uses ${govCountry} Government TLD: ${tld}`);
          logger.info(`[Gov Checker] ${govCountry} Government domain detected: ${domain}`);
          break;
        }
      }
    }

    // Check Known Government Domains
    if (!isGovernment && !isEducational && !isInternational) {
      for (const { pattern, name, confidence } of GovChecker.KNOWN_GOV_DOMAINS) {
        if (pattern.test(domain)) {
          isGovernment = true;
          type = 'Government';
          maxConfidence = confidence;
          evidence.push(`Domain is known government entity: ${name}`);
          logger.info(`[Gov Checker] Known government domain: ${name}`);
          break;
        }
      }
    }

    // Check Known Educational Domains
    if (!isGovernment && !isEducational && !isInternational) {
      for (const { pattern, name, confidence } of GovChecker.KNOWN_EDU_DOMAINS) {
        if (pattern.test(domain)) {
          isEducational = true;
          type = 'Educational Institution';
          maxConfidence = confidence;
          evidence.push(`Domain is known educational institution: ${name}`);
          logger.info(`[Gov Checker] Known educational domain: ${name}`);
          break;
        }
      }
    }

    const result: GovCheckResult = {
      isGovernment,
      isEducational,
      isInternational,
      type,
      country,
      confidence: maxConfidence,
      evidence
    };

    if (isGovernment || isEducational || isInternational) {
      logger.info(`[Gov Checker] Legitimate institutional domain: ${type} (${maxConfidence}% confidence)`);
    } else {
      logger.debug(`[Gov Checker] Not a government/educational domain`);
    }

    return result;
  }

  /**
   * Get trust score based on domain type
   */
  static getTrustScore(result: GovCheckResult): number {
    if (result.isGovernment) return 100;
    if (result.isInternational) return 100;
    if (result.isEducational) return 95;
    return 0;
  }

  /**
   * Get list of supported government TLDs
   */
  static getSupportedGovTLDs(): string[] {
    return [
      ...GovChecker.US_GOV_TLDS,
      ...GovChecker.COUNTRY_GOV_TLDS.map(g => g.tld)
    ];
  }

  /**
   * Get list of supported educational TLDs
   */
  static getSupportedEduTLDs(): string[] {
    return [...GovChecker.EDU_TLDS];
  }
}
