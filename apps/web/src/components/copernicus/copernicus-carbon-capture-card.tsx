"use client";

import { Sprout } from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";

import { shortHash, metricValue, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";
import { CopernicusMetric, CopernicusSectionHeader } from "./copernicus-ui";

export function CopernicusCarbonCaptureCard({
  snapshot,
}: {
  snapshot: CopernicusSnapshotView;
}) {
  const carbon = snapshot.carbonCapture;
  if (!carbon) return null;
  const carbonRegistry = snapshot.chain.carbonRegistry;

  return (
    <GlassCard className="border-emerald-400/15 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sprout className="size-5 text-emerald-300" />
          <CopernicusSectionHeader
            title="Carbon Capture"
            description="Screening estimate from Copernicus canopy and radar structure proxies. This is not a certified carbon credit."
          />
        </div>
        <Badge className="rounded-full border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-yellow-200">
          estimate only
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CopernicusMetric
          label="tCO2e / ha / yr"
          value={metricValue(carbon.tCo2ePerHaYear, 2)}
          description="Estimated annual capture per hectare from shade canopy structure."
          size="sm"
        />
        <CopernicusMetric
          label="lot total / yr"
          value={`${metricValue(carbon.totalTCo2ePerYear, 2)} tCO2e`}
          description="Estimated annual capture for the full lot area."
          size="sm"
        />
        <CopernicusMetric
          label="canopy cover"
          value={`${metricValue(carbon.canopyCoverPct, 0)}%`}
          description="Estimated from Sentinel-2 NDVI/NDRE/NDWI and Sentinel-1 structure."
          size="sm"
        />
        <CopernicusMetric
          label="shade density"
          value={`${metricValue(carbon.shadeTreeDensityPerHa, 0)} trees/ha`}
          description="Proxy estimate until field inventory confirms shade tree count."
          size="sm"
        />
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
          MRV status
        </p>
        <p className="mt-2 text-sm leading-6 text-white/60">
          {carbon.interpretation ??
            "Estimated annual carbon capture from coffee agroforestry shade structure."}
        </p>
        <p className="mt-2 text-xs text-yellow-200/80">
          Requires field inventory and validated allometric equations before any credit can be issued.
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
            On-chain carbon evidence
          </p>
          <Badge className="rounded-full border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-200">
            {carbonRegistry?.ok ? "recorded" : "pending"}
          </Badge>
        </div>
        <p className="mt-2 font-mono text-xs text-primary">
          {carbonRegistry?.carbonHash ? shortHash(carbonRegistry.carbonHash) : "--"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/40">
          Carbon estimate hash stored in the local CarbonEstimateRegistry contract.
        </p>
      </div>
    </GlassCard>
  );
}
