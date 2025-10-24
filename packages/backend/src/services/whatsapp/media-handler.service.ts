import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger.js';
import { twilioSender } from './twilio-sender.service.js';
import { elaraAuthService } from './elara-auth.service.js';

/**
 * WhatsApp Media Handler Service
 *
 * Downloads media files from Twilio and scans them using Elara API
 */
class MediaHandlerService {
  private readonly tempDir: string;
  private readonly elaraApiBaseUrl: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'whatsapp-media');
    this.elaraApiBaseUrl = process.env.ELARA_API_BASE_URL || 'https://elara-backend-64tf.onrender.com/api';

    // Ensure temp directory exists
    this.ensureTempDirectory();
  }

  /**
   * Ensure temp directory exists
   */
  private ensureTempDirectory(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        logger.info('[MediaHandler] Created temp directory:', this.tempDir);
      }
    } catch (error) {
      logger.error('[MediaHandler] Failed to create temp directory:', error);
    }
  }

  /**
   * Download media from Twilio
   */
  public async downloadMedia(mediaUrl: string, mediaSid: string): Promise<string | null> {
    try {
      logger.info('[MediaHandler] Downloading media:', { mediaUrl, mediaSid });

      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('Twilio credentials not configured');
      }

      // Download media file from Twilio
      const response = await axios.get(mediaUrl, {
        auth: {
          username: twilioAccountSid,
          password: twilioAuthToken
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Determine file extension from content type
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const extension = this.getFileExtension(contentType);

      // Save to temp file
      const filename = `${mediaSid}${extension}`;
      const filepath = path.join(this.tempDir, filename);

      fs.writeFileSync(filepath, response.data);

      logger.info('[MediaHandler] Media downloaded successfully:', {
        filepath,
        size: response.data.length,
        contentType
      });

      return filepath;
    } catch (error) {
      logger.error('[MediaHandler] Failed to download media:', error);
      return null;
    }
  }

  /**
   * Scan media file using Elara API
   */
  public async scanMediaFile(filepath: string): Promise<any> {
    try {
      logger.info('[MediaHandler] Scanning media file:', filepath);

      // Get authentication token
      const token = await elaraAuthService.getToken();

      // Create form data
      const formData = new FormData();
      formData.append('files', fs.createReadStream(filepath)); // Fixed: changed 'file' to 'files' to match scan.controller.ts multer config

      // Call Elara file scan API
      logger.info('[MediaHandler] Sending file to Elara API', {
        filepath,
        apiUrl: `${this.elaraApiBaseUrl}/v2/scan/file`,
        hasToken: !!token
      });

      const response = await axios.post(
        `${this.elaraApiBaseUrl}/v2/scan/file`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          timeout: 180000, // 180 seconds (3 minutes) for comprehensive scan: OCR + Multi-LLM + Conversation Analysis
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      // CRITICAL FIX: Extract first scan from scans array (new API format after timing fix)
      // API now returns: { scans: [...], count: 1, status: 'completed' }
      logger.info('[MediaHandler] Raw API response received:', {
        filepath,
        responseStatus: response.status,
        hasScansArray: !!response.data.scans,
        scansCount: response.data.scans?.length || 0,
        topLevelStatus: response.data.status,
        topLevelKeys: Object.keys(response.data)
      });

      const scanData = response.data.scans && response.data.scans[0] ? response.data.scans[0] : response.data;

      // VALIDATION: Check if scan actually completed successfully
      if (!scanData || !scanData.riskLevel) {
        logger.error('[MediaHandler] Invalid scan response - missing riskLevel', {
          filepath,
          scanData: JSON.stringify(scanData).substring(0, 500)
        });
        throw new Error('Invalid scan response from API - missing riskLevel');
      }

      // Check if scan failed or is still pending
      if (scanData.status === 'failed') {
        logger.error('[MediaHandler] Scan failed according to status field', {
          filepath,
          status: scanData.status,
          errorMessage: scanData.errorMessage || 'Unknown error'
        });
        throw new Error(`Scan failed: ${scanData.errorMessage || 'Unknown error'}`);
      }

      if (scanData.status === 'pending') {
        logger.error('[MediaHandler] Scan still pending - should not happen with await', {
          filepath,
          status: scanData.status
        });
        throw new Error('Scan incomplete - still in pending status');
      }

      logger.info('[MediaHandler] File scan SUCCESSFULLY completed:', {
        filepath,
        riskLevel: scanData.riskLevel,
        riskScore: scanData.riskScore,
        status: scanData.status,
        findingsCount: scanData.findings?.length || 0,
        ocrTextLength: scanData.ocrText?.length || 0,
        hasVerdict: !!scanData.verdict,
        hasConversationAnalysis: !!scanData.conversationAnalysis,
        verdictSimple: scanData.verdict?.simple?.substring(0, 100) || 'No verdict'
      });

      // Extract FULL scan result including verdict and analyses
      return {
        success: true,
        riskLevel: scanData.riskLevel,
        overallScore: scanData.riskScore || scanData.overallScore || 0,
        threats: scanData.findings || scanData.threats || [],
        metadata: scanData.metadata || {},
        ocrText: scanData.extractedText || scanData.ocrText || null,
        contentType: scanData.fileMimeType || scanData.mimeType || scanData.contentType || 'unknown',
        ocrConfidence: scanData.ocrConfidence || null,
        // CRITICAL: Include verdict for rich WhatsApp responses
        verdict: scanData.verdict || null,
        conversationAnalysis: scanData.conversationAnalysis || null,
        intentAnalysis: scanData.intentAnalysis || null,
        findings: scanData.findings || []
      };
    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      logger.error('[MediaHandler] File scan failed:', {
        filepath,
        error: error.message,
        errorCode: error.code,
        isTimeout,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack
      });

      return {
        success: false,
        error: isTimeout
          ? 'File scan timeout - image processing taking longer than expected (OCR + AI analysis)'
          : (error.response?.data?.error || error.message || 'Unknown error'),
        riskLevel: 'error',
        overallScore: 0
      };
    }
  }

  /**
   * Process WhatsApp media (download + scan)
   */
  public async processWhatsAppMedia(
    mediaUrl: string,
    mediaSid: string,
    mediaType: string
  ): Promise<{
    success: boolean;
    riskLevel: string;
    overallScore: number;
    threats?: any[];
    ocrText?: string | null;
    ocrConfidence?: number | null;
    metadata?: any;
    contentType?: string;
    verdict?: any;
    conversationAnalysis?: any;
    intentAnalysis?: any;
    findings?: any[];
    error?: string;
  }> {
    let filepath: string | null = null;

    try {
      // 1. Download media
      filepath = await this.downloadMedia(mediaUrl, mediaSid);

      if (!filepath) {
        return {
          success: false,
          riskLevel: 'error',
          overallScore: 0,
          error: 'Failed to download media file'
        };
      }

      // 2. Scan media
      const scanResult = await this.scanMediaFile(filepath);

      return scanResult;
    } catch (error: any) {
      logger.error('[MediaHandler] Media processing failed:', error);
      return {
        success: false,
        riskLevel: 'error',
        overallScore: 0,
        error: error.message
      };
    } finally {
      // 3. Cleanup temp file
      if (filepath) {
        this.cleanupFile(filepath);
      }
    }
  }

  /**
   * Cleanup temporary file
   */
  private cleanupFile(filepath: string): void {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info('[MediaHandler] Cleaned up temp file:', filepath);
      }
    } catch (error) {
      logger.error('[MediaHandler] Failed to cleanup file:', error);
    }
  }

  /**
   * Get file extension from content type
   */
  private getFileExtension(contentType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt',
      'text/csv': '.csv'
    };

    return mimeToExt[contentType.toLowerCase()] || '.bin';
  }

  /**
   * Check if media type is supported
   */
  public isSupportedMediaType(mediaType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    return supportedTypes.includes(mediaType.toLowerCase());
  }
}

export const mediaHandler = new MediaHandlerService();
