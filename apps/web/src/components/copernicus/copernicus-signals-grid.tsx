"use client";

import { useTranslations } from "next-intl";
import { ChartNoAxesColumn, Leaf, Satellite, Sprout } from "lucide-react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";

import { CopernicusMetric, CopernicusSectionHeader } from "./copernicus-ui";
import { metricValue, numberValue, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

export function CopernicusSignalsGrid({ snapshot }: { snapshot: CopernicusSnapshotView | null }) {
  const t = useTranslations("lot_proof");

  return (
    <GlassCard className="border-white/10 p-6">
      <CopernicusSectionHeader
        title={t("satellite_signals")}
        description={t("section_help.satellite_signals")}
      />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <CopernicusMetric
          icon={Leaf}
          label={t("metrics.s2_ndvi")}
          value={snapshot ? metricValue(snapshot.sentinel2.currentNdvi, 2) : "--"}
          description={t("metric_help.s2_ndvi")}
        />
        <CopernicusMetric
          icon={Leaf}
          label={t("metrics.s2_ndre")}
          value={
            snapshot?.sentinel2.currentNdre == null
              ? "--"
              : numberValue(snapshot.sentinel2.currentNdre).toFixed(2)
          }
          description={t("metric_help.s2_ndre")}
        />
        <CopernicusMetric
          icon={Sprout}
          label={t("metrics.s2_ndwi")}
          value={
            snapshot?.sentinel2.currentNdwi == null
              ? "--"
              : numberValue(snapshot.sentinel2.currentNdwi).toFixed(2)
          }
          description={t("metric_help.s2_ndwi")}
        />
        <CopernicusMetric
          icon={Satellite}
          label={t("metrics.s1_sar")}
          value={snapshot?.sentinel1.moistureProxy ?? "--"}
          description={t("metric_help.s1_sar")}
        />
        <CopernicusMetric
          icon={Satellite}
          label={t("metrics.s1_vh_vv_rvi")}
          value={
            snapshot?.sentinel1.vhVvRatio == null || snapshot.sentinel1.radarVegetationIndex == null
              ? "--"
              : `${numberValue(snapshot.sentinel1.vhVvRatio).toFixed(2)} · ${numberValue(snapshot.sentinel1.radarVegetationIndex).toFixed(2)}`
          }
          description={t("metric_help.s1_vh_vv_rvi")}
        />
        <CopernicusMetric
          icon={Sprout}
          label={t("metrics.era5_rainfall")}
          value={snapshot ? `${metricValue(snapshot.era5.annualRainfallMm)} ${t("unit_mm")}` : "--"}
          description={t("metric_help.era5_rainfall")}
        />
        <CopernicusMetric
          icon={ChartNoAxesColumn}
          label={t("metrics.dem_altitude")}
          value={
            snapshot
              ? `${metricValue(snapshot.dem.altitudeMasl)} ${t("unit_masl")}`
              : "--"
          }
          description={t("metric_help.dem_altitude")}
        />
      </div>
    </GlassCard>
  );
}
