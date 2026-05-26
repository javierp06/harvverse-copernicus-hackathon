import { createHash } from "node:crypto";

import {
  farms,
  insertLotSchema,
  lotStatusEnum,
  lots,
  plans,
  partnerships,
  proposals,
  users,
} from "@harvverse-copernicus-hackathon/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, type SQL } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";

const lotStatusSchema = z.enum(lotStatusEnum.enumValues);
const lotCreateStatusSchema = z.enum(["draft", "available"]);
const lotCreateSchema = insertLotSchema.pick({
  farmId: true,
  code: true,
  farmName: true,
  farmerWallet: true,
  region: true,
  country: true,
  variety: true,
  process: true,
  altitudeMasl: true,
  areaManzanas: true,
  gpsLat: true,
  gpsLng: true,
  numTrees: true,
  plantAgeYears: true,
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
      return lot;
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
        profile: z.string().trim().optional(),
        summary: z.string().trim().optional(),
        coverImages: z.array(z.string().url()).optional(),
        scaScoreTenths: z.number().int().min(0).max(1000).optional(),
        // Section C — agronomic, always editable
        numTrees: z.number().int().min(0).optional(),
        plantAgeYears: z.number().int().min(0).optional(),
        areaManzanas: z.number().min(0).optional(),
        harvestYear: z.number().int().min(2000).max(2100).optional(),
        cycleNotes: z.string().trim().optional(),
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

      const { lotId, areaManzanas, ...rest } = input;

      // Marketing fields can be edited before publish and while available.
      const sectionBFields =
        lot.status === "available" || lot.status === "draft"
          ? {
              variety: rest.variety,
              profile: rest.profile,
              summary: rest.summary,
              coverImages: rest.coverImages,
              scaScoreTenths: rest.scaScoreTenths,
            }
          : {};

      const updateValues = {
        ...sectionBFields,
        numTrees: rest.numTrees,
        plantAgeYears: rest.plantAgeYears,
        areaManzanas: areaManzanas != null ? String(areaManzanas) : undefined,
        harvestYear: rest.harvestYear,
        cycleNotes: rest.cycleNotes,
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
