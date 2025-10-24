/**
 * Enhanced File Scanner with Conversation Chain Analysis
 *
 * PHASE 1 (IMPLEMENTED):
 * - OCR text extraction from screenshots
 * - Conversation chain reconstruction
 * - Multi-LLM analysis of conversation threads
 * - Scam progression detection
 * - Timeline analysis
 * - Red flag identification
 * - Phishing/social engineering detection in images
 *
 * PHASE 2 (PENDING - See PENDING_FEATURES.md):
 * - Advanced QR code detection and analysis
 * - Screenshot authenticity verification
 * - Deep steganography analysis
 * - Multi-language OCR support
 * - Video frame analysis
 * - Audio file transcription
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { logger } from '../../config/logger.js';
import { messageScanner } from './message-scanner.service.js';
import { urlScanner } from './url-scanner.service.js';
import fs from 'fs/promises';
// PHASE 1: Import conversation parser for screenshot analysis
import { conversationParserService } from '../analysis/conversation-parser.service.js';
// PHASE 1: Import Multi-LLM service for conversation analysis
import { multiLLMService } from '../ai/multi-llm.service.js';
// Enhanced: Intent analyzer for scam detection
import { intentAnalyzerService } from '../analyzers/intent-analyzer.service.js';
// Enhanced: Emotion analyzer for sentiment and manipulation detection
import { emotionAnalyzer } from '../analysis/emotion-analyzer.service.js';
// Enhanced: AI service for comprehensive verdict generation
import { aiService } from '../ai/ai.service.js';

export interface FileScanResult {
  fileName: string;
  fileSize: number;
  mimeType: string;
  riskScore: number;
  riskLevel: string;
  findings: Finding[];
  extractedText?: string;
  metadata?: any;
  ocrConfidence?: number;
  // PHASE 1: Conversation chain analysis from screenshots
  conversationAnalysis?: {
    detected: boolean;
    platform?: string;
    totalMessages?: number;
    conversationSpan?: {
      start: Date | null;
      end: Date | null;
      durationDays: number;
    };
    participants?: Array<{
      name: string;
      isUser: boolean;
      hasProfilePic: boolean;
      phoneNumber?: string;
    }>;
    redFlags?: string[];
    timeline?: Array<{
      day: number;
      phase: string;
      messages: Array<{
        timestamp: string;
        sender: string;
        content: string;
        confidence: number;
      }>;
    }>;
    progression?: {
      isTypicalScamProgression: boolean;
      progressionType: string;
      confidence: number;
      explanation: string;
    };
    // Multi-LLM analysis of the conversation
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
  };
  // Enhanced: Intent analysis for scam detection
  intentAnalysis?: {
    primaryIntent: string;
    confidence: number;
    emotionalManipulation: any;
    sentimentAnalysis: any;
    scamIndicators: any[];
    financialSolicitation: any;
    riskScore: number;
  };
  // Enhanced: AI-generated comprehensive verdict
  verdict?: {
    simple: string;
    technical: string;
    recommendation: string;
    safetyAdvice: string[];
  };
  scanDuration: number;
}

interface Finding {
  type: string;
  severity: string;
  message: string;
  points: number;
  details?: any;
}

export class FileScanner {
  private readonly MAX_FILE_SIZE = 52428800; // 50MB
  private readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',  // Some systems use jpg instead of jpeg
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff'
  ];
  private readonly SUPPORTED_TYPES = [...this.SUPPORTED_IMAGE_TYPES, 'application/pdf'];

  async scanFile(
    filePath: string,
    fileName: string,
    fileSize: number,
    mimeType: string
  ): Promise<FileScanResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    let riskScore = 0;

    try {
      // Validate file
      const validation = this.validateFile(fileName, fileSize, mimeType);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Extract metadata
      const metadata = await this.extractMetadata(filePath, mimeType);

      // Extract text based on file type
      let extractedText = '';
      let ocrConfidence = 0;

      if (this.SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
        const ocrResult = await this.performOCR(filePath);
        extractedText = ocrResult.text;
        ocrConfidence = ocrResult.confidence;

        if (extractedText.length > 0) {
          findings.push({
            type: 'text_extracted',
            severity: 'info',
            message: `Extracted ${extractedText.length} characters via OCR`,
            points: 0,
            details: { confidence: ocrConfidence }
          });
        }
      } else if (mimeType === 'application/pdf') {
        extractedText = await this.extractPDFText(filePath);

        if (extractedText.length > 0) {
          findings.push({
            type: 'text_extracted',
            severity: 'info',
            message: `Extracted ${extractedText.length} characters from PDF`,
            points: 0
          });
        }
      }

      // PHASE 1: Check if extracted text contains a conversation thread
      let conversationAnalysis;
      if (extractedText.length > 100 && this.looksLikeConversation(extractedText)) {
        conversationAnalysis = await this.analyzeConversationThread(extractedText);

        if (conversationAnalysis.detected) {
          findings.push({
            type: 'conversation_detected',
            severity: 'info',
            message: `Conversation detected: ${conversationAnalysis.totalMessages} messages on ${conversationAnalysis.platform}`,
            points: 0,
            details: {
              platform: conversationAnalysis.platform,
              messageCount: conversationAnalysis.totalMessages,
              redFlagCount: conversationAnalysis.redFlags?.length || 0
            }
          });

          // Add risk score based on conversation analysis
          if (conversationAnalysis.progression?.isTypicalScamProgression) {
            const scamRisk = Math.floor(conversationAnalysis.progression.confidence);
            riskScore += scamRisk;
            findings.push({
              type: 'scam_progression_detected',
              severity: 'critical',
              message: `Typical ${conversationAnalysis.progression.progressionType} pattern detected`,
              points: scamRisk,
              details: {
                scamType: conversationAnalysis.progression.progressionType,
                confidence: conversationAnalysis.progression.confidence,
                explanation: conversationAnalysis.progression.explanation
              }
            });
          }

          // Add findings for each red flag
          conversationAnalysis.redFlags?.forEach(redFlag => {
            findings.push({
              type: 'conversation_red_flag',
              severity: 'high',
              message: redFlag,
              points: 15
            });
            riskScore += 15;
          });
        }
      }

      // Enhanced: Intent analysis for scam detection (romance, fake job, investment fraud, etc.)
      let intentAnalysis;
      if (extractedText.length > 100) {
        try {
          intentAnalysis = await intentAnalyzerService.analyzeIntent(extractedText);

          // Add findings based on intent analysis
          if (intentAnalysis.scamIndicators.length > 0) {
            for (const indicator of intentAnalysis.scamIndicators) {
              const points = indicator.severity === 'critical' ? 30 :
                            indicator.severity === 'high' ? 20 :
                            indicator.severity === 'medium' ? 10 : 5;

              findings.push({
                type: `intent_${indicator.type}`,
                severity: indicator.severity,
                message: indicator.description,
                points,
                details: { evidence: indicator.evidence }
              });
              riskScore += points;
            }
          }

          // Add emotional manipulation findings
          if (intentAnalysis.emotionalManipulation.detected) {
            findings.push({
              type: 'emotional_manipulation',
              severity: intentAnalysis.emotionalManipulation.severity,
              message: `Emotional manipulation tactics detected: ${intentAnalysis.emotionalManipulation.tactics.join(', ')}`,
              points: Math.floor(intentAnalysis.emotionalManipulation.score / 2),
              details: intentAnalysis.emotionalManipulation
            });
            riskScore += Math.floor(intentAnalysis.emotionalManipulation.score / 2);
          }

          // Add financial solicitation finding
          if (intentAnalysis.financialSolicitation.detected) {
            const solicitationPoints = intentAnalysis.financialSolicitation.urgency === 'high' ? 25 : 15;
            findings.push({
              type: 'financial_solicitation',
              severity: 'critical',
              message: `Financial request detected: ${intentAnalysis.financialSolicitation.type}${intentAnalysis.financialSolicitation.amount ? ` (${intentAnalysis.financialSolicitation.amount})` : ''}`,
              points: solicitationPoints,
              details: intentAnalysis.financialSolicitation
            });
            riskScore += solicitationPoints;
          }
        } catch (error) {
          logger.error('Intent analysis failed:', error);
        }
      }

      // Analyze extracted text for URLs and phishing
      if (extractedText.length > 50) {
        const textAnalysis = await this.analyzeExtractedText(extractedText);
        riskScore += textAnalysis.score;
        findings.push(...textAnalysis.findings);
      }

      // Analyze metadata
      const metadataAnalysis = this.analyzeMetadata(metadata, mimeType);
      riskScore += metadataAnalysis.score;
      findings.push(...metadataAnalysis.findings);

      // File type analysis
      const fileTypeAnalysis = this.analyzeFileType(fileName, mimeType);
      riskScore += fileTypeAnalysis.score;
      findings.push(...fileTypeAnalysis.findings);

      const riskLevel = this.determineRiskLevel(riskScore);

      // Enhanced: Generate AI-powered comprehensive verdict
      const verdict = await this.generateAIVerdict({
        fileName,
        riskScore: Math.min(riskScore, 350),
        riskLevel,
        findings,
        extractedText,
        conversationAnalysis,
        intentAnalysis,
        mimeType
      });

      return {
        fileName,
        fileSize,
        mimeType,
        riskScore: Math.min(riskScore, 350),
        riskLevel,
        findings,
        extractedText: extractedText.substring(0, 5000), // Limit stored text
        metadata,
        ocrConfidence,
        conversationAnalysis, // PHASE 1: Include conversation analysis
        intentAnalysis, // Enhanced: Include intent analysis
        verdict, // Enhanced: AI-generated verdict
        scanDuration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('File scan error:', error);
      throw error;
    }
  }

  private validateFile(
    fileName: string,
    fileSize: number,
    mimeType: string
  ): { valid: boolean; error?: string } {
    if (fileSize > this.MAX_FILE_SIZE) {
      return { valid: false, error: 'File size exceeds 50MB limit' };
    }

    if (!this.SUPPORTED_TYPES.includes(mimeType)) {
      return { valid: false, error: 'Unsupported file type' };
    }

    return { valid: true };
  }

  private async performOCR(filePath: string): Promise<{ text: string; confidence: number }> {
    try {
      // Preprocess image for better OCR
      const processedImagePath = `${filePath}.processed.png`;

      await sharp(filePath)
        .grayscale()
        .normalize()
        .sharpen()
        .toFile(processedImagePath);

      const result = await Tesseract.recognize(processedImagePath, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      // Clean up processed image
      await fs.unlink(processedImagePath).catch(() => {});

      return {
        text: result.data.text,
        confidence: result.data.confidence
      };
    } catch (error) {
      logger.error('OCR error:', error);
      return { text: '', confidence: 0 };
    }
  }

  private async extractPDFText(filePath: string): Promise<string> {
    try {
      // Dynamic import to avoid pdf-parse loading test files at startup
      const pdfParse = (await import('pdf-parse')).default;
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      logger.error('PDF text extraction error:', error);
      return '';
    }
  }

  private async extractMetadata(filePath: string, mimeType: string): Promise<any> {
    const metadata: any = {
      extractedAt: new Date().toISOString()
    };

    try {
      if (this.SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
        const imageMetadata = await sharp(filePath).metadata();
        metadata.image = {
          width: imageMetadata.width,
          height: imageMetadata.height,
          format: imageMetadata.format,
          space: imageMetadata.space,
          channels: imageMetadata.channels,
          depth: imageMetadata.depth,
          density: imageMetadata.density,
          hasAlpha: imageMetadata.hasAlpha,
          exif: imageMetadata.exif
        };
      }
    } catch (error) {
      logger.error('Metadata extraction error:', error);
    }

    return metadata;
  }

  private async analyzeExtractedText(text: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    try {
      // Check for URLs in extracted text
      const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
      const urls = text.match(urlRegex) || [];

      if (urls.length > 0) {
        findings.push({
          type: 'urls_detected',
          severity: 'info',
          message: `Found ${urls.length} URL(s) in extracted text`,
          points: 0,
          details: { urls: urls.slice(0, 5) }
        });

        // Scan first URL
        if (urls[0]) {
          try {
            const urlScanResult = await urlScanner.scanURL(urls[0]);
            if (urlScanResult.riskScore > 100) {
              score += 50;
              findings.push({
                type: 'malicious_url_in_image',
                severity: 'critical',
                message: 'Malicious URL detected in image/document',
                points: 50,
                details: { url: urls[0], urlRiskScore: urlScanResult.riskScore }
              });
            }
          } catch (error) {
            logger.debug('URL scan in image failed:', error);
          }
        }
      }

      // Use message scanner for phishing detection in text
      if (text.length > 20) {
        const messageResult = await messageScanner.scanMessage(text);

        if (messageResult.riskScore > 100) {
          score += Math.floor(messageResult.riskScore * 0.5);
          findings.push({
            type: 'phishing_content',
            severity: 'high',
            message: 'Phishing content detected in extracted text',
            points: Math.floor(messageResult.riskScore * 0.5),
            details: { messageRiskScore: messageResult.riskScore }
          });
        }
      }

      // QR code indicators (simplified detection)
      const qrIndicators = ['scan', 'qr', 'code', 'camera'];
      const hasQRIndicator = qrIndicators.some(ind => text.toLowerCase().includes(ind));

      if (hasQRIndicator && urls.length > 0) {
        score += 20;
        findings.push({
          type: 'qr_phishing',
          severity: 'high',
          message: 'Possible QR code phishing attempt',
          points: 20
        });
      }

      // Brand impersonation in screenshots
      const brands = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook', 'bank'];
      const detectedBrands = brands.filter(brand =>
        text.toLowerCase().includes(brand)
      );

      if (detectedBrands.length > 0) {
        score += 15;
        findings.push({
          type: 'brand_mention',
          severity: 'medium',
          message: `Brand mentions detected: ${detectedBrands.join(', ')}`,
          points: 15,
          details: { brands: detectedBrands }
        });
      }
    } catch (error) {
      logger.error('Text analysis error:', error);
    }

    return { score, findings };
  }

  private analyzeMetadata(metadata: any, mimeType: string): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    try {
      // Check for EXIF data manipulation
      if (metadata.image?.exif) {
        findings.push({
          type: 'exif_present',
          severity: 'info',
          message: 'EXIF metadata present',
          points: 0
        });

        // Check for GPS coordinates (privacy concern)
        const exifBuffer = metadata.image.exif;
        if (exifBuffer && exifBuffer.includes('GPS')) {
          score += 10;
          findings.push({
            type: 'gps_metadata',
            severity: 'low',
            message: 'GPS location data found in metadata',
            points: 10
          });
        }
      }

      // Suspicious image dimensions (1x1 tracking pixel)
      if (metadata.image?.width === 1 && metadata.image?.height === 1) {
        score += 25;
        findings.push({
          type: 'tracking_pixel',
          severity: 'high',
          message: 'Possible tracking pixel detected',
          points: 25
        });
      }

      // Very large images might be used for data exfiltration
      if (metadata.image?.width && metadata.image?.height) {
        const pixels = metadata.image.width * metadata.image.height;
        if (pixels > 50000000) { // 50 megapixels
          score += 5;
          findings.push({
            type: 'large_image',
            severity: 'low',
            message: 'Unusually large image dimensions',
            points: 5,
            details: { width: metadata.image.width, height: metadata.image.height }
          });
        }
      }
    } catch (error) {
      logger.error('Metadata analysis error:', error);
    }

    return { score, findings };
  }

  private analyzeFileType(fileName: string, mimeType: string): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    // Double extension check
    const nameParts = fileName.split('.');
    if (nameParts.length > 2) {
      const suspiciousExtensions = ['exe', 'scr', 'bat', 'cmd', 'vbs', 'js'];
      const hasSuspicious = nameParts.some(part =>
        suspiciousExtensions.includes(part.toLowerCase())
      );

      if (hasSuspicious) {
        score += 40;
        findings.push({
          type: 'double_extension',
          severity: 'critical',
          message: 'Suspicious double extension detected',
          points: 40,
          details: { fileName }
        });
      }
    }

    // Mime type mismatch
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const expectedMimes: Record<string, string[]> = {
      'jpg': ['image/jpeg'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'gif': ['image/gif'],
      'webp': ['image/webp'],
      'pdf': ['application/pdf']
    };

    const expected = expectedMimes[extension];
    if (expected && !expected.includes(mimeType)) {
      score += 30;
      findings.push({
        type: 'mime_mismatch',
        severity: 'high',
        message: 'File extension doesn\'t match MIME type',
        points: 30,
        details: { extension, mimeType }
      });
    }

    return { score, findings };
  }

  private determineRiskLevel(score: number): string {
    if (score >= 200) return 'critical';
    if (score >= 120) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 20) return 'low';
    return 'safe';
  }

  /**
   * PHASE 1: Check if extracted text looks like a conversation
   * Uses heuristics to detect messaging app screenshots
   *
   * @param text - OCR-extracted text
   * @returns true if text appears to be a conversation
   */
  private looksLikeConversation(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Check for messaging app indicators
    const platformIndicators = [
      'whatsapp', 'telegram', 'messenger', 'signal', 'imessage',
      'text message', 'sms', 'chat', 'dm', 'direct message'
    ];
    const hasPlatformIndicator = platformIndicators.some(indicator =>
      lowerText.includes(indicator)
    );

    // Check for timestamp patterns common in messaging apps
    const timestampPatterns = [
      /\d{1,2}:\d{2}\s*(am|pm)/i,
      /yesterday|today/i,
      /(mon|tue|wed|thu|fri|sat|sun)/i,
      /\d{1,2}\/\d{1,2}/
    ];
    const hasTimestamps = timestampPatterns.some(pattern => pattern.test(text));

    // Check for conversation indicators (questions, responses)
    const conversationIndicators = [
      /\bhow are you\b/i,
      /\bthanks?\b/i,
      /\byes|no\b/i,
      /\bhello|hi|hey\b/i,
      /\?/,  // Questions
      /\!/   // Exclamations
    ];
    const conversationIndicatorCount = conversationIndicators.filter(pattern =>
      pattern.test(text)
    ).length;

    // Check for multiple speakers (different sender patterns)
    const speakerPatterns = [
      /^[A-Z][a-zA-Z\s]+:/m,  // "John Doe:"
      /^~[^~]+~/m,            // "~SenderName~"
      /\+\d{1,3}.*\d{4}/      // Phone numbers as senders
    ];
    const hasSpeakers = speakerPatterns.some(pattern => pattern.test(text));

    // Must have at least 2 indicators to be considered a conversation
    const indicators = [
      hasPlatformIndicator,
      hasTimestamps,
      conversationIndicatorCount >= 2,
      hasSpeakers
    ].filter(Boolean).length;

    return indicators >= 2;
  }

  /**
   * PHASE 1: Analyze conversation thread extracted from screenshot
   * Parses conversation, detects scam patterns, and queries multiple AI models
   *
   * @param extractedText - OCR-extracted text from screenshot
   * @returns Comprehensive conversation analysis with multi-LLM verdict
   */
  private async analyzeConversationThread(extractedText: string): Promise<any> {
    try {
      // Parse the conversation using conversation parser service
      const conversationChain = conversationParserService.parseConversation(extractedText);

      // Require minimum message count to proceed
      if (conversationChain.messages.length < 3) {
        return {
          detected: false
        };
      }

      // Analyze conversation progression for scam patterns
      const progression = conversationParserService.analyzeProgression(conversationChain);

      // PHASE 1: Query all AI models for conversation analysis
      // This provides expert consensus on whether this is a scam
      let multiLLMAnalysis;
      try {
        const conversationData = {
          messages: conversationChain.messages,
          platform: conversationChain.metadata.platform,
          participants: conversationChain.metadata.participants,
          metadata: {
            totalMessages: conversationChain.metadata.totalMessages,
            conversationSpan: conversationChain.metadata.conversationSpan,
            redFlagCount: conversationChain.redFlags.length
          }
        };

        multiLLMAnalysis = await multiLLMService.analyzeConversation(conversationData);
      } catch (error) {
        logger.error('Multi-LLM conversation analysis failed:', error);
        multiLLMAnalysis = undefined;
      }

      return {
        detected: true,
        platform: conversationChain.metadata.platform,
        totalMessages: conversationChain.metadata.totalMessages,
        conversationSpan: conversationChain.metadata.conversationSpan,
        participants: conversationChain.metadata.participants,
        redFlags: conversationChain.redFlags,
        timeline: conversationChain.timeline,
        progression,
        multiLLMAnalysis
      };
    } catch (error) {
      logger.error('Conversation thread analysis error:', error);
      return {
        detected: false
      };
    }
  }

  /**
   * Enhanced: Generate AI-powered comprehensive verdict
   * Synthesizes all scan data into user-friendly and technical explanations
   */
  private async generateAIVerdict(data: {
    fileName: string;
    riskScore: number;
    riskLevel: string;
    findings: Finding[];
    extractedText: string;
    conversationAnalysis?: any;
    intentAnalysis?: any;
    mimeType: string;
  }): Promise<{
    simple: string;
    technical: string;
    recommendation: string;
    safetyAdvice: string[];
  }> {
    try {
      const { fileName, riskScore, riskLevel, findings, extractedText, conversationAnalysis, intentAnalysis, mimeType } = data;

      const maxScore = 350;
      const isConversationScreenshot = conversationAnalysis?.detected || false;
      const hasIntentAnalysis = intentAnalysis && intentAnalysis.scamIndicators.length > 0;

      // Build findings summary
      const criticalFindings = findings.filter(f => f.severity === 'critical');
      const highFindings = findings.filter(f => f.severity === 'high');
      const mediumFindings = findings.filter(f => f.severity === 'medium');
      const lowFindings = findings.filter(f => f.severity === 'low');

      const findingsSummary = [
        ...criticalFindings.map(f => `❗ CRITICAL: ${f.message}`),
        ...highFindings.slice(0, 5).map(f => `⚠️ HIGH: ${f.message}`)
      ].join('\n');

      // Build evidence details
      const evidenceDetails = [];

      if (isConversationScreenshot) {
        evidenceDetails.push(`
📱 CONVERSATION SCREENSHOT DETECTED:
Platform: ${conversationAnalysis.platform || 'Unknown'}
Messages: ${conversationAnalysis.totalMessages || 0}
Red Flags: ${conversationAnalysis.redFlags?.length || 0}
${conversationAnalysis.progression?.isTypicalScamProgression ? `Scam Type: ${conversationAnalysis.progression.progressionType} (${conversationAnalysis.progression.confidence}% confidence)` : ''}
${conversationAnalysis.redFlags?.map((flag: string) => `  • ${flag}`).join('\n') || ''}`);
      }

      if (hasIntentAnalysis) {
        evidenceDetails.push(`
🎯 INTENT ANALYSIS:
Primary Intent: ${intentAnalysis.primaryIntent}
Confidence: ${intentAnalysis.confidence}%
Scam Indicators: ${intentAnalysis.scamIndicators.length}
${intentAnalysis.scamIndicators.slice(0, 5).map((ind: any) => `  • ${ind.type}: ${ind.description}`).join('\n')}
${intentAnalysis.emotionalManipulation?.detected ? `Emotional Manipulation: ${intentAnalysis.emotionalManipulation.tactics.join(', ')}` : ''}
${intentAnalysis.financialSolicitation?.detected ? `Financial Solicitation: ${intentAnalysis.financialSolicitation.type}` : ''}`);
      }

      if (extractedText.length > 50) {
        evidenceDetails.push(`
📄 EXTRACTED TEXT (${extractedText.length} chars):
${extractedText.substring(0, 300)}...`);
      }

      const prompt = `You are an elite cybersecurity analyst specializing in file and screenshot threat analysis. You MUST synthesize ALL the data below into a comprehensive, accurate verdict.

═══════════════════════════════════════════════════════
📁 FILE/SCREENSHOT BEING ANALYZED
═══════════════════════════════════════════════════════
File Name: ${fileName}
File Type: ${mimeType}
${isConversationScreenshot ? 'TYPE: Message/Chat Screenshot' : 'TYPE: Document/Image File'}

═══════════════════════════════════════════════════════
📊 OVERALL RISK ASSESSMENT
═══════════════════════════════════════════════════════
Total Risk Score: ${riskScore} / ${maxScore} points
Risk Level: ${riskLevel.toUpperCase()}
Total Security Findings: ${findings.length}

Finding Distribution:
• CRITICAL Issues: ${criticalFindings.length}
• HIGH Severity: ${highFindings.length}
• MEDIUM Severity: ${mediumFindings.length}
• LOW Severity: ${lowFindings.length}

═══════════════════════════════════════════════════════
🔍 DETAILED ANALYSIS
═══════════════════════════════════════════════════════
${evidenceDetails.join('\n\n')}

═══════════════════════════════════════════════════════
🚨 CRITICAL & HIGH SEVERITY FINDINGS
═══════════════════════════════════════════════════════
${findingsSummary || 'No critical or high severity findings.'}

═══════════════════════════════════════════════════════
📝 YOUR TASK - SYNTHESIZE EVERYTHING ABOVE
═══════════════════════════════════════════════════════

Provide your response in EXACTLY this format:

**SIMPLE EXPLANATION (For Non-Technical Users):**
${isConversationScreenshot ?
  'Start with verdict emoji (🚨 SCAM / ⚠️ HIGH RISK / ⚡ SUSPICIOUS / ✓ LIKELY SAFE / ✅ SAFE). Explain in 3-4 sentences:\n1. What type of conversation this is (romance scam, fake job, investment fraud, etc.)\n2. What manipulation tactics or red flags were detected\n3. Real-world danger (money loss, identity theft, etc.)\n4. Why this is concerning' :
  'Start with verdict emoji (🚨 DANGER / ⚠️ RISKY / ⚡ CAUTION / ✓ SAFE / ✅ CLEAN). Explain in 3-4 sentences:\n1. What we found in the file/image\n2. Security risks or threats detected\n3. Real-world impact if malicious\n4. Primary concern'}
Use simple language. NO jargon.

**TECHNICAL ANALYSIS (For Security Professionals):**
Provide 4-6 sentence technical assessment covering:
${isConversationScreenshot ?
  '1. Conversation Pattern Analysis (scam progression, timeline, behavioral indicators)\n2. Content Analysis (manipulation tactics, financial solicitation, urgency tactics)\n3. Intent Classification (romance/job/investment scam, confidence score)\n4. Red Flag Enumeration (specific suspicious elements)\n5. Threat Intelligence (known scam patterns, social engineering techniques)\n6. Risk Justification (why this score, what makes it dangerous)' :
  '1. File Safety Analysis (type validation, metadata inspection)\n2. OCR Text Analysis (extracted content, URLs, phishing indicators)\n3. Malicious Content Detection (scripts, embedded threats)\n4. Brand Impersonation (logos, names detected)\n5. Metadata Forensics (EXIF, steganography indicators)\n6. Overall Threat Assessment (risk justification)'}
Reference SPECIFIC findings. Use technical terms.

**RECOMMENDATION (Immediate User Action):**
${isConversationScreenshot ?
  'Provide 2-3 actions:\n1. What to do RIGHT NOW about this conversation\n2. If already sent money/info - immediate steps\n3. How to report and protect yourself' :
  'Provide 2-3 actions:\n1. Whether to trust/use this file\n2. If already opened - protective steps\n3. Prevention advice'}
Be SPECIFIC. Start with verbs (BLOCK, DELETE, REPORT, SCAN, etc.)

**SAFETY ADVICE:**
List exactly 5 safety tips specific to THIS file/screenshot:
- Start each with emoji (🚨 ⚠️ 🔒 💳 📧 🔍 ❌ 🛡️ etc.)
- Be specific to ACTUAL findings
- Order by priority

═══════════════════════════════════════════════════════
⚠️ CRITICAL REQUIREMENTS:
═══════════════════════════════════════════════════════
- SYNTHESIZE all findings
- REFERENCE specific evidence
- ${isConversationScreenshot ? 'IDENTIFY scam type' : 'EXPLAIN file threats'}
- BE ACCURATE to actual data
- DO NOT be generic - specific to THIS ${isConversationScreenshot ? 'conversation' : 'file'}

BEGIN YOUR COMPREHENSIVE ANALYSIS NOW:`;

      const aiResponse = await aiService.query({
        query: prompt,
        model: 'claude',
        useRAG: false
      });

      // Parse AI response
      const text = aiResponse.response;

      const simpleMatch = text.match(/\*\*SIMPLE EXPLANATION.*?\*\*\s*:?\s*\n([\s\S]*?)(?=\*\*TECHNICAL ANALYSIS|\*\*RECOMMENDATION|$)/i);
      const technicalMatch = text.match(/\*\*TECHNICAL ANALYSIS.*?\*\*\s*:?\s*\n([\s\S]*?)(?=\*\*RECOMMENDATION|\*\*SAFETY ADVICE|$)/i);
      const recommendationMatch = text.match(/\*\*RECOMMENDATION.*?\*\*\s*:?\s*\n([\s\S]*?)(?=\*\*SAFETY ADVICE|$)/i);
      const safetyMatch = text.match(/\*\*SAFETY ADVICE.*?\*\*\s*:?\s*\n([\s\S]*?)$/i);

      const simple = simpleMatch ? simpleMatch[1].trim() : this.getFallbackSimple(riskLevel, isConversationScreenshot, conversationAnalysis, criticalFindings.length, highFindings.length);
      const technical = technicalMatch ? technicalMatch[1].trim() : this.getFallbackTechnical(riskLevel, riskScore, fileName, findings, isConversationScreenshot);
      const recommendation = recommendationMatch ? recommendationMatch[1].trim() : this.getFallbackRecommendation(riskLevel, isConversationScreenshot);

      let safetyAdvice: string[] = [];
      if (safetyMatch) {
        const safetyText = safetyMatch[1].trim();
        safetyAdvice = safetyText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || /^[🔒🔍✅❌⚠️🛡️💡📧💳📞🚨]/u.test(line)))
          .map(line => line.replace(/^[-•*]\s*/, '').trim())
          .slice(0, 5);
      }

      if (safetyAdvice.length === 0) {
        safetyAdvice = this.getFallbackSafetyAdvice(riskLevel, isConversationScreenshot);
      }

      logger.info(`[File AI Verdict] Generated verdict for ${fileName}`);

      return { simple, technical, recommendation, safetyAdvice };

    } catch (error) {
      logger.error('[File AI Verdict] Error generating verdict:', error);
      return this.getFallbackVerdict(data);
    }
  }

  /**
   * Fallback verdict generators
   */
  private getFallbackSimple(riskLevel: string, isConversation: boolean, conv: any, critical: number, high: number): string {
    if (isConversation) {
      if (riskLevel === 'critical') return `🚨 SCAM - DO NOT CONTINUE: This appears to be a ${conv?.progression?.progressionType || 'scam'} with ${conv?.redFlags?.length || critical} major red flags detected including manipulation tactics, financial requests, and suspicious behavioral patterns.`;
      if (riskLevel === 'high') return `⚠️ HIGH RISK - VERY SUSPICIOUS: This conversation shows ${high + critical} serious warning signs of potential scam activity including emotional manipulation and suspicious requests.`;
      if (riskLevel === 'medium') return `⚡ SUSPICIOUS - BE CAUTIOUS: We detected ${conv?.redFlags?.length || 0} concerning elements in this conversation that warrant careful review before proceeding.`;
      return `✓ APPEARS NORMAL: This conversation doesn't show obvious scam patterns, but always verify identities independently.`;
    }
    if (riskLevel === 'critical') return `🚨 DANGER - DO NOT OPEN: This file contains ${critical} critical security threats including malicious content, suspicious URLs, or dangerous file properties.`;
    if (riskLevel === 'high') return `⚠️ RISKY FILE: Detected ${high + critical} serious security issues. This file may contain phishing content, malicious links, or suspicious metadata.`;
    if (riskLevel === 'medium') return `⚡ EXERCISE CAUTION: Found some suspicious indicators. Verify source before opening or trusting content.`;
    return `✅ CLEAN: File passed security checks. No obvious threats detected.`;
  }

  private getFallbackTechnical(riskLevel: string, score: number, fileName: string, findings: Finding[], isConv: boolean): string {
    const critCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    if (isConv) return `${riskLevel.toUpperCase()} ASSESSMENT (${score}/350): Conversation analysis revealed ${critCount} critical and ${highCount} high-severity indicators. ${findings.slice(0, 3).map(f => f.message).join('; ')}.`;
    return `${riskLevel.toUpperCase()} ASSESSMENT (${score}/350): File "${fileName}" analysis found ${critCount} critical and ${highCount} high-severity findings: ${findings.slice(0, 3).map(f => f.message).join('; ')}.`;
  }

  private getFallbackRecommendation(riskLevel: string, isConv: boolean): string {
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return isConv ? 'BLOCK this contact immediately. DO NOT send money or personal information. Report to platform and authorities.' : 'DO NOT open or execute this file. Delete immediately and run security scan if already opened.';
    }
    if (riskLevel === 'medium') return isConv ? 'Verify identity through separate channel. Do not proceed with requests.' : 'Scan with antivirus before opening. Verify source legitimacy.';
    return isConv ? 'Continue with normal caution. Verify any unusual requests independently.' : 'File appears safe, but practice standard security precautions.';
  }

  private getFallbackSafetyAdvice(riskLevel: string, isConv: boolean): string[] {
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return isConv ? [
        '❌ Block and report this contact immediately',
        '🚨 Do not send money or personal information',
        '📧 Report to platform abuse team',
        '💳 Monitor accounts if you shared financial info',
        '🛡️ Warn friends/family about this scam pattern'
      ] : [
        '❌ Delete this file immediately',
        '🛡️ Run full system antivirus scan',
        '🔒 Change passwords if clicked any links',
        '📧 Report suspicious file to IT/security team',
        '💡 Verify sender identity through separate channel'
      ];
    }
    return isConv ? [
      '🔍 Verify identity through official channels',
      '❌ Never send money to people you have not met',
      '📞 Research phone numbers and profiles independently',
      '💡 Be wary of urgency tactics and sob stories',
      '🛡️ Trust your instincts - if suspicious, stop'
    ] : [
      '🔍 Scan file with updated antivirus',
      '✅ Verify sender/source is legitimate',
      '🔒 Do not enable macros in documents',
      '💡 Check file extension matches type',
      '🛡️ Keep security software updated'
    ];
  }

  private getFallbackVerdict(data: any): { simple: string; technical: string; recommendation: string; safetyAdvice: string[] } {
    const isConv = data.conversationAnalysis?.detected || false;
    const critical = data.findings.filter((f: Finding) => f.severity === 'critical').length;
    const high = data.findings.filter((f: Finding) => f.severity === 'high').length;

    return {
      simple: this.getFallbackSimple(data.riskLevel, isConv, data.conversationAnalysis, critical, high),
      technical: this.getFallbackTechnical(data.riskLevel, data.riskScore, data.fileName, data.findings, isConv),
      recommendation: this.getFallbackRecommendation(data.riskLevel, isConv),
      safetyAdvice: this.getFallbackSafetyAdvice(data.riskLevel, isConv)
    };
  }
}

export const fileScanner = new FileScanner();
