# WhatsApp Worker

Cron-style TypeScript worker for Harvverse Sentinel alerts.

It runs once, reads recent Copernicus snapshots from Postgres, prepares WhatsApp utility-template payloads, and sends them through the WhatsApp Cloud API when dry-run is disabled.

## Local Dry Run

```bash
pnpm whatsapp:dry-run
```

Dry-run is the default. It prints the payloads that would be sent.

## Real Send Env

```bash
WHATSAPP_DRY_RUN=false
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TEMPLATE_NAME=harvverse_sentinel_alert
WHATSAPP_TEMPLATE_LANGUAGE=es
WHATSAPP_LOOKBACK_HOURS=24
WHATSAPP_PUBLIC_APP_URL=https://your-public-demo-url.example
```

## Current Alert Rules

- `eudr_blocked`: snapshot has `eudrStatus = non_compliant`.
- `lot_approved`: snapshot is eligible and `riskScore >= 60`.
- `water_stress`: `era5.waterStress = high`.
- `fungal_risk`: `era5.annualRainfallMm > 3000`.

## Pending Before Production

- Confirm WhatsApp provider and utility template variable order.
- Confirm farmer phone/opt-in collection rules.
- Add a notification log table to prevent duplicate sends across cron runs.
- Decide whether AI SDK is needed for adaptive text or if utility templates stay deterministic.
