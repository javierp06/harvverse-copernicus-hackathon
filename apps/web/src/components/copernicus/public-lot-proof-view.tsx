"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { BadgeCheck, Ban, ShieldCheck, TrendingUp } from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";
import { TooltipProvider } from "@harvverse-copernicus-hackathon/ui/components/tooltip";

import { metricValue, parseCopernicusSnapshot, scoreTone } from "@/lib/copernicus-snapshot";
import { isGeoJsonPolygon } from "@/lib/geo-polygon";
import { CopernicusQrPanel } from "./copernicus-qr-panel";
import { CopernicusSignalsGrid } from "./copernicus-signals-grid";
import { CopernicusProofCard } from "./copernicus-proof-card";
import { CopernicusYieldPredictCard } from "./copernicus-yield-predict-card";
import {
  CopernicusSectionHeader,
  CopernicusStatusPill,
} from "./copernicus-ui";

const PolygonDisplayMap = dynamic(() => import("@/components/polygon-display-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export type PublicLotProofData = {
  lot: {
    id: number;
    code?: string | null;
    farmName: string;
    region: string;
    country: string;
    polygon?: unknown;
  };
  snapshot: unknown;
};

function resolveLotPolygon(lotPolygon: unknown, snapshotRaw: unknown) {
  if (isGeoJsonPolygon(lotPolygon)) return lotPolygon;
  if (typeof snapshotRaw === "object" && snapshotRaw != null) {
    const snapshotPolygon = (snapshotRaw as { polygon?: unknown }).polygon;
    if (isGeoJsonPolygon(snapshotPolygon)) return snapshotPolygon;
  }
  return null;
}

export function PublicLotProofView({ data }: { data: PublicLotProofData | null }) {
  const t = useTranslations("lot_proof");
  const commonT = useTranslations("common");

  if (!data?.lot) {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 pb-16 pt-24 md:px-6 md:pt-28">
        <GlassCard className="w-full p-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">{commonT("lot")}</p>
          <h1 className="mt-3 text-3xl font-black text-white">{t("not_found_title")}</h1>
          <p className="mt-3 text-white/60">{t("not_found_desc")}</p>
        </GlassCard>
      </main>
    );
  }

  const { lot } = data;
  const snapshot = parseCopernicusSnapshot(data.snapshot);
  const polygon = resolveLotPolygon(lot.polygon, data.snapshot);
  const lotCode = lot.code ?? String(lot.id);

  function eudrLabel(status: NonNullable<typeof snapshot>["eudrStatus"]) {
    if (status === "verified") return t("eudr_verified");
    if (status === "non_compliant") return t("eudr_non_compliant");
    return t("eudr_pending");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 md:px-6 md:pt-28">
      <TooltipProvider>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <GlassCard className="overflow-hidden border-primary/20">
              <div className="flex min-h-[420px] flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
                      {t("title")}
                    </p>
                    <h1 className="mt-2 text-3xl font-black leading-tight text-white md:text-5xl">
                      {lot.code ?? t("lot_id", { id: lot.id })}
                    </h1>
                    <p className="mt-2 text-sm text-white/60">
                      {lot.farmName} · {lot.region}, {lot.country}
                    </p>
                  </div>
                  <Badge className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                    {snapshot
                      ? t(`source_mode.${snapshot.sourceMode}`)
                      : t("source_mode_pending")}
                  </Badge>
                </div>
                <div className="relative h-[320px] w-full shrink-0 bg-white/5 md:h-[380px]">
                  {polygon ? (
                    <PolygonDisplayMap
                      polygon={polygon}
                      className="absolute inset-0"
                      color="#67E8F9"
                      fillOpacity={0.22}
                      mapLabel={t("satellite_map")}
                      invalidPolygonMessage={t("invalid_polygon")}
                      tileErrorMessage={t("tile_error")}
                    />
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center italic text-white/30">
                      {t("polygon_pending")}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            <CopernicusSignalsGrid snapshot={snapshot} />

            {snapshot ? (
              <GlassCard className="border-white/10 p-6">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-primary" />
                  <CopernicusSectionHeader
                    title={t("breakdown_title")}
                    description={t("section_help.breakdown")}
                  />
                </div>
                <div className="mt-5 space-y-3">
                  {snapshot.variables.map((variable) => (
                    <div
                      key={variable.key}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-white">
                            {t(`variables.${variable.key}` as "variables.sentinel2_current_ndvi")}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
                            {t(
                              `variable_sources.${variable.source.toLowerCase()}` as "variable_sources.sentinel-2",
                            )}
                          </p>
                        </div>
                        <p className="text-xl font-black text-primary">{variable.score}</p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${variable.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ) : null}
          </div>

          <div className="flex h-fit flex-col gap-6 lg:sticky lg:top-8 lg:col-span-4">
            <CopernicusQrPanel lotCode={lotCode} />

            <GlassCard className="border-primary/20 p-6">
              <CopernicusSectionHeader
                title={t("risk_score")}
                description={t("section_help.risk_score")}
              />
              <div className="mt-4 flex items-end gap-2">
                <span className="text-7xl font-black text-white">{snapshot?.riskScore ?? "--"}</span>
                <span className="pb-2 text-xl font-bold text-white/30">/100</span>
              </div>
              <div
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase ${scoreTone(snapshot?.riskScore)}`}
              >
                {snapshot ? t(`risk_tier.${snapshot.riskTier}` as "risk_tier.excellent") : t("no_score")}
              </div>
              <div className="mt-6 grid gap-4">
                <CopernicusStatusPill
                  icon={snapshot?.eudrStatus === "non_compliant" ? Ban : ShieldCheck}
                  label={snapshot ? eudrLabel(snapshot.eudrStatus) : t("eudr_pending")}
                  value={snapshot?.eligibleForInvestment ? t("eligible") : t("blocked_or_pending")}
                  variant={snapshot?.eligibleForInvestment ? "success" : "warning"}
                />
                <CopernicusStatusPill
                  icon={TrendingUp}
                  label={t("yield_predict")}
                  value={
                    snapshot
                      ? `${metricValue(snapshot.yieldPredict.lowBandQuintales, 1)}-${metricValue(snapshot.yieldPredict.highBandQuintales, 1)} ${t("unit_qq")}`
                      : t("pending")
                  }
                />
              </div>
            </GlassCard>

            {snapshot ? (
              <>
                <CopernicusYieldPredictCard snapshot={snapshot} />
                <CopernicusProofCard snapshot={snapshot} />
              </>
            ) : (
              <GlassCard className="border-yellow-400/20 p-6">
                <h2 className="text-xl font-black text-white">{t("pending_title")}</h2>
                <p className="mt-2 text-sm text-white/60">{t("pending_desc")}</p>
              </GlassCard>
            )}
          </div>
        </div>
      </TooltipProvider>
    </main>
  );
}

export function PublicLotProofSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 pt-24 md:px-6 md:pt-28">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </main>
  );
}
