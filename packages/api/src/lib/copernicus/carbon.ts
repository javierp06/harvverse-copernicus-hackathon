export type CarbonCaptureConfidence = "low" | "medium" | "high";

export type CarbonCaptureEstimate = {
  sourceMode: "fixture" | "live";
  methodVersion: "carbon-screening-v0.1.0";
  mrvStatus: "estimate_only";
  tCo2ePerHaYear: number;
  totalTCo2ePerYear: number | null;
  areaHectares: number | null;
  canopyCoverPct: number | null;
  shadeTreeDensityPerHa: number | null;
  shadeSpeciesGroup:
    | "inga_guamo"
    | "grevillea"
    | "fruit_mixed"
    | "mixed"
    | "unknown";
  soilCarbonAssumption: "not_measured";
  confidence: CarbonCaptureConfidence;
  inputs: {
    areaManzanas: number | null;
    currentNdvi: number | null;
    currentNdre: number | null;
    currentNdwi: number | null;
    radarVegetationIndex: number | null;
    vhVvRatio: number | null;
    shadeTrees: string | null;
    numCoffeeTrees: number | null;
  };
  formula: string;
  interpretation: string;
  limitations: string[];
  requiredFieldInventory: string[];
};

const HECTARES_PER_MANZANA = 0.6989;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shadeSpeciesGroup(shadeTrees: string | null | undefined): CarbonCaptureEstimate["shadeSpeciesGroup"] {
  const normalized = shadeTrees?.toLowerCase() ?? "";
  if (!normalized.trim()) return "unknown";
  if (normalized.includes("inga") || normalized.includes("guamo") || normalized.includes("guama")) {
    return "inga_guamo";
  }
  if (normalized.includes("grevillea")) return "grevillea";
  if (
    normalized.includes("mango") ||
    normalized.includes("aguacate") ||
    normalized.includes("citr") ||
    normalized.includes("frut")
  ) {
    return "fruit_mixed";
  }
  return "mixed";
}

function speciesGrowthFactor(group: CarbonCaptureEstimate["shadeSpeciesGroup"]) {
  if (group === "inga_guamo") return 4.2;
  if (group === "grevillea") return 3.8;
  if (group === "fruit_mixed") return 3.4;
  if (group === "mixed") return 3.6;
  return 3.0;
}

function estimateCanopyCoverPct({
  currentNdvi,
  currentNdre,
  currentNdwi,
  radarVegetationIndex,
}: {
  currentNdvi: number | null;
  currentNdre: number | null;
  currentNdwi: number | null;
  radarVegetationIndex: number | null;
}) {
  if (currentNdvi == null) return null;

  const ndviCover = 20 + clamp((currentNdvi - 0.35) / 0.45, 0, 1) * 65;
  const ndreBonus = currentNdre == null ? 0 : clamp((currentNdre - 0.28) / 0.24, -0.15, 0.2) * 20;
  const waterBonus = currentNdwi == null ? 0 : clamp((currentNdwi - 0.08) / 0.24, -0.15, 0.15) * 12;
  const structureBonus =
    radarVegetationIndex == null ? 0 : clamp((radarVegetationIndex - 0.45) / 0.35, -0.1, 0.2) * 10;

  return Math.round(clamp(ndviCover + ndreBonus + waterBonus + structureBonus, 15, 92));
}

function estimateShadeTreeDensity(canopyCoverPct: number | null, shadeTrees: string | null | undefined) {
  if (canopyCoverPct == null) return null;
  const hasShadeInventoryText = Boolean(shadeTrees?.trim());
  const baseDensity =
    canopyCoverPct >= 75 ? 110 : canopyCoverPct >= 55 ? 75 : canopyCoverPct >= 35 ? 45 : 20;
  return hasShadeInventoryText ? baseDensity : Math.round(baseDensity * 0.75);
}

export function buildCarbonCaptureEstimate({
  sourceMode,
  areaManzanas,
  currentNdvi,
  currentNdre,
  currentNdwi,
  radarVegetationIndex,
  vhVvRatio,
  shadeTrees,
  numCoffeeTrees,
}: {
  sourceMode: "fixture" | "live";
  areaManzanas: number | null;
  currentNdvi: number | null;
  currentNdre: number | null;
  currentNdwi: number | null;
  radarVegetationIndex: number | null;
  vhVvRatio: number | null;
  shadeTrees?: string | null;
  numCoffeeTrees?: number | null;
}): CarbonCaptureEstimate {
  const cleanAreaManzanas = numberOrNull(areaManzanas);
  const areaHectares =
    cleanAreaManzanas == null ? null : round(cleanAreaManzanas * HECTARES_PER_MANZANA, 2);
  const cleanShadeTrees = shadeTrees?.trim() ? shadeTrees.trim() : null;
  const canopyCoverPct = estimateCanopyCoverPct({
    currentNdvi: numberOrNull(currentNdvi),
    currentNdre: numberOrNull(currentNdre),
    currentNdwi: numberOrNull(currentNdwi),
    radarVegetationIndex: numberOrNull(radarVegetationIndex),
  });
  const shadeGroup = shadeSpeciesGroup(cleanShadeTrees);
  const shadeTreeDensityPerHa = estimateShadeTreeDensity(canopyCoverPct, cleanShadeTrees);
  const canopyModifier =
    canopyCoverPct == null ? 1 : clamp(0.65 + (canopyCoverPct / 100) * 0.85, 0.65, 1.35);
  const structureModifier =
    radarVegetationIndex == null ? 1 : clamp(0.85 + (radarVegetationIndex - 0.45) * 0.75, 0.85, 1.15);
  const densityModifier =
    shadeTreeDensityPerHa == null ? 0.85 : clamp(shadeTreeDensityPerHa / 80, 0.55, 1.25);
  const tCo2ePerHaYear = round(
    clamp(speciesGrowthFactor(shadeGroup) * canopyModifier * structureModifier * densityModifier, 1.2, 9.5),
    2,
  );
  const totalTCo2ePerYear =
    areaHectares == null ? null : round(tCo2ePerHaYear * areaHectares, 2);
  const confidence: CarbonCaptureConfidence =
    sourceMode === "live" && cleanShadeTrees && canopyCoverPct != null
      ? "medium"
      : canopyCoverPct != null
        ? "low"
        : "low";

  return {
    sourceMode,
    methodVersion: "carbon-screening-v0.1.0",
    mrvStatus: "estimate_only",
    tCo2ePerHaYear,
    totalTCo2ePerYear,
    areaHectares,
    canopyCoverPct,
    shadeTreeDensityPerHa,
    shadeSpeciesGroup: shadeGroup,
    soilCarbonAssumption: "not_measured",
    confidence,
    inputs: {
      areaManzanas: cleanAreaManzanas,
      currentNdvi: numberOrNull(currentNdvi),
      currentNdre: numberOrNull(currentNdre),
      currentNdwi: numberOrNull(currentNdwi),
      radarVegetationIndex: numberOrNull(radarVegetationIndex),
      vhVvRatio: numberOrNull(vhVvRatio),
      shadeTrees: cleanShadeTrees,
      numCoffeeTrees: numCoffeeTrees ?? null,
    },
    formula:
      "tCO2e_ha_yr = species_growth_factor(shade_species) * canopy_modifier(S2 NDVI/NDRE/NDWI) * structure_modifier(S1 RVI) * shade_density_modifier",
    interpretation:
      "Estimated annual carbon capture from coffee agroforestry shade structure. It is a screening estimate, not an issued or sellable carbon credit.",
    limitations: [
      "ESTIMACION: requiere inventario de sombra en campo y ecuaciones alometricas validadas por especie.",
      "Sentinel-2 and Sentinel-1 support canopy and structure proxies, but they do not identify tree species, DBH, height, or soil organic carbon by themselves.",
      "No Verra, Gold Standard, Article 6, or other MRV certification workflow is applied in this estimate.",
      "This output must not be represented as an issued carbon credit or marketplace-ready asset.",
    ],
    requiredFieldInventory: [
      "Shade tree species per lot",
      "Shade tree count or density per hectare",
      "DBH and estimated height by representative shade tree",
      "Soil type plus soil organic carbon sampling if soil carbon is claimed",
      "Management baseline and permanence/leakage assumptions for MRV review",
    ],
  };
}
