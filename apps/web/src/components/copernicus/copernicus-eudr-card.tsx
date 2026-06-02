"use client";

import { useTranslations } from "next-intl";
import { Ban, ShieldCheck, HelpCircle } from "lucide-react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";

import { CopernicusSectionHeader } from "./copernicus-ui";
import { eudrBadgeTone, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

export function CopernicusEudrCard({ snapshot }: { snapshot: CopernicusSnapshotView }) {
  const t = useTranslations("lot_proof");
  const tc = useTranslations("copernicus");

  const status = snapshot.eudrStatus;
  const Icon = status === "non_compliant" ? Ban : status === "verified" ? ShieldCheck : HelpCircle;
  const label =
    status === "verified"
      ? t("eudr_verified")
      : status === "non_compliant"
        ? t("eudr_non_compliant")
        : t("eudr_pending");

  return (
    <GlassCard className="border-white/10 p-5">
      <CopernicusSectionHeader title={tc("eudr_title")} description={tc("eudr_help")} />
      <div className={`mt-4 rounded-xl border p-4 ${eudrBadgeTone(status)}`}>
        <div className="flex items-center gap-2">
          <Icon className="size-5" />
          <p className="text-lg font-black">{label}</p>
        </div>
        <p className="mt-2 text-sm text-white/70">
          {snapshot.eligibleForInvestment ? t("eligible") : t("blocked_or_pending")}
        </p>
      </div>
      {snapshot.eudr?.reasons && snapshot.eudr.reasons.length > 0 ? (
        <ul className="mt-4 space-y-2 text-xs leading-relaxed text-white/50">
          {snapshot.eudr.reasons.slice(0, 4).map((reason) => (
            <li key={reason} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
      {status === "non_compliant" ? (
        <p className="mt-3 text-xs font-bold text-red-300/90">{tc("eudr_hard_block")}</p>
      ) : null}
    </GlassCard>
  );
}
