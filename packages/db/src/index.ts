import { env } from "@harvverse-copernicus-hackathon/env/server";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

export * from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export function createDb() {
	return drizzle(new pg.Pool({ connectionString: env.DATABASE_URL }), { schema });
}

export const db = createDb();
