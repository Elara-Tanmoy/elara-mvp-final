import { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

/**
 * WhatsApp Admin Controller
 *
 * Admin endpoints for managing WhatsApp users and limits
 */
class WhatsAppAdminController {
  /**
   * Get all WhatsApp users
   * GET /api/v2/admin/whatsapp/users
   */
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 50, tier, search } = req.query;

      const where: any = {};

      // Filter by tier
      if (tier) {
        where.tier = tier;
      }

      // Search by phone number or display name
      if (search) {
        where.OR = [
          { phoneNumber: { contains: search as string } },
          { displayName: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      const [users, total] = await Promise.all([
        prisma.whatsAppUser.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.whatsAppUser.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('[WhatsAppAdmin] Get all users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch WhatsApp users'
      });
    }
  }

  /**
   * Upgrade user tier
   * PATCH /api/v2/admin/whatsapp/users/:phoneNumber/tier
   */
  async upgradeUserTier(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.params;
      const { tier } = req.body;

      // Validate tier
      const validTiers = ['free', 'premium', 'enterprise'];
      if (!validTiers.includes(tier)) {
        res.status(400).json({
          success: false,
          error: 'Invalid tier. Must be: free, premium, or enterprise'
        });
        return;
      }

      // Determine daily limit based on tier
      let dailyMessageLimit = 5; // free
      if (tier === 'premium') dailyMessageLimit = 50;
      if (tier === 'enterprise') dailyMessageLimit = -1; // unlimited

      // Update user
      const user = await prisma.whatsAppUser.update({
        where: { phoneNumber },
        data: {
          tier,
          dailyMessageLimit,
          messagesUsed: 0, // Reset counter
          lastResetAt: new Date()
        }
      });

      logger.info('[WhatsAppAdmin] User tier upgraded', {
        phoneNumber,
        newTier: tier,
        newLimit: dailyMessageLimit
      });

      res.json({
        success: true,
        data: user,
        message: `User upgraded to ${tier} tier${dailyMessageLimit === -1 ? ' (unlimited)' : ` (${dailyMessageLimit} messages/day)`}`
      });
    } catch (error: any) {
      logger.error('[WhatsAppAdmin] Upgrade tier error:', error);

      if (error.code === 'P2025') {
        res.status(404).json({
          success: false,
          error: 'WhatsApp user not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to upgrade user tier'
      });
    }
  }

  /**
   * Reset user message counter
   * POST /api/v2/admin/whatsapp/users/:phoneNumber/reset
   */
  async resetUserCounter(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.params;

      const user = await prisma.whatsAppUser.update({
        where: { phoneNumber },
        data: {
          messagesUsed: 0,
          lastResetAt: new Date()
        }
      });

      logger.info('[WhatsAppAdmin] User counter reset', { phoneNumber });

      res.json({
        success: true,
        data: user,
        message: 'Message counter reset successfully'
      });
    } catch (error: any) {
      logger.error('[WhatsAppAdmin] Reset counter error:', error);

      if (error.code === 'P2025') {
        res.status(404).json({
          success: false,
          error: 'WhatsApp user not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to reset user counter'
      });
    }
  }

  /**
   * Get WhatsApp statistics
   * GET /api/v2/admin/whatsapp/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalUsers,
        activeUsers,
        totalMessages,
        totalThreatsBlocked,
        tierStats
      ] = await Promise.all([
        prisma.whatsAppUser.count(),
        prisma.whatsAppUser.count({ where: { isActive: true } }),
        prisma.whatsAppUser.aggregate({ _sum: { totalMessages: true } }),
        prisma.whatsAppUser.aggregate({ _sum: { threatsBlocked: true } }),
        prisma.whatsAppUser.groupBy({
          by: ['tier'],
          _count: true
        })
      ]);

      const tierBreakdown = tierStats.reduce((acc: any, t: any) => {
        acc[t.tier] = t._count;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          totalMessages: totalMessages._sum.totalMessages || 0,
          totalThreatsBlocked: totalThreatsBlocked._sum.threatsBlocked || 0,
          tierBreakdown
        }
      });
    } catch (error) {
      logger.error('[WhatsAppAdmin] Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch WhatsApp statistics'
      });
    }
  }

  /**
   * Bulk upgrade users to unlimited
   * POST /api/v2/admin/whatsapp/bulk-upgrade
   */
  async bulkUpgrade(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumbers, tier = 'enterprise' } = req.body;

      if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
        res.status(400).json({
          success: false,
          error: 'phoneNumbers array is required'
        });
        return;
      }

      // Determine daily limit
      let dailyMessageLimit = -1; // enterprise (unlimited)
      if (tier === 'premium') dailyMessageLimit = 50;
      if (tier === 'free') dailyMessageLimit = 5;

      // Bulk update
      const result = await prisma.whatsAppUser.updateMany({
        where: {
          phoneNumber: { in: phoneNumbers }
        },
        data: {
          tier,
          dailyMessageLimit,
          messagesUsed: 0,
          lastResetAt: new Date()
        }
      });

      logger.info('[WhatsAppAdmin] Bulk upgrade completed', {
        count: result.count,
        tier,
        phoneNumbers: phoneNumbers.slice(0, 5) // Log first 5
      });

      res.json({
        success: true,
        data: {
          updated: result.count,
          tier,
          limit: dailyMessageLimit === -1 ? 'unlimited' : dailyMessageLimit
        },
        message: `${result.count} user(s) upgraded to ${tier} tier`
      });
    } catch (error) {
      logger.error('[WhatsAppAdmin] Bulk upgrade error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk upgrade users'
      });
    }
  }

  /**
   * Get all WhatsApp messages with pagination and filtering
   * GET /api/v2/admin/whatsapp/messages
   */
  async getAllMessages(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        riskLevel,
        status,
        userId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const where: any = {};

      if (riskLevel) where.riskLevel = riskLevel;
      if (status) where.status = status;
      if (userId) where.userId = userId;

      const [messages, total] = await Promise.all([
        prisma.whatsAppMessage.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { [sortBy as string]: sortOrder },
          include: {
            user: {
              select: {
                phoneNumber: true,
                displayName: true,
                tier: true
              }
            },
            mediaFiles: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                riskLevel: true,
                createdAt: true
              }
            }
          }
        }),
        prisma.whatsAppMessage.count({ where })
      ]);

      res.json({
        success: true,
        data: messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('[WhatsAppAdmin] Get messages error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      });
    }
  }

  /**
   * Get a single message with full details including media files
   * GET /api/v2/admin/whatsapp/messages/:messageId
   */
  async getMessageDetails(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;

      const message = await prisma.whatsAppMessage.findUnique({
        where: { id: messageId },
        include: {
          user: {
            select: {
              id: true,
              phoneNumber: true,
              displayName: true,
              tier: true,
              totalMessages: true,
              threatsBlocked: true
            }
          },
          mediaFiles: true
        }
      });

      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found'
        });
        return;
      }

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      logger.error('[WhatsAppAdmin] Get message details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch message details'
      });
    }
  }

  /**
   * Download media file
   * GET /api/v2/admin/whatsapp/media/:mediaId/download
   */
  async downloadMedia(req: Request, res: Response): Promise<void> {
    try {
      const { mediaId } = req.params;

      const mediaFile = await prisma.whatsAppMediaFile.findUnique({
        where: { id: mediaId }
      });

      if (!mediaFile) {
        res.status(404).json({
          success: false,
          error: 'Media file not found'
        });
        return;
      }

      if (!mediaFile.fileData) {
        res.status(404).json({
          success: false,
          error: 'File data not available'
        });
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', mediaFile.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${mediaFile.fileName || 'download'}"`);
      if (mediaFile.fileSize) {
        res.setHeader('Content-Length', mediaFile.fileSize.toString());
      }

      // Send file data
      res.send(mediaFile.fileData);
    } catch (error) {
      logger.error('[WhatsAppAdmin] Download media error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download media'
      });
    }
  }

  /**
   * Get media file thumbnail
   * GET /api/v2/admin/whatsapp/media/:mediaId/thumbnail
   */
  async getMediaThumbnail(req: Request, res: Response): Promise<void> {
    try {
      const { mediaId } = req.params;

      const mediaFile = await prisma.whatsAppMediaFile.findUnique({
        where: { id: mediaId },
        select: {
          thumbnailData: true,
          mimeType: true,
          fileName: true
        }
      });

      if (!mediaFile || !mediaFile.thumbnailData) {
        res.status(404).json({
          success: false,
          error: 'Thumbnail not available'
        });
        return;
      }

      res.setHeader('Content-Type', mediaFile.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.send(mediaFile.thumbnailData);
    } catch (error) {
      logger.error('[WhatsAppAdmin] Get thumbnail error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch thumbnail'
      });
    }
  }
}

export const whatsappAdminController = new WhatsAppAdminController();
