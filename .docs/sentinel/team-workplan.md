# Harvverse Sentinel Team Workplan

This workplan keeps the hackathon scope centered on Copernicus: Sentinel-2, Sentinel-1 SAR, Copernicus DEM, ERA5/Open-Meteo climate, EUDR screening, and the score/hash bridge to Base L2.

## Start Now

Jesus and Sheyla can start from the current fixture payload:

- `sample-copernicus-snapshot.json`
- `start-handoff.md`
- public route `/lot/[code]`
- development webhook `/api/sentinel/alerts`

Javier should keep the payload shape stable while replacing fixture values with live Copernicus signals and Base L2 metadata writes.

## Shared Demo Contract

All workstreams should build around one shared object: the Copernicus lot snapshot.

Required fields:

- `lotId`
- `farmId`
- `polygon`
- `sourceMode`: `live` or `fixture`
- `scoreVersion`
- `riskScore`: `0-100`
- `riskTier`: `excellent`, `good`, `moderate`, `high_risk`, or `not_viable`
- `eudrStatus`: `verified`, `non_compliant`, or `unknown`
- `eligibleForInvestment`
- `variables`: seven weighted Copernicus score variables
- `sources`: Copernicus provider and dataset provenance for each signal
- `dataQuality`: confidence, completeness, warnings, limitations, and parcel-scale satellite confidence
- `sentinel2`: NDVI current value, historical series, cloud-filter details
- `sentinel1`: VV/VH, moisture proxy, structural-change signal
- `dem`: altitude, slope or terrain suitability
- `era5`: rainfall, temperature, water-stress summary
- `eudr`: baseline, deforestation flag, evidence date range
- `yieldPredict`: projected quintales, low/high band, investment argument
- `evidenceHash`: SHA-256 fingerprint of the snapshot payload
- `chain`: transaction hash, contract address, chain id, and on-chain metadata status

If a teammate needs data before live Copernicus integration is ready, they should use this same shape with `sourceMode: "fixture"`.

## Javier: Copernicus, Base L2, and Score Engine

Primary responsibility: make Copernicus data produce a deterministic financing decision.

Deliverables:

- Add `copernicus_snapshots` storage and lot-level score summary fields.
- Port or rebuild the Sentinel-2 NDVI pipeline with SCL cloud filtering and 24-month stability.
- Port or rebuild Sentinel-1 SAR signals for VV/VH, moisture proxy, and structural-change indicators.
- Add Copernicus DEM altitude and terrain suitability.
- Add ERA5/Open-Meteo climate summary for precipitation, temperature, and water stress.
- Add EUDR gate as a hard block, not just a soft score.
- Define the seven weighted risk-score variables and score bands.
- Add YieldPredict outputs derived from Copernicus suitability signals.
- Generate the signed/off-chain snapshot payload and SHA-256 evidence hash.
- Extend Base L2 contract metadata with `riskScore`, `eudrCompliant`, `scoreHash`, `scoreVersion`, and `scoreUpdatedAt`.
- Enforce contract eligibility: score below `40` blocks, EUDR non-compliant blocks.

First useful handoff:

- A fixture-backed `computeCopernicusSnapshot` API that returns the shared snapshot shape.
- One real or realistic demo lot with a complete snapshot, score, EUDR status, YieldPredict, and evidence hash.

## Sheyla: n8n, WhatsApp, and AI Narrative

Primary responsibility: make Copernicus score events understandable and actionable through WhatsApp and demo narration.

Copernicus-only scope:

- Alerts must be triggered by Copernicus-derived signals: score calculated, EUDR blocked, NDVI drop, SAR moisture risk, water stress, or snapshot ready.
- AI text should explain satellite evidence, not invent agronomic facts outside the snapshot.
- WhatsApp messages should include the score, the blocking reason or opportunity, and the next action.

Deliverables:

- n8n flow for `score.calculated`.
- n8n flow for `eudr.blocked`.
- n8n flow for `ndvi.drop_detected` or `water_stress_detected`.
- Farmer WhatsApp message template in Spanish.
- Partner WhatsApp message template in Spanish.
- Short AI explanation format for each score variable.
- Demo trigger endpoint or webhook contract that can receive a snapshot event.

First useful handoff:

- She can start immediately from a static fixture snapshot.
- She does not need live Sentinel/CDSE access first.
- She does need the final event names and payload fields from Javier before wiring the real webhook.

## Jesus and DIGEX: Frontend, QR Page, Dashboard, and WhatsApp Setup

Primary responsibility: make the Copernicus proof visible, scannable, and convincing.

Copernicus-only scope:

- UI should foreground satellite evidence: polygon, score, EUDR, NDVI, SAR, climate, DEM, hash, and chain proof.
- Avoid generic dashboard widgets that do not explain Copernicus data or investment eligibility.
- 3D map is optional and only useful if it shows DEM terrain plus Sentinel/NDVI overlay.

Deliverables:

- Public QR lot page: `/lot/[code]`.
- Open Farms Directory score and EUDR badges.
- Partner dashboard widgets:
  - NDVI current/trend card.
  - YieldPredict card with projected quintales and investment range.
  - Risk Score card with seven-variable breakdown.
  - EUDR eligibility badge.
  - Evidence hash and Base L2 transaction proof.
- Farmer-facing status card showing whether the lot is eligible, blocked, or pending review.
- DIGEX/Experenta WhatsApp setup support for the demo number and n8n flow handoff.

First useful handoff:

- Jesus can start immediately with static fixture JSON matching the shared snapshot shape.
- He does not need Javier to finish live Copernicus integration.
- He does need a stable `copernicusSnapshot` response shape before replacing fixtures with real tRPC data.

## Dependency Order

Javier does not need to finish everything before the others start.

Critical first step:

1. Javier defines the shared snapshot shape and produces one fixture-backed API response.

After that:

2. Jesus can build the QR page, directory cards, and partner widgets from the fixture.
3. Sheyla can build n8n and WhatsApp flows from the same fixture.
4. Javier can continue replacing fixture fields with live Copernicus integrations and Base L2 writes.

Hard blockers:

- Smart-contract eligibility cannot be final until Javier writes score/EUDR metadata on-chain.
- Production webhook wiring cannot be final until the snapshot/event payload is stable.
- Final dashboard data wiring cannot be final until the API response shape is stable.

Non-blockers:

- Live Sentinel/CDSE calls are not required for UI, WhatsApp, or demo narrative work.
- Base L2 write is not required for static QR page layout work.
- 3D map is not required for the core demo.

## Recommended First Sprint

1. Javier: create fixture-backed `computeCopernicusSnapshot` and `copernicusSnapshot` procedures.
2. Jesus: build QR lot page and dashboard widgets using the fixture payload.
3. Sheyla: build WhatsApp/n8n flows using the fixture payload.
4. Javier: port real Sentinel-2, Sentinel-1, DEM, ERA5, and EUDR signals behind the same payload.
5. Javier: write score metadata to Base L2 and enforce investment gating.
6. Team: rehearse the five demo moments end to end.
