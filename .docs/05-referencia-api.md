# 05 — Referencia de API

Harvverse Sentinel expone su lógica de negocio principalmente vía **tRPC** en `/api/trpc`. También hay un endpoint REST para eventos Sentinel que valida payloads y puede reenviarlos a n8n/WhatsApp.

---

## tRPC

### Configuración

- **Endpoint:** `POST /api/trpc/[procedure]`
- **Cliente:** `@trpc/client` + TanStack Query en el frontend
- **Contexto:** `{ clerkId, db }` — ver `packages/api/src/context.ts`

### Tipos de procedimientos

| Tipo | Autenticación | Uso |
|------|---------------|-----|
| `publicProcedure` | Ninguna | Listados públicos, health check |
| `protectedProcedure` | Requiere `clerkId` de Clerk | CRUD, scoring, inversiones |

### Router raíz

Definido en `packages/api/src/routers/index.ts`:

```typescript
appRouter = {
  healthCheck,
  users,
  farms,
  lots,
  plans,
  proposals,
  partnerships,
  evidence,
  settlements,
  waitlist,
}
```

---

## `healthCheck`

| | |
|---|---|
| **Tipo** | `query` (público) |
| **Retorno** | `"OK"` |

---

## `users`

### `users.me`

| | |
|---|---|
| **Tipo** | `query` (protegido) |
| **Retorno** | Usuario actual o `null` |

### `users.upsert`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | `{ displayName, email?, walletAddress?, phone?, country? }` |
| **Efecto** | Crea o actualiza usuario vinculado a `clerkId`. Rol default: `farmer` |

### `users.updateStatus`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Permiso** | Solo `admin` o `settlement_operator` |
| **Input** | `{ id, status: "active" \| "disabled" }` |

---

## `farms`

### `farms.list`

| | |
|---|---|
| **Tipo** | `query` (público) |
| **Retorno** | Fincas con imagen primaria |

### `farms.byId`

| | |
|---|---|
| **Tipo** | `query` (público/protegido según visibilidad) |
| **Input** | `{ id: number }` |

### `farms.myFarms`

| | |
|---|---|
| **Tipo** | `query` (protegido) |
| **Retorno** | Fincas del agricultor autenticado |

### `farms.create`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | Datos de finca + polígono opcional |
| **Permiso** | Usuario autenticado (se asigna como `farmerId`) |

### `farms.update`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Permiso** | Solo el dueño de la finca |

### `farms.uploadImage`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | `{ farmId, data (base64), mimeType, filename, isPrimary? }` |
| **Límite** | 5 MB, máx. 10 imágenes por finca |

---

## `lots` ⭐ (Copernicus)

### `lots.list`

| | |
|---|---|
| **Tipo** | `query` (público) |
| **Input** | `{ status?, country?, region? }` — default status: `"available"` |

### `lots.byId`

| | |
|---|---|
| **Tipo** | `query` (protegido) |
| **Input** | `{ id: number }` |
| **Retorno** | Lote + finca + planes + último `copernicusSnapshot` |
| **Permiso** | Dueño, partner con propuesta/partnership, o lote `available` |

### `lots.byFarmId`

| | |
|---|---|
| **Tipo** | `query` (protegido) |
| **Permiso** | Solo dueño de la finca |

### `lots.byCode` / `lots.publicByCode`

| | |
|---|---|
| **Tipo** | `query` (público) |
| **Input** | `{ code: string }` |
| **Retorno** | Lote disponible + snapshot Copernicus (solo `publicByCode`) |

Usado por la página QR `/lot/[code]`.

### `lots.copernicusSnapshot`

| | |
|---|---|
| **Tipo** | `query` (público) |
| **Input** | `{ lotId: number }` |
| **Retorno** | `{ lot, snapshot }` |

### `lots.computeCopernicusSnapshot` ⭐

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | `{ lotId: number, sourceMode?: "fixture" \| "live" }` |
| **Permiso** | Dueño del lote o `admin` |
| **Efecto** | Calcula, firma, persiste snapshot y actualiza resumen en `lots` |

### `lots.markLocalCopernicusProof`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | `{ lotId: number }` |
| **Permiso** | Dueño o `admin` |
| **Efecto** | Ejecuta script Hardhat, escribe score on-chain, actualiza `snapshot.chain` |
| **Requisito** | Snapshot previo + `NODE_ENV=development` |

### `lots.detectAltitude`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | `{ lat: number, lng: number }` |
| **Retorno** | `{ altitudeMeters, provider }` — DEM GLO-90 vía Open-Meteo |

### `lots.create`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Input** | Datos del lote + polígono + plan opcional |
| **Efecto** | Crea lote; si tiene polígono, dispara scoring automático en background |

### `lots.update` / `lots.updateStatus`

| | |
|---|---|
| **Tipo** | `mutation` (protegido) |
| **Permiso** | Solo dueño |
| **Nota** | Campos de marketing bloqueados si status ≠ `draft`/`available` |

---

## `plans`

Gestiona planes de inversión agronómicos vinculados a lotes.

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `plans.byLotId` | query | Planes de un lote |
| `plans.byCode` | query | Plan por `planCode` |

---

## `proposals`

Propuestas de co-inversión de partners.

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `proposals.create` | mutation | Partner crea propuesta con ticket, splits, hash |
| `proposals.byId` | query | Detalle de propuesta |
| `proposals.myProposals` | query | Propuestas del usuario autenticado |
| `proposals.byLotId` | query | Propuestas de un lote (farmer) |

Estados: `pending` → `submitted` → `signed` → `expired` / `failed`

---

## `partnerships`

Acuerdos activos entre partner y lote.

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `partnerships.byId` | query | Detalle con lot, plan, evidence |
| `partnerships.myPartnerships` | query | Partnerships del partner autenticado |
| `partnerships.byLotId` | query | Partnerships de un lote |

Estados: `active` → `milestones_attested` → `awaiting_settlement` → `settled` / `cancelled`

---

## `evidence`

Registros de evidencia agronómica (fotos, sensores, cosecha).

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `evidence.create` | mutation | Registrar evidencia de milestone |
| `evidence.byPartnershipId` | query | Evidencias de un partnership |

Tipos: `photo`, `sensor_snapshot`, `receipt`, `agronomist_review`, `harvest_result`, `demo_fixture`

---

## `settlements`

Liquidación de cosecha y reparto de ingresos.

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `settlements.create` | mutation | Crear intent de settlement |
| `settlements.byPartnershipId` | query | Settlements de un partnership |

---

## `waitlist`

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `waitlist.create` | mutation (público) | Registro en lista de espera landing |

---

## REST: `/api/sentinel/alerts`

Endpoint de **eventos Sentinel** para WhatsApp/demo. Valida y normaliza el payload; si `N8N_WEBHOOK_URL` está configurado, reenvía el evento normalizado al webhook de n8n. **No requiere autenticación** (uso interno/demo). La arquitectura base para conectar los eventos satelitales con flujos de mensajería ya está preparada desde el lado del backend.

*   **Estructura de Webhooks:** El backend está diseñado para poder emitir payloads deterministas con el JSON completo del `CopernicusLotSnapshot` cada vez que ocurre un evento relevante (ej. un nuevo cálculo, un cambio de estado).
*   **Datos disponibles para n8n:** Sheyla tiene a su disposición todas las variables calculadas (Riesgo, Quintales Proyectados, Lluvia, Temperatura, NDVI, Alertas EUDR) para armar los *prompts* que alimentarán a la IA (Anthropic) y generar los mensajes naturales de WhatsApp.

### Estrategia de Alertas Definida (Para Demo / POC)

Para la demostración del Hackathon (Proof of Concept), hemos decidido implementar un enfoque basado en eventos (On-Demand) para garantizar una ejecución sin fallos en vivo. Se han seleccionado las siguientes **3 alertas de alto impacto** para integrar con n8n/WhatsApp:

1.  **Alertas de Negocio (Lote Aprobado o Bloqueado por EUDR):**
    *   *Gatillo:* El usuario presiona "Actualizar análisis en vivo".
    *   *Acción:* Envía webhook a n8n indicando el resultado final del análisis. Si es exitoso, envía el Score y YieldPredict. Si falla la ley EUDR, envía la alerta de bloqueo.
2.  **Alerta de Estrés Hídrico (Sequía):**
    *   *Gatillo:* Botón de simulación manual en el dashboard. Lee el estado actual del lote. Si el modelo ERA5 indica `era5.waterStress === "high"`.
    *   *Acción:* Envía webhook a n8n advirtiendo al agricultor sobre condiciones de sequía prolongada y altas temperaturas.
3.  **Alerta de Roya / Enfermedad Fúngica (Exceso de Lluvia):**
    *   *Gatillo:* Botón de simulación manual en el dashboard. Si el modelo ERA5 detecta precipitaciones muy por encima del límite óptimo (`era5.annualRainfallMm > 3000`).
    *   *Acción:* Envía webhook a n8n advirtiendo al agricultor sobre el alto riesgo de hongos y sugiriendo medidas preventivas.

### `GET /api/sentinel/alerts`

Retorna contrato del endpoint (tipos de evento aceptados, versión).

### `POST /api/sentinel/alerts`

Valida y normaliza un evento Sentinel. En el estado actual del código, retorna el evento normalizado y opcionalmente lo reenvía a `N8N_WEBHOOK_URL`. La generación directa con AI SDK/Meta API queda como ruta futura.

**Eventos principales:**

| Evento | Cuándo |
|--------|--------|
| `copernicus.snapshot.created` | Snapshot calculado |
| `risk_score.ready` | Score listo |
| `yield_predict.ready` | Proyección calculada |
| `eudr.non_compliant` | Lote bloqueado EUDR |
| `local_proof.verified` | Prueba on-chain escrita |

**Aliases legacy:** `score.calculated`, `eudr.blocked`, `ndvi.drop_detected`, `partner.snapshot_ready`

Ver [ai-agent-whatsapp.md](./ai-agent-whatsapp.md) y fixtures en `fixtures/n8n/`.

---

## Códigos de error tRPC comunes

| Código | Significado |
|--------|-------------|
| `UNAUTHORIZED` | Sin sesión Clerk |
| `FORBIDDEN` | Sin permiso para el recurso |
| `NOT_FOUND` | Recurso inexistente o no visible |
| `BAD_REQUEST` | Input inválido o scoring fallido |
| `CONFLICT` | Código de lote duplicado |

---

## Uso desde el frontend

```typescript
import { trpc } from "@/utils/trpc";

// Query
const { data } = trpc.lots.publicByCode.useQuery({ code: "demo-lot" });

// Mutation
const compute = trpc.lots.computeCopernicusSnapshot.useMutation();
await compute.mutateAsync({ lotId: 1, sourceMode: "fixture" });
```

El cliente tRPC está configurado en `apps/web/src/utils/trpc.ts` con TanStack Query.
