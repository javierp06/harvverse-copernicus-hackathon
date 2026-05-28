import type { Sentinel2Polygon } from "./sentinel-2";

export interface Era5ClimateMonth {
  month: string;
  precipitationMm: number;
  meanTemperatureC: number | null;
  extremeRainDays: number;
}

export interface Era5ClimateRequest {
  lat: number;
  lng: number;
  months?: number;
}

export interface Era5ClimateSummary {
  annualRainfallMm: number;
  meanTemperatureC: number;
  seasonalDistribution: "balanced" | "variable" | "stressed";
  waterStress: "low" | "medium" | "high";
  extremeRainDays: number;
  precipitationTrendMmPerYear: number | null;
  confidence: "low" | "medium";
  months: Era5ClimateMonth[];
}

export async function fetchEra5ClimateMonths({
  lat,
  lng,
  months = 24,
}: Era5ClimateRequest): Promise<Era5ClimateMonth[]> {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));

  const url =
    "https://archive-api.open-meteo.com/v1/archive" +
    `?latitude=${lat.toFixed(4)}` +
    `&longitude=${lng.toFixed(4)}` +
    `&start_date=${formatDate(start)}` +
    `&end_date=${formatDate(end)}` +
    "&daily=precipitation_sum,temperature_2m_mean" +
    "&timezone=UTC";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo archive failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    daily?: {
      time?: string[];
      precipitation_sum?: Array<number | null>;
      temperature_2m_mean?: Array<number | null>;
    };
  };
  const days = data.daily?.time ?? [];
  const precipitation = data.daily?.precipitation_sum ?? [];
  const temperature = data.daily?.temperature_2m_mean ?? [];
  const byMonth = new Map<
    string,
    { precipitationMm: number; temperatureSum: number; temperatureCount: number; extremeRainDays: number }
  >();

  for (let index = 0; index < days.length; index++) {
    const month = (days[index] ?? "").slice(0, 7);
    if (month.length !== 7) continue;

    const row = byMonth.get(month) ?? {
      precipitationMm: 0,
      temperatureSum: 0,
      temperatureCount: 0,
      extremeRainDays: 0,
    };
    const dailyRain = precipitation[index] ?? 0;
    row.precipitationMm += dailyRain;
    if (dailyRain > 100) row.extremeRainDays++;

    const dailyTemp = temperature[index];
    if (dailyTemp != null) {
      row.temperatureSum += dailyTemp;
      row.temperatureCount++;
    }
    byMonth.set(month, row);
  }

  return Array.from(byMonth.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([month, row]) => ({
      month,
      precipitationMm: Number(row.precipitationMm.toFixed(2)),
      meanTemperatureC:
        row.temperatureCount > 0
          ? Number((row.temperatureSum / row.temperatureCount).toFixed(2))
          : null,
      extremeRainDays: row.extremeRainDays,
    }));
}

export function summarizeEra5ClimateMonths(
  months: Era5ClimateMonth[],
): Era5ClimateSummary {
  const annualRainfallMm =
    months.length > 0
      ? Number(((months.reduce((sum, month) => sum + month.precipitationMm, 0) / months.length) * 12).toFixed(1))
      : 0;
  const temperatures = months
    .map((month) => month.meanTemperatureC)
    .filter((value): value is number => typeof value === "number");
  const meanTemperatureC =
    temperatures.length > 0
      ? Number((temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length).toFixed(1))
      : 0;
  const extremeRainDays = months.reduce((sum, month) => sum + month.extremeRainDays, 0);

  return {
    annualRainfallMm,
    meanTemperatureC,
    seasonalDistribution: classifySeasonality(months),
    waterStress: classifyWaterStress(annualRainfallMm, meanTemperatureC, extremeRainDays),
    extremeRainDays,
    precipitationTrendMmPerYear: precipitationTrend(months),
    confidence: months.length >= 18 ? "medium" : "low",
    months,
  };
}

export function centroidFromPolygon(polygon: Sentinel2Polygon): { lat: number; lng: number } {
  const ring = polygon.coordinates[0] ?? [];
  const points =
    ring.length > 1 &&
    ring[0]?.[0] === ring.at(-1)?.[0] &&
    ring[0]?.[1] === ring.at(-1)?.[1]
      ? ring.slice(0, -1)
      : ring;

  if (points.length === 0) {
    throw new Error("Cannot calculate climate centroid from an empty polygon.");
  }

  const totals = points.reduce(
    (sum, point) => ({
      lng: sum.lng + (point[0] ?? 0),
      lat: sum.lat + (point[1] ?? 0),
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length,
  };
}

function classifySeasonality(
  months: Era5ClimateMonth[],
): Era5ClimateSummary["seasonalDistribution"] {
  const rainyMonths = months.filter((month) => month.precipitationMm > 150).length;
  let consecutiveDryMonths = 0;
  let dryRun = 0;
  for (const month of months) {
    if (month.precipitationMm < 100) {
      dryRun++;
      consecutiveDryMonths = Math.max(consecutiveDryMonths, dryRun);
    } else {
      dryRun = 0;
    }
  }

  if (rainyMonths >= 4 && consecutiveDryMonths >= 2) return "balanced";
  if (rainyMonths >= 3 || consecutiveDryMonths >= 1) return "variable";
  return "stressed";
}

function classifyWaterStress(
  annualRainfallMm: number,
  meanTemperatureC: number,
  extremeRainDays: number,
): Era5ClimateSummary["waterStress"] {
  if (annualRainfallMm < 1000 || meanTemperatureC > 26 || extremeRainDays >= 8) {
    return "high";
  }
  if (annualRainfallMm < 1300 || annualRainfallMm > 2800 || meanTemperatureC > 24 || extremeRainDays >= 4) {
    return "medium";
  }
  return "low";
}

function precipitationTrend(months: Era5ClimateMonth[]): number | null {
  if (months.length < 12) return null;

  const half = Math.floor(months.length / 2);
  const first = months.slice(0, half);
  const second = months.slice(half);
  const firstAnnual = annualizedRainfall(first);
  const secondAnnual = annualizedRainfall(second);
  if (firstAnnual == null || secondAnnual == null) return null;

  const yearsBetweenHalves = months.length / 24;
  return Number(((secondAnnual - firstAnnual) / yearsBetweenHalves).toFixed(1));
}

function annualizedRainfall(months: Era5ClimateMonth[]): number | null {
  if (months.length === 0) return null;
  return (months.reduce((sum, month) => sum + month.precipitationMm, 0) / months.length) * 12;
}

function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
