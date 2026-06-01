# 10 — Guía de desarrollo

Convenciones, scripts y buenas prácticas para contribuir al proyecto.

---

## Entorno de desarrollo

```bash
pnpm install
pnpm db:start && pnpm db:push
pnpm dev:web
```

Verificar tipos antes de commit:

```bash
pnpm check-types
```

---

## Convenciones de código

### TypeScript

- Strict mode habilitado vía `@harvverse-copernicus-hackathon/config`
- Validación de inputs con **Zod** en todos los procedimientos tRPC
- Tipos de DB inferidos de Drizzle — no duplicar manualmente

### Estilo

- Seguir el estilo existente del archivo que editas
- Componentes UI compartidos en `packages/ui`, no en `apps/web`
- Lógica de negocio en `packages/api`, no en componentes React
- Cambios mínimos y enfocados — no refactorizar código no relacionado

### Imports

```typescript
// UI compartida
import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";

// DB
import { lots } from "@harvverse-copernicus-hackathon/db/schema";

// Env
import { env } from "@harvverse-copernicus-hackathon/env/server";
```

### Nombres

| Concepto | Convención | Ejemplo |
|----------|------------|---------|
| Tablas DB | snake_case plural | `copernicus_snapshots` |
| Routers tRPC | camelCase singular | `lotsRouter` |
| Procedimientos | camelCase verbo | `computeCopernicusSnapshot` |
| Componentes React | PascalCase | `LotCard` |
| Archivos de página | kebab-case dirs | `create-lot/page.tsx` |

---

## Agregar un procedimiento tRPC

1. Crear o editar router en `packages/api/src/routers/`
2. Usar `protectedProcedure` o `publicProcedure`
3. Validar input con Zod
4. Verificar permisos (ownership, role)
5. Registrar en `packages/api/src/routers/index.ts` si es router nuevo
6. Consumir desde frontend con `trpc.routerName.procedureName`

---

## Agregar una tabla DB

1. Definir tabla en `packages/db/src/schema/index.ts`
2. Agregar relations si aplica
3. Exportar tipos insert/select con drizzle-zod
4. Generar migración: `pnpm db:generate`
5. Aplicar: `pnpm db:migrate` (o `db:push` en dev rápido)

---

## Agregar componente UI compartido

```bash
npx shadcn@latest add dialog table -c packages/ui
```

Configuración shadcn en `packages/ui/components.json`.

---

## Scripts de verificación Copernicus

Ubicados en `scripts/` en la raíz del monorepo:

| Script | Comando | Qué hace |
|--------|---------|----------|
| `verify-sentinel-2-live.ts` | `pnpm verify:sentinel2` | Prueba NDVI contra polígono real |
| `verify-sentinel-1-live.ts` | `pnpm verify:sentinel1` | Prueba SAR |
| `verify-era5-live.ts` | `pnpm verify:era5` | Prueba clima |
| `verify-eudr-gate.ts` | `pnpm verify:eudr` | Prueba gate EUDR |
| `verify-dem-live.ts` | `pnpm verify:dem` | Prueba altitud DEM |
| `verify-copernicus-live.ts` | `pnpm verify:copernicus-live` | Pipeline completo |
| `build-copernicus-chain-proof.ts` | `pnpm verify:copernicus-chain-proof` | Construye proof off-chain |

Requieren credenciales Sentinel Hub en `.env` (excepto dem/chain-proof parcial).

---

## Tests de contratos

```bash
pnpm --filter @harvverse-copernicus-hackathon/contracts test
pnpm --filter @harvverse-copernicus-hackathon/contracts compile
```

Tests en `packages/contracts/test/Harvverse.test.ts`.

---

## Fixtures

| Directorio | Contenido |
|------------|-----------|
| `fixtures/n8n/` | Payloads JSON para probar eventos Sentinel / agente WhatsApp |
| `.docs/sentinel/sample-copernicus-snapshot.json` | Snapshot Copernicus de referencia |

---

## i18n

Mensajes en:

- `apps/web/messages/es.json` (default)
- `apps/web/messages/en.json`

Usar `useTranslations()` de next-intl en componentes client. Agregar keys en ambos archivos.

---

## Turborepo

`turbo.json` define tareas con dependencias:

- `build` depende de `^build` (paquetes upstream primero)
- `dev` es persistente y sin cache
- `db:*` sin cache

Ejecutar tarea en un solo paquete:

```bash
pnpm --filter web dev
pnpm --filter @harvverse-copernicus-hackathon/db db:studio
```

---

## Debugging común

### Scoring no se ejecuta al crear lote

- Verificar que el lote tiene `polygon` no null
- Revisar logs: `[lots.create] automatic Copernicus analysis failed`
- Sin credenciales Sentinel Hub → usa fixture silenciosamente

### tRPC UNAUTHORIZED

- Verificar sesión Clerk activa
- Verificar `CLERK_SECRET_KEY` en `.env`

### Hardhat proof falla

- Nodo Hardhat debe estar corriendo en otra terminal
- Solo funciona con `NODE_ENV=development`
- Debe existir snapshot previo (`computeCopernicusSnapshot`)

### Mapa no renderiza

- Leaflet requiere `ssr: false` en dynamic import
- Verificar que el polígono es GeoJSON válido

---

## Estructura de commits (sugerida)

```
feat(copernicus): add live ERA5 aggregation
fix(lots): prevent duplicate lot codes
docs: update scoring variable weights
chore(db): add migration for sensor_data index
```

---

## Checklist pre-demo

- [ ] `pnpm db:start && pnpm db:push`
- [ ] Clerk keys configuradas
- [ ] Al menos un lote con polígono y snapshot calculado
- [ ] Página `/lot/[code]` accesible sin login
- [ ] (Opcional) Hardhat node + setup:demo para inversión
- [ ] (Opcional) Sentinel Hub credentials para live scoring
- [ ] (Opcional) `OPENAI_API_KEY` + credenciales WhatsApp para agente AI SDK
- [ ] Scripts verify:* pasan con credenciales

---

## Recursos internos del hackathon

| Documento | Ubicación |
|-----------|-----------|
| Hackathon brief | `.docs/sentinel/hackathon-brief.md` |
| Implementation plan | `.docs/sentinel/implementation-plan.md` |
| Team workplan | `.docs/sentinel/team-workplan.md` |
| Start handoff | `.docs/sentinel/start-handoff.md` |
| Sample snapshot | `.docs/sentinel/sample-copernicus-snapshot.json` |

---

## Stack de referencia

Proyecto creado con [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack):

- Next.js + tRPC + Drizzle + PostgreSQL + Turborepo + shadcn/ui

La documentación pública del proyecto está en [`docs/`](./README.md).
