import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import {
  getSentinelHubCredentials,
  getSentinelHubToken,
} from "../packages/api/src/lib/copernicus/sentinel-hub";
import {
  fetchSentinel2NdviMonths,
  type Sentinel2Polygon,
} from "../packages/api/src/lib/copernicus/sentinel-2";

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
const months = await fetchSentinel2NdviMonths({
  token,
  polygon: sample.polygon,
  months: 6,
});
const usableMonths = months.filter((month) => month.ndvi !== null);

console.log(
  JSON.stringify(
    {
      provider: "Copernicus Data Space Ecosystem / Sentinel Hub",
      dataset: "sentinel-2-l2a",
      requestedMonths: 6,
      returnedMonths: months.length,
      usableMonths: usableMonths.length,
      latestUsableMonth: usableMonths.at(-1) ?? null,
    },
    null,
    2,
  ),
);

if (usableMonths.length === 0) {
  process.exitCode = 1;
}
