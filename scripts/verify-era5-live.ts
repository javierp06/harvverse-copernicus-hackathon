import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import {
  centroidFromPolygon,
  fetchEra5ClimateMonths,
  summarizeEra5ClimateMonths,
} from "../packages/api/src/lib/copernicus/era5";
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
const months = await fetchEra5ClimateMonths({
  lat: centroid.lat,
  lng: centroid.lng,
  months: 24,
});
const summary = summarizeEra5ClimateMonths(months);

console.log(
  JSON.stringify(
    {
      provider: "Copernicus Climate Change Service via Open-Meteo Archive",
      dataset: "ERA5 reanalysis",
      centroid,
      returnedMonths: months.length,
      annualRainfallMm: summary.annualRainfallMm,
      meanTemperatureC: summary.meanTemperatureC,
      seasonalDistribution: summary.seasonalDistribution,
      waterStress: summary.waterStress,
      extremeRainDays: summary.extremeRainDays,
      precipitationTrendMmPerYear: summary.precipitationTrendMmPerYear,
      confidence: summary.confidence,
    },
    null,
    2,
  ),
);

if (months.length < 12) {
  process.exitCode = 1;
}
