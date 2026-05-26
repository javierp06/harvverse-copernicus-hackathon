import type { NextRequest } from "next/server";

import { db } from "@harvverse-copernicus-hackathon/db";
import type { Db } from "@harvverse-copernicus-hackathon/db";

export type Context = {
  clerkId: string | null;
  db: Db;
};

export async function createContext(
  _req: NextRequest,
  opts?: { clerkId?: string | null },
): Promise<Context> {
  return {
    clerkId: opts?.clerkId ?? null,
    db,
  };
}
