import { Request, Response } from 'express';
import { webhookHandler } from '../services/whatsapp/webhook-handler.service.js';
import { logger } from '../config/logger.js';

/**
 * WhatsApp Webhook Controller
 *
 * Handles HTTP endpoints for Twilio WhatsApp webhooks.
 */
class WhatsAppWebhookController {
  /**
   * Handle incoming WhatsApp message webhook
   * POST /webhook/whatsapp
   */
  public async handleIncomingMessage(req: Request, res: Response): Promise<void> {
    logger.info('[WhatsAppWebhook] Incoming webhook request', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });

    try {
      await webhookHandler.handleIncomingMessage(req, res);
    } catch (error) {
      logger.error('[WhatsAppWebhook] Controller error', { error });

      // Only send response if not already sent
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Health check endpoint
   * GET /webhook/whatsapp/health
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      await webhookHandler.healthCheck(req, res);
    } catch (error) {
      logger.error('[WhatsAppWebhook] Health check error', { error });
      res.status(500).json({ error: 'Health check failed' });
    }
  }

  /**
   * Status endpoint
   * GET /webhook/whatsapp/status
   */
  public async getStatus(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        service: 'whatsapp-webhook',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    } catch (error) {
      logger.error('[WhatsAppWebhook] Status error', { error });
      res.status(500).json({ error: 'Status check failed' });
    }
  }
}

// Export singleton instance
export const whatsappWebhookController = new WhatsAppWebhookController();
