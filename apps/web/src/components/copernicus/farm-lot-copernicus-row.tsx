"use client";

import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";

import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { lotSummaryFromRow } from "@/lib/copernicus-snapshot";
import { CopernicusBadgeRow } from "./copernicus-badges";

export function FarmLotCopernicusRow({
  lot,
}: {
  lot: {
    id: number;
    code?: string | null;
    variety?: string | null;
    riskScore?: number | null;
    riskTier?: string | null;
    eudrStatus?: string | null;
    copernicusSnapshotId?: number | null;
  };
}) {
  const t = useTranslations("copernicus");
  const summary = lotSummaryFromRow(lot);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-bold text-white">{lot.code ?? `Lot #${lot.id}`}</p>
        {lot.variety ? <p className="text-sm text-white/50">{lot.variety}</p> : null}
        <div className="mt-2">
          <CopernicusBadgeRow summary={summary} compact />
        </div>
      </div>
      {lot.code ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Link href={`/lot/${encodeURIComponent(lot.code)}` as Route}>
            <ExternalLink className="mr-2 size-4" />
            {t("view_proof")}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
