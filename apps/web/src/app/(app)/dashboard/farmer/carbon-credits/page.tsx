"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, Check, Coins, Copy, ExternalLink, Leaf, Sprout } from "lucide-react";

import { Badge } from "@harvverse-copernicus-hackathon/ui/components/badge";
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";
import { GlassCard } from "@harvverse-copernicus-hackathon/ui/components/glass-card";
import { Skeleton } from "@harvverse-copernicus-hackathon/ui/components/skeleton";

import { CARBON_LEDGER_UPDATED_EVENT, formatCarbon, issueCarbonLedgerCredit, notifyCarbonLedgerUpdated } from "@/lib/carbon-ledger";
import { buildCarbonCreditPortfolio } from "@/lib/carbon-portfolio";
import { transactionExplorerUrl } from "@/lib/chainProof";
import { shortHash } from "@/lib/copernicus-snapshot";
import { useCurrentUser } from "@/hooks/use-auth";
import { trpc } from "@/utils/trpc";

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CopyValueLine({
  label,
  value,
  externalUrl,
}: {
  label: string;
  value: string | null;
  externalUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const displayValue = shortHash(value);

  async function copyValue() {
    if (!value || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate font-mono text-xs font-bold text-white/70">
          {displayValue}
        </p>
        {value ? (
          <button
            type="button"
            aria-label={`Copy ${label}`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/35 transition-colors hover:border-primary/30 hover:text-primary"
            onClick={() => void copyValue()}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        ) : null}
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${label}`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/35 transition-colors hover:border-primary/30 hover:text-primary"
          >
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function FarmerCarbonCreditsPage() {
  const router = useRouter();
  const t = useTranslations("carbon_credits");
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [ledgerRefresh, setLedgerRefresh] = useState(0);

  const {
    data: farms,
    isLoading: farmsLoading,
    isError,
  } = useQuery(
    trpc.farms.list.queryOptions(
      { farmerId: user?.id },
      { enabled: !!user },
    ),
  );

  useEffect(() => {
    if (userLoading) return;
    if (user && user.role !== "farmer") router.replace("/dashboard/player" as Route);
  }, [router, user, userLoading]);

  useEffect(() => {
    if (!farmsLoading) setLedgerRefresh(Date.now());
  }, [farmsLoading, farms]);

  useEffect(() => {
    const refreshLedger = () => setLedgerRefresh(Date.now());
    window.addEventListener(CARBON_LEDGER_UPDATED_EVENT, refreshLedger);
    window.addEventListener("storage", refreshLedger);
    return () => {
      window.removeEventListener(CARBON_LEDGER_UPDATED_EVENT, refreshLedger);
      window.removeEventListener("storage", refreshLedger);
    };
  }, []);

  const portfolio = useMemo(
    () =>
      buildCarbonCreditPortfolio(farms ?? [], (storageKey) =>
        typeof window === "undefined" ? null : window.localStorage.getItem(storageKey),
      ),
    [farms, ledgerRefresh],
  );

  function issueCredit(storageKey: string, scoreHash: string) {
    const row = portfolio.rows.find((item) => item.storageKey === storageKey);
    if (!row || row.ledger.availableTCo2e <= 0) return;
    const nextLedger = issueCarbonLedgerCredit(row.ledger, scoreHash);
    window.localStorage.setItem(storageKey, JSON.stringify(nextLedger));
    notifyCarbonLedgerUpdated();
    setLedgerRefresh(Date.now());
  }

  if (userLoading || farmsLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 md:px-0">
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="mt-6 h-72 rounded-2xl" />
      </div>
    );
  }

  if (!userLoading && user && user.role !== "farmer") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 text-[#EEEEEE] md:px-0">
      <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-200/70">
            Harvverse Carbon
          </p>
          <h1 className="mt-2 font-trenda text-3xl font-bold text-white">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{t("subtitle")}</p>
        </div>
        <Button
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => router.push("/dashboard/farmer" as Route)}
        >
          {t("back_dashboard")}
        </Button>
      </header>

      {isError ? (
        <GlassCard className="border-red-500/20 p-8">
          <p className="flex items-center gap-2 text-red-300">
            <AlertCircle className="h-5 w-5" />
            {t("failed")}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard className="border-fuchsia-300/20 bg-purple-950/25 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-fuchsia-300/10">
                  <Coins className="h-5 w-5 text-fuchsia-200" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                    {t("hc_balance")}
                  </p>
                  <p className="mt-1 text-3xl font-black text-fuchsia-100">
                    {formatCarbon(portfolio.hcBalance)} HC
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="border-emerald-300/20 bg-[#001020]/40 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-300/10">
                  <Sprout className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                    {t("available")}
                  </p>
                  <p className="mt-1 text-3xl font-black text-emerald-100">
                    {formatCarbon(portfolio.availableTCo2e)} HC
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="border-primary/20 bg-[#001020]/40 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10">
                  <Leaf className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                    {t("tracked_lots")}
                  </p>
                  <p className="mt-1 text-3xl font-black text-primary">
                    {portfolio.rows.length}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

          {portfolio.rows.length === 0 ? (
            <GlassCard className="border-primary/20 bg-[#001020]/40 p-8 text-center">
              <p className="font-bold text-white">{t("empty_title")}</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/55">
                {t("empty_body")}
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {portfolio.rows.map((row) => (
                <GlassCard
                  key={row.storageKey}
                  className="border-primary/20 bg-[#001020]/40 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-trenda text-lg font-bold text-white">
                          {row.lotName}
                        </h2>
                        <Badge className="rounded-full border-fuchsia-300/25 bg-fuchsia-300/10 text-[10px] font-black uppercase text-fuchsia-100">
                          {row.ledger.tokenCount} {t("tokens")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-white/50">
                        {row.farmName} · {row.lotCode}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[620px]">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                          {t("available")}
                        </p>
                        <p className="mt-1 font-black text-emerald-100">
                          {formatCarbon(row.ledger.availableTCo2e)} HC
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                          {t("issued")}
                        </p>
                        <p className="mt-1 font-black text-fuchsia-100">
                          {formatCarbon(row.ledger.hcBalance)} HC
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                          {t("last_token")}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs font-bold text-white/75">
                          {row.ledger.lastTokenId ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                          {t("last_issued")}
                        </p>
                        <p className="mt-1 text-xs font-bold text-white/75">
                          {formatDate(row.ledger.lastIssuedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <CopyValueLine label={t("carbon_hash")} value={row.carbonHash} />
                    <CopyValueLine
                      label={t("transaction")}
                      value={row.transactionHash}
                      externalUrl={transactionExplorerUrl(
                        row.snapshot.chain.chainId,
                        row.transactionHash,
                      )}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                      <Button
                        size="sm"
                        className="bg-emerald-300 font-bold text-emerald-950 hover:bg-emerald-200"
                        disabled={row.ledger.availableTCo2e <= 0}
                        onClick={() => issueCredit(row.storageKey, row.snapshot.scoreHash)}
                      >
                        {t("issue_hc")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => router.push(`/dashboard/farmer/lots/${row.lotId}` as Route)}
                      >
                        {t("manage_lot")}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          <p className="text-center text-xs leading-6 text-white/40">
            <ExternalLink className="mr-1 inline h-3.5 w-3.5" />
            {t("note")}
          </p>
        </div>
      )}
    </div>
  );
}
