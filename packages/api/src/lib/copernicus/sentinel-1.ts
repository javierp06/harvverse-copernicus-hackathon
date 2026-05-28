import { SENTINEL_HUB_STATS_URL } from "./sentinel-hub";
import { bboxFromPolygon, type Sentinel2Polygon } from "./sentinel-2";

export type Sentinel1MoistureProxy = "low" | "medium" | "high" | "unknown";
export type Sentinel1StructuralChangeSignal = "none" | "possible_change" | "unknown";
export type Sentinel1Confidence = "low" | "medium";

export interface Sentinel1SarQuarter {
  quarter: string;
  vv: number | null;
  vh: number | null;
  validPixelCoverage: number | null;
}

export interface Sentinel1SarRequest {
  token: string;
  months?: number;
  polygon?: Sentinel2Polygon | null;
  bbox?: [number, number, number, number];
}

export interface Sentinel1SarSummary {
  vv: number | null;
  vh: number | null;
  moistureProxy: Sentinel1MoistureProxy;
  structuralChangeSignal: Sentinel1StructuralChangeSignal;
  confidence: Sentinel1Confidence;
  quarters: Sentinel1SarQuarter[];
}

const SENTINEL_1_SAR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: [
      { id: "vv", bands: 1, sampleType: "FLOAT32" },
      { id: "vh", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "FLOAT32" },
      { id: "validMask", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}
function evaluatePixel(s) {
  return {
    vv: [s.dataMask ? s.VV : NaN],
    vh: [s.dataMask ? s.VH : NaN],
    dataMask: [s.dataMask],
    validMask: [s.dataMask ? 1 : 0]
  };
}`;

export async function fetchSentinel1SarQuarters({
  token,
  months = 24,
  polygon,
  bbox,
}: Sentinel1SarRequest): Promise<Sentinel1SarQuarter[]> {
  const resolvedBbox = bbox ?? (polygon ? bboxFromPolygon(polygon) : null);
  if (!resolvedBbox) {
    throw new Error("Sentinel-1 SAR requires either a polygon or bbox.");
  }

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);

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
          type: "sentinel-1-grd",
          dataFilter: {
            acquisitionMode: "IW",
            polarization: "DV",
          },
          processing: {
            backCoeff: "SIGMA0_ELLIPSOID",
            orthorectify: true,
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${start.toISOString().split("T")[0]}T00:00:00Z`,
        to: `${end.toISOString().split("T")[0]}T00:00:00Z`,
      },
      aggregationInterval: { of: "P3M" },
      evalscript: SENTINEL_1_SAR_EVALSCRIPT,
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
    throw new Error(`Sentinel-1 stats failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: Array<{
      interval: { from: string };
      outputs?: {
        vv?: { bands?: Record<string, { stats?: { mean?: number | null } }> };
        vh?: { bands?: Record<string, { stats?: { mean?: number | null } }> };
        validMask?: { bands?: Record<string, { stats?: { mean?: number | null } }> };
      };
    }>;
  };

  return (data.data ?? []).map((interval) => ({
    quarter: quarterFromMonth(interval.interval.from.slice(0, 7)),
    vv: roundedOrNull(
      Object.values(interval.outputs?.vv?.bands ?? {})[0]?.stats?.mean,
      4,
    ),
    vh: roundedOrNull(
      Object.values(interval.outputs?.vh?.bands ?? {})[0]?.stats?.mean,
      4,
    ),
    validPixelCoverage: roundedOrNull(
      Object.values(interval.outputs?.validMask?.bands ?? {})[0]?.stats?.mean,
      4,
    ),
  }));
}

export function summarizeSentinel1SarQuarters(
  quarters: Sentinel1SarQuarter[],
): Sentinel1SarSummary {
  const validVv = quarters
    .map((quarter) => quarter.vv)
    .filter((value): value is number => typeof value === "number");
  const validVh = quarters
    .map((quarter) => quarter.vh)
    .filter((value): value is number => typeof value === "number");
  const latestVv = validVv.at(-1) ?? null;
  const latestVh = validVh.at(-1) ?? null;
  const previousVh = validVh.length >= 2 ? validVh.at(-2) ?? null : null;
  const trailingVh =
    validVh.length >= 5 ? average(validVh.slice(-5, -1)) : null;
  const vhDelta =
    latestVh != null && previousVh != null ? latestVh - previousVh : null;
  const belowTrailingAverage =
    latestVh != null && trailingVh != null && trailingVh > 0
      ? latestVh < trailingVh * 0.7
      : false;
  const averageVv = average(validVv);

  return {
    vv: latestVv,
    vh: latestVh,
    moistureProxy:
      averageVv == null
        ? "unknown"
        : averageVv < 0.04
          ? "low"
          : averageVv > 0.16
            ? "high"
            : "medium",
    structuralChangeSignal:
      vhDelta != null && vhDelta <= -0.03 && belowTrailingAverage
        ? "possible_change"
        : "none",
    confidence: validVv.length >= 4 && validVh.length >= 4 ? "medium" : "low",
    quarters,
  };
}

function quarterFromMonth(month: string): string {
  const [year, monthText] = month.split("-");
  const monthNumber = Number(monthText);
  const quarter = Math.max(1, Math.ceil(monthNumber / 3));
  return `${year}-Q${quarter}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundedOrNull(value: unknown, digits: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}
