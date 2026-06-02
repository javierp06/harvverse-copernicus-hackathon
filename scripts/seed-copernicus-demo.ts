/**
 * Sets demo polygon on HV-HN-ZAF-L02 and computes a Copernicus snapshot.
 *
 * Usage (from repo root):
 *   pnpm db:seed-copernicus-demo           # fixture (default, no Sentinel Hub)
 *   pnpm db:seed-copernicus-demo -- --live # live Sentinel-2/1 + ERA5
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { eq } from "drizzle-orm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(repoRoot, "apps/web/.env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const sourceMode = process.argv.includes("--live") ? "live" : "fixture";

const { DEMO_LOT_CODE, DEMO_LOT_POLYGON } = await import(
  "../packages/db/src/demo-lot-fixtures.ts"
);
const { db } = await import("../packages/db/src/index.ts");
const { lots, copernicusSnapshots, farms } = await import("../packages/db/src/schema/index.ts");
const { buildFixtureCopernicusSnapshot, buildLiveCopernicusSnapshot } = await import(
  "../packages/api/src/lib/copernicus.ts"
);
const { getSentinelHubCredentials, getSentinelHubToken } = await import(
  "../packages/api/src/lib/copernicus/sentinel-hub.ts"
);

type CopernicusLotSnapshot = Awaited<ReturnType<typeof buildFixtureCopernicusSnapshot>>;

async function persistCopernicusSnapshot(snapshot: CopernicusLotSnapshot) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(copernicusSnapshots)
      .values({
        lotId: snapshot.lotId,
        farmId: snapshot.farmId,
        sourceMode: snapshot.sourceMode,
        scoreVersion: snapshot.scoreVersion,
        riskScore: snapshot.riskScore,
        riskTier: snapshot.riskTier,
        eudrStatus: snapshot.eudrStatus,
        eligibleForInvestment: snapshot.eligibleForInvestment,
        variables: snapshot.variables,
        sources: snapshot.sources,
        dataQuality: snapshot.dataQuality,
        polygon: snapshot.polygon,
        sentinel2: snapshot.sentinel2,
        sentinel1: snapshot.sentinel1,
        dem: snapshot.dem,
        era5: snapshot.era5,
        eudr: snapshot.eudr,
        yieldPredict: snapshot.yieldPredict,
        chain: snapshot.chain,
        signedPayload: snapshot.signedPayload,
        scoreHash: snapshot.scoreHash,
      })
      .returning();

    if (!created) {
      throw new Error("Snapshot insert returned no row");
    }

    await tx
      .update(lots)
      .set({
        polygon: snapshot.polygon,
        riskScore: snapshot.riskScore,
        riskTier: snapshot.riskTier,
        eudrStatus: snapshot.eudrStatus,
        scoreHash: snapshot.scoreHash,
        scoreVersion: snapshot.scoreVersion,
        scoreUpdatedAt: created.createdAt,
        copernicusSnapshotId: created.id,
        ...(snapshot.dem.altitudeMasl != null
          ? { altitudeMasl: snapshot.dem.altitudeMasl }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(lots.id, snapshot.lotId));

    return created;
  });
}

async function main() {
  console.log(`Copernicus demo seed (${sourceMode}) for ${DEMO_LOT_CODE}...`);

  const lot = await db.query.lots.findFirst({
    where: eq(lots.code, DEMO_LOT_CODE),
    with: { farm: true },
  });

  if (!lot) {
    throw new Error(
      `Lot ${DEMO_LOT_CODE} not found. Run pnpm db:seed first.`,
    );
  }

  await db
    .update(lots)
    .set({ polygon: DEMO_LOT_POLYGON, updatedAt: new Date() })
    .where(eq(lots.id, lot.id));

  await db
    .update(farms)
    .set({ polygon: DEMO_LOT_POLYGON, updatedAt: new Date() })
    .where(eq(farms.id, lot.farmId));

  console.log(`  polygon set on lot #${lot.id} and farm #${lot.farmId}`);

  const lotInput = {
    id: lot.id,
    farmId: lot.farmId,
    code: lot.code,
    farmName: lot.farmName ?? lot.farm.name,
    region: lot.region ?? lot.farm.region,
    country: lot.country ?? lot.farm.country,
    variety: lot.variety,
    altitudeMasl: lot.altitudeMasl,
    areaManzanas: lot.areaManzanas,
    gpsLat: lot.gpsLat,
    gpsLng: lot.gpsLng,
    polygon: DEMO_LOT_POLYGON,
    numTrees: lot.numTrees,
    harvestYear: lot.harvestYear,
  };

  let snapshot: CopernicusLotSnapshot;
  if (sourceMode === "live") {
    const credentials = getSentinelHubCredentials(process.env);
    if (!credentials) {
      throw new Error(
        "Live mode requires SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET in apps/web/.env",
      );
    }
    const token = await getSentinelHubToken(credentials);
    snapshot = await buildLiveCopernicusSnapshot(lotInput, token);
  } else {
    snapshot = buildFixtureCopernicusSnapshot(lotInput);
  }

  const created = await persistCopernicusSnapshot(snapshot);

  console.log(
    JSON.stringify(
      {
        ok: true,
        lotId: lot.id,
        lotCode: DEMO_LOT_CODE,
        snapshotId: created.id,
        sourceMode: snapshot.sourceMode,
        scoreVersion: snapshot.scoreVersion,
        riskScore: snapshot.riskScore,
        riskTier: snapshot.riskTier,
        eudrStatus: snapshot.eudrStatus,
        eligibleForInvestment: snapshot.eligibleForInvestment,
        publicUrl: `http://localhost:3001/lot/${DEMO_LOT_CODE}`,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
