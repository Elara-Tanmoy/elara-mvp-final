// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ElaraToken
 * @dev $ELARA - Utility token for Elara platform rewards
 *
 * Token Economics:
 * - Total Supply: 1,000,000,000 ELARA (1 billion)
 * - Rewards for verified scam reports: 10-100 ELARA
 * - Rewards for community validation: 1-10 ELARA
 * - Staking for premium features
 * - Governance rights (future)
 *
 * Distribution:
 * - 40% Community Rewards Pool
 * - 30% Team & Development
 * - 20% Platform Reserve
 * - 10% Initial Liquidity
 */
contract ElaraToken is ERC20, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REWARDS_DISTRIBUTOR_ROLE = keccak256("REWARDS_DISTRIBUTOR_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant COMMUNITY_REWARDS_ALLOCATION = 400_000_000 * 10**18; // 40%
    uint256 public constant TEAM_ALLOCATION = 300_000_000 * 10**18; // 30%
    uint256 public constant PLATFORM_RESERVE = 200_000_000 * 10**18; // 20%
    uint256 public constant INITIAL_LIQUIDITY = 100_000_000 * 10**18; // 10%

    // Reward tracking
    mapping(address => uint256) public lifetimeRewards;
    mapping(address => uint256) public lastRewardTimestamp;

    // Vesting for team tokens
    uint256 public teamVestingStart;
    uint256 public constant VESTING_DURATION = 2 * 365 days; // 2 years
    uint256 public teamTokensClaimed;

    address public communityRewardsPool;
    address public teamWallet;
    address public platformReserve;

    event RewardDistributed(address indexed recipient, uint256 amount, string reason);
    event TeamTokensClaimed(address indexed recipient, uint256 amount);

    constructor(
        address _communityRewardsPool,
        address _teamWallet,
        address _platformReserve
    ) ERC20("Elara Token", "ELARA") {
        require(_communityRewardsPool != address(0), "Invalid community pool");
        require(_teamWallet != address(0), "Invalid team wallet");
        require(_platformReserve != address(0), "Invalid platform reserve");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(REWARDS_DISTRIBUTOR_ROLE, msg.sender);

        communityRewardsPool = _communityRewardsPool;
        teamWallet = _teamWallet;
        platformReserve = _platformReserve;
        teamVestingStart = block.timestamp;

        // Mint initial allocations
        _mint(communityRewardsPool, COMMUNITY_REWARDS_ALLOCATION);
        _mint(platformReserve, PLATFORM_RESERVE);
        _mint(msg.sender, INITIAL_LIQUIDITY); // For initial DEX liquidity

        // Team tokens will be vested over time (minted on claim)
    }

    /**
     * @dev Distribute rewards to users
     */
    function distributeReward(
        address recipient,
        uint256 amount,
        string memory reason
    ) external onlyRole(REWARDS_DISTRIBUTOR_ROLE) whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(communityRewardsPool) >= amount, "Insufficient rewards pool");

        // Transfer from community rewards pool
        _transfer(communityRewardsPool, recipient, amount);

        lifetimeRewards[recipient] += amount;
        lastRewardTimestamp[recipient] = block.timestamp;

        emit RewardDistributed(recipient, amount, reason);
    }

    /**
     * @dev Batch distribute rewards (gas efficient)
     */
    function batchDistributeRewards(
        address[] memory recipients,
        uint256[] memory amounts,
        string memory reason
    ) external onlyRole(REWARDS_DISTRIBUTOR_ROLE) whenNotPaused {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length <= 100, "Too many recipients"); // Gas limit protection

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(balanceOf(communityRewardsPool) >= totalAmount, "Insufficient rewards pool");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && amounts[i] > 0) {
                _transfer(communityRewardsPool, recipients[i], amounts[i]);
                lifetimeRewards[recipients[i]] += amounts[i];
                lastRewardTimestamp[recipients[i]] = block.timestamp;

                emit RewardDistributed(recipients[i], amounts[i], reason);
            }
        }
    }

    /**
     * @dev Claim vested team tokens
     */
    function claimTeamTokens() external {
        require(msg.sender == teamWallet, "Only team wallet");

        uint256 vestedAmount = calculateVestedAmount();
        uint256 claimableAmount = vestedAmount - teamTokensClaimed;

        require(claimableAmount > 0, "No tokens to claim");
        require(totalSupply() + claimableAmount <= MAX_SUPPLY, "Exceeds max supply");

        teamTokensClaimed += claimableAmount;
        _mint(teamWallet, claimableAmount);

        emit TeamTokensClaimed(teamWallet, claimableAmount);
    }

    /**
     * @dev Calculate vested team tokens based on time
     */
    function calculateVestedAmount() public view returns (uint256) {
        if (block.timestamp < teamVestingStart) {
            return 0;
        }

        uint256 elapsed = block.timestamp - teamVestingStart;

        if (elapsed >= VESTING_DURATION) {
            return TEAM_ALLOCATION;
        }

        return (TEAM_ALLOCATION * elapsed) / VESTING_DURATION;
    }

    /**
     * @dev Emergency mint (admin only, capped at MAX_SUPPLY)
     */
    function emergencyMint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Pause token transfers (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Hook that is called before any transfer of tokens
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override whenNotPaused {
        super._update(from, to, value);
    }

    /**
     * @dev Get user's reward statistics
     */
    function getUserRewardStats(address user) external view returns (
        uint256 totalRewards,
        uint256 currentBalance,
        uint256 lastReward
    ) {
        return (
            lifetimeRewards[user],
            balanceOf(user),
            lastRewardTimestamp[user]
        );
    }

    /**
     * @dev Get remaining community rewards pool
     */
    function getRemainingRewardsPool() external view returns (uint256) {
        return balanceOf(communityRewardsPool);
    }
}
