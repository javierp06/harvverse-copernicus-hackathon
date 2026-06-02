"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck, Ban, HelpCircle, Satellite } from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import {
  eudrBadgeTone,
  scoreTone,
  type EudrStatus,
  type LotCopernicusSummary,
} from "@/lib/copernicus-snapshot";

export function RiskScoreBadge({
  score,
  tier,
  compact = false,
}: {
  score: number | null;
  tier?: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("copernicus");

  if (score == null) {
    return (
      <Badge className="rounded-full border-white/15 bg-white/5 text-[9px] text-white/50">
        {t("no_score")}
      </Badge>
    );
  }

  return (
    <Badge
      className={`rounded-full border font-black uppercase tracking-wider ${scoreTone(score)} ${compact ? "text-[8px] px-1.5 py-0" : "text-[9px] px-2 py-0.5"}`}
    >
      <Satellite className={compact ? "mr-0.5 size-2.5" : "mr-1 size-3"} />
      {t("risk_score_short", { score })}
      {tier && !compact ? ` · ${t(`risk_tier.${tier}` as "risk_tier.excellent")}` : null}
    </Badge>
  );
}

export function EudrBadge({
  status,
  compact = false,
}: {
  status: EudrStatus | null;
  compact?: boolean;
}) {
  const t = useTranslations("copernicus");

  if (!status) {
    return (
      <Badge className="rounded-full border-white/15 bg-white/5 text-[9px] text-white/50">
        {t("eudr_pending")}
      </Badge>
    );
  }

  const Icon = status === "non_compliant" ? Ban : status === "verified" ? ShieldCheck : HelpCircle;
  const label =
    status === "verified"
      ? t("eudr_verified")
      : status === "non_compliant"
        ? t("eudr_non_compliant")
        : t("eudr_pending");

  return (
    <Badge
      className={`rounded-full border font-bold uppercase ${eudrBadgeTone(status)} ${compact ? "text-[8px] px-1.5 py-0 gap-0.5" : "text-[9px] px-2 py-0.5 gap-1"}`}
    >
      <Icon className={compact ? "size-2.5" : "size-3"} />
      {label}
    </Badge>
  );
}

export function EligibilityBadge({ eligible }: { eligible: boolean }) {
  const t = useTranslations("copernicus");
  return (
    <Badge
      className={
        eligible
          ? "rounded-full border-emerald-500/30 bg-emerald-500/15 text-[9px] font-bold text-emerald-300"
          : "rounded-full border-white/15 bg-white/5 text-[9px] text-white/50"
      }
    >
      {eligible ? t("co_invest_available") : t("co_invest_unavailable")}
    </Badge>
  );
}

export function CopernicusBadgeRow({
  summary,
  compact = false,
}: {
  summary: LotCopernicusSummary;
  compact?: boolean;
}) {
  const t = useTranslations("copernicus");

  if (!summary.hasSnapshot && summary.riskScore == null) {
    return (
      <Badge className="rounded-full border-yellow-500/25 bg-yellow-500/10 text-[9px] text-yellow-200">
        {t("snapshot_pending")}
      </Badge>
    );
  }

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
      <RiskScoreBadge score={summary.riskScore} tier={summary.riskTier} compact={compact} />
      <EudrBadge status={summary.eudrStatus} compact={compact} />
      {summary.eligibleForInvestment ? (
        <EligibilityBadge eligible />
      ) : null}
    </div>
  );
}
