"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, Clock, ExternalLink, ShieldCheck } from "lucide-react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";

import { EudrBadge, RiskScoreBadge } from "./copernicus-badges";
import {
  farmerEligibilityState,
  lotSummaryFromRow,
  parseCopernicusSnapshot,
  type CopernicusSnapshotView,
} from "@/lib/copernicus-snapshot";

export function CopernicusFarmerStatusCard({
  lot,
  snapshotRaw,
}: {
  lot: {
    id: number;
    code?: string | null;
    riskScore?: number | null;
    riskTier?: string | null;
    eudrStatus?: string | null;
    copernicusSnapshotId?: number | null;
  };
  snapshotRaw: unknown;
}) {
  const router = useRouter();
  const t = useTranslations("copernicus");
  const snapshot: CopernicusSnapshotView | null = parseCopernicusSnapshot(snapshotRaw);
  const summary = snapshot
    ? {
        riskScore: snapshot.riskScore,
        riskTier: snapshot.riskTier,
        eudrStatus: snapshot.eudrStatus,
        eligibleForInvestment: snapshot.eligibleForInvestment,
        hasSnapshot: true,
      }
    : lotSummaryFromRow(lot);

  const state = farmerEligibilityState(snapshot);

  const styles = {
    eligible: {
      border: "border-emerald-400/30",
      bg: "bg-emerald-400/10",
      icon: CheckCircle2,
      title: t("farmer_eligible_title"),
      desc: t("farmer_eligible_desc"),
      tone: "text-emerald-300",
    },
    blocked: {
      border: "border-red-400/30",
      bg: "bg-red-400/10",
      icon: Ban,
      title: t("farmer_blocked_title"),
      desc: t("farmer_blocked_desc"),
      tone: "text-red-300",
    },
    pending: {
      border: "border-yellow-400/30",
      bg: "bg-yellow-400/10",
      icon: Clock,
      title: t("farmer_pending_title"),
      desc: t("farmer_pending_desc"),
      tone: "text-yellow-200",
    },
  }[state];

  const Icon = styles.icon;

  return (
    <GlassCard className={`p-5 ${styles.border} ${styles.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`size-6 shrink-0 ${styles.tone}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Copernicus</p>
          <h2 className={`mt-1 font-trenda text-lg font-bold ${styles.tone}`}>{styles.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{styles.desc}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <RiskScoreBadge score={summary.riskScore} tier={summary.riskTier} />
        <EudrBadge status={summary.eudrStatus} />
        {summary.eligibleForInvestment ? (
          <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/15 text-[9px] text-emerald-300">
            <ShieldCheck className="mr-1 size-3" />
            {t("co_invest_available")}
          </Badge>
        ) : null}
      </div>
      {lot.code ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-4 w-full border-white/15 text-white hover:bg-white/10"
          onClick={() => router.push(`/lot/${encodeURIComponent(lot.code ?? "")}` as Route)}
        >
          <ExternalLink className="mr-2 size-4" />
          {t("view_public_proof")}
        </Button>
      ) : null}
    </GlassCard>
  );
}
