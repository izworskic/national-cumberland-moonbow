import { DANGEROUS_ALERT_EVENTS, MODEL_CONFIG, VIEWPOINT } from "../config";
import { sourceStamp } from "../freshness";
import { timed } from "../logging";
import { clamp, parseValidTime } from "../time";
import type { ObservationSnapshot, WeatherDataset, WeatherPoint } from "../types";
import { fetchJson } from "./fetch";

interface GridValue<T> { validTime: string; value: T | null }
interface GridProperty<T> { uom?: string; values?: GridValue<T>[] }
interface NWSGrid {
  properties: {
    updateTime?: string;
    validTimes?: string;
    skyCover?: GridProperty<number>;
    probabilityOfPrecipitation?: GridProperty<number>;
    quantitativePrecipitation?: GridProperty<number>;
    relativeHumidity?: GridProperty<number>;
    windSpeed?: GridProperty<number>;
    windDirection?: GridProperty<number>;
    temperature?: GridProperty<number>;
    weather?: GridProperty<Array<{ coverage?: string; weather?: string; intensity?: string; visibility?: { value?: number } }>>;
  };
}
interface StationCollection { features: Array<{ properties: { stationIdentifier: string; name: string }; id: string }> }
interface NWSObservation {
  properties: {
    timestamp?: string;
    station?: string;
    textDescription?: string;
    temperature?: { value?: number | null };
    windSpeed?: { value?: number | null };
    windDirection?: { value?: number | null };
    visibility?: { value?: number | null };
    cloudLayers?: Array<{ amount?: string; base?: { value?: number | null } }>;
    presentWeather?: Array<{ weather?: string; intensity?: string }>;
  };
}
interface NWSAlerts { features: Array<{ id: string; properties: { event?: string; headline?: string; onset?: string; ends?: string; expires?: string } }> }

const GRID_URL = "https://api.weather.gov/gridpoints/JKL/28,14";
const STATIONS_URL = "https://api.weather.gov/gridpoints/JKL/28,14/stations";
const ALERTS_URL = `https://api.weather.gov/alerts/active?point=${VIEWPOINT.latitude},${VIEWPOINT.longitude}`;

function valueAt<T>(property: GridProperty<T> | undefined, time: Date): T | null {
  for (const candidate of property?.values ?? []) {
    const interval = parseValidTime(candidate.validTime);
    if (interval && time >= interval.start && time < interval.end) return candidate.value;
  }
  return null;
}

function cloudFromLayers(layers: NWSObservation["properties"]["cloudLayers"]): number | null {
  if (!layers?.length) return null;
  const amounts: Record<string, number> = { CLR: 0, SKC: 0, FEW: 20, SCT: 45, BKN: 78, OVC: 100, VV: 100 };
  const values = layers.map((layer) => amounts[layer.amount ?? ""]).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function normalizeConditions(value: Array<{ coverage?: string; weather?: string; intensity?: string }> | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => [item.coverage, item.intensity, item.weather].filter(Boolean).join(" ").replaceAll("_", " ")).filter(Boolean);
}

async function getObservation(stations: StationCollection, now: Date): Promise<ObservationSnapshot | null> {
  const station = stations.features[0];
  if (!station) return null;
  const observation = await fetchJson<NWSObservation>(`${station.id}/observations/latest?require_qc=true`, { revalidateSeconds: 300 });
  const properties = observation.properties;
  const timestamp = properties.timestamp ?? null;
  return {
    stationId: station.properties.stationIdentifier,
    stationName: station.properties.name,
    timestamp,
    cloudCover: cloudFromLayers(properties.cloudLayers),
    visibilityM: properties.visibility?.value ?? null,
    windSpeedMps: properties.windSpeed?.value ?? null,
    windDirection: properties.windDirection?.value ?? null,
    temperatureC: properties.temperature?.value ?? null,
    conditions: [properties.textDescription, ...(properties.presentWeather ?? []).map((item) => [item.intensity, item.weather].filter(Boolean).join(" "))].filter((value): value is string => Boolean(value)),
    source: sourceStamp({ id: `nws-${station.properties.stationIdentifier}`, label: `NWS observation · ${station.properties.stationIdentifier}`, url: `${station.id}/observations/latest`, timestamp, freshMinutes: MODEL_CONFIG.freshnessMinutes.observationFresh, staleMinutes: MODEL_CONFIG.freshnessMinutes.observationStale, now, detail: station.properties.name }),
  };
}

export function unavailableWeather(reason: string, notApplicable = false): WeatherDataset {
  return {
    available: false,
    generatedAt: null,
    points: [],
    observation: null,
    dangerousAlerts: [],
    sources: [{ id: "nws-grid", label: "NWS forecast grid JKL 28,14", url: GRID_URL, timestamp: null, ageMinutes: null, freshness: notApplicable ? "not-applicable" : "unavailable", detail: reason }],
    errors: notApplicable ? [] : [reason],
  };
}

export async function getWeather(start: Date, end: Date, now = new Date()): Promise<WeatherDataset> {
  if (start.getTime() - now.getTime() > 7 * 86_400_000) return unavailableWeather("Beyond the NWS seven-day forecast range", true);
  const errors: string[] = [];
  const [gridResult, stationsResult, alertsResult] = await Promise.allSettled([
    timed("nws_grid", () => fetchJson<NWSGrid>(GRID_URL, { revalidateSeconds: 900 })),
    timed("nws_stations", () => fetchJson<StationCollection>(STATIONS_URL, { revalidateSeconds: 86_400 })),
    timed("nws_alerts", () => fetchJson<NWSAlerts>(ALERTS_URL, { revalidateSeconds: 120 })),
  ]);
  const grid = gridResult.status === "fulfilled" ? gridResult.value : null;
  if (!grid) errors.push(gridResult.status === "rejected" ? String(gridResult.reason) : "NWS grid unavailable");
  let observation: ObservationSnapshot | null = null;
  if (stationsResult.status === "fulfilled") {
    try { observation = await timed("nws_observation", () => getObservation(stationsResult.value, now)); }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  } else errors.push(String(stationsResult.reason));
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value.features : [];
  if (alertsResult.status === "rejected") errors.push(String(alertsResult.reason));
  const generatedAt = grid?.properties.updateTime ?? null;
  const points: WeatherDataset["points"] = [];
  if (grid) {
    for (let time = start.getTime(); time < end.getTime(); time += 3_600_000) {
      const instant = new Date(time);
      const weatherValue = valueAt(grid.properties.weather, instant);
      const point: WeatherPoint = {
        cloudCover: valueAt(grid.properties.skyCover, instant),
        precipitationProbability: valueAt(grid.properties.probabilityOfPrecipitation, instant),
        quantitativePrecipitationMm: valueAt(grid.properties.quantitativePrecipitation, instant),
        relativeHumidity: valueAt(grid.properties.relativeHumidity, instant),
        windSpeedMps: valueAt(grid.properties.windSpeed, instant),
        windDirection: valueAt(grid.properties.windDirection, instant),
        temperatureC: valueAt(grid.properties.temperature, instant),
        conditions: normalizeConditions(weatherValue),
      };
      if (point.cloudCover !== null) point.cloudCover = clamp(point.cloudCover, 0, 100);
      if (point.quantitativePrecipitationMm !== null && grid.properties.quantitativePrecipitation?.uom?.endsWith(":m")) point.quantitativePrecipitationMm *= 1_000;
      if (point.windSpeedMps !== null && grid.properties.windSpeed?.uom?.includes("km_h-1")) point.windSpeedMps /= 3.6;
      points.push({ start: instant.toISOString(), end: new Date(time + 3_600_000).toISOString(), value: point });
    }
  }
  const source = sourceStamp({ id: "nws-grid", label: "NWS forecast grid JKL 28,14", url: GRID_URL, timestamp: generatedAt, freshMinutes: MODEL_CONFIG.freshnessMinutes.forecastFresh, staleMinutes: MODEL_CONFIG.freshnessMinutes.forecastStale, now, detail: "Official digital forecast for Cumberland Falls" });
  return {
    available: Boolean(grid && points.some((point) => point.value.cloudCover !== null)),
    generatedAt,
    points,
    observation,
    dangerousAlerts: alerts.filter((alert) => DANGEROUS_ALERT_EVENTS.includes((alert.properties.event ?? "") as (typeof DANGEROUS_ALERT_EVENTS)[number])).map((alert) => ({ event: alert.properties.event!, headline: alert.properties.headline ?? alert.properties.event!, onset: alert.properties.onset ?? null, ends: alert.properties.ends ?? alert.properties.expires ?? null, url: alert.id })),
    sources: [source, ...(observation ? [observation.source] : [])],
    errors,
  };
}
