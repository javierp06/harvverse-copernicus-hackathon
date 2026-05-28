/**
 * Writes a Copernicus snapshot score into HarvverseLot.
 *
 * Usage:
 *   SNAPSHOT_PATH=.docs/sentinel/sample-copernicus-snapshot.json \
 *   LOT_CODE=HV-HN-ZAF-L02 \
 *   ../../node_modules/.bin/hardhat run scripts/write-copernicus-score.ts --network localhost
 *
 *   DRY_RUN=true ../../node_modules/.bin/hardhat run scripts/write-copernicus-score.ts
 */

import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

type Snapshot = {
  lotCode?: string;
  riskScore: number;
  eudrStatus: "verified" | "non_compliant" | "unknown";
  scoreHash: string;
  scoreVersion: string;
};

type DeploymentFile = {
  contracts?: {
    harvverseLot?: string;
    HarvverseLot?: string;
  };
};

const repoRoot = path.resolve(__dirname, "../../..");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function resolveSnapshotPath() {
  const snapshotPath = process.env.SNAPSHOT_PATH ?? ".docs/sentinel/sample-copernicus-snapshot.json";
  return path.isAbsolute(snapshotPath)
    ? snapshotPath
    : path.resolve(repoRoot, snapshotPath);
}

function resolveLotAddress() {
  if (process.env.HARVVERSE_LOT_ADDRESS) return process.env.HARVVERSE_LOT_ADDRESS;

  const deploymentPath = path.resolve(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Missing HARVVERSE_LOT_ADDRESS and deployment file was not found: ${deploymentPath}`,
    );
  }

  const deployment = readJson<DeploymentFile>(deploymentPath);
  const address = deployment.contracts?.harvverseLot ?? deployment.contracts?.HarvverseLot;
  if (!address) {
    throw new Error(`Deployment file does not include HarvverseLot address: ${deploymentPath}`);
  }

  return address;
}

function toBytes32Hash(hash: string) {
  const normalized = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`scoreHash must be a 32-byte hex string, received: ${hash}`);
  }
  return normalized;
}

async function main() {
  const snapshotPath = resolveSnapshotPath();
  const snapshot = readJson<Snapshot>(snapshotPath);
  const lotCode = process.env.LOT_CODE ?? snapshot.lotCode;

  if (!lotCode) {
    throw new Error("LOT_CODE is required when the snapshot does not include lotCode.");
  }
  if (!Number.isInteger(snapshot.riskScore) || snapshot.riskScore < 0 || snapshot.riskScore > 100) {
    throw new Error(`riskScore must be an integer from 0 to 100, received: ${snapshot.riskScore}`);
  }

  const lotAddress = resolveLotAddress();
  const lotId = ethers.keccak256(ethers.toUtf8Bytes(lotCode));
  const scoreHash = toBytes32Hash(snapshot.scoreHash);
  const eudrCompliant = snapshot.eudrStatus === "verified";

  if (process.env.DRY_RUN === "true") {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          network: network.name,
          lotAddress,
          lotCode,
          lotId,
          riskScore: snapshot.riskScore,
          eudrStatus: snapshot.eudrStatus,
          eudrCompliant,
          scoreHash,
          scoreVersion: snapshot.scoreVersion,
        },
        null,
        2,
      ),
    );
    return;
  }

  const lotContract = await ethers.getContractAt("HarvverseLot", lotAddress);
  const tx = await lotContract.updateCopernicusScore(
    lotId,
    snapshot.riskScore,
    eudrCompliant,
    scoreHash,
    snapshot.scoreVersion,
  );
  const receipt = await tx.wait();

  console.log(
    JSON.stringify(
      {
        network: network.name,
        lotAddress,
        lotCode,
        lotId,
        riskScore: snapshot.riskScore,
        eudrStatus: snapshot.eudrStatus,
        eudrCompliant,
        scoreHash,
        scoreVersion: snapshot.scoreVersion,
        transactionHash: receipt?.hash ?? tx.hash,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
