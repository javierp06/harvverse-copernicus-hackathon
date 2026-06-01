# 03 — Inicio rápido

Esta guía permite levantar el proyecto desde cero en una máquina de desarrollo local.

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|----------------|-------|
| Node.js | 20+ | LTS recomendado |
| pnpm | 10.x | Definido en `packageManager` del root |
| Docker | Cualquier reciente | Para PostgreSQL local |
| Git | — | Clonar el repositorio |

Opcional para demo blockchain:

- Terminal adicional para nodo Hardhat local

Opcional para scoring live:

- Cuenta en [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/) con credenciales Sentinel Hub

---

## 1. Clonar e instalar

```bash
git clone <url-del-repositorio>
cd copernicus
pnpm install
```

---

## 2. Configurar variables de entorno

Crea el archivo `apps/web/.env`:

```bash
# Obligatorias
DATABASE_URL=postgresql://postgres:password@localhost:5432/harvverse-copernicus-hackathon
CORS_ORIGIN=http://localhost:3001

# Clerk — crear proyecto en https://clerk.com/dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Contratos Hardhat locales (demo)
NEXT_PUBLIC_USE_LOCAL_CONTRACTS=true
NEXT_PUBLIC_HARDHAT_CHAIN_ID=31337
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_PARTNERSHIP_ADDRESS=

# Copernicus live (opcional — sin ellas se usa modo fixture)
SENTINEL_HUB_CLIENT_ID=
SENTINEL_HUB_CLIENT_SECRET=

# ERA5 directo vía CDS (reservado, no requerido hoy)
CDS_API_KEY=

# Eventos WhatsApp — n8n actual / AI SDK futuro (opcional)
OPENAI_API_KEY=
N8N_WEBHOOK_URL=
# WHATSAPP_PHONE_NUMBER_ID=
# WHATSAPP_ACCESS_TOKEN=
```

### Credenciales de prueba Clerk

Para desarrollo local con proyecto Clerk de test:

- Email: cualquier email con subaddress `+clerk_test`, p. ej. `tu@email+clerk_test@example.com`
- Código de verificación: `424242`
- Teléfono de prueba: `+15555550100` a `+15555550199`

Clerk no envía emails/SMS reales para estos valores de prueba.

---

## 3. Base de datos

```bash
# Iniciar contenedor PostgreSQL
pnpm db:start

# Aplicar esquema Drizzle
pnpm db:push

# (Opcional) Abrir Drizzle Studio
pnpm db:studio
```

### Comandos de base de datos

| Comando | Uso |
|---------|-----|
| `pnpm db:start` | Levanta Postgres con Docker Compose |
| `pnpm db:push` | Sincroniza esquema directamente (desarrollo rápido) |
| `pnpm db:generate` | Genera archivos SQL de migración |
| `pnpm db:migrate` | Aplica migraciones commitadas |
| `pnpm db:studio` | UI visual de la base de datos |
| `pnpm db:seed` | Datos de seed opcionales |
| `pnpm db:stop` | Detiene el contenedor |
| `pnpm db:down` | Elimina contenedor y volúmenes |

**Flujo recomendado para desarrollo:**

```bash
pnpm db:start && pnpm db:push && pnpm dev
```

**Flujo para cambios de esquema duraderos:**

```bash
pnpm db:generate && pnpm db:migrate
```

---

## 4. Ejecutar la aplicación

```bash
pnpm dev
# o solo la web:
pnpm dev:web
```

Abre [http://localhost:3001](http://localhost:3001).

---

## 5. Demo con contratos Hardhat (opcional)

Para demostrar inversión on-chain con USDC mock:

**Terminal 1 — nodo Hardhat:**

```bash
pnpm --filter @harvverse-copernicus-hackathon/contracts node
```

**Terminal 2 — deploy y seed:**

```bash
pnpm --filter @harvverse-copernicus-hackathon/contracts setup:demo
```

Este script:

1. Despliega `MockUSDC`, `HarvverseLot`, `HarvverseEvidence`, `HarvversePartnership`
2. Escribe las direcciones en `apps/web/.env`
3. Siembra la DB con finca, lote, plan y cuenta partner demo

### Wallet demo Hardhat (cuenta #0)

| Campo | Valor |
|-------|-------|
| Address | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Private key | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |

> **Nunca uses estas claves fuera de localhost.**

---

## 6. Verificar integraciones Copernicus (opcional)

Con credenciales Sentinel Hub configuradas:

```bash
pnpm verify:sentinel2    # NDVI live
pnpm verify:sentinel1    # SAR live
pnpm verify:era5         # Clima ERA5
pnpm verify:eudr         # Gate EUDR
pnpm verify:copernicus-live  # Pipeline completo
```

---

## 7. Probar eventos del agente (opcional)

```bash
# Verificar contrato del endpoint
curl http://localhost:3001/api/sentinel/alerts

# Enviar evento de prueba (valida y, si N8N_WEBHOOK_URL existe, reenvia a n8n)
curl -X POST http://localhost:3001/api/sentinel/alerts \
  -H "content-type: application/json" \
  --data @fixtures/n8n/copernicus-snapshot-created.json
```

Ver [09 — Integraciones](./09-integraciones.md) y [Eventos Sentinel, n8n y WhatsApp](./ai-agent-whatsapp.md) para configurar el webhook actual y la ruta futura de WhatsApp directo.

---

## 8. Build de producción

```bash
pnpm check-types   # Verificar tipos TypeScript
pnpm build         # Build de todos los paquetes
```

---

## Solución de problemas comunes

| Problema | Causa probable | Solución |
|----------|----------------|----------|
| `DATABASE_URL` inválida | Postgres no iniciado | `pnpm db:start` |
| Error Clerk al login | Keys faltantes o incorrectas | Revisar `.env` y dashboard Clerk |
| Scoring live falla | Sin credenciales Sentinel Hub | Usar `sourceMode: "fixture"` o configurar credenciales |
| Hardhat proof falla | Nodo no corriendo | Iniciar `contracts node` en otra terminal |
| Puerto 3001 ocupado | Otra app en el puerto | Cambiar puerto en `apps/web/package.json` |

---

## Próximos pasos

- [04 — Motor Copernicus](./04-motor-copernicus.md) — Entender el algoritmo de scoring
- [08 — Flujos de usuario](./08-flujos-de-usuario.md) — Recorrer la demo como agricultor o partner
