import { MODEL_CONFIG, SOURCES, VIEWPOINT } from "../config";
import { sourceStamp } from "../freshness";
import { timed } from "../logging";
import { clamp, round } from "../time";
import type { ModelConsensusDataset, ModelConsensusPoint, ModelForecastValue, WeatherModelName } from "../types";
import { fetchJson } from "./fetch";

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    cloud_cover?: Array<number | null>;
    cloud_cover_low?: Array<number | null>;
    cloud_cover_mid?: Array<number | null>;
    cloud_cover_high?: Array<number | null>;
    visibility?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_direction_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
  };
}

const MODELS: Array<{ name: WeatherModelName; slug: string; label: string }> = [
  { name: "HRRR", slug: "ncep_hrrr_conus", label: "NOAA HRRR 3 km" },
  { name: "NBM", slug: "ncep_nbm_conus", label: "NOAA NBM 2.5 km" },
  { name: "ECMWF", slug: "ecmwf_ifs", label: "ECMWF IFS HRES 9 km" },
  { name: "GFS", slug: "ncep_gfs_seamless", label: "NOAA GFS seamless" },
];

function isoUtc(value: string): string {
  return value.endsWith("Z") ? value : `${value}Z`;
}

function weightedMean(values: Array<{ value: number | null; weight: number }>): number | null {
  const usable = values.filter((item): item is { value: number; weight: number } => item.value !== null && Number.isFinite(item.value));
  if (!usable.length) return null;
  const weight = usable.reduce((sum, item) => sum + item.weight, 0);
  return usable.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
}

function circularWeightedMean(values: Array<{ value: number | null; weight: number }>): number | null {
  const usable = values.filter((item): item is { value: number; weight: number } => item.value !== null && Number.isFinite(item.value));
  if (!usable.length) return null;
  const vector = usable.reduce((acc, item) => {
    const radians = item.value * Math.PI / 180;
    acc.x += Math.cos(radians) * item.weight;
    acc.y += Math.sin(radians) * item.weight;
    return acc;
  }, { x: 0, y: 0 });
  return (Math.atan2(vector.y, vector.x) * 180 / Math.PI + 360) % 360;
}

function cloudSpread(models: ModelForecastValue[]): number | null {
  const values = models.map((model) => model.cloudCover).filter((value): value is number => value !== null);
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return round(Math.sqrt(variance) / 100, 3);
}

function pointAt(response: OpenMeteoResponse, model: WeatherModelName, index: number): ModelForecastValue {
  const hourly = response.hourly ?? {};
  return {
    model,
    cloudCover: hourly.cloud_cover?.[index] ?? null,
    cloudCoverLow: hourly.cloud_cover_low?.[index] ?? null,
    cloudCoverMid: hourly.cloud_cover_mid?.[index] ?? null,
    cloudCoverHigh: hourly.cloud_cover_high?.[index] ?? null,
    visibilityM: hourly.visibility?.[index] ?? null,
    windSpeedMps: hourly.wind_speed_10m?.[index] ?? null,
    windDirection: hourly.wind_direction_10m?.[index] ?? null,
    windGustMps: hourly.wind_gusts_10m?.[index] ?? null,
  };
}

async function fetchModel(model: (typeof MODELS)[number], startDate: string, endDate: string): Promise<{ model: WeatherModelName; label: string; values: Map<string, ModelForecastValue> }> {
  const params = new URLSearchParams({
    latitude: String(VIEWPOINT.latitude),
    longitude: String(VIEWPOINT.longitude),
    models: model.slug,
    hourly: "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "ms",
    timezone: "UTC",
    start_date: startDate,
    end_date: endDate,
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const response = await timed(`open_meteo_${model.name.toLowerCase()}`, () => fetchJson<OpenMeteoResponse>(url, { revalidateSeconds: 900 }));
  const times = response.hourly?.time ?? [];
  const values = new Map<string, ModelForecastValue>();
  times.forEach((time, index) => values.set(isoUtc(time), pointAt(response, model.name, index)));
  if (!values.size) throw new Error(`${model.name} returned no hourly forecast values`);
  return { model: model.name, label: model.label, values };
}

export async function getModelConsensus(start: Date, end: Date, now = new Date()): Promise<ModelConsensusDataset> {
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const settled = await Promise.allSettled(MODELS.map((model) => fetchModel(model, startDate, endDate)));
  const successful = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const errors = settled.flatMap((result, index) => result.status === "rejected" ? [`${MODELS[index].name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`] : []);
  const sources = MODELS.map((model, index) => {
    const success = settled[index].status === "fulfilled";
    return sourceStamp({
      id: `open-meteo-${model.name.toLowerCase()}`,
      label: `${model.label} via Open-Meteo`,
      url: SOURCES.openMeteo.url,
      timestamp: success ? now.toISOString() : null,
      freshMinutes: MODEL_CONFIG.freshnessMinutes.forecastFresh,
      staleMinutes: MODEL_CONFIG.freshnessMinutes.forecastStale,
      now,
      detail: success ? "Latest available model forecast; timestamp records retrieval freshness" : "Model forecast unavailable",
    });
  });
  const times = [...new Set(successful.flatMap((item) => [...item.values.keys()]))].sort();
  const points: ModelConsensusPoint[] = times.map((timestamp) => {
    const models = successful.flatMap((item) => {
      const value = item.values.get(timestamp);
      return value ? [value] : [];
    });
    const weighted = <K extends keyof ModelForecastValue>(key: K): number | null => weightedMean(models.map((model) => ({ value: typeof model[key] === "number" ? model[key] as number : null, weight: MODEL_CONFIG.modelWeights[model.model] })));
    return {
      start: timestamp,
      end: new Date(new Date(timestamp).getTime() + 3_600_000).toISOString(),
      cloudCover: weighted("cloudCover") === null ? null : round(clamp(weighted("cloudCover")!, 0, 100), 1),
      cloudCoverLow: weighted("cloudCoverLow") === null ? null : round(clamp(weighted("cloudCoverLow")!, 0, 100), 1),
      cloudCoverMid: weighted("cloudCoverMid") === null ? null : round(clamp(weighted("cloudCoverMid")!, 0, 100), 1),
      cloudCoverHigh: weighted("cloudCoverHigh") === null ? null : round(clamp(weighted("cloudCoverHigh")!, 0, 100), 1),
      visibilityM: weighted("visibilityM") === null ? null : round(Math.max(0, weighted("visibilityM")!), 0),
      windSpeedMps: weighted("windSpeedMps") === null ? null : round(Math.max(0, weighted("windSpeedMps")!), 2),
      windDirection: circularWeightedMean(models.map((model) => ({ value: model.windDirection, weight: MODEL_CONFIG.modelWeights[model.model] }))),
      windGustMps: weighted("windGustMps") === null ? null : round(Math.max(0, weighted("windGustMps")!), 2),
      spread: cloudSpread(models),
      modelCount: models.filter((model) => model.cloudCover !== null).length,
      models,
    };
  }).filter((point) => new Date(point.start) < end && new Date(point.end) > start);
  return { available: points.some((point) => point.modelCount >= 2), points, sources, errors };
}
