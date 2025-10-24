// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ScamReportRegistry
 * @dev Decentralized scam reporting system with reputation-based validation
 *
 * Features:
 * - Submit scam reports for URLs/domains
 * - Community validation (upvote/downvote)
 * - Reputation-weighted voting
 * - Automatic report verification threshold
 * - Anti-spam mechanisms
 * - Immutable audit trail
 */
contract ScamReportRegistry is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant VERIFIED_REPORTER_ROLE = keccak256("VERIFIED_REPORTER_ROLE");

    // Report structure
    struct Report {
        uint256 id;
        address reporter;
        string targetUrl;
        string targetDomain;
        string scamType; // phishing, ransomware, fake_shop, investment_scam, etc.
        string evidence; // IPFS hash or description
        uint256 timestamp;
        uint256 upvotes;
        uint256 downvotes;
        uint256 reputationScore; // Weighted score based on voter reputation
        bool verified;
        bool disputed;
        uint256 reporterReputation; // Reporter's reputation at time of report
    }

    // Reporter reputation tracking
    struct ReporterProfile {
        uint256 reputation;
        uint256 totalReports;
        uint256 verifiedReports;
        uint256 disputedReports;
        uint256 lastReportTimestamp;
        bool isBanned;
    }

    // Vote tracking
    struct Vote {
        address voter;
        bool isUpvote;
        uint256 voterReputation;
        uint256 timestamp;
    }

    // State variables
    uint256 private _reportIdCounter;
    mapping(uint256 => Report) public reports;
    mapping(string => uint256[]) public domainReports; // domain => reportIds
    mapping(address => ReporterProfile) public reporters;
    mapping(uint256 => mapping(address => Vote)) public reportVotes; // reportId => voter => Vote

    // Configuration
    uint256 public constant MIN_REPUTATION_TO_VOTE = 10;
    uint256 public constant VERIFICATION_THRESHOLD = 100; // Reputation-weighted score needed
    uint256 public constant SPAM_COOLDOWN = 1 hours;
    uint256 public constant INITIAL_REPUTATION = 50;

    // Events
    event ReportSubmitted(
        uint256 indexed reportId,
        address indexed reporter,
        string targetDomain,
        string scamType,
        uint256 timestamp
    );

    event ReportVoted(
        uint256 indexed reportId,
        address indexed voter,
        bool isUpvote,
        uint256 voterReputation
    );

    event ReportVerified(
        uint256 indexed reportId,
        uint256 finalScore
    );

    event ReportDisputed(
        uint256 indexed reportId,
        address indexed disputer
    );

    event ReputationUpdated(
        address indexed reporter,
        uint256 oldReputation,
        uint256 newReputation
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }

    /**
     * @dev Submit a new scam report
     */
    function submitReport(
        string memory targetUrl,
        string memory targetDomain,
        string memory scamType,
        string memory evidence
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(bytes(targetUrl).length > 0, "Target URL required");
        require(bytes(targetDomain).length > 0, "Target domain required");
        require(bytes(scamType).length > 0, "Scam type required");

        ReporterProfile storage reporter = reporters[msg.sender];

        // Check if banned
        require(!reporter.isBanned, "Reporter is banned");

        // Anti-spam: Check cooldown
        require(
            block.timestamp >= reporter.lastReportTimestamp + SPAM_COOLDOWN,
            "Cooldown period active"
        );

        // Initialize new reporter
        if (reporter.reputation == 0) {
            reporter.reputation = INITIAL_REPUTATION;
        }

        // Create report
        uint256 reportId = _reportIdCounter++;

        reports[reportId] = Report({
            id: reportId,
            reporter: msg.sender,
            targetUrl: targetUrl,
            targetDomain: targetDomain,
            scamType: scamType,
            evidence: evidence,
            timestamp: block.timestamp,
            upvotes: 0,
            downvotes: 0,
            reputationScore: 0,
            verified: false,
            disputed: false,
            reporterReputation: reporter.reputation
        });

        // Update mappings
        domainReports[targetDomain].push(reportId);
        reporter.totalReports++;
        reporter.lastReportTimestamp = block.timestamp;

        emit ReportSubmitted(reportId, msg.sender, targetDomain, scamType, block.timestamp);

        return reportId;
    }

    /**
     * @dev Vote on a report (upvote = confirm scam, downvote = dispute)
     */
    function voteOnReport(uint256 reportId, bool isUpvote) external whenNotPaused nonReentrant {
        require(reportId < _reportIdCounter, "Report does not exist");

        Report storage report = reports[reportId];
        require(report.reporter != msg.sender, "Cannot vote on own report");
        require(reportVotes[reportId][msg.sender].voter == address(0), "Already voted");

        ReporterProfile storage voter = reporters[msg.sender];
        require(voter.reputation >= MIN_REPUTATION_TO_VOTE, "Insufficient reputation to vote");
        require(!voter.isBanned, "Voter is banned");

        // Record vote
        reportVotes[reportId][msg.sender] = Vote({
            voter: msg.sender,
            isUpvote: isUpvote,
            voterReputation: voter.reputation,
            timestamp: block.timestamp
        });

        // Update vote counts and reputation-weighted score
        if (isUpvote) {
            report.upvotes++;
            report.reputationScore += voter.reputation;
        } else {
            report.downvotes++;
            if (report.reputationScore > voter.reputation) {
                report.reputationScore -= voter.reputation;
            } else {
                report.reputationScore = 0;
            }
        }

        emit ReportVoted(reportId, msg.sender, isUpvote, voter.reputation);

        // Check if verification threshold reached
        if (!report.verified && report.reputationScore >= VERIFICATION_THRESHOLD) {
            _verifyReport(reportId);
        }
    }

    /**
     * @dev Internal function to verify a report
     */
    function _verifyReport(uint256 reportId) private {
        Report storage report = reports[reportId];
        report.verified = true;

        // Increase reporter's reputation
        ReporterProfile storage reporter = reporters[report.reporter];
        uint256 oldReputation = reporter.reputation;
        reporter.reputation += 20; // Bonus for verified report
        reporter.verifiedReports++;

        emit ReportVerified(reportId, report.reputationScore);
        emit ReputationUpdated(report.reporter, oldReputation, reporter.reputation);
    }

    /**
     * @dev Dispute a report (moderator only for serious cases)
     */
    function disputeReport(uint256 reportId) external onlyRole(MODERATOR_ROLE) {
        require(reportId < _reportIdCounter, "Report does not exist");

        Report storage report = reports[reportId];
        require(!report.disputed, "Already disputed");

        report.disputed = true;

        // Penalize false reporter
        ReporterProfile storage reporter = reporters[report.reporter];
        if (reporter.reputation >= 30) {
            reporter.reputation -= 30;
        } else {
            reporter.reputation = 0;
        }
        reporter.disputedReports++;

        emit ReportDisputed(reportId, msg.sender);
    }

    /**
     * @dev Get all reports for a domain
     */
    function getDomainReports(string memory domain) external view returns (uint256[] memory) {
        return domainReports[domain];
    }

    /**
     * @dev Get report details
     */
    function getReport(uint256 reportId) external view returns (Report memory) {
        require(reportId < _reportIdCounter, "Report does not exist");
        return reports[reportId];
    }

    /**
     * @dev Get reporter profile
     */
    function getReporterProfile(address reporter) external view returns (ReporterProfile memory) {
        return reporters[reporter];
    }

    /**
     * @dev Check if domain has verified scam reports
     */
    function isDomainScam(string memory domain) external view returns (bool, uint256) {
        uint256[] memory reportIds = domainReports[domain];
        uint256 verifiedCount = 0;

        for (uint256 i = 0; i < reportIds.length; i++) {
            if (reports[reportIds[i]].verified && !reports[reportIds[i]].disputed) {
                verifiedCount++;
            }
        }

        return (verifiedCount > 0, verifiedCount);
    }

    /**
     * @dev Ban a reporter (moderator only)
     */
    function banReporter(address reporter) external onlyRole(MODERATOR_ROLE) {
        reporters[reporter].isBanned = true;
    }

    /**
     * @dev Unban a reporter (moderator only)
     */
    function unbanReporter(address reporter) external onlyRole(MODERATOR_ROLE) {
        reporters[reporter].isBanned = false;
    }

    /**
     * @dev Pause contract (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Get total number of reports
     */
    function getTotalReports() external view returns (uint256) {
        return _reportIdCounter;
    }
}
