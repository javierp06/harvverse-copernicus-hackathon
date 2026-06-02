import type { Polygon } from "geojson";

export function isGeoJsonPolygon(value: unknown): value is Polygon {
  if (typeof value !== "object" || value == null) return false;
  const record = value as Polygon;
  return (
    record.type === "Polygon" &&
    Array.isArray(record.coordinates) &&
    Array.isArray(record.coordinates[0]) &&
    record.coordinates[0].length >= 3
  );
}

/** Farm boundary first, then first lot polygon with valid geometry. */
export function resolveFarmMapPolygon(
  farmPolygon: unknown,
  lots: Array<{ polygon?: unknown }>,
): Polygon | null {
  if (isGeoJsonPolygon(farmPolygon)) return farmPolygon;
  for (const lot of lots) {
    if (isGeoJsonPolygon(lot.polygon)) return lot.polygon;
  }
  return null;
}
