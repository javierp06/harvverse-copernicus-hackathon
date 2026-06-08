# 02 — Arquitectura Harvverse Sentinel

## Resumen ejecutivo

Harvverse Sentinel conecta tres mundos que normalmente viven separados:

1. **Productor y finca**: registro de finca/lote, polígono GPS, agronomía básica y términos de co-inversión.
2. **Copernicus**: Sentinel-2, Sentinel-1 SAR, ERA5 y DEM para generar score de riesgo, YieldPredict, EUDR gate y estimación de carbono.
3. **Finanzas verificables**: contratos en Base L2/Base Sepolia, prueba on-chain del score, partnership/escrow y registro de carbono.

La demo actual corre como una aplicación Next.js desplegada en Vercel, con PostgreSQL en Neon, autenticación Clerk, alertas WhatsApp por Gupshup/AI SDK y contratos Solidity desplegados para la demo en Base Sepolia.

---

## Diagrama de arquitectura general

```mermaid
flowchart LR
  subgraph Users[Usuarios]
    Farmer[Farmer / Productor]
    Partner[Digital Partner]
    Public[Comprador / Jurado / QR publico]
    Admin[Admin demo]
  end

  subgraph Web[apps/web - Next.js en Vercel]
    UI[UI web\nFarmer dashboard\nPartner marketplace\nQR proof page]
    TRPC[/tRPC API\n/api/trpc/]
    REST[/REST endpoints\n/api/sentinel/*\n/api/dashboard/sentinel/*/]
  end

  subgraph Core[packages/api]
    Routers[tRPC routers\nfarms lots proposals partnerships]
    Copernicus[Copernicus engine\nRisk Score + YieldPredict + EUDR + Carbon]
    AgentContext[Sentinel Agent context builder]
  end

  subgraph Data[Datos]
    Neon[(Neon PostgreSQL)]
    Drizzle[packages/db\nDrizzle schema + migrations]
  end

  subgraph CopernicusAPIs[Copernicus / datos externos]
    S2[Sentinel-2 L2A\nNDVI NDRE NDWI]
    S1[Sentinel-1 GRD\nSAR structure / moisture]
    ERA5[ERA5 via Open-Meteo\nRainfall + temperature]
    DEM[Copernicus DEM via Open-Meteo\nAltitude]
  end

  subgraph Chain[Base L2 / Base Sepolia]
    LotContract[HarvverseLot\nCopernicus score metadata]
    Partnership[HarvversePartnership\nco-investment escrow]
    Carbon[Carbon registry + HC token]
  end

  subgraph Messaging[WhatsApp agent]
    SentinelAgent[packages/sentinel-agent\nAI SDK + deterministic scenarios]
    Gupshup[Gupshup WhatsApp API]
    Phone[Farmer phone]
  end

  Farmer --> UI
  Partner --> UI
  Public --> UI
  Admin --> UI

  UI --> TRPC
  UI --> REST
  TRPC --> Routers
  REST --> AgentContext
  Routers --> Copernicus
  AgentContext --> Copernicus

  Routers --> Drizzle --> Neon
  Copernicus --> Drizzle

  Copernicus --> S2
  Copernicus --> S1
  Copernicus --> ERA5
  Copernicus --> DEM

  Routers --> LotContract
  Routers --> Partnership
  Routers --> Carbon
  LotContract --> Neon
  Partnership --> Neon
  Carbon --> Neon

  REST --> SentinelAgent --> Gupshup --> Phone
  SentinelAgent --> AgentContext
```

---

## Capas principales

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Web app | `apps/web` | UI farmer, partner, QR proof, admin demo alerts, API routes Next.js |
| API negocio | `packages/api` | Routers tRPC, permisos, Copernicus engine, partnerships, proof writers |
| Base de datos | `packages/db` | Esquema Drizzle, migraciones, seed/demo data, acceso PostgreSQL |
| Contratos | `packages/contracts` | Solidity, Hardhat, Base Sepolia deploy, setup demo, proof scripts |
| Agent/WhatsApp | `packages/sentinel-agent` | Contexto para AI SDK, escenarios, Gupshup payloads, respuestas WhatsApp |
| Worker alertas | `apps/whatsapp-worker` | Cron/dry-run para preparar alertas desde snapshots recientes |
| UI shared | `packages/ui` | Componentes reutilizables sin lógica de dominio |
| Env | `packages/env` | Validación Zod de variables de entorno |

---

## Flujo 1 — Registro de finca y lote

```mermaid
sequenceDiagram
  participant F as Farmer UI
  participant API as farms/lots router
  participant DB as Neon PostgreSQL
  participant COP as Copernicus engine
  participant EXT as Copernicus APIs

  F->>API: Crear finca + datos agronomicos
  API->>DB: INSERT farms
  F->>API: Crear lote + poligono GPS + plan financiero
  API->>DB: INSERT lots + plans
  API->>COP: computeCopernicusSnapshot(lotId)
  COP->>EXT: Sentinel-2, Sentinel-1, ERA5, DEM
  EXT-->>COP: series/estadisticas satelitales
  COP-->>API: snapshot canonico
  API->>DB: INSERT copernicus_snapshots
  API->>DB: UPDATE lots riskScore/eudrStatus/eligibility
  API-->>F: lot detail actualizado
```

Resultado en UI:

- Mapa del lote con polígono.
- Score Copernicus 0-100.
- EUDR Verified / blocked.
- YieldPredict actual y potencial maduro.
- Estimación de ganancia farmer/partner.
- Carbon Capture y evidencia on-chain.

---

## Flujo 2 — Motor Copernicus

```mermaid
flowchart TD
  Polygon[Poligono GPS del lote] --> Area[Area + centroid]
  Polygon --> DEM[DEM altitude]
  Polygon --> S2[Sentinel-2 stats]
  Polygon --> S1[Sentinel-1 SAR stats]
  Polygon --> ERA5[ERA5 climate]

  S2 --> NDVI[NDVI/NDRE/NDWI\ncanopy health + stability]
  S1 --> SAR[SAR structure\nradar vegetation index]
  ERA5 --> Climate[Rainfall + temperature risk]
  DEM --> Terrain[Altitude suitability]

  NDVI --> Score[Risk Score 0-100]
  SAR --> Score
  Climate --> Score
  Terrain --> Score
  S2 --> EUDR[EUDR post-2020 continuity gate]
  EUDR --> Eligibility[Investment eligibility]
  Score --> Eligibility
  NDVI --> Yield[YieldPredict]
  Terrain --> Yield
  Polygon --> Yield
  NDVI --> Carbon[Carbon Capture estimate]
  S1 --> Carbon

  Score --> Snapshot[CopernicusLotSnapshot]
  EUDR --> Snapshot
  Yield --> Snapshot
  Carbon --> Snapshot
  Eligibility --> Snapshot
```

Variables usadas para el score:

1. Salud optica de dosel Sentinel-2.
2. Estabilidad Sentinel-2 de dos anos.
3. Estructura/humedad Sentinel-1 SAR.
4. Ajuste de lluvia anual ERA5.
5. Riesgo de temperatura estacional ERA5.
6. Gate EUDR de cobertura post-2020.
7. Idoneidad de altitud y area del poligono.

---

## Flujo 3 — Co-inversion y proof on-chain

```mermaid
sequenceDiagram
  participant P as Digital Partner
  participant UI as Partner UI
  participant API as partnerships router
  participant DB as Neon PostgreSQL
  participant Chain as Base Sepolia contracts
  participant Farmer as Farmer UI

  P->>UI: Explora lotes elegibles
  UI->>API: lots.public / lot detail
  API->>DB: Lee lot + plan + snapshot
  DB-->>UI: Score, EUDR, YieldPredict, terms
  P->>UI: Request partnership
  UI->>API: proposals.create
  API->>DB: INSERT proposal
  Farmer->>API: proposals.approve
  API->>DB: proposal signed + lot reserved
  P->>UI: Confirm wallet / on-chain
  UI->>Chain: approve USDC + invest
  Chain-->>UI: txHash
  UI->>API: partnerships.create
  API->>DB: INSERT partnership + tx metadata
```

Reglas de elegibilidad:

- `riskScore >= 60` para marketplace-ready.
- `riskScore < 40` bloquea inversion.
- `EUDR non_compliant` bloquea siempre, aunque el score numerico sea alto.
- El proof on-chain guarda hashes/metadata para que el score sea verificable.

---

## Flujo 4 — Alertas WhatsApp / Sentinel Agent

```mermaid
sequenceDiagram
  participant Admin as Demo Alerts UI
  participant Web as apps/web REST endpoint
  participant Agent as packages/sentinel-agent
  participant DB as Neon PostgreSQL
  participant AI as AI SDK / model
  participant WA as Gupshup WhatsApp API
  participant Phone as Farmer phone

  Admin->>Web: POST scenario lotCode + alert type
  Web->>DB: Load lot + latest snapshot + farmer context
  Web-->>Agent: normalized context + scenario
  Agent->>AI: refine Spanish message with KB guardrails
  AI-->>Agent: grounded response
  Agent->>WA: template/payload send
  WA-->>Phone: WhatsApp alert
  Phone->>Agent: Farmer reply (planned/agent flow)
  Agent->>DB: Retrieve context again when needed
```

Escenarios preparados:

- Lote aprobado por Copernicus.
- EUDR bloqueado.
- Estrés hidrico.
- Riesgo fungico / roya.
- NDVI -> dinero.
- Explicacion educativa de roya.
- Floracion positiva.

Para la demo, el momento principal es **NDVI -> dinero**: el satelite detecta una caida de vigor y el mensaje explica impacto agronomico y financiero en lenguaje simple.

---

## Flujo 5 — QR proof publico

```mermaid
flowchart LR
  QR[QR impreso / link publico] --> Page[/lot/HV-HN-LEM-L01/]
  Page --> Map[Mapa satelital + poligono]
  Page --> Signals[Sentinel/ERA5/DEM signals]
  Page --> Score[Risk Score + EUDR]
  Page --> Yield[YieldPredict]
  Page --> Proof[Score hash + tx hash]
  Proof --> BaseScan[BaseScan / Base Sepolia]
```

La pagina publica permite que un comprador, partner o juez vea la historia verificable del lote sin entrar al dashboard privado.

---

## Flujo 6 — Carbon Capture y HC

```mermaid
flowchart TD
  S2[Sentinel-2 canopy proxies] --> CarbonEstimate[Carbon Capture estimate]
  S1[Sentinel-1 structure proxies] --> CarbonEstimate
  LotArea[Lot area hectares] --> CarbonEstimate
  Shade[Shade density/species assumption] --> CarbonEstimate
  CarbonEstimate --> Hash[Carbon evidence hash]
  Hash --> Registry[Carbon registry contract]
  CarbonEstimate --> UI[Carbon Credits UI]
  UI --> HC[Issue HC visual ledger]
```

Importante:

- El valor actual es un **screening estimate**, no un credito certificado listo para venta.
- Para version productiva se requiere inventario de campo, especies de sombra, ecuaciones alometricas y verificacion MRV.
- En la demo, HC muestra como el productor puede tener un tercer activo: cosecha, co-inversion y carbono.

---

## Modelo de datos de alto nivel

```mermaid
erDiagram
  users ||--o{ farms : owns
  farms ||--o{ lots : contains
  lots ||--o{ plans : has
  lots ||--o{ copernicus_snapshots : receives
  lots ||--o{ proposals : receives
  proposals ||--o| partnerships : converts_to
  plans ||--o{ proposals : prices
  users ||--o{ proposals : creates
  users ||--o{ partnerships : invests
  partnerships ||--o{ evidence_records : tracks
  lots ||--o{ agent_events : triggers
```

Tablas clave:

- `users`: farmer, partner, admin.
- `farms`: finca, ubicacion, productor, metadata agronomica.
- `lots`: lote, poligono, area, edad de plantas, variedad, score denormalizado.
- `plans`: ticket, precio, costo agronomico, split farmer/partner.
- `copernicus_snapshots`: snapshot canonico satelital y proof metadata.
- `proposals`: solicitud de partnership.
- `partnerships`: alianza activa con tx/wallet metadata.
- `agent_events`: trazabilidad de alertas/agente.

---

## Ambientes

| Ambiente | Hosting | DB | Chain | Uso |
|---|---|---|---|---|
| Local | Next dev server | PostgreSQL local / Docker | Hardhat local | Desarrollo |
| Demo hackathon | Vercel | Neon | Base Sepolia | Video, jueces, smoke test publico |
| Produccion futura | Vercel/infra dedicada | Postgres gestionado | Base L2 mainnet | Clientes reales |

---

## Dependencias externas actuales

| Servicio | Uso |
|---|---|
| Clerk | Autenticacion y sesiones farmer/partner |
| Neon | PostgreSQL demo desplegado |
| Vercel | Hosting Next.js y route handlers |
| Sentinel Hub / CDSE | Sentinel-2 y Sentinel-1 statistics |
| Open-Meteo | ERA5 y Copernicus DEM endpoint |
| Base Sepolia | Contratos y proof on-chain para demo |
| Gupshup | Envio WhatsApp |
| AI SDK / modelo | Redaccion/grounding del agente WhatsApp |

---

## Decisiones tecnicas importantes

- El **lote** es la unidad financiera: score, YieldPredict, EUDR, carbon y proof se calculan por lote.
- El snapshot Copernicus es un contrato de datos unico para UI, agente, QR proof y chain bridge.
- El score y EUDR se denormalizan en `lots` para listados rapidos, pero el detalle vive en `copernicus_snapshots`.
- Base Sepolia se usa para la demo; el mismo patron aplica a Base mainnet si se decide pasar a produccion.
- WhatsApp ya no depende de n8n como ruta principal; el agente vive en `packages/sentinel-agent` y usa endpoints estables.
- Carbono se muestra como POC verificable, no como credito certificado final.

---

## Pendientes de arquitectura productiva

- MRV formal para carbono: inventario de sombra, especies, alometricas, auditor/verificador.
- EUDR legal-grade: interseccion oficial JRC baseline + evidencia forest-loss validada.
- Observabilidad: logs estructurados, retries, auditoria de alertas y tracing de jobs.
- Jobs programados: worker/cron para monitoreo continuo sin boton manual.
- Custodia/escrow productivo: contrato final, banco/seguro, compliance y terminos legales.
- Separacion formal de staging/production y rotacion de secretos.