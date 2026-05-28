"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Polygon } from "geojson";
import type { ComponentType } from "react";
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
    historicalSeries?: Array<{ month: string; ndvi: number }>;
  };
  sentinel1: {
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
  };
  scoreHash: string;
  chain: {
    transactionHash: string | null;
    chainId: number;
    metadataStatus: "pending" | "written";
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asSnapshot(value: unknown): CopernicusSnapshotView | null {
  const record = asRecord(value);
  if (!record) return null;
  const dataQualityRecord = asRecord(record.dataQuality);
  const scoreCapRecord = asRecord(dataQualityRecord?.scoreCap);

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
    yieldPredict: (asRecord(record.yieldPredict) ?? {}) as CopernicusSnapshotView["yieldPredict"],
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

function eudrLabel(status: CopernicusSnapshotView["eudrStatus"]) {
  if (status === "verified") return "EUDR Verified";
  if (status === "non_compliant") return "EUDR Non-Compliant";
  return "EUDR Pending Review";
}

function shortHash(hash: string) {
  return hash.length > 16 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}

function chainLabel(chainId: number) {
  if (chainId === 31337) return "Hardhat local";
  if (chainId === 84532) return "Base Sepolia";
  return `Chain ${chainId}`;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  const { data, isLoading } = useQuery(
    trpc.lots.publicByCode.queryOptions(
      { code },
      { enabled: code.length > 0 },
    ),
  );

  const snapshot = asSnapshot(data?.snapshot);
  const lot = data?.lot;
  const polygon = lot?.polygon as Polygon | null | undefined;

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-28 md:px-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </main>
    );
  }

  if (!lot) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-28 md:px-6">
        <GlassCard className="w-full p-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Lot proof</p>
          <h1 className="mt-3 text-3xl font-black text-white">Lot not found</h1>
          <p className="mt-3 text-white/60">This QR code does not match an available Harvverse Sentinel lot.</p>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-24 md:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <GlassCard className="overflow-hidden border-primary/20">
          <div className="flex min-h-[420px] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">Copernicus QR Proof</p>
                <h1 className="mt-2 text-3xl font-black leading-tight text-white md:text-5xl">
                  {lot.code ?? `Lot ${lot.id}`}
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  {lot.farmName} · {lot.region}, {lot.country}
                </p>
              </div>
              <Badge className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                {snapshot?.sourceMode ?? "pending"}
              </Badge>
            </div>
            <div className="relative min-h-[320px] flex-1 bg-white/5">
              {polygon ? (
                <PolygonDisplayMap polygon={polygon} color="#67E8F9" fillOpacity={0.22} />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-white/30">
                  Polygon pending
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6">
          <GlassCard className="border-primary/20 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">Risk Score</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-6xl font-black text-white">{snapshot?.riskScore ?? "--"}</span>
                  <span className="pb-2 text-xl font-bold text-white/40">/100</span>
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${scoreTone(snapshot?.riskScore ?? 0)}`}>
                {snapshot?.riskTier ?? "No score"}
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <StatusPill
                icon={snapshot?.eudrStatus === "non_compliant" ? Ban : ShieldCheck}
                label={snapshot ? eudrLabel(snapshot.eudrStatus) : "EUDR Pending"}
                value={snapshot?.eligibleForInvestment ? "Eligible" : "Blocked or pending"}
              />
              <StatusPill
                icon={TrendingUp}
                label="YieldPredict"
                value={
                  snapshot
                    ? `${snapshot.yieldPredict.lowBandQuintales}-${snapshot.yieldPredict.highBandQuintales} qq`
                    : "Pending"
                }
              />
            </div>
          </GlassCard>

          <GlassCard className="border-white/10 p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">Satellite Signals</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric icon={Leaf} label="Sentinel-2 NDVI" value={snapshot ? numberValue(snapshot.sentinel2.currentNdvi).toFixed(2) : "--"} />
              <Metric icon={Satellite} label="Sentinel-1 SAR" value={snapshot?.sentinel1.moistureProxy ?? "--"} />
              <Metric icon={Sprout} label="ERA5 Rainfall" value={snapshot ? `${numberValue(snapshot.era5.annualRainfallMm)} mm` : "--"} />
              <Metric icon={ChartNoAxesColumn} label="DEM Altitude" value={snapshot ? `${numberValue(snapshot.dem.altitudeMasl)} masl` : "--"} />
            </div>
          </GlassCard>
        </div>
      </section>

      {snapshot ? (
        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="border-white/10 p-6">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-primary" />
              <h2 className="text-xl font-black text-white">Seven-Variable Breakdown</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.variables.map((variable) => (
                <div key={variable.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{variable.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">{variable.source}</p>
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
              <h2 className="text-xl font-black text-white">Investment Argument</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">{snapshot.yieldPredict.investmentArgument}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="Projected" value={`${snapshot.yieldPredict.projectedQuintales} qq`} />
                <Metric label="Low band" value={`${snapshot.yieldPredict.lowBandQuintales} qq`} />
                <Metric label="High band" value={`${snapshot.yieldPredict.highBandQuintales} qq`} />
              </div>
            </GlassCard>

            <GlassCard className="border-white/10 p-6">
              <div className="flex items-center gap-2">
                <Fingerprint className="size-5 text-primary" />
                <h2 className="text-xl font-black text-white">Evidence Packet</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <ProofRow label="Score hash" value={shortHash(snapshot.scoreHash)} mono />
                <ProofRow label="Chain" value={`${chainLabel(snapshot.chain.chainId)} · ${snapshot.chain.chainId}`} />
                <ProofRow label="Metadata" value={snapshot.chain.metadataStatus} />
                <ProofRow label="Confidence" value={snapshot.dataQuality.confidence} />
                <ProofRow label="Completeness" value={`${Math.round(snapshot.dataQuality.completeness * 100)}%`} />
                <ProofRow label="Parcel confidence" value={snapshot.dataQuality.parcelScale.confidence} />
                <ProofRow
                  label="S2 pixels"
                  value={
                    snapshot.dataQuality.parcelScale.sentinel2PixelEstimate == null
                      ? "Unknown"
                      : `~${snapshot.dataQuality.parcelScale.sentinel2PixelEstimate}`
                  }
                />
                <ProofRow
                  label="S1 IW cells"
                  value={
                    snapshot.dataQuality.parcelScale.sentinel1IwCellEstimate == null
                      ? "Unknown"
                      : `~${snapshot.dataQuality.parcelScale.sentinel1IwCellEstimate}`
                  }
                />
                <ProofRow
                  label="Score cap"
                  value={
                    snapshot.dataQuality.scoreCap.applied
                      ? `Max ${snapshot.dataQuality.scoreCap.maxScore}`
                      : "Not applied"
                  }
                />
                <ProofRow
                  label="Transaction"
                  value={snapshot.chain.transactionHash ? shortHash(snapshot.chain.transactionHash) : "Pending"}
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
          <h2 className="text-xl font-black text-white">Copernicus snapshot pending</h2>
          <p className="mt-2 text-sm text-white/60">
            This lot exists, but the satellite score has not been calculated yet.
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
