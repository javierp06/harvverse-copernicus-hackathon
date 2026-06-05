import { z } from "zod";

import {
  buildSentinelAgentScenario,
  sentinelAgentScenarios,
} from "@harvverse-copernicus-hackathon/api/lib/sentinel-agent";

import { jsonError, loadSentinelAgentContext } from "../../../../sentinel/agent/_lib";

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

const sendBodySchema = z
  .object({
    lotCode: z.string().trim().min(1).optional(),
    lotId: z.number().int().positive().optional(),
    scenario: z.enum(sentinelAgentScenarios),
    demoOverrides: demoOverridesSchema,
    farmerPhone: z.string().trim().min(6).optional(),
    dryRun: z.boolean().default(true),
    llm: z.enum(["auto", "true", "false"]).default("auto"),
  })
  .refine((value) => value.lotCode != null || value.lotId != null, {
    message: "Provide lotCode or lotId.",
    path: ["lotCode"],
  });

const GUPSHUP_TEMPLATE_PARAM_LABELS = [
  "Nombre farmer",
  "Nombre finca",
  "Código lote",
  "Risk score",
  "Yield range",
  "URL pública QR",
  "Mensaje completo",
] as const;

type ScenarioPayload = ReturnType<typeof buildSentinelAgentScenario> & { ok: true };

function optionalEnv(value: string | undefined) {
  return value && value.trim() ? value.trim() : null;
}

function templateEnvKey(templateKey: string) {
  return `GUPSHUP_TEMPLATE_${templateKey.toUpperCase().replace(/-/g, "_")}`;
}

function resolveGupshupTemplateId(templateKey: string) {
  const fromKey = optionalEnv(process.env[templateEnvKey(templateKey)]);
  if (fromKey) return fromKey;

  const defaultKey =
    optionalEnv(process.env.GUPSHUP_DEFAULT_TEMPLATE_KEY) ??
    "harvverse_sentinel_alert_v2";
  if (templateKey === defaultKey) {
    return optionalEnv(process.env.GUPSHUP_DEFAULT_TEMPLATE_ID);
  }

  return null;
}

function sanitizeParam(value: string) {
  return value
    .replace(/\r\n|\r|\n|\t/g, " ")
    .replace(/ {5,}/g, "    ")
    .trim();
}

function normalizePhoneE164(phone: string) {
  return phone.replace(/\s+/g, "").replace(/^00/, "+");
}

function buildGupshupTemplateParams(data: ScenarioPayload, messageBodyOverride?: string) {
  const ctx = data.context;
  const signals = ctx.signals as Record<string, unknown> | undefined;
  return [
    ctx.farmer?.name ?? "caficultor",
    ctx.lot.farmName ?? "tu finca",
    ctx.lot.code,
    ctx.snapshot?.riskScore != null ? String(ctx.snapshot.riskScore) : "—",
    signals?.yieldRange != null ? String(signals.yieldRange) : "—",
    ctx.publicUrl ?? "",
    messageBodyOverride ?? data.message.body,
  ].map(sanitizeParam);
}

function gupshupRequestPreview(destination: string, templateId: string, params: string[]) {
  const appId = optionalEnv(process.env.GUPSHUP_APP_ID) ?? "(set GUPSHUP_APP_ID)";
  const to = normalizePhoneE164(destination).replace(/^\+/, "");
  return {
    url: `https://partner.gupshup.io/partner/app/${appId}/template/msg`,
    method: "POST" as const,
    contentType: "application/x-www-form-urlencoded",
    form: {
      source: optionalEnv(process.env.GUPSHUP_SOURCE) ?? "(set GUPSHUP_SOURCE)",
      destination: to,
      "src.name": optionalEnv(process.env.GUPSHUP_APP_NAME) ?? "Harvverse",
      template: JSON.stringify({
        id: templateId || "(pending)",
        params,
      }),
    },
  };
}

function hasGupshupCredentials() {
  return Boolean(
    optionalEnv(process.env.GUPSHUP_APP_ID) &&
      (optionalEnv(process.env.GUPSHUP_PARTNER_TOKEN) ??
        optionalEnv(process.env.GUPSHUP_APP_TOKEN)) &&
      optionalEnv(process.env.GUPSHUP_SOURCE),
  );
}

async function dispatchGupshup(input: {
  scenarioPayload: ScenarioPayload;
  phone: string;
  dryRun: boolean;
}) {
  const templateKey = input.scenarioPayload.whatsapp.templateKey;
  const templateId = resolveGupshupTemplateId(templateKey);
  const params = buildGupshupTemplateParams(input.scenarioPayload);
  const destination = normalizePhoneE164(input.phone);
  const requestPreview = gupshupRequestPreview(destination, templateId ?? "", params);
  const dryRun = input.dryRun || !hasGupshupCredentials() || !templateId;

  if (dryRun) {
    return {
      ok: true,
      ai: {
        used: false,
        model: null,
        source: "deterministic",
        error: null,
      },
      gupshup: {
        attempted: false,
        delivered: false,
        dryRun: true,
        templateKey,
        templateId,
        variableLabels: input.scenarioPayload.whatsapp.variables,
        params,
        destination,
        messageId: null,
        requestPreview,
        error: templateId ? null : "Template ID pendiente.",
      },
      outbound: {
        messagePreview: input.scenarioPayload.message.body,
      },
    };
  }

  const token =
    optionalEnv(process.env.GUPSHUP_PARTNER_TOKEN) ??
    optionalEnv(process.env.GUPSHUP_APP_TOKEN);
  const body = new URLSearchParams(requestPreview.form);
  const response = await fetch(requestPreview.url, {
    method: "POST",
    headers: {
      Authorization: token ?? "",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const rawText = await response.text();
  let payload: { messageId?: string; status?: string; message?: string } = {};
  try {
    payload = JSON.parse(rawText) as typeof payload;
  } catch {
    return {
      ok: false,
      ai: { used: false, model: null, source: "deterministic", error: null },
      gupshup: {
        attempted: true,
        delivered: false,
        dryRun: false,
        templateKey,
        templateId,
        variableLabels: input.scenarioPayload.whatsapp.variables,
        params,
        destination,
        messageId: null,
        requestPreview,
        error: `HTTP ${response.status} — respuesta no-JSON: ${rawText.slice(0, 300)}`,
      },
      outbound: { messagePreview: input.scenarioPayload.message.body },
    };
  }

  return {
    ok: response.ok,
    ai: { used: false, model: null, source: "deterministic", error: null },
    gupshup: {
      attempted: true,
      delivered: response.ok,
      dryRun: false,
      templateKey,
      templateId,
      variableLabels: input.scenarioPayload.whatsapp.variables,
      params,
      destination,
      messageId: payload.messageId ?? null,
      requestPreview,
      error: response.ok ? null : payload.message ?? `HTTP ${response.status}`,
    },
    outbound: { messagePreview: input.scenarioPayload.message.body },
  };
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const body: unknown = await request.json().catch(() => null);
  const parsed = sendBodySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid Sentinel Agent send payload.", 400, {
      issues: parsed.error.flatten(),
      availableScenarios: sentinelAgentScenarios,
    });
  }

  const context = await loadSentinelAgentContext({
    lotCode: parsed.data.lotCode,
    lotId: parsed.data.lotId,
    requestUrl,
  });

  if (!context) {
    return jsonError("Lot not found.", 404);
  }

  const scenario = buildSentinelAgentScenario({
    scenario: parsed.data.scenario,
    context,
    demoOverrides: parsed.data.demoOverrides,
  });
  const phone =
    parsed.data.farmerPhone?.replace(/\s+/g, "") ??
    scenario.context.farmer.phone;

  if (!phone) {
    return jsonError(
      "A farmerPhone is required to send or preview the WhatsApp request.",
      400,
    );
  }

  const scenarioPayload = {
    ok: true,
    ...scenario,
    context: {
      ...scenario.context,
      farmer: {
        ...scenario.context.farmer,
        phone,
      },
    },
  } satisfies ScenarioPayload;
  try {
    const sentinelAgent = await dispatchGupshup({
      scenarioPayload,
      phone,
      dryRun: parsed.data.dryRun,
    });

    return Response.json({
      ok: true,
      scenario: scenarioPayload,
      sentinelAgent,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? `Sentinel Agent processing failed: ${error.message}`
        : "Sentinel Agent processing failed.",
      502,
    );
  }
}
