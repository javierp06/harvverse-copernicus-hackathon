import { z } from "zod";

const sentinelEventSchema = z.object({
  event: z.enum([
    "score.calculated",
    "eudr.blocked",
    "ndvi.drop_detected",
    "water_stress_detected",
    "partner.snapshot_ready",
  ]),
  lotId: z.number().int().positive().optional(),
  lotCode: z.string().min(1).optional(),
  snapshot: z.unknown().optional(),
  recipient: z
    .object({
      type: z.enum(["farmer", "partner", "team"]).default("team"),
      phone: z.string().min(6).optional(),
      name: z.string().optional(),
    })
    .optional(),
});

const eventDescriptions = {
  "score.calculated": "Copernicus score was calculated and is ready to display.",
  "eudr.blocked": "EUDR gate blocked a lot because post-2020 deforestation was detected.",
  "ndvi.drop_detected": "Sentinel-2 NDVI dropped below the configured threshold.",
  "water_stress_detected": "ERA5 rainfall or temperature indicates water stress.",
  "partner.snapshot_ready": "A partner-facing Copernicus proof packet is ready.",
} as const;

export async function GET() {
  return Response.json({
    endpoint: "/api/sentinel/alerts",
    purpose: "Development webhook contract for n8n and WhatsApp Copernicus alerts.",
    events: eventDescriptions,
    example: {
      event: "score.calculated",
      lotId: 101,
      lotCode: "HV-HN-ZAF-L02",
      recipient: {
        type: "farmer",
        phone: "+50400000000",
        name: "Demo Farmer",
      },
      snapshot: {
        riskScore: 85,
        eudrStatus: "verified",
        eligibleForInvestment: true,
      },
    },
  });
}

export async function POST(request: Request) {
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

  const receivedAt = new Date().toISOString();

  return Response.json({
    ok: true,
    receivedAt,
    event: parsed.data.event,
    description: eventDescriptions[parsed.data.event],
    lotId: parsed.data.lotId ?? null,
    lotCode: parsed.data.lotCode ?? null,
    recipient: parsed.data.recipient ?? null,
    snapshot: parsed.data.snapshot ?? null,
  });
}
