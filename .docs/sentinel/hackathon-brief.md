# Harvverse Sentinel Hackathon Brief

## Positioning

Harvverse Sentinel is a co-investment platform for small coffee producers in LATAM. It uses Copernicus data from Sentinel-2, Sentinel-1 SAR, and ERA5 to generate verifiable farm risk scores that connect global capital with producers through on-chain financial agreements.

Core line:

> Todos monitorean el problema. Nosotros lo financiamos.

## Problem

Small farmers need seasonal working capital, but the available credit product is usually debt priced for industrial machinery, not agriculture. At the same time, EUDR traceability requirements make verified GPS and land-use compliance existential for coffee exporters that sell into Europe.

The hackathon demo must show that satellite intelligence can become a financing condition, not just a dashboard metric.

## Hackathon Deliverables

### Layer 1: Copernicus Risk Score Engine

When a farmer registers a lot with a GPS polygon, the system calculates a 0-100 lot score using Copernicus-derived variables:

1. Sentinel-2 current NDVI and canopy vigor.
2. Sentinel-2 two-year NDVI history and management stability.
3. Sentinel-1 SAR moisture signal for cloud-resilient field monitoring.
4. ERA5 annual rainfall fit for coffee production.
5. ERA5 seasonal distribution and mean temperature risk.
6. EUDR land-cover change gate after December 2020.
7. Polygon-derived altitude, area, and suitability context.

The EUDR gate is absolute: if post-December 2020 deforestation is detected, the lot is marked `EUDR NON-COMPLIANT` and blocked from the marketplace regardless of numeric score.

Score bands:

- `80-100`: Excelente
- `60-79`: Bueno
- `40-59`: Moderado
- `20-39`: Alto Riesgo
- `0-19`: No Viable

### Layer 2: Copernicus to Smart Contract Bridge

The score engine produces a signed off-chain payload. The bridge writes the score, individual variables, EUDR status, score version, and evidence hash on-chain as lot metadata.

Contract eligibility rules:

- `score < 40`: blocked.
- `EUDR NON-COMPLIANT`: blocked without exception.
- `score >= 60` and `EUDR Verified`: automatically eligible for escrow-backed co-investment.

The objective is to make satellite intelligence immutable, auditable, and readable by global investors without requiring trust in Harvverse as an intermediary.

### Layer 3: Open Farms Directory

The public directory lets any farmer register a farm, receive a satellite-verified EUDR score, and become discoverable by buyers and investors.

Each public profile should expose:

- GPS polygon on a satellite map.
- Score 0-100 with the seven-variable breakdown.
- EUDR Verified or EUDR Non-Compliant status.
- Co-investment availability.
- QR-friendly public lot URL for buyers, partners, and demo judges.

## Demo Moments

The demo should be built around five moments that judges can remember:

1. Real satellite view of the lot: polygon, Sentinel-2 NDVI, and visible green health state.
2. YieldPredict to investment: projected quintales converted into a concrete partner investment argument.
3. WhatsApp in vivo: a live alert generated from the lot state.
4. QR code to blockchain proof: public lot page with farmer, NDVI, EUDR, and Base L2 hash.
5. Carbon or impact token optionality: third income stream if time allows.

## Team Workstreams

### Javier: Base L2 and Copernicus

- Extend the NDVI pipeline.
- Add YieldPredict.
- Add composite risk score.
- Add on-chain snapshot metadata.
- Extend contract eligibility around score and EUDR status.

### Sheyla: AI and n8n

- AI agent narrative.
- WhatsApp flows for farmer and partner.
- Alerts based on score variables, milestones, and farm state.

### Jesus and DIGEX: Frontend and WhatsApp Setup

- QR lot page.
- Partner dashboard widgets.
- Public directory.
- DIGEX/Experenta WhatsApp setup.
- 3D farm map if core flows are complete.

## Hackathon Success Bar

The repo should demonstrate a full loop:

1. A farmer registers a polygon.
2. Copernicus-derived variables are calculated or loaded from a deterministic fixture.
3. A signed score snapshot is saved in the database.
4. Score metadata is written on-chain.
5. The marketplace blocks non-compliant or low-score lots.
6. A public QR page proves the satellite score and on-chain hash.
7. A partner dashboard turns the score into investment confidence.

