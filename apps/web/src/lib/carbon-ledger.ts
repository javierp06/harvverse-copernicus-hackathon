import type { CopernicusSnapshotView } from "@/lib/copernicus-snapshot";

export const CARBON_LEDGER_UPDATED_EVENT = "harvverse-carbon-ledger-updated";

export function notifyCarbonLedgerUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CARBON_LEDGER_UPDATED_EVENT));
}

export type CarbonLedgerState = {
  availableTCo2e: number;
  hcBalance: number;
  tokenCount: number;
  lastTokenId: string | null;
  lastIssuedAt: string | null;
};

export function positiveNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function roundCarbon(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatCarbon(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function buildDefaultCarbonLedger(annualEstimate: number): CarbonLedgerState {
  return {
    availableTCo2e: roundCarbon(annualEstimate),
    hcBalance: 0,
    tokenCount: 0,
    lastTokenId: null,
    lastIssuedAt: null,
  };
}

export function parseCarbonLedger(
  raw: string | null,
  annualEstimate: number,
): CarbonLedgerState {
  if (!raw) return buildDefaultCarbonLedger(annualEstimate);

  try {
    const parsed = JSON.parse(raw) as Partial<CarbonLedgerState>;
    return {
      availableTCo2e: roundCarbon(positiveNumber(parsed.availableTCo2e)),
      hcBalance: roundCarbon(positiveNumber(parsed.hcBalance)),
      tokenCount:
        typeof parsed.tokenCount === "number" && Number.isFinite(parsed.tokenCount)
          ? Math.max(0, Math.floor(parsed.tokenCount))
          : 0,
      lastTokenId: typeof parsed.lastTokenId === "string" ? parsed.lastTokenId : null,
      lastIssuedAt: typeof parsed.lastIssuedAt === "string" ? parsed.lastIssuedAt : null,
    };
  } catch {
    return buildDefaultCarbonLedger(annualEstimate);
  }
}

export function carbonLedgerStorageKey(
  scoreHash: string,
  carbonHash: string | null | undefined,
): string {
  return `harvverse-carbon-ledger:${scoreHash}:${carbonHash ?? "estimate"}`;
}

export function carbonLedgerAnnualEstimate(snapshot: CopernicusSnapshotView): number {
  return roundCarbon(positiveNumber(snapshot.carbonCapture?.totalTCo2ePerYear));
}

export function buildCarbonTokenId(scoreHash: string, count: number): string {
  const hashSegment = scoreHash.replace(/^0x/i, "").slice(0, 6).toUpperCase() || "LOCAL";
  return `HC-${hashSegment}-${String(count).padStart(2, "0")}`;
}

export function issueCarbonLedgerCredit(
  current: CarbonLedgerState,
  scoreHash: string,
): CarbonLedgerState {
  const amount = roundCarbon(current.availableTCo2e);
  if (amount <= 0) return current;

  const nextCount = current.tokenCount + 1;
  return {
    availableTCo2e: 0,
    hcBalance: roundCarbon(current.hcBalance + amount),
    tokenCount: nextCount,
    lastTokenId: buildCarbonTokenId(scoreHash, nextCount),
    lastIssuedAt: new Date().toISOString(),
  };
}
