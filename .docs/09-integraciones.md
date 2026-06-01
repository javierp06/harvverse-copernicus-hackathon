# 09 — Integraciones

Harvverse Sentinel se conecta con servicios externos para datos satelitales, autenticación, mensajería y blockchain.

---

## Copernicus / Sentinel Hub

### Propósito

Obtener imágenes y estadísticas de Sentinel-2 y Sentinel-1 para el motor de scoring live.

### Configuración

```bash
SENTINEL_HUB_CLIENT_ID=tu_client_id
SENTINEL_HUB_CLIENT_SECRET=tu_client_secret
```

Obtener credenciales en [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/).

### Implementación

| Archivo | Función |
|---------|---------|
| `packages/api/src/lib/copernicus/sentinel-hub.ts` | OAuth2 client credentials → token |
| `sentinel-2.ts` | Statistics API para NDVI, NDRE, NDWI, MSI |
| `sentinel-1.ts` | GRD IW VV/VH quarterly backscatter |

### Flujo OAuth

```typescript
const credentials = getSentinelHubCredentials(env);
const token = await getSentinelHubToken(credentials);
// Token usado en fetchSentinel2NdviMonths({ token, polygon, ... })
```

Sin credenciales, el sistema opera en modo **fixture** automáticamente.

### Datasets usados

| Dataset | Resolución | Uso |
|---------|------------|-----|
| `sentinel-2-l2a` | 10m | NDVI, NDRE, NDWI, MSI, EUDR screen |
| `sentinel-1-grd` | 10m (IW) | VV, VH, RVI, humedad proxy |

---

## ERA5 (clima)

### Propósito

Lluvia anual, temperatura media y distribución estacional para scoring climático.

### Implementación actual

**Open-Meteo Archive API** — proxy de ERA5 reanalysis (no requiere `CDS_API_KEY` hoy).

| Archivo | Función |
|---------|---------|
| `packages/api/src/lib/copernicus/era5.ts` | `fetchEra5ClimateMonths()`, `summarizeEra5ClimateMonths()` |

### Reservado

`CDS_API_KEY` en `.env` está reservado para integración directa con Copernicus Climate Data Store en el futuro.

---

## DEM (modelo de elevación)

### Propósito

Altitud del centroid del polígono para scoring de idoneidad del terreno.

### Implementación actual

**Open-Meteo elevation endpoint** con Copernicus DEM GLO-90.

| Archivo | Función |
|---------|---------|
| `packages/api/src/lib/copernicus/dem.ts` | `fetchCopernicusDemElevation()`, `summarizeCopernicusDem()` |

También expuesto como `lots.detectAltitude` para autocompletar altitud al dibujar polígono.

---

## Clerk (autenticación)

### Propósito

Sign-in/sign-up, gestión de sesiones, soporte Web3 wallet.

### Configuración

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Rutas

| Ruta | Componente |
|------|------------|
| `/sign-in/[[...sign-in]]` | Clerk SignIn |
| `/sign-up/[[...sign-up]]` | Clerk SignUp |
| `/onboarding` | Selección de rol + upsert DB |

### Integración tRPC

El route handler `/api/trpc/[trpc]/route.ts` extrae `auth()` de Clerk y pasa `clerkId` al contexto.

### Web3

Habilitar **Web3 / Ethereum** en el dashboard de Clerk para vincular wallets. El frontend usa wagmi/viem para interacción con contratos.

---

## Eventos Sentinel + WhatsApp

### Propósito

Enviar alertas automáticas a agricultores y partners cuando ocurren eventos Sentinel (score listo, EUDR bloqueado, prueba blockchain).

### Arquitectura

```
Evento Copernicus          Endpoint Harvverse           n8n / WhatsApp
     │                           │                          │
     │ POST /api/sentinel/alerts │                          │
     ├──────────────────────────►│ valida + normaliza       │
     │                           ├─────────────────────────►│
     │                           │ N8N_WEBHOOK_URL          │
```

### Configuración

```bash
N8N_WEBHOOK_URL=https://...
```

El endpoint funciona sin `N8N_WEBHOOK_URL`: valida el payload y retorna el evento normalizado para pruebas locales. La integración directa con Vercel AI SDK y Meta Cloud API está documentada como ruta futura, no como comportamiento actual del código.

### Documentación detallada

Ver [ai-agent-whatsapp.md](./ai-agent-whatsapp.md) — incluye:

- Formato de payload JSON (eventos Sentinel)
- Fixtures de prueba en `fixtures/n8n/`
- Comandos curl para testing local
- Ruta futura para AI SDK / WhatsApp directo

### Eventos principales

| Evento | Destinatario típico | Mensaje |
|--------|---------------------|---------|
| `copernicus.snapshot.created` | Farmer | Score + URL pública |
| `eudr.non_compliant` | Farmer + team | Bloqueo EUDR |
| `local_proof.verified` | Partner | Prueba blockchain lista |
| `yield_predict.ready` | Partner | Proyección de cosecha |

### Fallback demo

Si WhatsApp o n8n no están configurados, el endpoint retorna el evento normalizado en JSON. La prueba QR + blockchain sigue siendo el fallback visible para jueces.

---

## Hardhat / Base L2 (blockchain)

### Demo local

| Componente | Valor |
|------------|-------|
| Chain ID | 31337 |
| RPC | `http://127.0.0.1:8545` |
| Wallet demo | Hardhat account #0 |

```bash
# Terminal 1
pnpm --filter @harvverse-copernicus-hackathon/contracts node

# Terminal 2
pnpm --filter @harvverse-copernicus-hackathon/contracts setup:demo
```

### Producción

| Parámetro | Valor |
|-----------|-------|
| Chain | Base Sepolia / Base Mainnet |
| chainKey en DB | `baseSepolia` |
| USDC | USDC real en Base |

Direcciones de contratos se registran en `contract_deployments`.

---

## Mapas (Leaflet)

### Propósito

Visualización de polígonos de fincas y lotes.

### Stack

- **Leaflet** + **react-leaflet** en el frontend
- **@turf/area** para calcular área del polígono
- **@tmcw/togeojson** para importar KML

Componentes:

| Componente | Uso |
|------------|-----|
| `polygon-display-map.tsx` | Mapa de solo lectura (página QR) |
| Componentes de creación de finca/lote | Dibujo e importación de polígonos |

Los mapas se cargan con `dynamic(..., { ssr: false })` porque Leaflet no soporta SSR.

---

## IoT / Sensores (futuro)

Tablas `modules` y `sensor_data` modelan lecturas semanales de:

- Temperatura ambiente
- Humedad ambiente
- Humedad de suelo

Integración con hardware Harvverse pendiente; los datos pueden alimentar evidencia de milestones.

---

## Resumen de variables de entorno por integración

| Variable | Integración | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL | Sí |
| `CLERK_SECRET_KEY` | Clerk | Sí |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Sí |
| `SENTINEL_HUB_CLIENT_ID/SECRET` | Copernicus live | No (fixture fallback) |
| `N8N_WEBHOOK_URL` | Relay n8n/WhatsApp | No |
| `OPENAI_API_KEY` | Agente AI SDK futuro | No |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` | WhatsApp Meta API | No |
| `CDS_API_KEY` | ERA5 directo | No (Open-Meteo hoy) |
| `HARVVERSE_LOT_ADDRESS` | Contrato on-chain | No (setup:demo lo escribe) |
| `NEXT_PUBLIC_USDC_ADDRESS` | MockUSDC | No (setup:demo) |
| `NEXT_PUBLIC_PARTNERSHIP_ADDRESS` | Partnership | No (setup:demo) |
