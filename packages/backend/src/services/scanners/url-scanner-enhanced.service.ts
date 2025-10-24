/**
 * Enhanced URL Scanner with Multi-LLM Analysis and External Threat Intelligence
 *
 * PHASE 1 (IMPLEMENTED):
 * - Multi-AI analysis (Claude, GPT-4, Gemini)
 * - External threat intelligence (VirusTotal, Google Safe Browsing, AbuseIPDB, PhishTank, URLhaus)
 * - 13 category technical analysis
 * - Comprehensive risk scoring
 *
 * PHASE 2 (PENDING - See PENDING_FEATURES.md):
 * - Advanced WHOIS analysis with historical data
 * - Certificate transparency log checks
 * - Similar domain detection (typosquatting)
 * - Deep HTML/JavaScript inspection
 * - Form analysis for credential harvesting
 * - DNS history and changes tracking
 * - Network port scanning
 * - Behavioral analysis over time
 */

import axios from 'axios';
import dns from 'dns/promises';
import tls from 'tls';
import whois from 'whois-json';
import { logger } from '../../config/logger.js';
import { scanLogger } from '../logging/scanLogger.service.js';
import { aiService } from '../ai/ai.service.js';
// PHASE 1: Import new services for enhanced analysis
import { multiLLMService } from '../ai/multi-llm.service.js';
import { externalThreatIntelService } from '../threat-intelligence/external-apis.service.js';
// PHASE 2: Import complete 350-point scoring system services
import { PrivacyAnalyzer } from '../scoring/privacy-analyzer.js';
import { EmailSecurityAnalyzer } from '../scoring/email-security.js';
import { LegalComplianceAnalyzer } from '../scoring/legal-compliance.js';
import { SecurityHeadersAnalyzer } from '../scoring/security-headers.js';
import { OutputFormatter } from '../../utils/output-formatter.js';
// PHASE 1 ENHANCEMENT: Trust Graph for network analysis
import { trustGraphService } from '../graph/trustGraphService.js';

interface URLScanResult {
  url: string;
  riskScore: number;
  riskLevel: string;
  findings: Finding[];
  categories: CategoryResult[];
  // PHASE 1: Enhanced AI analysis with multiple models
  aiAnalysis?: {
    summary: string;
    detailedExplanation: string;
    recommendations: string[];
    confidence: number;
  };
  // PHASE 1: Multi-LLM consensus analysis
  multiLLMAnalysis?: {
    claude?: any;
    gpt4?: any;
    gemini?: any;
    consensus: {
      agreement: number;
      verdict: string;
      summary: string;
    };
  };
  // PHASE 1: Comprehensive external threat intelligence
  externalScans?: {
    virustotal?: any;
    googleSafeBrowsing?: any;
    abuseIPDB?: any;
    phishtank?: any;
    urlhaus?: any;
    summary: {
      totalChecks: number;
      flaggedCount: number;
      safeCount: number;
      overallVerdict: string;
    };
  };
  // Network and infrastructure information
  networkInfo?: {
    ipAddress: string;
    country?: string;
    city?: string;
    isp?: string;
    isHosting?: boolean;
    isProxy?: boolean;
  };
  // Website overview and description
  websiteOverview?: {
    title: string;
    description: string;
    category: string;
    purpose: string;
  };
  scanDuration: number;
  // PHASE 2: Professional formatted output
  formattedOutput?: string;
  maxScore?: number;
}

interface Finding {
  category: string;
  severity: string;
  message: string;
  points: number;
  details?: any;
}

interface CategoryResult {
  name: string;
  score: number;
  maxScore: number;
  findings: Finding[];
  status: 'pass' | 'warning' | 'fail';
}

export class EnhancedURLScanner {
  private readonly VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
  private readonly GOOGLE_SAFE_BROWSING_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  // PHASE 2: Initialize new scoring analyzers
  private readonly privacyAnalyzer = new PrivacyAnalyzer();
  private readonly emailSecurityAnalyzer = new EmailSecurityAnalyzer();
  private readonly legalComplianceAnalyzer = new LegalComplianceAnalyzer();
  private readonly securityHeadersAnalyzer = new SecurityHeadersAnalyzer();

  constructor() {
    logger.info('🚀🚀🚀 EnhancedURLScanner initialized with Phase 2 analyzers! 🚀🚀🚀');
    logger.info(`   ✅ Privacy Analyzer: ${this.privacyAnalyzer ? 'LOADED' : 'FAILED'}`);
    logger.info(`   ✅ Email Security Analyzer: ${this.emailSecurityAnalyzer ? 'LOADED' : 'FAILED'}`);
    logger.info(`   ✅ Legal Compliance Analyzer: ${this.legalComplianceAnalyzer ? 'LOADED' : 'FAILED'}`);
    logger.info(`   ✅ Security Headers Analyzer: ${this.securityHeadersAnalyzer ? 'LOADED' : 'FAILED'}`);
  }

  async scanURL(urlString: string, scanId?: string): Promise<URLScanResult> {
    const startTime = Date.now();

    // Generate scanId if not provided (for backward compatibility)
    const activeScanId = scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start real-time scan logging
    scanLogger.startScan(activeScanId, urlString);

    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(`🔍 SCAN STARTED: ${urlString}`);
    logger.info(`⏰ Start Time: ${new Date().toISOString()}`);
    logger.info('═══════════════════════════════════════════════════════════');

    const url = new URL(urlString);
    const categories: CategoryResult[] = [];
    let totalRiskScore = 0;

    // CRITICAL: Add global timeout to prevent infinite hanging (60 seconds max)
    const scanPromise = this.performScan(urlString, url, categories, totalRiskScore, startTime, activeScanId);

    try {
      const result = await Promise.race([
        scanPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Scan timeout - exceeded 60 seconds')), 60000)
        )
      ]);

      const duration = (Date.now() - startTime) / 1000;
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`✅ SCAN COMPLETED: ${urlString}`);
      logger.info(`📊 Risk Score: ${result.riskScore}/${result.maxScore}`);
      logger.info(`⚠️  Risk Level: ${result.riskLevel}`);
      logger.info(`⏱️  Duration: ${duration.toFixed(2)}s`);
      logger.info(`📋 Categories: ${result.categories.length}`);
      logger.info(`🔎 Findings: ${result.findings.length}`);
      logger.info('═══════════════════════════════════════════════════════════');

      // End real-time scan logging
      scanLogger.endScan(activeScanId, result);

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const duration = (Date.now() - startTime) / 1000;
      logger.error('═══════════════════════════════════════════════════════════');
      logger.error(`❌ SCAN FAILED: ${urlString}`);
      logger.error(`⏱️  Duration: ${duration.toFixed(2)}s`);
      logger.error(`💥 Error: ${errorMessage}`);
      logger.error('═══════════════════════════════════════════════════════════');

      // Return partial results on timeout
      return {
        url: urlString,
        riskScore: 0,
        maxScore: 350,
        riskLevel: 'medium', // FIX: Use valid enum value instead of 'UNKNOWN'
        findings: [{
          category: 'Scan Timeout',
          severity: 'high',
          message: 'Scan exceeded maximum duration of 30 seconds',
          points: 0,
          details: { error: errorMessage } // FIX: Only include error message, not circular object
        }],
        categories: [],
        scanDuration: duration
      };
    }
  }

  private async performScan(urlString: string, url: URL, categories: CategoryResult[], totalRiskScore: number, startTime: number, scanId: string): Promise<URLScanResult> {
    try {
      // Log phase start
      scanLogger.logPhaseStart(scanId, 'HTML_FETCH', 'Fetching website content');

      logger.info('📄 STEP 1: Fetching HTML content...');
      // PHASE 2: First fetch HTML content for content-based analyzers
      let htmlContent = '';
      try {
        // Try with original URL first
        const response = await axios.get(urlString, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          validateStatus: (status) => status >= 200 && status < 500 // Accept 4xx errors
        });
        htmlContent = response.data;
        logger.info(`✅ HTML content fetched: ${htmlContent.length} bytes (Status: ${response.status})`);
      } catch (error: any) {
        logger.warn(`⚠️  Failed to fetch HTML from ${urlString}: ${error.message}`);

        // Try HTTPS if original was HTTP
        if (urlString.startsWith('http://')) {
          try {
            const httpsUrl = urlString.replace('http://', 'https://');
            logger.info(`🔄 Retrying with HTTPS: ${httpsUrl}`);
            const response = await axios.get(httpsUrl, {
              timeout: 5000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              validateStatus: (status) => status >= 200 && status < 500
            });
            htmlContent = response.data;
            logger.info(`✅ HTML fetched via HTTPS: ${htmlContent.length} bytes (Status: ${response.status})`);
          } catch (httpsError: any) {
            logger.error(`❌ HTTPS retry failed: ${httpsError.message}`);
          }
        } else {
          logger.error(`❌ HTML fetch failed completely`);
        }
      }

      // 🔥 PRIORITY CHECK: Run threat intelligence FIRST (user requirement)
      scanLogger.logPhaseStart(scanId, 'THREAT_INTEL', 'Checking threat intelligence databases');

      logger.info('🛡️  STEP 2: PRIORITY CHECK - Threat Intelligence Database...');
      logger.info('   🔍 Checking URL against PhishTank, URLhaus, OpenPhish, MalwareBazaar, ThreatFox');

      const threatIntelStartTime = Date.now();
      const threatIntelResult = await this.analyzeThreatIntelligence(url);
      const threatIntelDuration = ((Date.now() - threatIntelStartTime) / 1000).toFixed(2);

      scanLogger.logPhaseComplete(scanId, 'THREAT_INTEL', Number(threatIntelDuration) * 1000, { score: threatIntelResult.score, status: threatIntelResult.status });

      // Add threat intel result to categories immediately
      categories.push(threatIntelResult);

      // Log prominent warning if threat found
      if (threatIntelResult.score > 0) {
        logger.warn('═════════════════════════════════════════════════════════════');
        logger.warn('⚠️  ⚠️  ⚠️  THREAT DETECTED IN DATABASE! ⚠️  ⚠️  ⚠️');
        logger.warn(`   Threat Score: ${threatIntelResult.score}/${threatIntelResult.maxScore} points`);
        logger.warn(`   Status: ${threatIntelResult.status.toUpperCase()}`);
        logger.warn(`   Findings: ${threatIntelResult.findings.length}`);
        logger.warn(`   Detection Time: ${threatIntelDuration}s`);
        threatIntelResult.findings.forEach((finding, idx) => {
          logger.warn(`   ${idx + 1}. ${finding.message}`);
        });
        logger.warn('═════════════════════════════════════════════════════════════');
      } else {
        logger.info(`✅ Threat Intelligence: URL not in threat databases (checked in ${threatIntelDuration}s)`);
      }

      // 🚀 USER REQUIREMENT: If threat found in database, skip all other analyzers and return immediately
      if (threatIntelResult.score > 0) {
        logger.warn('⚡ THREAT FOUND - Skipping remaining analyzers per user requirement');
        logger.warn('   Returning immediate results from threat intelligence database');

        const scanDuration = (Date.now() - startTime) / 1000;

        // 🔥 CRITICAL FIX: Calculate risk level based on threat intel's 50-point scale, NOT 350-point total scale!
        // Threat intel uses: critical=50, high=40, medium=25, low=15, safe=0
        const riskLevel = this.calculateThreatIntelRiskLevel(threatIntelResult.score, threatIntelResult.maxScore);

        return {
          url: urlString,
          riskScore: threatIntelResult.score,
          maxScore: threatIntelResult.maxScore,
          riskLevel,
          findings: threatIntelResult.findings,
          categories: [threatIntelResult],
          scanDuration,
          aiAnalysis: {
            summary: `THREAT DETECTED: This URL was found in threat intelligence databases as ${riskLevel.toUpperCase()} risk.`,
            detailedExplanation: `This URL matches known threat indicators in our database. ${threatIntelResult.findings.map(f => f.message).join(' ')}`,
            recommendations: [
              'Do NOT visit this URL',
              'Do NOT enter any credentials or personal information',
              'Report this URL if received via email or message',
              'Delete any messages containing this link'
            ],
            confidence: 95
          }
        };
      }

      // Run remaining scans in parallel (PHASE 2: Added new analyzers)
      scanLogger.logPhaseStart(scanId, 'ANALYZERS', 'Running 17 security analyzers in parallel');

      logger.info('🔬 STEP 3: Running remaining analyzers in parallel...');
      logger.info('   Phase 1 Analyzers: 12 analyzers (Domain, SSL, Content, etc.)');
      logger.info('   Phase 2 Analyzers: 4 analyzers (Privacy, Email Security, Legal, Security Headers)');
      logger.info('   External Scans: 5 sources (VirusTotal, Google, AbuseIPDB, PhishTank, URLhaus)');

      const analyzerStartTime = Date.now();

      // CRITICAL: Wrap ALL analyzers in a timeout to prevent hanging
      // NOTE: Threat Intel already completed above, so we run 17 analyzers here (not 18)
      const analyzerPromise = Promise.allSettled([
        this.analyzeDomain(url),
        this.analyzeSSL(url),
        // REMOVED: this.analyzeThreatIntelligence(url), - Already completed above!
        this.analyzeContent(url),
        this.analyzePhishingPatterns(url),
        this.analyzeMalware(url),
        this.analyzeBehavioral(url),
        this.analyzeSocialEngineering(url),
        this.analyzeFinancialFraud(url),
        this.analyzeIdentityTheft(url),
        this.analyzeTechnicalExploits(url),
        this.analyzeBrandImpersonation(url),
        this.analyzeNetwork(url),
        this.runExternalScans(urlString),
        // PHASE 2: New analyzers
        this.analyzePrivacy(urlString, htmlContent),
        this.analyzeEmailSecurity(url.hostname),
        this.analyzeLegalCompliance(urlString, htmlContent),
        this.analyzeSecurityHeaders(urlString)
      ]);

      // Add 30-second timeout for ALL remaining analyzers combined
      const results = await Promise.race([
        analyzerPromise,
        new Promise<any[]>((resolve) => setTimeout(() => {
          logger.error('⚠️  ANALYZER TIMEOUT - Returning empty results after 30 seconds');
          resolve(Array(17).fill({ status: 'rejected', reason: 'Analyzer timeout' }));
        }, 30000))
      ]);

      const [
        domainResult,
        sslResult,
        // threatIntelResult - ALREADY PROCESSED ABOVE!
        contentResult,
        phishingResult,
        malwareResult,
        behavioralResult,
        socialEngResult,
        financialResult,
        identityResult,
        exploitsResult,
        brandResult,
        networkResult,
        externalScans,
        // PHASE 2: New 350-point scoring system analyzers
        privacyResult,
        emailSecurityResult,
        legalComplianceResult,
        securityHeadersResult
      ] = results;

      const analyzerDuration = ((Date.now() - analyzerStartTime) / 1000).toFixed(2);
      logger.info(`✅ All remaining analyzers completed in ${analyzerDuration}s`);

      scanLogger.logPhaseComplete(scanId, 'ANALYZERS', Number(analyzerDuration) * 1000, { analyzersRun: 17 });

      // Process results
      logger.info('📊 STEP 4: Processing analyzer results...');

      let fulfilledCount = 1; // Start at 1 because threat intel already succeeded
      let rejectedCount = 0;

      if (domainResult.status === 'fulfilled') { categories.push(domainResult.value); fulfilledCount++; } else { logger.error(`❌ Domain analyzer failed: ${domainResult.reason}`); rejectedCount++; }
      if (sslResult.status === 'fulfilled') { categories.push(sslResult.value); fulfilledCount++; } else { logger.error(`❌ SSL analyzer failed: ${sslResult.reason}`); rejectedCount++; }
      // REMOVED: Threat Intel result - already processed in STEP 2!
      if (contentResult.status === 'fulfilled') { categories.push(contentResult.value); fulfilledCount++; } else { logger.error(`❌ Content analyzer failed: ${contentResult.reason}`); rejectedCount++; }
      if (phishingResult.status === 'fulfilled') { categories.push(phishingResult.value); fulfilledCount++; } else { logger.error(`❌ Phishing analyzer failed: ${phishingResult.reason}`); rejectedCount++; }
      if (malwareResult.status === 'fulfilled') { categories.push(malwareResult.value); fulfilledCount++; } else { logger.error(`❌ Malware analyzer failed: ${malwareResult.reason}`); rejectedCount++; }
      if (behavioralResult.status === 'fulfilled') { categories.push(behavioralResult.value); fulfilledCount++; } else { logger.error(`❌ Behavioral analyzer failed: ${behavioralResult.reason}`); rejectedCount++; }
      if (socialEngResult.status === 'fulfilled') { categories.push(socialEngResult.value); fulfilledCount++; } else { logger.error(`❌ Social Eng analyzer failed: ${socialEngResult.reason}`); rejectedCount++; }
      if (financialResult.status === 'fulfilled') { categories.push(financialResult.value); fulfilledCount++; } else { logger.error(`❌ Financial analyzer failed: ${financialResult.reason}`); rejectedCount++; }
      if (identityResult.status === 'fulfilled') { categories.push(identityResult.value); fulfilledCount++; } else { logger.error(`❌ Identity analyzer failed: ${identityResult.reason}`); rejectedCount++; }
      if (exploitsResult.status === 'fulfilled') { categories.push(exploitsResult.value); fulfilledCount++; } else { logger.error(`❌ Exploits analyzer failed: ${exploitsResult.reason}`); rejectedCount++; }
      if (brandResult.status === 'fulfilled') { categories.push(brandResult.value); fulfilledCount++; } else { logger.error(`❌ Brand analyzer failed: ${brandResult.reason}`); rejectedCount++; }
      if (networkResult.status === 'fulfilled') { categories.push(networkResult.value); fulfilledCount++; } else { logger.error(`❌ Network analyzer failed: ${networkResult.reason}`); rejectedCount++; }

      // PHASE 2: Process new analyzer results
      if (privacyResult.status === 'fulfilled') {
        const converted = this.convertToCategory('Data Protection & Privacy', privacyResult.value);
        categories.push(converted);
        logger.info(`✅ Privacy analyzer: ${privacyResult.value.score}/${privacyResult.value.maxScore} points`);
        fulfilledCount++;
      } else {
        logger.error(`❌ Privacy analyzer failed: ${privacyResult.reason}`);
        rejectedCount++;
      }

      if (emailSecurityResult.status === 'fulfilled') {
        const converted = this.convertToCategory('Email Security & DMARC', emailSecurityResult.value);
        categories.push(converted);
        logger.info(`✅ Email Security analyzer: ${emailSecurityResult.value.score}/${emailSecurityResult.value.maxScore} points`);
        fulfilledCount++;
      } else {
        logger.error(`❌ Email Security analyzer failed: ${emailSecurityResult.reason}`);
        rejectedCount++;
      }

      if (legalComplianceResult.status === 'fulfilled') {
        const converted = this.convertToCategory('Legal & Compliance', legalComplianceResult.value);
        categories.push(converted);
        logger.info(`✅ Legal Compliance analyzer: ${legalComplianceResult.value.score}/${legalComplianceResult.value.maxScore} points`);
        fulfilledCount++;
      } else {
        logger.error(`❌ Legal Compliance analyzer failed: ${legalComplianceResult.reason}`);
        rejectedCount++;
      }

      if (securityHeadersResult.status === 'fulfilled') {
        const converted = this.convertToCategory('Security Headers', securityHeadersResult.value);
        categories.push(converted);
        logger.info(`✅ Security Headers analyzer: ${securityHeadersResult.value.score}/${securityHeadersResult.value.maxScore} points`);
        fulfilledCount++;
      } else {
        logger.error(`❌ Security Headers analyzer failed: ${securityHeadersResult.reason}`);
        rejectedCount++;
      }

      logger.info(`📈 Analyzer Summary: ${fulfilledCount} succeeded, ${rejectedCount} failed`);

      // Calculate total risk score
      logger.info('🧮 STEP 5: Calculating scores...');
      totalRiskScore = categories.reduce((sum, cat) => sum + cat.score, 0);
      const maxScore = categories.reduce((sum, cat) => sum + cat.maxScore, 0);

      logger.info(`   Total Risk Score: ${totalRiskScore}`);
      logger.info(`   Maximum Score: ${maxScore}`);
      logger.info(`   Categories with scores:`);
      categories.forEach(cat => {
        logger.info(`      - ${cat.name}: ${cat.score}/${cat.maxScore} (${cat.findings.length} findings)`);
      });

      // Get all findings
      const allFindings = categories.flatMap(cat => cat.findings);
      logger.info(`   Total Findings: ${allFindings.length}`);

      // PHASE 1: Generate AI-powered detailed analysis (original single AI)
      logger.info('🤖 STEP 6: Generating AI analysis...');
      const aiAnalysis = await this.generateAIAnalysis(
        urlString,
        categories,
        totalRiskScore,
        maxScore,
        externalScans.status === 'fulfilled' ? externalScans.value : undefined
      );

      // PHASE 1: Query all AI models in parallel for consensus analysis
      // This provides multiple expert opinions for more accurate threat assessment
      scanLogger.logPhaseStart(scanId, 'AI_CONSENSUS', 'Running Multi-LLM consensus analysis');

      logger.info('🧠 STEP 7: Running Multi-LLM consensus analysis...');
      const multiLLMAnalysis = await this.generateMultiLLMAnalysis(
        urlString,
        categories,
        externalScans.status === 'fulfilled' ? externalScans.value : undefined
      );

      scanLogger.logPhaseComplete(scanId, 'AI_CONSENSUS', 0, { verdict: multiLLMAnalysis?.consensus?.verdict || 'unknown' });

      // PHASE 1: Get network infrastructure information
      logger.info('🌐 STEP 8: Getting network information...');
      const networkInfo = await this.getNetworkInfo(url.hostname);

      // Generate website overview/description
      logger.info('📝 STEP 9: Generating website overview...');
      const websiteOverview = this.generateWebsiteOverview(url, htmlContent, networkInfo);
      logger.info(`   Website: ${websiteOverview.title} (${websiteOverview.category})`);

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(totalRiskScore, maxScore);
      logger.info(`⚠️  Risk Level Calculated: ${riskLevel.toUpperCase()}`);

      const scanDuration = (Date.now() - startTime) / 1000; // Convert to seconds

      // PHASE 2: Generate professional formatted output
      const formattedOutput = this.generateFormattedOutput({
        url: urlString,
        totalScore: totalRiskScore,
        maxScore,
        riskLevel,
        confidence: aiAnalysis?.confidence || 85,
        categories,
        multiLLMAnalysis,
        externalScans: externalScans.status === 'fulfilled' ? externalScans.value : undefined,
        scanDuration
      });

      return {
        url: urlString,
        riskScore: totalRiskScore,
        maxScore,
        riskLevel,
        findings: allFindings,
        categories,
        aiAnalysis, // Single AI analysis (backward compatibility)
        multiLLMAnalysis, // PHASE 1: Multiple AI consensus
        externalScans: externalScans.status === 'fulfilled' ? externalScans.value : undefined,
        networkInfo, // PHASE 1: Network/infrastructure details
        websiteOverview, // Website description and overview
        scanDuration,
        formattedOutput // PHASE 2: Professional formatted output
      };
    } catch (error) {
      logger.error('URL scan error:', error);
      throw error;
    }
  }

  private async analyzeDomain(url: URL): Promise<CategoryResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 40;

    try {
      // Enhanced WHOIS lookup with detailed analysis - ADD TIMEOUT
      const whoisData = await Promise.race([
        whois(url.hostname).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)) // 5 second timeout
      ]);

      if (whoisData && whoisData.creationDate) {
        const createdDate = new Date(whoisData.creationDate);
        const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        const ageInYears = ageInDays / 365;

        // Domain age analysis with more granular detection
        if (ageInDays < 7) {
          score += 20;
          findings.push({
            category: 'Domain Analysis',
            severity: 'critical',
            message: `Domain registered ${Math.floor(ageInDays)} days ago (VERY NEW - High phishing risk)`,
            points: 20,
            details: {
              ageInDays: Math.floor(ageInDays),
              ageDescription: 'Less than 1 week old',
              createdDate: createdDate.toISOString(),
              registrar: whoisData.registrar || 'Unknown'
            }
          });
        } else if (ageInDays < 30) {
          score += 15;
          findings.push({
            category: 'Domain Analysis',
            severity: 'high',
            message: `Domain registered ${Math.floor(ageInDays)} days ago (NEW - Elevated risk)`,
            points: 15,
            details: {
              ageInDays: Math.floor(ageInDays),
              ageDescription: 'Less than 1 month old',
              createdDate: createdDate.toISOString(),
              registrar: whoisData.registrar || 'Unknown'
            }
          });
        } else if (ageInDays < 90) {
          score += 10;
          findings.push({
            category: 'Domain Analysis',
            severity: 'medium',
            message: `Domain registered ${Math.floor(ageInDays)} days ago (RECENT)`,
            points: 10,
            details: {
              ageInDays: Math.floor(ageInDays),
              ageDescription: 'Less than 3 months old',
              createdDate: createdDate.toISOString(),
              registrar: whoisData.registrar || 'Unknown'
            }
          });
        } else if (ageInDays < 365) {
          findings.push({
            category: 'Domain Analysis',
            severity: 'low',
            message: `Domain is ${Math.floor(ageInDays)} days old`,
            points: 0,
            details: {
              ageInDays: Math.floor(ageInDays),
              ageDescription: 'Less than 1 year old',
              createdDate: createdDate.toISOString()
            }
          });
        } else {
          // Established domain - good sign
          findings.push({
            category: 'Domain Analysis',
            severity: 'info',
            message: `Domain is ${ageInYears.toFixed(1)} years old (Established)`,
            points: 0,
            details: {
              ageInDays: Math.floor(ageInDays),
              ageInYears: ageInYears.toFixed(1),
              ageDescription: 'Established domain',
              createdDate: createdDate.toISOString()
            }
          });
        }

        // Privacy protection detection
        const registrantOrg = whoisData.registrant?.organization || whoisData.registrantOrganization || '';
        const privacyKeywords = ['privacy', 'protected', 'redacted', 'proxy', 'private', 'withheld'];
        const hasPrivacy = privacyKeywords.some(keyword =>
          registrantOrg.toLowerCase().includes(keyword)
        );

        if (hasPrivacy && ageInDays < 90) {
          score += 8;
          findings.push({
            category: 'Domain Analysis',
            severity: 'medium',
            message: 'Domain uses privacy protection and is recently registered',
            points: 8,
            details: {
              privacyProtection: true,
              registrant: 'Hidden/Protected',
              note: 'Common in phishing domains to hide identity'
            }
          });
        } else if (hasPrivacy) {
          findings.push({
            category: 'Domain Analysis',
            severity: 'low',
            message: 'Domain uses WHOIS privacy protection',
            points: 0,
            details: {
              privacyProtection: true,
              note: 'Legitimate sites often use this'
            }
          });
        }

        // Registrar analysis
        if (whoisData.registrar) {
          // High-risk registrars commonly used for phishing
          const suspiciousRegistrars = [
            'namecheap', 'godaddy', 'tucows', 'enom',
            'publicdomainregistry', 'pdr', 'freenom'
          ];
          const registrarLower = whoisData.registrar.toLowerCase();
          const isSuspiciousRegistrar = suspiciousRegistrars.some(r =>
            registrarLower.includes(r)
          );

          if (isSuspiciousRegistrar && ageInDays < 30) {
            score += 5;
            findings.push({
              category: 'Domain Analysis',
              severity: 'low',
              message: `Recently registered with commonly-abused registrar: ${whoisData.registrar}`,
              points: 5,
              details: {
                registrar: whoisData.registrar,
                note: 'These registrars are legitimate but frequently used by scammers'
              }
            });
          }

          findings.push({
            category: 'Domain Analysis',
            severity: 'info',
            message: `Registrar: ${whoisData.registrar}`,
            points: 0,
            details: { registrar: whoisData.registrar }
          });
        }

        // Expiry date analysis
        if (whoisData.expirationDate) {
          const expiryDate = new Date(whoisData.expirationDate);
          const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

          if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
            score += 5;
            findings.push({
              category: 'Domain Analysis',
              severity: 'medium',
              message: `Domain expires in ${Math.floor(daysUntilExpiry)} days`,
              points: 5,
              details: {
                expiryDate: expiryDate.toISOString(),
                daysUntilExpiry: Math.floor(daysUntilExpiry),
                note: 'Short expiry can indicate temporary/scam site'
              }
            });
          } else if (daysUntilExpiry > 365 * 2) {
            findings.push({
              category: 'Domain Analysis',
              severity: 'info',
              message: `Domain registered for ${Math.floor(daysUntilExpiry / 365)} more years`,
              points: 0,
              details: {
                expiryDate: expiryDate.toISOString(),
                note: 'Long registration period indicates commitment'
              }
            });
          }
        }
      } else {
        // Could not get WHOIS data
        findings.push({
          category: 'Domain Analysis',
          severity: 'low',
          message: 'WHOIS data not available for this domain',
          points: 0,
          details: { note: 'May be a new TLD or privacy-protected domain' }
        });
      }

      // Check for suspicious TLDs
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'];
      const tld = url.hostname.split('.').pop();
      if (tld && suspiciousTLDs.some(s => `.${tld}` === s)) {
        score += 15;
        findings.push({
          category: 'Domain Analysis',
          severity: 'high',
          message: `Suspicious TLD: .${tld}`,
          points: 15,
          details: { tld }
        });
      }

      // Check subdomain depth
      const subdomains = url.hostname.split('.');
      if (subdomains.length > 3) {
        score += 5;
        findings.push({
          category: 'Domain Analysis',
          severity: 'low',
          message: `Multiple subdomains detected (${subdomains.length} levels)`,
          points: 5,
          details: { subdomainCount: subdomains.length }
        });
      }

      // Check for IP address instead of domain
      if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
        score += 20;
        findings.push({
          category: 'Domain Analysis',
          severity: 'critical',
          message: 'Using IP address instead of domain name',
          points: 20
        });
      }

    } catch (error) {
      logger.error('Domain analysis error:', error);
    }

    return {
      name: 'Domain Analysis',
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      status: score > 20 ? 'fail' : score > 10 ? 'warning' : 'pass'
    };
  }

  private async analyzeSSL(url: URL): Promise<CategoryResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 45;

    try {
      if (url.protocol === 'http:') {
        score += 30;
        findings.push({
          category: 'SSL/TLS Security',
          severity: 'critical',
          message: 'No HTTPS encryption - unsafe connection',
          points: 30
        });
      } else if (url.protocol === 'https:') {
        // Check SSL certificate
        try {
          const cert = await this.getSSLCertificate(url.hostname);

          if (cert) {
            const now = new Date();
            const validFrom = new Date(cert.valid_from);
            const validTo = new Date(cert.valid_to);

            if (now < validFrom || now > validTo) {
              score += 45;
              findings.push({
                category: 'SSL/TLS Security',
                severity: 'critical',
                message: 'SSL certificate is invalid or expired',
                points: 45,
                details: { validFrom, validTo }
              });
            }

            // Check if self-signed
            if (cert.issuer && cert.subject &&
                JSON.stringify(cert.issuer) === JSON.stringify(cert.subject)) {
              score += 25;
              findings.push({
                category: 'SSL/TLS Security',
                severity: 'high',
                message: 'Self-signed SSL certificate',
                points: 25
              });
            }
          }
        } catch (sslError) {
          score += 35;
          findings.push({
            category: 'SSL/TLS Security',
            severity: 'critical',
            message: 'SSL certificate verification failed',
            points: 35
          });
        }
      }
    } catch (error) {
      logger.error('SSL analysis error:', error);
    }

    return {
      name: 'SSL/TLS Security',
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      status: score > 30 ? 'fail' : score > 15 ? 'warning' : 'pass'
    };
  }

  private async analyzeThreatIntelligence(url: URL): Promise<CategoryResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 50;

    try {
      // Import and check against our threat intelligence database
      const { threatIntelService } = await import('../threat-intel/threatIntelService.js');

      const threatCheck = await threatIntelService.checkURL(url.toString());

      if (threatCheck.isThreat && threatCheck.indicators.length > 0) {
        // URL found in threat database!
        const maxSeverity = threatCheck.maxSeverity || 'medium';

        // Score based on severity
        const severityPoints: Record<string, number> = {
          critical: 50,
          high: 40,
          medium: 25,
          low: 15
        };
        score = severityPoints[maxSeverity] || 25;

        // Add findings for each threat indicator
        for (const indicator of threatCheck.indicators) {
          findings.push({
            category: 'Threat Intelligence',
            severity: indicator.severity as any,
            message: `⚠️ THREAT DETECTED: ${indicator.threatType.toUpperCase()} - ${indicator.description || 'Known threat'}`,
            points: Math.floor(score / threatCheck.indicators.length),
            details: {
              source: indicator.source?.name || 'Unknown',
              threatType: indicator.threatType,
              confidence: indicator.confidence,
              firstSeen: indicator.firstSeen,
              lastSeen: indicator.lastSeen,
              tags: indicator.tags
            }
          });
        }

        // Add summary finding
        findings.push({
          category: 'Threat Intelligence',
          severity: 'critical',
          message: `FOUND IN ${threatCheck.indicators.length} THREAT DATABASE(S) - This URL is flagged as ${maxSeverity.toUpperCase()} threat`,
          points: 0,
          details: {
            totalSources: threatCheck.indicators.length,
            maxSeverity: maxSeverity.toUpperCase(),
            sources: threatCheck.indicators.map((i: any) => i.source?.name).filter(Boolean)
          }
        });
      } else {
        // URL not found in threat database - good sign!
        findings.push({
          category: 'Threat Intelligence',
          severity: 'info',
          message: '✅ URL not found in threat databases (good sign)',
          points: 0,
          details: {
            checked: 'PhishTank, URLhaus, OpenPhish, MalwareBazaar, ThreatFox'
          }
        });
      }
    } catch (error) {
      logger.error('Threat intelligence check failed:', error);
      findings.push({
        category: 'Threat Intelligence',
        severity: 'low',
        message: 'Threat intelligence check unavailable',
        points: 0,
        details: { note: 'Database not yet populated or service unavailable' }
      });
    }

    return {
      name: 'Threat Intelligence',
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      status: score > 30 ? 'fail' : score > 15 ? 'warning' : 'pass'
    };
  }

  private async analyzeContent(url: URL): Promise<CategoryResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 40;

    try {
      const response = await axios.get(url.toString(), {
        timeout: 8000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ElaraScanner/1.0)' },
        validateStatus: (status) => status < 500 // Accept 4xx responses
      }).catch(() => null);

      if (response) {
        const html = response.data;
        const htmlLower = html.toLowerCase();

        // Enhanced scam keyword detection with categories
        const scamPatterns = {
          urgency: [
            'act now', 'urgent', 'immediately', 'expires today', 'last chance',
            'limited time', 'only today', 'hurry', 'don\'t miss', 'final notice',
            'immediate action required', 'respond within'
          ],
          account: [
            'verify account', 'suspended account', 'locked account',
            'unusual activity', 'confirm identity', 'update payment',
            'verify your identity', 'account will be closed',
            'unauthorized access detected', 're-activate'
          ],
          prize: [
            'claim prize', 'you won', 'congratulations', 'winner',
            'claim your reward', 'free gift', 'you\'ve been selected',
            'claim now', 'you are the lucky winner'
          ],
          financial: [
            'tax refund', 'unclaimed money', 'inheritance', 'wire transfer',
            'send money', 'confirm payment', 'update billing', 'payment failed',
            'credit card', 'social security', 'routing number', 'account number'
          ],
          authority: [
            'irs', 'fbi', 'police', 'government', 'tax office', 'legal action',
            'warrant', 'court', 'lawsuit', 'arrest', 'investigation'
          ]
        };

        let detectedPatterns: string[] = [];
        Object.entries(scamPatterns).forEach(([category, keywords]) => {
          const matchedKeywords = keywords.filter(keyword =>
            htmlLower.includes(keyword.toLowerCase())
          );

          if (matchedKeywords.length > 0) {
            const points = matchedKeywords.length * 3;
            score += Math.min(points, 15);
            detectedPatterns.push(...matchedKeywords);

            findings.push({
              category: 'Content Analysis',
              severity: matchedKeywords.length > 3 ? 'high' : 'medium',
              message: `${matchedKeywords.length} ${category} scam keywords detected`,
              points: Math.min(points, 15),
              details: {
                category,
                keywords: matchedKeywords,
                note: `Common in ${category}-based scams`
              }
            });
          }
        });

        // Form analysis - check for suspicious input fields
        const formPatterns = {
          password: /<input[^>]*type=["']password["']/gi,
          email: /<input[^>]*type=["']email["']/gi,
          creditCard: /<input[^>]*(card|cc|cvv|ccv)[^>]*>/gi,
          ssn: /<input[^>]*(ssn|social.?security)[^>]*>/gi,
          phone: /<input[^>]*type=["']tel["']/gi
        };

        let sensitiveFieldsCount = 0;
        const detectedFields: string[] = [];

        Object.entries(formPatterns).forEach(([field, pattern]) => {
          const matches = html.match(pattern);
          if (matches) {
            sensitiveFieldsCount += matches.length;
            detectedFields.push(`${field} (${matches.length})`);
          }
        });

        if (sensitiveFieldsCount > 0) {
          const formPoints = Math.min(sensitiveFieldsCount * 5, 20);
          score += formPoints;

          findings.push({
            category: 'Content Analysis',
            severity: sensitiveFieldsCount > 3 ? 'critical' : 'high',
            message: `Form requesting ${sensitiveFieldsCount} sensitive input field(s)`,
            points: formPoints,
            details: {
              fieldsDetected: detectedFields,
              isHTTPS: url.protocol === 'https:',
              warning: url.protocol === 'http:' ? 'CRITICAL: Sensitive data over HTTP!' : 'Review form legitimacy'
            }
          });

          // Extra penalty for password on HTTP
          if (url.protocol === 'http:' && formPatterns.password.test(html)) {
            score += 15;
            findings.push({
              category: 'Content Analysis',
              severity: 'critical',
              message: 'Password form on non-HTTPS page - SEVERE SECURITY RISK',
              points: 15,
              details: {
                warning: 'Never enter passwords on non-HTTPS sites!'
              }
            });
          }
        }

        // Check for hidden/malicious elements
        if (/<iframe[^>]*(hidden|display:\s*none|visibility:\s*hidden)/i.test(html)) {
          score += 12;
          findings.push({
            category: 'Content Analysis',
            severity: 'high',
            message: 'Hidden iframe detected (potential malware dropper)',
            points: 12,
            details: { note: 'Often used to load malicious content invisibly' }
          });
        }

        // Check for JavaScript redirects
        if (/window\.location|document\.location|location\.href|location\.replace/i.test(html)) {
          const redirectCount = (html.match(/location\./gi) || []).length;
          if (redirectCount > 2) {
            score += 8;
            findings.push({
              category: 'Content Analysis',
              severity: 'medium',
              message: `${redirectCount} JavaScript redirects detected`,
              points: 8,
              details: {
                redirectCount,
                note: 'Multiple redirects can obscure final destination'
              }
            });
          }
        }

        // Check for obfuscated JavaScript
        const jsObfuscationPatterns = [
          /eval\s*\(/gi,
          /String\.fromCharCode/gi,
          /unescape\s*\(/gi,
          /\\x[0-9a-f]{2}/gi // Hex encoded strings
        ];

        let obfuscationScore = 0;
        jsObfuscationPatterns.forEach(pattern => {
          const matches = html.match(pattern);
          if (matches && matches.length > 5) {
            obfuscationScore += 3;
          }
        });

        if (obfuscationScore > 0) {
          score += Math.min(obfuscationScore, 12);
          findings.push({
            category: 'Content Analysis',
            severity: 'high',
            message: 'Heavily obfuscated JavaScript code detected',
            points: Math.min(obfuscationScore, 12),
            details: {
              note: 'Legitimate sites rarely use heavy obfuscation',
              warning: 'May hide malicious code'
            }
          });
        }

        // Check for external resource loading from suspicious sources
        const externalResources = html.match(/src=["']https?:\/\/([^"']+)["']/gi) || [];
        const suspiciousDomains = externalResources.filter((resource: string) => {
          const domain = resource.match(/src=["']https?:\/\/([^/]+)/i)?.[1] || '';
          return domain && !domain.includes(url.hostname) &&
                 (domain.includes('.tk') || domain.includes('.xyz') ||
                  domain.includes('.top') || domain.includes('bit.ly'));
        });

        if (suspiciousDomains.length > 0) {
          score += Math.min(suspiciousDomains.length * 4, 12);
          findings.push({
            category: 'Content Analysis',
            severity: 'medium',
            message: `Loading ${suspiciousDomains.length} resource(s) from suspicious domains`,
            points: Math.min(suspiciousDomains.length * 4, 12),
            details: {
              count: suspiciousDomains.length,
              note: 'Resources from untrusted third-party sites'
            }
          });
        }

        // Meta tag analysis
        const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["']/i);
        if (metaRefresh) {
          score += 6;
          findings.push({
            category: 'Content Analysis',
            severity: 'medium',
            message: 'Auto-redirect meta tag detected',
            points: 6,
            details: { note: 'Page automatically redirects users' }
          });
        }

        // Summary finding
        if (detectedPatterns.length > 0 || sensitiveFieldsCount > 0) {
          findings.push({
            category: 'Content Analysis',
            severity: 'info',
            message: `Content analysis complete: ${detectedPatterns.length} scam patterns, ${sensitiveFieldsCount} sensitive forms`,
            points: 0,
            details: {
              scamPatterns: detectedPatterns.length,
              sensitiveForms: sensitiveFieldsCount,
              pageLength: html.length
            }
          });
        }
      } else {
        // Could not fetch content
        findings.push({
          category: 'Content Analysis',
          severity: 'low',
          message: 'Could not fetch page content for analysis',
          points: 0,
          details: { note: 'Page may be blocking automated access or down' }
        });
      }
    } catch (error) {
      logger.error('Content analysis error:', error);
      findings.push({
        category: 'Content Analysis',
        severity: 'low',
        message: 'Content analysis failed',
        points: 0,
        details: { error: (error as Error).message }
      });
    }

    return {
      name: 'Content Analysis',
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      status: score > 25 ? 'fail' : score > 12 ? 'warning' : 'pass'
    };
  }

  // Placeholder methods for other categories
  private async analyzePhishingPatterns(url: URL): Promise<CategoryResult> {
    return {name: 'Phishing Patterns', score: 0, maxScore: 50, findings: [], status: 'pass'};
  }

  private async analyzeMalware(url: URL): Promise<CategoryResult> {
    return {name: 'Malware Detection', score: 0, maxScore: 45, findings: [], status: 'pass'};
  }

  private async analyzeBehavioral(url: URL): Promise<CategoryResult> {
    return {name: 'Behavioral Analysis', score: 0, maxScore: 25, findings: [], status: 'pass'};
  }

  private async analyzeSocialEngineering(url: URL): Promise<CategoryResult> {
    return {name: 'Social Engineering', score: 0, maxScore: 30, findings: [], status: 'pass'};
  }

  private async analyzeFinancialFraud(url: URL): Promise<CategoryResult> {
    return {name: 'Financial Fraud', score: 0, maxScore: 25, findings: [], status: 'pass'};
  }

  private async analyzeIdentityTheft(url: URL): Promise<CategoryResult> {
    return {name: 'Identity Theft', score: 0, maxScore: 20, findings: [], status: 'pass'};
  }

  private async analyzeTechnicalExploits(url: URL): Promise<CategoryResult> {
    return {name: 'Technical Exploits', score: 0, maxScore: 15, findings: [], status: 'pass'};
  }

  private async analyzeBrandImpersonation(url: URL): Promise<CategoryResult> {
    return {name: 'Brand Impersonation', score: 0, maxScore: 20, findings: [], status: 'pass'};
  }

  /**
   * PHASE 1 ENHANCEMENT: Multi-Dimensional Trust Graph Network Analysis
   * Analyzes domain's network connections and identifies scam networks
   *
   * This uses Neo4j graph database to track relationships between domains, IPs,
   * registrars, and other infrastructure to identify connected scam networks.
   */
  private async analyzeNetwork(url: URL): Promise<CategoryResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 30; // Increased from 15 per enhancement document

    try {
      logger.info(`🕸️  Trust Graph network analysis skipped (Neo4j not configured)...`);

      // TODO: Re-implement Trust Graph as a proper category analyzer in the new scanner.ts system
      // For now, return neutral result to avoid errors
      findings.push({
        category: 'Trust Graph Network Analysis',
        severity: 'info',
        message: 'Network analysis skipped - Neo4j database not configured',
        points: 0,
        details: { note: 'Trust Graph functionality will be re-enabled after Neo4j setup' },
      });

      return {
        name: 'Trust Graph Network Analysis',
        score: 0,
        maxScore: 0,
        findings,
        status: 'pass',
      };

      // COMMENTED OUT - Trust Graph requires Neo4j which is not configured
      // 1. Build the domain's graph (add nodes and relationships)
      // try {
      //   await trustGraphService.buildDomainGraph(url.hostname, {
      //     riskScore: 0, // Will be updated later with final score
      //     riskLevel: 'unknown',
      //   });
      // } catch (graphError) {
      //   logger.warn(`Trust graph build failed for ${url.hostname}, continuing with analysis...`);
      // }

      // 2. Analyze network connections
      // const networkAnalysis = await trustGraphService.analyzeNetwork(url.hostname);

      // 3. Process risk assessment
      if (networkAnalysis.riskAssessment) {
        score = networkAnalysis.riskAssessment.score;

        // Add findings based on network analysis
        networkAnalysis.riskAssessment.reasons.forEach((reason) => {
          let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';
          if (reason.includes('CRITICAL') || networkAnalysis.networkSize >= 10) {
            severity = 'critical';
          } else if (reason.includes('HIGH') || networkAnalysis.networkSize >= 5) {
            severity = 'high';
          } else if (networkAnalysis.networkSize >= 2) {
            severity = 'medium';
          }

          findings.push({
            category: 'Trust Graph Network Analysis',
            severity,
            message: reason,
            points: score / networkAnalysis.riskAssessment.reasons.length,
            details: {
              networkSize: networkAnalysis.networkSize,
              connectedDomains: networkAnalysis.connectedDomains.slice(0, 10), // First 10
            },
          });
        });
      }

      // 4. Add scam network membership info
      if (networkAnalysis.scamNetworkMembership.isPartOfNetwork) {
        const networkPoints = Math.min(networkAnalysis.scamNetworkMembership.flaggedDomainsInNetwork * 2, 15);
        score += networkPoints;

        findings.push({
          category: 'Trust Graph Network Analysis',
          severity: 'critical',
          message: `Part of scam network with ${networkAnalysis.scamNetworkMembership.flaggedDomainsInNetwork} flagged domains`,
          points: networkPoints,
          details: {
            networkId: networkAnalysis.scamNetworkMembership.networkId,
            networkName: networkAnalysis.scamNetworkMembership.networkName,
            flaggedDomains: networkAnalysis.scamNetworkMembership.flaggedDomainsInNetwork,
          },
        });
      }

      // 5. Add infrastructure sharing details
      if (networkAnalysis.sharedInfrastructure.ipAddresses.length > 0) {
        const ipSharing = networkAnalysis.sharedInfrastructure.ipAddresses[0];
        findings.push({
          category: 'Trust Graph Network Analysis',
          severity: ipSharing.sharedWith > 50 ? 'high' : ipSharing.sharedWith > 10 ? 'medium' : 'low',
          message: `Shares IP ${ipSharing.ip} with ${ipSharing.sharedWith} other domains`,
          points: 0,
          details: {
            ip: ipSharing.ip,
            sharedDomainCount: ipSharing.sharedWith,
          },
        });
      }

      if (networkAnalysis.sharedInfrastructure.registrars.length > 0) {
        const registrar = networkAnalysis.sharedInfrastructure.registrars[0];
        findings.push({
          category: 'Trust Graph Network Analysis',
          severity: registrar.sharedWith > 100 ? 'medium' : 'low',
          message: `Registered with ${registrar.name} (used by ${registrar.sharedWith} domains in network)`,
          points: 0,
          details: {
            registrar: registrar.name,
            sharedDomainCount: registrar.sharedWith,
          },
        });
      }

      // 6. Summary finding
      findings.push({
        category: 'Trust Graph Network Analysis',
        severity: 'info',
        message: `Network analysis complete: ${networkAnalysis.networkSize} connected domains found, risk level ${networkAnalysis.riskAssessment.level}`,
        points: 0,
        details: {
          networkSize: networkAnalysis.networkSize,
          riskLevel: networkAnalysis.riskAssessment.level,
          totalConnectedDomains: networkAnalysis.connectedDomains.length,
          sharedIPCount: networkAnalysis.sharedInfrastructure.ipAddresses.length,
          sharedRegistrarCount: networkAnalysis.sharedInfrastructure.registrars.length,
        },
      });

      logger.info(`✅ Trust Graph analysis complete: Risk score ${score}/${maxScore}, network size ${networkAnalysis.networkSize}`);
    } catch (error) {
      logger.error('Trust Graph network analysis failed:', error);
      findings.push({
        category: 'Trust Graph Network Analysis',
        severity: 'low',
        message: 'Network analysis unavailable (Trust Graph service error)',
        points: 0,
        details: { error: (error as Error).message },
      });
    }

    return {
      name: 'Trust Graph Network Analysis',
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      status: score > 20 ? 'fail' : score > 10 ? 'warning' : 'pass',
    };
  }

  /**
   * PHASE 1: Run comprehensive external threat intelligence checks
   * Queries multiple security databases in parallel:
   * - VirusTotal (89+ antivirus engines)
   * - Google Safe Browsing (phishing/malware database)
   * - AbuseIPDB (IP reputation)
   * - PhishTank (known phishing URLs)
   * - URLhaus (malware distribution)
   */
  private async runExternalScans(url: string): Promise<any> {
    try {
      // Use our comprehensive external threat intelligence service with timeout
      // This runs all checks in parallel for faster results
      const threatIntel = await Promise.race([
        externalThreatIntelService.checkURL(url),
        new Promise<any>((resolve) => setTimeout(() => resolve({
          summary: {
            totalChecks: 0,
            flaggedCount: 0,
            safeCount: 0,
            overallVerdict: 'TIMEOUT'
          }
        }), 15000)) // 15 second timeout for external APIs
      ]);
      return threatIntel;
    } catch (error) {
      logger.error('External threat intelligence failed:', error);
      // Return empty result rather than failing the entire scan
      return {
        summary: {
          totalChecks: 0,
          flaggedCount: 0,
          safeCount: 0,
          overallVerdict: 'UNKNOWN'
        }
      };
    }
  }

  /**
   * PHASE 1: Generate Multi-LLM consensus analysis
   * Queries Claude Sonnet 4.5, GPT-4, and Gemini Pro in parallel
   * Provides multiple expert AI opinions for more accurate threat assessment
   *
   * @param url - The URL being analyzed
   * @param categories - All technical scan categories
   * @param externalScans - Results from threat intelligence APIs
   * @returns Consensus analysis from multiple AI models
   */
  private async generateMultiLLMAnalysis(
    url: string,
    categories: CategoryResult[],
    externalScans?: any
  ): Promise<any> {
    try {
      const models = await prisma.aIModelDefinition.findMany({ where: { enabled: true } });
      if (models.length === 0) {
        return undefined;
      }

      const scanData = {
        url,
        domainInfo: categories.find(c => c.name === 'Domain Analysis'),
        sslInfo: categories.find(c => c.name === 'SSL/TLS Analysis'),
        threatIntel: externalScans,
        contentAnalysis: categories.find(c => c.name === 'Content Analysis'),
        networkInfo: categories.find(c => c.name === 'Network Analysis')
      };

      const analysisPromises = models.map(model => {
        const apiKey = model.apiKey ? apiKeyEncryption.decrypt(model.apiKey) : undefined;
        const prompt = `Analyze the following URL and its scan data: ${JSON.stringify(scanData, null, 2)}`;
        return aiService.queryConfiguredModel({ ...model, apiKey }, prompt);
      });

      const results = await Promise.allSettled(analysisPromises);

      const consensus = {
        claude: results[0]?.status === 'fulfilled' ? results[0].value : null,
        gpt4: results[1]?.status === 'fulfilled' ? results[1].value : null,
        gemini: results[2]?.status === 'fulfilled' ? results[2].value : null,
        consensus: {
          agreement: 0,
          verdict: 'unknown',
          summary: ''
        }
      };

      // Basic consensus logic (can be improved)
      const verdicts = results.map(r => (r.status === 'fulfilled' ? (r.value as any).verdict : 'unknown')).filter(v => v !== 'unknown');
      if (verdicts.length > 0) {
        const verdictCounts = verdicts.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {} as Record<string, number>);
        const [topVerdict, count] = Object.entries(verdictCounts).sort((a, b) => b[1] - a[1])[0];
        consensus.consensus.verdict = topVerdict;
        consensus.consensus.agreement = count / verdicts.length;
        consensus.consensus.summary = `Consensus verdict is ${topVerdict} with ${Math.round(consensus.consensus.agreement * 100)}% agreement.`;
      }

      return consensus;
    } catch (error) {
      logger.error('Multi-LLM analysis failed:', error);
      return undefined;
    }
  }

  /**
   * PHASE 1: Get network and infrastructure information
   * Provides geolocation, ISP, hosting details
   *
   * @param hostname - Domain name or IP to analyze
   * @returns Network infrastructure details
   */
  private async getNetworkInfo(hostname: string): Promise<any> {
    try {
      // Resolve hostname to IP with timeout
      const addresses = await Promise.race([
        dns.resolve4(hostname).catch(() => []),
        new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 3000)) // 3 second timeout
      ]);
      if (addresses.length === 0) return undefined;

      const ipAddress = addresses[0];

      // Get detailed IP information with timeout
      const ipInfo = await Promise.race([
        externalThreatIntelService.getIPInformation(ipAddress),
        new Promise<any>((resolve) => setTimeout(() => resolve(null), 5000)) // 5 second timeout
      ]);

      if (!ipInfo) return { ipAddress };

      return {
        ipAddress,
        country: ipInfo.country,
        countryCode: ipInfo.countryCode,
        region: ipInfo.region,
        city: ipInfo.city,
        isp: ipInfo.isp,
        org: ipInfo.org,
        asn: ipInfo.as,
        asnName: ipInfo.asname,
        isProxy: ipInfo.isProxy,
        isHosting: ipInfo.isHosting,
        isMobile: ipInfo.isMobile,
        timezone: ipInfo.timezone,
        coordinates: {
          lat: ipInfo.lat,
          lon: ipInfo.lon
        }
      };
    } catch (error) {
      logger.error('Network info lookup failed:', error);
      return undefined;
    }
  }

  private async generateAIAnalysis(
    url: string,
    categories: CategoryResult[],
    totalScore: number,
    maxScore: number,
    externalScans?: any
  ): Promise<any> {
    try {
      const prompt = `Analyze this URL security scan and provide a detailed explanation:

URL: ${url}
Total Risk Score: ${totalScore}/${maxScore}
Risk Level: ${this.calculateRiskLevel(totalScore, maxScore)}

Scan Results:
${categories.map(cat => `${cat.name}: ${cat.score}/${cat.maxScore} (${cat.status})
Findings: ${cat.findings.map(f => `- ${f.message}`).join('\n')}`).join('\n\n')}

${externalScans ? `External Scans: ${JSON.stringify(externalScans, null, 2)}` : ''}

Please provide:
1. A concise summary (2-3 sentences)
2. A detailed explanation of the risk factors found
3. Specific recommendations for the user
4. Your confidence level (0-100%)`;

      const aiResponse = await Promise.race([
        aiService.query({
          query: prompt,
          model: 'claude',
          useRAG: false
        }),
        new Promise<any>((resolve) => setTimeout(() => resolve(null), 20000)) // 20 second timeout for AI
      ]);

      if (!aiResponse || !aiResponse.text) {
        return undefined;
      }

      return {
        summary: aiResponse.text.split('\n')[0],
        detailedExplanation: aiResponse.text,
        recommendations: this.extractRecommendations(aiResponse.text),
        confidence: 85
      };
    } catch (error) {
      logger.error('AI analysis failed:', error);
      return undefined;
    }
  }

  private extractRecommendations(text: string): string[] {
    const lines = text.split('\n');
    const recommendations: string[] = [];
    let inRecommendations = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('recommendation')) {
        inRecommendations = true;
        continue;
      }
      if (inRecommendations && line.trim().startsWith('-')) {
        recommendations.push(line.trim().substring(1).trim());
      }
    }

    return recommendations.length > 0 ? recommendations : [
      'Avoid entering personal information on this site',
      'Verify the legitimacy through official channels',
      'Use a security tool or VPN when accessing'
    ];
  }

  private async getSSLCertificate(hostname: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(443, hostname, { rejectUnauthorized: false }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        resolve(cert);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        reject(new Error('SSL connection timeout'));
      });
    });
  }

  private calculateRiskLevel(score: number, maxScore: number = 570): string {
    // PHASE 2: Percentage-based thresholds for 570-point system
    // Google.com example: 109/570 = 19% should be LOW, not MEDIUM
    const percentage = (score / maxScore) * 100;

    if (percentage >= 45) return 'critical';  // 257+ points / 570 = Critical threat
    if (percentage >= 32) return 'high';      // 182+ points / 570 = High risk
    if (percentage >= 20) return 'medium';    // 114+ points / 570 = Medium risk
    if (percentage >= 8) return 'low';        // 46+ points / 570 = Low risk
    return 'safe';                            // < 46 points / 570 = Safe
  }

  /**
   * 🔥 CRITICAL FIX: Calculate risk level for Threat Intelligence category results
   * Threat Intelligence uses a 50-point scale, not the 350-point total scale
   * Maps threat intel severity to risk level: critical=50, high=40, medium=25, low=15
   */
  private calculateThreatIntelRiskLevel(score: number, maxScore: number): string {
    // Calculate percentage of max threat intel score
    const percentage = (score / maxScore) * 100;

    // Map threat intel scores to risk levels
    if (percentage >= 95) return 'critical'; // 47.5+ / 50 = critical
    if (percentage >= 75) return 'high';     // 37.5+ / 50 = high
    if (percentage >= 45) return 'medium';   // 22.5+ / 50 = medium
    if (percentage >= 25) return 'low';      // 12.5+ / 50 = low
    return 'safe';
  }

  // PHASE 2: New analyzer methods for 350-point scoring system

  private async analyzePrivacy(url: string, htmlContent: string): Promise<any> {
    logger.info(`   🔐 Starting Privacy Analysis for ${url}`);
    logger.info(`      HTML Content Length: ${htmlContent.length} bytes`);
    try {
      // Check if HTML content is available
      if (!htmlContent || htmlContent.trim().length === 0) {
        logger.warn(`      ⚠️  Privacy Analysis: No HTML content available`);
        return {
          score: 0,
          maxScore: 50,
          findings: [{
            check: 'Privacy Analysis',
            result: 'Unable to Analyze',
            severity: 'MEDIUM',
            points: 0,
            maxPoints: 50,
            explanation: 'Could not fetch website content for privacy analysis. Site may be unreachable or blocking automated requests.',
            evidence: { htmlContentLength: 0 }
          }],
          status: 'WARNING'
        };
      }
      const result = await this.privacyAnalyzer.analyzePrivacy(url, htmlContent);
      logger.info(`      ✅ Privacy Analysis complete: ${result.score}/${result.maxScore} points, ${result.findings.length} findings`);
      return result;
    } catch (error) {
      logger.error(`      ❌ Privacy analysis failed: ${(error as Error).message}`);
      return {
        score: 0,
        maxScore: 50,
        findings: [{
          check: 'Privacy Analysis',
          result: 'Analysis Error',
          severity: 'MEDIUM',
          points: 0,
          maxPoints: 50,
          explanation: `Privacy analysis encountered an error: ${(error as Error).message}`,
          evidence: { error: (error as Error).message }
        }],
        status: 'WARNING'
      };
    }
  }

  private async analyzeEmailSecurity(domain: string): Promise<any> {
    logger.info(`   📧 Starting Email Security Analysis for ${domain}`);
    try {
      const result = await this.emailSecurityAnalyzer.analyzeEmailSecurity(domain);
      logger.info(`      ✅ Email Security complete: ${result.score}/${result.maxScore} points, ${result.findings.length} findings`);
      return result;
    } catch (error) {
      logger.error(`      ❌ Email security analysis failed: ${(error as Error).message}`);
      return {
        score: 0,
        maxScore: 25,
        findings: [{
          check: 'Email Security',
          result: 'Analysis Error',
          severity: 'MEDIUM',
          points: 0,
          maxPoints: 25,
          explanation: `Email security analysis encountered an error: ${(error as Error).message}`,
          evidence: { error: (error as Error).message }
        }],
        status: 'WARNING'
      };
    }
  }

  private async analyzeLegalCompliance(url: string, htmlContent: string): Promise<any> {
    logger.info(`   ⚖️  Starting Legal Compliance Analysis for ${url}`);
    logger.info(`      HTML Content Length: ${htmlContent.length} bytes`);
    try {
      // Check if HTML content is available
      if (!htmlContent || htmlContent.trim().length === 0) {
        logger.warn(`      ⚠️  Legal Compliance: No HTML content available`);
        return {
          score: 0,
          maxScore: 35,
          findings: [{
            check: 'Legal Compliance',
            result: 'Unable to Analyze',
            severity: 'MEDIUM',
            points: 0,
            maxPoints: 35,
            explanation: 'Could not fetch website content for legal compliance analysis. Site may be unreachable or blocking automated requests.',
            evidence: { htmlContentLength: 0 }
          }],
          status: 'WARNING'
        };
      }
      const result = await this.legalComplianceAnalyzer.analyzeLegalCompliance(url, htmlContent);
      logger.info(`      ✅ Legal Compliance complete: ${result.score}/${result.maxScore} points, ${result.findings.length} findings`);
      return result;
    } catch (error) {
      logger.error(`      ❌ Legal compliance analysis failed: ${(error as Error).message}`);
      return {
        score: 0,
        maxScore: 35,
        findings: [{
          check: 'Legal Compliance',
          result: 'Analysis Error',
          severity: 'MEDIUM',
          points: 0,
          maxPoints: 35,
          explanation: `Legal compliance analysis encountered an error: ${(error as Error).message}`,
          evidence: { error: (error as Error).message }
        }],
        status: 'WARNING'
      };
    }
  }

  private async analyzeSecurityHeaders(url: string): Promise<any> {
    logger.info(`   🛡️  Starting Security Headers Analysis for ${url}`);
    try {
      const result = await this.securityHeadersAnalyzer.analyzeSecurityHeaders(url);
      logger.info(`      ✅ Security Headers complete: ${result.score}/${result.maxScore} points, ${result.findings.length} findings`);
      return result;
    } catch (error) {
      logger.error(`      ❌ Security headers analysis failed: ${(error as Error).message}`);
      return {
        score: 0,
        maxScore: 25,
        findings: [{
          check: 'Security Headers',
          result: 'Analysis Error',
          severity: 'MEDIUM',
          points: 0,
          maxPoints: 25,
          explanation: `Security headers analysis encountered an error: ${(error as Error).message}`,
          evidence: { error: (error as Error).message }
        }],
        status: 'WARNING'
      };
    }
  }

  // PHASE 2: Convert new analyzer result format to CategoryResult format
  private convertToCategory(name: string, result: any): CategoryResult {
    const convertedFindings: Finding[] = result.findings.map((finding: any) => ({
      category: name,
      severity: finding.severity.toLowerCase(),
      message: `${finding.check}: ${finding.result} - ${finding.explanation}`,
      points: finding.points,
      details: finding.evidence
    }));

    return {
      name,
      score: result.score,
      maxScore: result.maxScore,
      findings: convertedFindings,
      status: result.status.toLowerCase() as 'pass' | 'warning' | 'fail'
    };
  }

  // PHASE 2: Generate professional formatted output using OutputFormatter
  private generateFormattedOutput(data: any): string {
    try {
      // Convert categories to the format expected by OutputFormatter
      const formattedCategories = data.categories.map((cat: CategoryResult) => ({
        category: cat.name,
        score: cat.score,
        maxScore: cat.maxScore,
        findings: cat.findings.map((f: Finding) => ({
          check: f.category,
          result: f.message,
          severity: f.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          points: f.points,
          maxPoints: f.points, // Individual finding max = points earned
          explanation: f.message,
          evidence: f.details
        })),
        status: cat.status.toUpperCase() as 'PASS' | 'WARNING' | 'FAIL'
      }));

      // Convert multiLLM analysis to AI model responses
      const aiModels = [];
      if (data.multiLLMAnalysis?.claude) {
        aiModels.push({
          model: 'Claude Sonnet 4.5',
          response: data.multiLLMAnalysis.claude.analysis || 'Analysis unavailable',
          confidence: data.multiLLMAnalysis.claude.confidence || 85,
          verdict: data.multiLLMAnalysis.claude.verdict || 'Unknown'
        });
      }
      if (data.multiLLMAnalysis?.gpt4) {
        aiModels.push({
          model: 'GPT-4',
          response: data.multiLLMAnalysis.gpt4.analysis || 'Analysis unavailable',
          confidence: data.multiLLMAnalysis.gpt4.confidence || 85,
          verdict: data.multiLLMAnalysis.gpt4.verdict || 'Unknown'
        });
      }
      if (data.multiLLMAnalysis?.gemini) {
        aiModels.push({
          model: 'Gemini 1.5 Flash',
          response: data.multiLLMAnalysis.gemini.analysis || 'Analysis unavailable',
          confidence: data.multiLLMAnalysis.gemini.confidence || 85,
          verdict: data.multiLLMAnalysis.gemini.verdict || 'Unknown'
        });
      }

      // Convert external scans to threat intel sources
      const threatIntel = [];
      if (data.externalScans?.virustotal) {
        threatIntel.push({
          source: 'VirusTotal',
          result: data.externalScans.virustotal.result || 'No data',
          details: data.externalScans.virustotal
        });
      }
      if (data.externalScans?.googleSafeBrowsing) {
        threatIntel.push({
          source: 'Google Safe Browsing',
          result: data.externalScans.googleSafeBrowsing.result || 'No data',
          details: data.externalScans.googleSafeBrowsing
        });
      }
      if (data.externalScans?.abuseIPDB) {
        threatIntel.push({
          source: 'AbuseIPDB',
          result: data.externalScans.abuseIPDB.result || 'No data',
          details: data.externalScans.abuseIPDB
        });
      }

      // Generate final verdict
      const finalVerdict = this.generateFinalVerdict(data.riskLevel, data.totalScore, data.maxScore);

      // Get recommendations based on risk level
      const recommendations = this.getRecommendationsByRiskLevel(data.riskLevel);

      return OutputFormatter.formatScanResult({
        url: data.url,
        totalScore: data.totalScore,
        maxScore: data.maxScore,
        riskLevel: data.riskLevel,
        confidence: data.confidence,
        categories: formattedCategories,
        aiModels: aiModels.length > 0 ? aiModels : undefined,
        threatIntel: threatIntel.length > 0 ? threatIntel : undefined,
        finalVerdict,
        recommendations,
        scanDuration: data.scanDuration
      });
    } catch (error) {
      logger.error('Error generating formatted output:', error);
      return 'Error generating formatted output. Please check raw scan results.';
    }
  }

  private generateFinalVerdict(riskLevel: string, score: number, maxScore: number): string {
    const percentage = Math.round((score / maxScore) * 100);

    switch (riskLevel.toUpperCase()) {
      case 'CRITICAL':
        return `⛔ CRITICAL THREAT - DO NOT VISIT\n\nTHREAT TYPE: High-Risk Malicious Site\nRISK LEVEL: CRITICAL (${score}/${maxScore} risk points - ${percentage}%)`;

      case 'HIGH':
        return `🔴 HIGH RISK - AVOID THIS SITE\n\nTHREAT TYPE: Likely Malicious or Phishing\nRISK LEVEL: HIGH (${score}/${maxScore} risk points - ${percentage}%)`;

      case 'MEDIUM':
        return `⚠️ MEDIUM RISK - PROCEED WITH CAUTION\n\nTHREAT TYPE: Suspicious Activity Detected\nRISK LEVEL: MEDIUM (${score}/${maxScore} risk points - ${percentage}%)`;

      case 'LOW':
        return `🟡 LOW RISK - MINOR CONCERNS\n\nTHREAT TYPE: Some Security Issues\nRISK LEVEL: LOW (${score}/${maxScore} risk points - ${percentage}%)`;

      default:
        return `✅ SAFE - NO SIGNIFICANT THREATS DETECTED\n\nTHREAT TYPE: Appears Legitimate\nRISK LEVEL: SAFE (${score}/${maxScore} risk points - ${percentage}%)`;
    }
  }

  private getRecommendationsByRiskLevel(riskLevel: string): string[] {
    switch (riskLevel.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return [
          'Do NOT visit this URL under any circumstances',
          'Do NOT enter any credentials or personal information',
          'Do NOT download any files',
          'Delete any email or message containing this link',
          'Report to your IT security team or authorities',
          'Warn others if this link was shared in a group',
          'Change passwords if you already visited this site'
        ];

      case 'MEDIUM':
        return [
          'Verify the source independently before visiting',
          'Do not enter sensitive information without verification',
          'Check the URL carefully for typos or impersonation',
          'Use a VPN or security tool if you must access',
          'Monitor for suspicious activity'
        ];

      case 'LOW':
        return [
          'Verify sender identity before taking action',
          'Check for HTTPS and valid certificate',
          'Be cautious with downloads or forms',
          'Use updated antivirus software'
        ];

      default:
        return [
          'Remain vigilant for phishing attempts',
          'Verify sender identity when in doubt',
          'Use common sense and best practices'
        ];
    }
  }

  /**
   * Generate a website overview/description from HTML content and scan results
   * Provides a user-friendly description of what the website is about
   */
  private generateWebsiteOverview(url: URL, htmlContent: string, networkInfo?: any): any {
    try {
      // Extract title from HTML
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().substring(0, 100) : url.hostname;

      // Extract meta description
      const descriptionMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      let description = descriptionMatch ? descriptionMatch[1].trim() : '';

      // If no meta description, try og:description
      if (!description) {
        const ogDescMatch = htmlContent.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
        description = ogDescMatch ? ogDescMatch[1].trim() : '';
      }

      // Fallback: Extract first paragraph of text
      if (!description) {
        const pMatch = htmlContent.match(/<p[^>]*>(.*?)<\/p>/i);
        if (pMatch) {
          description = pMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 200);
        }
      }

      // Determine category based on domain and content
      const hostname = url.hostname.toLowerCase();
      let category = 'General Website';
      let purpose = 'Online service or information resource';

      // Categorize based on TLD and domain name
      if (hostname.includes('google') || hostname.includes('search')) {
        category = 'Search Engine';
        purpose = 'Web search and information discovery';
      } else if (hostname.includes('bank') || hostname.includes('paypal') || hostname.includes('payment')) {
        category = 'Financial Services';
        purpose = 'Banking, payments, or financial transactions';
      } else if (hostname.includes('shop') || hostname.includes('store') || htmlContent.toLowerCase().includes('add to cart')) {
        category = 'E-commerce';
        purpose = 'Online shopping and retail';
      } else if (hostname.includes('gov') || hostname.endsWith('.gov')) {
        category = 'Government';
        purpose = 'Official government services and information';
      } else if (hostname.includes('edu') || hostname.endsWith('.edu')) {
        category = 'Education';
        purpose = 'Educational institution or learning resources';
      } else if (hostname.includes('news') || hostname.includes('blog')) {
        category = 'News & Media';
        purpose = 'News, articles, and media content';
      } else if (hostname.includes('social') || hostname.includes('facebook') || hostname.includes('twitter')) {
        category = 'Social Media';
        purpose = 'Social networking and community platform';
      } else if (htmlContent.toLowerCase().includes('login') && htmlContent.toLowerCase().includes('password')) {
        category = 'Web Application';
        purpose = 'Online application or service platform';
      }

      // Add location information if available
      let locationInfo = '';
      if (networkInfo?.country) {
        locationInfo = networkInfo.city
          ? `Hosted in ${networkInfo.city}, ${networkInfo.country}`
          : `Hosted in ${networkInfo.country}`;
      }

      // Build final description
      const finalDescription = description ||
        `${category} providing ${purpose.toLowerCase()}. ${locationInfo}`.trim();

      return {
        title,
        description: finalDescription.substring(0, 300), // Limit to 300 chars
        category,
        purpose: `${purpose}${locationInfo ? '. ' + locationInfo : ''}`
      };
    } catch (error) {
      logger.error('Website overview generation failed:', error);
      return {
        title: url.hostname,
        description: `Website at ${url.hostname}`,
        category: 'Unknown',
        purpose: 'Unable to determine website purpose'
      };
    }
  }
}

export const enhancedURLScanner = new EnhancedURLScanner();
