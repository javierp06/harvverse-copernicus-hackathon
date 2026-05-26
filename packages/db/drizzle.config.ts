import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  dotenv.config({
    path: process.env.DOTENV_PATH ?? "../../apps/web/.env",
  });
}

const databaseUrl = process.env.DATABASE_URL || "";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
