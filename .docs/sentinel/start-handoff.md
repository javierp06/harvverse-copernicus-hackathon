# Teammate Start Handoff

Status: Jesus and Sheyla can start now from the fixture payload.

Use this payload as the temporary contract:

- `.docs/sentinel/sample-copernicus-snapshot.json`

Runtime surfaces now exist for integration work:

- Public QR lot page route: `/lot/[code]`
- n8n/WhatsApp development webhook: `/api/sentinel/alerts`
- Snapshot read procedure: `lots.publicByCode({ code })`

The real backend should keep the same field names while Javier replaces fixture values with live Copernicus signals and Base L2 writes.

## What Javier Must Hand Off First

Already enough for parallel work:

- Snapshot shape with score, EUDR, seven variables, YieldPredict, source provenance, data quality, hash, and chain fields.
- Parcel-scale confidence is included so small lots can show Sentinel-2/Sentinel-1 limitations honestly.
- Fixture payload for one realistic Honduran coffee lot.
- Backend direction: `sourceMode` can be `fixture` first and `live` later.
- Public QR route and webhook contract for frontend/n8n handoff.

Still Javier-owned:

- Live Sentinel-2, Sentinel-1, DEM, ERA5, and EUDR integrations.
- Base L2 write of score metadata.
- Smart-contract eligibility enforcement.
- Final endpoint names if they change.

## Jesus Can Start

Build frontend against `.docs/sentinel/sample-copernicus-snapshot.json` and the public `/lot/[code]` route.

Priority screens:

1. Public QR lot page.
2. Open Farms Directory card with score and EUDR badge.
3. Partner dashboard widgets:
   - NDVI current and trend.
   - YieldPredict projected quintales and low/high band.
   - Risk Score with seven-variable breakdown.
   - EUDR status and marketplace eligibility.
   - Data quality confidence, completeness, and source datasets.
   - Evidence hash and Base L2 proof state.

Important UI rule:

- The visible story must be Copernicus proof first, not generic farm profile data.

Expected labels:

- `EUDR Verified`
- `Risk Score 85/100`
- `Sentinel-2 NDVI 0.74`
- `YieldPredict 66.8-87 qq`
- `Evidence hash`
- `Base L2 pending` or `Base L2 verified`

## Sheyla Can Start

Build n8n and WhatsApp flows against `.docs/sentinel/sample-copernicus-snapshot.json` and `/api/sentinel/alerts`.

Priority flows:

1. `score.calculated`
2. `eudr.blocked`
3. `ndvi.drop_detected`
4. `water_stress_detected`
5. `partner.snapshot_ready`

Message rules:

- Explain only what exists in the Copernicus snapshot.
- Do not invent agronomy recommendations outside the payload.
- Include score, EUDR status, key reason, and next action.

Example farmer message:

```text
Harvverse Sentinel: tu lote HN-ZAFIRO-001 fue verificado con Copernicus.
Score: 85/100. EUDR: Verified.
NDVI actual: 0.74. YieldPredict: 66.8-87 qq.
Tu lote esta elegible para co-inversion.
```

Example partner message:

```text
Nuevo lote verificado por Copernicus: Finca Zafiro, Honduras.
Risk Score: 85/100. EUDR Verified.
YieldPredict: 66.8-87 qq. Evidence hash disponible para Base L2.
```

## What Still Blocks Final Integration

- Jesus can build UI now; final polish waits for live snapshot data and Base L2 transaction values.
- Sheyla can build flows now; production delivery waits for final phone credentials and n8n deployment.
- Contract proof display can show `pending` now, but final proof waits for Base L2 metadata writes.

## Suggested Team Message

```text
Team: you can start now using `.docs/sentinel/sample-copernicus-snapshot.json` as the shared Copernicus payload.

Jesus: build from the public QR route `/lot/[code]`, plus Open Farms cards and partner dashboard widgets using this same JSON shape.

Sheyla: build n8n/WhatsApp flows against `/api/sentinel/alerts` using events like `score.calculated`, `eudr.blocked`, and `partner.snapshot_ready`.

Javier will keep replacing fixture fields with live Sentinel-2, Sentinel-1, DEM, ERA5/EUDR data and Base L2 writes, but the payload shape should stay stable.
```
