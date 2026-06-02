# Validación Fase 1 — Frontend Copernicus

**Fecha:** 2026-06-02
**Estado:** ✅ Aprobada para pasar a Fase 2 (demo / WhatsApp / pulido)

---

## 1. Idiomas (ES + EN)

| Ítem | Resultado |
|------|-----------|
| Locale por defecto | `es` (`apps/web/i18n/request.ts`, cookie `locale`) |
| Cambio de idioma | `LanguageSwitcher` (ES \| EN) con locale activo resaltado |
| Ubicaciones del switch | Navbar público, sidebars farmer/partner, panel QR en `/lot/[code]` |
| Paridad `copernicus.*` | ✅ 0 claves faltantes entre `es.json` y `en.json` |
| Paridad `lot_proof.*` (widgets Copernicus) | ✅ 0 claves faltantes |
| Textos técnicos Copernicus | `lot_proof` + `copernicus`; EUDR labels bilingües en namespace `copernicus` |

**Cómo probar idioma**

1. Abrir cualquier página pública o autenticada.
2. Pulsar **EN** → `router.refresh()` recarga mensajes en inglés.
3. Pulsar **ES** → vuelve a español.
4. En `/lot/HV-HN-ZAF-L02`, el switch está en el panel QR (útil para jueces sin buscar el navbar).

---

## 2. Entregables Fase 1 (checklist diseño)

| Entregable | Estado | Ruta / componente |
|------------|--------|-------------------|
| Página QR pública | ✅ | `(public)/lot/[code]` |
| Sin sidebar Clerk en QR | ✅ | Layout `(public)` |
| QR escaneable + copiar URL | ✅ | `CopernicusQrPanel` + `qrcode.react` |
| Directorio badges score/EUDR | ✅ | `FarmCard`, `farms/[farmId]` |
| LotCard partner + enlace QR | ✅ | `LotCard` variant `partner` |
| Widgets partner (NDVI, Yield, Score, EUDR, Proof) | ✅ | `CopernicusPartnerPanel` en `lots/[lotId]` |
| Tarjeta agricultor elegibilidad | ✅ | `CopernicusFarmerStatusCard` |
| Lib compartida snapshot | ✅ | `lib/copernicus-snapshot.ts` |
| API `publicByCode` statuses ampliados | ✅ | Backend Javier (no bloquea QR tras inversión) |
| WhatsApp demo (CTA opcional) | ✅ | `NEXT_PUBLIC_DEMO_WHATSAPP_NUMBER`; si no existe, el CTA se oculta. |

---

## 3. Validación técnica automática

| Prueba | Resultado |
|--------|-----------|
| Paridad i18n `copernicus` | ✅ Script comparación claves |
| Paridad i18n `lot_proof` | ✅ |
| `pnpm build` (monorepo) — compilación TS | ✅ **TypeScript OK** (~57s) |
| `pnpm build` — collect page data | ⚠️ Requiere `apps/web/.env` con Clerk + `DATABASE_URL` (fallo de entorno en CI local sin `.env`, no de código Fase 1) |
| Linter archivos `components/copernicus/` | ✅ Sin errores reportados |

**Para build completo en tu máquina:**

```bash
cp apps/web/.env.example apps/web/.env
# Completar NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY
pnpm build
```

---

## 4. Validación manual recomendada (antes del pitch)

Con `pnpm db:start`, `pnpm db:push`, seed/demo y `pnpm dev:web`:

| # | Paso | Esperado |
|---|------|----------|
| 1 | `/lot/HV-HN-ZAF-L02` sin login | Página carga; mapa + score o “pendiente” |
| 2 | Cambiar EN en panel QR | Títulos y métricas en inglés |
| 3 | `/farms` | Cards con badges score/EUDR si hay snapshot en BD |
| 4 | `/farms/<id>` | Lista de lotes con enlace “Ver prueba” |
| 5 | Partner: `/lots/<id>` | Grid Copernicus (NDVI chart, 7 variables, proof) |
| 6 | Farmer: lote demo | Tarjeta elegible / bloqueado / pendiente |
| 7 | Lote `reserved` o `active` | QR sigue abriendo (Javier) |

---

## 5. Fase 2 — Siguiente trabajo sugerido

1. **Runbook WhatsApp** (`.docs/sentinel/whatsapp-demo-runbook.md`) + endpoints Sentinel Agent y worker WhatsApp.
2. **Ensayo demo** con lote `HV-HN-ZAF-L02`: `computeCopernicusSnapshot` → opcional `markLocalCopernicusProof`.
3. **Pulido opcional:** widgets Copernicus en home partner (`dashboard/player`) si lo quieren en el pitch.
4. **Configurar número WhatsApp** cuando llegue el definitivo (`NEXT_PUBLIC_DEMO_WHATSAPP_NUMBER`).

---

## 6. Conclusión

**Fase 1 frontend Copernicus: validada.** Bilingüe ES/EN operativo; código compila; entregables del diseño implementados. Se puede avanzar a integración demo en vivo, documentación WhatsApp y ensayo del flujo QR para jueces.
