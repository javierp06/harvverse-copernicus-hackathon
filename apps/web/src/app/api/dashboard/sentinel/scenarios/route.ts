import { z } from "zod";

import {
  buildSentinelAgentScenario,
  sentinelAgentScenarios,
} from "@harvverse-copernicus-hackathon/api/lib/sentinel-agent";

import { jsonError, loadSentinelAgentContext } from "../../../sentinel/agent/_lib";

const demoOverridesSchema = z
  .object({
    previousNdvi: z.number().min(0).max(1).optional(),
    currentNdvi: z.number().min(0).max(1).optional(),
    temperatureC: z.number().min(-10).max(50).optional(),
    humidityPct: z.number().min(0).max(100).optional(),
    variety: z.string().trim().min(1).optional(),
    phenologyStage: z.string().trim().min(1).optional(),
  })
  .optional();

const scenarioBodySchema = z
  .object({
    lotCode: z.string().trim().min(1).optional(),
    lotId: z.number().int().positive().optional(),
    scenario: z.enum(sentinelAgentScenarios),
    demoOverrides: demoOverridesSchema,
  })
  .refine((value) => value.lotCode != null || value.lotId != null, {
    message: "Provide lotCode or lotId.",
    path: ["lotCode"],
  });

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body: unknown = await request.json().catch(() => null);
  const parsed = scenarioBodySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid scenario payload.", 400, {
      issues: parsed.error.flatten(),
      availableScenarios: sentinelAgentScenarios,
    });
  }

  const context = await loadSentinelAgentContext({
    lotCode: parsed.data.lotCode,
    lotId: parsed.data.lotId,
    requestUrl: url,
  });

  if (!context) {
    return jsonError("Lot not found.", 404);
  }

  const scenario = buildSentinelAgentScenario({
    scenario: parsed.data.scenario,
    context,
    demoOverrides: parsed.data.demoOverrides,
  });

  return Response.json({ ok: true, ...scenario });
}
