/** Copernicus DEM GLO-90 (90 m) via Open-Meteo — same provider as packages/api dem.ts */
const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const BATCH_SIZE = 80;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PolygonElevationStats {
  minMasl: number;
  maxMasl: number;
  meanMasl: number;
  vertexElevations: number[];
}

async function fetchElevationBatch(points: GeoPoint[]): Promise<number[]> {
  if (points.length === 0) return [];

  const latitude = points.map((p) => p.lat.toFixed(6)).join(",");
  const longitude = points.map((p) => p.lng.toFixed(6)).join(",");
  const url = `${OPEN_METEO_ELEVATION_URL}?latitude=${latitude}&longitude=${longitude}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo elevation failed: ${response.status}`);
  }

  const data = (await response.json()) as { elevation?: Array<number | null> };
  const elevations = data.elevation ?? [];

  return elevations.map((value, index) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value);
    }
    return points[index] ? 0 : 0;
  });
}

export async function fetchElevationsAtPoints(points: GeoPoint[]): Promise<number[]> {
  const results: number[] = [];

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const batchElevations = await fetchElevationBatch(batch);
    results.push(...batchElevations);
  }

  return results;
}

export function ringToGeoPoints(ring: number[][]): GeoPoint[] {
  const pts = ring.slice(0, -1);
  return pts
    .map(([lng, lat]) => ({ lng: Number(lng), lat: Number(lat) }))
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180,
    );
}

export async function fetchPolygonElevationStats(
  ring: number[][],
): Promise<PolygonElevationStats | null> {
  const points = ringToGeoPoints(ring);
  if (points.length < 3) return null;

  const vertexElevations = await fetchElevationsAtPoints(points);
  const valid = vertexElevations.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;

  const minMasl = Math.min(...valid);
  const maxMasl = Math.max(...valid);
  const meanMasl = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);

  return { minMasl, maxMasl, meanMasl, vertexElevations };
}
