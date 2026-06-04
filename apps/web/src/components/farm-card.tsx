"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, Mountain, CheckCircle2, ChevronLeft, ChevronRight, Sprout } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { CopernicusBadgeRow } from "@/components/copernicus/copernicus-badges";
import { aggregateFarmCopernicusSummary } from "@/lib/copernicus-snapshot";

interface Lot {
  id: number;
  status: string;
  variety?: string | null;
  riskScore?: number | null;
  riskTier?: string | null;
  eudrStatus?: string | null;
  copernicusSnapshotId?: number | null;
  plans: unknown[];
}

interface FarmImage {
  data?: string | null;
  mimeType: string;
  url?: string | null;
  isPrimary: boolean | null;
}

interface Farm {
  id: number;
  name: string;
  region: string;
  department?: string | null;
  country: string;
  altitudeMasl?: number | null;
  areaManzanas?: string | null;
  varieties?: string[] | null;
  certifications?: string[] | null;
  photoUrls?: string[] | null;
  verified?: boolean | null;
  primaryImageUrl?: string | null;
  primaryImageData?: string | null;
  primaryImageMimeType?: string | null;
  images?: FarmImage[];
  lots: Lot[];
}

interface FarmCardProps {
  farm: Farm;
}

export function FarmCard({ farm }: FarmCardProps) {
  const router = useRouter();
  const t = useTranslations("farm");
  const tn = useTranslations("nav");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const allImages = Array.from(new Set([
    ...(farm.images?.map((img) =>
      img.url ?? (img.data ? `data:${img.mimeType};base64,${img.data}` : null),
    ) ?? []),
    farm.primaryImageUrl,
    farm.primaryImageData && farm.primaryImageMimeType
      ? `data:${farm.primaryImageMimeType};base64,${farm.primaryImageData}`
      : null,
    ...(farm.photoUrls ?? [])
  ].filter((src): src is string => Boolean(src))));

  const displayImages = allImages.length > 0 ? allImages : [];
  const activeImage = displayImages[currentImageIndex] ?? displayImages[0] ?? null;

  const varieties = Array.from(
    new Set([
      ...(farm.varieties ?? []),
      ...(farm.lots ?? []).map((l) => l.variety).filter(Boolean),
    ]),
  ) as string[];

  const copernicusSummary = aggregateFarmCopernicusSummary(farm.lots ?? []);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <GlassCard className="group flex flex-col overflow-hidden border-primary/20 transition-all hover:border-primary/50 hover:shadow-primary/5">
        <div className="relative h-40 sm:h-44 md:h-52 overflow-hidden bg-gradient-to-br from-primary/20 to-[#001020]">
          <AnimatePresence mode="wait">
            {activeImage ? (
              <motion.img
                key={activeImage}
                src={activeImage}
                alt={farm.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/10">
                <Sprout className="size-8 md:size-12" />
              </div>
            )}
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-[#001020] via-[#001020]/20 to-transparent pointer-events-none" />
          
          {displayImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100 hover:bg-black/60"
              >
                <ChevronLeft className="size-3 md:size-4" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100 hover:bg-black/60"
              >
                <ChevronRight className="size-3 md:size-4" />
              </button>
              <div className="absolute bottom-1.5 md:bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {displayImages.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 md:h-1 w-2 md:w-3 rounded-full transition-all ${
                      i === currentImageIndex ? "bg-primary w-4 md:w-5" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          <div className="absolute top-2 md:top-3 right-2 md:right-3 flex max-w-[85%] flex-col items-end gap-1 md:gap-2 pointer-events-none">
            {farm.verified && (
              <Badge className="gap-0.5 md:gap-1 rounded-full border border-primary/30 bg-primary/20 text-[8px] md:text-xs font-bold text-primary backdrop-blur-md px-1.5 md:px-2.5 py-0 md:py-0.5">
                <CheckCircle2 className="size-2.5 md:size-3.5" />
                {t("verified")}
              </Badge>
            )}
            {copernicusSummary.hasSnapshot || copernicusSummary.riskScore != null ? (
              <div className="pointer-events-auto">
                <CopernicusBadgeRow summary={copernicusSummary} compact />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3 md:p-6 card-highlight">
          <h3 className="mb-1 md:mb-2 truncate font-trenda text-sm md:text-xl font-bold text-white group-hover:text-primary transition-colors">
            {farm.name}
          </h3>

          <div className="mb-3 md:mb-5 flex flex-col gap-1 md:gap-1.5 text-[10px] md:text-sm text-white/70">
            <span className="flex items-center gap-1.5 md:gap-2">
              <MapPin className="size-3 md:size-3.5 text-primary/60 shrink-0" />
              <span className="truncate">
                {farm.region}, {farm.department ? `${farm.department}, ` : ""}{farm.country}
              </span>
            </span>
            <div className="flex items-center gap-3 md:gap-5">
              {farm.altitudeMasl && (
                <span className="flex items-center gap-1 md:gap-2">
                  <Mountain className="size-3 md:size-3.5 text-primary/60 shrink-0" />
                  {farm.altitudeMasl}m
                </span>
              )}
              {farm.areaManzanas && (
                <span className="flex items-center gap-1 md:gap-2 truncate">
                  {Number(farm.areaManzanas).toFixed(1)} {t("unit_mzn")}
                </span>
              )}
            </div>
          </div>

          {varieties.length > 0 && (
            <div className="mb-3 md:mb-5 flex flex-wrap gap-1 md:gap-2">
              {varieties.slice(0, 3).map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 md:px-2.5 py-0.5 md:py-1 text-[9px] md:text-xs text-primary"
                >
                  {v}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto pt-3 md:pt-5 border-t border-white/5">
            <div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 md:h-9 w-full border-[#67B9C1]/40 text-[10px] md:text-sm font-bold text-[#67B9C1] hover:bg-[#67B9C1]/10"
                onClick={(e) => { e.preventDefault(); router.push(`/dashboard/farmer/farms/${farm.id}`) }}
              >
                {tn("manage")}
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
