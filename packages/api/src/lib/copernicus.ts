import { createHash } from "node:crypto";

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
      validPixelCoverage: number;
      cloudCoverage: number;
    }>;
    cloudFilter: string;
  };
  sentinel1: {
    vv: number;
    vh: number;
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
const DEMO_SIGNER = "harvverse-sentinel-demo-signer";

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
    return {
      month: date.toISOString().slice(0, 7),
      ndvi,
      validPixelCoverage: Number((0.78 + ((index % 4) * 0.03)).toFixed(2)),
      cloudCoverage: Number((0.16 + ((index % 3) * 0.04)).toFixed(2)),
    };
  });
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildFixtureCopernicusSnapshot(
  lot: SnapshotLotInput,
): CopernicusLotSnapshot {
  const altitudeMasl = lot.altitudeMasl ?? 1450;
  const areaManzanas = toNumber(lot.areaManzanas) ?? 2.4;
  const ndviSeries = buildFixtureNdviSeries(lot.id);
  const currentNdvi = ndviSeries.at(-1)?.ndvi ?? 0.72;
  const twoYearAverageNdvi = Number(
    (
      ndviSeries.reduce((sum, month) => sum + month.ndvi, 0) /
      ndviSeries.length
    ).toFixed(3),
  );
  const annualRainfallMm = 1680 + ((lot.id % 4) * 45);
  const meanTemperatureC = Number((20.8 + ((lot.id % 3) * 0.4)).toFixed(1));
  const eudrStatus: EudrStatus = "verified";
  const variables: SentinelScoreVariable[] = [
    {
      key: "sentinel2_current_ndvi",
      label: "Sentinel-2 current NDVI",
      value: currentNdvi,
      score: 86,
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
      label: "Sentinel-1 SAR moisture proxy",
      value: "medium",
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
      notes: "NDVI fixture follows the live Sentinel-2 L2A Statistics API contract with SCL cloud and shadow masking.",
    },
    {
      key: "sentinel-1",
      provider: "Copernicus Data Space Ecosystem / Sentinel Hub",
      dataset: "sentinel-1-grd",
      mode: "fixture",
      dateRange: { from: "2024-06-01", to: evidenceTo },
      resolution: "10m",
      notes: "SAR fixture preserves the VV/VH and moisture-proxy fields expected from the live radar path.",
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
    confidence: "medium",
    completeness: 0.82,
    scoreCap: {
      applied: false,
      maxScore: null,
      reason: null,
    },
    warnings: [
      "Fixture mode: provider calls are not executed yet.",
      "Base L2 metadata write is pending.",
    ],
    limitations: [
      "This deterministic demo snapshot is not a final financing decision.",
      "EUDR status must be re-computed from live land-cover evidence before production use.",
    ],
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
      cloudFilter: "Sentinel-2 L2A SCL cloud and shadow mask",
    },
    sentinel1: {
      vv: -8.7,
      vh: -15.4,
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
      chainId: 84532,
      metadataStatus: "pending",
    },
  };
}
