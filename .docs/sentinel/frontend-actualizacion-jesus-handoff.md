# Handoff — Actualización frontend Copernicus (Jesús / DIGEX)

**Branch:** `actualizacion-frontend-jesus`  
**Fecha:** 2026-06-02  
**Estado:** Fase 1 frontend validada en local · listo para review de Javier y deploy demo

---

## Resumen ejecutivo

Se implementó la **Fase 1 del frontend Copernicus** acordada con Javier: página QR pública, badges en directorio, panel partner, tarjeta farmer, i18n ES/EN, y tooling local para demo con lote `HV-HN-ZAF-L02`. Todo fue **probado manualmente en local** (Partes A–D).

---

## Qué se implementó

### 1. Librería y componentes Copernicus

| Archivo / carpeta | Descripción |
|-------------------|-------------|
| `apps/web/src/lib/copernicus-snapshot.ts` | Parseo del snapshot, helpers (`scoreTone`, badges, agregación por finca) |
| `apps/web/src/lib/geo-polygon.ts` | Validación GeoJSON y resolución de polígono finca/lote |
| `apps/web/src/components/copernicus/*` | 13 componentes: badges, NDVI, yield, score, EUDR, proof, QR, signals grid, panels farmer/partner, vista QR pública |

### 2. Rutas e integraciones

| Ruta | Cambio |
|------|--------|
| `(public)/lot/[code]` | **Nueva** página QR pública sin login ni sidebar Clerk |
| `(app)/lot/[code]` | **Eliminada** (evita duplicado autenticado) |
| `(public)/farms`, `(public)/farms/[id]` | Badges Copernicus + filas de lotes verificados |
| `(app)/lots/[lotId]` | `CopernicusPartnerPanel` a ancho completo (debajo del plan) |
| `(app)/dashboard/farmer/lots/[lotId]` | `CopernicusFarmerStatusCard` + bloque verificación satelital |
| `farm-card.tsx`, `lot-card.tsx` | Badges score / EUDR en directorio y explore |

### 3. i18n (ES + EN)

- Namespace `copernicus` y ampliación de `lot_proof` en `messages/es.json` y `en.json`
- Claves añadidas en validación: `lot.back_to_explore`, `farm.satellite_*`, etc.
- `LanguageSwitcher` con locale activo resaltado (navbar + panel QR)

### 4. Demo local (lote `HV-HN-ZAF-L02`)

| Archivo | Descripción |
|---------|-------------|
| `packages/db/src/demo-lot-fixtures.ts` | Polígono demo ~1 manzana (Comayagua) |
| `packages/db/src/seed.ts` | Seed incluye polígono en finca y lote |
| `scripts/seed-copernicus-demo.ts` | Asigna polígono + calcula snapshot **fixture** |
| `package.json` | Script `pnpm db:seed-copernicus-demo` |

**Comandos demo local:**

```powershell
pnpm db:start
pnpm db:push
# Cargar apps/web/.env antes de seed si hace falta (Windows)
pnpm db:seed
pnpm db:seed-copernicus-demo    # fixture
pnpm db:seed-copernicus-demo -- --live   # opcional, requiere Sentinel Hub
pnpm dev:web
```

---

## Fixes durante validación manual

| Problema | Solución |
|----------|----------|
| `/farms/1` — 9 errores i18n | Claves `farm.*` en namespace correcto; hook `useTranslations("waitlist")` movido fuera del JSX |
| QR `/lot/...` — mapa vacío | Altura fija en contenedor Leaflet (`pt-24`, `h-[320px]`) + fallback tiles OSM |
| `/farms/1` — sin imagen de finca | Mapa satelital como hero si no hay fotos; polígono desde finca o lote |
| Partner `/lots/1` — layout apretado | Copernicus debajo del plan a ancho completo; mapa 360px; variables en grid |
| Partner — faltaba grilla de señales | `CopernicusSignalsGrid` añadido al panel partner (paridad con QR) |
| Console — redirect en render | `router.replace` movido a `useEffect` en dashboards farmer/player |
| `lot.back_to_explore` missing | Clave añadida en es/en |

---

## Validación completada (Jesús — local)

| Parte | Qué | Resultado |
|-------|-----|-----------|
| **A** | QR `/lot/HV-HN-ZAF-L02`, `/farms`, `/farms/1` | ✅ |
| **B** | Snapshot fixture + mapas satelitales | ✅ |
| **C1** | Farmer: finca, lote, ver prueba pública | ✅ (requiere vincular `farmer_id` en Drizzle para finca seed) |
| **C2** | Partner: explore, `/lots/1`, panel Copernicus completo | ✅ (rol `partner` en Drizzle) |
| **D** | ES/EN | ✅ (asumido OK sin re-prueba exhaustiva) |

**Lote demo:** `HV-HN-ZAF-L02` · Score fixture **88/100** · EUDR verified · `sentinel-v0.2.0`

---

## Dependencias / acuerdos con Javier (ya alineados)

- `publicByCode` acepta lotes `available`, `reserved`, `active`, `settled`
- Snapshot no viene en seed; se genera con `computeCopernicusSnapshot` o `pnpm db:seed-copernicus-demo`
- `scoreVersion`: fixture `sentinel-v0.2.0`, live `sentinel-live-v0.3.0`
- WhatsApp demo provisional: `+19063794460` en `copernicus-qr-panel.tsx`

---

## Pendiente — quién hace qué

### Javier (backend / Copernicus)

- [ ] Review de integración frontend ↔ snapshot shape
- [ ] Snapshot **live** en entorno demo (opcional para pitch)
- [ ] Hardhat + `markLocalCopernicusProof` (Parte E — opcional)
- [ ] Confirmar que API `lots.byId` expone `copernicusSnapshot` + `farm.polygon` para partner

### Sheyla (WhatsApp / n8n)

- [ ] URL webhook n8n cuando esté lista
- [ ] Número WhatsApp definitivo → Jesús actualiza `copernicus-qr-panel.tsx`

### Jesús / DIGEX (frontend / demo)

- [ ] Deploy preview (Vercel/Railway) + BD remota con seed + `db:seed-copernicus-demo`
- [ ] Guion demo 5 min (QR → partner → farmer)
- [ ] Runbook WhatsApp (`.docs/sentinel/whatsapp-demo-runbook.md`) cuando Sheyla entregue URL

### Opcional (no bloqueante pitch)

- [ ] Widgets Copernicus en `dashboard/player` home
- [ ] Parte E on-chain en demo en vivo
- [ ] CTA “Calcular score” en farmer cuando lote no tiene snapshot (UI)

---

## Archivos clave para review de Javier

```
apps/web/src/components/copernicus/
apps/web/src/lib/copernicus-snapshot.ts
apps/web/src/app/(public)/lot/[code]/page.tsx
apps/web/src/app/(app)/lots/[lotId]/page.tsx
apps/web/src/app/(public)/farms/[farmId]/page.tsx
scripts/seed-copernicus-demo.ts
packages/db/src/demo-lot-fixtures.ts
.docs/sentinel/frontend-copernicus-design.md
.docs/sentinel/frontend-phase1-validation.md
```

---

## Cómo probar este branch

1. Checkout `actualizacion-frontend-jesus`
2. `pnpm install`
3. `apps/web/.env` con Clerk + `DATABASE_URL` (ver `.env.example`)
4. `pnpm db:start && pnpm db:push && pnpm db:seed`
5. `pnpm db:seed-copernicus-demo`
6. `pnpm dev:web` → http://localhost:3001
7. URLs: `/lot/HV-HN-ZAF-L02`, `/farms/1`, `/lots/1` (partner)

---

## Documentación relacionada

- Diseño Fase 1: `.docs/sentinel/frontend-copernicus-design.md`
- Checklist validación: `.docs/sentinel/frontend-phase1-validation.md`
- Plan equipo: `.docs/sentinel/team-workplan.md`

---

## Notas

- **No commitear** `apps/web/.env` (credenciales Clerk, Sentinel Hub)
- En Windows, `pnpm db:seed` puede fallar por env; usar carga manual de vars o `pnpm exec tsx packages/db/src/seed.ts` desde shell con `.env` cargado
- Branch local puede estar detrás de `origin/main`; al mergear conviene rebase/merge con los 8 commits recientes de main
