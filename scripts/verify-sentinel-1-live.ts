import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import {
  fetchSentinel1SarQuarters,
  summarizeSentinel1SarQuarters,
} from "../packages/api/src/lib/copernicus/sentinel-1";
import {
  getSentinelHubCredentials,
  getSentinelHubToken,
} from "../packages/api/src/lib/copernicus/sentinel-hub";
import type { Sentinel2Polygon } from "../packages/api/src/lib/copernicus/sentinel-2";

dotenv.config({ path: path.resolve("apps/web/.env"), quiet: true });
dotenv.config({ path: path.resolve(".env"), quiet: true });

const samplePath = path.resolve(".docs/sentinel/sample-copernicus-snapshot.json");
const sample = JSON.parse(fs.readFileSync(samplePath, "utf8")) as {
  polygon?: Sentinel2Polygon;
};

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
const quarters = await fetchSentinel1SarQuarters({
  token,
  polygon: sample.polygon,
  months: 12,
});
const summary = summarizeSentinel1SarQuarters(quarters);
const usableQuarters = quarters.filter(
  (quarter) => quarter.vv !== null && quarter.vh !== null,
);

console.log(
  JSON.stringify(
    {
      provider: "Copernicus Data Space Ecosystem / Sentinel Hub",
      dataset: "sentinel-1-grd",
      acquisitionMode: "IW",
      polarization: "DV",
      requestedMonths: 12,
      returnedQuarters: quarters.length,
      usableQuarters: usableQuarters.length,
      latestUsableQuarter: usableQuarters.at(-1) ?? null,
      moistureProxy: summary.moistureProxy,
      structuralChangeSignal: summary.structuralChangeSignal,
      confidence: summary.confidence,
    },
    null,
    2,
  ),
);

if (usableQuarters.length === 0) {
  process.exitCode = 1;
}
