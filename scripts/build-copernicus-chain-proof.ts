import fs from "node:fs";
import path from "node:path";

import { keccak256, toUtf8Bytes } from "ethers";

type Snapshot = {
  lotCode?: string;
  riskScore: number;
  eudrStatus: "verified" | "non_compliant" | "unknown";
  eligibleForInvestment: boolean;
  scoreHash: string;
  scoreVersion: string;
  chain?: {
    transactionHash?: string | null;
    contractAddress?: string | null;
    chainId?: number | string;
    metadataStatus?: string;
  };
  signedPayload?: {
    payload?: {
      lotCode?: string | null;
    };
  };
};

const repoRoot = path.resolve(import.meta.dirname, "..");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function resolveRepoPath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

function writeJsonIfRequested(value: unknown) {
  const outputPath = process.env.OUTPUT_PATH;
  if (!outputPath) return;

  const resolvedPath = resolveRepoPath(outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeScoreHash(value: string) {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`scoreHash must be a 32-byte hex string, received: ${value}`);
  }
  return normalized.toLowerCase();
}

function normalizeChainId(value: unknown) {
  const chainId = Number(value ?? 31337);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`chainId must be a positive integer, received: ${String(value)}`);
  }
  return chainId;
}

const snapshotPath = resolveRepoPath(
  process.env.SNAPSHOT_PATH ?? ".docs/sentinel/sample-copernicus-snapshot.json",
);
const snapshot = readJson<Snapshot>(snapshotPath);
const lotCode =
  process.env.LOT_CODE ?? snapshot.lotCode ?? snapshot.signedPayload?.payload?.lotCode ?? undefined;

if (!lotCode) {
  throw new Error("LOT_CODE is required when the snapshot does not include lotCode.");
}

if (!Number.isInteger(snapshot.riskScore) || snapshot.riskScore < 0 || snapshot.riskScore > 100) {
  throw new Error(`riskScore must be an integer from 0 to 100, received: ${snapshot.riskScore}`);
}

if (!snapshot.scoreVersion) {
  throw new Error("scoreVersion is required.");
}

const lotId = keccak256(toUtf8Bytes(lotCode));
const scoreHash = normalizeScoreHash(snapshot.scoreHash);
const eudrCompliant = snapshot.eudrStatus === "verified";
const scoreEligible = snapshot.riskScore >= 60;
const contractInvestmentEligible = scoreEligible && eudrCompliant;
const chainId = normalizeChainId(process.env.CHAIN_ID ?? snapshot.chain?.chainId);

const proof = {
  snapshotPath: path.relative(repoRoot, snapshotPath),
  lotCode,
  lotId,
  riskScore: snapshot.riskScore,
  eudrStatus: snapshot.eudrStatus,
  eudrCompliant,
  scoreHash,
  scoreVersion: snapshot.scoreVersion,
  chain: {
    chainId,
    contractAddress: process.env.CONTRACT_ADDRESS ?? snapshot.chain?.contractAddress ?? null,
    metadataStatus: snapshot.chain?.metadataStatus ?? "pending",
    transactionHash: process.env.TX_HASH ?? snapshot.chain?.transactionHash ?? null,
  },
  gates: {
    scoreEligible,
    eudrCompliant,
    snapshotEligibleForInvestment: snapshot.eligibleForInvestment,
    contractInvestmentEligible,
  },
  contractCall: {
    contract: "HarvverseLot",
    functionName: "updateCopernicusScore",
    args: {
      lotId,
      riskScore: snapshot.riskScore,
      eudrCompliant,
      scoreHash,
      scoreVersion: snapshot.scoreVersion,
    },
  },
  dbMarker: {
    scoreHash: scoreHash.slice(2),
    chainId,
    contractAddress: process.env.CONTRACT_ADDRESS ?? snapshot.chain?.contractAddress ?? null,
    transactionHash: process.env.TX_HASH ?? snapshot.chain?.transactionHash ?? null,
    command:
      "CHAIN_WRITE_RESULT_PATH=<contract-output.json> pnpm copernicus:mark-chain-written",
  },
};

writeJsonIfRequested(proof);
console.log(JSON.stringify(proof, null, 2));

if (snapshot.eligibleForInvestment !== contractInvestmentEligible) {
  process.exitCode = 1;
}
