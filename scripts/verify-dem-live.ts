import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { centroidFromPolygon } from "../packages/api/src/lib/copernicus/era5";
import {
  fetchCopernicusDemElevation,
  summarizeCopernicusDem,
} from "../packages/api/src/lib/copernicus/dem";
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

const centroid = centroidFromPolygon(sample.polygon);
const altitudeMasl = await fetchCopernicusDemElevation({
  lat: centroid.lat,
  lng: centroid.lng,
});
const summary = summarizeCopernicusDem(altitudeMasl);

console.log(
  JSON.stringify(
    {
      provider: "Open-Meteo elevation endpoint",
      dataset: "Copernicus DEM GLO-90",
      centroid,
      altitudeMasl: summary.altitudeMasl,
      terrainSuitability: summary.terrainSuitability,
      terrainRisk: summary.terrainRisk,
      confidence: summary.confidence,
    },
    null,
    2,
  ),
);
