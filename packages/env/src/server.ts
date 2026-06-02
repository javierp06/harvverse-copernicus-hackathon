import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    CLERK_SECRET_KEY: z.string().min(1),
    SENTINEL_HUB_CLIENT_ID: z.string().min(1).optional(),
    SENTINEL_HUB_CLIENT_SECRET: z.string().min(1).optional(),
    CDS_API_KEY: z.string().min(1).optional(),
    HARVVERSE_LOT_ADDRESS: z.string().min(1).optional(),
    N8N_WEBHOOK_URL: z.url().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    WHATSAPP_TEMPLATE_NAME: z.string().min(1).optional(),
    WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).optional(),
    WHATSAPP_DRY_RUN: z.enum(["true", "false"]).optional(),
    WHATSAPP_LOOKBACK_HOURS: z.coerce.number().int().positive().optional(),
    WHATSAPP_PUBLIC_APP_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
