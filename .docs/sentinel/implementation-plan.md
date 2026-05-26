# Harvverse Sentinel Implementation Plan

## Current Repo Baseline

This repo is a Better-T-Stack/Turborepo Harvverse fork with:

- `apps/web`: Next.js App Router frontend with public, auth, onboarding, dashboard, farm, and lot surfaces.
- `packages/api`: tRPC routers split by domain.
- `packages/db`: Drizzle/Postgres schema, migrations, seed script, and database client.
- `packages/contracts`: Hardhat contracts for `HarvverseLot`, `HarvverseEvidence`, `HarvversePartnership`, and `MockUSDC`.
- `packages/env`: runtime environment validation.

Sentinel-specific state is not yet first-class in the schema or contracts. Existing lot records have `polygon`, `altitudeMasl`, `areaManzanas`, `gpsLat`, and `gpsLng`, which are enough to start the Copernicus pipeline boundary.

## Build Principle

For hackathon speed, keep two paths:

- `live`: attempts real Copernicus/CDS/Open-Meteo/Sentinel integrations when credentials and runtime dependencies are available.
- `fixture`: deterministic demo data for the submitted lot polygons, with the same payload shape, hashes, score version, and on-chain writes.

The UI and contracts should not care whether a snapshot came from live data or a fixture.

## Phase 1: Score Data Model and API

Add first-class Sentinel score storage.

Target files:

- `packages/db/src/schema/index.ts`
- `packages/api/src/routers/lots.ts`
- `packages/api/src/lib/copernicus.ts`
- `packages/env/src/server.ts`

Recommended DB shape:

- Add score summary columns to `lots`:
  - `riskScore`
  - `riskTier`
  - `eudrStatus`
  - `scoreHash`
  - `scoreVersion`
  - `scoreUpdatedAt`
  - `copernicusSnapshotId`
- Add `copernicus_snapshots` table:
  - `id`
  - `lotId`
  - `sourceMode`: `live` or `fixture`
  - `scoreVersion`
  - `riskScore`
  - `riskTier`
  - `eudrStatus`
  - `eligibleForInvestment`
  - `variables` as JSONB
  - `polygon` as JSONB
  - `sentinel2` as JSONB
  - `sentinel1` as JSONB
  - `era5` as JSONB
  - `signedPayload` as JSONB
  - `scoreHash`
  - `createdAt`

API endpoints:

- `lots.copernicusSnapshot({ lotId })`: returns latest snapshot plus lot metadata.
- `lots.computeCopernicusSnapshot({ lotId, sourceMode })`: calculates, signs, stores, and returns a snapshot.
- `lots.publicByCode({ code })`: QR-safe public lot view with score proof and no auth requirement.

## Phase 2: Scoring Engine

Create a deterministic scoring module with typed input and output.

Target file:

- `packages/api/src/lib/copernicus.ts`

Output contract:

```ts
type SentinelScoreSnapshot = {
  scoreVersion: string;
  riskScore: number;
  riskTier: "excellent" | "good" | "moderate" | "high_risk" | "not_viable";
  eudrStatus: "verified" | "non_compliant" | "unknown";
  eligibleForInvestment: boolean;
  variables: Array<{
    key: string;
    label: string;
    value: number | string | boolean;
    score: number;
    weight: number;
    source: "sentinel-2" | "sentinel-1" | "era5" | "polygon" | "eudr";
  }>;
  scoreHash: string;
  signedPayload: {
    payload: unknown;
    signature: string;
    signer: string;
  };
};
```

Eligibility rules:

- `eudrStatus === "non_compliant"` blocks.
- `riskScore < 40` blocks.
- `riskScore >= 60 && eudrStatus === "verified"` is marketplace-ready.

## Phase 3: Smart Contract Bridge

Extend lot metadata on-chain.

Target files:

- `packages/contracts/contracts/HarvverseLot.sol`
- `packages/contracts/contracts/HarvversePartnership.sol`
- `packages/contracts/test/*`
- deployment/setup scripts in `packages/contracts/scripts`

`HarvverseLot` should store:

- `riskScore`
- `eudrCompliant`
- `scoreHash`
- `scoreVersion`
- `scoreUpdatedAt`

`HarvversePartnership.invest` should check:

- lot score exists.
- lot score is at least `40`.
- lot is EUDR compliant.

For the main demo, use `score >= 60` as the green investment story, but keep the hard block at `< 40` to match the stated eligibility rule.

## Phase 4: Open Farms Directory and QR Page

Target files:

- `apps/web/src/app/(public)/farms/page.tsx`
- `apps/web/src/app/(public)/farms/[farmId]/page.tsx`
- `apps/web/src/app/(public)/lot/[code]/page.tsx`
- `apps/web/src/components/farm-card.tsx`
- `apps/web/src/components/lot-card.tsx`

Required UI:

- EUDR badge.
- Risk score badge.
- Seven-variable breakdown.
- Polygon map.
- Hash and chain metadata.
- QR-friendly mobile layout.

## Phase 5: Partner Dashboard Widgets

Target files:

- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/lots/page.tsx`
- `apps/web/src/components/lot-card.tsx`

Widgets:

- NDVI map or trend sparkline.
- YieldPredict card: projected quintales and confidence band.
- Risk Score card: green/yellow/red badge.
- Marketplace lock state for EUDR or score failures.

## Phase 6: WhatsApp and AI Hooks

Create a small server-side event surface that n8n can call or poll.

Target files:

- `apps/web/src/app/api/sentinel/alerts/route.ts`
- `packages/api/src/routers/evidence.ts`

Events:

- `score.calculated`
- `eudr.blocked`
- `ndvi.drop_detected`
- `milestone.ready`
- `partner.snapshot_ready`

The first demo only needs a deterministic alert payload that can be fired live from the dashboard.

## First Coding Slice

Recommended first implementation slice:

1. Add `copernicus_snapshots` table plus lot summary score columns.
2. Add a fixture-backed `computeCopernicusSnapshot` tRPC procedure.
3. Render score and EUDR badges on `LotCard`.
4. Add public `/lot/[code]` QR page.
5. Extend `HarvverseLot` to store score metadata and verify contract tests.

This produces the shortest path to the memorable demo loop: satellite data to risk score, QR proof, and investment gating.

