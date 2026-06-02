import { env } from "@harvverse-copernicus-hackathon/env/server";
import { z } from "zod";

import { requireSentinelAgentRequest } from "../_auth";

const eventTypeSchema = z.enum([
  "copernicus.snapshot.created",
  "risk_score.ready",
  "eudr.non_compliant",
  "local_proof.verified",
  "yield_predict.ready",
  "score.calculated",
  "eudr.blocked",
  "ndvi.drop_detected",
  "water_stress_detected",
  "partner.snapshot_ready",
]);

const sentinelEventSchema = z.object({
  event: eventTypeSchema,
  eventId: z.string().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
  lotId: z.number().int().positive().optional(),
  lotCode: z.string().min(1).optional(),
  publicUrl: z.string().url().optional(),
  locale: z.enum(["es", "en"]).default("es").optional(),
  recipient: z
    .object({
      type: z.enum(["farmer", "partner", "team"]).default("team"),
      phone: z.string().min(6).optional(),
      name: z.string().optional(),
      whatsappOptIn: z.boolean().optional(),
    })
    .optional(),
  lot: z
    .object({
      id: z.number().int().positive().optional(),
      code: z.string().min(1).optional(),
      farmName: z.string().optional(),
      region: z.string().optional(),
      country: z.string().optional(),
      altitudeMasl: z.number().int().nullable().optional(),
      areaManzanas: z.number().nullable().optional(),
    })
    .optional(),
  copernicus: z
    .object({
      sourceMode: z.enum(["fixture", "live"]).optional(),
      riskScore: z.number().min(0).max(100).optional(),
      riskTier: z.string().optional(),
      eudrStatus: z.enum(["verified", "non_compliant", "unknown"]).optional(),
      eligibleForInvestment: z.boolean().optional(),
      scoreHash: z.string().optional(),
    })
    .optional(),
  yieldPredict: z
    .object({
      projectedQuintales: z.number().optional(),
      lowBandQuintales: z.number().optional(),
      highBandQuintales: z.number().optional(),
      ndviModifier: z.number().optional(),
      densityModifier: z.number().optional(),
      maturityFactor: z.number().optional(),
      plantAgeYears: z.number().nullable().optional(),
      renewalFlag: z.boolean().optional(),
      projectedOroQuintales: z.number().optional(),
      projectedOroLbs: z.number().optional(),
      floorPriceUsdPerLb: z.number().optional(),
      marketPriceUsdPerLb: z.number().optional(),
      effectivePriceUsdPerLb: z.number().optional(),
      grossRevenueUsd: z.number().optional(),
      productionCostUsd: z.number().optional(),
      projectedProfitUsd: z.number().optional(),
      farmerProfitUsd: z.number().optional(),
      partnerProfitUsd: z.number().optional(),
      investmentTicketUsd: z.number().nullable().optional(),
      partnerReturnTotalUsd: z.number().nullable().optional(),
      farmerShareBps: z.number().optional(),
      partnerShareBps: z.number().optional(),
      parchmentToOroFactor: z.number().optional(),
    })
    .optional(),
  proof: z
    .object({
      chainId: z.number().int().optional(),
      chainLabel: z.string().optional(),
      metadataStatus: z.enum(["pending", "written"]).optional(),
      transactionHash: z.string().nullable().optional(),
    })
    .optional(),
  message: z
    .object({
      templateKey: z.string().min(1).optional(),
      title: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
  snapshot: z.unknown().optional(),
});

const eventDescriptions: Record<z.infer<typeof eventTypeSchema>, string> = {
  "copernicus.snapshot.created": "A Copernicus snapshot was created for a lot.",
  "risk_score.ready": "Risk score and eligibility are ready for WhatsApp.",
  "eudr.non_compliant": "EUDR gate blocked a lot due to post-2020 vegetation-loss evidence.",
  "local_proof.verified": "Local Hardhat proof was generated and verified.",
  "yield_predict.ready": "YieldPredict projection is ready.",
  "score.calculated": "Legacy alias: Copernicus score was calculated.",
  "eudr.blocked": "Legacy alias: EUDR gate blocked a lot.",
  "ndvi.drop_detected": "Sentinel-2 NDVI dropped below the configured threshold.",
  "water_stress_detected": "ERA5 rainfall or temperature indicates water stress.",
  "partner.snapshot_ready": "Legacy alias: partner-facing Copernicus proof packet is ready.",
};

function normalizeEvent(input: z.infer<typeof sentinelEventSchema>) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const lotCode = input.lotCode ?? input.lot?.code ?? null;

  return {
    event: input.event,
    eventId:
      input.eventId ??
      `sentinel-${input.event}-${lotCode ?? input.lotId ?? "lot"}-${Date.now()}`,
    occurredAt,
    locale: input.locale ?? "es",
    lotId: input.lotId ?? input.lot?.id ?? null,
    lotCode,
    publicUrl: input.publicUrl ?? null,
    recipient: input.recipient ?? {
      type: "team" as const,
      phone: null,
      name: "Harvverse Team",
      whatsappOptIn: true,
    },
    lot: input.lot ?? null,
    copernicus: input.copernicus ?? null,
    yieldPredict: input.yieldPredict ?? null,
    proof: input.proof ?? null,
    message: input.message ?? null,
    snapshot: input.snapshot ?? null,
  };
}

export async function GET(request: Request) {
  const authError = requireSentinelAgentRequest(request);
  if (authError) return authError;

  return Response.json({
    endpoint: "/api/sentinel/alerts",
    purpose:
      "Development webhook contract and optional relay for Sheyla/n8n WhatsApp Copernicus alerts.",
    forwarding: {
      enabled: Boolean(env.N8N_WEBHOOK_URL),
      env: "N8N_WEBHOOK_URL",
    },
    events: eventDescriptions,
    fixtures: [
      "fixtures/n8n/copernicus-snapshot-created.json",
      "fixtures/n8n/eudr-non-compliant.json",
      "fixtures/n8n/local-proof-verified.json",
    ],
  });
}

export async function POST(request: Request) {
  const authError = requireSentinelAgentRequest(request);
  if (authError) return authError;

  const body: unknown = await request.json().catch(() => null);
  const parsed = sentinelEventSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid Copernicus alert payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const event = normalizeEvent(parsed.data);
  const relay =
    env.N8N_WEBHOOK_URL == null
      ? {
          enabled: false,
          delivered: false,
          status: null,
          error: null,
        }
      : await fetch(env.N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(event),
        })
          .then(async (response) => ({
            enabled: true,
            delivered: response.ok,
            status: response.status,
            error: response.ok ? null : await response.text(),
          }))
          .catch((error: unknown) => ({
            enabled: true,
            delivered: false,
            status: null,
            error:
              error instanceof Error
                ? error.message
                : "n8n webhook delivery failed.",
          }));

  return Response.json({
    ok: relay.enabled ? relay.delivered : true,
    receivedAt: new Date().toISOString(),
    description: eventDescriptions[event.event],
    relay,
    event,
  });
}
