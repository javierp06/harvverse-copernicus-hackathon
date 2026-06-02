"use client";

import { useTranslations } from "next-intl";
import { Leaf, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@harvverse-copernicus-hackathon/ui/components/chart";

import { CopernicusSectionHeader } from "./copernicus-ui";
import { metricValue, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

const chartConfig = {
  ndvi: { label: "NDVI", color: "#67E8F9" },
} satisfies ChartConfig;

export function CopernicusNdviCard({ snapshot }: { snapshot: CopernicusSnapshotView }) {
  const t = useTranslations("copernicus");
  const current = snapshot.sentinel2.currentNdvi;
  const average = snapshot.sentinel2.twoYearAverageNdvi;
  const series = (snapshot.sentinel2.historicalSeries ?? []).slice(-24);
  const chartData = series.map((point) => ({
    month: point.month.slice(0, 7),
    ndvi: point.ndvi,
  }));

  let trendLabel = t("ndvi_trend_stable");
  let TrendIcon = Minus;
  if (average != null) {
    if (current != null && current > average + 0.03) {
      trendLabel = t("ndvi_trend_up");
      TrendIcon = TrendingUp;
    } else if (current != null && current < average - 0.03) {
      trendLabel = t("ndvi_trend_down");
      TrendIcon = TrendingDown;
    }
  }

  return (
    <GlassCard className="border-white/10 p-5">
      <CopernicusSectionHeader title={t("ndvi_title")} description={t("ndvi_help")} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{t("ndvi_current")}</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-black text-primary">
            <Leaf className="size-5" />
            {metricValue(current, 2)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{t("ndvi_two_year")}</p>
          <p className="mt-1 text-2xl font-black text-white">
            {average != null ? average.toFixed(2) : "—"}
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-white/50">
            <TrendIcon className="size-3.5" />
            {trendLabel}
          </p>
        </div>
      </div>
      {chartData.length > 1 ? (
        <div className="mt-4 h-36 w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <XAxis dataKey="month" hide />
              <YAxis domain={[0, 1]} hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="ndvi"
                stroke="var(--color-ndvi)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      ) : (
        <p className="mt-4 text-xs italic text-white/40">{t("ndvi_series_pending")}</p>
      )}
    </GlassCard>
  );
}
