/**
 * BLOCKCHAIN CONTROLLER
 * Handles blockchain-based scam reporting and rewards
 */

import { Request, Response } from 'express';
import { web3Service } from '../services/blockchain/web3Service.js';
import { logger } from '../config/logger.js';

export class BlockchainController {
  /**
   * POST /api/v2/blockchain/report
   * Submit a scam report to blockchain
   */
  async submitReport(req: Request, res: Response): Promise<void> {
    try {
      const { targetUrl, targetDomain, scamType, evidence } = req.body;
      const userId = (req as any).user?.id;
      const userWalletAddress = (req as any).user?.walletAddress;

      // Validation
      if (!targetUrl || !targetDomain || !scamType) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: targetUrl, targetDomain, scamType',
        });
        return;
      }

      if (!userWalletAddress) {
        res.status(400).json({
          success: false,
          error: 'User wallet address not configured. Please link your Web3 wallet.',
        });
        return;
      }

      // Submit to blockchain
      const reportId = await web3Service.submitReport(userWalletAddress, {
        targetUrl,
        targetDomain,
        scamType,
        evidence: evidence || '',
      });

      // Get reporter profile
      const profile = await web3Service.getReporterProfile(userWalletAddress);

      logger.info(`User ${userId} submitted blockchain report ${reportId} for ${targetDomain}`);

      res.json({
        success: true,
        data: {
          reportId,
          message: 'Scam report submitted to blockchain successfully',
          profile,
        },
      });
    } catch (error: any) {
      logger.error('Error submitting blockchain report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit blockchain report',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/v2/blockchain/vote
   * Vote on a blockchain report
   */
  async voteOnReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId, isUpvote } = req.body;
      const userId = (req as any).user?.id;
      const userWalletAddress = (req as any).user?.walletAddress;

      // Validation
      if (!reportId || isUpvote === undefined) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: reportId, isUpvote',
        });
        return;
      }

      if (!userWalletAddress) {
        res.status(400).json({
          success: false,
          error: 'User wallet address not configured',
        });
        return;
      }

      // Vote on blockchain
      const txHash = await web3Service.voteOnReport(reportId, isUpvote);

      logger.info(`User ${userId} voted ${isUpvote ? 'UP' : 'DOWN'} on report ${reportId}`);

      res.json({
        success: true,
        data: {
          txHash,
          message: `Vote ${isUpvote ? 'confirmed' : 'disputed'} successfully`,
        },
      });
    } catch (error: any) {
      logger.error('Error voting on report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to vote on report',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/blockchain/reports/:domain
   * Get blockchain reports for a domain
   */
  async getDomainReports(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;

      if (!domain) {
        res.status(400).json({
          success: false,
          error: 'Domain parameter required',
        });
        return;
      }

      // Get reports from blockchain
      const reports = await web3Service.getDomainReports(domain);
      const scamStatus = await web3Service.isDomainScam(domain);

      res.json({
        success: true,
        data: {
          domain,
          isScam: scamStatus.isScam,
          verifiedReportsCount: scamStatus.verifiedCount,
          totalReports: reports.length,
          reports,
        },
      });
    } catch (error: any) {
      logger.error('Error getting domain reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get domain reports',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/blockchain/profile/:address
   * Get blockchain reporter profile
   */
  async getReporterProfile(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;

      if (!address) {
        res.status(400).json({
          success: false,
          error: 'Address parameter required',
        });
        return;
      }

      const profile = await web3Service.getReporterProfile(address);

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
        });
        return;
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Error getting reporter profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get reporter profile',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/blockchain/rewards/:address
   * Get user's token rewards
   */
  async getUserRewards(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;

      if (!address) {
        res.status(400).json({
          success: false,
          error: 'Address parameter required',
        });
        return;
      }

      const stats = await web3Service.getUserRewardStats(address);
      const balance = await web3Service.getUserTokenBalance(address);

      res.json({
        success: true,
        data: {
          address,
          balance,
          ...stats,
        },
      });
    } catch (error: any) {
      logger.error('Error getting user rewards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user rewards',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/blockchain/badges/:address
   * Get user's reputation badges
   */
  async getUserBadges(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;

      if (!address) {
        res.status(400).json({
          success: false,
          error: 'Address parameter required',
        });
        return;
      }

      const badges = await web3Service.getUserBadges(address);
      const highestTier = await web3Service.getHighestBadgeTier(address);

      // Map tier numbers to names
      const tierNames = ['Bronze Defender', 'Silver Guardian', 'Gold Protector', 'Diamond Sentinel', 'Elite Validator'];

      res.json({
        success: true,
        data: {
          address,
          badges,
          highestTier: highestTier.hasBadge ? {
            tier: highestTier.tier,
            name: tierNames[highestTier.tier],
          } : null,
        },
      });
    } catch (error: any) {
      logger.error('Error getting user badges:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user badges',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/v2/blockchain/admin/distribute-reward (Admin only)
   * Distribute ELARA token rewards
   */
  async distributeReward(req: Request, res: Response): Promise<void> {
    try {
      const { recipient, amount, reason } = req.body;

      if (!recipient || !amount || !reason) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: recipient, amount, reason',
        });
        return;
      }

      const txHash = await web3Service.distributeReward({ recipient, amount, reason });

      logger.info(`Distributed ${amount} ELARA to ${recipient} - Reason: ${reason}`);

      res.json({
        success: true,
        data: {
          txHash,
          recipient,
          amount,
          reason,
          message: 'Reward distributed successfully',
        },
      });
    } catch (error: any) {
      logger.error('Error distributing reward:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to distribute reward',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/v2/blockchain/admin/batch-rewards (Admin only)
   * Batch distribute rewards
   */
  async batchDistributeRewards(req: Request, res: Response): Promise<void> {
    try {
      const { recipients, amounts, reason } = req.body;

      if (!recipients || !amounts || !reason) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: recipients, amounts, reason',
        });
        return;
      }

      if (!Array.isArray(recipients) || !Array.isArray(amounts)) {
        res.status(400).json({
          success: false,
          error: 'recipients and amounts must be arrays',
        });
        return;
      }

      if (recipients.length !== amounts.length) {
        res.status(400).json({
          success: false,
          error: 'recipients and amounts arrays must have the same length',
        });
        return;
      }

      const txHash = await web3Service.batchDistributeRewards(recipients, amounts, reason);

      logger.info(`Batch distributed rewards to ${recipients.length} users - Reason: ${reason}`);

      res.json({
        success: true,
        data: {
          txHash,
          recipientsCount: recipients.length,
          reason,
          message: 'Batch rewards distributed successfully',
        },
      });
    } catch (error: any) {
      logger.error('Error batch distributing rewards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch distribute rewards',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/v2/blockchain/admin/mint-badge (Admin only)
   * Mint a reputation badge
   */
  async mintBadge(req: Request, res: Response): Promise<void> {
    try {
      const { recipient, tier, verifiedReports, achievement } = req.body;

      if (!recipient || tier === undefined || !verifiedReports || !achievement) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: recipient, tier, verifiedReports, achievement',
        });
        return;
      }

      const txHash = await web3Service.mintBadge({
        recipient,
        tier,
        verifiedReports,
        achievement,
      });

      logger.info(`Minted badge tier ${tier} for ${recipient}`);

      res.json({
        success: true,
        data: {
          txHash,
          recipient,
          tier,
          message: 'Badge minted successfully',
        },
      });
    } catch (error: any) {
      logger.error('Error minting badge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mint badge',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/blockchain/gas-price
   * Get current gas price (public)
   */
  async getGasPrice(req: Request, res: Response): Promise<void> {
    try {
      const gasPrice = await web3Service.getGasPrice();

      res.json({
        success: true,
        data: {
          gasPrice: `${gasPrice} Gwei`,
          network: 'Polygon',
        },
      });
    } catch (error: any) {
      logger.error('Error getting gas price:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get gas price',
        details: error.message,
      });
    }
  }
}

export const blockchainController = new BlockchainController();
