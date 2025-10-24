import { logger } from '../../config/logger.js';

/**
 * WhatsApp Rate Limiter Service
 *
 * Enforces daily message limits based on user tier:
 * - Free: 5 messages/day
 * - Premium: 50 messages/day
 * - Enterprise: Unlimited (-1)
 */
class WhatsAppRateLimiterService {
  /**
   * Check if user has exceeded their daily message limit
   * Returns { allowed: boolean, remaining: number, resetTime: Date }
   */
  public checkRateLimit(user: any): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    message?: string;
  } {
    // Enterprise tier: unlimited messages
    if (user.dailyMessageLimit === -1) {
      logger.debug('[WhatsAppRateLimiter] Enterprise user - unlimited', {
        userId: user.id,
        phoneNumber: user.phoneNumber
      });

      return {
        allowed: true,
        remaining: -1,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }

    // Calculate remaining messages
    const remaining = user.dailyMessageLimit - user.messagesUsed;

    // Check if limit exceeded
    if (remaining <= 0) {
      const resetTime = this.calculateResetTime(user.lastResetAt);
      const hoursUntilReset = this.getHoursUntilReset(resetTime);

      logger.warn('[WhatsAppRateLimiter] Rate limit exceeded', {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        tier: user.tier,
        limit: user.dailyMessageLimit,
        used: user.messagesUsed,
        hoursUntilReset: hoursUntilReset.toFixed(1)
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        message: this.generateLimitExceededMessage(user.tier, hoursUntilReset)
      };
    }

    // User is within their limit
    logger.debug('[WhatsAppRateLimiter] Rate limit check passed', {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      tier: user.tier,
      used: user.messagesUsed,
      limit: user.dailyMessageLimit,
      remaining
    });

    return {
      allowed: true,
      remaining,
      resetTime: this.calculateResetTime(user.lastResetAt)
    };
  }

  /**
   * Calculate when the rate limit will reset (24 hours from last reset)
   */
  private calculateResetTime(lastResetAt: Date): Date {
    const lastReset = new Date(lastResetAt);
    return new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
  }

  /**
   * Get hours until rate limit resets
   */
  private getHoursUntilReset(resetTime: Date): number {
    const now = new Date();
    const msUntilReset = resetTime.getTime() - now.getTime();
    return msUntilReset / (1000 * 60 * 60);
  }

  /**
   * Generate user-friendly rate limit exceeded message
   */
  private generateLimitExceededMessage(tier: string, hoursUntilReset: number): string {
    const hours = Math.floor(hoursUntilReset);
    const minutes = Math.floor((hoursUntilReset - hours) * 60);

    let timeString = '';
    if (hours > 0) {
      timeString = `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) {
        timeString += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    } else {
      timeString = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    return `⏳ *DAILY LIMIT REACHED*\n\nYou've used all your scans for today.\nYour limit will reset in ${timeString}.\n\n💡 Want more scans? Upgrade to Premium for 50 scans per day!`;
  }

  /**
   * Get upgrade message for free tier users
   */
  public getUpgradeMessage(remaining: number): string | null {
    // Show upgrade message when user has 1 scan remaining
    if (remaining === 1) {
      return '\n\n💡 *TIP:* You have 1 scan remaining today. Upgrade to Premium for 50 scans/day!';
    }

    return null;
  }

  /**
   * Check if user should see low balance warning
   */
  public shouldShowLowBalanceWarning(user: any): boolean {
    // Don't show for enterprise (unlimited)
    if (user.dailyMessageLimit === -1) {
      return false;
    }

    // Show warning when user has 2 or fewer scans remaining
    const remaining = user.dailyMessageLimit - user.messagesUsed;
    return remaining <= 2 && remaining > 0;
  }

  /**
   * Generate low balance warning message
   */
  public getLowBalanceWarning(user: any): string {
    const remaining = user.dailyMessageLimit - user.messagesUsed;
    return `\n\n⚠️ You have ${remaining} scan${remaining !== 1 ? 's' : ''} remaining today.`;
  }
}

// Export singleton instance
export const whatsappRateLimiter = new WhatsAppRateLimiterService();
