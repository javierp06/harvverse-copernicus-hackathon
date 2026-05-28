"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, CheckCircle2, Edit3, ExternalLink, HelpCircle, ImagePlus, Loader2, MapPin, Mountain, Plus, RotateCcw, Satellite, XCircle } from "lucide-react";
import type { Polygon } from "geojson";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";

import { queryClient, trpc } from "@/utils/trpc";

const PolygonDisplayMap = dynamic(() => import("@/components/polygon-display-map"), {
  ssr: false,
});

function formatRelativeDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = then - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  if (Math.abs(diffDays) < 1) return "hoy";
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  return rtf.format(diffDays, "day");
}

function farmImageSrc(image: { url?: string | null; data?: string | null; mimeType: string }) {
  return image.url ?? (image.data ? `data:${image.mimeType};base64,${image.data}` : null);
}

export default function FarmerFarmDetailPage() {
  const router = useRouter();
  const params = useParams<{ farmId: string }>();
  const farmId = Number(params.farmId);
  const farmIdValid = Number.isFinite(farmId);
  const t = useTranslations("farm");
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const { data: farm, isLoading } = useQuery(
    trpc.farms.byId.queryOptions(
      { id: farmId },
      { enabled: farmIdValid },
    ),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-0 text-[#EEEEEE]">
      <Button
        variant="ghost"
        className="mb-6 text-white/70 hover:bg-white/5 hover:text-white px-0 md:px-4"
        onClick={() => router.push("/dashboard/farmer/my-farms")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("back_to_my_farms")}
      </Button>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-1/2" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      ) : !farm ? (
        <GlassCard className="p-12 text-center border-primary/20">
          <p className="text-white/60">{t("not_found")}</p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="mb-6 border-primary/20 p-5">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="mb-2 font-trenda text-2xl md:text-3xl font-bold text-white leading-tight">{farm.name}</h1>
                <p className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-primary/60" />
                    {farm.region}, {farm.country}
                  </span>
                  {farm.altitudeMasl ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mountain className="size-4 text-primary/60" />
                      {farm.altitudeMasl}m
                    </span>
                  ) : null}
                </p>
                {(() => {
                  const mapsUrl = (() => {
                    if (farm.latitude != null && farm.longitude != null) {
                      return `https://www.google.com/maps?q=${farm.latitude},${farm.longitude}`;
                    }
                    const poly = farm.polygon != null ? (farm.polygon as Polygon) : null;
                    if (poly) {
                      const ring = poly.coordinates[0] ?? [];
                      const pts = ring.slice(0, -1);
                      if (pts.length > 0) {
                        const lat = pts.reduce((s, c) => s + (c[1] ?? 0), 0) / pts.length;
                        const lng = pts.reduce((s, c) => s + (c[0] ?? 0), 0) / pts.length;
                        return `https://www.google.com/maps?q=${lat},${lng}`;
                      }
                    }
                    return null;
                  })();
                  return mapsUrl ? (
                    <div className="mt-3">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#67B9C1] hover:text-[#67B9C1]/80 transition-colors bg-[#67B9C1]/5 px-2 py-1 rounded"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t("open_in_maps")}
                      </a>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <div className="rounded-full bg-primary/15 px-4 py-1.5 text-xs font-bold text-primary ring-1 ring-primary/25 backdrop-blur-md">
                  {farm.verified ? t("verified") : t("pending_verification")}
                </div>
                <Button
                  type="button"
                  className="h-9 bg-primary text-[#001020] hover:bg-primary/90"
                  onClick={() => router.push(`/dashboard/farmer/farms/${farm.id}/create-lot`)}
                >
                  <Plus className="mr-2 size-4" />
                  Create lot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-white/15 text-white/75 hover:bg-white/10 hover:text-white"
                  onClick={() => router.push(`/dashboard/farmer/farms/${farm.id}/edit`)}
                >
                  <Edit3 className="mr-2 size-4" />
                  {t("edit_farm_cta")}
                </Button>
              </div>
            </div>
          </GlassCard>

          {farm.images && farm.images.length > 0 ? (
            <GlassCard className="mb-6 border-primary/20 bg-white/[0.03] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="section-title text-xl md:text-2xl">
                  {t("images_title")}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-[#67B9C1]/40 text-[#67B9C1] hover:bg-[#67B9C1]/10"
                  onClick={() => router.push(`/dashboard/farmer/farms/${farm.id}/edit#images`)}
                >
                  <ImagePlus className="mr-2 size-4" />
                  {t("manage_photos_cta")}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                {(() => {
                  const primary = farm.images.find((image) => image.isPrimary) ?? farm.images[0];
                  if (!primary) return null;
                  const src = farmImageSrc(primary);
                  if (!src) return null;
                  return (
                    <button
                      type="button"
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left"
                      onClick={() => setExpandedImage(src)}
                    >
                      <img
                        src={src}
                        alt={primary.filename}
                        className="h-72 w-full object-cover transition-transform hover:scale-[1.02]"
                      />
                    </button>
                  );
                })()}
                <div className="grid grid-cols-2 gap-3">
                  {farm.images.map((image) => {
                    const src = farmImageSrc(image);
                    if (!src) return null;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                        onClick={() => setExpandedImage(src)}
                      >
                        <img src={src} alt={image.filename} className="aspect-[4/3] w-full object-cover" />
                        {image.isPrimary ? (
                          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-[#001020]">
                            Principal
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="mb-6 border-primary/20 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-trenda text-xl font-bold text-white">
                    {t("photos_empty_title")}
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    {t("photos_empty_desc")}
                  </p>
                </div>
                <Button
                  type="button"
                  className="bg-primary font-black text-[#001020] hover:bg-primary/90"
                  onClick={() => router.push(`/dashboard/farmer/farms/${farm.id}/edit#images`)}
                >
                  <ImagePlus className="mr-2 size-4" />
                  {t("add_photos_cta")}
                </Button>
              </div>
            </GlassCard>
          )}

          <GlassCard className="mb-6 border-primary/20 bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title text-xl md:text-2xl">
                {t("farm_details_title")}
              </h2>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-white/15 text-white/75 hover:bg-white/10 hover:text-white"
                onClick={() => router.push(`/dashboard/farmer/farms/${farm.id}/edit`)}
              >
                <Edit3 className="mr-2 size-4" />
                {t("edit_details_cta")}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{t("varieties")}</p>
                <p className="mt-1 text-sm font-bold text-white">{farm.varieties?.join(", ") || "—"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{t("certifications")}</p>
                <p className="mt-1 text-sm font-bold text-white">{farm.certifications?.join(", ") || "—"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{t("total_area")}</p>
                <p className="mt-1 text-sm font-bold text-primary">{farm.totalArea ? `${farm.totalArea} ha` : "—"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{t("altitude")}</p>
                <p className="mt-1 text-sm font-bold text-primary">{farm.altitudeMasl ? `${farm.altitudeMasl} m` : "—"}</p>
              </div>
            </div>
            {farm.description ? (
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                {farm.description}
              </p>
            ) : null}
          </GlassCard>

          {farm.polygon ? (
            <GlassCard className="mb-6 border-primary/20 bg-white/[0.03] p-5">
              <h2 className="section-title mb-4 text-xl md:text-2xl">
                {t("location_title")}
              </h2>
              <div className="h-96 overflow-hidden rounded-xl border border-white/10">
                <PolygonDisplayMap polygon={farm.polygon as Polygon} />
              </div>
            </GlassCard>
          ) : null}

          <GlassCard className="mb-6 border-primary/20 bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="section-title text-xl md:text-2xl">{t("investment_lots_title")}</h2>
                <p className="mt-1 text-sm text-white/55">
                  {t("lots_section_desc")}
                </p>
              </div>
              <Button
                type="button"
                className="bg-primary font-black text-[#001020] hover:bg-primary/90"
                onClick={() => router.push(`/dashboard/farmer/farms/${farm.id}/create-lot`)}
              >
                <Plus className="mr-2 size-4" />
                {t("create_lot_btn")}
              </Button>
            </div>

            {farm.lots.length > 0 ? (
              <div className="grid gap-3">
                {farm.lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-trenda text-lg font-bold text-white">
                        {lot.code ?? t("lot_id", { id: lot.id })}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 uppercase">
                          {t(`status_${lot.status}` as any)}
                        </span>
                        {lot.variety ? <span>{lot.variety}</span> : null}
                        {lot.areaManzanas ? <span>{Number(lot.areaManzanas).toFixed(2)} {t("unit_mzn")}</span> : null}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#67B9C1]/40 text-[#67B9C1] hover:bg-[#67B9C1]/10"
                      onClick={() => router.push(`/dashboard/farmer/lots/${lot.id}`)}
                    >
                      {t("open_lot")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm text-white/60">{t("no_lots_yet")}</p>
              </div>
            )}
          </GlassCard>

          {expandedImage ? (
            <button
              type="button"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setExpandedImage(null)}
            >
              <img
                src={expandedImage}
                alt=""
                className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain"
              />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
