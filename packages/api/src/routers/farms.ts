import { createHash } from "crypto";
import type { Db } from "@harvverse-copernicus-hackathon/db";
import {
  farmImages,
  farms,
  insertFarmSchema,
  users,
} from "@harvverse-copernicus-hackathon/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import { getFarmImageUrl } from "../lib/farm-image-storage";

const MAX_FARM_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FARM_IMAGES = 10;
const ALLOWED_FARM_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const farmWritableSchema = insertFarmSchema.pick({
  name: true,
  country: true,
  region: true,
  altitudeMasl: true,
  totalArea: true,
  areaManzanas: true,
  varieties: true,
  description: true,
  certifications: true,
  latitude: true,
  longitude: true,
  polygon: true,
});

type FarmImageRecord = {
  id: number;
  data: string | null;
  storageProvider: string;
  storageBucket: string | null;
  storageKey: string | null;
  storageRegion: string | null;
  mimeType: string;
  filename: string;
  isPrimary: boolean | null;
  createdAt: Date;
};

async function withImageUrl<T extends FarmImageRecord>(image: T) {
  try {
    return {
      ...image,
      url: await getFarmImageUrl(image),
    };
  } catch (error) {
    console.error(`[farms.withImageUrl] Failed to get URL for image ${image.id}:`, error);
    return {
      ...image,
      url: null,
    };
  }
}

async function withImageUrls(images: FarmImageRecord[] | undefined) {
  return Promise.all((images ?? []).map((image) => withImageUrl(image)));
}

function publicImagePayload(image: Awaited<ReturnType<typeof withImageUrl>>) {
  return {
    id: image.id,
    url: image.url,
    data: image.data,
    mimeType: image.mimeType,
    filename: image.filename,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt,
  };
}

async function withPrimaryImage<T extends { images?: FarmImageRecord[] }>(farm: T) {
  const images = await withImageUrls(farm.images);
  const primary =
    images.find((image) => image.isPrimary) ??
    images[0] ??
    null;
  return {
    ...farm,
    images,
    primaryImageUrl: primary?.url ?? null,
    primaryImageData: primary?.data ?? null,
    primaryImageMimeType: primary?.mimeType ?? null,
  };
}

async function withPublicPrimaryImage<T extends { images?: FarmImageRecord[] }>(
  farm: T,
) {
  const images = (await withImageUrls(farm.images)).map(publicImagePayload);
  const primary =
    images.find((image) => image.isPrimary) ??
    images[0] ??
    null;
  return {
    ...farm,
    images,
    primaryImageUrl: primary?.url ?? null,
    primaryImageData: primary?.data ?? null,
    primaryImageMimeType: primary?.mimeType ?? null,
  };
}

async function withPublicImages<T extends { images?: FarmImageRecord[] }>(farm: T) {
  const { images: _images, ...rest } = farm;
  const images = await withImageUrls(farm.images);
  const publicImages = images.map(publicImagePayload);
  const primary =
    publicImages.find((image) => image.isPrimary) ??
    publicImages[0] ??
    null;

  return {
    ...rest,
    images: publicImages,
    primaryImageUrl: primary?.url ?? null,
    primaryImageData: primary?.data ?? null,
    primaryImageMimeType: primary?.mimeType ?? null,
  };
}

async function getRequestingUser(ctx: { db: Db; clerkId: string | null }) {
  if (!ctx.clerkId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }
  const requestingUser = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.clerkId),
  });
  if (!requestingUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }
  return requestingUser;
}

async function assertOwnsFarm(db: Db, clerkId: string | null, farmId: number) {
  const requestingUser = await getRequestingUser({ db, clerkId });
  const farm = await db.query.farms.findFirst({
    where: eq(farms.id, farmId),
  });
  if (!farm) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
  }
  if (farm.farmerId !== requestingUser.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this farm" });
  }
  return farm;
}

export const farmsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          farmerId: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const requestingUser = await getRequestingUser(ctx);
      const farmerId = input?.farmerId ?? requestingUser.id;
      if (farmerId !== requestingUser.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only list your own farms",
        });
      }

      const items = await ctx.db.query.farms.findMany({
        where: farmerId ? eq(farms.farmerId, farmerId) : undefined,
        with: {
          lots: { with: { plans: true } },
          images: {
            columns: {
              id: true,
              data: true,
              storageProvider: true,
              storageBucket: true,
              storageKey: true,
              storageRegion: true,
              mimeType: true,
              filename: true,
              isPrimary: true,
              createdAt: true,
            },
            orderBy: (table, { desc }) => [desc(table.isPrimary), desc(table.createdAt)],
          },
        },
      });
      return Promise.all(items.map(withPrimaryImage));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertOwnsFarm(ctx.db, ctx.clerkId, input.id);
      const farm = await ctx.db.query.farms.findFirst({
        where: eq(farms.id, input.id),
        with: {
          lots: { with: { plans: true } },
          images: {
            orderBy: (table, { desc }) => [desc(table.isPrimary), desc(table.createdAt)],
          },
        },
      });
      if (!farm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }
      return withPrimaryImage(farm);
    }),

  listPublic: publicProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.query.farms.findMany({
      with: {
        farmer: {
          columns: {
            displayName: true,
          },
        },
        lots: {
          with: { plans: true },
        },
        images: {
          columns: {
            id: true,
            data: true,
            storageProvider: true,
            storageBucket: true,
            storageKey: true,
            storageRegion: true,
            mimeType: true,
            filename: true,
            isPrimary: true,
            createdAt: true,
          },
          orderBy: (table, { desc }) => [desc(table.isPrimary), desc(table.createdAt)],
        },
      },
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    });
    return Promise.all(items.map(withPublicPrimaryImage));
  }),

  byIdPublic: publicProcedure
    .input(z.object({ farmId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const farm = await ctx.db.query.farms.findFirst({
        where: eq(farms.id, input.farmId),
        with: {
          farmer: {
            columns: {
              displayName: true,
            },
          },
          lots: { with: { plans: true } },
          images: {
            orderBy: (table, { desc }) => [desc(table.isPrimary), desc(table.createdAt)],
          },
        },
      });
      if (!farm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }
      return withPublicImages(farm);
    }),

  getImages: protectedProcedure
    .input(z.object({ farmId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertOwnsFarm(ctx.db, ctx.clerkId, input.farmId);
      const images = await ctx.db.query.farmImages.findMany({
        where: eq(farmImages.farmId, input.farmId),
        orderBy: (table, { desc }) => [desc(table.isPrimary), desc(table.createdAt)],
      });
      return Promise.all(images.map(withImageUrl));
    }),

  uploadImage: protectedProcedure
    .input(
      z.object({
        farmId: z.number().int().positive(),
        data: z.string().min(1),
        mimeType: z.enum(ALLOWED_FARM_IMAGE_TYPES),
        filename: z.string().min(1).max(255),
        sizeBytes: z.number().int().positive().max(MAX_FARM_IMAGE_BYTES),
        isPrimary: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsFarm(ctx.db, ctx.clerkId, input.farmId);

      const existingImages = await ctx.db.query.farmImages.findMany({
        where: eq(farmImages.farmId, input.farmId),
        columns: { id: true },
      });
      if (existingImages.length >= MAX_FARM_IMAGES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum 10 images per farm",
        });
      }

      const shouldBePrimary = input.isPrimary || existingImages.length === 0;
      if (shouldBePrimary) {
        await ctx.db
          .update(farmImages)
          .set({ isPrimary: false })
          .where(eq(farmImages.farmId, input.farmId));
      }

      const checksumSha256 = createHash("sha256")
        .update(Buffer.from(input.data, "base64"))
        .digest("hex");

      const [image] = await ctx.db
        .insert(farmImages)
        .values({
          farmId: input.farmId,
          data: input.data,
          storageProvider: "database",
          storageBucket: null,
          storageKey: null,
          storageRegion: null,
          checksumSha256,
          mimeType: input.mimeType,
          filename: input.filename,
          sizeBytes: input.sizeBytes,
          isPrimary: shouldBePrimary,
        })
        .returning({
          id: farmImages.id,
          farmId: farmImages.farmId,
          isPrimary: farmImages.isPrimary,
          filename: farmImages.filename,
        });

      return image;
    }),

  deleteImage: protectedProcedure
    .input(z.object({ imageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const image = await ctx.db.query.farmImages.findFirst({
        where: eq(farmImages.id, input.imageId),
        with: { farm: true },
      });
      if (!image) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Image not found" });
      }
      await assertOwnsFarm(ctx.db, ctx.clerkId, image.farmId);

      await ctx.db.delete(farmImages).where(eq(farmImages.id, input.imageId));

      if (image.isPrimary) {
        const nextImage = await ctx.db.query.farmImages.findFirst({
          where: eq(farmImages.farmId, image.farmId),
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        });
        if (nextImage) {
          await ctx.db
            .update(farmImages)
            .set({ isPrimary: true })
            .where(eq(farmImages.id, nextImage.id));
        }
      }

      return { success: true };
    }),

  setPrimaryImage: protectedProcedure
    .input(z.object({ imageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const image = await ctx.db.query.farmImages.findFirst({
        where: eq(farmImages.id, input.imageId),
      });
      if (!image) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Image not found" });
      }
      await assertOwnsFarm(ctx.db, ctx.clerkId, image.farmId);
      await ctx.db
        .update(farmImages)
        .set({ isPrimary: false })
        .where(eq(farmImages.farmId, image.farmId));
      await ctx.db
        .update(farmImages)
        .set({ isPrimary: true })
        .where(and(eq(farmImages.id, image.id), eq(farmImages.farmId, image.farmId)));

      return { success: true };
    }),

  create: protectedProcedure
    .input(farmWritableSchema)
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }
      const [farm] = await ctx.db
        .insert(farms)
        .values({ ...input, farmerId: requestingUser.id })
        .returning();
      if (!farm) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create farm",
        });
      }
      return farm;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: farmWritableSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const requestingUser = await ctx.db.query.users.findFirst({
        where: eq(users.clerkId, ctx.clerkId),
      });
      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const existing = await ctx.db.query.farms.findFirst({
        where: eq(farms.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }
      if (existing.farmerId !== requestingUser.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this farm" });
      }

      const [farm] = await ctx.db
        .update(farms)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(farms.id, input.id))
        .returning();

      if (!farm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Farm not found" });
      }
      return farm;
    }),
});
