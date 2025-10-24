// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReputationBadges
 * @dev Soulbound NFT badges for reputation and achievements
 *
 * Badge Tiers:
 * - Bronze Defender (10+ verified reports)
 * - Silver Guardian (50+ verified reports)
 * - Gold Protector (200+ verified reports)
 * - Diamond Sentinel (500+ verified reports)
 * - Elite Validator (community voted)
 *
 * Soulbound: Cannot be transferred (except burn)
 */
contract ReputationBadges is ERC721, ERC721URIStorage, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BADGE_MANAGER_ROLE = keccak256("BADGE_MANAGER_ROLE");

    enum BadgeTier {
        BRONZE,      // 10+ verified reports
        SILVER,      // 50+ verified reports
        GOLD,        // 200+ verified reports
        DIAMOND,     // 500+ verified reports
        ELITE        // Community voted special recognition
    }

    struct Badge {
        uint256 tokenId;
        BadgeTier tier;
        address recipient;
        uint256 mintedAt;
        uint256 verifiedReportsAtMint;
        string achievement;
        bool revoked;
    }

    uint256 private _tokenIdCounter;
    mapping(uint256 => Badge) public badges;
    mapping(address => uint256[]) public userBadges;
    mapping(address => mapping(BadgeTier => bool)) public hasBadgeTier;

    // Base metadata URI
    string private _baseTokenURI;

    event BadgeMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        BadgeTier tier,
        uint256 verifiedReports
    );

    event BadgeRevoked(uint256 indexed tokenId, string reason);

    constructor(string memory baseURI) ERC721("Elara Reputation Badge", "ELARA-BADGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BADGE_MANAGER_ROLE, msg.sender);

        _baseTokenURI = baseURI;
    }

    /**
     * @dev Mint a reputation badge (Soulbound NFT)
     */
    function mintBadge(
        address recipient,
        BadgeTier tier,
        uint256 verifiedReports,
        string memory achievement
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(!hasBadgeTier[recipient][tier], "User already has this badge tier");

        // Verify achievement requirements
        if (tier == BadgeTier.BRONZE) {
            require(verifiedReports >= 10, "Insufficient reports for Bronze");
        } else if (tier == BadgeTier.SILVER) {
            require(verifiedReports >= 50, "Insufficient reports for Silver");
        } else if (tier == BadgeTier.GOLD) {
            require(verifiedReports >= 200, "Insufficient reports for Gold");
        } else if (tier == BadgeTier.DIAMOND) {
            require(verifiedReports >= 500, "Insufficient reports for Diamond");
        }
        // ELITE has no automatic requirement (manually awarded)

        uint256 tokenId = _tokenIdCounter++;

        // Create badge
        badges[tokenId] = Badge({
            tokenId: tokenId,
            tier: tier,
            recipient: recipient,
            mintedAt: block.timestamp,
            verifiedReportsAtMint: verifiedReports,
            achievement: achievement,
            revoked: false
        });

        userBadges[recipient].push(tokenId);
        hasBadgeTier[recipient][tier] = true;

        // Mint NFT
        _safeMint(recipient, tokenId);

        // Set metadata URI
        string memory uri = _constructTokenURI(tier, verifiedReports);
        _setTokenURI(tokenId, uri);

        emit BadgeMinted(tokenId, recipient, tier, verifiedReports);

        return tokenId;
    }

    /**
     * @dev Batch mint badges (gas efficient)
     */
    function batchMintBadges(
        address[] memory recipients,
        BadgeTier[] memory tiers,
        uint256[] memory verifiedReports,
        string[] memory achievements
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(recipients.length == tiers.length, "Array length mismatch");
        require(recipients.length == verifiedReports.length, "Array length mismatch");
        require(recipients.length == achievements.length, "Array length mismatch");
        require(recipients.length <= 50, "Too many recipients");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && !hasBadgeTier[recipients[i]][tiers[i]]) {
                mintBadge(recipients[i], tiers[i], verifiedReports[i], achievements[i]);
            }
        }
    }

    /**
     * @dev Revoke a badge (for fraud/abuse)
     */
    function revokeBadge(uint256 tokenId, string memory reason)
        external
        onlyRole(BADGE_MANAGER_ROLE)
    {
        require(tokenId < _tokenIdCounter, "Badge does not exist");
        require(!badges[tokenId].revoked, "Badge already revoked");

        Badge storage badge = badges[tokenId];
        badge.revoked = true;

        // Remove tier flag
        hasBadgeTier[badge.recipient][badge.tier] = false;

        // Burn the NFT
        _burn(tokenId);

        emit BadgeRevoked(tokenId, reason);
    }

    /**
     * @dev Get all badges owned by a user
     */
    function getUserBadges(address user) external view returns (Badge[] memory) {
        uint256[] memory tokenIds = userBadges[user];
        Badge[] memory userBadgeList = new Badge[](tokenIds.length);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            userBadgeList[i] = badges[tokenIds[i]];
        }

        return userBadgeList;
    }

    /**
     * @dev Get badge details
     */
    function getBadge(uint256 tokenId) external view returns (Badge memory) {
        require(tokenId < _tokenIdCounter, "Badge does not exist");
        return badges[tokenId];
    }

    /**
     * @dev Check if user has a specific badge tier
     */
    function userHasBadge(address user, BadgeTier tier) external view returns (bool) {
        return hasBadgeTier[user][tier];
    }

    /**
     * @dev Get user's highest badge tier
     */
    function getHighestBadgeTier(address user) external view returns (BadgeTier, bool) {
        if (hasBadgeTier[user][BadgeTier.ELITE]) {
            return (BadgeTier.ELITE, true);
        } else if (hasBadgeTier[user][BadgeTier.DIAMOND]) {
            return (BadgeTier.DIAMOND, true);
        } else if (hasBadgeTier[user][BadgeTier.GOLD]) {
            return (BadgeTier.GOLD, true);
        } else if (hasBadgeTier[user][BadgeTier.SILVER]) {
            return (BadgeTier.SILVER, true);
        } else if (hasBadgeTier[user][BadgeTier.BRONZE]) {
            return (BadgeTier.BRONZE, true);
        }

        return (BadgeTier.BRONZE, false); // No badge
    }

    /**
     * @dev Construct token URI based on tier
     */
    function _constructTokenURI(BadgeTier tier, uint256 verifiedReports)
        private
        pure
        returns (string memory)
    {
        string memory tierName;

        if (tier == BadgeTier.BRONZE) {
            tierName = "bronze-defender";
        } else if (tier == BadgeTier.SILVER) {
            tierName = "silver-guardian";
        } else if (tier == BadgeTier.GOLD) {
            tierName = "gold-protector";
        } else if (tier == BadgeTier.DIAMOND) {
            tierName = "diamond-sentinel";
        } else {
            tierName = "elite-validator";
        }

        return string(abi.encodePacked(tierName, ".json"));
    }

    /**
     * @dev Override to make badges Soulbound (non-transferable)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block all other transfers (Soulbound)
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: Badges cannot be transferred");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Set base URI for metadata
     */
    function setBaseURI(string memory baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Override base URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Pause minting
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause minting
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Required override for tokenURI
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev Required override for supportsInterface
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
