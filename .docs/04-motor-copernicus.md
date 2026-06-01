# 04 — Motor Copernicus

El motor de scoring es el núcleo técnico de Harvverse Sentinel. Transforma un polígono GPS y metadatos del lote en una **puntuación de riesgo 0–100**, un estado EUDR, una proyección de cosecha (YieldPredict) y un payload firmado auditable.

**Archivo principal:** `packages/api/src/lib/copernicus.ts`

**Módulos de integración:**

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/copernicus/sentinel-2.ts` | NDVI, NDRE, NDWI, MSI vía Statistics API |
| `lib/copernicus/sentinel-1.ts` | Backscatter VV/VH, RVI, proxy de humedad |
| `lib/copernicus/era5.ts` | Lluvia anual, temperatura, estrés hídrico |
| `lib/copernicus/dem.ts` | Altitud vía Copernicus DEM GLO-90 |
| `lib/copernicus/eudr.ts` | Gate de deforestación post-2020 |
| `lib/copernicus/sentinel-hub.ts` | OAuth y credenciales Sentinel Hub |

---

## Versiones del algoritmo

| Versión | Modo | Signer |
|---------|------|--------|
| `sentinel-v0.2.0` | fixture | `harvverse-sentinel-demo-signer` |
| `sentinel-live-v0.3.0` | live | `harvverse-sentinel-worker` |

---

## Las siete variables de scoring

Cada variable produce un sub-score 0–100 y un peso. La puntuación final es la **media ponderada** redondeada.

### 1. Salud óptica del dosel (20%)

**Fuente:** Sentinel-2 L2A  
**Métricas:** NDVI, NDRE (red edge), NDWI (agua del dosel), MSI (estrés hídrico)

Combina tres funciones de scoring:

- `scoreNdviAverage()` — vigor general del dosel
- `scoreNdreAverage()` — salud foliar / clorofila
- `scoreCanopyWater()` — balance NDWI + MSI

**Filtro de nubes:** máscara SCL (Scene Classification Layer) de Sentinel-2 L2A.

### 2. Estabilidad NDVI a 2 años (10%)

**Fuente:** Sentinel-2  
**Método:** coeficiente de variación (CV) de la serie mensual NDVI (últimos 24 meses)

- CV ≤ 0.05 → score 100 (muy estable)
- CV ≥ 0.30 → score 0 (muy variable)
- Interpolación lineal entre ambos

Indica consistencia en el manejo agronómico del lote.

### 3. Humedad/estructura SAR (10%)

**Fuente:** Sentinel-1 GRD IW dual-polarización  
**Métricas:** VV, VH, ratio VH/VV, RVI (Radar Vegetation Index)

El proxy de humedad se clasifica como `low`, `medium` o `high`:

| Proxy | Score |
|-------|-------|
| medium | 82 |
| high | 70 |
| low | 55 |
| unknown | 50 |

Sentinel-1 penetra nubes; complementa Sentinel-2 en temporadas lluviosas.

### 4. Ajuste de lluvia anual (15%)

**Fuente:** ERA5 reanalysis vía Open-Meteo Archive  
**Rango óptimo para café:** ~1200–2400 mm/año

La función `scoreAnnualRainfall()` penaliza sequía extrema (<600 mm) y exceso pluvial (>4500 mm).

### 5. Riesgo térmico estacional (10%)

**Fuente:** ERA5  
**Rango óptimo:** 18–22 °C media anual

Temperaturas fuera de rango reducen el score (frío extremo o calor excesivo).

### 6. Gate EUDR (20%)

**Baseline:** 31 de diciembre de 2020  
**Estados posibles:**

| Estado | Score | Marketplace |
|--------|-------|-------------|
| `verified` | 100 | Permitido (si score ≥ 60) |
| `non_compliant` | 0 | **Bloqueado siempre** |
| `unknown` | 50 | Requiere revisión |

En modo **live**, `buildEudrGateFromSentinel2()` analiza continuidad vegetal post-2020. En **fixture**, el lote demo siempre es `verified`.

> **Limitación actual:** el gate live usa una pantalla preliminar Sentinel-2; la intersección con el baseline oficial JRC Global Forest Cover 2020 está pendiente de hardening para producción.

### 7. Idoneidad del terreno (15%)

**Fuentes:** Polígono del lote + DEM  
**Datos:** altitud (msnm), área (manzanas), idoneidad (`excellent` / `good` / `moderate`)

En live, la altitud se obtiene del centroid del polígono vía Open-Meteo Copernicus DEM GLO-90.

---

## Bandas de riesgo (risk tier)

```typescript
function riskTierFor(score: number): RiskTier {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "moderate";
  if (score >= 20) return "high_risk";
  return "not_viable";
}
```

---

## Elegibilidad para inversión

```typescript
eligibleForInvestment = eudrStatus === "verified" && riskScore >= 60
```

Adicionalmente, el contrato on-chain bloquea inversión si:

- No existe score escrito on-chain
- `riskScore < 60` (función `isInvestmentEligible`)
- `eudrCompliant === false`

---

## YieldPredict — Proyección de cosecha

Estima quintales (qq) para el próximo ciclo:

```
proyección = área_mz × base_qq/mz × ndvi_modifier × density_modifier
```

### Rendimiento base por variedad y altitud

Tabla en `BASE_YIELD_QQ_PER_MANZANA` — variedades soportadas:

`bourbon`, `catuai`, `caturra`, `geisha`, `pacamara`, `parainema`, `typica`, `default`

Bandas de altitud: `low`, `optimal`, `high`, `very_high`, `extreme`

### Modificador NDVI

Calcula el AUC (área bajo curva) de NDVI en meses mayo–septiembre del último año disponible y lo compara con un benchmark por banda de altitud:

```
ndvi_modifier = clamp(auc_observado / auc_benchmark, 0.7, 1.25)
```

### Modificador de densidad

```
density_modifier = clamp(plantas_por_mz / plantas_esperadas, 0.75, 1.15)
```

Plantas esperadas: 1800/mz (altitudes normales), 1600/mz (muy alta/extrema).

### Bandas de confianza

- `lowBandQuintales` = proyección × 0.8
- `highBandQuintales` = proyección × 1.2
- Confianza `high` si modo live + NDVI season + densidad conocida

---

## Calidad de datos (dataQuality)

Cada snapshot incluye metadatos de calidad:

| Campo | Descripción |
|-------|-------------|
| `confidence` | `low` / `medium` / `high` — agregado de todas las fuentes |
| `completeness` | 0–1 — fracción de observaciones disponibles |
| `scoreCap` | Si aplica, limita el score máximo y explica por qué |
| `warnings` | Alertas legibles para la UI |
| `limitations` | Limitaciones metodológicas |
| `parcelScale` | Ajuste por tamaño del lote (<1.5 mz = baja confianza satelital) |

Lotes muy pequeños (<1.5 manzanas) reciben advertencia: las señales Sentinel apoyan tendencias, no diagnóstico planta a planta.

---

## Modo fixture vs live

### Fixture (`buildFixtureCopernicusSnapshot`)

- No requiere credenciales ni red
- Genera serie NDVI determinística basada en `lotId`
- EUDR siempre `verified`
- Datos SAR, ERA5 y DEM simulados pero con la **misma estructura JSON** que live
- Ideal para demos offline, CI y desarrollo frontend

### Live (`buildLiveCopernicusSnapshot`)

Requiere:

1. Polígono GeoJSON válido en el lote
2. `SENTINEL_HUB_CLIENT_ID` + `SENTINEL_HUB_CLIENT_SECRET`

Ejecuta en paralelo:

```typescript
Promise.all([
  fetchSentinel2NdviMonths(),   // desde 2020-01-01
  fetchSentinel1SarQuarters(),
  fetchEra5ClimateMonths(),
  fetchCopernicusDemElevation(),
])
```

Luego aplica scoring real sobre los datos obtenidos.

---

## Payload firmado e integridad

### Evidence hash

```typescript
evidenceHash = SHA256(JSON.stringify({
  ...unsignedPayload,
  polygon,
  sentinel2: historicalSeries,
  // + evidencia adicional en live
}))
```

### Firma demo

```typescript
signature = SHA256(JSON.stringify({ signer, evidenceHash }))
```

En producción, la firma debería usar criptografía asimétrica (ECDSA/Ed25519) con un worker dedicado. La demo usa hash determinístico para simplicidad.

### Score hash

Igual a `evidenceHash` en la implementación actual. Se escribe on-chain como `bytes32`.

---

## Almacenamiento en base de datos

Tras calcular, `persistCopernicusSnapshot()`:

1. Inserta fila en `copernicus_snapshots` (histórico completo)
2. Actualiza columnas resumen en `lots`:
   - `riskScore`, `riskTier`, `eudrStatus`
   - `scoreHash`, `scoreVersion`, `scoreUpdatedAt`
   - `copernicusSnapshotId`
   - `altitudeMasl` (si DEM live difiere)

Cada recálculo crea un **nuevo snapshot**; el anterior se conserva para auditoría.

---

## Scripts de verificación

Desde la raíz del monorepo:

| Script | Qué verifica |
|--------|--------------|
| `pnpm verify:sentinel2` | NDVI live contra polígono de prueba |
| `pnpm verify:sentinel1` | SAR live |
| `pnpm verify:era5` | Clima ERA5 |
| `pnpm verify:eudr` | Gate EUDR |
| `pnpm verify:dem` | Altitud DEM |
| `pnpm verify:copernicus-live` | Pipeline completo live |
| `pnpm verify:copernicus-local-chain` | Escritura on-chain Hardhat |

Los scripts viven en `scripts/` y se ejecutan con `tsx`.

---

## Ejemplo de snapshot (estructura simplificada)

```json
{
  "lotId": 1,
  "sourceMode": "live",
  "scoreVersion": "sentinel-live-v0.3.0",
  "riskScore": 77,
  "riskTier": "good",
  "eudrStatus": "verified",
  "eligibleForInvestment": true,
  "variables": [ /* 7 variables con score y weight */ ],
  "sentinel2": {
    "currentNdvi": 0.72,
    "twoYearAverageNdvi": 0.68,
    "historicalSeries": [ /* 24 meses */ ]
  },
  "sentinel1": {
    "moistureProxy": "medium",
    "vhVvRatio": 0.25
  },
  "era5": {
    "annualRainfallMm": 1680,
    "meanTemperatureC": 20.8
  },
  "yieldPredict": {
    "projectedQuintales": 152,
    "investmentArgument": "YieldPredict uses 8.24 mz × ..."
  },
  "scoreHash": "a0275b8c...",
  "chain": {
    "metadataStatus": "pending",
    "transactionHash": null
  }
}
```

Ver fixture completo en `.docs/sentinel/sample-copernicus-snapshot.json`.
