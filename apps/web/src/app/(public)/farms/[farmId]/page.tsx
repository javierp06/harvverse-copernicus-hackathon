"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MapPin, Mountain, Sprout, Layers, ArrowLeft } from "lucide-react";

import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";
import { trpc } from "@/utils/trpc";
import { motion } from "framer-motion";
import { FarmLotCopernicusRow } from "@/components/copernicus/farm-lot-copernicus-row";
import { CopernicusBadgeRow } from "@/components/copernicus/copernicus-badges";
import { aggregateFarmCopernicusSummary } from "@/lib/copernicus-snapshot";
import { isGeoJsonPolygon, resolveFarmMapPolygon } from "@/lib/geo-polygon";

const PolygonDisplayMap = dynamic(() => import("@/components/polygon-display-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-3xl" />,
});

function farmImageSrc(image: any) {
  return image.url ?? (image.data ? `data:${image.mimeType};base64,${image.data}` : null);
}

export default function PublicFarmDetailPage() {
  const params = useParams<{ farmId: string }>();
  const farmId = Number(params.farmId);
  const t = useTranslations("landing");
  const tf = useTranslations("farm");
  const tc = useTranslations("copernicus");
  const tw = useTranslations("waitlist");
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const { data: farm, isLoading } = useQuery(
    trpc.farms.byIdPublic.queryOptions(
      { farmId },
      { enabled: Number.isFinite(farmId) },
    ),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-32 space-y-12">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="h-[600px] rounded-3xl" />
          <Skeleton className="h-[600px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-32">
        <GlassCard className="p-12 text-center border-primary/20">
          <p className="text-white/60">{tf("not_found")}</p>
          <Button asChild variant="link" className="mt-4 text-primary">
            <Link href="/farms">{tf("back_to_directory")}</Link>
          </Button>
        </GlassCard>
      </div>
    );
  }

  const allImages = [
    ...(farm.images?.map(farmImageSrc) ?? []),
    ...(farm.photoUrls ?? [])
  ].filter(Boolean);

  const [mainImage, ...gallery] = allImages;
  const farmCopernicus = aggregateFarmCopernicusSummary(farm.lots ?? []);
  const lotsWithCode = (farm.lots ?? []).filter((l) => l.code);
  const mapPolygon = resolveFarmMapPolygon(farm.polygon, farm.lots ?? []);
  const showMapHero = !mainImage && mapPolygon != null;
  const showFarmBoundaryMap =
    mainImage != null && isGeoJsonPolygon(farm.polygon);
  const mapFromLotOnly = showMapHero && !isGeoJsonPolygon(farm.polygon);

  return (
    <div className="flex flex-col min-h-screen bg-[#0F1A24]">
      <section className="pt-24 pb-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Link href="/farms" className="inline-flex items-center text-sm font-bold text-white/40 hover:text-primary transition-colors mb-12 uppercase tracking-widest">
            <ArrowLeft className="mr-2 size-4" />
            {t("nav_open_farms")}
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Visuals */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-video md:aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50"
              >
                {mainImage ? (
                  <img src={mainImage} alt={farm.name} className="size-full object-cover" />
                ) : showMapHero && mapPolygon ? (
                  <PolygonDisplayMap
                    polygon={mapPolygon}
                    className="absolute inset-0"
                    color="#93D832"
                    fillOpacity={0.25}
                    mapLabel={tf("satellite_preview")}
                    invalidPolygonMessage={tf("satellite_invalid_polygon")}
                    tileErrorMessage={tf("satellite_tile_error")}
                  />
                ) : (
                  <div className="size-full bg-white/5 flex items-center justify-center text-white/10">
                    <Sprout className="size-24" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1A24]/60 to-transparent pointer-events-none" />
              </motion.div>

              {mapFromLotOnly ? (
                <p className="text-center text-xs text-white/45">{tf("satellite_from_lot")}</p>
              ) : null}

              {gallery.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setExpandedImage(img)}
                      className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-primary/50 transition-colors bg-white/5"
                    >
                      <img src={img} alt={`${farm.name} gallery ${i}`} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {showFarmBoundaryMap && isGeoJsonPolygon(farm.polygon) ? (
                <div className="h-80 rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-inner">
                  <PolygonDisplayMap
                    polygon={farm.polygon}
                    mapLabel={tf("map_farm_boundary")}
                    invalidPolygonMessage={tf("satellite_invalid_polygon")}
                    tileErrorMessage={tf("satellite_tile_error")}
                  />
                </div>
              ) : null}
            </div>

            {/* Right Column - Info */}
            <div className="space-y-10">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4"
                >
                  {farm.name}
                </motion.h1>
                <p className="text-xl text-white/60 font-medium">
                  {farm.region}, {farm.country}
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {farm.verified && (
                  <Badge className="rounded-full px-4 py-1 text-xs font-black bg-primary text-[#0F1A24] border-0">
                    {tf("verified")}
                  </Badge>
                )}
                <CopernicusBadgeRow summary={farmCopernicus} />
              </div>

              {lotsWithCode.length > 0 ? (
                <GlassCard className="border-primary/20 p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
                    Copernicus
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">{tc("farm_lots_copernicus")}</h2>
                  <div className="mt-4 space-y-3">
                    {lotsWithCode.map((lot) => (
                      <FarmLotCopernicusRow key={lot.id} lot={lot} />
                    ))}
                  </div>
                </GlassCard>
              ) : null}

              <div className="grid grid-cols-2 gap-y-8 gap-x-12 py-8 border-y border-white/5">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                    <MapPin className="size-3 text-primary" /> {tf("label_location")}
                  </p>
                  <p className="text-lg font-bold text-white/80">{farm.region}, {farm.country}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                    <Mountain className="size-3 text-primary" /> {tf("label_altitude")}
                  </p>
                  <p className="text-lg font-bold text-white/80">{farm.altitudeMasl ?? "—"} {tf("label_masl")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                    <Sprout className="size-3 text-primary" /> {tf("label_variety")}
                  </p>
                  <p className="text-lg font-bold text-white/80">{(farm.varieties ?? [])[0] ?? tf("specialty_blend")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                    <Layers className="size-3 text-primary" /> {tf("label_area")}
                  </p>
                  <p className="text-lg font-bold text-white/80">{farm.areaManzanas ? `${Number(farm.areaManzanas).toFixed(1)} ${tf("unit_mzn")}` : "—"}</p>
                </div>
              </div>

              <div className="pt-8">
                <div className="bg-[#1E3A2F]/40 p-8 rounded-3xl border border-primary/20 space-y-6">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <div className="size-2 bg-primary rounded-full animate-pulse" />
                    {tf("available_co_investment")}
                  </div>
                  <Button
                    asChild
                    size="lg"
                    className="w-full h-16 bg-primary text-[#0F1A24] font-black text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
                  >
                    <Link href="/waiting-list">
                      {tw("submit")}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="bg-[#1E3A2F] py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
           <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <p className="text-xl md:text-2xl font-bold text-white text-center md:text-left">
                {tf("is_this_your_farm")} {tf("claim_profile")}
              </p>
              <Button
                asChild
                className="bg-primary text-[#0F1A24] font-black px-8 py-6 rounded-xl text-lg h-14"
              >
                <Link href={"/sign-up" as Route}>{t("hero_cta_farmer")}</Link>
              </Button>
           </div>
        </div>
      </section>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Expanded" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
