"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import Link from "next/link";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { FarmCard } from "@/components/farm-card";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";
import { ArrowRight } from "lucide-react";

export function LandingOpenFarmsPreview() {
  const t = useTranslations("landing");

  const { data: farms, isLoading } = useQuery(
    trpc.farms.listPublic.queryOptions(),
  );

  const farmsToShow = farms?.slice(0, 3) ?? [];

  return (
    <section className="bg-[#001020] py-16 sm:py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 sm:mb-16 flex flex-col gap-6 text-center md:flex-row md:items-end md:justify-between md:gap-8 md:text-left">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white leading-tight mb-3 sm:mb-4">
              {t("open_farms_headline")}
            </h2>
            <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto md:mx-0">
              {t("open_farms_subheadline")}
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-white/20 text-white font-bold h-12 px-6 rounded-full hover:bg-white hover:text-[#001020] transition-all hidden md:flex"
          >
            <Link href="/farms">
              {t("open_farms_cta")}
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
            <Skeleton className="h-72 sm:h-64 md:h-96 w-full rounded-2xl md:rounded-3xl bg-white/5" />
            <Skeleton className="h-72 sm:h-64 md:h-96 w-full rounded-2xl md:rounded-3xl bg-white/5 hidden sm:block" />
            <Skeleton className="h-72 sm:h-64 md:h-96 w-full rounded-2xl md:rounded-3xl bg-white/5 hidden md:block" />
          </div>
        ) : (
          <div className="mb-10 sm:mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
            {farmsToShow.map((farm) => (
              <FarmCard key={farm.id} farm={farm as any} />
            ))}
          </div>
        )}

        <div className="flex justify-center mt-4">
          <Button
            asChild
            className="w-full md:w-auto px-10 bg-primary text-[#001020] font-bold h-14 rounded-xl hover:bg-primary/90 transition-all"
          >
            <Link href="/farms" className="flex items-center gap-2">
              {t("open_farms_cta")}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
