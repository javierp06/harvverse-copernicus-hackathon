# Eventos Sentinel, n8n y WhatsApp

Este documento describe el contrato actual para que Sheyla pueda construir los flujos de WhatsApp sin acceso directo a la base de datos.

Estado actual del repo:

- Implementado: `POST /api/sentinel/alerts` valida y normaliza eventos Sentinel.
- Implementado: si `N8N_WEBHOOK_URL` existe, el endpoint reenvia el evento a n8n.
- Implementado: si `N8N_WEBHOOK_URL` no existe, el endpoint responde con el evento normalizado para pruebas locales.
- Planeado: reemplazar o complementar n8n con Vercel AI SDK + Meta Cloud API directo.

---

## Arquitectura Actual

```
Copernicus snapshot / proof event
        |
        v
POST /api/sentinel/alerts
        |
        +--> valida payload con Zod
        +--> normaliza campos
        +--> retorna JSON para demo local
        |
        +--> si N8N_WEBHOOK_URL existe, reenvia a n8n
                                  |
                                  v
                          WhatsApp / DIGEX / Experenta
```

El endpoint no calcula Copernicus, no consulta Sentinel Hub y no necesita credenciales de DB para Sheyla. Su trabajo empieza desde el payload de evento.

---

## Variables de Entorno

```bash
# Actual
N8N_WEBHOOK_URL=

# Futuro / opcional si se implementa WhatsApp directo
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## Endpoints

### `GET /api/sentinel/alerts`

Retorna el contrato disponible: tipos de evento aceptados, fixtures y si el relay a n8n esta activo.

### `POST /api/sentinel/alerts`

Valida y normaliza un evento Sentinel.

Si `N8N_WEBHOOK_URL` esta configurado:

- Reenvia el evento normalizado a n8n.
- Retorna si la entrega fue exitosa.

Si `N8N_WEBHOOK_URL` no esta configurado:

- No falla.
- Retorna el evento normalizado.
- Sirve como dry-run local para la demo.

---

## Tipos de Evento

| Evento | Cuando ocurre | Destinatario tipico |
|--------|---------------|---------------------|
| `copernicus.snapshot.created` | Snapshot calculado | Farmer |
| `risk_score.ready` | Score y elegibilidad listos | Farmer |
| `yield_predict.ready` | Proyeccion de cosecha lista | Partner |
| `eudr.non_compliant` | Gate EUDR bloqueo el lote | Farmer + team |
| `local_proof.verified` | Prueba local/on-chain escrita | Partner |

Aliases legacy aceptados:

- `score.calculated`
- `eudr.blocked`
- `ndvi.drop_detected`
- `water_stress_detected`
- `partner.snapshot_ready`

---

## Payload de Evento

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
    "scoreHash": "a0275b8c..."
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

n8n puede usar `message.body` directamente o reconstruir el mensaje desde los campos estructurados.

---

## Fixtures de Prueba

```text
fixtures/n8n/copernicus-snapshot-created.json
fixtures/n8n/eudr-non-compliant.json
fixtures/n8n/local-proof-verified.json
```

### Probar localmente

```bash
pnpm dev

curl http://localhost:3001/api/sentinel/alerts

curl -X POST http://localhost:3001/api/sentinel/alerts \
  -H "content-type: application/json" \
  --data @fixtures/n8n/copernicus-snapshot-created.json
```

---

## Logica Sugerida para n8n

Usar `event` como valor del nodo `Switch`.

| Evento | Accion sugerida |
|--------|-----------------|
| `copernicus.snapshot.created` | Mensaje al farmer con score, EUDR y URL publica |
| `eudr.non_compliant` | Alerta al farmer y aviso interno al team |
| `local_proof.verified` | Mensaje al partner con hash/tx de prueba |
| `yield_predict.ready` | Argumento de inversion con quintales proyectados |
| `risk_score.ready` | Resumen generico de score listo |

Reglas de mensaje:

- Explicar solo lo que existe en el payload.
- No inventar recomendaciones agronomicas fuera del snapshot.
- Incluir score, EUDR, razon principal y siguiente accion.
- Incluir `publicUrl` cuando exista.

---

## Ruta Futura con AI SDK

Si se decide hacer la mensajeria en codigo, el contrato de evento no cambia. La app puede reemplazar el relay a n8n por:

- `generateText` / `streamText` con Vercel AI SDK.
- Tools como `getLotSnapshot`, `explainRiskScore` y `sendWhatsAppMessage`.
- Envio directo a Meta Cloud API / DIGEX.
- Persistencia opcional en `conversations` y `chat_messages`.

Esa ruta todavia no es el comportamiento actual del endpoint.
