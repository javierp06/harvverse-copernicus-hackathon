"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";

import { CopernicusMetric, CopernicusSectionHeader } from "./copernicus-ui";
import { metricValue, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

export function CopernicusYieldPredictCard({ snapshot }: { snapshot: CopernicusSnapshotView }) {
  const t = useTranslations("copernicus");
  const tProof = useTranslations("lot_proof");
  const yp = snapshot.yieldPredict;

  return (
    <GlassCard className="border-white/10 p-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" />
        <CopernicusSectionHeader title={t("yield_title")} description={t("yield_help")} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CopernicusMetric
          label={tProof("projected")}
          value={`${metricValue(yp.projectedQuintales, 1)} ${tProof("unit_qq")}`}
          size="sm"
        />
        <CopernicusMetric
          label={tProof("low_band")}
          value={`${metricValue(yp.lowBandQuintales, 1)} ${tProof("unit_qq")}`}
          size="sm"
        />
        <CopernicusMetric
          label={tProof("high_band")}
          value={`${metricValue(yp.highBandQuintales, 1)} ${tProof("unit_qq")}`}
          size="sm"
        />
      </div>
      {yp.baseYieldQqPerManzana != null && yp.varietyKey && yp.altitudeBand ? (
        <p className="mt-4 text-sm leading-6 text-white/60 italic">
          &ldquo;
          {tProof("investment_argument_template", {
            area: metricValue(snapshot.dem.areaManzanas, 2),
            baseYield: yp.baseYieldQqPerManzana.toFixed(1),
            variety: tProof(`varieties.${yp.varietyKey}` as "varieties.default"),
            band: tProof(`altitude_bands.${yp.altitudeBand}` as "altitude_bands.mid"),
            ndvi: yp.ndviModifier?.toFixed(2) ?? "1.00",
            density: yp.densityModifier?.toFixed(2) ?? "1.00",
          })}
          &rdquo;
        </p>
      ) : yp.investmentArgument ? (
        <p className="mt-4 text-sm leading-6 text-white/60 italic">&ldquo;{yp.investmentArgument}&rdquo;</p>
      ) : null}
    </GlassCard>
  );
}
