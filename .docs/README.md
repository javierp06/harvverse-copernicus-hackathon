# Documentación de Harvverse Sentinel

Bienvenido a la documentación oficial del proyecto **Harvverse Sentinel**, plataforma de co-inversión en café para productores de LATAM, desarrollada para el **Hackathon Copernicus**.

Esta documentación está pensada para que cualquier persona — desarrolladores, evaluadores del hackathon, integradores o stakeholders sin contexto previo — pueda entender qué hace el sistema, cómo está construido y cómo ejecutarlo.

---

## ¿Qué es Harvverse Sentinel?

Harvverse Sentinel convierte datos satelitales de Copernicus (Sentinel-2, Sentinel-1, ERA5) en **puntuaciones de riesgo verificables** para lotes de café. Esas puntuaciones alimentan:

- Un **directorio público de fincas** con trazabilidad EUDR
- Un **marketplace de co-inversión** respaldado por contratos inteligentes en Base L2
- **Alertas por WhatsApp** vía eventos Sentinel, n8n y una ruta futura de agente IA

> *Todos monitorean el problema. Nosotros lo financiamos.*

---

## Índice de documentación

| Documento | Descripción | Audiencia |
|-----------|-------------|-----------|
| [01 — Introducción](./01-introduccion.md) | Problema, solución, capas del producto y entregables del hackathon | Todos |
| [02 — Arquitectura](./02-arquitectura.md) | Estructura del monorepo, flujo de datos y decisiones técnicas | Desarrolladores |
| [03 — Inicio rápido](./03-inicio-rapido.md) | Instalación, variables de entorno, demo local y contratos Hardhat | Desarrolladores |
| [04 — Motor Copernicus](./04-motor-copernicus.md) | Scoring 0–100, variables, EUDR, YieldPredict y modos live/fixture | Técnicos / evaluadores |
| [05 — Referencia de API](./05-referencia-api.md) | Procedimientos tRPC, endpoints REST y autenticación | Desarrolladores / integradores |
| [06 — Base de datos](./06-base-de-datos.md) | Esquema PostgreSQL, tablas principales y relaciones | Desarrolladores |
| [07 — Contratos inteligentes](./07-contratos-inteligentes.md) | HarvverseLot, Partnership, elegibilidad on-chain | Blockchain / backend |
| [08 — Flujos de usuario](./08-flujos-de-usuario.md) | Recorridos de agricultor, partner e inversor | Producto / demo |
| [09 — Integraciones](./09-integraciones.md) | Sentinel Hub, eventos WhatsApp/n8n, Clerk y wallets | Integradores |
| [10 — Guía de desarrollo](./10-guia-desarrollo.md) | Convenciones, scripts de verificación y buenas prácticas | Contribuidores |

---

## Documentación interna del hackathon

Material de planificación del equipo (no necesario para ejecutar el proyecto):

- [Hackathon brief](../.docs/sentinel/hackathon-brief.md) — Posicionamiento y entregables
- [Implementation plan](../.docs/sentinel/implementation-plan.md) — Plan de implementación por fases
- [Eventos Sentinel, n8n y WhatsApp](./ai-agent-whatsapp.md) — contrato actual, fixtures y ruta futura de agente IA

---

## Stack tecnológico (resumen)

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| API | tRPC 11, Zod |
| Base de datos | PostgreSQL, Drizzle ORM |
| Autenticación | Clerk (+ soporte Web3) |
| Blockchain | Hardhat (local), Base L2 (producción), Solidity 0.8.24 |
| Satélite | Copernicus Data Space / Sentinel Hub, Open-Meteo (ERA5/DEM) |
| Alertas | `/api/sentinel/alerts`, n8n webhook opcional, WhatsApp/AI SDK planeado |
| Monorepo | Turborepo, pnpm workspaces |

---

## Enlaces rápidos

```bash
# Desarrollo local
pnpm install && pnpm db:start && pnpm db:push && pnpm dev

# Verificar integraciones Copernicus (requiere credenciales)
pnpm verify:sentinel2
pnpm verify:era5
pnpm verify:eudr
```

- App local: [http://localhost:3001](http://localhost:3001)
- Página pública de lote (QR): `/lot/[code]` — ejemplo `/lot/demo-lot-001`
- Directorio de fincas: `/farms`
