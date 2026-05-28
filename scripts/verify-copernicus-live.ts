import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { buildLiveCopernicusSnapshot } from "../packages/api/src/lib/copernicus";
import {
  getSentinelHubCredentials,
  getSentinelHubToken,
} from "../packages/api/src/lib/copernicus/sentinel-hub";
import type { Sentinel2Polygon } from "../packages/api/src/lib/copernicus/sentinel-2";

dotenv.config({ path: path.resolve("apps/web/.env"), quiet: true });
dotenv.config({ path: path.resolve(".env"), quiet: true });

type SampleSnapshot = {
  lotId: number;
  farmId: number;
  lotCode?: string;
  farmName: string;
  region: string;
  country: string;
  polygon?: Sentinel2Polygon;
  dem?: {
    altitudeMasl?: number | null;
    areaManzanas?: number | null;
  };
};

const samplePath = path.resolve(".docs/sentinel/sample-copernicus-snapshot.json");
const sample = JSON.parse(fs.readFileSync(samplePath, "utf8")) as SampleSnapshot;

if (!sample.polygon) {
  throw new Error(`Sample snapshot does not include a polygon: ${samplePath}`);
}

const credentials = getSentinelHubCredentials(process.env);
if (!credentials) {
  throw new Error(
    "Missing SENTINEL_HUB_CLIENT_ID or SENTINEL_HUB_CLIENT_SECRET in apps/web/.env.",
  );
}

const token = await getSentinelHubToken(credentials);
const snapshot = await buildLiveCopernicusSnapshot(
  {
    id: sample.lotId,
    farmId: sample.farmId,
    code: sample.lotCode ?? "HV-HN-ZAF-L02",
    farmName: sample.farmName,
    region: sample.region,
    country: sample.country,
    altitudeMasl: sample.dem?.altitudeMasl ?? null,
    areaManzanas: sample.dem?.areaManzanas ?? null,
    polygon: sample.polygon,
  },
  token,
);

const sourceModes = Object.fromEntries(
  snapshot.sources.map((source) => [source.key, source.mode]),
);
const summary = {
  sourceMode: snapshot.sourceMode,
  scoreVersion: snapshot.scoreVersion,
  riskScore: snapshot.riskScore,
  riskTier: snapshot.riskTier,
  eudrStatus: snapshot.eudrStatus,
  eligibleForInvestment: snapshot.eligibleForInvestment,
  sourceModes,
  sentinel2Months: snapshot.sentinel2.historicalSeries.length,
  sentinel2CurrentNdvi: snapshot.sentinel2.currentNdvi,
  sentinel2CurrentNdre: snapshot.sentinel2.currentNdre,
  sentinel2CurrentNdwi: snapshot.sentinel2.currentNdwi,
  sentinel2CurrentMsi: snapshot.sentinel2.currentMsi,
  sentinel1MoistureProxy: snapshot.sentinel1.moistureProxy,
  sentinel1StructuralChangeSignal: snapshot.sentinel1.structuralChangeSignal,
  sentinel1VhVvRatio: snapshot.sentinel1.vhVvRatio,
  sentinel1RadarVegetationIndex: snapshot.sentinel1.radarVegetationIndex,
  annualRainfallMm: snapshot.era5.annualRainfallMm,
  meanTemperatureC: snapshot.era5.meanTemperatureC,
  altitudeMasl: snapshot.dem.altitudeMasl,
  eudrReasons: snapshot.eudr.reasons,
  dataQuality: snapshot.dataQuality,
  scoreHash: snapshot.scoreHash,
  evidenceHash: snapshot.evidenceHash,
  chain: snapshot.chain,
};

const outputPath = process.env.OUTPUT_PATH;
if (outputPath) {
  const resolvedPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(snapshot, null, 2)}\n`);
}

console.log(JSON.stringify(summary, null, 2));

const failed =
  snapshot.sourceMode !== "live" ||
  snapshot.riskScore < 0 ||
  snapshot.riskScore > 100 ||
  snapshot.sentinel2.historicalSeries.length === 0 ||
  snapshot.sentinel2.currentNdre == null ||
  snapshot.sentinel2.currentNdwi == null ||
  snapshot.sentinel2.currentMsi == null ||
  snapshot.sentinel1.vhVvRatio == null ||
  snapshot.sentinel1.radarVegetationIndex == null ||
  snapshot.scoreHash.length !== 64 ||
  snapshot.evidenceHash !== snapshot.scoreHash;

if (failed) {
  process.exitCode = 1;
}
