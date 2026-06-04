import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  copernicusSnapshots,
  copernicusSourceModeEnum,
  farms,
  insertLotSchema,
  lotStatusEnum,
  lots,
  plans,
  partnerships,
  proposals,
  users,
} from "@harvverse-copernicus-hackathon/db/schema";
import type { Db } from "@harvverse-copernicus-hackathon/db";
import { env } from "@harvverse-copernicus-hackathon/env/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import {
  getSentinelHubCredentials,
  getSentinelHubToken,
} from "../lib/copernicus/sentinel-hub";
import {
  buildFixtureCopernicusSnapshot,
  buildLiveCopernicusSnapshot,
  type CopernicusLotSnapshot,
  type CopernicusSourceMode,
} from "../lib/copernicus";
import { fetchCopernicusDemElevation } from "../lib/copernicus/dem";

const lotStatusSchema = z.enum(lotStatusEnum.enumValues);
const copernicusSourceModeSchema = z.enum(copernicusSourceModeEnum.enumValues);
const lotCreateStatusSchema = z.enum(["draft", "available"]);
const execFileAsync = promisify(execFile);
const coverImageSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      z.string().url().safeParse(value).success ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    "Cover image must be a URL or a JPG/PNG/WebP data URL",
  );
const publicProofLotStatuses = new Set<string>([
  "available",
  "reserved",
  "active",
  "settled",
]);
const lotCreateSchema = insertLotSchema.pick({
  farmId: true,
  code: true,
  descriptiveName: true,
  farmName: true,
  farmerWallet: true,
  region: true,
  country: true,
  variety: true,
  varietiesComposition: true,
  process: true,
  processingMethod: true,
  altitudeMasl: true,
  areaManzanas: true,
  gpsLat: true,
  gpsLng: true,
  numTrees: true,
  plantAgeYears: true,
  averagePlantAgeYears: true,
  renovationInProgress: true,
  newVariety: true,
  renovationPercent: true,
  renovationStartYear: true,
  managementType: true,
  previousProductionQq: true,
  productionDataYear: true,
  rustLastCycle: true,
  borerLastCycle: true,
  fertilizedLastCycle: true,
  availableForCoinvestment: true,
  acceptsSplit6040: true,
  minimumPriceCentsPerLb: true,
  lotObservations: true,
  scaScoreTenths: true,
  harvestYear: true,
  cycleNotes: true,
  profile: true,
  summary: true,
  coverImages: true,
  polygon: true,
}).extend({
  status: lotCreateStatusSchema.optional(),
});

const planInputSchema = z.object({
  ticketCents: z.number().int().positive(),
  priceCentsPerLb: z.number().int().positive(),
  priceFloorCentsPerLb: z.number().int().positive().optional(),
  agronomicCostCents: z.number().int().positive(),
  projectedYieldY1TenthsQq: z.number().int().positive(),
  yieldCapY1TenthsQq: z.number().int().positive(),
  splitFarmerBps: z.number().int().min(0).max(10000),
  splitPartnerBps: z.number().int().min(0).max(10000).optional(),
});

type PublicLotRecord = typeof lots.$inferSelect & {
  farm: typeof farms.$inferSelect;
  plans: Array<typeof plans.$inferSelect>;
};
type LotForCopernicus = typeof lots.$inferSelect;
type LotWithOptionalFarm = LotForCopernicus & {
  farm?: Pick<typeof farms.$inferSelect, "shadeTrees">;
};
type LotPlanEconomics = {
  investmentTicketCents?: number | null;
  productionCostCents?: number | null;
  marketPriceCentsPerLb?: number | null;
  floorPriceCentsPerLb?: number | null;
  farmerShareBps?: number | null;
  partnerShareBps?: number | null;
};

function isPublicProofLotStatus(status: string) {
  return publicProofLotStatuses.has(status);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

type LocalChainProofResult = {
  ok: boolean;
  chainId: number;
  contractAddress: string;
  transactionHash: string;
  lotId: string;
  carbonRegistry?: {
    ok: boolean;
    contractAddress: string;
    transactionHash: string;
    carbonHash: string;
    tCo2ePerHaYearBps: number;
    totalTCo2ePerYearBps: number;
    state: string;
    methodVersion: string;
  } | null;
};

function resolveRepoRoot() {
  const cwd = process.cwd();
  if (path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps") {
    return path.resolve(cwd, "..", "..");
  }
  return cwd;
}

async function resolveHardhatBin(repoRoot: string, contractsDir: string) {
  const executableName = process.platform === "win32" ? "hardhat.cmd" : "hardhat";
  const candidates = [
    path.join(contractsDir, "node_modules", ".bin", executableName),
    path.join(repoRoot, "node_modules", ".bin", executableName),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Hardhat binary not found. Checked: ${candidates.join(", ")}`,
  );
}

function planToLotEconomics(plan: typeof plans.$inferSelect): LotPlanEconomics {
  return {
    investmentTicketCents: plan.ticketCents,
    productionCostCents: plan.agronomicCostCents,
    marketPriceCentsPerLb: plan.priceCentsPerLb,
    floorPriceCentsPerLb: plan.priceFloorCentsPerLb,
    farmerShareBps: plan.splitFarmerBps,
    partnerShareBps: plan.splitPartnerBps,
  };
}

function getFarmShadeTrees(lot: LotForCopernicus) {
  return (lot as LotWithOptionalFarm).farm?.shadeTrees ?? null;
}

async function getLotPlanEconomics(
  db: Db,
  lot: LotForCopernicus,
): Promise<LotPlanEconomics> {
  const activePlan =
    lot.activePlanCode == null
      ? null
      : await db.query.plans.findFirst({
          where: and(
            eq(plans.planCode, lot.activePlanCode),
            eq(plans.status, "approved_for_demo"),
          ),
        });

  const lotPlan =
    activePlan ??
    (await db.query.plans.findFirst({
      where: and(eq(plans.lotId, lot.id), eq(plans.status, "approved_for_demo")),
      orderBy: [desc(plans.createdAt)],
    }));

  const codePlan =
    lotPlan ??
    (lot.code == null
      ? null
      : await db.query.plans.findFirst({
          where: and(
            eq(plans.lotCode, lot.code),
            eq(plans.status, "approved_for_demo"),
          ),
          orderBy: [desc(plans.createdAt)],
        }));

  return codePlan == null ? {} : planToLotEconomics(codePlan);
}

async function buildCopernicusSnapshotForLot(
  db: Db,
  lot: LotForCopernicus,
  sourceMode: CopernicusSourceMode,
) {
  const lotWithEconomics = {
    ...lot,
    shadeTrees: getFarmShadeTrees(lot),
    ...(await getLotPlanEconomics(db, lot)),
  };

  if (sourceMode === "live") {
    const credentials = getSentinelHubCredentials(env);
    if (!credentials) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Live Copernicus scoring requires SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET.",
      });
    }
    const token = await getSentinelHubToken(credentials);
    return buildLiveCopernicusSnapshot(lotWithEconomics, token);
  }

  return buildFixtureCopernicusSnapshot(lotWithEconomics);
}

async function persistCopernicusSnapshot(db: Db, snapshot: CopernicusLotSnapshot) {
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
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Snapshot insert returned no row",
      });
    }

    await tx
      .update(lots)
      .set({
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

    return { snapshot: created, payload: snapshot };
  });
}

async function runLocalCopernicusVerifier(
  snapshot: typeof copernicusSnapshots.$inferSelect,
  lotCode: string,
): Promise<LocalChainProofResult> {
  const repoRoot = resolveRepoRoot();
  const contractsDir = path.join(repoRoot, "packages", "contracts");
  const hardhatBin = await resolveHardhatBin(repoRoot, contractsDir);
  const tempDir = await mkdtemp(path.join(tmpdir(), "harvverse-copernicus-"));

  try {
    const snapshotPath = path.join(tempDir, "snapshot.json");
    const outputPath = path.join(tempDir, "proof.json");
    const signedPayload = asRecord(snapshot.signedPayload);
    const signedPayloadBody = asRecord(signedPayload.payload);
    const carbonCapture = signedPayloadBody.carbonCapture ?? null;
    await writeFile(
      snapshotPath,
      `${JSON.stringify(
        {
          lotCode,
          riskScore: snapshot.riskScore,
          eudrStatus: snapshot.eudrStatus,
          eligibleForInvestment: snapshot.eligibleForInvestment,
          scoreHash: snapshot.scoreHash,
          scoreVersion: snapshot.scoreVersion,
          carbonCapture,
        },
        null,
        2,
      )}\n`,
    );

    if (env.NODE_ENV !== "development") {
      throw new Error("Local Hardhat proof generation is only supported in development.");
    }

    await execFileAsync(
      hardhatBin,
      ["run", "scripts/verify-local-copernicus-chain.ts", "--network", "hardhat"],
      {
        cwd: contractsDir,
        env: {
          ...process.env,
          LOT_CODE: lotCode,
          SNAPSHOT_PATH: snapshotPath,
          OUTPUT_PATH: outputPath,
        },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      },
    );

    const result = JSON.parse(await readFile(outputPath, "utf8")) as LocalChainProofResult;
    if (!result.ok) {
      throw new Error("Local Hardhat verifier returned ok=false.");
    }
    return result;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function toPublicLot(lot: PublicLotRecord) {
  return {
    id: lot.id,
    code: lot.code,
    descriptiveName: lot.descriptiveName,
    farmName: lot.farmName,
    region: lot.region,
    country: lot.country,
    variety: lot.variety,
    process: lot.process,
    processingMethod: lot.processingMethod,
    altitudeMasl: lot.altitudeMasl,
    areaManzanas: lot.areaManzanas,
    gpsLat: lot.gpsLat,
    gpsLng: lot.gpsLng,
    numTrees: lot.numTrees,
    plantAgeYears: lot.plantAgeYears,
    averagePlantAgeYears: lot.averagePlantAgeYears,
    managementType: lot.managementType,
    availableForCoinvestment: lot.availableForCoinvestment,
    acceptsSplit6040: lot.acceptsSplit6040,
    scaScoreTenths: lot.scaScoreTenths,
    harvestYear: lot.harvestYear,
    cycleNotes: lot.cycleNotes,
    profile: lot.profile,
    summary: lot.summary,
    coverImages: lot.coverImages,
    status: lot.status,
    riskScore: lot.riskScore,
    riskTier: lot.riskTier,
    eudrStatus: lot.eudrStatus,
    scoreHash: lot.scoreHash,
    scoreVersion: lot.scoreVersion,
    scoreUpdatedAt: lot.scoreUpdatedAt,
    polygon: lot.polygon,
    onchainLotId: lot.onchainLotId,
    plans: lot.plans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      version: plan.version,
      status: plan.status,
      ticketCents: plan.ticketCents,
      priceCentsPerLb: plan.priceCentsPerLb,
      priceFloorCentsPerLb: plan.priceFloorCentsPerLb,
      projectedYieldY1TenthsQq: plan.projectedYieldY1TenthsQq,
      yieldCapY1TenthsQq: plan.yieldCapY1TenthsQq,
      splitFarmerBps: plan.splitFarmerBps,
      splitPartnerBps: plan.splitPartnerBps,
      planHash: plan.planHash,
      termsSummary: plan.termsSummary,
    })),
    farm: {
      id: lot.farm.id,
      name: lot.farm.name,
      farmCode: lot.farm.farmCode,
      country: lot.farm.country,
      department: lot.farm.department,
      municipality: lot.farm.municipality,
      region: lot.farm.region,
      altitudeMasl: lot.farm.altitudeMasl,
      totalArea: lot.farm.totalArea,
      areaManzanas: lot.farm.areaManzanas,
      varieties: lot.farm.varieties,
      description: lot.farm.description,
      certifications: lot.farm.certifications,
      photoUrls: lot.farm.photoUrls,
      latitude: lot.farm.latitude,
      longitude: lot.farm.longitude,
      polygon: lot.farm.polygon,
      coeScore: lot.farm.coeScore,
      verified: lot.farm.verified,
      waterSource: lot.farm.waterSource,
      roadAccess: lot.farm.roadAccess,
      shadeTrees: lot.farm.shadeTrees,
    },
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
  };
}

export const lotsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: lotStatusSchema.optional(),
          country: z.string().trim().min(1).optional(),
          region: z.string().trim().min(1).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      const filters: SQL[] = [];
      const statusFilter = input?.status ?? "available";
      filters.push(eq(lots.status, statusFilter));
      if (input?.country) filters.push(eq(lots.country, input.country));
      if (input?.region) filters.push(eq(lots.region, input.region));

      return ctx.db.query.lots.findMany({
        where: and(...filters),
        with: { plans: true },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.id, input.id),
        with: {
          farm: true,
          plans: true,
        },
      });
      if (!lot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }
      const relatedProposal = await ctx.db.query.proposals.findFirst({
        where: and(
          eq(proposals.lotId, lot.id),
          eq(proposals.userId, requestingUser.id),
        ),
      });
      const relatedPartnership = await ctx.db.query.partnerships.findFirst({
        where: and(
          eq(partnerships.lotId, lot.id),
          eq(partnerships.partnerUserId, requestingUser.id),
        ),
      });
      if (
        lot.status !== "available" &&
        lot.farm.farmerId !== requestingUser.id &&
        !relatedProposal &&
        !relatedPartnership
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot view this lot" });
      }

      const snapshot = await ctx.db.query.copernicusSnapshots.findFirst({
        where: eq(copernicusSnapshots.lotId, lot.id),
        orderBy: [desc(copernicusSnapshots.createdAt)],
      });

      return { ...lot, copernicusSnapshot: snapshot };
    }),

  byFarmId: protectedProcedure
    .input(z.object({ farmId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }
      const farm = await ctx.db.query.farms.findFirst({
        where: eq(farms.id, input.farmId),
      });
      if (!farm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }
      if (farm.farmerId !== requestingUser.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this farm" });
      }
      return ctx.db.query.lots.findMany({
        where: eq(lots.farmId, input.farmId),
        with: { plans: true },
      });
    }),

  byCode: publicProcedure
    .input(z.object({ code: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.code, input.code),
        with: {
          farm: true,
          plans: true,
        },
      });
      if (!lot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      if (lot.status !== "available") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      return lot;
    }),

  publicByCode: publicProcedure
    .input(z.object({ code: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.code, input.code),
        with: {
          farm: true,
          plans: true,
        },
      });
      if (!lot || !isPublicProofLotStatus(lot.status)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }

      const snapshot = await ctx.db.query.copernicusSnapshots.findFirst({
        where: eq(copernicusSnapshots.lotId, lot.id),
        orderBy: [desc(copernicusSnapshots.createdAt)],
      });

      return { lot: toPublicLot(lot), snapshot };
    }),

  copernicusSnapshot: publicProcedure
    .input(z.object({ lotId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.id, input.lotId),
        with: {
          farm: true,
          plans: true,
        },
      });
      if (!lot || !isPublicProofLotStatus(lot.status)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }

      const snapshot = await ctx.db.query.copernicusSnapshots.findFirst({
        where: eq(copernicusSnapshots.lotId, input.lotId),
        orderBy: [desc(copernicusSnapshots.createdAt)],
      });

      return { lot: toPublicLot(lot), snapshot };
    }),

  detectAltitude: protectedProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const altitudeMeters = await fetchCopernicusDemElevation({
          lat: input.lat,
          lng: input.lng,
        });

        return {
          ok: true as const,
          altitudeMeters,
          provider: "open_meteo_copernicus_dem_glo90" as const,
          message: null,
        };
      } catch (error) {
        console.warn("[lots.detectAltitude] DEM altitude lookup failed:", {
          lat: input.lat,
          lng: input.lng,
          message: error instanceof Error ? error.message : "Unknown DEM lookup failure.",
        });

        return {
          ok: false as const,
          altitudeMeters: null,
          provider: "open_meteo_copernicus_dem_glo90" as const,
          message: "DEM altitude could not be detected automatically.",
        };
      }
    }),

  computeCopernicusSnapshot: protectedProcedure
    .input(
      z.object({
        lotId: z.number().int().positive(),
        sourceMode: copernicusSourceModeSchema.default("fixture"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.id, input.lotId),
        with: { farm: true },
      });
      if (!lot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      if (lot.farm.farmerId !== requestingUser.id && requestingUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot score this lot" });
      }

      const snapshot = await buildCopernicusSnapshotForLot(
        ctx.db,
        lot,
        input.sourceMode,
      ).catch((error: unknown) => {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Copernicus scoring failed.",
        });
      });

      return persistCopernicusSnapshot(ctx.db, snapshot);
    }),

  markLocalCopernicusProof: protectedProcedure
    .input(z.object({ lotId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.id, input.lotId),
        with: { farm: true },
      });
      if (!lot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      if (lot.farm.farmerId !== requestingUser.id && requestingUser.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot write proof for this lot" });
      }

      const snapshot = await ctx.db.query.copernicusSnapshots.findFirst({
        where: eq(copernicusSnapshots.lotId, input.lotId),
        orderBy: [desc(copernicusSnapshots.createdAt)],
      });
      if (!snapshot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Compute a Copernicus snapshot before writing a local proof.",
        });
      }

      const existingChain = asRecord(snapshot.chain);
      const lotCode = lot.code ?? `LOT-${lot.id}`;
      const proof = await runLocalCopernicusVerifier(snapshot, lotCode).catch(
        (error: unknown) => {
          const details =
            error instanceof Error ? error.message : "Local Hardhat verifier failed.";
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Local Hardhat proof failed: ${details}`,
          });
        },
      );
      const now = new Date();
      const chain = {
        ...existingChain,
        chainId: proof.chainId,
        contractAddress:
          proof.contractAddress ?? env.HARVVERSE_LOT_ADDRESS ?? existingChain.contractAddress ?? null,
        transactionHash: proof.transactionHash,
        metadataStatus: "written",
        proofMode: "local-hardhat-in-memory",
        lotId: proof.lotId,
        carbonRegistry: proof.carbonRegistry ?? existingChain.carbonRegistry ?? null,
        verifiedAt: now.toISOString(),
      };

      const [updated] = await ctx.db
        .update(copernicusSnapshots)
        .set({ chain })
        .where(eq(copernicusSnapshots.id, snapshot.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Local proof update returned no row",
        });
      }

      await ctx.db
        .update(lots)
        .set({ updatedAt: now })
        .where(eq(lots.id, input.lotId));

      return { snapshot: updated, chain };
    }),

  create: protectedProcedure
    .input(lotCreateSchema.extend({ plan: planInputSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const farm = await ctx.db.query.farms.findFirst({
        where: eq(farms.id, input.farmId),
      });
      if (!farm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }
      if (farm.farmerId !== requestingUser.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this farm" });
      }

      const { plan: planInput, ...lotInput } = input;

      const lot = await ctx.db.transaction(async (tx) => {
        const insertValues = {
          ...lotInput,
        };

        let created: typeof lots.$inferSelect;
        try {
          const [row] = await tx.insert(lots).values(insertValues).returning();
          if (!row) throw new Error("Insert returned no rows");
          created = row;
        } catch (err) {
          const pg = err as { code?: string; constraint?: string; detail?: string };
          console.error("[lots.create] lot insert failed:", { code: pg.code, constraint: pg.constraint, detail: pg.detail, message: (err as Error).message });
          if (pg.code === "23505") {
            throw new TRPCError({
              code: "CONFLICT",
              message: `A lot with code "${lotInput.code}" already exists. Choose a different code.`,
            });
          }
          throw err;
        }

        if (planInput) {
          const rawCode = created.code ?? String(created.id);
          const planCode = `${rawCode}-${new Date().getFullYear()}`.slice(0, 30);
          const planHash = createHash("sha256")
            .update(JSON.stringify({ ...planInput, planCode, lotId: created.id }))
            .digest("hex");
          try {
            await tx.insert(plans).values({
              ...planInput,
              lotId: created.id,
              lotCode: created.code ?? null,
              planCode,
              status: "approved_for_demo",
              validatedByName: "Pending validation",
              planHash,
            });
            const [updatedLot] = await tx
              .update(lots)
              .set({ activePlanCode: planCode, updatedAt: new Date() })
              .where(eq(lots.id, created.id))
              .returning();
            if (updatedLot) {
              created = updatedLot;
            }
          } catch (err) {
            const pg = err as { code?: string; constraint?: string; detail?: string };
            console.error("[lots.create] plan insert failed:", { code: pg.code, constraint: pg.constraint, detail: pg.detail, message: (err as Error).message });
            if (pg.code === "23505") {
              throw new TRPCError({
                code: "CONFLICT",
                message: `An investment plan for lot code "${rawCode}" already exists for ${new Date().getFullYear()}.`,
              });
            }
            throw err;
          }
        }

        return created;
      });

      if (lot.polygon != null) {
        const sourceMode: CopernicusSourceMode = getSentinelHubCredentials(env)
          ? "live"
          : "fixture";

        void (async () => {
          const snapshot = await buildCopernicusSnapshotForLot(
            ctx.db,
            lot,
            sourceMode,
          );
          await persistCopernicusSnapshot(ctx.db, snapshot);
        })().catch((error: unknown) => {
          console.error("[lots.create] automatic Copernicus analysis failed:", {
            lotId: lot.id,
            message:
              error instanceof Error
                ? error.message
                : "Automatic Copernicus analysis failed.",
          });
        });
      }

      return lot;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: lotStatusSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const existingLot = await ctx.db.query.lots.findFirst({
        where: eq(lots.id, input.id),
        with: { farm: true },
      });
      if (!existingLot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      if (existingLot.farm.farmerId !== requestingUser.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this lot" });
      }

      const [lot] = await ctx.db
        .update(lots)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(lots.id, input.id))
        .returning();
      if (!lot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      return lot;
    }),

  update: protectedProcedure
    .input(
      z.object({
        lotId: z.number().int().positive(),
        // Section B — marketing, locked when not available
        variety: z.string().trim().max(100).optional(),
        process: z.string().trim().optional(),
        profile: z.string().trim().optional(),
        summary: z.string().trim().optional(),
        coverImages: z.array(coverImageSchema).optional(),
        scaScoreTenths: z.number().int().min(0).max(1000).optional(),
        // Section C — agronomic, always editable
        numTrees: z.number().int().min(0).optional(),
        plantAgeYears: z.number().int().min(0).optional(),
        areaManzanas: z.number().min(0).optional(),
        harvestYear: z.number().int().min(2000).max(2100).optional(),
        cycleNotes: z.string().trim().optional(),
        // NEW FIELDS
        descriptiveName: z.string().trim().optional(),
        varietiesComposition: z.any().optional(),
        processingMethod: z.string().trim().optional(),
        averagePlantAgeYears: z.number().int().min(0).optional(),
        renovationInProgress: z.boolean().optional(),
        newVariety: z.string().trim().optional(),
        renovationPercent: z.number().min(0).max(100).optional(),
        renovationStartYear: z.number().int().optional(),
        managementType: z.string().trim().optional(),
        previousProductionQq: z.number().min(0).optional(),
        productionDataYear: z.number().int().optional(),
        rustLastCycle: z.string().trim().optional(),
        borerLastCycle: z.string().trim().optional(),
        fertilizedLastCycle: z.boolean().optional(),
        availableForCoinvestment: z.boolean().optional(),
        acceptsSplit6040: z.boolean().optional(),
        minimumPriceCentsPerLb: z.number().int().min(0).optional(),
        lotObservations: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const lot = await ctx.db.query.lots.findFirst({
        where: eq(lots.id, input.lotId),
        with: { farm: true },
      });
      if (!lot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      if (lot.farm.farmerId !== requestingUser.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this lot" });
      }

      const {
        lotId,
        areaManzanas,
        variety,
        profile,
        summary,
        coverImages,
        scaScoreTenths,
        descriptiveName,
        process,
        renovationPercent,
        previousProductionQq,
        ...agronomicFields
      } = input;

      // Marketing fields can be edited before publish and while available.
      const sectionBFields =
        lot.status === "available" || lot.status === "draft"
          ? {
              variety,
              profile,
              summary,
              coverImages,
              scaScoreTenths,
              descriptiveName,
              process,
            }
          : {};

      const updateValues = {
        ...agronomicFields,
        ...sectionBFields,
        areaManzanas: areaManzanas != null ? String(areaManzanas) : undefined,
        renovationPercent: renovationPercent != null ? String(renovationPercent) : undefined,
        previousProductionQq: previousProductionQq != null ? String(previousProductionQq) : undefined,
        updatedAt: new Date(),
      };

      const [updated] = await ctx.db
        .update(lots)
        .set(updateValues)
        .where(eq(lots.id, lotId))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lot not found" });
      }
      return updated;
    }),
});

export { lotStatusSchema };
