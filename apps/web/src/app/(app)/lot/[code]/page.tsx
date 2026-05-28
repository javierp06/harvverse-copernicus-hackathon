"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Polygon } from "geojson";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  Ban,
  ChartNoAxesColumn,
  ExternalLink,
  Fingerprint,
  Leaf,
  Satellite,
  ShieldCheck,
  Sprout,
  TriangleAlert,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";
import { asRecord, chainLabel } from "@/lib/chainProof";
import { trpc } from "@/utils/trpc";

const PolygonDisplayMap = dynamic(() => import("@/components/polygon-display-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

type SnapshotVariable = {
  key: string;
  label: string;
  value: number | string | boolean;
  score: number;
  weight: number;
  source: string;
};

type SnapshotSource = {
  key: string;
  provider: string;
  dataset: string;
  mode: "fixture" | "live";
  dateRange: { from: string; to: string };
  resolution: string | null;
  notes: string;
};

type SnapshotDataQuality = {
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

type CopernicusSnapshotView = {
  sourceMode: "fixture" | "live";
  riskScore: number;
  riskTier: string;
  eudrStatus: "verified" | "non_compliant" | "unknown";
  eligibleForInvestment: boolean;
  variables: SnapshotVariable[];
  sources: SnapshotSource[];
  dataQuality: SnapshotDataQuality;
  sentinel2: {
    currentNdvi: number;
    twoYearAverageNdvi: number;
    currentNdre?: number | null;
    currentNdwi?: number | null;
    currentMsi?: number | null;
    historicalSeries?: Array<{ month: string; ndvi: number }>;
  };
  sentinel1: {
    vhVvRatio?: number | null;
    radarVegetationIndex?: number | null;
    moistureProxy: string;
    structuralChangeSignal: string;
  };
  dem: {
    altitudeMasl: number | null;
    areaManzanas: number | null;
    terrainSuitability: string;
  };
  era5: {
    annualRainfallMm: number;
    meanTemperatureC: number;
    waterStress: string;
  };
  yieldPredict: {
    projectedQuintales: number;
    lowBandQuintales: number;
    highBandQuintales: number;
    confidence: string;
    investmentArgument: string;
    baseYieldQqPerManzana: number;
    varietyKey: string;
    altitudeBand: string;
    ndviMaySepAuc?: number | null;
    ndviBenchmarkAuc?: number;
    ndviModifier?: number;
    floweringPeakNdvi?: number | null;
    densityModifier?: number;
    plantsPerManzana?: number | null;
    expectedPlantsPerManzana?: number;
    formula?: string;
  };
  scoreHash: string;
  chain: {
    transactionHash: string | null;
    chainId: number;
    metadataStatus: "pending" | "written";
  };
};

function asSnapshot(value: unknown): CopernicusSnapshotView | null {
  const record = asRecord(value);
  if (!record) return null;
  const dataQualityRecord = asRecord(record.dataQuality);
  const scoreCapRecord = asRecord(dataQualityRecord?.scoreCap);
  const yieldRecord = asRecord(record.yieldPredict);

  return {
    sourceMode: record.sourceMode === "live" ? "live" : "fixture",
    riskScore: Number(record.riskScore ?? 0),
    riskTier: String(record.riskTier ?? "unknown"),
    eudrStatus:
      record.eudrStatus === "non_compliant" || record.eudrStatus === "unknown"
        ? record.eudrStatus
        : "verified",
    eligibleForInvestment: Boolean(record.eligibleForInvestment),
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
    sentinel2: (asRecord(record.sentinel2) ?? {}) as CopernicusSnapshotView["sentinel2"],
    sentinel1: (asRecord(record.sentinel1) ?? {}) as CopernicusSnapshotView["sentinel1"],
    dem: (asRecord(record.dem) ?? {}) as CopernicusSnapshotView["dem"],
    era5: (asRecord(record.era5) ?? {}) as CopernicusSnapshotView["era5"],
    yieldPredict: {
      ...(yieldRecord as any),
      varietyKey: String(yieldRecord?.varietyKey ?? "default"),
    },
    scoreHash: String(record.scoreHash ?? ""),
    chain: (asRecord(record.chain) ?? { chainId: 31337, metadataStatus: "pending" }) as CopernicusSnapshotView["chain"],
  };
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";
  if (score >= 60) return "text-lime-300 border-lime-400/30 bg-lime-400/10";
  if (score >= 40) return "text-yellow-300 border-yellow-400/30 bg-yellow-400/10";
  return "text-red-300 border-red-400/30 bg-red-400/10";
}

function shortHash(hash: string) {
  return hash.length > 16 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function metricValue(value: unknown, decimals = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(decimals) : "--";
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export default function PublicLotProofPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? "");
  const t = useTranslations("lot_proof");
  const commonT = useTranslations("common");

  const { data, isLoading } = useQuery(
    trpc.lots.publicByCode.queryOptions(
      { code },
      { enabled: code.length > 0 },
    ),
  );

  const snapshot = asSnapshot(data?.snapshot);
  const lot = data?.lot;
  const polygon = lot?.polygon as Polygon | null | undefined;

  function eudrLabel(status: CopernicusSnapshotView["eudrStatus"]) {
    if (status === "verified") return t("eudr_verified");
    if (status === "non_compliant") return t("eudr_non_compliant");
    return t("eudr_pending");
  }

  function metadataLabel(status: CopernicusSnapshotView["chain"]["metadataStatus"]) {
    return status === "written" ? t("local_proof_verified") : t("local_proof_pending");
  }

  function confidenceLabel(conf: string) {
    if (conf === "low") return t("low");
    if (conf === "medium") return t("medium");
    if (conf === "high") return t("high");
    return conf;
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 md:px-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </main>
    );
  }

  if (!lot) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-12 md:px-6">
        <GlassCard className="w-full p-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">{commonT("lot")}</p>
          <h1 className="mt-3 text-3xl font-black text-white">{t("not_found_title")}</h1>
          <p className="mt-3 text-white/60">{t("not_found_desc")}</p>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <GlassCard className="overflow-hidden border-primary/20">
          <div className="flex min-h-[420px] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">{t("title")}</p>
                <h1 className="mt-2 text-3xl font-black leading-tight text-white md:text-5xl">
                  {lot.code ?? t("lot_id", { id: lot.id })}
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  {lot.farmName} · {lot.region}, {lot.country}
                </p>
              </div>
              <Badge className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                {snapshot ? t(`source_mode.${snapshot.sourceMode}` as any) : t("source_mode_pending")}
              </Badge>
            </div>
            <div className="relative min-h-[320px] flex-1 bg-white/5">
              {polygon ? (
                <PolygonDisplayMap polygon={polygon} color="#67E8F9" fillOpacity={0.22} />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-white/30">
                  {t("polygon_pending")}
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6">
          <GlassCard className="border-primary/20 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">{t("risk_score")}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-6xl font-black text-white">{snapshot?.riskScore ?? "--"}</span>
                  <span className="pb-2 text-xl font-bold text-white/40">/100</span>
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${scoreTone(snapshot?.riskScore ?? 0)}`}>
                {snapshot ? t(`risk_tier.${snapshot.riskTier}` as any) : t("no_score")}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <StatusPill
                icon={snapshot?.eudrStatus === "non_compliant" ? Ban : ShieldCheck}
                label={snapshot ? eudrLabel(snapshot.eudrStatus) : t("eudr_pending")}
                value={snapshot?.eligibleForInvestment ? t("eligible") : t("blocked_or_pending")}
              />
              <StatusPill
                icon={TrendingUp}
                label={t("yield_predict")}
                value={
                  snapshot
                    ? `${snapshot.yieldPredict.lowBandQuintales}-${snapshot.yieldPredict.highBandQuintales} ${t("unit_qq")}`
                    : t("pending")
                }
              />
            </div>
          </GlassCard>

          <GlassCard className="border-white/10 p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">{t("satellite_signals")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric icon={Leaf} label={t("metrics.s2_ndvi" as any)} value={snapshot ? numberValue(snapshot.sentinel2.currentNdvi).toFixed(2) : "--"} />
              <Metric icon={Leaf} label={t("metrics.s2_ndre" as any)} value={snapshot?.sentinel2.currentNdre == null ? "--" : numberValue(snapshot.sentinel2.currentNdre).toFixed(2)} />
              <Metric icon={Sprout} label={t("metrics.s2_ndwi" as any)} value={snapshot?.sentinel2.currentNdwi == null ? "--" : numberValue(snapshot.sentinel2.currentNdwi).toFixed(2)} />
              <Metric icon={Satellite} label={t("metrics.s1_sar" as any)} value={snapshot?.sentinel1.moistureProxy ?? "--"} />
              <Metric icon={Satellite} label={t("metrics.s1_vh_vv_rvi" as any)} value={snapshot?.sentinel1.vhVvRatio == null || snapshot.sentinel1.radarVegetationIndex == null ? "--" : `${numberValue(snapshot.sentinel1.vhVvRatio).toFixed(2)} · ${numberValue(snapshot.sentinel1.radarVegetationIndex).toFixed(2)}`} />
              <Metric icon={Sprout} label={t("metrics.era5_rainfall" as any)} value={snapshot ? `${numberValue(snapshot.era5.annualRainfallMm)} ${t("unit_mm")}` : "--"} />
              <Metric icon={ChartNoAxesColumn} label={t("metrics.dem_altitude" as any)} value={snapshot ? `${numberValue(snapshot.dem.altitudeMasl)} ${t("unit_masl")}` : "--"} />
            </div>
          </GlassCard>
        </div>
      </section>

      {snapshot ? (
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="border-white/10 p-6">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-primary" />
              <h2 className="text-xl font-black text-white">{t("breakdown_title")}</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.variables.map((variable) => (
                <div key={variable.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{t(`variables.${variable.key}` as any)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                        {t(`variable_sources.${variable.source.toLowerCase()}` as any)}
                      </p>
                    </div>
                    <p className="text-lg font-black text-primary">{variable.score}</p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${variable.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid gap-6">
            <GlassCard className="border-white/10 p-6">
              <h2 className="text-xl font-black text-white">{t("investment_argument")}</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">
                {t("investment_argument_template", {
                  area: metricValue(snapshot.dem.areaManzanas, 2),
                  baseYield: snapshot.yieldPredict.baseYieldQqPerManzana.toFixed(1),
                  variety: t(`varieties.${snapshot.yieldPredict.varietyKey}` as any),
                  band: t(`altitude_bands.${snapshot.yieldPredict.altitudeBand}` as any),
                  ndvi: snapshot.yieldPredict.ndviModifier?.toFixed(2) ?? "1.00",
                  density: snapshot.yieldPredict.densityModifier?.toFixed(2) ?? "1.00",
                })}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label={t("projected")} value={`${snapshot.yieldPredict.projectedQuintales} ${t("unit_qq")}`} />
                <Metric label={t("low_band")} value={`${snapshot.yieldPredict.lowBandQuintales} ${t("unit_qq")}`} />
                <Metric label={t("high_band")} value={`${snapshot.yieldPredict.highBandQuintales} ${t("unit_qq")}`} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {snapshot.yieldPredict.baseYieldQqPerManzana != null ? (
                  <Metric
                    label={t("base_yield")}
                    value={`${snapshot.yieldPredict.baseYieldQqPerManzana} ${t("unit_qq_mz")}`}
                  />
                ) : null}
                {snapshot.yieldPredict.ndviModifier != null ? (
                  <Metric
                    label={t("ndvi_modifier")}
                    value={`${snapshot.yieldPredict.ndviModifier}${t("unit_x")}`}
                  />
                ) : null}
                {snapshot.yieldPredict.densityModifier != null ? (
                  <Metric
                    label={t("density_modifier")}
                    value={`${snapshot.yieldPredict.densityModifier}${t("unit_x")}`}
                  />
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {snapshot.yieldPredict.ndviMaySepAuc != null ? (
                  <Metric
                    label={t("ndvi_auc")}
                    value={`${snapshot.yieldPredict.ndviMaySepAuc}`}
                  />
                ) : null}
                {snapshot.yieldPredict.floweringPeakNdvi != null ? (
                  <Metric
                    label={t("flowering_peak")}
                    value={`${snapshot.yieldPredict.floweringPeakNdvi}`}
                  />
                ) : null}
                {snapshot.yieldPredict.plantsPerManzana != null ? (
                  <Metric
                    label={t("plant_density")}
                    value={`${snapshot.yieldPredict.plantsPerManzana}${t("unit_per_mz")}`}
                  />
                ) : null}
              </div>
            </GlassCard>

            <GlassCard className="border-white/10 p-6">
              <div className="flex items-center gap-2">
                <Fingerprint className="size-5 text-primary" />
                <h2 className="text-xl font-black text-white">{t("evidence_packet")}</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <ProofRow label={t("score_hash")} value={shortHash(snapshot.scoreHash)} mono />
                <ProofRow label={t("chain")} value={`${chainLabel(snapshot.chain.chainId)} · ${snapshot.chain.chainId}`} />
                <ProofRow label={t("local_proof")} value={metadataLabel(snapshot.chain.metadataStatus)} />
                <ProofRow label={t("confidence")} value={confidenceLabel(snapshot.dataQuality.confidence)} />
                <ProofRow label={t("completeness")} value={`${Math.round(snapshot.dataQuality.completeness * 100)}%`} />
                <ProofRow label={t("parcel_confidence")} value={confidenceLabel(snapshot.dataQuality.parcelScale.confidence)} />
                <ProofRow
                  label={t("s2_pixels")}
                  value={
                    snapshot.dataQuality.parcelScale.sentinel2PixelEstimate == null
                      ? t("unknown")
                      : `~${snapshot.dataQuality.parcelScale.sentinel2PixelEstimate}`
                  }
                />
                <ProofRow
                  label={t("s1_cells")}
                  value={
                    snapshot.dataQuality.parcelScale.sentinel1IwCellEstimate == null
                      ? t("unknown")
                      : `~${snapshot.dataQuality.parcelScale.sentinel1IwCellEstimate}`
                  }
                />
                <ProofRow
                  label={t("score_cap")}
                  value={
                    snapshot.dataQuality.scoreCap.applied
                      ? t("max_score", { score: snapshot.dataQuality.scoreCap.maxScore ?? 0 })
                      : t("not_applied")
                  }
                />
                <ProofRow
                  label={t("transaction")}
                  value={snapshot.chain.transactionHash ? shortHash(snapshot.chain.transactionHash) : t("pending")}
                  mono={Boolean(snapshot.chain.transactionHash)}
                />
              </div>
              {snapshot.sources.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {snapshot.sources.map((source) => (
                    <Badge
                      key={`${source.key}-${source.dataset}`}
                      className="rounded-full border-white/10 bg-white/[0.04] text-white/70"
                    >
                      {source.dataset}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {snapshot.dataQuality.warnings.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {snapshot.dataQuality.warnings.slice(0, 3).map((warning) => (
                    <div key={warning} className="flex gap-2 text-xs leading-5 text-yellow-200/75">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      <p>{warning}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </GlassCard>
          </div>
        </section>
      ) : (
        <GlassCard className="border-yellow-400/20 p-6">
          <h2 className="text-xl font-black text-white">{t("pending_title")}</h2>
          <p className="mt-2 text-sm text-white/60">
            {t("pending_desc")}
          </p>
        </GlassCard>
      )}
    </main>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-4" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-white/40">
        {Icon ? <Icon className="size-4 text-primary" /> : null}
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function ProofRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-white/45">{label}</span>
      <span className={mono ? "font-mono text-primary" : "font-bold text-white"}>
        {value}
      </span>
      {label === "Transaction" && value !== "Pending" ? <ExternalLink className="size-3 text-white/35" /> : null}
    </div>
  );
}
