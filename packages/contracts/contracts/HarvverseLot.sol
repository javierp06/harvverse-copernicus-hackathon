// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @dev Manages coffee lot lifecycle on-chain.
contract HarvverseLot is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum LotStatus {
        Created,
        Funded,
        Active,
        Harvested,
        Settled,
        Cancelled
    }

    struct LotRecord {
        bytes32 lotId;
        address farmer;
        uint32 targetYieldTenthsQq; // tenths of quintals (e.g. 600 = 60.0 qq)
        uint32 priceCentsPerLb;     // cents per lb
        uint32 ticketCents;         // farmer ticket price in cents
        uint32 farmerShareBps;      // farmer profit share in basis points (e.g. 6000 = 60%)
        LotStatus status;
        uint64 createdAt;
    }

    struct CopernicusScore {
        uint8 riskScore;
        bool eudrCompliant;
        bytes32 scoreHash;
        string scoreVersion;
        uint64 updatedAt;
    }

    mapping(bytes32 => LotRecord) public lots;
    mapping(bytes32 => CopernicusScore) public copernicusScores;

    event LotCreated(bytes32 indexed lotId, address indexed farmer);
    event LotStatusUpdated(bytes32 indexed lotId, LotStatus status);
    event CopernicusScoreUpdated(
        bytes32 indexed lotId,
        uint8 riskScore,
        bool eudrCompliant,
        bytes32 scoreHash,
        string scoreVersion
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function createLot(
        bytes32 lotId,
        address farmer,
        uint32 targetYieldTenthsQq,
        uint32 priceCentsPerLb,
        uint32 ticketCents,
        uint32 farmerShareBps
    ) external onlyRole(OPERATOR_ROLE) {
        require(lots[lotId].createdAt == 0, "Lot already exists");
        require(farmerShareBps <= 10_000, "Share exceeds 100%");

        lots[lotId] = LotRecord({
            lotId: lotId,
            farmer: farmer,
            targetYieldTenthsQq: targetYieldTenthsQq,
            priceCentsPerLb: priceCentsPerLb,
            ticketCents: ticketCents,
            farmerShareBps: farmerShareBps,
            status: LotStatus.Created,
            createdAt: uint64(block.timestamp)
        });

        emit LotCreated(lotId, farmer);
    }

    function updateLotStatus(
        bytes32 lotId,
        LotStatus newStatus
    ) external onlyRole(OPERATOR_ROLE) {
        require(lots[lotId].createdAt != 0, "Lot not found");
        lots[lotId].status = newStatus;
        emit LotStatusUpdated(lotId, newStatus);
    }

    function updateCopernicusScore(
        bytes32 lotId,
        uint8 riskScore,
        bool eudrCompliant,
        bytes32 scoreHash,
        string calldata scoreVersion
    ) external onlyRole(OPERATOR_ROLE) {
        require(lots[lotId].createdAt != 0, "Lot not found");
        require(riskScore <= 100, "Score exceeds 100");
        require(scoreHash != bytes32(0), "Score hash required");

        copernicusScores[lotId] = CopernicusScore({
            riskScore: riskScore,
            eudrCompliant: eudrCompliant,
            scoreHash: scoreHash,
            scoreVersion: scoreVersion,
            updatedAt: uint64(block.timestamp)
        });

        emit CopernicusScoreUpdated(lotId, riskScore, eudrCompliant, scoreHash, scoreVersion);
    }

    function isInvestmentEligible(bytes32 lotId) public view returns (bool) {
        CopernicusScore memory score = copernicusScores[lotId];
        return lots[lotId].createdAt != 0
            && score.updatedAt != 0
            && score.riskScore >= 60
            && score.eudrCompliant;
    }

    function getLot(bytes32 lotId) external view returns (LotRecord memory) {
        return lots[lotId];
    }

    function getCopernicusScore(bytes32 lotId) external view returns (CopernicusScore memory) {
        return copernicusScores[lotId];
    }
}
