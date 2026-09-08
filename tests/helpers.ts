import { localNightBounds } from "@/lib/time";
import type { EngineInputs, HydroSnapshot, SatelliteSnapshot, SourceStamp, WeatherDataset, WeatherPoint } from "@/lib/types";

export const TARGET_DATE = "2026-09-26";
export const EVENT_NOW = new Date("2026-09-27T00:30:00.000Z");

export function stamp(id: string, timestamp = EVENT_NOW.toISOString(), freshness: SourceStamp["freshness"] = "fresh"): SourceStamp {
  return { id, label: id, url: `https://example.test/${id}`, timestamp, ageMinutes: freshness === "stale" ? 180 : 0, freshness };
}

export function weatherPoint(cloudCover = 5): WeatherPoint {
  return { cloudCover, precipitationProbability: 0, quantitativePrecipitationMm: 0, relativeHumidity: 65, windSpeedMps: 2, windDirection: 90, temperatureC: 16, conditions: ["Clear"] };
}

export function makeWeather(options: { cloud?: number; available?: boolean; observationCloud?: number | null; observationFreshness?: SourceStamp["freshness"]; errors?: string[]; fiveMinuteCloud?: (time: Date) => number } = {}): WeatherDataset {
  const bounds = localNightBounds(TARGET_DATE);
  const points: WeatherDataset["points"] = [];
  const step = options.fiveMinuteCloud ? 5 * 60_000 : 60 * 60_000;
  for (let time = bounds.start.getTime(); time < bounds.end.getTime(); time += step) {
    const date = new Date(time);
    points.push({ start: date.toISOString(), end: new Date(time + step).toISOString(), value: weatherPoint(options.fiveMinuteCloud ? options.fiveMinuteCloud(date) : options.cloud ?? 5) });
  }
  const available = options.available ?? true;
  return {
    available,
    generatedAt: available ? EVENT_NOW.toISOString() : null,
    points: available ? points : [],
    observation: available ? {
      stationId: "KBYL", stationName: "Williamsburg", timestamp: EVENT_NOW.toISOString(), cloudCover: options.observationCloud === undefined ? 5 : options.observationCloud,
      visibilityM: 16_000, windSpeedMps: 2, windDirection: 90, temperatureC: 16, conditions: ["Clear"], source: stamp("nws-KBYL", EVENT_NOW.toISOString(), options.observationFreshness ?? "fresh"),
    } : null,
    dangerousAlerts: [],
    sources: [available ? stamp("nws-grid") : { ...stamp("nws-grid"), timestamp: null, ageMinutes: null, freshness: "unavailable" }],
    errors: options.errors ?? (available ? [] : ["NWS fixture unavailable"]),
  };
}

export function makeHydro(options: { factor?: number | null; available?: boolean; freshness?: SourceStamp["freshness"] } = {}): HydroSnapshot {
  const available = options.available ?? true;
  return {
    dischargeCfs: available ? 1_600 : null, gageHeightFt: available ? 3.4 : null, timestamp: available ? EVENT_NOW.toISOString() : null,
    percentile: available ? 82 : null, seasonalMedianCfs: 520, trend: available ? "steady" : "unknown", mistLabel: available ? ((options.factor ?? 0.86) < 0.48 ? "LOW MIST" : "STRONG MIST") : "UNKNOWN",
    factor: options.factor === undefined ? (available ? 0.86 : null) : options.factor, currentAvailable: available,
    source: available ? stamp("usgs-03404500", EVENT_NOW.toISOString(), options.freshness ?? "fresh") : { ...stamp("usgs-03404500"), timestamp: null, ageMinutes: null, freshness: "unavailable", detail: "No current reading" }, errors: available ? [] : ["USGS fixture unavailable"],
  };
}

export function makeSatellite(options: { cloud?: number | null; available?: boolean; freshness?: SourceStamp["freshness"]; trend?: SatelliteSnapshot["trend"] } = {}): SatelliteSnapshot {
  const available = options.available ?? true;
  const cloud = options.cloud === undefined ? 0.05 : options.cloud;
  return {
    available, satellite: available ? "GOES-19" : null, timestamp: available ? EVENT_NOW.toISOString() : null, cloudProbability: available ? cloud : null,
    classification: !available || cloud === null ? "UNAVAILABLE" : cloud < .25 ? "CLEAR" : cloud < .5 ? "PROBABLY CLEAR" : cloud < .75 ? "PROBABLY CLOUDY" : "CLOUDY",
    trend: options.trend ?? "steady", imageUrl: "https://example.test/satellite.jpg",
    source: available ? stamp("goes-19-acmc", EVENT_NOW.toISOString(), options.freshness ?? "fresh") : { ...stamp("goes-19-acmc"), timestamp: null, ageMinutes: null, freshness: "unavailable" }, errors: available ? [] : ["Satellite fixture unavailable"],
  };
}

export function makeInputs(overrides: Partial<EngineInputs> = {}): EngineInputs {
  return { targetDate: TARGET_DATE, now: EVENT_NOW, driveCommitment: "local", weather: makeWeather(), hydro: makeHydro(), satellite: makeSatellite(), ...overrides };
}
