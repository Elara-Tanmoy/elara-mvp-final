import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

/**
 * WhatsApp User Manager Service
 *
 * Handles auto-onboarding of WhatsApp users without requiring registration.
 * Tracks usage, rate limits, and user statistics.
 */
class WhatsAppUserManagerService {
  /**
   * Get or create WhatsApp user by phone number
   * Auto-onboards new users and sends welcome message
   */
  public async getOrCreateUser(phoneNumber: string, displayName?: string): Promise<any> {
    try {
      // Normalize phone number (remove whatsapp: prefix if present)
      const normalizedPhone = phoneNumber.replace(/^whatsapp:/, '');

      // Try to find existing user
      let user = await prisma.whatsAppUser.findUnique({
        where: { phoneNumber: normalizedPhone }
      });

      if (user) {
        logger.info('[WhatsAppUserManager] Existing user found', {
          userId: user.id,
          phoneNumber: normalizedPhone,
          totalMessages: user.totalMessages
        });

        // Reset daily counter if needed
        user = await this.resetDailyLimitIfNeeded(user);

        return user;
      }

      // Create new user (auto-onboarding)
      user = await prisma.whatsAppUser.create({
        data: {
          phoneNumber: normalizedPhone,
          displayName: displayName || null,
          tier: 'free',
          dailyMessageLimit: parseInt(process.env.WHATSAPP_FREE_TIER_DAILY_LIMIT || '5'),
          messagesUsed: 0,
          lastResetAt: new Date(),
          totalMessages: 0,
          threatsBlocked: 0,
          isActive: true,
          onboardedAt: new Date()
        }
      });

      logger.info('[WhatsAppUserManager] New user onboarded', {
        userId: user.id,
        phoneNumber: normalizedPhone,
        displayName: user.displayName,
        tier: user.tier,
        dailyLimit: user.dailyMessageLimit
      });

      return user;
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error getting/creating user', {
        error,
        phoneNumber
      });
      throw error;
    }
  }

  /**
   * Reset daily message counter if 24 hours have passed
   */
  private async resetDailyLimitIfNeeded(user: any): Promise<any> {
    const now = new Date();
    const lastReset = new Date(user.lastResetAt);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    // Reset if more than 24 hours have passed
    if (hoursSinceReset >= 24) {
      user = await prisma.whatsAppUser.update({
        where: { id: user.id },
        data: {
          messagesUsed: 0,
          lastResetAt: now
        }
      });

      logger.info('[WhatsAppUserManager] Daily limit reset', {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        hoursSinceLastReset: hoursSinceReset.toFixed(2)
      });
    }

    return user;
  }

  /**
   * Increment message usage counter
   */
  public async incrementMessageUsage(userId: string): Promise<void> {
    try {
      await prisma.whatsAppUser.update({
        where: { id: userId },
        data: {
          messagesUsed: { increment: 1 },
          totalMessages: { increment: 1 }
        }
      });

      logger.debug('[WhatsAppUserManager] Message usage incremented', { userId });
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error incrementing usage', { error, userId });
    }
  }

  /**
   * Increment threats blocked counter
   */
  public async incrementThreatsBlocked(userId: string): Promise<void> {
    try {
      await prisma.whatsAppUser.update({
        where: { id: userId },
        data: {
          threatsBlocked: { increment: 1 }
        }
      });

      logger.debug('[WhatsAppUserManager] Threats blocked incremented', { userId });
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error incrementing threats', { error, userId });
    }
  }

  /**
   * Update user tier (for premium upgrades)
   */
  public async updateUserTier(userId: string, tier: 'free' | 'premium' | 'enterprise'): Promise<void> {
    try {
      const limits: Record<string, number> = {
        free: parseInt(process.env.WHATSAPP_FREE_TIER_DAILY_LIMIT || '5'),
        premium: parseInt(process.env.WHATSAPP_PREMIUM_TIER_DAILY_LIMIT || '50'),
        enterprise: parseInt(process.env.WHATSAPP_ENTERPRISE_TIER_DAILY_LIMIT || '-1')
      };

      await prisma.whatsAppUser.update({
        where: { id: userId },
        data: {
          tier,
          dailyMessageLimit: limits[tier]
        }
      });

      logger.info('[WhatsAppUserManager] User tier updated', {
        userId,
        newTier: tier,
        newLimit: limits[tier]
      });
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error updating tier', { error, userId, tier });
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  public async deactivateUser(userId: string): Promise<void> {
    try {
      await prisma.whatsAppUser.update({
        where: { id: userId },
        data: { isActive: false }
      });

      logger.info('[WhatsAppUserManager] User deactivated', { userId });
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error deactivating user', { error, userId });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  public async getUserStats(userId: string): Promise<any> {
    try {
      const user = await prisma.whatsAppUser.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        tier: user.tier,
        totalMessages: user.totalMessages,
        messagesUsed: user.messagesUsed,
        dailyLimit: user.dailyMessageLimit,
        remainingToday: Math.max(0, user.dailyMessageLimit - user.messagesUsed),
        threatsBlocked: user.threatsBlocked,
        onboardedAt: user.onboardedAt,
        messageCount: user._count.messages
      };
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error getting user stats', { error, userId });
      throw error;
    }
  }

  /**
   * Get all active users count
   */
  public async getActiveUsersCount(): Promise<number> {
    try {
      return await prisma.whatsAppUser.count({
        where: { isActive: true }
      });
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error counting active users', { error });
      return 0;
    }
  }

  /**
   * Get total messages processed count
   */
  public async getTotalMessagesCount(): Promise<number> {
    try {
      const result = await prisma.whatsAppUser.aggregate({
        _sum: { totalMessages: true }
      });
      return result._sum.totalMessages || 0;
    } catch (error) {
      logger.error('[WhatsAppUserManager] Error counting total messages', { error });
      return 0;
    }
  }
}

// Export singleton instance
export const whatsappUserManager = new WhatsAppUserManagerService();
