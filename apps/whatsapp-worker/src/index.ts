import path from "node:path";

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

type AlertKind = "lot_approved" | "eudr_blocked" | "water_stress" | "fungal_risk";

type SnapshotRow = {
  snapshot_id: number;
  snapshot_created_at: Date;
  risk_score: number;
  risk_tier: string;
  eudr_status: "verified" | "non_compliant" | "unknown";
  eligible_for_investment: boolean;
  score_hash: string;
  yield_predict: unknown;
  era5: unknown;
  chain: unknown;
  lot_id: number;
  lot_code: string | null;
  farm_name: string;
  region: string;
  country: string;
  farmer_name: string;
  farmer_phone: string | null;
};

type AlertCandidate = {
  kind: AlertKind;
  to: string;
  lotCode: string;
  farmerName: string;
  farmName: string;
  riskScore: number;
  yieldRange: string;
  publicPath: string;
  reason: string;
};

const { Pool } = pg;
const env = workerEnvSchema.parse(process.env);
const pool = new Pool({ connectionString: env.DATABASE_URL });

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatYieldRange(value: unknown): string {
  const yieldPredict = asRecord(value);
  const low = numberValue(yieldPredict.lowBandQuintales);
  const high = numberValue(yieldPredict.highBandQuintales);
  if (low == null || high == null) return "pendiente";
  return `${low.toFixed(1)}-${high.toFixed(1)} qq`;
}

function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const compact = value.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.length >= 8) return `+${compact}`;
  return null;
}

function alertReason(kind: AlertKind) {
  switch (kind) {
    case "lot_approved":
      return "Lote aprobado por score Copernicus y gate EUDR.";
    case "eudr_blocked":
      return "Lote bloqueado por gate EUDR.";
    case "water_stress":
      return "ERA5 indica estres hidrico alto.";
    case "fungal_risk":
      return "ERA5 indica lluvia anual muy alta y riesgo de hongos.";
  }
}

function buildCandidates(row: SnapshotRow): AlertCandidate[] {
  const to = normalizePhone(row.farmer_phone);
  if (!to) return [];

  const lotCode = row.lot_code ?? String(row.lot_id);
  const base = {
    to,
    lotCode,
    farmerName: row.farmer_name,
    farmName: row.farm_name,
    riskScore: row.risk_score,
    yieldRange: formatYieldRange(row.yield_predict),
    publicPath: `${env.WHATSAPP_PUBLIC_APP_URL.replace(/\/$/, "")}/lot/${encodeURIComponent(lotCode)}`,
  };

  const candidates: AlertCandidate[] = [];
  if (row.eudr_status === "non_compliant") {
    candidates.push({ ...base, kind: "eudr_blocked", reason: alertReason("eudr_blocked") });
    return candidates;
  }

  if (row.eligible_for_investment && row.risk_score >= 60) {
    candidates.push({ ...base, kind: "lot_approved", reason: alertReason("lot_approved") });
  }

  const era5 = asRecord(row.era5);
  if (era5.waterStress === "high") {
    candidates.push({ ...base, kind: "water_stress", reason: alertReason("water_stress") });
  }

  const annualRainfallMm = numberValue(era5.annualRainfallMm);
  if (annualRainfallMm != null && annualRainfallMm > 3000) {
    candidates.push({ ...base, kind: "fungal_risk", reason: alertReason("fungal_risk") });
  }

  return candidates;
}

async function loadLatestSnapshots() {
  const result = await pool.query<SnapshotRow>(
    `
      select distinct on (cs.lot_id)
        cs.id as snapshot_id,
        cs.created_at as snapshot_created_at,
        cs.risk_score,
        cs.risk_tier,
        cs.eudr_status,
        cs.eligible_for_investment,
        cs.score_hash,
        cs.yield_predict,
        cs.era5,
        cs.chain,
        l.id as lot_id,
        l.code as lot_code,
        l.farm_name,
        l.region,
        l.country,
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
          parameters: [
            { type: "text", text: candidate.farmerName },
            { type: "text", text: candidate.farmName },
            { type: "text", text: candidate.lotCode },
            { type: "text", text: String(candidate.riskScore) },
            { type: "text", text: candidate.yieldRange },
            { type: "text", text: candidate.publicPath },
            { type: "text", text: candidate.reason },
          ],
        },
      ],
    },
  };
}

async function sendWhatsApp(candidate: AlertCandidate) {
  if (env.WHATSAPP_DRY_RUN) {
    console.log(JSON.stringify({ dryRun: true, kind: candidate.kind, payload: templatePayload(candidate) }, null, 2));
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

  console.log(JSON.stringify({ sent: true, kind: candidate.kind, to: candidate.to, lotCode: candidate.lotCode }));
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
