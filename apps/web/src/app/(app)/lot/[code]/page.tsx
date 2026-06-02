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
  HelpCircle,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@harvverse-copernicus-hackathon/ui/components/tooltip";
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
    maturityFactor?: number;
    plantAgeYears?: number | null;
    renewalFlag?: boolean;
    densityModifier?: number;
    plantsPerManzana?: number | null;
    expectedPlantsPerManzana?: number;
    projectedOroQuintales?: number;
    projectedOroLbs?: number;
    floorPriceUsdPerLb?: number;
    marketPriceUsdPerLb?: number;
    effectivePriceUsdPerLb?: number;
    grossRevenueUsd?: number;
    productionCostUsd?: number;
    projectedProfitUsd?: number;
    farmerProfitUsd?: number;
    partnerProfitUsd?: number;
    investmentTicketUsd?: number | null;
    partnerReturnTotalUsd?: number | null;
    farmerShareBps?: number;
    partnerShareBps?: number;
    parchmentToOroFactor?: number;
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

function moneyValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(parsed)
    : "--";
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
      <TooltipProvider>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Main Content Column */}
          <div className="flex flex-col gap-6 lg:col-span-8">
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
                    <PolygonDisplayMap
                      polygon={polygon}
                      color="#67E8F9"
                      fillOpacity={0.22}
                      mapLabel={t("satellite_map")}
                      invalidPolygonMessage={t("invalid_polygon")}
                      tileErrorMessage={t("tile_error")}
                    />
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center text-white/30 italic">
                      {t("polygon_pending")}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard className="border-white/10 p-6">
              <SectionHeader
                title={t("satellite_signals")}
                description={t("section_help.satellite_signals")}
              />
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                <Metric icon={Leaf} label={t("metrics.s2_ndvi" as any)} value={snapshot ? numberValue(snapshot.sentinel2.currentNdvi).toFixed(2) : "--"} description={t("metric_help.s2_ndvi")} />
                <Metric icon={Leaf} label={t("metrics.s2_ndre" as any)} value={snapshot?.sentinel2.currentNdre == null ? "--" : numberValue(snapshot.sentinel2.currentNdre).toFixed(2)} description={t("metric_help.s2_ndre")} />
                <Metric icon={Sprout} label={t("metrics.s2_ndwi" as any)} value={snapshot?.sentinel2.currentNdwi == null ? "--" : numberValue(snapshot.sentinel2.currentNdwi).toFixed(2)} description={t("metric_help.s2_ndwi")} />
                <Metric icon={Satellite} label={t("metrics.s1_sar" as any)} value={snapshot?.sentinel1.moistureProxy ?? "--"} description={t("metric_help.s1_sar")} />
                <Metric icon={Satellite} label={t("metrics.s1_vh_vv_rvi" as any)} value={snapshot?.sentinel1.vhVvRatio == null || snapshot.sentinel1.radarVegetationIndex == null ? "--" : `${numberValue(snapshot.sentinel1.vhVvRatio).toFixed(2)} · ${numberValue(snapshot.sentinel1.radarVegetationIndex).toFixed(2)}`} description={t("metric_help.s1_vh_vv_rvi")} />
                <Metric icon={Sprout} label={t("metrics.era5_rainfall" as any)} value={snapshot ? `${numberValue(snapshot.era5.annualRainfallMm)} ${t("unit_mm")}` : "--"} description={t("metric_help.era5_rainfall")} />
                <Metric icon={ChartNoAxesColumn} label={t("metrics.dem_altitude" as any)} value={snapshot ? `${numberValue(snapshot.dem.altitudeMasl)} ${t("unit_masl")}` : "--"} description={t("metric_help.dem_altitude")} />
              </div>
            </GlassCard>

            {snapshot && (
              <GlassCard className="border-white/10 p-6">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-primary" />
                  <SectionHeader
                    title={t("breakdown_title")}
                    description={t("section_help.breakdown")}
                  />
                </div>
                <div className="mt-5 space-y-3">
                  {snapshot.variables.map((variable) => (
                    <div key={variable.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-white">{t(`variables.${variable.key}` as any)}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
                            {t(`variable_sources.${variable.source.toLowerCase()}` as any)}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-white/45">
                            {t(`variable_help.${variable.key}` as any)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <p className="text-xl font-black text-primary">{variable.score}</p>
                          <p className="text-[10px] text-white/20">w: {variable.weight}%</p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: `${variable.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:col-span-4 h-fit">
            <GlassCard className="border-primary/20 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionHeader
                    title={t("risk_score")}
                    description={t("section_help.risk_score")}
                  />
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-7xl font-black text-white">{snapshot?.riskScore ?? "--"}</span>
                    <span className="pb-2 text-xl font-bold text-white/30">/100</span>
                  </div>
                </div>
                <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${scoreTone(snapshot?.riskScore ?? 0)}`}>
                  {snapshot ? t(`risk_tier.${snapshot.riskTier}` as any) : t("no_score")}
                </div>
              </div>
              <div className="mt-8 grid gap-4">
                <StatusPill
                  icon={snapshot?.eudrStatus === "non_compliant" ? Ban : ShieldCheck}
                  label={snapshot ? eudrLabel(snapshot.eudrStatus) : t("eudr_pending")}
                  value={snapshot?.eligibleForInvestment ? t("eligible") : t("blocked_or_pending")}
                  description={t("status_help.eudr")}
                  variant={snapshot?.eligibleForInvestment ? "success" : "warning"}
                />
                <StatusPill
                  icon={TrendingUp}
                  label={t("yield_predict")}
                  value={
                    snapshot
                      ? `${snapshot.yieldPredict.lowBandQuintales}-${snapshot.yieldPredict.highBandQuintales} ${t("unit_qq")}`
                      : t("pending")
                  }
                  description={t("status_help.yield_predict")}
                />
              </div>
            </GlassCard>

            {snapshot && (
              <>
                <GlassCard className="border-white/10 p-6">
                  <SectionHeader
                    title={t("investment_argument")}
                    description={t("section_help.investment_argument")}
                  />
                  <p className="mt-4 text-sm leading-6 text-white/65 italic">
                    "{t("investment_argument_template", {
                      area: metricValue(snapshot.dem.areaManzanas, 2),
                      baseYield: snapshot.yieldPredict.baseYieldQqPerManzana.toFixed(1),
                      variety: t(`varieties.${snapshot.yieldPredict.varietyKey}` as any),
                      band: t(`altitude_bands.${snapshot.yieldPredict.altitudeBand}` as any),
                      ndvi: snapshot.yieldPredict.ndviModifier?.toFixed(2) ?? "1.00",
                      density: snapshot.yieldPredict.densityModifier?.toFixed(2) ?? "1.00",
                    })}"
                  </p>
                  <div className="mt-6 grid grid-cols-1 gap-3">
                    <Metric label={t("projected")} value={`${snapshot.yieldPredict.projectedQuintales} ${t("unit_qq")}`} description={t("yield_help.projected")} size="sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Metric label={t("low_band")} value={`${snapshot.yieldPredict.lowBandQuintales} ${t("unit_qq")}`} description={t("yield_help.low_band")} size="sm" />
                      <Metric label={t("high_band")} value={`${snapshot.yieldPredict.highBandQuintales} ${t("unit_qq")}`} description={t("yield_help.high_band")} size="sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label={t("maturity_factor")}
                        value={`${snapshot.yieldPredict.maturityFactor?.toFixed(2) ?? "1.00"}${t("unit_x")}`}
                        description={t("yield_help.maturity_factor")}
                        size="sm"
                      />
                      <Metric
                        label={t("density_modifier")}
                        value={`${snapshot.yieldPredict.densityModifier?.toFixed(2) ?? "1.00"}${t("unit_x")}`}
                        description={t("yield_help.density_modifier")}
                        size="sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label={t("oro_lbs")}
                        value={`${metricValue(snapshot.yieldPredict.projectedOroLbs, 0)} ${t("unit_lb")}`}
                        description={t("yield_help.oro_lbs")}
                        size="sm"
                      />
                      <Metric
                        label={t("effective_price")}
                        value={`${moneyValue(snapshot.yieldPredict.effectivePriceUsdPerLb)}/${t("unit_lb")}`}
                        description={t("yield_help.effective_price")}
                        size="sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Metric
                        label={t("gross_revenue")}
                        value={moneyValue(snapshot.yieldPredict.grossRevenueUsd)}
                        description={t("yield_help.gross_revenue")}
                        size="sm"
                      />
                      <Metric
                        label={t("farmer_profit")}
                        value={moneyValue(snapshot.yieldPredict.farmerProfitUsd)}
                        description={t("yield_help.farmer_profit")}
                        size="sm"
                      />
                      <Metric
                        label={t("partner_profit")}
                        value={moneyValue(snapshot.yieldPredict.partnerProfitUsd)}
                        description={t("yield_help.partner_profit")}
                        size="sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Metric
                        label={t("production_cost")}
                        value={moneyValue(snapshot.yieldPredict.productionCostUsd)}
                        description={t("yield_help.production_cost")}
                        size="sm"
                      />
                      <Metric
                        label={t("investment_ticket")}
                        value={moneyValue(snapshot.yieldPredict.investmentTicketUsd)}
                        description={t("yield_help.investment_ticket")}
                        size="sm"
                      />
                      <Metric
                        label={t("partner_total")}
                        value={moneyValue(snapshot.yieldPredict.partnerReturnTotalUsd)}
                        description={t("yield_help.partner_total")}
                        size="sm"
                      />
                    </div>
                    {snapshot.yieldPredict.renewalFlag ? (
                      <div className="rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-3 text-xs leading-relaxed text-yellow-100/75">
                        {t("renewal_flag")}
                      </div>
                    ) : null}
                  </div>
                </GlassCard>

                <GlassCard className="border-white/10 p-6">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="size-5 text-primary" />
                    <SectionHeader
                      title={t("evidence_packet")}
                      description={t("section_help.evidence_packet")}
                    />
                  </div>
                  <div className="mt-5 space-y-3 text-sm">
                    <ProofRow label={t("score_hash")} value={shortHash(snapshot.scoreHash)} description={t("proof_help.score_hash")} mono />
                    <ProofRow label={t("chain")} value={`${chainLabel(snapshot.chain.chainId)} · ${snapshot.chain.chainId}`} description={t("proof_help.chain")} />
                    <ProofRow label={t("local_proof")} value={metadataLabel(snapshot.chain.metadataStatus)} description={t("proof_help.local_proof")} />
                    <ProofRow label={t("confidence")} value={confidenceLabel(snapshot.dataQuality.confidence)} description={t("proof_help.confidence")} />
                    <ProofRow label={t("completeness")} value={`${Math.round(snapshot.dataQuality.completeness * 100)}%`} description={t("proof_help.completeness")} />
                    <ProofRow label={t("parcel_confidence")} value={confidenceLabel(snapshot.dataQuality.parcelScale.confidence)} description={t("proof_help.parcel_confidence")} />
                    <ProofRow
                      label={t("transaction")}
                      value={snapshot.chain.transactionHash ? shortHash(snapshot.chain.transactionHash) : t("pending")}
                      description={t("proof_help.transaction")}
                      mono={Boolean(snapshot.chain.transactionHash)}
                      external={Boolean(snapshot.chain.transactionHash)}
                    />
                  </div>
                  {snapshot.sources.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {snapshot.sources.map((source) => (
                        <Badge
                          key={`${source.key}-${source.dataset}`}
                          className="rounded-full border-white/10 bg-white/[0.04] text-[10px] text-white/50"
                        >
                          {source.dataset}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {snapshot.dataQuality.warnings.length > 0 && (
                    <div className="mt-6 space-y-2 border-t border-white/5 pt-4">
                      {snapshot.dataQuality.warnings.slice(0, 3).map((warning) => (
                        <div key={warning} className="flex gap-2 text-[11px] leading-relaxed text-yellow-200/60">
                          <TriangleAlert className="mt-0.5 size-3 shrink-0 opacity-70" />
                          <p>{warning}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </>
            )}
          </div>
        </div>

        {!snapshot && (
          <GlassCard className="mt-6 border-yellow-400/20 p-6">
            <h2 className="text-xl font-black text-white">{t("pending_title")}</h2>
            <p className="mt-2 text-sm text-white/60">
              {t("pending_desc")}
            </p>
          </GlassCard>
        )}
      </TooltipProvider>
    </main>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  description,
  variant = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description?: string;
  variant?: "default" | "success" | "warning";
}) {
  const variantStyles = {
    default: "border-white/10 bg-white/[0.03] text-primary",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    warning: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400",
  };

  return (
    <div className={`rounded-xl border p-4 transition-all hover:bg-white/[0.05] ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
      {description && <p className="mt-2 text-[11px] leading-relaxed text-white/40">{description}</p>}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="group relative">
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
          {title}
        </h2>
        <Tooltip>
          <TooltipTrigger>
            <HelpCircle className="size-3 text-primary/40 transition-colors group-hover:text-primary/100" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
            {description}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  description,
  size = "md",
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-hidden text-white/30">
          {Icon && <Icon className="size-3.5 shrink-0 text-primary/60" />}
          <p className="truncate text-[9px] font-bold uppercase tracking-wider">{label}</p>
        </div>
        {description && (
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="size-3 text-white/10 hover:text-primary/60" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-[11px] leading-relaxed">
              {description}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className={`mt-2 font-black text-white ${size === "sm" ? "text-base" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function ProofRow({
  label,
  value,
  description,
  mono = false,
  external = false,
}: {
  label: string;
  value: string;
  description?: string;
  mono?: boolean;
  external?: boolean;
}) {
  return (
    <div className="group rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/40">
          {label}
          {description && (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="size-2.5 text-white/10 group-hover:text-primary/40" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-[11px] leading-relaxed">
                {description}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className={`${mono ? "font-mono text-primary" : "font-bold text-white"} text-xs`}>
            {value}
          </span>
          {external && <ExternalLink className="size-3 text-white/20 group-hover:text-primary/60" />}
        </div>
      </div>
    </div>
  );
}
