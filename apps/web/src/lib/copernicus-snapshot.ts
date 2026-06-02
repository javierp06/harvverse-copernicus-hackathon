import { asRecord, getSnapshotChain, type SnapshotChainProof } from "@/lib/chainProof";

export type EudrStatus = "verified" | "non_compliant" | "unknown";
export type CopernicusSourceMode = "fixture" | "live";

export type SnapshotVariable = {
  key: string;
  label: string;
  value: number | string | boolean;
  score: number;
  weight: number;
  source: string;
};

export type SnapshotSource = {
  key: string;
  provider: string;
  dataset: string;
  mode: CopernicusSourceMode;
  dateRange: { from: string; to: string };
  resolution: string | null;
  notes: string;
};

export type SnapshotDataQuality = {
  confidence: "low" | "medium" | "high";
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
    confidence: "low" | "medium" | "high";
    warning: string | null;
  };
};

export type CopernicusSnapshotView = {
  sourceMode: CopernicusSourceMode;
  riskScore: number | null;
  riskTier: string;
  eudrStatus: EudrStatus;
  eligibleForInvestment: boolean;
  scoreVersion?: string;
  variables: SnapshotVariable[];
  sources: SnapshotSource[];
  dataQuality: SnapshotDataQuality;
  sentinel2: {
    currentNdvi: number | null;
    twoYearAverageNdvi?: number;
    currentNdre?: number | null;
    currentNdwi?: number | null;
    currentMsi?: number | null;
    historicalSeries?: Array<{ month: string; ndvi: number }>;
  };
  sentinel1: {
    vhVvRatio?: number | null;
    radarVegetationIndex?: number | null;
    moistureProxy: string;
    structuralChangeSignal?: string;
  };
  dem: {
    altitudeMasl: number | null;
    areaManzanas: number | null;
    terrainSuitability?: string;
  };
  era5: {
    annualRainfallMm: number | null;
    meanTemperatureC?: number;
    waterStress?: string;
  };
  eudr?: {
    riskLevel?: string;
    post2020DeforestationDetected?: boolean;
    requiresManualReview?: boolean;
    reasons?: string[];
  };
  yieldPredict: {
    projectedQuintales: number | null;
    lowBandQuintales: number | null;
    highBandQuintales: number | null;
    confidence?: string;
    investmentArgument?: string;
    baseYieldQqPerManzana?: number;
    varietyKey?: string;
    altitudeBand?: string;
    ndviModifier?: number;
    densityModifier?: number;
  };
  scoreHash: string;
  chain: SnapshotChainProof;
};

export type LotCopernicusSummary = {
  riskScore: number | null;
  riskTier: string | null;
  eudrStatus: EudrStatus | null;
  eligibleForInvestment: boolean;
  hasSnapshot: boolean;
};

export function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function metricValue(value: unknown, decimals = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(decimals) : "--";
}

export function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function shortHash(hash: string | null | undefined) {
  if (!hash) return "—";
  return hash.length > 16 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return "border-white/10 bg-white/[0.03] text-white/45";
  if (score >= 80) return "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";
  if (score >= 60) return "text-lime-300 border-lime-400/30 bg-lime-400/10";
  if (score >= 40) return "text-yellow-300 border-yellow-400/30 bg-yellow-400/10";
  return "text-red-300 border-red-400/30 bg-red-400/10";
}

export function eudrBadgeTone(status: EudrStatus | null | undefined) {
  if (status === "verified") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  if (status === "non_compliant") return "border-red-500/30 bg-red-500/15 text-red-300";
  return "border-yellow-500/30 bg-yellow-500/15 text-yellow-200";
}

function parseParcelScale(value: unknown): SnapshotDataQuality["parcelScale"] {
  const record = asRecord(value);
  return {
    areaManzanas: nullableNumber(record?.areaManzanas),
    areaHectares: nullableNumber(record?.areaHectares),
    sentinel2PixelEstimate: nullableNumber(record?.sentinel2PixelEstimate),
    sentinel1IwCellEstimate: nullableNumber(record?.sentinel1IwCellEstimate),
    confidence:
      record?.confidence === "high" || record?.confidence === "low"
        ? record.confidence
        : "medium",
    warning: record?.warning == null ? null : String(record.warning),
  };
}

export function parseCopernicusSnapshot(value: unknown): CopernicusSnapshotView | null {
  const record = asRecord(value);
  if (!record) return null;

  const dataQualityRecord = asRecord(record.dataQuality);
  const scoreCapRecord = asRecord(dataQualityRecord?.scoreCap);
  const yieldRecord = asRecord(record.yieldPredict);
  const sentinel2Record = asRecord(record.sentinel2);
  const sentinel1Record = asRecord(record.sentinel1);
  const demRecord = asRecord(record.dem);
  const era5Record = asRecord(record.era5);
  const eudrRecord = asRecord(record.eudr);
  const chainFromDb = asRecord(record.chain);

  const historicalRaw = sentinel2Record?.historicalSeries;
  const historicalSeries = Array.isArray(historicalRaw)
    ? historicalRaw
        .map((item) => {
          const row = asRecord(item);
          if (!row || row.ndvi == null) return null;
          return { month: String(row.month ?? ""), ndvi: numberValue(row.ndvi) };
        })
        .filter((row): row is { month: string; ndvi: number } => row != null && row.month.length > 0)
    : [];

  return {
    sourceMode: record.sourceMode === "live" ? "live" : "fixture",
    riskScore: nullableNumber(record.riskScore),
    riskTier: String(record.riskTier ?? "unknown"),
    eudrStatus:
      record.eudrStatus === "verified" ||
      record.eudrStatus === "non_compliant" ||
      record.eudrStatus === "unknown"
        ? record.eudrStatus
        : "unknown",
    eligibleForInvestment: Boolean(record.eligibleForInvestment),
    scoreVersion: record.scoreVersion == null ? undefined : String(record.scoreVersion),
    variables: Array.isArray(record.variables)
      ? (record.variables as SnapshotVariable[])
      : [],
    sources: Array.isArray(record.sources) ? (record.sources as SnapshotSource[]) : [],
    dataQuality: {
      confidence:
        dataQualityRecord?.confidence === "high" || dataQualityRecord?.confidence === "low"
          ? dataQualityRecord.confidence
          : "medium",
      completeness: numberValue(dataQualityRecord?.completeness, 0),
      scoreCap: {
        applied: Boolean(scoreCapRecord?.applied),
        maxScore: scoreCapRecord?.maxScore == null ? null : numberValue(scoreCapRecord.maxScore),
        reason: scoreCapRecord?.reason == null ? null : String(scoreCapRecord.reason),
      },
      warnings: Array.isArray(dataQualityRecord?.warnings)
        ? dataQualityRecord.warnings.map(String)
        : [],
      limitations: Array.isArray(dataQualityRecord?.limitations)
        ? dataQualityRecord.limitations.map(String)
        : [],
      parcelScale: parseParcelScale(dataQualityRecord?.parcelScale),
    },
    sentinel2: {
      currentNdvi: nullableNumber(sentinel2Record?.currentNdvi),
      twoYearAverageNdvi: nullableNumber(sentinel2Record?.twoYearAverageNdvi) ?? undefined,
      currentNdre: nullableNumber(sentinel2Record?.currentNdre),
      currentNdwi: nullableNumber(sentinel2Record?.currentNdwi),
      currentMsi: nullableNumber(sentinel2Record?.currentMsi),
      historicalSeries,
    },
    sentinel1: {
      vhVvRatio: nullableNumber(sentinel1Record?.vhVvRatio),
      radarVegetationIndex: nullableNumber(sentinel1Record?.radarVegetationIndex),
      moistureProxy:
        sentinel1Record?.moistureProxy == null ? "unknown" : String(sentinel1Record.moistureProxy),
      structuralChangeSignal:
        sentinel1Record?.structuralChangeSignal == null
          ? undefined
          : String(sentinel1Record.structuralChangeSignal),
    },
    dem: {
      altitudeMasl: nullableNumber(demRecord?.altitudeMasl),
      areaManzanas: nullableNumber(demRecord?.areaManzanas),
      terrainSuitability:
        demRecord?.terrainSuitability == null ? undefined : String(demRecord.terrainSuitability),
    },
    era5: {
      annualRainfallMm: nullableNumber(era5Record?.annualRainfallMm),
      meanTemperatureC: nullableNumber(era5Record?.meanTemperatureC) ?? undefined,
      waterStress: era5Record?.waterStress == null ? undefined : String(era5Record.waterStress),
    },
    eudr: eudrRecord
      ? {
          riskLevel: eudrRecord.riskLevel == null ? undefined : String(eudrRecord.riskLevel),
          post2020DeforestationDetected: Boolean(eudrRecord.post2020DeforestationDetected),
          requiresManualReview: Boolean(eudrRecord.requiresManualReview),
          reasons: Array.isArray(eudrRecord.reasons) ? eudrRecord.reasons.map(String) : [],
        }
      : undefined,
    yieldPredict: {
      projectedQuintales: nullableNumber(yieldRecord?.projectedQuintales),
      lowBandQuintales: nullableNumber(yieldRecord?.lowBandQuintales),
      highBandQuintales: nullableNumber(yieldRecord?.highBandQuintales),
      confidence: yieldRecord?.confidence == null ? undefined : String(yieldRecord.confidence),
      investmentArgument:
        yieldRecord?.investmentArgument == null ? undefined : String(yieldRecord.investmentArgument),
      baseYieldQqPerManzana: nullableNumber(yieldRecord?.baseYieldQqPerManzana) ?? undefined,
      varietyKey: yieldRecord?.varietyKey == null ? undefined : String(yieldRecord.varietyKey),
      altitudeBand: yieldRecord?.altitudeBand == null ? undefined : String(yieldRecord.altitudeBand),
      ndviModifier: nullableNumber(yieldRecord?.ndviModifier) ?? undefined,
      densityModifier: nullableNumber(yieldRecord?.densityModifier) ?? undefined,
    },
    scoreHash: String(record.scoreHash ?? ""),
    chain: getSnapshotChain({ chain: chainFromDb ?? record.chain }),
  };
}

export function lotSummaryFromRow(lot: {
  riskScore?: number | null;
  riskTier?: string | null;
  eudrStatus?: string | null;
  copernicusSnapshotId?: number | null;
}): LotCopernicusSummary {
  const eudrStatus =
    lot.eudrStatus === "verified" ||
    lot.eudrStatus === "non_compliant" ||
    lot.eudrStatus === "unknown"
      ? lot.eudrStatus
      : null;

  const riskScore = lot.riskScore ?? null;
  const eligibleForInvestment =
    eudrStatus !== "non_compliant" && riskScore != null && riskScore >= 60;

  return {
    riskScore,
    riskTier: lot.riskTier ?? null,
    eudrStatus,
    eligibleForInvestment,
    hasSnapshot: lot.copernicusSnapshotId != null || riskScore != null,
  };
}

export function aggregateFarmCopernicusSummary(
  lots: Array<{
    riskScore?: number | null;
    riskTier?: string | null;
    eudrStatus?: string | null;
    copernicusSnapshotId?: number | null;
  }>,
): LotCopernicusSummary {
  if (lots.length === 0) {
    return {
      riskScore: null,
      riskTier: null,
      eudrStatus: null,
      eligibleForInvestment: false,
      hasSnapshot: false,
    };
  }

  const summaries = lots.map(lotSummaryFromRow);
  const hasSnapshot = summaries.some((s) => s.hasSnapshot);
  const hasNonCompliant = summaries.some((s) => s.eudrStatus === "non_compliant");
  const scores = summaries.map((s) => s.riskScore).filter((s): s is number => s != null);
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;
  const anyEligible = summaries.some((s) => s.eligibleForInvestment);

  let eudrStatus: EudrStatus | null = null;
  if (hasNonCompliant) eudrStatus = "non_compliant";
  else if (summaries.every((s) => s.eudrStatus === "verified")) eudrStatus = "verified";
  else if (summaries.some((s) => s.eudrStatus === "verified")) eudrStatus = "verified";
  else if (summaries.some((s) => s.eudrStatus === "unknown")) eudrStatus = "unknown";

  const bestTier = summaries.find((s) => s.riskScore === bestScore)?.riskTier ?? null;

  return {
    riskScore: bestScore,
    riskTier: bestTier,
    eudrStatus,
    eligibleForInvestment: anyEligible && !hasNonCompliant,
    hasSnapshot,
  };
}

export type FarmerEligibilityState = "eligible" | "blocked" | "pending";

export function farmerEligibilityState(
  snapshot: CopernicusSnapshotView | null,
): FarmerEligibilityState {
  if (!snapshot) return "pending";
  if (snapshot.eudrStatus === "non_compliant") return "blocked";
  if (snapshot.riskScore != null && snapshot.riskScore < 40) return "blocked";
  if (snapshot.eudr?.requiresManualReview || snapshot.eudrStatus === "unknown") return "pending";
  if (snapshot.eligibleForInvestment) return "eligible";
  if (snapshot.riskScore != null && snapshot.riskScore >= 40 && snapshot.riskScore < 60) return "pending";
  return "blocked";
}
