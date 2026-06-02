"use client";

import { useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";

import { CopernicusSectionHeader } from "./copernicus-ui";
import { scoreTone, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

export function CopernicusRiskScoreCard({
  snapshot,
  compact = false,
}: {
  snapshot: CopernicusSnapshotView;
  compact?: boolean;
}) {
  const t = useTranslations("lot_proof");
  const tc = useTranslations("copernicus");

  return (
    <GlassCard className={`border-primary/20 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CopernicusSectionHeader
            title={t("risk_score")}
            description={t("section_help.risk_score")}
          />
          <div className="mt-3 flex items-end gap-2">
            <span className={`font-black text-white ${compact ? "text-4xl" : "text-5xl"}`}>
              {snapshot.riskScore ?? "--"}
            </span>
            <span className="pb-1 text-lg font-bold text-white/30">/100</span>
          </div>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${scoreTone(snapshot.riskScore)}`}
        >
          {t(`risk_tier.${snapshot.riskTier}` as "risk_tier.excellent")}
        </div>
      </div>
      {!compact ? (
        <>
          <div className="mt-4 flex items-center gap-2">
            <BadgeCheck className="size-4 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              {tc("seven_variables")}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {snapshot.variables.map((variable) => (
              <div
                key={variable.key}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    {t(`variables.${variable.key}` as "variables.sentinel2_current_ndvi")}
                  </p>
                  <p className="text-sm font-black text-primary">{variable.score}</p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${variable.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </GlassCard>
  );
}
