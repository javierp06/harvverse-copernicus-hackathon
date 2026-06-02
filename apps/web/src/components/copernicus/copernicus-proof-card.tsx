"use client";

import { useTranslations } from "next-intl";
import { Fingerprint, TriangleAlert } from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { chainLabel } from "@/lib/chainProof";
import { shortHash, type CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

import { CopernicusProofRow, CopernicusSectionHeader } from "./copernicus-ui";

export function CopernicusProofCard({ snapshot }: { snapshot: CopernicusSnapshotView }) {
  const t = useTranslations("lot_proof");

  function confidenceLabel(conf: string) {
    if (conf === "low") return t("low");
    if (conf === "medium") return t("medium");
    if (conf === "high") return t("high");
    return conf;
  }

  function metadataLabel(status: "pending" | "written") {
    return status === "written" ? t("local_proof_verified") : t("local_proof_pending");
  }

  async function copyHash() {
    if (!snapshot.scoreHash || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(snapshot.scoreHash);
    } catch {
      // Clipboard access can be blocked in non-secure or embedded browser contexts.
    }
  }

  return (
    <GlassCard className="border-white/10 p-5">
      <div className="flex items-center gap-2">
        <Fingerprint className="size-5 text-primary" />
        <CopernicusSectionHeader
          title={t("evidence_packet")}
          description={t("section_help.evidence_packet")}
        />
      </div>
      <div className="mt-4 space-y-2">
        <CopernicusProofRow
          label={t("score_hash")}
          value={shortHash(snapshot.scoreHash)}
          description={t("proof_help.score_hash")}
          mono
        />
        <CopernicusProofRow
          label={t("chain")}
          value={`${chainLabel(snapshot.chain.chainId)} · ${snapshot.chain.chainId}`}
          description={t("proof_help.chain")}
        />
        <CopernicusProofRow
          label={t("local_proof")}
          value={metadataLabel(snapshot.chain.metadataStatus)}
          description={t("proof_help.local_proof")}
        />
        <CopernicusProofRow
          label={t("transaction")}
          value={
            snapshot.chain.transactionHash
              ? shortHash(snapshot.chain.transactionHash)
              : t("pending")
          }
          description={t("proof_help.transaction")}
          mono={Boolean(snapshot.chain.transactionHash)}
        />
        <CopernicusProofRow
          label={t("confidence")}
          value={confidenceLabel(snapshot.dataQuality.confidence)}
          description={t("proof_help.confidence")}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-4 w-full border-white/10 text-white hover:bg-white/10"
        onClick={() => void copyHash()}
      >
        {t("copy_hash")}
      </Button>
      {snapshot.sources.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {snapshot.sources.map((source) => (
            <Badge
              key={`${source.key}-${source.dataset}`}
              className="rounded-full border-white/10 bg-white/[0.04] text-[10px] text-white/50"
            >
              {source.dataset}
            </Badge>
          ))}
        </div>
      ) : null}
      {snapshot.dataQuality.warnings.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          {snapshot.dataQuality.warnings.slice(0, 3).map((warning) => (
            <div key={warning} className="flex gap-2 text-[11px] text-yellow-200/70">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              <p>{warning}</p>
            </div>
          ))}
        </div>
      ) : null}
    </GlassCard>
  );
}
