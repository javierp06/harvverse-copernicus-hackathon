# Harvverse Sentinel: Implementación del Código (Hackathon)

Este documento detalla el estado actual del repositorio y las funcionalidades que han sido programadas e implementadas con éxito, enfocado principalmente en el motor de inteligencia satelital, los contratos inteligentes y la interfaz de usuario de prueba de lote.

## 1. Arquitectura del Repositorio (Monorepo Turborepo)

El proyecto está estructurado como un monorepo utilizando Turborepo para gestionar de forma eficiente los diferentes módulos:

*   `apps/web`: Frontend en Next.js (App Router) con páginas públicas, dashboard de agricultores e inversores, e internacionalización (i18n).
*   `packages/api`: Backend utilizando tRPC para tipado estricto end-to-end. Contiene la lógica pesada de la integración con Copernicus.
*   `packages/db`: Esquema de base de datos Postgres utilizando Drizzle ORM.
*   `packages/contracts`: Contratos inteligentes en Solidity (Hardhat) diseñados para desplegarse en Base L2.

## 2. Motor de Inteligencia Satelital (Copernicus Pipeline)

Se ha implementado un motor robusto en `packages/api/src/lib/copernicus.ts` capaz de generar un `CopernicusLotSnapshot` determinista (modo "fixture") o conectarse a las APIs reales (modo "live").

### Integraciones de Datos Desarrolladas:
*   **Sentinel-2 (Salud Óptica):** Consulta de series de tiempo históricas (24 meses). Implementa un script de evaluación (`sentinel-2.ts`) que utiliza la banda SCL para filtrar nubes y sombras. Calcula:
    *   **NDVI** (Vigor vegetativo estándar).
    *   **NDRE** (Red Edge, ideal para medir clorofila en el café bajo sombra).
    *   **NDWI y MSI** (Índices de estrés hídrico en el dosel).
*   **Sentinel-1 (Estructura Radar):** Integración SAR (`sentinel-1.ts`) para atravesar nubes en zonas tropicales. Calcula retrodispersión VV/VH, el ratio VH/VV y el RVI (Radar Vegetation Index) para medir cambios estructurales (ej. talas/podas) y humedad del suelo.
*   **ERA5 (Clima Histórico):** Integración mediante Open-Meteo (`era5.ts`) para procesar lluvias diarias y temperaturas. Calcula la lluvia anual acumulada, la temperatura media y distribuciones estacionales para alertar sobre estrés hídrico o exceso de humedad (riesgo de roya).
*   **Copernicus DEM (Topografía):** Cálculo automático de la altitud (msnm) a partir del centroide del polígono del lote dibujado.

## 3. Algoritmo de Risk Score (0-100)

El código ejecuta un algoritmo de puntuación ponderada basado en 7 variables ambientales y normativas para determinar la viabilidad de la inversión:

1.  **S2 Salud Óptica (20%):** Promedio de NDVI, NDRE y NDWI.
2.  **S2 Estabilidad (10%):** Coeficiente de variación del NDVI histórico para premiar un manejo agrícola constante.
3.  **S1 Humedad SAR (10%):** Estructura física y humedad del suelo medida por radar.
4.  **ERA5 Lluvia (15%):** Penaliza sequías (<600mm) y excesos hídricos (>3500mm). Otorga puntuación máxima en el rango ideal de 1500-2400 mm/año.
5.  **ERA5 Temperatura (10%):** Rango ideal en torno a 18-22 °C.
6.  **Idoneidad del Terreno (15%):** Basado en el polígono y la altitud DEM.
7.  **Filtro EUDR (20%):** Evaluación de deforestación post-2020.

**Regla de Bloqueo Estricto:** Si el estado EUDR es `non_compliant`, el lote se bloquea de la plataforma de inversión independientemente de su puntuación numérica. El lote solo es elegible si `riskScore >= 60` y el EUDR es verificado.

## 4. Proyección Financiera: YieldPredict

Se programó un modelo matemático en el backend para proyectar la cosecha y dar contexto financiero al inversor:

*   **Fórmula:** `Área (mz) × Rendimiento Base (variedad + banda altitud) × Modificador NDVI × Modificador Densidad`
*   **Tablas Base:** Rendimientos base configurados por variedad (Bourbon, Geisha, Catuai, etc.) cruzados con bandas de altitud (baja, óptima, alta, extrema).
*   **Modificador NDVI (AUC):** Calcula el Área Bajo la Curva (AUC) de los valores NDVI en los meses críticos (Mayo a Septiembre) y lo compara contra un benchmark de la zona para ajustar la proyección hacia arriba o hacia abajo.
*   **Bandas de Confianza:** Genera un rango de proyección baja (-20%) y alta (+20%).

## 5. Puente Blockchain y Pruebas Criptográficas (Base L2)

Para garantizar la inmutabilidad de los datos satelitales, el sistema genera evidencia para la blockchain:

*   **Evidence Hash:** El backend toma el payload JSON completo (polígono, series de tiempo NDVI/SAR, clima, proyección de cosecha y score final) y genera un hash criptográfico **SHA-256**.
*   **Contratos Inteligentes (`HarvverseLot.sol`):** Se ha diseñado el contrato para almacenar este `scoreHash`, el `riskScore` numérico, el estado `eudrCompliant` y la versión del algoritmo.
*   **Elegibilidad On-chain:** El contrato `HarvversePartnership.sol` puede consultar al contrato del lote y revertir transacciones (bloquear inversiones) si el score es menor a 40 o si el lote incumple la ley EUDR, actuando como un GateKeeper descentralizado.

## 6. Frontend y Dashboards (Trabajo Conjunto Jesús/Javier)

Se ha desarrollado una interfaz de usuario completa y responsiva (App Router):

*   **Página Pública QR (`/lot/[code]`):** Un dashboard público de 12 columnas (optimizado para escritorio y móvil) que muestra el polígono, el score de riesgo, el estado EUDR, y el desglose transparente de las 7 variables satelitales. Sirve como prueba física del lote para compradores e inversores. Completamente responsivo y con "tooltips" explicativos para la terminología técnica.
*   **Dashboard del Agricultor:** Permite subir polígonos (vía KML o GeoJSON manual), editar detalles agronómicos del lote (variedad, altitud, año de siembra) y visualizar el análisis satelital técnico. Botón para forzar el análisis de Copernicus en vivo.
*   **Internacionalización (i18n):** Todo el sistema está traducido al inglés (`en.json`) y al español (`es.json`), utilizando plantillas dinámicas para las fórmulas.
*   **Listo para Demo:** La interfaz está completamente conectada al backend de Copernicus y a los contratos inteligentes de Base L2.

## 7. Integración con n8n y WhatsApp (Trabajo Sheyla)

La arquitectura base para conectar los eventos satelitales con flujos de mensajería (n8n/WhatsApp) ya está preparada desde el lado del backend.

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

## 8. Pendientes ("Nice to Have" según el Sprint Plan)

Las funcionalidades principales críticas del hackathon están completadas y conectadas. Lo documentado en los mockups originales para la recta final que *no* está en el código base actual es:
*   Contrato ERC-20 `CarbonFarm.sol` (Tokenización de captura de carbono).
*   Actualización automática del hash satelital (Snapshot) on-chain vinculado a la aprobación de "Hitos" de producción durante el ciclo del cultivo.