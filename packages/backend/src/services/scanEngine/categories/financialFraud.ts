/**
 * Category 8: Financial Fraud (25 points)
 *
 * Checks:
 * - Unsecured payment forms (10 pts)
 * - Cryptocurrency scams (8 pts)
 * - Investment fraud indicators (7 pts)
 * - Fake payment processors (5 pts)
 *
 * Runs in: FULL pipeline
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class FinancialFraudCategory extends CategoryAnalyzer {
  // Payment form field patterns
  private static readonly PAYMENT_FIELD_PATTERNS = [
    /card.?number|cardnumber|cc.?number/i,
    /cvv|cvc|security.?code/i,
    /expir(y|ation)|exp.?date/i,
    /billing|payment/i
  ];

  // Cryptocurrency scam patterns
  private static readonly CRYPTO_SCAM_PATTERNS = [
    /bitcoin|btc|ethereum|eth|crypto/i,
    /send\s+(bitcoin|btc|eth|crypto)/i,
    /wallet\s+address/i,
    /invest.*crypto|crypto.*invest/i,
    /double.*bitcoin|multiply.*crypto/i,
    /\d+x\s+return|guaranteed.*profit/i
  ];

  // Investment fraud patterns
  private static readonly INVESTMENT_FRAUD_PATTERNS = [
    /forex|trading|binary\s+options/i,
    /guaranteed\s+(returns?|profit)/i,
    /risk.?free\s+investment/i,
    /\d+%\s+(daily|weekly|monthly)\s+(return|profit)/i,
    /passive\s+income|financial\s+freedom/i,
    /insider\s+(tip|trading|information)/i
  ];

  // Legitimate payment processors
  private static readonly LEGITIMATE_PAYMENT_PROCESSORS = new Set([
    'stripe', 'paypal', 'square', 'braintree', 'authorize.net',
    'adyen', 'worldpay', 'checkout.com', '2checkout'
  ]);

  // Fake payment processor indicators
  private static readonly FAKE_PAYMENT_INDICATORS = [
    /wire\s+transfer|western\s+union|moneygram/i,
    /send\s+money\s+to/i,
    /bank\s+account\s+number/i,
    /direct\s+deposit|cash\s+only/i
  ];

  // Payment processor brand detection (for impersonation check)
  private static readonly PAYMENT_PROCESSOR_BRANDS: Record<string, {
    keywords: RegExp[];
    legitimateDomains: string[];
    logoPatterns?: RegExp[];
  }> = {
    'PayPal': {
      keywords: [/paypal/i, /pay\s*pal/i],
      legitimateDomains: ['paypal.com', 'paypalobjects.com'],
      logoPatterns: [/paypal.*logo/i, /pp_.*\.(?:png|jpg|svg)/i]
    },
    'Stripe': {
      keywords: [/stripe/i, /stripe\s+checkout/i, /powered\s+by\s+stripe/i],
      legitimateDomains: ['stripe.com', 'stripe.network'],
      logoPatterns: [/stripe.*logo/i, /stripe.*icon/i]
    },
    'Square': {
      keywords: [/square/i, /square\s+checkout/i, /squareup/i],
      legitimateDomains: ['squareup.com', 'square.com'],
      logoPatterns: [/square.*logo/i]
    },
    'Venmo': {
      keywords: [/venmo/i],
      legitimateDomains: ['venmo.com'],
      logoPatterns: [/venmo.*logo/i]
    },
    'Cash App': {
      keywords: [/cash\s*app/i, /\$cashtag/i],
      legitimateDomains: ['cash.app', 'cash.me'],
      logoPatterns: [/cash.*app.*logo/i]
    }
  };

  constructor() {
    super('financialFraud', 'Financial Fraud');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.financialFraud;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;

    logger.debug(`[Financial Fraud] Analyzing for: ${context.url}`);

    // Check 1: Unsecured Payment Forms
    const paymentFindings = this.checkUnsecuredPaymentForms(
      body,
      context.urlComponents.protocol,
      config.checkWeights
    );
    findings.push(...paymentFindings);

    // Check 2: Cryptocurrency Scams
    const cryptoFindings = this.checkCryptoScams(body, config.checkWeights);
    findings.push(...cryptoFindings);

    // Check 3: Investment Fraud
    const investmentFindings = this.checkInvestmentFraud(body, config.checkWeights);
    findings.push(...investmentFindings);

    // Check 4: Fake Payment Processors
    const processorFindings = this.checkPaymentProcessors(body, config.checkWeights);
    findings.push(...processorFindings);

    // Check 5: Payment Processor Impersonation (ENHANCED - brand impersonation)
    const impersonationFindings = this.checkPaymentProcessorImpersonation(
      body,
      context.urlComponents.hostname,
      config.checkWeights
    );
    findings.push(...impersonationFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Financial Fraud] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 5,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for unsecured payment forms
   */
  private checkUnsecuredPaymentForms(
    body: string,
    protocol: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Extract input fields
    const inputFields = body.match(/<input[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi) || [];
    const fieldNames = inputFields.map(input => {
      const match = input.match(/name\s*=\s*["']([^"']+)["']/i);
      return match ? match[1].toLowerCase() : '';
    });

    // Check for payment fields
    let paymentFieldCount = 0;
    const detectedFields: string[] = [];

    for (const fieldName of fieldNames) {
      for (const pattern of FinancialFraudCategory.PAYMENT_FIELD_PATTERNS) {
        if (pattern.test(fieldName)) {
          paymentFieldCount++;
          detectedFields.push(fieldName);
          break;
        }
      }
    }

    // If collecting payment info over HTTP
    if (paymentFieldCount >= 2 && protocol === 'http') {
      findings.push(this.createFinding(
        'financial_unsecured_payment',
        'Unsecured Payment Form',
        'critical',
        weights.financial_unsecured_payment || 15,
        'Collects payment information over unencrypted HTTP',
        { protocol, fields: detectedFields }
      ));
    }

    // If collecting payment info but no legitimate payment processor detected
    if (paymentFieldCount >= 2) {
      const hasLegitProcessor = Array.from(FinancialFraudCategory.LEGITIMATE_PAYMENT_PROCESSORS).some(
        processor => body.toLowerCase().includes(processor)
      );

      if (!hasLegitProcessor) {
        findings.push(this.createFinding(
          'financial_no_payment_processor',
          'No Recognized Payment Processor',
          'high',
          weights.financial_no_payment_processor || 10,
          'Collects payment info without using recognized payment processor',
          { fields: detectedFields }
        ));
      }
    }

    return findings;
  }

  /**
   * Check for cryptocurrency scams
   */
  private checkCryptoScams(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of FinancialFraudCategory.CRYPTO_SCAM_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    // If multiple crypto scam indicators
    if (matches.length >= 3) {
      findings.push(this.createFinding(
        'financial_crypto_scam',
        'Cryptocurrency Scam Indicators',
        'high',
        weights.financial_crypto_scam || 12,
        `Found ${matches.length} cryptocurrency scam patterns`,
        { count: matches.length }
      ));
    }

    // Check for wallet addresses (simplified check)
    const hasWalletAddress = /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/.test(body) || // Bitcoin
                             /0x[a-fA-F0-9]{40}/.test(body);                 // Ethereum

    if (hasWalletAddress && matches.length >= 1) {
      findings.push(this.createFinding(
        'financial_crypto_wallet_collection',
        'Cryptocurrency Wallet Collection',
        'medium',
        weights.financial_crypto_wallet_collection || 8,
        'Requests cryptocurrency wallet addresses',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check for investment fraud
   */
  private checkInvestmentFraud(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of FinancialFraudCategory.INVESTMENT_FRAUD_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'financial_investment_fraud',
        'Investment Fraud Indicators',
        'high',
        weights.financial_investment_fraud || 10,
        `Found ${matches.length} investment scam patterns`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check payment processors
   */
  private checkPaymentProcessors(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of FinancialFraudCategory.FAKE_PAYMENT_INDICATORS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 1) {
      findings.push(this.createFinding(
        'financial_suspicious_payment_method',
        'Suspicious Payment Method',
        'medium',
        weights.financial_suspicious_payment_method || 7,
        'Requests suspicious payment methods (wire transfer, cash)',
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * ENHANCED: Check for payment processor brand impersonation
   * Detects fake PayPal, Stripe, Square, etc. payment forms
   */
  private checkPaymentProcessorImpersonation(
    body: string,
    hostname: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];
    const hostnameLower = hostname.toLowerCase();

    for (const [brandName, brandConfig] of Object.entries(FinancialFraudCategory.PAYMENT_PROCESSOR_BRANDS)) {
      // Check if page mentions this payment processor brand
      let brandMentioned = false;
      let keywordMatches = 0;

      for (const keyword of brandConfig.keywords) {
        if (keyword.test(body)) {
          brandMentioned = true;
          keywordMatches++;
        }
      }

      if (!brandMentioned) continue;

      // Check if domain is legitimate
      const isLegitDomain = brandConfig.legitimateDomains.some(domain =>
        hostnameLower.includes(domain)
      );

      if (isLegitDomain) continue; // Skip legitimate sites

      // Check for logo/branding elements
      let hasLogo = false;
      if (brandConfig.logoPatterns) {
        for (const logoPattern of brandConfig.logoPatterns) {
          if (logoPattern.test(body)) {
            hasLogo = true;
            break;
          }
        }
      }

      // Check for payment form fields (indicates this is a payment page)
      const hasPaymentFields = FinancialFraudCategory.PAYMENT_FIELD_PATTERNS.some(pattern =>
        pattern.test(body)
      );

      // If brand mentioned + (has logo OR has payment fields), it's likely impersonation
      if (hasLogo || hasPaymentFields) {
        const severity = hasPaymentFields ? 'critical' : 'high';
        const score = hasPaymentFields ? 25 : 18;

        findings.push(this.createFinding(
          'financial_payment_processor_impersonation',
          'Payment Processor Impersonation',
          severity,
          weights.financial_payment_processor_impersonation || score,
          `Page impersonates ${brandName} payment processor on non-${brandName} domain`,
          {
            brand: brandName,
            hostname,
            legitimateDomains: brandConfig.legitimateDomains,
            hasLogo,
            hasPaymentFields,
            keywordMatches
          }
        ));
        break; // Only report first match
      }
    }

    return findings;
  }
}
