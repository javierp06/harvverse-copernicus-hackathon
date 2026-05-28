export interface CopernicusDemRequest {
  lat: number;
  lng: number;
}

export interface CopernicusDemSummary {
  altitudeMasl: number;
  terrainSuitability: "excellent" | "good" | "moderate";
  terrainRisk: "low" | "medium";
  confidence: "low";
  provider: "open_meteo_copernicus_dem_glo90";
  limitations: string[];
}

export async function fetchCopernicusDemElevation({
  lat,
  lng,
}: CopernicusDemRequest): Promise<number> {
  const url =
    "https://api.open-meteo.com/v1/elevation" +
    `?latitude=${lat.toFixed(6)}` +
    `&longitude=${lng.toFixed(6)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo Copernicus DEM elevation failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { elevation?: Array<number | null> };
  const elevation = data.elevation?.[0];
  if (typeof elevation !== "number" || !Number.isFinite(elevation)) {
    throw new Error("Open-Meteo Copernicus DEM response did not include usable elevation.");
  }

  return Math.round(elevation);
}

export function summarizeCopernicusDem(altitudeMasl: number): CopernicusDemSummary {
  return {
    altitudeMasl,
    terrainSuitability:
      altitudeMasl >= 1200 && altitudeMasl <= 1800
        ? "excellent"
        : altitudeMasl >= 900 && altitudeMasl <= 2200
          ? "good"
          : "moderate",
    terrainRisk: altitudeMasl < 600 || altitudeMasl > 2200 ? "medium" : "low",
    confidence: "low",
    provider: "open_meteo_copernicus_dem_glo90",
    limitations: [
      "Elevation is sourced from Open-Meteo's Copernicus DEM GLO-90 elevation endpoint.",
      "This slice samples centroid elevation only; slope and aspect require a later raster-processing increment.",
    ],
  };
}
