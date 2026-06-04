// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @dev Records carbon-estimate evidence for a lot. This is an audit registry,
/// not a transferable carbon-credit token and not an MRV certification.
contract CarbonEstimateRegistry is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum CarbonState {
        EstimateRecorded,
        FieldInventoryPending,
        MrvSubmitted,
        Verified
    }

    struct CarbonEstimate {
        bytes32 lotId;
        bytes32 scoreHash;
        bytes32 carbonHash;
        uint32 tCo2ePerHaYearBps;
        uint32 totalTCo2ePerYearBps;
        CarbonState state;
        string methodVersion;
        string evidenceUri;
        uint64 updatedAt;
    }

    mapping(bytes32 => CarbonEstimate) private _estimates;

    event CarbonEstimateRecorded(
        bytes32 indexed lotId,
        bytes32 indexed scoreHash,
        bytes32 carbonHash,
        uint32 tCo2ePerHaYearBps,
        uint32 totalTCo2ePerYearBps,
        CarbonState state,
        string methodVersion,
        string evidenceUri
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function recordCarbonEstimate(
        bytes32 lotId,
        bytes32 scoreHash,
        bytes32 carbonHash,
        uint32 tCo2ePerHaYearBps,
        uint32 totalTCo2ePerYearBps,
        CarbonState state,
        string calldata methodVersion,
        string calldata evidenceUri
    ) external onlyRole(OPERATOR_ROLE) {
        require(lotId != bytes32(0), "Lot ID required");
        require(scoreHash != bytes32(0), "Score hash required");
        require(carbonHash != bytes32(0), "Carbon hash required");
        require(tCo2ePerHaYearBps > 0, "Per-hectare estimate required");
        require(totalTCo2ePerYearBps > 0, "Total estimate required");
        require(bytes(methodVersion).length > 0, "Method version required");
        require(uint8(state) <= uint8(CarbonState.Verified), "Invalid carbon state");
        require(bytes(evidenceUri).length > 0, "Evidence URI required");

        _estimates[lotId] = CarbonEstimate({
            lotId: lotId,
            scoreHash: scoreHash,
            carbonHash: carbonHash,
            tCo2ePerHaYearBps: tCo2ePerHaYearBps,
            totalTCo2ePerYearBps: totalTCo2ePerYearBps,
            state: state,
            methodVersion: methodVersion,
            evidenceUri: evidenceUri,
            updatedAt: uint64(block.timestamp)
        });

        emit CarbonEstimateRecorded(
            lotId,
            scoreHash,
            carbonHash,
            tCo2ePerHaYearBps,
            totalTCo2ePerYearBps,
            state,
            methodVersion,
            evidenceUri
        );
    }

    function getCarbonEstimate(bytes32 lotId) external view returns (CarbonEstimate memory) {
        return _estimates[lotId];
    }

    function hasCarbonEstimate(bytes32 lotId) external view returns (bool) {
        return _estimates[lotId].updatedAt != 0;
    }
}
