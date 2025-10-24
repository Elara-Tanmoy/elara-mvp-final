import { Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';
import { whatsappUserManager } from './user-manager.service.js';
import { whatsappRateLimiter } from './rate-limiter.service.js';
import { messageProcessor } from './message-processor.service.js';
import { responseFormatter } from './response-formatter.service.js';
import { twilioSender } from './twilio-sender.service.js';

/**
 * WhatsApp Webhook Handler Service
 *
 * Main orchestrator for WhatsApp integration.
 * Handles incoming Twilio webhooks, validates signatures,
 * processes messages, and sends responses.
 */
class WebhookHandlerService {
  private readonly authToken: string;

  constructor() {
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';

    if (!this.authToken) {
      logger.error('[WebhookHandler] Missing TWILIO_AUTH_TOKEN');
      throw new Error('Twilio auth token not configured');
    }
  }

  /**
   * Handle incoming WhatsApp message webhook
   */
  public async handleIncomingMessage(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate Twilio signature
      if (!this.validateTwilioSignature(req)) {
        logger.warn('[WebhookHandler] Invalid Twilio signature', {
          ip: req.ip,
          url: req.url
        });
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }

      // Extract webhook data
      const {
        From: from,
        Body: messageBody,
        ProfileName: profileName,
        MessageSid: messageSid,
        NumMedia: numMedia
      } = req.body;

      // Extract media files if present
      const mediaItems: Array<{ url: string; sid: string; type: string }> = [];
      const mediaCount = parseInt(numMedia || '0');

      for (let i = 0; i < mediaCount; i++) {
        const mediaUrl = req.body[`MediaUrl${i}`];
        const mediaType = req.body[`MediaContentType${i}`];
        const mediaSid = req.body[`MediaSid${i}`] || `${messageSid}_media_${i}`;

        if (mediaUrl && mediaType) {
          mediaItems.push({
            url: mediaUrl,
            sid: mediaSid,
            type: mediaType
          });
        }
      }

      logger.info('[WebhookHandler] Incoming WhatsApp message', {
        from,
        profileName,
        messageSid,
        bodyLength: messageBody?.length || 0,
        numMedia: mediaCount,
        mediaItems: mediaItems.map(m => ({ type: m.type, sid: m.sid }))
      });

      // Respond immediately to Twilio (200 OK)
      // This prevents timeout while we process
      res.status(200).send('');

      // Process message asynchronously
      await this.processMessageAsync(
        from,
        messageBody,
        profileName,
        messageSid,
        mediaItems
      );

      const processingTime = Date.now() - startTime;
      logger.info('[WebhookHandler] Webhook processed', {
        from,
        processingTimeMs: processingTime
      });
    } catch (error) {
      logger.error('[WebhookHandler] Error handling webhook', { error });
      // Don't re-throw - we already sent 200 OK to Twilio
    }
  }

  /**
   * Process message asynchronously (after responding to Twilio)
   */
  private async processMessageAsync(
    from: string,
    messageBody: string,
    profileName: string,
    messageSid: string,
    mediaItems: Array<{ url: string; sid: string; type: string }>
  ): Promise<void> {
    try {
      // 1. Get or create user (auto-onboarding)
      const user = await whatsappUserManager.getOrCreateUser(from, profileName);
      const isNewUser = user.totalMessages === 0;

      // 2. Send welcome message to new users
      if (isNewUser) {
        const welcomeMessage = responseFormatter.formatWelcomeMessage(profileName);
        await twilioSender.sendWelcomeMessage(from, welcomeMessage);
        logger.info('[WebhookHandler] Welcome message sent to new user', {
          userId: user.id,
          phoneNumber: from
        });
      }

      // 3. Check rate limit
      const rateLimitCheck = whatsappRateLimiter.checkRateLimit(user);

      if (!rateLimitCheck.allowed) {
        const resetHours = (rateLimitCheck.resetTime.getTime() - Date.now()) / (1000 * 60 * 60);
        const limitMessage = responseFormatter.formatRateLimitMessage(resetHours);
        await twilioSender.sendRateLimitMessage(from, limitMessage);

        logger.warn('[WebhookHandler] Rate limit exceeded', {
          userId: user.id,
          phoneNumber: from
        });
        return;
      }

      // 4. Save incoming message to database
      await prisma.whatsAppMessage.create({
        data: {
          userId: user.id,
          messageSid,
          messageBody,
          mediaCount: mediaItems.length,
          mediaUrls: mediaItems.map(m => m.url),
          status: 'received'
        }
      });

      // 5. Check if message has content to scan
      if ((!messageBody || messageBody.trim().length === 0) && mediaItems.length === 0) {
        const errorMessage = responseFormatter.formatErrorMessage();
        await twilioSender.sendErrorMessage(from, errorMessage);
        return;
      }

      // 6. Process and scan the message with FULL features
      logger.info('[WebhookHandler] Processing message with FULL analysis...', {
        userId: user.id,
        messageLength: messageBody?.length || 0,
        mediaCount: mediaItems.length
      });

      const scanResults = await messageProcessor.processMessage(messageBody || '', mediaItems);

      // 7. Update message with scan results
      await prisma.whatsAppMessage.updateMany({
        where: { messageSid },
        data: {
          riskLevel: scanResults.overallRisk,
          overallScore: scanResults.overallScore,
          processingTime: scanResults.processingTime,
          status: 'processed',
          processedAt: new Date()
        }
      });

      // 8. Increment usage counter
      await whatsappUserManager.incrementMessageUsage(user.id);

      // 9. Increment threats blocked if threat detected
      if (['high', 'critical'].includes(scanResults.overallRisk)) {
        await whatsappUserManager.incrementThreatsBlocked(user.id);
      }

      // 10. Format response message with ALL analysis types
      let responseMessage = responseFormatter.formatScanResults(
        scanResults.overallRisk,
        scanResults.overallScore,
        scanResults.textAnalysis,
        scanResults.urlAnalyses,
        scanResults.mediaAnalyses,
        scanResults.profileAnalyses,
        scanResults.factCheckResult
      );

      // 11. Add low balance warning if needed
      if (whatsappRateLimiter.shouldShowLowBalanceWarning(user)) {
        const warning = whatsappRateLimiter.getLowBalanceWarning(user);
        responseMessage += warning;
      }

      // 12. Send response to user
      await twilioSender.sendScanResult(from, responseMessage);

      logger.info('[WebhookHandler] Message processed successfully', {
        userId: user.id,
        phoneNumber: from,
        overallRisk: scanResults.overallRisk,
        processingTimeMs: scanResults.processingTime
      });
    } catch (error: any) {
      logger.error('[WebhookHandler] Error processing message', {
        error: error.message,
        from,
        messageSid
      });

      // Try to send error message to user
      try {
        const errorType = error.message?.includes('timeout') ? 'timeout' : undefined;
        const errorMessage = responseFormatter.formatErrorMessage(errorType);
        await twilioSender.sendErrorMessage(from, errorMessage);
      } catch (sendError) {
        logger.error('[WebhookHandler] Failed to send error message', { sendError });
      }

      // Update message status to failed
      try {
        await prisma.whatsAppMessage.updateMany({
          where: { messageSid },
          data: {
            status: 'failed',
            errorMessage: error.message,
            processedAt: new Date()
          }
        });
      } catch (dbError) {
        logger.error('[WebhookHandler] Failed to update message status', { dbError });
      }
    }
  }

  /**
   * Validate Twilio webhook signature
   */
  private validateTwilioSignature(req: Request): boolean {
    try {
      const signature = req.headers['x-twilio-signature'] as string;

      if (!signature) {
        logger.warn('[WebhookHandler] Missing X-Twilio-Signature header');
        return false;
      }

      // Get full URL
      const protocol = req.protocol;
      const host = req.get('host');
      const url = `${protocol}://${host}${req.originalUrl}`;

      // Create expected signature
      const expectedSignature = this.computeTwilioSignature(url, req.body);

      // Compare signatures
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.warn('[WebhookHandler] Signature mismatch', {
          url,
          receivedSignature: signature.substring(0, 20) + '...',
          expectedSignature: expectedSignature.substring(0, 20) + '...'
        });
      }

      return isValid;
    } catch (error) {
      logger.error('[WebhookHandler] Error validating signature', { error });
      return false;
    }
  }

  /**
   * Compute Twilio signature
   */
  private computeTwilioSignature(url: string, params: any): string {
    // Sort parameters and build string
    const sortedKeys = Object.keys(params).sort();
    let data = url;

    sortedKeys.forEach(key => {
      data += key + params[key];
    });

    // Create HMAC-SHA1 signature
    const hmac = crypto.createHmac('sha1', this.authToken);
    hmac.update(data);

    return hmac.digest('base64');
  }

  /**
   * Health check for webhook endpoint
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      // Check Twilio connection
      const twilioOk = await twilioSender.testConnection();

      res.json({
        status: 'ok',
        service: 'whatsapp-webhook',
        timestamp: new Date().toISOString(),
        database: 'connected',
        twilio: twilioOk ? 'connected' : 'error'
      });
    } catch (error) {
      logger.error('[WebhookHandler] Health check failed', { error });
      res.status(500).json({
        status: 'error',
        service: 'whatsapp-webhook',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  }
}

// Export singleton instance
export const webhookHandler = new WebhookHandlerService();
