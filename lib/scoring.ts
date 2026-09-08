import { MODEL_CONFIG } from "./config";
import { cloudClimatology } from "./cloud-climatology";
import { astronomyAt, astronomyFactors } from "./astronomy";
import { flowStats, mistFactor } from "./flow-climatology";
import { clamp, hoursUntil, round } from "./time";
import type { EngineInputs, FactorSet, SatelliteSnapshot, TimelinePoint, WeatherPoint } from "./types";

export function weatherAt(points: EngineInputs["weather"]["points"], time: Date): WeatherPoint | null {
  const match = points.find((point) => time >= new Date(point.start) && time < new Date(point.end));
  return match?.value ?? null;
}

function freshEnough(state: SatelliteSnapshot["source"]["freshness"]): boolean {
  return state === "fresh" || state === "aging";
}

export function fuseClouds(time: Date, now: Date, forecastPercent: number | null, inputs: EngineInputs): TimelinePoint["cloudInput"] {
  const forecast = forecastPercent === null ? null : clamp(forecastPercent / 100);
  const inNowcast = hoursUntil(time, now) >= -1 && hoursUntil(time, now) <= 3;
  const observation = inputs.weather.observation;
  const observed = inNowcast && observation && observation.cloudCover !== null && observation.source.freshness !== "stale"
    ? clamp(observation.cloudCover / 100)
    : null;
  const satellite = inNowcast && inputs.satellite.cloudProbability !== null && freshEnough(inputs.satellite.source.freshness)
    ? clamp(inputs.satellite.cloudProbability)
    : null;
  const weighted: Array<[number | null, number]> = inNowcast
    ? [[forecast, 0.35], [observed, 0.15], [satellite, 0.5]]
    : [[forecast, 1]];
  const usable = weighted.filter((entry): entry is [number, number] => entry[0] !== null);
  let fused: number | null = usable.length ? usable.reduce((sum, [value, weight]) => sum + value * weight, 0) / usable.reduce((sum, [, weight]) => sum + weight, 0) : null;
  if (fused !== null && inNowcast) {
    if (inputs.satellite.trend === "clouding") fused += 0.05;
    if (inputs.satellite.trend === "clearing") fused -= 0.05;
    fused = clamp(fused);
  }
  return { forecast, observed, satellite, fused };
}

export function cloudTransmission(cloudFraction: number | null, planning: boolean, month: number): number {
  if (cloudFraction === null) {
    if (!planning) return 0.16;
    // Sourced planning prior, never a date-specific forecast. Confidence remains
    // below the decision threshold until NWS forecast data become available.
    return cloudClimatology(month).expectedTransmission;
  }
  return clamp(Math.exp(-3.2 * cloudFraction ** 1.25));
}

function atmosphericClarity(time: Date, weather: WeatherPoint | null, inputs: EngineInputs): number {
  const inNowcast = hoursUntil(time, inputs.now) >= -1 && hoursUntil(time, inputs.now) <= 3;
  const observation = inNowcast ? inputs.weather.observation : null;
  let factor = 1;
  if (observation?.visibilityM !== null && observation?.visibilityM !== undefined) factor *= clamp((observation.visibilityM - 800) / 8_000, 0.08, 1);
  const conditions = [...(weather?.conditions ?? []), ...(observation?.conditions ?? [])].join(" ").toLowerCase();
  if (conditions.includes("dense fog")) factor *= 0.12;
  else if (conditions.includes("fog") || conditions.includes("mist")) factor *= 0.45;
  return clamp(factor, 0.05, 1);
}

function windFactor(time: Date, weather: WeatherPoint | null, inputs: EngineInputs): number {
  const inNowcast = hoursUntil(time, inputs.now) >= -1 && hoursUntil(time, inputs.now) <= 3;
  const observed = inNowcast ? inputs.weather.observation?.windSpeedMps : null;
  const speed = observed ?? weather?.windSpeedMps ?? null;
  if (speed === null || speed === undefined) return 0.88;
  return clamp(1 - Math.max(0, speed - 4) / 35, 0.72, 1);
}

export function scoreFactors(factors: FactorSet): number {
  const weights = MODEL_CONFIG.weights;
  return 100 * factors.lunar ** weights.lunar * factors.geometry ** weights.geometry * factors.cloud ** weights.cloud * factors.mist ** weights.mist * factors.atmosphere ** weights.atmosphere * factors.wind ** weights.wind;
}

export function scoreTimestep(time: Date, inputs: EngineInputs): TimelinePoint {
  const astronomy = astronomyAt(time);
  const astronomyResult = astronomyFactors(astronomy);
  const weather = weatherAt(inputs.weather.points, time);
  const cloudInput = fuseClouds(time, inputs.now, weather?.cloudCover ?? null, inputs);
  const planning = hoursUntil(time, inputs.now) > 7 * 24;
  const hydroFactor = planning
    ? mistFactor(flowStats(time).p50)
    : inputs.hydro.factor ?? mistFactor(inputs.hydro.seasonalMedianCfs);
  const hardGates = [...astronomyResult.gates];
  if (cloudInput.fused !== null && cloudInput.fused >= 0.95) hardGates.push("Cloud cover blocks direct moonlight");
  if (inputs.weather.dangerousAlerts.length) hardGates.push(`Dangerous weather: ${inputs.weather.dangerousAlerts[0].event}`);
  const factors: FactorSet = {
    lunar: clamp(((astronomy.moonIllumination - 0.82) / 0.18) ** 0.5),
    geometry: astronomyResult.geometry,
    cloud: cloudTransmission(cloudInput.fused, planning, time.getUTCMonth()),
    mist: hydroFactor,
    atmosphere: atmosphericClarity(time, weather, inputs),
    wind: windFactor(time, weather, inputs),
  };
  const score = hardGates.length ? 0 : round(scoreFactors(factors), 0);
  return { timestamp: time.toISOString(), score, viable: hardGates.length === 0, factors, astronomy, weather, cloudInput, hardGates };
}
