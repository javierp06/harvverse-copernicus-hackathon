// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev POC carbon-credit token for the hackathon demo.
///      1 HC = 1 tCO2e represented with 2 decimals.
contract HarvverseCarbonCredit is ERC20, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    mapping(bytes32 => uint32) public issuedHundredthsByLot;

    event CarbonCreditIssued(
        bytes32 indexed lotId,
        address indexed recipient,
        bytes32 indexed scoreHash,
        bytes32 carbonHash,
        uint32 amountHundredths,
        string evidenceUri
    );

    constructor(address admin) ERC20("Harvverse Carbon Credit", "HC") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 2;
    }

    function issueCredit(
        bytes32 lotId,
        address recipient,
        bytes32 scoreHash,
        bytes32 carbonHash,
        uint32 amountHundredths,
        string calldata evidenceUri
    ) external onlyRole(OPERATOR_ROLE) {
        require(lotId != bytes32(0), "Lot ID required");
        require(recipient != address(0), "Recipient required");
        require(scoreHash != bytes32(0), "Score hash required");
        require(carbonHash != bytes32(0), "Carbon hash required");
        require(amountHundredths > 0, "Amount required");
        require(bytes(evidenceUri).length > 0, "Evidence URI required");

        issuedHundredthsByLot[lotId] += amountHundredths;
        _mint(recipient, amountHundredths);

        emit CarbonCreditIssued(
            lotId,
            recipient,
            scoreHash,
            carbonHash,
            amountHundredths,
            evidenceUri
        );
    }
}
