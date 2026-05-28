import { createHash } from "node:crypto";

import {
  fetchCopernicusDemElevation,
  summarizeCopernicusDem,
} from "./copernicus/dem";
import { buildEudrGateFromSentinel2 } from "./copernicus/eudr";
import {
  centroidFromPolygon,
  fetchEra5ClimateMonths,
  summarizeEra5ClimateMonths,
} from "./copernicus/era5";
import {
  fetchSentinel1SarQuarters,
  summarizeSentinel1SarQuarters,
} from "./copernicus/sentinel-1";
import {
  fetchSentinel2NdviMonths,
  type Sentinel2Polygon,
} from "./copernicus/sentinel-2";

export type CopernicusSourceMode = "fixture" | "live";
export type RiskTier =
  | "excellent"
  | "good"
  | "moderate"
  | "high_risk"
  | "not_viable";
export type EudrStatus = "verified" | "non_compliant" | "unknown";
export type VariableSource =
  | "sentinel-2"
  | "sentinel-1"
  | "era5"
  | "polygon"
  | "eudr";
export type SourceConfidence = "low" | "medium" | "high";
export type EudrRiskLevel =
  | "low_risk"
  | "review_required"
  | "high_risk"
  | "unknown";

export interface SentinelScoreVariable {
  key: string;
  label: string;
  value: number | string | boolean;
  score: number;
  weight: number;
  source: VariableSource;
}

export interface CopernicusSourceMetadata {
  key: VariableSource | "dem";
  provider: string;
  dataset: string;
  mode: CopernicusSourceMode;
  dateRange: {
    from: string;
    to: string;
  };
  resolution: string | null;
  notes: string;
}

export interface CopernicusDataQuality {
  confidence: SourceConfidence;
  completeness: number;
  scoreCap: {
    applied: boolean;
    maxScore: number | null;
    reason: string | null;
  };
  warnings: string[];
  limitations: string[];
  parcelScale: {
    areaManzanas: number | null;
    areaHectares: number | null;
    sentinel2PixelEstimate: number | null;
    sentinel1IwCellEstimate: number | null;
    confidence: SourceConfidence;
    warning: string | null;
  };
}

export interface CopernicusLotSnapshot {
  lotId: number;
  farmId: number;
  polygon: unknown;
  sourceMode: CopernicusSourceMode;
  scoreVersion: string;
  riskScore: number;
  riskTier: RiskTier;
  eudrStatus: EudrStatus;
  eligibleForInvestment: boolean;
  variables: SentinelScoreVariable[];
  sources: CopernicusSourceMetadata[];
  dataQuality: CopernicusDataQuality;
  sentinel2: {
    currentNdvi: number;
    twoYearAverageNdvi: number;
    historicalSeries: Array<{
      month: string;
      ndvi: number;
      ndre: number | null;
      ndwi: number | null;
      msi: number | null;
      validPixelCoverage: number;
      cloudCoverage: number;
    }>;
    currentNdre: number | null;
    currentNdwi: number | null;
    currentMsi: number | null;
    cloudFilter: string;
  };
  sentinel1: {
    vv: number;
    vh: number;
    vhVvRatio: number | null;
    radarVegetationIndex: number | null;
    moistureProxy: "low" | "medium" | "high";
    structuralChangeSignal: "none" | "possible_change";
  };
  dem: {
    altitudeMasl: number | null;
    areaManzanas: number | null;
    terrainSuitability: "excellent" | "good" | "moderate";
  };
  era5: {
    annualRainfallMm: number;
    meanTemperatureC: number;
    seasonalDistribution: "balanced" | "variable" | "stressed";
    waterStress: "low" | "medium" | "high";
  };
  eudr: {
    baseline: "2020-12-31";
    riskLevel: EudrRiskLevel;
    post2020DeforestationDetected: boolean;
    requiresManualReview: boolean;
    confidence: SourceConfidence;
    reasons: string[];
    limitations: string[];
    evidenceDateRange: {
      from: string;
      to: string;
    };
  };
  yieldPredict: {
    projectedQuintales: number;
    lowBandQuintales: number;
    highBandQuintales: number;
    confidence: "medium" | "high";
    investmentArgument: string;
  };
  evidenceHash: string;
  scoreHash: string;
  signedPayload: {
    payload: unknown;
    signature: string;
    signer: string;
  };
  chain: {
    transactionHash: string | null;
    contractAddress: string | null;
    chainId: number;
    metadataStatus: "pending" | "written";
  };
}

/** @deprecated Use CopernicusLotSnapshot. */
export type SentinelScoreSnapshot = CopernicusLotSnapshot;

interface SnapshotLotInput {
  id: number;
  farmId: number;
  code?: string | null;
  farmName: string;
  region: string;
  country: string;
  altitudeMasl?: number | null;
  areaManzanas?: string | number | null;
  gpsLat?: string | number | null;
  gpsLng?: string | number | null;
  polygon?: unknown;
  numTrees?: number | null;
  harvestYear?: number | null;
}

const SCORE_VERSION = "sentinel-v0.1.0";
const LIVE_SCORE_VERSION = "sentinel-live-v0.2.0";
const DEMO_SIGNER = "harvverse-sentinel-demo-signer";
const LIVE_SIGNER = "harvverse-sentinel-worker";
const HECTARES_PER_MANZANA = 0.6989;

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function riskTierFor(score: number): RiskTier {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "moderate";
  if (score >= 20) return "high_risk";
  return "not_viable";
}

function buildFixtureNdviSeries(lotId: number) {
  const baseline = 0.68 + ((lotId % 5) * 0.018);
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 5 + index, 1));
    const seasonalSignal = Math.sin(index / 3) * 0.025;
    const ndvi = Number((baseline + seasonalSignal).toFixed(3));
    const ndre = Number((0.38 + seasonalSignal * 0.7 + ((lotId % 3) * 0.012)).toFixed(3));
    const ndwi = Number((0.24 + seasonalSignal * 0.5 + ((lotId % 4) * 0.01)).toFixed(3));
    const msi = Number((0.72 - seasonalSignal * 0.6 - ((lotId % 3) * 0.018)).toFixed(3));
    return {
      month: date.toISOString().slice(0, 7),
      ndvi,
      ndre,
      ndwi,
      msi,
      validPixelCoverage: Number((0.78 + ((index % 4) * 0.03)).toFixed(2)),
      cloudCoverage: Number((0.16 + ((index % 3) * 0.04)).toFixed(2)),
    };
  });
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asSentinel2Polygon(value: unknown): Sentinel2Polygon | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "coordinates" in value &&
    Array.isArray((value as { coordinates?: unknown }).coordinates)
  ) {
    return value as Sentinel2Polygon;
  }
  return null;
}

function scoreNdviAverage(avg: number): number {
  if (avg < 0.3) return 0;
  if (avg <= 0.5) return ((avg - 0.3) / 0.2) * 100;
  return 100;
}

function scoreNdreAverage(avg: number | null): number {
  if (avg == null) return 65;
  if (avg < 0.16) return 20;
  if (avg <= 0.28) return lerp(avg, 0.16, 0.28, 20, 70);
  if (avg <= 0.42) return lerp(avg, 0.28, 0.42, 70, 100);
  return 100;
}

function scoreCanopyWater(ndwi: number | null, msi: number | null): number {
  const ndwiScore =
    ndwi == null
      ? 65
      : ndwi < 0.05
        ? 25
        : ndwi <= 0.22
          ? lerp(ndwi, 0.05, 0.22, 25, 80)
          : 100;
  const msiScore =
    msi == null
      ? 65
      : msi <= 0.65
        ? 100
        : msi <= 1
          ? lerp(msi, 0.65, 1, 100, 50)
          : 20;
  return Math.round((ndwiScore + msiScore) / 2);
}

function scoreNdviStability(values: number[]): number {
  const clean = values.filter((value) => value >= 0.2);
  if (clean.length < 6) return 50;
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  if (mean === 0) return 50;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
  const cv = Math.sqrt(variance) / mean;
  if (cv <= 0.05) return 100;
  if (cv >= 0.3) return 0;
  return 100 - ((cv - 0.05) / 0.25) * 100;
}

function scoreSentinel1Moisture(value: "low" | "medium" | "high" | "unknown"): number {
  if (value === "medium") return 82;
  if (value === "high") return 70;
  if (value === "low") return 55;
  return 50;
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((value): value is number => typeof value === "number");
  if (clean.length === 0) return null;
  return Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(4));
}

function scoreAnnualRainfall(annualMm: number): number {
  if (annualMm < 800) return 0;
  if (annualMm <= 1200) return lerp(annualMm, 800, 1200, 0, 60);
  if (annualMm <= 1500) return lerp(annualMm, 1200, 1500, 60, 85);
  if (annualMm <= 2000) return 100;
  if (annualMm <= 2500) return lerp(annualMm, 2000, 2500, 100, 70);
  if (annualMm <= 3000) return lerp(annualMm, 2500, 3000, 70, 40);
  if (annualMm <= 3500) return lerp(annualMm, 3000, 3500, 40, 20);
  return 0;
}

function scoreMeanTemperature(meanC: number): number {
  if (meanC < 12) return 0;
  if (meanC <= 15) return lerp(meanC, 12, 15, 0, 50);
  if (meanC <= 18) return 80;
  if (meanC <= 22) return 100;
  if (meanC <= 24) return 85;
  if (meanC <= 26) return lerp(meanC, 24, 26, 85, 60);
  return 20;
}

function scoreTerrainSuitability(value: "excellent" | "good" | "moderate"): number {
  if (value === "excellent") return 90;
  if (value === "good") return 75;
  return 45;
}

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
}

function weightedScore(variables: SentinelScoreVariable[]): number {
  return Math.round(
    variables.reduce((sum, variable) => sum + variable.score * variable.weight, 0) /
      variables.reduce((sum, variable) => sum + variable.weight, 0),
  );
}

function lowerConfidence(
  first: SourceConfidence,
  second: SourceConfidence,
): SourceConfidence {
  const order: Record<SourceConfidence, number> = { low: 0, medium: 1, high: 2 };
  return order[first] <= order[second] ? first : second;
}

function buildParcelScaleQuality(areaManzanas: number | null) {
  if (areaManzanas == null || areaManzanas <= 0) {
    return {
      areaManzanas: null,
      areaHectares: null,
      sentinel2PixelEstimate: null,
      sentinel1IwCellEstimate: null,
      confidence: "medium" as const,
      warning: "Parcel area is missing, so satellite confidence cannot be adjusted by lot size.",
    };
  }

  const areaHectares = Number((areaManzanas * HECTARES_PER_MANZANA).toFixed(2));
  const sentinel2PixelEstimate = Math.round(areaHectares * 100);
  const sentinel1IwCellEstimate = Number(((areaHectares * 10_000) / 1_600).toFixed(1));
  const isTinyLot = areaManzanas < 1.5;
  const isSmallLot = areaManzanas < 3;

  return {
    areaManzanas: Number(areaManzanas.toFixed(2)),
    areaHectares,
    sentinel2PixelEstimate,
    sentinel1IwCellEstimate,
    confidence: isTinyLot ? "low" as const : isSmallLot ? "medium" as const : "high" as const,
    warning: isTinyLot
      ? "Parcel-scale caution: this lot is near one manzana, so Sentinel signals support trend evidence, not plant-level diagnosis."
      : isSmallLot
        ? "Small parcel: Sentinel signals should be interpreted with polygon accuracy and field context."
        : null,
  };
}

export function buildFixtureCopernicusSnapshot(
  lot: SnapshotLotInput,
): CopernicusLotSnapshot {
  const altitudeMasl = lot.altitudeMasl ?? 1450;
  const areaManzanas = toNumber(lot.areaManzanas) ?? 2.4;
  const ndviSeries = buildFixtureNdviSeries(lot.id);
  const currentNdvi = ndviSeries.at(-1)?.ndvi ?? 0.72;
  const currentNdre = ndviSeries.at(-1)?.ndre ?? null;
  const currentNdwi = ndviSeries.at(-1)?.ndwi ?? null;
  const currentMsi = ndviSeries.at(-1)?.msi ?? null;
  const twoYearAverageNdvi = Number(
    (
      ndviSeries.reduce((sum, month) => sum + month.ndvi, 0) /
      ndviSeries.length
    ).toFixed(3),
  );
  const twoYearAverageNdre = averageNullable(ndviSeries.map((month) => month.ndre));
  const opticalHealthScore = Math.round(
    (
      scoreNdviAverage(twoYearAverageNdvi) +
      scoreNdreAverage(twoYearAverageNdre) +
      scoreCanopyWater(currentNdwi, currentMsi)
    ) / 3,
  );
  const annualRainfallMm = 1680 + ((lot.id % 4) * 45);
  const meanTemperatureC = Number((20.8 + ((lot.id % 3) * 0.4)).toFixed(1));
  const eudrStatus: EudrStatus = "verified";
  const parcelScale = buildParcelScaleQuality(areaManzanas);
  const variables: SentinelScoreVariable[] = [
    {
      key: "sentinel2_current_ndvi",
      label: "Sentinel-2 optical canopy health",
      value: `NDVI ${currentNdvi} / NDRE ${currentNdre ?? "n/a"} / NDWI ${currentNdwi ?? "n/a"}`,
      score: opticalHealthScore,
      weight: 20,
      source: "sentinel-2",
    },
    {
      key: "sentinel2_ndvi_stability",
      label: "Sentinel-2 two-year stability",
      value: "stable canopy",
      score: 82,
      weight: 10,
      source: "sentinel-2",
    },
    {
      key: "sentinel1_moisture",
      label: "Sentinel-1 SAR structure and moisture",
      value: "medium · VH/VV 0.25 · RVI 0.80",
      score: 76,
      weight: 10,
      source: "sentinel-1",
    },
    {
      key: "era5_rainfall_fit",
      label: "ERA5 annual rainfall fit",
      value: annualRainfallMm,
      score: 84,
      weight: 15,
      source: "era5",
    },
    {
      key: "era5_temperature_distribution",
      label: "ERA5 seasonal temperature risk",
      value: meanTemperatureC,
      score: 78,
      weight: 10,
      source: "era5",
    },
    {
      key: "eudr_land_cover_gate",
      label: "EUDR post-2020 land-cover gate",
      value: eudrStatus,
      score: 100,
      weight: 20,
      source: "eudr",
    },
    {
      key: "polygon_terrain_suitability",
      label: "Polygon altitude and area suitability",
      value: `${altitudeMasl} masl / ${areaManzanas.toFixed(1)} manzanas`,
      score: 80,
      weight: 15,
      source: "polygon",
    },
  ];
  const riskScore = Math.round(
    variables.reduce((sum, variable) => sum + variable.score * variable.weight, 0) /
      variables.reduce((sum, variable) => sum + variable.weight, 0),
  );
  const riskTier = riskTierFor(riskScore);
  const eligibleForInvestment = eudrStatus === "verified" && riskScore >= 60;
  const projectedQuintales = Number((areaManzanas * 18.5).toFixed(1));
  const evidenceTo = "2026-05-26";
  const sources: CopernicusSourceMetadata[] = [
    {
      key: "sentinel-2",
      provider: "Copernicus Data Space Ecosystem / Sentinel Hub",
      dataset: "sentinel-2-l2a",
      mode: "fixture",
      dateRange: { from: "2024-06-01", to: evidenceTo },
      resolution: "10m",
      notes: "Optical fixture follows the live Sentinel-2 L2A Statistics API contract for NDVI, NDRE, NDWI, and MSI with SCL cloud and shadow masking.",
    },
    {
      key: "sentinel-1",
      provider: "Copernicus Data Space Ecosystem / Sentinel Hub",
      dataset: "sentinel-1-grd",
      mode: "fixture",
      dateRange: { from: "2024-06-01", to: evidenceTo },
      resolution: "10m",
      notes: "SAR fixture preserves the VV, VH, VH/VV, RVI, and moisture-proxy fields expected from the live radar path.",
    },
    {
      key: "dem",
      provider: "Copernicus DEM",
      dataset: "copernicus_dem_glo30",
      mode: "fixture",
      dateRange: { from: "2020-01-01", to: evidenceTo },
      resolution: "30m",
      notes: "Altitude is derived from lot data in fixture mode and will be replaced by DEM centroid sampling in live mode.",
    },
    {
      key: "era5",
      provider: "Copernicus Climate Change Service via Open-Meteo Archive",
      dataset: "ERA5 reanalysis",
      mode: "fixture",
      dateRange: { from: "2024-06-01", to: evidenceTo },
      resolution: "daily aggregate",
      notes: "Climate fixture matches the annual rainfall, temperature, and stress fields expected from live ERA5 aggregation.",
    },
    {
      key: "eudr",
      provider: "Copernicus/JRC reference baseline",
      dataset: "JRC Global Forest Cover 2020",
      mode: "fixture",
      dateRange: { from: "2020-12-31", to: evidenceTo },
      resolution: null,
      notes: "EUDR fixture models the post-December 2020 deforestation gate; live mode must replace it with polygon screening evidence.",
    },
  ];
  const dataQuality: CopernicusDataQuality = {
    confidence: lowerConfidence("medium", parcelScale.confidence),
    completeness: 0.82,
    scoreCap: {
      applied: false,
      maxScore: null,
      reason: null,
    },
    warnings: [
      "Fixture mode: provider calls are not executed yet.",
      "Local contract metadata write is pending.",
      ...(parcelScale.warning ? [parcelScale.warning] : []),
    ],
    limitations: [
      "This deterministic demo snapshot is not a final financing decision.",
      "EUDR status must be re-computed from live land-cover evidence before production use.",
      "Sentinel-1 IW GRD is treated as a contextual proxy for small lots, not a precise parcel-level soil moisture measurement.",
      "Coffee agroforestry and shade trees can make optical vegetation indices resemble forest; SAR texture and field context remain important.",
    ],
    parcelScale,
  };
  const unsignedPayload = {
    lotId: lot.id,
    farmId: lot.farmId,
    lotCode: lot.code ?? null,
    scoreVersion: SCORE_VERSION,
    riskScore,
    riskTier,
    eudrStatus,
    eligibleForInvestment,
    variables,
    sources,
    dataQuality,
  };
  const evidenceHash = hashJson({
    ...unsignedPayload,
    polygon: lot.polygon ?? null,
    sentinel2: ndviSeries,
    annualRainfallMm,
    meanTemperatureC,
  });
  const signature = hashJson({ signer: DEMO_SIGNER, evidenceHash });

  return {
    lotId: lot.id,
    farmId: lot.farmId,
    polygon: lot.polygon ?? null,
    sourceMode: "fixture",
    scoreVersion: SCORE_VERSION,
    riskScore,
    riskTier,
    eudrStatus,
    eligibleForInvestment,
    variables,
    sources,
    dataQuality,
    sentinel2: {
      currentNdvi,
      twoYearAverageNdvi,
      historicalSeries: ndviSeries,
      currentNdre,
      currentNdwi,
      currentMsi,
      cloudFilter: "Sentinel-2 L2A SCL cloud and shadow mask",
    },
    sentinel1: {
      vv: -8.7,
      vh: -15.4,
      vhVvRatio: 0.25,
      radarVegetationIndex: 0.8,
      moistureProxy: "medium",
      structuralChangeSignal: "none",
    },
    dem: {
      altitudeMasl,
      areaManzanas,
      terrainSuitability: altitudeMasl >= 1100 ? "excellent" : "good",
    },
    era5: {
      annualRainfallMm,
      meanTemperatureC,
      seasonalDistribution: "balanced",
      waterStress: "low",
    },
    eudr: {
      baseline: "2020-12-31",
      riskLevel: "low_risk",
      post2020DeforestationDetected: false,
      requiresManualReview: false,
      confidence: "medium",
      reasons: [
        "No fixture signal of post-2020 tree-cover loss inside the lot polygon.",
        "Lot remains eligible because the EUDR gate is verified in this demo snapshot.",
      ],
      limitations: [
        "Fixture mode does not query the live JRC forest baseline or Sentinel-2 change detection yet.",
      ],
      evidenceDateRange: {
        from: "2021-01-01",
        to: evidenceTo,
      },
    },
    yieldPredict: {
      projectedQuintales,
      lowBandQuintales: Number((projectedQuintales * 0.86).toFixed(1)),
      highBandQuintales: Number((projectedQuintales * 1.12).toFixed(1)),
      confidence: "high",
      investmentArgument:
        "Stable canopy, compliant EUDR signal, and balanced rainfall support escrow-backed co-investment.",
    },
    evidenceHash,
    scoreHash: evidenceHash,
    signedPayload: {
      payload: unsignedPayload,
      signature,
      signer: DEMO_SIGNER,
    },
    chain: {
      transactionHash: null,
      contractAddress: null,
      chainId: 31337,
      metadataStatus: "pending",
    },
  };
}

export async function buildLiveCopernicusSnapshot(
  lot: SnapshotLotInput,
  token: string,
): Promise<CopernicusLotSnapshot> {
  const polygon = asSentinel2Polygon(lot.polygon);
  if (!polygon) {
    throw new Error("Live Copernicus scoring requires a lot polygon.");
  }

  const fixture = buildFixtureCopernicusSnapshot(lot);
  const climateCentroid = centroidFromPolygon(polygon);
  const now = new Date();
  const sentinelEvidenceEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .split("T")[0];
  const [ndviMonths, sarQuarters, climateMonths, demAltitude] = await Promise.all([
    fetchSentinel2NdviMonths({
      token,
      polygon,
      startDate: "2020-01-01",
      endDate: sentinelEvidenceEnd,
    }),
    fetchSentinel1SarQuarters({ token, polygon }),
    fetchEra5ClimateMonths({
      lat: climateCentroid.lat,
      lng: climateCentroid.lng,
    }),
    fetchCopernicusDemElevation({
      lat: climateCentroid.lat,
      lng: climateCentroid.lng,
    }),
  ]);
  const usableMonths = ndviMonths.filter(
    (month): month is typeof month & { ndvi: number } => month.ndvi != null,
  );
  const scoreMonths = usableMonths.slice(-24);
  const usableSarQuarters = sarQuarters.filter(
    (quarter) => quarter.vv !== null && quarter.vh !== null,
  );

  if (scoreMonths.length === 0) {
    throw new Error("Sentinel-2 returned no usable NDVI observations for this polygon.");
  }
  if (usableSarQuarters.length === 0) {
    throw new Error("Sentinel-1 returned no usable VV/VH observations for this polygon.");
  }
  if (climateMonths.length < 12) {
    throw new Error("ERA5 archive returned fewer than 12 usable climate months for this polygon.");
  }

  const sentinel1Summary = summarizeSentinel1SarQuarters(sarQuarters);
  const era5Summary = summarizeEra5ClimateMonths(climateMonths);
  const demSummary = summarizeCopernicusDem(demAltitude);
  const eudrGate = buildEudrGateFromSentinel2(ndviMonths);
  const selfReportedAltitude = toNumber(lot.altitudeMasl);
  const altitudeDelta =
    selfReportedAltitude == null
      ? null
      : Math.abs(selfReportedAltitude - demSummary.altitudeMasl);
  const currentNdvi = scoreMonths.at(-1)?.ndvi ?? 0;
  const currentNdre = scoreMonths.at(-1)?.ndre ?? null;
  const currentNdwi = scoreMonths.at(-1)?.ndwi ?? null;
  const currentMsi = scoreMonths.at(-1)?.msi ?? null;
  const twoYearAverageNdvi = Number(
    (
      scoreMonths.reduce((sum, month) => sum + month.ndvi, 0) /
      scoreMonths.length
    ).toFixed(4),
  );
  const twoYearAverageNdre = averageNullable(scoreMonths.map((month) => month.ndre));
  const opticalHealthScore = Math.round(
    (
      scoreNdviAverage(twoYearAverageNdvi) +
      scoreNdreAverage(twoYearAverageNdre) +
      scoreCanopyWater(currentNdwi, currentMsi)
    ) / 3,
  );
  const ndviStabilityScore = Math.round(
    scoreNdviStability(scoreMonths.map((month) => month.ndvi)),
  );
  const historicalSeries = scoreMonths.map((month) => ({
    month: month.month,
    ndvi: month.ndvi,
    ndre: month.ndre,
    ndwi: month.ndwi,
    msi: month.msi,
    validPixelCoverage: month.validPixelCoverage ?? 0,
    cloudCoverage: month.cloudCoverage ?? 0,
  }));
  const variables = fixture.variables.map((variable) => {
    if (variable.key === "sentinel2_current_ndvi") {
      return {
        ...variable,
        value: `NDVI ${currentNdvi} / NDRE ${currentNdre ?? "n/a"} / NDWI ${currentNdwi ?? "n/a"}`,
        score: opticalHealthScore,
      };
    }
    if (variable.key === "sentinel2_ndvi_stability") {
      return {
        ...variable,
        value: "live Sentinel-2",
        score: ndviStabilityScore,
      };
    }
    if (variable.key === "sentinel1_moisture") {
      return {
        ...variable,
        value: `${sentinel1Summary.moistureProxy} · VH/VV ${sentinel1Summary.vhVvRatio ?? "n/a"} · RVI ${sentinel1Summary.radarVegetationIndex ?? "n/a"}`,
        score: scoreSentinel1Moisture(sentinel1Summary.moistureProxy),
      };
    }
    if (variable.key === "era5_rainfall_fit") {
      return {
        ...variable,
        value: era5Summary.annualRainfallMm,
        score: Math.round(scoreAnnualRainfall(era5Summary.annualRainfallMm)),
      };
    }
    if (variable.key === "era5_temperature_distribution") {
      return {
        ...variable,
        value: era5Summary.meanTemperatureC,
        score: Math.round(scoreMeanTemperature(era5Summary.meanTemperatureC)),
      };
    }
    if (variable.key === "polygon_terrain_suitability") {
      return {
        ...variable,
        value: `${demSummary.altitudeMasl} masl / ${fixture.dem.areaManzanas?.toFixed(1) ?? "unknown"} manzanas`,
        score: scoreTerrainSuitability(demSummary.terrainSuitability),
      };
    }
    if (variable.key === "eudr_land_cover_gate") {
      return {
        ...variable,
        value: eudrGate.status,
        score:
          eudrGate.status === "verified"
            ? 100
            : eudrGate.status === "non_compliant"
              ? 0
              : 50,
      };
    }
    return variable;
  });
  const riskScore = weightedScore(variables);
  const riskTier = riskTierFor(riskScore);
  const eudrStatus: EudrStatus = eudrGate.status;
  const eligibleForInvestment = eudrGate.eligibleForMarketplace && riskScore >= 60;
  const parcelScale = buildParcelScaleQuality(toNumber(lot.areaManzanas) ?? fixture.dem.areaManzanas);
  const sources = fixture.sources.map((source) =>
    source.key === "sentinel-2"
      ? {
          ...source,
          mode: "live" as const,
          dateRange: {
            from: historicalSeries[0]?.month ?? source.dateRange.from,
            to: historicalSeries.at(-1)?.month ?? source.dateRange.to,
          },
          notes:
            "Live optical metrics use Sentinel-2 L2A Statistics API for NDVI, NDRE, NDWI, and MSI with SCL cloud and shadow masking.",
        }
      : source.key === "sentinel-1"
        ? {
            ...source,
            mode: "live" as const,
            dateRange: {
              from: sarQuarters[0]?.quarter ?? source.dateRange.from,
              to: sarQuarters.at(-1)?.quarter ?? source.dateRange.to,
            },
            notes:
              "Live SAR uses Sentinel-1 GRD IW dual-polarization VV/VH quarterly backscatter plus VH/VV and RVI through the Sentinel Hub Statistics API.",
          }
      : source.key === "era5"
        ? {
            ...source,
            mode: "live" as const,
            dateRange: {
              from: climateMonths[0]?.month ?? source.dateRange.from,
              to: climateMonths.at(-1)?.month ?? source.dateRange.to,
            },
            notes:
              "Live climate uses the Open-Meteo Archive API path for ERA5 reanalysis daily precipitation and temperature aggregates.",
          }
      : source.key === "dem"
        ? {
            ...source,
            provider: "Open-Meteo elevation endpoint",
            dataset: "Copernicus DEM GLO-90",
            mode: "live" as const,
            dateRange: {
              from: "2020-01-01",
              to: source.dateRange.to,
            },
            resolution: "90m",
            notes:
              "Live altitude uses Open-Meteo's Copernicus DEM GLO-90 elevation endpoint as a centroid fallback; direct CDSE DEM remains a future hardening path.",
          }
      : source.key === "eudr"
        ? {
            ...source,
            provider: "Copernicus Data Space Ecosystem / Sentinel Hub",
            dataset: "sentinel-2-l2a",
            mode: "live" as const,
            dateRange: eudrGate.evidenceDateRange,
            resolution: "10m",
            notes:
              "Live EUDR gate uses a preliminary Sentinel-2 post-2020 vegetation continuity screen; official JRC baseline intersection remains a future hardening path.",
          }
      : source,
  );
  const liveConfidence = scoreMonths.length >= 18 ? "high" as const : "medium" as const;
  const combinedLiveConfidence = lowerConfidence(
    lowerConfidence(
      lowerConfidence(liveConfidence, sentinel1Summary.confidence),
      era5Summary.confidence,
    ),
    demSummary.confidence,
  );
  const liveCompleteness = Number(
    Math.min(
      0.95,
      (scoreMonths.length / 24) * 0.55 +
        (usableSarQuarters.length / 8) * 0.18 +
        (climateMonths.length / 24) * 0.22 +
        0.05,
    ).toFixed(2),
  );
  const dataQuality: CopernicusDataQuality = {
    ...fixture.dataQuality,
    confidence: lowerConfidence(combinedLiveConfidence, parcelScale.confidence),
    completeness: liveCompleteness,
    warnings: [
      "Sentinel-2 NDVI, Sentinel-1 SAR, ERA5 climate, Copernicus DEM altitude, and Sentinel-2 EUDR continuity evidence are live.",
      "EUDR uses a live Sentinel-2 continuity screen in this slice; official JRC baseline intersection is still pending.",
      "DEM altitude uses Open-Meteo's Copernicus DEM GLO-90 endpoint, not direct CDSE DEM.",
      "Coffee agroforestry and shade trees can make optical indices resemble forest; interpret NDRE/NDWI with SAR and field context.",
      ...(altitudeDelta != null && altitudeDelta > 300
        ? [`Stored altitude differs from DEM by ${Math.round(altitudeDelta)} masl; check the demo polygon or lot metadata.`]
        : []),
      ...(parcelScale.warning ? [parcelScale.warning] : []),
    ],
    parcelScale,
  };
  const unsignedPayload = {
    lotId: lot.id,
    farmId: lot.farmId,
    lotCode: lot.code ?? null,
    scoreVersion: LIVE_SCORE_VERSION,
    riskScore,
    riskTier,
    eudrStatus,
    eligibleForInvestment,
    variables,
    sources,
    dataQuality,
  };
  const evidenceHash = hashJson({
    ...unsignedPayload,
    polygon: lot.polygon ?? null,
    sentinel2: historicalSeries,
    eudrEvidence: ndviMonths,
    sentinel1: sarQuarters,
    era5: climateMonths,
    dem: {
      provider: demSummary.provider,
      altitudeMasl: demSummary.altitudeMasl,
      terrainSuitability: demSummary.terrainSuitability,
      terrainRisk: demSummary.terrainRisk,
      limitations: demSummary.limitations,
    },
  });
  const signature = hashJson({
    signer: LIVE_SIGNER,
    evidenceHash,
  });

  return {
    ...fixture,
    sourceMode: "live",
    scoreVersion: LIVE_SCORE_VERSION,
    riskScore,
    riskTier,
    eudrStatus,
    eligibleForInvestment,
    variables,
    sources,
    dataQuality,
    sentinel2: {
      currentNdvi,
      twoYearAverageNdvi,
      historicalSeries,
      currentNdre,
      currentNdwi,
      currentMsi,
      cloudFilter: "Sentinel-2 L2A SCL cloud and shadow mask",
    },
    sentinel1: {
      vv: sentinel1Summary.vv ?? fixture.sentinel1.vv,
      vh: sentinel1Summary.vh ?? fixture.sentinel1.vh,
      vhVvRatio: sentinel1Summary.vhVvRatio ?? fixture.sentinel1.vhVvRatio,
      radarVegetationIndex:
        sentinel1Summary.radarVegetationIndex ?? fixture.sentinel1.radarVegetationIndex,
      moistureProxy:
        sentinel1Summary.moistureProxy === "unknown"
          ? fixture.sentinel1.moistureProxy
          : sentinel1Summary.moistureProxy,
      structuralChangeSignal:
        sentinel1Summary.structuralChangeSignal === "unknown"
          ? fixture.sentinel1.structuralChangeSignal
          : sentinel1Summary.structuralChangeSignal,
    },
    era5: {
      annualRainfallMm: era5Summary.annualRainfallMm,
      meanTemperatureC: era5Summary.meanTemperatureC,
      seasonalDistribution: era5Summary.seasonalDistribution,
      waterStress: era5Summary.waterStress,
    },
    dem: {
      altitudeMasl: demSummary.altitudeMasl,
      areaManzanas: fixture.dem.areaManzanas,
      terrainSuitability: demSummary.terrainSuitability,
    },
    eudr: {
      baseline: eudrGate.baseline,
      riskLevel: eudrGate.riskLevel,
      post2020DeforestationDetected: eudrGate.post2020DeforestationDetected,
      requiresManualReview: eudrGate.requiresManualReview,
      confidence: eudrGate.confidence,
      reasons: eudrGate.reasons,
      limitations: [
        ...eudrGate.limitations,
        "This slice verifies vegetation, radar, climate, and centroid altitude evidence only; it is not a final EUDR decision.",
      ],
      evidenceDateRange: eudrGate.evidenceDateRange,
    },
    evidenceHash,
    scoreHash: evidenceHash,
    signedPayload: {
      payload: unsignedPayload,
      signature,
      signer: LIVE_SIGNER,
    },
  };
}
