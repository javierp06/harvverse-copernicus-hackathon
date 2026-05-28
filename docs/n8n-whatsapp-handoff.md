# Sheyla n8n WhatsApp Handoff

This handoff lets n8n work without database access.

The Harvverse app emits JSON events. n8n receives the event, chooses a WhatsApp message path, and sends it through DIGEX/Experenta/Meta.

## Endpoint

Development relay endpoint:

```text
POST /api/sentinel/alerts
```

Health/contract endpoint:

```text
GET /api/sentinel/alerts
```

If `N8N_WEBHOOK_URL` is set in the web app env, `POST /api/sentinel/alerts` validates the payload and forwards the normalized event to that n8n webhook.

If `N8N_WEBHOOK_URL` is not set, the endpoint still validates the payload and returns the normalized event. This is useful for local testing.

## Required n8n Setup

Sheyla does not need database credentials.

1. Create an n8n workflow.
2. Add a `Webhook` trigger node.
3. Use method `POST`.
4. Copy the webhook URL.
5. Put that URL in the Harvverse web env as `N8N_WEBHOOK_URL`.
6. Add an `IF` or `Switch` node using `event`.
7. Format the WhatsApp message from `message.body` or from the structured fields.
8. Send through the DIGEX/Experenta/Meta WhatsApp node/API.

## Event Types

Primary events for the hackathon:

```text
copernicus.snapshot.created
risk_score.ready
yield_predict.ready
eudr.non_compliant
local_proof.verified
```

Legacy aliases still accepted by the API:

```text
score.calculated
eudr.blocked
ndvi.drop_detected
water_stress_detected
partner.snapshot_ready
```

## Payload Shape

```json
{
  "event": "copernicus.snapshot.created",
  "eventId": "sentinel-demo-testlot-snapshot-001",
  "occurredAt": "2026-05-28T18:00:00.000Z",
  "locale": "es",
  "lotId": 101,
  "lotCode": "testlot",
  "publicUrl": "http://localhost:3001/lot/testlot",
  "recipient": {
    "type": "farmer",
    "phone": "+50400000000",
    "name": "Demo Farmer",
    "whatsappOptIn": true
  },
  "lot": {
    "id": 101,
    "code": "testlot",
    "farmName": "Finca Test 2",
    "region": "Intibuca",
    "country": "Honduras",
    "altitudeMasl": 2229,
    "areaManzanas": 8.24
  },
  "copernicus": {
    "sourceMode": "live",
    "riskScore": 77,
    "riskTier": "good",
    "eudrStatus": "verified",
    "eligibleForInvestment": true,
    "scoreHash": "a0275b8ce7f2a2c2c4e4f8ac8c6d04f5d0d91577c4b1ec9fa67e4b4d1d916ac6"
  },
  "yieldPredict": {
    "projectedQuintales": 152,
    "lowBandQuintales": 121.6,
    "highBandQuintales": 182.4,
    "ndviModifier": 1.16,
    "densityModifier": 1.06
  },
  "proof": {
    "chainId": 31337,
    "chainLabel": "Hardhat local",
    "metadataStatus": "pending",
    "transactionHash": null
  },
  "message": {
    "templateKey": "copernicus_snapshot_ready_es",
    "title": "Analisis satelital listo",
    "body": "Tu lote testlot tiene Risk Score 77/100, EUDR Verified y una proyeccion de 152 qq. Prueba publica: http://localhost:3001/lot/testlot"
  }
}
```

## Fixtures

Use these files for n8n testing:

```text
fixtures/n8n/copernicus-snapshot-created.json
fixtures/n8n/eudr-non-compliant.json
fixtures/n8n/local-proof-verified.json
```

## Local Test Commands

Start the web app:

```bash
pnpm dev
```

Check the contract:

```bash
curl http://localhost:3001/api/sentinel/alerts
```

Send a snapshot-ready fixture:

```bash
curl -X POST http://localhost:3001/api/sentinel/alerts \
  -H "content-type: application/json" \
  --data @fixtures/n8n/copernicus-snapshot-created.json
```

Send an EUDR blocked fixture:

```bash
curl -X POST http://localhost:3001/api/sentinel/alerts \
  -H "content-type: application/json" \
  --data @fixtures/n8n/eudr-non-compliant.json
```

Send a local proof verified fixture:

```bash
curl -X POST http://localhost:3001/api/sentinel/alerts \
  -H "content-type: application/json" \
  --data @fixtures/n8n/local-proof-verified.json
```

## Suggested n8n Switch Logic

Use `event` as the switch value.

```text
copernicus.snapshot.created -> send farmer score summary
eudr.non_compliant -> send internal team alert and farmer review notice
local_proof.verified -> send partner proof-ready message
yield_predict.ready -> send partner yield/investment argument
risk_score.ready -> send generic score-ready message
```

## Demo Reliability

Do not depend on n8n running on Johnnie's computer.

Use one of these:

```text
n8n Cloud
Sheyla's local n8n
Harvverse local mock endpoint response if WhatsApp is unavailable
```

For the hackathon demo, the app should still work if WhatsApp is down. The QR proof and local event response are the fallback proof.
