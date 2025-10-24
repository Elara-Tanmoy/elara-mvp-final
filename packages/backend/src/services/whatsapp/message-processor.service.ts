import { elaraAuthService } from './elara-auth.service.js';
import { urlExtractor } from './url-extractor.service.js';
import { logger } from '../../config/logger.js';
import axios from 'axios';
import { mediaHandler } from './media-handler.service.js';
import { profileCheckerService } from './profile-checker.service.js';
import { factCheckerService } from './fact-checker.service.js';

/**
 * Message Processor Service
 *
 * Processes WhatsApp messages and scans them using Elara APIs.
 * Supports: text/URL scanning, media files, profile checking, fact checking
 * Performs parallel API calls for optimal performance.
 */
class MessageProcessorService {
  /**
   * Process and scan a WhatsApp message with FULL feature support
   * Returns aggregated scan results
   */
  public async processMessage(
    messageText: string,
    mediaItems?: Array<{ url: string; sid: string; type: string }>
  ): Promise<{
    overallRisk: string;
    overallScore: number;
    textAnalysis: any;
    urlAnalyses: any[];
    mediaAnalyses: any[];
    profileAnalyses: any[];
    factCheckResult: any;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      logger.info('[MessageProcessor] Starting ENHANCED message processing', {
        messageLength: messageText.length,
        hasMedia: !!(mediaItems && mediaItems.length > 0),
        mediaCount: mediaItems?.length || 0
      });

      // Extract URLs and profile URLs from message
      const urls = urlExtractor.extractURLs(messageText);
      const profileUrls = profileCheckerService.extractProfileUrls(messageText);

      // Determine what type of analysis to perform
      const shouldCheckProfile = profileUrls.length > 0 || profileCheckerService.shouldCheckProfile(messageText);
      const shouldCheckFact = factCheckerService.shouldCheckFact(messageText);

      logger.info('[MessageProcessor] Analysis plan', {
        urlCount: urls.length,
        profileUrlCount: profileUrls.length,
        shouldCheckProfile,
        shouldCheckFact,
        urls: urls.slice(0, 3), // Log first 3
        profileUrls: profileUrls.slice(0, 3)
      });

      // Prepare parallel scan requests
      const scanPromises: Promise<any>[] = [];

      // 1. Scan message text (always)
      scanPromises.push(this.scanMessageText(messageText));

      // 2. Scan each URL (regular URLs, not profile URLs)
      const nonProfileUrls = urls.filter(url => !profileUrls.includes(url));
      nonProfileUrls.forEach(url => {
        scanPromises.push(this.scanURL(url));
      });

      // 3. Scan media files (if any)
      if (mediaItems && mediaItems.length > 0) {
        logger.info('[MessageProcessor] Processing media files', {
          count: mediaItems.length
        });

        mediaItems.forEach(media => {
          if (mediaHandler.isSupportedMediaType(media.type)) {
            scanPromises.push(this.scanMediaFile(media.url, media.sid, media.type));
          } else {
            logger.warn('[MessageProcessor] Unsupported media type', {
              type: media.type,
              sid: media.sid
            });
          }
        });
      }

      // 4. Check social media profiles (if detected)
      let profileAnalyses: any[] = [];
      if (shouldCheckProfile && profileUrls.length > 0) {
        logger.info('[MessageProcessor] Checking social media profiles', {
          count: profileUrls.length
        });

        const profileResults = await profileCheckerService.analyzeMultipleProfiles(profileUrls);
        profileAnalyses = profileResults;
      }

      // 5. Fact check (if detected)
      let factCheckResult: any = null;
      if (shouldCheckFact) {
        logger.info('[MessageProcessor] Performing fact check');
        factCheckResult = await factCheckerService.checkFact(messageText);
      }

      // Execute all standard scans in parallel
      const results = await Promise.allSettled(scanPromises);

      // Process results
      const textAnalysis = results[0].status === 'fulfilled' ? results[0].value : null;

      const urlStartIndex = 1;
      const urlEndIndex = urlStartIndex + nonProfileUrls.length;
      const urlAnalyses = results.slice(urlStartIndex, urlEndIndex)
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      const mediaAnalyses = results.slice(urlEndIndex)
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value)
        .filter(r => r && r.result && r.result.success !== false); // Filter out failed scans

      // Handle errors
      const errors = results.filter(r => r.status === 'rejected');
      if (errors.length > 0) {
        logger.warn('[MessageProcessor] Some scans failed', {
          totalScans: results.length,
          successful: results.length - errors.length,
          failed: errors.length,
          errorReasons: errors.map((e: any) => e.reason?.message || 'Unknown error')
        });
      }

      // Log successful analyses
      logger.info('[MessageProcessor] Scan results summary:', {
        textAnalysisSuccess: !!textAnalysis,
        urlAnalysesCount: urlAnalyses.length,
        mediaAnalysesCount: mediaAnalyses.length,
        mediaAnalysesDetails: mediaAnalyses.map(m => ({
          type: m.mediaType,
          success: m.result?.success,
          riskLevel: m.result?.riskLevel,
          hasVerdict: !!m.result?.verdict
        }))
      });

      // Aggregate risk assessment from ALL sources
      const { overallRisk, overallScore } = this.aggregateRiskAssessment(
        textAnalysis,
        urlAnalyses,
        mediaAnalyses,
        profileAnalyses,
        factCheckResult
      );

      const processingTime = Date.now() - startTime;

      logger.info('[MessageProcessor] ENHANCED message processing completed', {
        overallRisk,
        overallScore,
        hasTextAnalysis: !!textAnalysis,
        urlAnalysesCount: urlAnalyses.length,
        mediaAnalysesCount: mediaAnalyses.length,
        profileAnalysesCount: profileAnalyses.length,
        hasFactCheck: !!factCheckResult,
        processingTimeMs: processingTime
      });

      return {
        overallRisk,
        overallScore,
        textAnalysis,
        urlAnalyses,
        mediaAnalyses,
        profileAnalyses,
        factCheckResult,
        processingTime
      };
    } catch (error) {
      logger.error('[MessageProcessor] Error processing message', { error });
      throw error;
    }
  }

  /**
   * Scan message text using Elara API
   */
  private async scanMessageText(messageText: string): Promise<any> {
    try {
      logger.debug('[MessageProcessor] Scanning message text...');

      const axios = await elaraAuthService.getAuthenticatedAxios();

      const response = await axios.post('/v2/scan/message', {
        content: messageText // Note: API expects 'content' field
      });

      logger.debug('[MessageProcessor] Message text scan completed', {
        status: response.status,
        riskLevel: response.data.riskLevel
      });

      return {
        type: 'message',
        content: messageText,
        result: response.data
      };
    } catch (error: any) {
      logger.error('[MessageProcessor] Message text scan failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Scan URL using Elara API
   */
  private async scanURL(url: string): Promise<any> {
    try {
      logger.debug('[MessageProcessor] Scanning URL...', { url });

      const axios = await elaraAuthService.getAuthenticatedAxios();

      const response = await axios.post('/v2/scan/url', {
        url
      });

      logger.debug('[MessageProcessor] URL scan completed', {
        url,
        status: response.status,
        riskLevel: response.data.riskLevel
      });

      return {
        type: 'url',
        url,
        domain: urlExtractor.getDomain(url),
        isShortener: urlExtractor.isShortenerURL(url),
        result: response.data
      };
    } catch (error: any) {
      logger.error('[MessageProcessor] URL scan failed', {
        url,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Scan media file using Elara API
   */
  private async scanMediaFile(mediaUrl: string, mediaSid: string, mediaType: string): Promise<any> {
    try {
      logger.debug('[MessageProcessor] Scanning media file...', { mediaSid, mediaType });

      const result = await mediaHandler.processWhatsAppMedia(mediaUrl, mediaSid, mediaType);

      logger.debug('[MessageProcessor] Media scan completed', {
        mediaSid,
        success: result.success,
        riskLevel: result.riskLevel
      });

      return {
        type: 'media',
        mediaSid,
        mediaType,
        result
      };
    } catch (error: any) {
      logger.error('[MessageProcessor] Media scan failed', {
        mediaSid,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Aggregate risk assessment from ALL sources
   * Returns highest risk level and combined score
   */
  private aggregateRiskAssessment(
    textAnalysis: any,
    urlAnalyses: any[],
    mediaAnalyses: any[],
    profileAnalyses: any[],
    factCheckResult: any
  ): {
    overallRisk: string;
    overallScore: number;
  } {
    const riskLevels = ['safe', 'low', 'medium', 'high', 'critical'];
    const riskToScore: Record<string, number> = {
      safe: 0,
      low: 25,
      medium: 50,
      high: 75,
      critical: 100
    };

    let highestRisk = 'safe';
    let highestScore = 0;

    // Helper function to update risk
    const updateRisk = (risk: string, score: number) => {
      if (riskLevels.indexOf(risk) > riskLevels.indexOf(highestRisk)) {
        highestRisk = risk;
      }
      if (score > highestScore) {
        highestScore = score;
      }
    };

    // Check text analysis
    if (textAnalysis && textAnalysis.result) {
      const textRisk = textAnalysis.result.riskLevel || 'safe';
      const textScore = textAnalysis.result.riskScore || riskToScore[textRisk] || 0;
      updateRisk(textRisk, textScore);
    }

    // Check each URL analysis
    urlAnalyses.forEach(urlAnalysis => {
      if (urlAnalysis && urlAnalysis.result) {
        const urlRisk = urlAnalysis.result.riskLevel || 'safe';
        const urlScore = urlAnalysis.result.riskScore || riskToScore[urlRisk] || 0;
        updateRisk(urlRisk, urlScore);
      }
    });

    // Check each media analysis
    mediaAnalyses.forEach(mediaAnalysis => {
      if (mediaAnalysis && mediaAnalysis.result) {
        const mediaRisk = mediaAnalysis.result.riskLevel || 'safe';
        // CRITICAL: Skip 'error' risk level - don't count scan failures in risk aggregation
        if (mediaRisk === 'error' || mediaAnalysis.result.success === false) {
          logger.warn('[MessageProcessor] Skipping failed media scan in risk aggregation', {
            mediaType: mediaAnalysis.mediaType,
            riskLevel: mediaRisk,
            success: mediaAnalysis.result.success
          });
          return;
        }
        const mediaScore = mediaAnalysis.result.overallScore || riskToScore[mediaRisk] || 0;
        updateRisk(mediaRisk, mediaScore);
      }
    });

    // Check each profile analysis
    profileAnalyses.forEach(profileAnalysis => {
      if (profileAnalysis && profileAnalysis.success) {
        const profileRisk = profileAnalysis.riskLevel || 'safe';
        const profileScore = profileAnalysis.riskScore || riskToScore[profileRisk] || 0;
        updateRisk(profileRisk, profileScore);
      }
    });

    // Check fact check result
    if (factCheckResult && factCheckResult.success) {
      const factRisk = factCheckerService.getRiskLevelFromVeracity(factCheckResult.veracity);
      const factScore = (1 - factCheckResult.confidence) * 100; // Lower confidence = higher risk
      updateRisk(factRisk, factScore);
    }

    return {
      overallRisk: highestRisk,
      overallScore: highestScore
    };
  }

  /**
   * Quick scan using pre-browse endpoint (faster for URLs)
   */
  public async quickScanURL(url: string): Promise<any> {
    try {
      logger.debug('[MessageProcessor] Quick scanning URL...', { url });

      const axios = await elaraAuthService.getAuthenticatedAxios();

      const response = await axios.post('/v2/scan/pre-browse', {
        url
      });

      logger.debug('[MessageProcessor] Quick URL scan completed', {
        url,
        status: response.status
      });

      return {
        type: 'url',
        url,
        domain: urlExtractor.getDomain(url),
        isShortener: urlExtractor.isShortenerURL(url),
        result: response.data
      };
    } catch (error: any) {
      logger.error('[MessageProcessor] Quick URL scan failed', {
        url,
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
export const messageProcessor = new MessageProcessorService();
