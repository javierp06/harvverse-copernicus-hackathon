"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";

import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { parseCopernicusSnapshot } from "@/lib/copernicus-snapshot";

import { CopernicusNdviCard } from "./copernicus-ndvi-card";
import { CopernicusYieldPredictCard } from "./copernicus-yield-predict-card";
import { CopernicusRiskScoreCard } from "./copernicus-risk-score-card";
import { CopernicusEudrCard } from "./copernicus-eudr-card";
import { CopernicusProofCard } from "./copernicus-proof-card";
import { CopernicusSignalsGrid } from "./copernicus-signals-grid";

export function CopernicusPartnerPanel({
  snapshotRaw,
  lotCode,
  lotId: _lotId,
  canWriteLocalProof,
  localProofWritten,
  onMarkLocalProof,
  isMarkingProof,
  markProofError,
}: {
  snapshotRaw: unknown;
  lotCode?: string | null;
  lotId: number;
  canWriteLocalProof?: boolean;
  localProofWritten?: boolean;
  onMarkLocalProof?: () => void;
  isMarkingProof?: boolean;
  markProofError?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("lot");
  const tc = useTranslations("copernicus");
  const snapshot = parseCopernicusSnapshot(snapshotRaw);

  if (!snapshot) {
    return (
      <GlassCard className="border-yellow-400/20 p-6">
        <p className="text-sm font-bold text-yellow-200">{t("satellite_pending_title")}</p>
        <p className="mt-2 text-xs leading-relaxed text-yellow-100/65">{t("satellite_pending_desc")}</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Copernicus</p>
          <h2 className="mt-1 font-trenda text-xl font-bold text-white">{tc("partner_panel_title")}</h2>
        </div>
        <Badge className="rounded-full border-primary/30 bg-primary/10 text-primary uppercase">
          {snapshot.sourceMode}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CopernicusNdviCard snapshot={snapshot} />
        <CopernicusYieldPredictCard snapshot={snapshot} />
        <CopernicusEudrCard snapshot={snapshot} />
      </div>
      <CopernicusSignalsGrid snapshot={snapshot} />
      <CopernicusRiskScoreCard snapshot={snapshot} />
      <CopernicusProofCard snapshot={snapshot} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {canWriteLocalProof && !localProofWritten && onMarkLocalProof ? (
          <Button
            size="sm"
            className="bg-primary font-bold text-[#001020] hover:bg-primary/90"
            disabled={isMarkingProof}
            onClick={onMarkLocalProof}
          >
            {isMarkingProof ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {t("generate_local_proof")}
          </Button>
        ) : null}
        {lotCode ? (
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-white hover:bg-white/10"
            onClick={() => router.push(`/lot/${encodeURIComponent(lotCode)}` as Route)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("qr_proof")}
          </Button>
        ) : null}
      </div>
      {markProofError ? <p className="text-xs text-red-300">{markProofError}</p> : null}
    </div>
  );
}
