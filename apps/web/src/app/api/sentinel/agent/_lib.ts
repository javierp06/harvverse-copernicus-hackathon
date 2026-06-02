import { db } from "@harvverse-copernicus-hackathon/db";
import {
  copernicusSnapshots,
  lots,
} from "@harvverse-copernicus-hackathon/db/schema";
import {
  buildSentinelAgentContext,
  type SentinelAgentContext,
} from "@harvverse-copernicus-hackathon/api/lib/sentinel-agent";
import { desc, eq } from "drizzle-orm";

function numberValue(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publicBaseUrl(requestUrl: URL) {
  return (process.env.WHATSAPP_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "");
}

export async function loadSentinelAgentContext(input: {
  lotCode?: string;
  lotId?: number;
  requestUrl: URL;
}): Promise<SentinelAgentContext | null> {
  const lot =
    input.lotId != null
      ? await db.query.lots.findFirst({
          where: eq(lots.id, input.lotId),
          with: { farm: { with: { farmer: true } } },
        })
      : input.lotCode != null
        ? await db.query.lots.findFirst({
            where: eq(lots.code, input.lotCode),
            with: { farm: { with: { farmer: true } } },
          })
        : null;

  if (!lot) return null;

  const snapshot = await db.query.copernicusSnapshots.findFirst({
    where: eq(copernicusSnapshots.lotId, lot.id),
    orderBy: [desc(copernicusSnapshots.createdAt)],
  });
  const lotCode = lot.code ?? String(lot.id);
  const publicUrl = `${publicBaseUrl(input.requestUrl)}/lot/${encodeURIComponent(lotCode)}`;

  return buildSentinelAgentContext({
    lot: {
      id: lot.id,
      code: lotCode,
      farmName: lot.farmName,
      region: lot.region,
      country: lot.country,
      variety: lot.variety,
      altitudeMasl: lot.altitudeMasl,
      areaManzanas: numberValue(lot.areaManzanas),
    },
    farmer: {
      name: lot.farm.farmer.displayName,
      phone: null,
    },
    snapshot: {
      id: snapshot?.id ?? null,
      createdAt: snapshot?.createdAt?.toISOString() ?? null,
      sourceMode: snapshot?.sourceMode ?? null,
      riskScore: snapshot?.riskScore ?? null,
      riskTier: snapshot?.riskTier ?? null,
      eudrStatus: snapshot?.eudrStatus ?? null,
      eligibleForInvestment: snapshot?.eligibleForInvestment ?? false,
      scoreHash: snapshot?.scoreHash ?? null,
      sentinel2: snapshot?.sentinel2 ?? null,
      sentinel1: snapshot?.sentinel1 ?? null,
      era5: snapshot?.era5 ?? null,
      eudr: snapshot?.eudr ?? null,
      yieldPredict: snapshot?.yieldPredict ?? null,
      chain: snapshot?.chain ?? null,
    },
    publicUrl,
  });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return Response.json({ ok: false, error: message, details }, { status });
}
