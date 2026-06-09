"use client";

import dynamic from "next/dynamic";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Polygon } from "geojson";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ExternalLink,
  HelpCircle,
  Loader2,
  MapPin,
  Satellite,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@harvverse-copernicus-hackathon/ui/components/tooltip";

import { COFFEE_LBS_PER_QQ, computeEarnings, formatUsdFromCents, formatUsdPrecise, formatUsd } from "@/lib/format";
import { farmBoundaryForLotMap } from "@/lib/geo-polygon";
import { getSnapshotChain, isCurrentDeploymentProof } from "@/lib/chainProof";
import { parseCopernicusSnapshot } from "@/lib/copernicus-snapshot";
import { CopernicusCarbonCaptureCard } from "@/components/copernicus/copernicus-carbon-capture-card";
import { CopernicusFarmerStatusCard } from "@/components/copernicus/copernicus-farmer-status-card";
import { CopernicusProofCard } from "@/components/copernicus/copernicus-proof-card";
import { CopernicusRiskScoreCard } from "@/components/copernicus/copernicus-risk-score-card";
import { CopernicusSignalsGrid } from "@/components/copernicus/copernicus-signals-grid";
import { CopernicusYieldPredictCard } from "@/components/copernicus/copernicus-yield-predict-card";
import { trpc } from "@/utils/trpc";

const PolygonDisplayMap = dynamic(() => import("@/components/polygon-display-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
});

function LotAgronomicNotes({ lot, t }: { lot: any; t: any }) {
  const items = [
    lot.descriptiveName != null
      ? { label: t("descriptive_name"), value: lot.descriptiveName }
      : null,
    lot.areaManzanas != null
      ? { label: t("area_manzanas"), value: Number(lot.areaManzanas).toFixed(2) + " " + t("unit_mzn") }
      : null,
    lot.plantAgeYears != null
      ? { label: t("plant_age"), value: String(lot.plantAgeYears) + " yrs" }
      : null,
    lot.averagePlantAgeYears != null
      ? { label: t("average_plant_age_years"), value: String(lot.averagePlantAgeYears) + " yrs" }
      : null,
    lot.harvestYear != null ? { label: t("harvest_year"), value: lot.harvestYear } : null,
    lot.numTrees != null
      ? { label: t("num_trees"), value: lot.numTrees.toLocaleString() }
      : null,
    lot.processingMethod != null
      ? { label: t("processing_method"), value: lot.processingMethod }
      : null,
    lot.managementType != null
      ? { label: t("management_type"), value: lot.managementType }
      : null,
    lot.previousProductionQq != null
      ? { label: t("previous_production_qq"), value: String(lot.previousProductionQq) + " qq" + (lot.productionDataYear ? " (" + lot.productionDataYear + ")" : "") }
      : null,
    lot.minimumPriceCentsPerLb != null
      ? { label: t("minimum_price_cents_per_lb"), value: formatUsdFromCents(lot.minimumPriceCentsPerLb) + "/lb" }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string | number }>;

  const hasNotes = Boolean(lot.lotObservations || lot.cycleNotes || lot.varietiesComposition);
  if (items.length === 0 && !hasNotes) return null;

  return (
    <GlassCard className="border-primary/20 bg-[#001020]/40 p-5 sm:p-6">
      <h2 className="mb-4 font-trenda text-sm font-bold uppercase tracking-wider text-white">
        {t("section_c_title")}
      </h2>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{item.label}</p>
              <p className="truncate font-bold text-white" title={String(item.value)}>{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {lot.varietiesComposition != null ? (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{t("varieties_composition")}</p>
          <p className="break-words text-xs font-bold text-white/80">{JSON.stringify(lot.varietiesComposition)}</p>
        </div>
      ) : null}
      {lot.lotObservations ? (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{t("lot_observations")}</p>
          <p className="text-sm italic leading-relaxed text-white/75">{lot.lotObservations}</p>
        </div>
      ) : null}
      {lot.cycleNotes ? (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{t("cycle_notes")}</p>
          <p className="text-sm italic leading-relaxed text-white/75">{lot.cycleNotes}</p>
        </div>
      ) : null}
    </GlassCard>
  );
}
function maturityFactorForAge(ageYears: number | null | undefined) {
  if (ageYears == null || ageYears < 0) return 1;
  if (ageYears < 2) return 0;
  if (ageYears < 3) return 0.2;
  if (ageYears < 4) return 0.5;
  if (ageYears < 5) return 0.8;
  if (ageYears < 6) return 0.95;
  if (ageYears <= 15) return 1;
  if (ageYears <= 20) return 1 - ((ageYears - 16) / 4) * 0.25;
  return 0.65;
}

function maturePotentialFromSnapshot(
  snapshot: ReturnType<typeof parseCopernicusSnapshot>,
  fallbackQq: number,
) {
  const currentQq = snapshot?.yieldPredict.projectedQuintales;
  const maturityFactor = snapshot?.yieldPredict.maturityFactor;
  if (currentQq != null && maturityFactor != null && maturityFactor > 0) {
    return Number((currentQq / maturityFactor).toFixed(1));
  }
  return fallbackQq;
}
function scoreTone(score: number | null | undefined) {
  if (score == null) return "border-white/10 bg-white/[0.03] text-white/45";
  if (score >= 80) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (score >= 60) return "border-lime-400/30 bg-lime-400/10 text-lime-300";
  if (score >= 40) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-red-400/30 bg-red-400/10 text-red-300";
}

export default function FarmerLotDetailPage() {
  const router = useRouter();
  const params = useParams<{ lotId: string }>();
  const lotId = Number(params.lotId);
  const t = useTranslations("lot");
  const tLF = useTranslations("lot_financial");
  const queryClient = useQueryClient();

  const { data: lot, isLoading } = useQuery(
    trpc.lots.byId.queryOptions(
      { id: lotId },
      { enabled: Number.isFinite(lotId) },
    ),
  );

  const computeCopernicus = useMutation(
    trpc.lots.computeCopernicusSnapshot.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.lots.byId.queryKey({ id: lotId }),
        });
      },
    }),
  );

  const markLocalProof = useMutation(
    trpc.lots.markLocalCopernicusProof.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.lots.byId.queryKey({ id: lotId }),
        });
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 md:px-0">
        <Skeleton className="mb-6 h-10 w-48" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[320px] w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="mx-auto max-w-5xl px-4 md:px-0">
        <GlassCard className="p-12 text-center border-primary/20">
          <p className="text-white/60">{t("not_found")}</p>
        </GlassCard>
      </div>
    );
  }

  const activePlan = lot.plans.find((p) => p.status !== "revoked") ?? null;
  const copernicusSnapshot = lot.copernicusSnapshot ?? null;
  const parsedCopernicusSnapshot = parseCopernicusSnapshot(copernicusSnapshot);
  const chainProof = getSnapshotChain(copernicusSnapshot);
  const localProofWritten = isCurrentDeploymentProof(chainProof);

  function renderLotTermsCard() {
    if (!activePlan) return null;

    const farmerSharePct = (activePlan.splitFarmerBps ?? 0) / 100;
    const partnerSharePct = (activePlan.splitPartnerBps ?? 0) / 100;
    const projectedY1Qq = (activePlan.projectedYieldY1TenthsQq ?? 0) / 10;
    const matureYieldQq = maturePotentialFromSnapshot(
      parsedCopernicusSnapshot,
      (activePlan.yieldCapY1TenthsQq ?? activePlan.projectedYieldY1TenthsQq ?? 0) / 10,
    );

    return (
      <GlassCard className="border-primary/20 bg-[#001020]/40 p-5 sm:p-6">
        <h2 className="mb-4 font-trenda text-sm font-bold uppercase tracking-wider text-white">
          {tLF("terms_title")}
        </h2>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
              {tLF("yield_y1_establishment")}
            </p>
            <p className="text-xl font-black text-white">{projectedY1Qq.toFixed(1)} qq</p>
          </div>
          <div className="rounded-lg border border-primary/25 bg-primary/10 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-primary">
              {tLF("yield_mature_potential")}
            </p>
            <p className="text-xl font-black text-primary">{matureYieldQq.toFixed(1)} qq</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{tLF("terms_ticket")}</p>
            <p className="font-bold text-primary">{formatUsdFromCents(activePlan.ticketCents)}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{tLF("terms_price")}</p>
            <p className="font-bold text-white">{formatUsdFromCents(activePlan.priceCentsPerLb)}/lb</p>
          </div>
          {activePlan.priceFloorCentsPerLb != null ? (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40">
                {tLF("terms_price_floor")}
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 cursor-help text-white/35" />
                  </TooltipTrigger>
                  <TooltipContent>{tLF("tooltip_price_floor")}</TooltipContent>
                </Tooltip>
              </p>
              <p className="font-bold text-white">{formatUsdFromCents(activePlan.priceFloorCentsPerLb)}/lb</p>
            </div>
          ) : null}
          {activePlan.agronomicCostCents != null ? (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40">
                {tLF("terms_agro_cost")}
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 cursor-help text-white/35" />
                  </TooltipTrigger>
                  <TooltipContent>{tLF("tooltip_agro_cost")}</TooltipContent>
                </Tooltip>
              </p>
              <p className="font-bold text-white">{formatUsdFromCents(activePlan.agronomicCostCents)}</p>
            </div>
          ) : null}
          {activePlan.projectedYieldY1TenthsQq != null ? (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40">
                {tLF("terms_yield")}
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 cursor-help text-white/35" />
                  </TooltipTrigger>
                  <TooltipContent>{tLF("tooltip_quintal")}</TooltipContent>
                </Tooltip>
              </p>
              <p className="font-bold text-white">{projectedY1Qq.toFixed(1)} qq</p>
            </div>
          ) : null}
          {activePlan.yieldCapY1TenthsQq != null ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{tLF("terms_yield_cap")}</p>
              <p className="font-bold text-white">{(activePlan.yieldCapY1TenthsQq / 10).toFixed(1)} qq</p>
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{tLF("terms_farmer_share")}</p>
            <p className="font-bold text-white">{farmerSharePct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{tLF("terms_partner_share")}</p>
            <p className="font-bold text-white">{partnerSharePct.toFixed(1)}%</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-0 text-[#EEEEEE]">
      <Button
        variant="ghost"
        className="mb-6 text-white/70 hover:bg-white/5 hover:text-white px-0 md:px-4"
        onClick={() => router.push(`/dashboard/farmer/farms/${lot.farmId}`)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("back_to_farm")}
      </Button>

      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 font-trenda text-3xl font-bold text-white">
            {lot.code ?? t("lot_id", { id: lot.id })}
          </h1>
          <p className="flex items-center gap-2 text-white/60">
            <MapPin className="size-4 text-primary/60" />
            {lot.farmName} · {lot.region}, {lot.country}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
            onClick={() => router.push(`/dashboard/farmer/lots/${lot.id}/edit`)}
          >
            {t("edit_lot_btn")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <GlassCard className="overflow-hidden border-primary/20 bg-[#001020]/40">
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-white/10 bg-transparent px-5 py-4 sm:px-6">
                <h2 className="font-trenda text-base font-bold text-white uppercase tracking-wider">
                  {t("lot_boundary")}
                </h2>
                <Badge className="rounded-full bg-emerald-500/20 text-emerald-400 border-emerald-500/30 uppercase">
                  {t(`status_${lot.status}` as any)}
                </Badge>
              </div>
              <div className="h-[280px] bg-black/20 sm:h-[340px]">
                {lot.polygon ? (
                  <PolygonDisplayMap
                    polygon={lot.polygon as Polygon}
                    color="#93D832"
                    contextPolygon={farmBoundaryForLotMap(
                      lot.farm?.polygon,
                      lot.polygon as Polygon,
                    ) ?? undefined}
                    contextColor="#4a9eff"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/30 italic">
                    {t("polygon_fallback")}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          <CopernicusFarmerStatusCard lot={lot} snapshotRaw={copernicusSnapshot} />
        </div>

        <GlassCard className="border-primary/20 bg-[#001020]/40 p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Copernicus
              </p>
              <h2 className="mt-1 font-trenda text-lg font-bold text-white">
                {t("satellite_verification")}
              </h2>
            </div>
            <Badge className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${scoreTone(copernicusSnapshot?.riskScore)}`}>
              {copernicusSnapshot?.sourceMode ?? t("pending")}
            </Badge>
          </div>

          {parsedCopernicusSnapshot ? (
            <div className="space-y-5">
              <CopernicusSignalsGrid snapshot={parsedCopernicusSnapshot} />

              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <CopernicusRiskScoreCard snapshot={parsedCopernicusSnapshot} />
                  <LotAgronomicNotes lot={lot} t={t} />
                  {renderLotTermsCard()}
                </div>
                <div className="flex flex-col gap-4">
                  <CopernicusYieldPredictCard snapshot={parsedCopernicusSnapshot} />
                  <CopernicusProofCard snapshot={parsedCopernicusSnapshot} />
                  <CopernicusCarbonCaptureCard snapshot={parsedCopernicusSnapshot} interactive />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                  disabled={computeCopernicus.isPending}
                  onClick={() => computeCopernicus.mutate({ lotId, sourceMode: "live" })}
                >
                  {computeCopernicus.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Satellite className="mr-2 h-4 w-4" />
                  )}
                  {t("refresh_live_analysis")}
                </Button>
                {!localProofWritten ? (
                  <Button
                    size="sm"
                    className="bg-primary text-[#001020] hover:bg-primary/90 font-bold"
                    disabled={markLocalProof.isPending}
                    onClick={() => markLocalProof.mutate({ lotId })}
                  >
                    {markLocalProof.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {t("generate_local_proof")}
                  </Button>
                ) : null}
                {lot.code ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
                    onClick={() => router.push(`/lot/${encodeURIComponent(lot.code ?? "")}` as Route)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("qr_proof")}
                  </Button>
                ) : null}
              </div>
              {markLocalProof.error ? (
                <p className="text-xs leading-5 text-red-300">{markLocalProof.error.message}</p>
              ) : null}
              {computeCopernicus.error ? (
                <p className="text-xs leading-5 text-red-300">{computeCopernicus.error.message}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-4">
              <p className="text-sm font-bold text-yellow-200">{t("satellite_pending_title")}</p>
              <p className="mt-1 text-xs leading-5 text-yellow-100/65">
                {t("live_analysis_desc")}
              </p>
              {computeCopernicus.isPending ? (
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("running_analysis_message")}
                </div>
              ) : computeCopernicus.error ? (
                <Button
                  size="sm"
                  className="bg-primary text-[#001020] hover:bg-primary/90 font-bold"
                  onClick={() => computeCopernicus.mutate({ lotId, sourceMode: "live" })}
                >
                  <Satellite className="mr-2 h-4 w-4" />
                  {t("retry_live_analysis")}
                </Button>
              ) : null}
              {computeCopernicus.error ? (
                <p className="text-xs leading-5 text-red-300">{computeCopernicus.error.message}</p>
              ) : null}
            </div>
          )}
        </GlassCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          {activePlan && (() => {
          const farmerSharePct = (activePlan.splitFarmerBps ?? 0) / 100;
          const partnerSharePct = (activePlan.splitPartnerBps ?? 0) / 100;
          const projectedY1Qq = (activePlan.projectedYieldY1TenthsQq ?? 0) / 10;
          const matureYieldQq = maturePotentialFromSnapshot(
            parsedCopernicusSnapshot,
            (activePlan.yieldCapY1TenthsQq ?? activePlan.projectedYieldY1TenthsQq ?? 0) / 10,
          );
          const currentAgeYears =
            parsedCopernicusSnapshot?.yieldPredict.plantAgeYears ??
            lot.plantAgeYears ??
            lot.averagePlantAgeYears ??
            null;
          const priceCentsPerLb =
            activePlan.priceFloorCentsPerLb != null
              ? Math.round(((activePlan.priceCentsPerLb ?? 0) + activePlan.priceFloorCentsPerLb) / 2)
              : activePlan.priceCentsPerLb ?? 0;
          const pricePerLbUsd = priceCentsPerLb / 100;
          const agronomicCostUsd = (activePlan.agronomicCostCents ?? 0) / 100;
          const earnings = computeEarnings({
            projectedYieldQq: projectedY1Qq,
            pricePerLbUsd,
            agronomicCostUsd,
            farmerSharePct,
          });
          const yearProjectionRows = [
            { key: "year1", year: tLF("projection_year_1"), yearsAhead: 0 },
            { key: "year2", year: tLF("projection_year_2"), yearsAhead: 1 },
            { key: "year3", year: tLF("projection_year_3"), yearsAhead: 2 },
            { key: "year4", year: tLF("projection_year_4"), yearsAhead: 3 },
          ].map((row) => {
            const factor = maturityFactorForAge(
              currentAgeYears == null ? null : currentAgeYears + row.yearsAhead,
            );
            const qq = row.key === "year1" ? projectedY1Qq : matureYieldQq * factor;
            const grossUsd = qq * COFFEE_LBS_PER_QQ * pricePerLbUsd;
            const netUsd = grossUsd - agronomicCostUsd;
            const partnerUsd = netUsd * (partnerSharePct / 100);
            const returnUsd = (activePlan.ticketCents ?? 0) / 100 + partnerUsd;
            return { ...row, qq, netUsd, partnerUsd, returnUsd };
          });
          return (
            <>
              <GlassCard className="border-emerald-500/20 bg-emerald-500/5 p-6 sm:p-8">
                <h2 className="font-trenda text-base font-bold text-emerald-400 uppercase tracking-wider mb-6">{tLF("earnings_title")}</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-white/50 text-xs uppercase tracking-wider">{tLF("earnings_gross")}</span>
                    <span className="text-white font-bold">{formatUsd(earnings.grossIncomeUsd)}</span>
                  </div>
                  <p className="text-[10px] text-white/30 italic px-1">
                    {tLF("gross_income_line", {
                      value: ((activePlan.projectedYieldY1TenthsQq ?? 0) / 10).toFixed(1),
                      price: formatUsdPrecise(pricePerLbUsd).replace("$", ""),
                    })}
                  </p>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-white/50 text-xs uppercase tracking-wider">{tLF("earnings_agro_cost")}</span>
                    <span className="text-red-400 font-bold">−{formatUsd(agronomicCostUsd)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/5 pt-4">
                    <span className="text-white/50 text-xs uppercase tracking-wider">{tLF("earnings_net_profit")}</span>
                    <span className="text-white font-black text-base">{formatUsd(earnings.netProfitUsd)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between bg-emerald-500/10 -mx-6 px-6 py-4 sm:-mx-8 sm:px-8">
                    <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      {tLF("earnings_your_share", { pct: farmerSharePct.toFixed(0) })}
                    </span>
                    <span className="text-emerald-300 font-black text-xl">{formatUsd(earnings.farmerEarningsUsd)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/30 mt-4 italic text-center">{tLF("earnings_note")}</p>
              </GlassCard>
              <GlassCard className="border-primary/20 bg-[#001020]/40 p-6 sm:p-8 xl:col-span-1">
                <h2 className="font-trenda text-base font-bold text-white uppercase tracking-wider mb-2">
                  {tLF("projection_table_title")}
                </h2>
                <p className="mb-5 text-xs leading-5 text-white/50">{tLF("projection_table_note")}</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="py-2 pr-4">{tLF("projection_col_year")}</th>
                        <th className="py-2 pr-4">{tLF("projection_col_qq")}</th>
                        <th className="py-2 pr-4">{tLF("projection_col_net")}</th>
                        <th className="py-2 pr-4">{tLF("projection_col_partner")}</th>
                        <th className="py-2 text-right">{tLF("projection_col_return")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {yearProjectionRows.map((row) => (
                        <tr key={row.key} className={row.key === "year1" ? "text-primary" : "text-white/80"}>
                          <td className="py-3 pr-4 font-bold">{row.year}</td>
                          <td className="py-3 pr-4">{row.qq.toFixed(1)} qq</td>
                          <td className="py-3 pr-4">{formatUsd(row.netUsd)}</td>
                          <td className="py-3 pr-4">{formatUsd(row.partnerUsd)}</td>
                          <td className="py-3 text-right font-bold">{formatUsd(row.returnUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </>
          );
          })()}
        </div>
      </div>
    </div>
  );
}
