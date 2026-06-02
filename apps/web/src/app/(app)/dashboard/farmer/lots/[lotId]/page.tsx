"use client";

import dynamic from "next/dynamic";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Polygon } from "geojson";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Ban,
  ExternalLink,
  Fingerprint,
  HelpCircle,
  Loader2,
  MapPin,
  Mountain,
  Satellite,
  ShieldCheck,
  TrendingUp,
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

import { computeEarnings, formatUsdFromCents, formatUsdPrecise, formatUsd } from "@/lib/format";
import { asRecord, chainLabel, getSnapshotChain } from "@/lib/chainProof";
import { CopernicusFarmerStatusCard } from "@/components/copernicus/copernicus-farmer-status-card";
import { trpc } from "@/utils/trpc";

const PolygonDisplayMap = dynamic(() => import("@/components/polygon-display-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
});

function scoreTone(score: number | null | undefined) {
  if (score == null) return "border-white/10 bg-white/[0.03] text-white/45";
  if (score >= 80) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (score >= 60) return "border-lime-400/30 bg-lime-400/10 text-lime-300";
  if (score >= 40) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-red-400/30 bg-red-400/10 text-red-300";
}

function shortHash(hash: string | null | undefined) {
  if (!hash) return "Pending";
  return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}

function metricValue(val: unknown, decimals = 2) {
  const num = Number(val);
  return Number.isFinite(num) ? num.toFixed(decimals) : "--";
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

  function eudrLabel(status: string | null | undefined) {
    if (status === "verified") return t("eudr_verified");
    if (status === "non_compliant") return t("eudr_non_compliant");
    return t("eudr_pending");
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-0">
        <Skeleton className="mb-6 h-10 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-0">
        <GlassCard className="p-12 text-center border-primary/20">
          <p className="text-white/60">{t("not_found")}</p>
        </GlassCard>
      </div>
    );
  }

  const activePlan = lot.plans.find((p) => p.status !== "revoked") ?? null;
  const copernicusSnapshot = lot.copernicusSnapshot ?? null;
  const copernicusEligible = copernicusSnapshot?.eligibleForInvestment === true;
  const chainProof = getSnapshotChain(copernicusSnapshot);
  const localProofWritten = chainProof.metadataStatus === "written";

  const sentinel2 = asRecord(copernicusSnapshot?.sentinel2) ?? {};
  const sentinel1 = asRecord(copernicusSnapshot?.sentinel1) ?? {};
  const dem = asRecord(copernicusSnapshot?.dem) ?? {};
  const era5 = asRecord(copernicusSnapshot?.era5) ?? {};

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-0 text-[#EEEEEE]">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <GlassCard className="overflow-hidden border-primary/20 lg:col-span-2">
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-6 py-4">
              <h2 className="font-trenda text-base font-bold text-white uppercase tracking-wider">
                {t("lot_boundary")}
              </h2>
              <Badge className="rounded-full bg-emerald-500/20 text-emerald-400 border-emerald-500/30 uppercase">
                {t(`status_${lot.status}` as any)}
              </Badge>
            </div>
            <div className="h-[320px] bg-black/20">
              {lot.polygon ? (
                <PolygonDisplayMap polygon={lot.polygon as Polygon} color="#93D832" />
              ) : (
                <div className="flex h-full items-center justify-center text-white/30 italic">
                  {t("polygon_fallback")}
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          <CopernicusFarmerStatusCard lot={lot} snapshotRaw={copernicusSnapshot} />

        <GlassCard className="p-6 md:p-8 border-primary/20">
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

          {copernicusSnapshot ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg border p-3 ${scoreTone(copernicusSnapshot.riskScore)}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{t("risk_score")}</p>
                  <p className="mt-1 text-3xl font-black">
                    {copernicusSnapshot.riskScore}
                    <span className="text-sm opacity-60">/100</span>
                  </p>
                </div>
                <div className={`rounded-lg border p-3 ${copernicusEligible ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {t("investment_gate")}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm font-black">
                    {copernicusEligible ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    {copernicusEligible ? t("eligible") : t("blocked")}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">EUDR</span>
                  <span className="font-bold text-white">{eudrLabel(copernicusSnapshot.eudrStatus)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">{t("dem_altitude")}</span>
                  <span className="font-bold text-white">{metricValue(dem.altitudeMasl, 0)} {t("unit_masl")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t("s2_ndvi")}</span>
                    <p className="mt-1 font-mono text-sm text-primary">{metricValue(sentinel2.currentNdvi)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t("s2_ndre")}</span>
                    <p className="mt-1 font-mono text-sm text-primary">{metricValue(sentinel2.currentNdre)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t("s2_ndwi")}</span>
                    <p className="mt-1 font-mono text-sm text-primary">{metricValue(sentinel2.currentNdwi)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t("s1_vh_vv_rvi")}</span>
                    <p className="mt-1 font-mono text-sm text-primary">
                      {metricValue(sentinel1.vhVvRatio)} · {metricValue(sentinel1.radarVegetationIndex)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">{t("era5_rainfall")}</span>
                  <span className="font-bold text-white">{metricValue(era5.annualRainfallMm, 0)} {t("unit_mm_year")}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">{t("score_version")}</span>
                  <span className="font-mono text-xs text-primary">{copernicusSnapshot.scoreVersion}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="flex items-center gap-1 text-white/45">
                    <Fingerprint className="h-3.5 w-3.5" />
                    {t("hash")}
                  </span>
                  <span className="font-mono text-xs text-primary">{shortHash(copernicusSnapshot.scoreHash)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">{t("local_proof")}</span>
                  <span className={localProofWritten ? "font-bold text-emerald-300" : "font-bold text-yellow-200"}>
                    {localProofWritten ? t("verified") : t("pending")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">{t("chain")}</span>
                  <span className="font-mono text-xs text-primary">
                    {chainLabel(chainProof.chainId)} · {chainProof.chainId}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/45">{t("transaction")}</span>
                  <span className="font-mono text-xs text-primary">{shortHash(chainProof.transactionHash)}</span>
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

        {lot.areaManzanas != null || lot.plantAgeYears != null || lot.harvestYear != null ? (
          <GlassCard className="p-6 md:p-8 border-primary/20">
            <h2 className="font-trenda text-base font-bold text-white uppercase tracking-wider mb-6">{t("section_c_title")}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
              {lot.areaManzanas != null && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{t("area_manzanas")}</p>
                  <p className="text-white font-bold">{Number(lot.areaManzanas).toFixed(2)} {t("unit_mzn")}</p>
                </div>
              )}
              {lot.plantAgeYears != null && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{t("plant_age")}</p>
                  <p className="text-white font-bold">{lot.plantAgeYears} yrs</p>
                </div>
              )}
              {lot.harvestYear != null && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{t("harvest_year")}</p>
                  <p className="text-white font-bold">{lot.harvestYear}</p>
                </div>
              )}
              {lot.numTrees != null && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{t("num_trees")}</p>
                  <p className="text-white font-bold">{lot.numTrees.toLocaleString()}</p>
                </div>
              )}
            </div>
            {lot.cycleNotes && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">{t("cycle_notes")}</p>
                <p className="text-white/80 text-sm whitespace-pre-line leading-relaxed italic">{lot.cycleNotes}</p>
              </div>
            )}
          </GlassCard>
        ) : null}

        {activePlan && (() => {
          const farmerSharePct = (activePlan.splitFarmerBps ?? 0) / 100;
          const partnerSharePct = (activePlan.splitPartnerBps ?? 0) / 100;
          const earnings = computeEarnings({
            projectedYieldQq: (activePlan.projectedYieldY1TenthsQq ?? 0) / 10,
            pricePerLbUsd: (activePlan.priceCentsPerLb ?? 0) / 100,
            agronomicCostUsd: (activePlan.agronomicCostCents ?? 0) / 100,
            farmerSharePct,
          });
          return (
            <>
              <GlassCard className="p-6 md:p-8 border-primary/20">
                <h2 className="font-trenda text-base font-bold text-white uppercase tracking-wider mb-6">{tLF("terms_title")}</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{tLF("terms_ticket")}</p>
                    <p className="text-white font-bold text-primary">{formatUsdFromCents(activePlan.ticketCents)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{tLF("terms_price")}</p>
                    <p className="text-white font-bold">{formatUsdFromCents(activePlan.priceCentsPerLb)}/lb</p>
                  </div>
                  {activePlan.priceFloorCentsPerLb != null && (
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                        {tLF("terms_price_floor")}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-white/35 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>{tLF("tooltip_price_floor")}</TooltipContent>
                        </Tooltip>
                      </p>
                      <p className="text-white font-bold">{formatUsdFromCents(activePlan.priceFloorCentsPerLb)}/lb</p>
                    </div>
                  )}
                  {activePlan.agronomicCostCents != null && (
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                        {tLF("terms_agro_cost")}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-white/35 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>{tLF("tooltip_agro_cost")}</TooltipContent>
                        </Tooltip>
                      </p>
                      <p className="text-white font-bold">{formatUsdFromCents(activePlan.agronomicCostCents)}</p>
                    </div>
                  )}
                  {activePlan.projectedYieldY1TenthsQq != null && (
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                        {tLF("terms_yield")}
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-white/35 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>{tLF("tooltip_quintal")}</TooltipContent>
                        </Tooltip>
                      </p>
                      <p className="text-white font-bold">{(activePlan.projectedYieldY1TenthsQq / 10).toFixed(1)} qq</p>
                    </div>
                  )}
                  {activePlan.yieldCapY1TenthsQq != null && (
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{tLF("terms_yield_cap")}</p>
                      <p className="text-white font-bold">{(activePlan.yieldCapY1TenthsQq / 10).toFixed(1)} qq</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{tLF("terms_farmer_share")}</p>
                    <p className="text-white font-bold">{farmerSharePct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{tLF("terms_partner_share")}</p>
                    <p className="text-white font-bold">{partnerSharePct.toFixed(1)}%</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6 md:p-8 bg-emerald-500/5 border-emerald-500/20">
                <h2 className="font-trenda text-base font-bold text-emerald-400 uppercase tracking-wider mb-6">{tLF("earnings_title")}</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-white/50 text-xs uppercase tracking-wider">{tLF("earnings_gross")}</span>
                    <span className="text-white font-bold">{formatUsd(earnings.grossIncomeUsd)}</span>
                  </div>
                  <p className="text-[10px] text-white/30 italic px-1">
                    {tLF("gross_income_line", {
                      value: ((activePlan.projectedYieldY1TenthsQq ?? 0) / 10).toFixed(1),
                      price: formatUsdPrecise((activePlan.priceCentsPerLb ?? 0) / 100).replace("$", ""),
                    })}
                  </p>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-white/50 text-xs uppercase tracking-wider">{tLF("earnings_agro_cost")}</span>
                    <span className="text-red-400 font-bold">−{formatUsd((activePlan.agronomicCostCents ?? 0) / 100)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/5 pt-4">
                    <span className="text-white/50 text-xs uppercase tracking-wider">{tLF("earnings_net_profit")}</span>
                    <span className="text-white font-black text-base">{formatUsd(earnings.netProfitUsd)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-500/10 -mx-6 md:-mx-8 px-6 md:px-8 py-4 mt-2">
                    <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      {tLF("earnings_your_share", { pct: farmerSharePct.toFixed(0) })}
                    </span>
                    <span className="text-emerald-300 font-black text-xl">{formatUsd(earnings.farmerEarningsUsd)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/30 mt-4 italic text-center">{tLF("earnings_note")}</p>
              </GlassCard>
            </>
          );
        })()}
        </div>
      </div>
    </div>
  );
}
