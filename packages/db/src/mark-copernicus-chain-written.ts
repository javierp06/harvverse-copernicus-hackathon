import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";
import { copernicusSnapshots, lots } from "./schema";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");

dotenv.config({ path: path.join(repoRoot, "apps/web/.env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

function requiredEnv(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function normalizeScoreHash(value: string) {
	const normalized = value.startsWith("0x") ? value.slice(2) : value;
	if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
		throw new Error(`SCORE_HASH must be a 32-byte hex string, received: ${value}`);
	}
	return normalized.toLowerCase();
}

function normalizeTxHash(value: string) {
	if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
		throw new Error(`TX_HASH must be a 0x-prefixed 32-byte hex string, received: ${value}`);
	}
	return value;
}

function optionalAddress(value: string | undefined) {
	if (!value) return null;
	if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
		throw new Error(`CONTRACT_ADDRESS must be a 0x-prefixed 20-byte address, received: ${value}`);
	}
	return value;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

async function main() {
	const databaseUrl = requiredEnv("DATABASE_URL");
	const scoreHash = normalizeScoreHash(requiredEnv("SCORE_HASH"));
	const txHash = normalizeTxHash(requiredEnv("TX_HASH"));
	const contractAddress = optionalAddress(process.env.CONTRACT_ADDRESS);
	const chainId = Number(process.env.CHAIN_ID ?? 84532);

	if (!Number.isInteger(chainId) || chainId <= 0) {
		throw new Error(`CHAIN_ID must be a positive integer, received: ${process.env.CHAIN_ID}`);
	}

	if (process.env.VALIDATE_ONLY === "true") {
		console.log(
			JSON.stringify(
				{
					validateOnly: true,
					scoreHash,
					txHash,
					contractAddress,
					chainId,
					metadataStatus: "written",
				},
				null,
				2,
			),
		);
		return;
	}

	const pool = new pg.Pool({ connectionString: databaseUrl });
	const db = drizzle(pool, { schema });

	try {
		const snapshot = await db.query.copernicusSnapshots.findFirst({
			where: eq(copernicusSnapshots.scoreHash, scoreHash),
		});

		if (!snapshot) {
			throw new Error(`No Copernicus snapshot found for SCORE_HASH=${scoreHash}`);
		}

		const chain = {
			...asRecord(snapshot.chain),
			transactionHash: txHash,
			contractAddress,
			chainId,
			metadataStatus: "written",
		};

		if (process.env.DRY_RUN === "true") {
			console.log(
				JSON.stringify(
					{
						dryRun: true,
						snapshotId: snapshot.id,
						lotId: snapshot.lotId,
						scoreHash,
						chain,
					},
					null,
					2,
				),
			);
			return;
		}

		const [updated] = await db
			.update(copernicusSnapshots)
			.set({ chain })
			.where(eq(copernicusSnapshots.id, snapshot.id))
			.returning();

		await db
			.update(lots)
			.set({ updatedAt: new Date() })
			.where(eq(lots.id, snapshot.lotId));

		console.log(
			JSON.stringify(
				{
					ok: true,
					snapshotId: updated?.id ?? snapshot.id,
					lotId: snapshot.lotId,
					scoreHash,
					chain,
				},
				null,
				2,
			),
		);
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
