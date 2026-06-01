# Opciones de Estrategia de Alertas Satelitales (n8n / WhatsApp)

Este documento explora las diferentes opciones y periodicidades viables para implementar un sistema de notificaciones a agricultores e inversores, basándose en la disponibilidad física de los datos de Copernicus (tasa de revisita de satélites y modelos climáticos).

Para materializar la visión de "WhatsApp en vivo", se pueden configurar diferentes "gatillos" (triggers) dependiendo de si se busca una alerta rápida o un análisis profundo.

## A. Alertas Climáticas Rápidas (Diarias / Semanales)
Basadas en los modelos meteorológicos **ERA5**, cuyos datos se calculan y actualizan diariamente de manera global.

1.  **Alerta de Estrés Hídrico (Sequía):**
    *   *Gatillo:* Detección de días consecutivos sin lluvia combinados con temperaturas atípicas (`era5.waterStress === "high"`).
    *   *Frecuencia Sugerida:* Semanal (evaluando los últimos 7 días). Podría ser diaria, pero generaría "spam" innecesario.
2.  **Alerta de Roya / Enfermedad Fúngica (Exceso de Lluvia):**
    *   *Gatillo:* Picos inusuales de lluvia en un periodo corto que favorecen la propagación de hongos.
    *   *Frecuencia Sugerida:* Semanal o Quincenal.

## B. Alertas Ópticas de Salud (Quincenales / Mensuales)
Basadas en **Sentinel-2**. Aunque el satélite toma imágenes del mismo punto geográfico **cada 5 días**, en zonas tropicales cafetaleras la cobertura de nubes es un bloqueador masivo. 

1.  **Alerta de Caída de Vigor (NDVI Drop):**
    *   *Gatillo:* El NDVI o NDRE actual cae significativamente (>10-15%) por debajo del promedio histórico o respecto al periodo anterior.
    *   *Frecuencia Sugerida:* Quincenal o Mensual. 
    *   *Razón técnica:* Necesitamos ventanas de tiempo de al menos 15-30 días para que el motor garantice conseguir un píxel "limpio" (libre de nubes) usando el algoritmo de filtrado SCL. Intentar hacer esto cada 5 días resultaría frecuentemente en alertas "sin datos por nubosidad".

## C. Alertas Estructurales Radar (Mensuales / Trimestrales)
Basadas en **Sentinel-1 (SAR)**. El radar tiene la enorme ventaja de que **atraviesa las nubes** (pasa cada 6-12 días), por lo que siempre hay datos. Sin embargo, los cambios en la biomasa sólida (madera, ramas de sombra) toman tiempo en ser estadísticamente significativos.

1.  **Alerta de Poda/Tala Irregular (Cambio Estructural):**
    *   *Gatillo:* `sentinel1.structuralChangeSignal === "possible_change"` (el índice RVI o la relación VH/VV detectan una pérdida masiva de estructura en el dosel de sombra).
    *   *Frecuencia Sugerida:* Mensual o Trimestral. Avisar cada semana sobre la estructura del árbol no aporta valor agronómico accionable.

## D. Alertas de Negocio (Por Evento / Tiempo Real)
Estas no dependen del paso del satélite, sino que se disparan instantáneamente cuando ocurre una acción en la plataforma o un nuevo análisis on-demand determina un cambio de estado.

1.  **Lote Aprobado y Listo para Invertir:**
    *   *Gatillo:* Finaliza el cálculo de Copernicus, `eudrStatus === "verified"` y `riskScore >= 60`.
    *   *Contenido:* Envío del Score final, proyección de cosecha (YieldPredict) y el enlace al código QR público.
2.  **Inversión Bloqueada (Riesgo Regulatorio):**
    *   *Gatillo:* Finaliza el cálculo del pipeline y `eudrStatus === "non_compliant"`.
    *   *Contenido:* Aviso crítico de deforestación post-2020 detectada, bloqueando la venta europea.
