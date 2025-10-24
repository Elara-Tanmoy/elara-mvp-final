import twilio from 'twilio';
import { logger } from '../../config/logger.js';

/**
 * Twilio Sender Service
 *
 * Sends WhatsApp messages using Twilio API.
 * Handles retries and error logging.
 */
class TwilioSenderService {
  private twilioClient: twilio.Twilio;
  private whatsappNumber: string;
  private maxRetries: number = 1;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';

    if (!accountSid || !authToken) {
      logger.error('[TwilioSender] Missing Twilio credentials in environment');
      throw new Error('Twilio credentials not configured');
    }

    if (!this.whatsappNumber) {
      logger.error('[TwilioSender] Missing TWILIO_WHATSAPP_NUMBER in environment');
      throw new Error('Twilio WhatsApp number not configured');
    }

    this.twilioClient = twilio(accountSid, authToken);

    logger.info('[TwilioSender] Service initialized', {
      whatsappNumber: this.whatsappNumber
    });
  }

  /**
   * Send WhatsApp message to user
   * Returns message SID on success
   */
  public async sendMessage(
    to: string,
    message: string,
    retryCount: number = 0
  ): Promise<string> {
    try {
      // Ensure phone number has whatsapp: prefix
      const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      logger.info('[TwilioSender] Sending WhatsApp message', {
        to: toNumber,
        messageLength: message.length,
        retryCount
      });

      const response = await this.twilioClient.messages.create({
        from: this.whatsappNumber,
        to: toNumber,
        body: message
      });

      logger.info('[TwilioSender] Message sent successfully', {
        messageSid: response.sid,
        to: toNumber,
        status: response.status
      });

      return response.sid;
    } catch (error: any) {
      logger.error('[TwilioSender] Failed to send message', {
        error: error.message,
        errorCode: error.code,
        to,
        retryCount
      });

      // Retry on network errors
      if (this.shouldRetry(error) && retryCount < this.maxRetries) {
        logger.info('[TwilioSender] Retrying message send...', {
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries
        });

        // Wait 2 seconds before retry
        await this.sleep(2000);

        return this.sendMessage(to, message, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Send welcome message to new user
   */
  public async sendWelcomeMessage(to: string, welcomeText: string): Promise<string> {
    logger.info('[TwilioSender] Sending welcome message', { to });
    return this.sendMessage(to, welcomeText);
  }

  /**
   * Send scan result to user
   */
  public async sendScanResult(to: string, resultText: string): Promise<string> {
    logger.info('[TwilioSender] Sending scan result', { to });
    return this.sendMessage(to, resultText);
  }

  /**
   * Send rate limit exceeded message
   */
  public async sendRateLimitMessage(to: string, limitText: string): Promise<string> {
    logger.info('[TwilioSender] Sending rate limit message', { to });
    return this.sendMessage(to, limitText);
  }

  /**
   * Send error message to user
   */
  public async sendErrorMessage(to: string, errorText: string): Promise<string> {
    logger.info('[TwilioSender] Sending error message', { to });
    return this.sendMessage(to, errorText);
  }

  /**
   * Determine if error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, or rate limits
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      20429 // Twilio rate limit
    ];

    return retryableCodes.includes(error.code) || retryableCodes.includes(error.errorCode);
  }

  /**
   * Sleep utility for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate phone number format
   */
  public isValidPhoneNumber(phoneNumber: string): boolean {
    // Remove whatsapp: prefix if present
    const cleaned = phoneNumber.replace(/^whatsapp:/, '');

    // Must start with + and have at least 10 digits
    const phoneRegex = /^\+\d{10,15}$/;
    return phoneRegex.test(cleaned);
  }

  /**
   * Get message delivery status
   */
  public async getMessageStatus(messageSid: string): Promise<any> {
    try {
      const message = await this.twilioClient.messages(messageSid).fetch();

      logger.debug('[TwilioSender] Message status fetched', {
        messageSid,
        status: message.status
      });

      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      };
    } catch (error: any) {
      logger.error('[TwilioSender] Failed to fetch message status', {
        error: error.message,
        messageSid
      });
      throw error;
    }
  }

  /**
   * Test Twilio connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      logger.info('[TwilioSender] Testing Twilio connection...');

      // Fetch account info to test credentials
      const account = await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();

      logger.info('[TwilioSender] Twilio connection successful', {
        accountSid: account.sid,
        status: account.status
      });

      return true;
    } catch (error: any) {
      logger.error('[TwilioSender] Twilio connection failed', {
        error: error.message
      });
      return false;
    }
  }
}

// Export singleton instance
export const twilioSender = new TwilioSenderService();
