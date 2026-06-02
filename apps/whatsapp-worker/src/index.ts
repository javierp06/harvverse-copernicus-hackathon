import path from "node:path";

import {
  buildSentinelAgentContext,
  buildSentinelAgentScenario,
  type SentinelAgentContext,
  type SentinelAgentScenario,
  type SentinelAgentScenarioResponse,
} from "@harvverse-copernicus-hackathon/api/lib/sentinel-agent";
import { config } from "dotenv";
import pg from "pg";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });
config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WHATSAPP_DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().min(1).default("harvverse_sentinel_alert"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default("es"),
  WHATSAPP_LOOKBACK_HOURS: z.coerce.number().int().positive().default(24),
  WHATSAPP_PUBLIC_APP_URL: z.url().default("http://localhost:3001"),
});

type SnapshotRow = {
  snapshot_id: number;
  snapshot_created_at: Date;
  source_mode: "fixture" | "live";
  risk_score: number;
  risk_tier: string;
  eudr_status: "verified" | "non_compliant" | "unknown";
  eligible_for_investment: boolean;
  score_hash: string;
  sentinel2: unknown;
  sentinel1: unknown;
  era5: unknown;
  eudr: unknown;
  yield_predict: unknown;
  chain: unknown;
  lot_id: number;
  lot_code: string | null;
  farm_name: string;
  region: string;
  country: string;
  variety: string | null;
  altitude_masl: number | null;
  area_manzanas: string | number | null;
  farmer_name: string;
  farmer_phone: string | null;
};

type AlertCandidate = {
  to: string;
  scenario: SentinelAgentScenarioResponse;
};

const { Pool } = pg;
const env = workerEnvSchema.parse(process.env);
const pool = new Pool({ connectionString: env.DATABASE_URL });

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const compact = value.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.length >= 8) return `+${compact}`;
  return null;
}

function publicUrl(lotCode: string) {
  return `${env.WHATSAPP_PUBLIC_APP_URL.replace(/\/$/, "")}/lot/${encodeURIComponent(lotCode)}`;
}

function contextFromRow(row: SnapshotRow): SentinelAgentContext {
  const lotCode = row.lot_code ?? String(row.lot_id);

  return buildSentinelAgentContext({
    lot: {
      id: row.lot_id,
      code: lotCode,
      farmName: row.farm_name,
      region: row.region,
      country: row.country,
      variety: row.variety,
      altitudeMasl: row.altitude_masl,
      areaManzanas: numberValue(row.area_manzanas),
    },
    farmer: {
      name: row.farmer_name,
      phone: row.farmer_phone,
    },
    snapshot: {
      id: row.snapshot_id,
      createdAt: row.snapshot_created_at.toISOString(),
      sourceMode: row.source_mode,
      riskScore: row.risk_score,
      riskTier: row.risk_tier,
      eudrStatus: row.eudr_status,
      eligibleForInvestment: row.eligible_for_investment,
      scoreHash: row.score_hash,
      sentinel2: row.sentinel2,
      sentinel1: row.sentinel1,
      era5: row.era5,
      eudr: row.eudr,
      yieldPredict: row.yield_predict,
      chain: row.chain,
    },
    publicUrl: publicUrl(lotCode),
  });
}

function scenariosForRow(row: SnapshotRow): SentinelAgentScenario[] {
  if (row.eudr_status === "non_compliant") return ["eudr_blocked"];

  const scenarios: SentinelAgentScenario[] = [];
  if (row.eligible_for_investment && row.risk_score >= 60) {
    scenarios.push("lot_approved");
  }

  const era5 = asRecord(row.era5);
  if (era5.waterStress === "high") {
    scenarios.push("water_stress");
  }

  const annualRainfallMm = numberValue(era5.annualRainfallMm);
  if (annualRainfallMm != null && annualRainfallMm > 3000) {
    scenarios.push("fungal_risk");
  }

  return scenarios;
}

function buildCandidates(row: SnapshotRow): AlertCandidate[] {
  const to = normalizePhone(row.farmer_phone);
  if (!to) return [];

  const context = contextFromRow(row);
  return scenariosForRow(row).map((scenario) => ({
    to,
    scenario: buildSentinelAgentScenario({
      scenario,
      context,
      templateKey: env.WHATSAPP_TEMPLATE_NAME,
    }),
  }));
}

async function loadLatestSnapshots() {
  const result = await pool.query<SnapshotRow>(
    `
      select distinct on (cs.lot_id)
        cs.id as snapshot_id,
        cs.created_at as snapshot_created_at,
        cs.source_mode,
        cs.risk_score,
        cs.risk_tier,
        cs.eudr_status,
        cs.eligible_for_investment,
        cs.score_hash,
        cs.sentinel2,
        cs.sentinel1,
        cs.era5,
        cs.eudr,
        cs.yield_predict,
        cs.chain,
        l.id as lot_id,
        l.code as lot_code,
        l.farm_name,
        l.region,
        l.country,
        l.variety,
        l.altitude_masl,
        l.area_manzanas,
        u.display_name as farmer_name,
        u.phone as farmer_phone
      from copernicus_snapshots cs
      join lots l on l.id = cs.lot_id
      join farms f on f.id = l.farm_id
      join users u on u.id = f.farmer_id
      where cs.created_at >= now() - ($1::int * interval '1 hour')
      order by cs.lot_id, cs.created_at desc
    `,
    [env.WHATSAPP_LOOKBACK_HOURS],
  );

  return result.rows;
}

function templatePayload(candidate: AlertCandidate) {
  return {
    messaging_product: "whatsapp",
    to: candidate.to,
    type: "template",
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: candidate.scenario.whatsapp.variables.map((text: string) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  };
}

async function sendWhatsApp(candidate: AlertCandidate) {
  if (env.WHATSAPP_DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          scenario: candidate.scenario.scenario,
          signal: candidate.scenario.signal,
          demoData: candidate.scenario.demoData,
          payload: templatePayload(candidate),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp send requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templatePayload(candidate)),
    },
  );

  if (!response.ok) {
    throw new Error(`WhatsApp API failed ${response.status}: ${await response.text()}`);
  }

  console.log(
    JSON.stringify({
      sent: true,
      scenario: candidate.scenario.scenario,
      signal: candidate.scenario.signal,
      to: candidate.to,
      lotCode: candidate.scenario.context.lot.code,
    }),
  );
}

async function main() {
  const rows = await loadLatestSnapshots();
  const candidates = rows.flatMap(buildCandidates);

  console.log(
    JSON.stringify(
      {
        worker: "whatsapp-worker",
        dryRun: env.WHATSAPP_DRY_RUN,
        lookbackHours: env.WHATSAPP_LOOKBACK_HOURS,
        snapshotsRead: rows.length,
        alertsPrepared: candidates.length,
      },
      null,
      2,
    ),
  );

  for (const candidate of candidates) {
    await sendWhatsApp(candidate);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
