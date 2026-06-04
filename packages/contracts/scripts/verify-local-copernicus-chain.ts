/**
 * Verifies the local Copernicus -> contract gate in one in-memory Hardhat run.
 *
 * It deploys contracts, creates the demo lot, writes the snapshot score, reads
 * it back, and confirms HarvverseLot.isInvestmentEligible matches the snapshot.
 */

import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

const DEFAULT_LOT_CODE = "HV-HN-ZAF-L02";
const DEMO_LOT = {
  targetYieldTenthsQq: 600,
  priceCentsPerLb: 350,
  ticketCents: 342500,
  farmerShareBps: 6000,
} as const;

type CopernicusSnapshot = {
  lotCode?: string;
  riskScore: number;
  eudrStatus: "verified" | "non_compliant" | "unknown";
  eligibleForInvestment: boolean;
  scoreHash: string;
  scoreVersion: string;
  carbonCapture?: {
    methodVersion?: string;
    tCo2ePerHaYear?: number | null;
    totalTCo2ePerYear?: number | null;
  } | null;
  signedPayload?: {
    payload?: {
      lotCode?: string | null;
      carbonCapture?: CopernicusSnapshot["carbonCapture"];
    };
  };
};

const repoRoot = path.resolve(__dirname, "../../..");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJsonIfRequested(value: unknown) {
  const outputPath = process.env.OUTPUT_PATH;
  if (!outputPath) return;

  const resolvedPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(repoRoot, outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveSnapshotPath() {
  const snapshotPath = process.env.SNAPSHOT_PATH ?? ".docs/sentinel/sample-copernicus-snapshot.json";
  return path.isAbsolute(snapshotPath)
    ? snapshotPath
    : path.resolve(repoRoot, snapshotPath);
}

function toBytes32Hash(hash: string) {
  const normalized = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`scoreHash must be a 32-byte hex string, received: ${hash}`);
  }
  return normalized;
}

function carbonCaptureFromSnapshot(snapshot: CopernicusSnapshot) {
  return snapshot.carbonCapture ?? snapshot.signedPayload?.payload?.carbonCapture ?? null;
}

function toBasisPoints(value: number | null | undefined, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return Math.round(value * 100);
}

async function main() {
  const snapshotPath = resolveSnapshotPath();
  const snapshot = readJson<CopernicusSnapshot>(snapshotPath);
  const lotCode =
    process.env.LOT_CODE ??
    snapshot.lotCode ??
    snapshot.signedPayload?.payload?.lotCode ??
    DEFAULT_LOT_CODE;

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const chainId = Number(chain.chainId);
  const lotId = ethers.keccak256(ethers.toUtf8Bytes(lotCode));
  const scoreHash = toBytes32Hash(snapshot.scoreHash);
  const eudrCompliant = snapshot.eudrStatus === "verified";

  const HarvverseLot = await ethers.getContractFactory("HarvverseLot");
  const lotContract = await HarvverseLot.deploy(deployer.address);
  await lotContract.waitForDeployment();
  const lotAddress = await lotContract.getAddress();

  const CarbonEstimateRegistry = await ethers.getContractFactory("CarbonEstimateRegistry");
  const carbonRegistry = await CarbonEstimateRegistry.deploy(deployer.address);
  await carbonRegistry.waitForDeployment();
  const carbonRegistryAddress = await carbonRegistry.getAddress();

  await lotContract.createLot(
    lotId,
    deployer.address,
    DEMO_LOT.targetYieldTenthsQq,
    DEMO_LOT.priceCentsPerLb,
    DEMO_LOT.ticketCents,
    DEMO_LOT.farmerShareBps,
  );

  const tx = await lotContract.updateCopernicusScore(
    lotId,
    snapshot.riskScore,
    eudrCompliant,
    scoreHash,
    snapshot.scoreVersion,
  );
  const receipt = await tx.wait();
  const storedScore = await lotContract.getCopernicusScore(lotId);
  const contractInvestmentEligible = await lotContract.isInvestmentEligible(lotId);
  const expectedInvestmentEligible = snapshot.riskScore >= 60 && eudrCompliant;
  const carbonCapture = carbonCaptureFromSnapshot(snapshot);
  const carbonHash =
    carbonCapture == null
      ? null
      : ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(carbonCapture)));
  const carbonWrite =
    carbonCapture == null
      ? null
      : await (async () => {
          const tCo2ePerHaYearBps = toBasisPoints(
            carbonCapture.tCo2ePerHaYear,
            "carbonCapture.tCo2ePerHaYear",
          );
          const totalTCo2ePerYearBps = toBasisPoints(
            carbonCapture.totalTCo2ePerYear,
            "carbonCapture.totalTCo2ePerYear",
          );
          const methodVersion = carbonCapture.methodVersion ?? "carbon-screening-v0.1.0";
          const tx = await carbonRegistry.recordCarbonEstimate(
            lotId,
            scoreHash,
            carbonHash,
            tCo2ePerHaYearBps,
            totalTCo2ePerYearBps,
            0,
            methodVersion,
            `harvverse://copernicus/${lotCode}/carbon`,
          );
          const receipt = await tx.wait();
          const stored = await carbonRegistry.getCarbonEstimate(lotId);
          return {
            ok:
              stored.scoreHash.toLowerCase() === scoreHash.toLowerCase() &&
              stored.carbonHash.toLowerCase() === carbonHash.toLowerCase() &&
              Number(stored.tCo2ePerHaYearBps) === tCo2ePerHaYearBps &&
              Number(stored.totalTCo2ePerYearBps) === totalTCo2ePerYearBps,
            transactionHash: receipt?.hash ?? tx.hash,
            contractAddress: carbonRegistryAddress,
            carbonHash,
            tCo2ePerHaYearBps,
            totalTCo2ePerYearBps,
            state: "estimate_recorded",
            methodVersion,
          };
        })();

  const result = {
    ok:
      Number(storedScore.riskScore) === snapshot.riskScore &&
      storedScore.eudrCompliant === eudrCompliant &&
      storedScore.scoreHash.toLowerCase() === scoreHash.toLowerCase() &&
      contractInvestmentEligible === expectedInvestmentEligible &&
      snapshot.eligibleForInvestment === expectedInvestmentEligible &&
      (carbonWrite == null || carbonWrite.ok),
    network: network.name,
    chainId,
    snapshotPath: path.relative(repoRoot, snapshotPath),
    contractAddress: lotAddress,
    transactionHash: receipt?.hash ?? tx.hash,
    carbonRegistry: carbonWrite,
    lotCode,
    lotId,
    written: {
      riskScore: Number(storedScore.riskScore),
      eudrCompliant: storedScore.eudrCompliant,
      scoreHash: storedScore.scoreHash,
      scoreVersion: storedScore.scoreVersion,
    },
    gates: {
      snapshotEligibleForInvestment: snapshot.eligibleForInvestment,
      expectedInvestmentEligible,
      contractInvestmentEligible,
    },
  };

  writeJsonIfRequested(result);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
