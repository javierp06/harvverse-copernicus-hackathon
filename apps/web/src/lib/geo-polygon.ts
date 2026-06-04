import type { Polygon, Position } from "geojson";

function isLonLatPosition(value: unknown): value is Position {
  if (!Array.isArray(value) || value.length < 2) return false;
  const [lon, lat] = value;
  return typeof lon === "number" && Number.isFinite(lon) && typeof lat === "number" && Number.isFinite(lat);
}

function isClosedRing(ring: Position[]) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first != null && last != null && first[0] === last[0] && first[1] === last[1];
}

export function isGeoJsonPolygon(value: unknown): value is Polygon {
  if (typeof value !== "object" || value == null) return false;
  const record = value as { type?: unknown; coordinates?: unknown };
  if (record.type !== "Polygon" || !Array.isArray(record.coordinates)) return false;

  const [outerRing, ...holes] = record.coordinates;
  if (!Array.isArray(outerRing) || outerRing.length < 4) return false;
  if (!outerRing.every(isLonLatPosition) || !isClosedRing(outerRing)) return false;

  return holes.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(isLonLatPosition) &&
      isClosedRing(ring),
  );
}

export function polygonsEqual(a: Polygon, b: Polygon): boolean {
  return JSON.stringify(a.coordinates) === JSON.stringify(b.coordinates);
}

/** Farm outline for lot maps when farm and lot boundaries differ. */
export function farmBoundaryForLotMap(
  farmPolygon: unknown,
  lotPolygon: Polygon | null,
): Polygon | null {
  if (!isGeoJsonPolygon(farmPolygon)) return null;
  if (!lotPolygon) return null;
  if (polygonsEqual(farmPolygon, lotPolygon)) return null;
  return farmPolygon;
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
