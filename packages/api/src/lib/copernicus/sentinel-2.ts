import { SENTINEL_HUB_STATS_URL } from "./sentinel-hub";

export interface Sentinel2Polygon {
  coordinates: number[][][];
}

export interface Sentinel2NdviMonth {
  month: string;
  ndvi: number | null;
  validPixelCoverage: number | null;
  cloudCoverage: number | null;
}

export interface Sentinel2NdviRequest {
  token: string;
  months?: number;
  startDate?: string;
  endDate?: string;
  polygon?: Sentinel2Polygon | null;
  bbox?: [number, number, number, number];
}

const SENTINEL_2_NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "FLOAT32" },
      { id: "validMask", bands: 1, sampleType: "FLOAT32" },
      { id: "cloudMask", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}
function evaluatePixel(s) {
  const isCloud = [3, 8, 9, 10, 11].includes(s.SCL);
  const valid = s.dataMask === 1 && !isCloud && (s.B08 + s.B04) !== 0;
  const ndvi = valid ? (s.B08 - s.B04) / (s.B08 + s.B04) : NaN;
  return {
    ndvi: [ndvi],
    dataMask: [s.dataMask],
    validMask: [valid ? 1 : 0],
    cloudMask: [isCloud ? 1 : 0]
  };
}`;

export function bboxFromPolygon(
  polygon: Sentinel2Polygon,
  bufferPercent = 0.1,
): [number, number, number, number] {
  const ring = polygon.coordinates[0] ?? [];
  let lonMin = Infinity;
  let latMin = Infinity;
  let lonMax = -Infinity;
  let latMax = -Infinity;

  for (const point of ring) {
    const lon = point[0] ?? 0;
    const lat = point[1] ?? 0;
    if (lon < lonMin) lonMin = lon;
    if (lon > lonMax) lonMax = lon;
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
  }

  if (!Number.isFinite(lonMin) || !Number.isFinite(latMin)) {
    throw new Error("Cannot build Sentinel-2 bounding box from empty polygon.");
  }

  const lonRange = lonMax - lonMin;
  const latRange = latMax - latMin;
  lonMin -= lonRange * bufferPercent;
  lonMax += lonRange * bufferPercent;
  latMin -= latRange * bufferPercent;
  latMax += latRange * bufferPercent;

  const minDegrees = 0.05;
  const lonCenter = (lonMin + lonMax) / 2;
  const latCenter = (latMin + latMax) / 2;
  if (lonMax - lonMin < minDegrees) {
    lonMin = lonCenter - minDegrees / 2;
    lonMax = lonCenter + minDegrees / 2;
  }
  if (latMax - latMin < minDegrees) {
    latMin = latCenter - minDegrees / 2;
    latMax = latCenter + minDegrees / 2;
  }

  return [lonMin, latMin, lonMax, latMax];
}

export async function fetchSentinel2NdviMonths({
  token,
  months = 24,
  startDate,
  endDate,
  polygon,
  bbox,
}: Sentinel2NdviRequest): Promise<Sentinel2NdviMonth[]> {
  const resolvedBbox = bbox ?? (polygon ? bboxFromPolygon(polygon) : null);
  if (!resolvedBbox) {
    throw new Error("Sentinel-2 NDVI requires either a polygon or bbox.");
  }

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);
  const resolvedStartDate = startDate ?? start.toISOString().split("T")[0];
  const resolvedEndDate = endDate ?? end.toISOString().split("T")[0];

  const payload = {
    input: {
      bounds: {
        bbox: resolvedBbox,
        ...(polygon
          ? {
              geometry: {
                type: "Polygon",
                coordinates: polygon.coordinates,
              },
            }
          : {}),
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: { mosaickingOrder: "leastCC" },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${resolvedStartDate}T00:00:00Z`,
        to: `${resolvedEndDate}T00:00:00Z`,
      },
      aggregationInterval: { of: "P1M" },
      evalscript: SENTINEL_2_NDVI_EVALSCRIPT,
      width: 512,
      height: 512,
    },
  };

  const response = await fetch(SENTINEL_HUB_STATS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Sentinel-2 stats failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: Array<{
      interval: { from: string };
      outputs?: {
        ndvi?: { bands?: Record<string, { stats?: { mean?: number | null } }> };
        validMask?: { bands?: Record<string, { stats?: { mean?: number | null } }> };
        cloudMask?: { bands?: Record<string, { stats?: { mean?: number | null } }> };
      };
    }>;
  };

  return (data.data ?? []).map((interval) => ({
    month: interval.interval.from.slice(0, 7),
    ndvi: roundedOrNull(
      Object.values(interval.outputs?.ndvi?.bands ?? {})[0]?.stats?.mean,
      4,
    ),
    validPixelCoverage: roundedOrNull(
      Object.values(interval.outputs?.validMask?.bands ?? {})[0]?.stats?.mean,
      4,
    ),
    cloudCoverage: roundedOrNull(
      Object.values(interval.outputs?.cloudMask?.bands ?? {})[0]?.stats?.mean,
      4,
    ),
  }));
}

function roundedOrNull(value: unknown, digits: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}
