/**
 * WEB3 SERVICE
 * Handles blockchain interactions with Elara smart contracts
 */

import { ethers } from 'ethers';
import { logger } from '../../config/logger.js';

// Contract ABIs (generated after compilation)
import ScamReportRegistryABI from '../../../blockchain-abis/ScamReportRegistry.json' with { type: 'json' };
import ElaraTokenABI from '../../../blockchain-abis/ElaraToken.json' with { type: 'json' };
import ReputationBadgesABI from '../../../blockchain-abis/ReputationBadges.json' with { type: 'json' };

interface ReportSubmission {
  targetUrl: string;
  targetDomain: string;
  scamType: string;
  evidence: string;
}

interface BlockchainReport {
  id: string;
  reporter: string;
  targetUrl: string;
  targetDomain: string;
  scamType: string;
  evidence: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  reputationScore: number;
  verified: boolean;
  disputed: boolean;
  reporterReputation: number;
}

interface ReporterProfile {
  reputation: number;
  totalReports: number;
  verifiedReports: number;
  disputedReports: number;
  lastReportTimestamp: number;
  isBanned: boolean;
}

interface RewardDistribution {
  recipient: string;
  amount: string; // in ELARA tokens (with decimals)
  reason: string;
}

interface BadgeMinting {
  recipient: string;
  tier: number; // 0=BRONZE, 1=SILVER, 2=GOLD, 3=DIAMOND, 4=ELITE
  verifiedReports: number;
  achievement: string;
}

export class Web3Service {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;

  private scamReportRegistry: ethers.Contract | null = null;
  private elaraToken: ethers.Contract | null = null;
  private reputationBadges: ethers.Contract | null = null;

  private readonly rpcUrl: string;
  private readonly privateKey: string;
  private readonly contractAddresses: {
    scamReportRegistry: string;
    elaraToken: string;
    reputationBadges: string;
  };

  constructor() {
    // Configuration from environment variables
    this.rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    this.privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || '';

    this.contractAddresses = {
      scamReportRegistry: process.env.SCAM_REPORT_REGISTRY_ADDRESS || '',
      elaraToken: process.env.ELARA_TOKEN_ADDRESS || '',
      reputationBadges: process.env.REPUTATION_BADGES_ADDRESS || '',
    };
  }

  /**
   * Initialize Web3 connection
   */
  async initialize(): Promise<void> {
    try {
      // Connect to Polygon network
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      // Verify connection
      const network = await this.provider.getNetwork();
      logger.info(`✅ Connected to blockchain: ${network.name} (Chain ID: ${network.chainId})`);

      // Initialize signer (for write operations)
      if (this.privateKey) {
        this.signer = new ethers.Wallet(this.privateKey, this.provider);
        const address = await this.signer.getAddress();
        logger.info(`✅ Signer initialized: ${address}`);
      } else {
        logger.warn('⚠️  No private key configured - read-only mode');
      }

      // Initialize contract instances
      await this.initializeContracts();

      logger.info('✅ Web3 service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Web3 service:', error);
      throw error;
    }
  }

  /**
   * Initialize smart contract instances
   */
  private async initializeContracts(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // ScamReportRegistry contract (read-only or read-write)
    if (this.contractAddresses.scamReportRegistry) {
      this.scamReportRegistry = new ethers.Contract(
        this.contractAddresses.scamReportRegistry,
        ScamReportRegistryABI.abi,
        this.signer || this.provider
      );
      logger.info(`✅ ScamReportRegistry contract loaded: ${this.contractAddresses.scamReportRegistry}`);
    }

    // ElaraToken contract
    if (this.contractAddresses.elaraToken) {
      this.elaraToken = new ethers.Contract(
        this.contractAddresses.elaraToken,
        ElaraTokenABI.abi,
        this.signer || this.provider
      );
      logger.info(`✅ ElaraToken contract loaded: ${this.contractAddresses.elaraToken}`);
    }

    // ReputationBadges contract
    if (this.contractAddresses.reputationBadges) {
      this.reputationBadges = new ethers.Contract(
        this.contractAddresses.reputationBadges,
        ReputationBadgesABI.abi,
        this.signer || this.provider
      );
      logger.info(`✅ ReputationBadges contract loaded: ${this.contractAddresses.reputationBadges}`);
    }
  }

  /**
   * SCAM REPORT REGISTRY METHODS
   */

  /**
   * Submit a scam report to blockchain
   */
  async submitReport(userAddress: string, report: ReportSubmission): Promise<string> {
    this.ensureContract(this.scamReportRegistry, 'ScamReportRegistry');
    this.ensureSigner();

    try {
      const tx = await this.scamReportRegistry!.submitReport(
        report.targetUrl,
        report.targetDomain,
        report.scamType,
        report.evidence
      );

      logger.info(`📝 Scam report transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.info(`✅ Scam report confirmed in block ${receipt.blockNumber}`);

      // Extract reportId from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.scamReportRegistry!.interface.parseLog(log);
          return parsed?.name === 'ReportSubmitted';
        } catch {
          return false;
        }
      });

      let reportId = '0';
      if (event) {
        const parsed = this.scamReportRegistry!.interface.parseLog(event);
        reportId = parsed?.args?.reportId?.toString() || '0';
      }

      return reportId;
    } catch (error: any) {
      logger.error('Failed to submit report to blockchain:', error);
      throw new Error(`Blockchain submission failed: ${error.message}`);
    }
  }

  /**
   * Vote on a scam report
   */
  async voteOnReport(reportId: string, isUpvote: boolean): Promise<string> {
    this.ensureContract(this.scamReportRegistry, 'ScamReportRegistry');
    this.ensureSigner();

    try {
      const tx = await this.scamReportRegistry!.voteOnReport(reportId, isUpvote);
      logger.info(`🗳️  Vote transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`✅ Vote confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error: any) {
      logger.error('Failed to vote on report:', error);
      throw new Error(`Vote failed: ${error.message}`);
    }
  }

  /**
   * Get reports for a domain
   */
  async getDomainReports(domain: string): Promise<BlockchainReport[]> {
    this.ensureContract(this.scamReportRegistry, 'ScamReportRegistry');

    try {
      const reportIds = await this.scamReportRegistry!.getDomainReports(domain);

      const reports: BlockchainReport[] = [];
      for (const reportId of reportIds) {
        const report = await this.scamReportRegistry!.getReport(reportId);
        reports.push({
          id: reportId.toString(),
          reporter: report.reporter,
          targetUrl: report.targetUrl,
          targetDomain: report.targetDomain,
          scamType: report.scamType,
          evidence: report.evidence,
          timestamp: Number(report.timestamp),
          upvotes: Number(report.upvotes),
          downvotes: Number(report.downvotes),
          reputationScore: Number(report.reputationScore),
          verified: report.verified,
          disputed: report.disputed,
          reporterReputation: Number(report.reporterReputation),
        });
      }

      return reports;
    } catch (error: any) {
      logger.error(`Failed to get domain reports for ${domain}:`, error);
      return [];
    }
  }

  /**
   * Check if domain is marked as scam on blockchain
   */
  async isDomainScam(domain: string): Promise<{ isScam: boolean; verifiedCount: number }> {
    this.ensureContract(this.scamReportRegistry, 'ScamReportRegistry');

    try {
      const [isScam, verifiedCount] = await this.scamReportRegistry!.isDomainScam(domain);

      return {
        isScam,
        verifiedCount: Number(verifiedCount),
      };
    } catch (error: any) {
      logger.error(`Failed to check domain scam status for ${domain}:`, error);
      return { isScam: false, verifiedCount: 0 };
    }
  }

  /**
   * Get reporter profile
   */
  async getReporterProfile(address: string): Promise<ReporterProfile | null> {
    this.ensureContract(this.scamReportRegistry, 'ScamReportRegistry');

    try {
      const profile = await this.scamReportRegistry!.getReporterProfile(address);

      return {
        reputation: Number(profile.reputation),
        totalReports: Number(profile.totalReports),
        verifiedReports: Number(profile.verifiedReports),
        disputedReports: Number(profile.disputedReports),
        lastReportTimestamp: Number(profile.lastReportTimestamp),
        isBanned: profile.isBanned,
      };
    } catch (error: any) {
      logger.error(`Failed to get reporter profile for ${address}:`, error);
      return null;
    }
  }

  /**
   * ELARA TOKEN METHODS
   */

  /**
   * Distribute rewards to a user
   */
  async distributeReward(distribution: RewardDistribution): Promise<string> {
    this.ensureContract(this.elaraToken, 'ElaraToken');
    this.ensureSigner();

    try {
      // Convert amount to wei (18 decimals)
      const amountInWei = ethers.parseEther(distribution.amount);

      const tx = await this.elaraToken!.distributeReward(
        distribution.recipient,
        amountInWei,
        distribution.reason
      );

      logger.info(`💰 Reward distribution transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`✅ Reward distributed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error: any) {
      logger.error('Failed to distribute reward:', error);
      throw new Error(`Reward distribution failed: ${error.message}`);
    }
  }

  /**
   * Batch distribute rewards (gas efficient)
   */
  async batchDistributeRewards(
    recipients: string[],
    amounts: string[],
    reason: string
  ): Promise<string> {
    this.ensureContract(this.elaraToken, 'ElaraToken');
    this.ensureSigner();

    try {
      const amountsInWei = amounts.map(amt => ethers.parseEther(amt));

      const tx = await this.elaraToken!.batchDistributeRewards(
        recipients,
        amountsInWei,
        reason
      );

      logger.info(`💰 Batch reward distribution transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`✅ Batch rewards distributed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error: any) {
      logger.error('Failed to batch distribute rewards:', error);
      throw new Error(`Batch reward distribution failed: ${error.message}`);
    }
  }

  /**
   * Get user's ELARA token balance
   */
  async getUserTokenBalance(address: string): Promise<string> {
    this.ensureContract(this.elaraToken, 'ElaraToken');

    try {
      const balance = await this.elaraToken!.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error: any) {
      logger.error(`Failed to get token balance for ${address}:`, error);
      return '0';
    }
  }

  /**
   * Get user's reward statistics
   */
  async getUserRewardStats(address: string): Promise<{
    totalRewards: string;
    currentBalance: string;
    lastReward: number;
  }> {
    this.ensureContract(this.elaraToken, 'ElaraToken');

    try {
      const stats = await this.elaraToken!.getUserRewardStats(address);

      return {
        totalRewards: ethers.formatEther(stats.totalRewards),
        currentBalance: ethers.formatEther(stats.currentBalance),
        lastReward: Number(stats.lastReward),
      };
    } catch (error: any) {
      logger.error(`Failed to get reward stats for ${address}:`, error);
      return { totalRewards: '0', currentBalance: '0', lastReward: 0 };
    }
  }

  /**
   * REPUTATION BADGES METHODS
   */

  /**
   * Mint a reputation badge
   */
  async mintBadge(badge: BadgeMinting): Promise<string> {
    this.ensureContract(this.reputationBadges, 'ReputationBadges');
    this.ensureSigner();

    try {
      const tx = await this.reputationBadges!.mintBadge(
        badge.recipient,
        badge.tier,
        badge.verifiedReports,
        badge.achievement
      );

      logger.info(`🏆 Badge minting transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`✅ Badge minted in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error: any) {
      logger.error('Failed to mint badge:', error);
      throw new Error(`Badge minting failed: ${error.message}`);
    }
  }

  /**
   * Get user's badges
   */
  async getUserBadges(address: string): Promise<any[]> {
    this.ensureContract(this.reputationBadges, 'ReputationBadges');

    try {
      const badges = await this.reputationBadges!.getUserBadges(address);
      return badges.map((badge: any) => ({
        tokenId: Number(badge.tokenId),
        tier: Number(badge.tier),
        recipient: badge.recipient,
        mintedAt: Number(badge.mintedAt),
        verifiedReportsAtMint: Number(badge.verifiedReportsAtMint),
        achievement: badge.achievement,
        revoked: badge.revoked,
      }));
    } catch (error: any) {
      logger.error(`Failed to get badges for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get user's highest badge tier
   */
  async getHighestBadgeTier(address: string): Promise<{ tier: number; hasBadge: boolean }> {
    this.ensureContract(this.reputationBadges, 'ReputationBadges');

    try {
      const [tier, hasBadge] = await this.reputationBadges!.getHighestBadgeTier(address);

      return {
        tier: Number(tier),
        hasBadge,
      };
    } catch (error: any) {
      logger.error(`Failed to get highest badge tier for ${address}:`, error);
      return { tier: 0, hasBadge: false };
    }
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const feeData = await this.provider.getFeeData();
    return ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
  }

  /**
   * Estimate transaction cost
   */
  async estimateTransactionCost(to: string, data: string): Promise<{
    gasLimit: string;
    gasPrice: string;
    estimatedCost: string;
  }> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const gasLimit = await this.provider.estimateGas({ to, data });
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;

    const estimatedCost = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      estimatedCost: ethers.formatEther(estimatedCost),
    };
  }

  /**
   * Helper: Ensure contract is initialized
   */
  private ensureContract(contract: any, name: string): void {
    if (!contract) {
      throw new Error(`${name} contract not initialized - check contract address configuration`);
    }
  }

  /**
   * Helper: Ensure signer is available (for write operations)
   */
  private ensureSigner(): void {
    if (!this.signer) {
      throw new Error('No signer available - write operations require BLOCKCHAIN_PRIVATE_KEY');
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.provider) {
      await this.provider.destroy();
      this.provider = null;
      logger.info('Web3 service connection closed');
    }
  }
}

// Singleton instance
export const web3Service = new Web3Service();
