import { MODEL_CONFIG, VIEWPOINT } from "./config";
import { cloudClimatology } from "./cloud-climatology";
import { astronomyAt, astronomyFactors } from "./astronomy";
import { flowStats, mistFactor } from "./flow-climatology";
import { clamp, circularDifference, hoursUntil, round } from "./time";
import type { EngineInputs, FactorSet, ModelConsensusPoint, SatelliteSnapshot, TimelinePoint, WeatherPoint } from "./types";

export function weatherAt(points: EngineInputs["weather"]["points"], time: Date): WeatherPoint | null {
  const match = points.find((point) => time >= new Date(point.start) && time < new Date(point.end));
  return match?.value ?? null;
}

export function consensusAt(inputs: EngineInputs, time: Date): ModelConsensusPoint | null {
  return inputs.weather.modelConsensus?.points.find((point) => time >= new Date(point.start) && time < new Date(point.end)) ?? null;
}

function freshEnough(state: SatelliteSnapshot["source"]["freshness"]): boolean {
  return state === "fresh" || state === "aging";
}

export function layeredCloudFraction(point: ModelConsensusPoint | null): number | null {
  if (!point) return null;
  const layers = [point.cloudCoverLow, point.cloudCoverMid, point.cloudCoverHigh];
  if (layers.every((value) => value === null)) return point.cloudCover === null ? null : clamp(point.cloudCover / 100);
  const low = clamp((point.cloudCoverLow ?? point.cloudCover ?? 0) / 100);
  const mid = clamp((point.cloudCoverMid ?? point.cloudCover ?? 0) / 100);
  const high = clamp((point.cloudCoverHigh ?? point.cloudCover ?? 0) / 100);
  // Low opaque clouds are most damaging to direct moonlight. Mid-level clouds
  // remain a strong penalty; high cloud is treated more gently because thin
  // cirrus can still transmit useful lunar light.
  return clamp(1 - (1 - 0.9 * low) * (1 - 0.72 * mid) * (1 - 0.42 * high));
}

export function fuseClouds(time: Date, now: Date, forecastPercent: number | null, inputs: EngineInputs): TimelinePoint["cloudInput"] {
  const forecast = forecastPercent === null ? null : clamp(forecastPercent / 100);
  const modelPoint = consensusAt(inputs, time);
  const multiModel = layeredCloudFraction(modelPoint);
  const inNowcast = hoursUntil(time, now) >= -1 && hoursUntil(time, now) <= 3;
  const observation = inputs.weather.observation;
  const observed = inNowcast && observation && observation.cloudCover !== null && observation.source.freshness !== "stale"
    ? clamp(observation.cloudCover / 100)
    : null;
  const satellite = inNowcast && inputs.satellite.cloudProbability !== null && freshEnough(inputs.satellite.source.freshness)
    ? clamp(inputs.satellite.cloudProbability)
    : null;
  const weighted: Array<[number | null, number]> = inNowcast
    ? [[forecast, 0.2], [multiModel, 0.25], [observed, 0.1], [satellite, 0.45]]
    : [[forecast, 0.35], [multiModel, 0.65]];
  const usable = weighted.filter((entry): entry is [number, number] => entry[0] !== null);
  let fused: number | null = usable.length ? usable.reduce((sum, [value, weight]) => sum + value * weight, 0) / usable.reduce((sum, [, weight]) => sum + weight, 0) : null;
  if (fused !== null && inNowcast) {
    if (inputs.satellite.trend === "clouding") fused += 0.05;
    if (inputs.satellite.trend === "clearing") fused -= 0.05;
    fused = clamp(fused);
  }
  return { forecast, multiModel, modelSpread: modelPoint?.spread ?? null, observed, satellite, fused };
}

export function cloudTransmission(cloudFraction: number | null, planning: boolean, month: number): number {
  if (cloudFraction === null) {
    if (!planning) return 0.16;
    return cloudClimatology(month).expectedTransmission;
  }
  return clamp(Math.exp(-3.2 * cloudFraction ** 1.25));
}

function atmosphericClarity(time: Date, weather: WeatherPoint | null, inputs: EngineInputs): number {
  const inNowcast = hoursUntil(time, inputs.now) >= -1 && hoursUntil(time, inputs.now) <= 3;
  const observation = inNowcast ? inputs.weather.observation : null;
  const model = consensusAt(inputs, time);
  const visibility = observation?.visibilityM ?? weather?.visibilityM ?? model?.visibilityM ?? null;
  let factor = 1;
  if (visibility !== null) factor *= clamp((visibility - 800) / 8_000, 0.08, 1);
  const conditions = [...(weather?.conditions ?? []), ...(observation?.conditions ?? [])].join(" ").toLowerCase();
  if (conditions.includes("dense fog")) factor *= 0.12;
  else if (conditions.includes("fog") || conditions.includes("mist")) factor *= 0.45;
  return clamp(factor, 0.05, 1);
}

function windInputs(time: Date, weather: WeatherPoint | null, inputs: EngineInputs): { speed: number | null; direction: number | null; gust: number | null } {
  const inNowcast = hoursUntil(time, inputs.now) >= -1 && hoursUntil(time, inputs.now) <= 3;
  const observation = inNowcast ? inputs.weather.observation : null;
  const model = consensusAt(inputs, time);
  return {
    speed: observation?.windSpeedMps ?? model?.windSpeedMps ?? weather?.windSpeedMps ?? null,
    direction: observation?.windDirection ?? model?.windDirection ?? weather?.windDirection ?? null,
    gust: model?.windGustMps ?? weather?.windGustMps ?? null,
  };
}

function windFactor(time: Date, weather: WeatherPoint | null, inputs: EngineInputs): number {
  const { speed, gust } = windInputs(time, weather, inputs);
  if (speed === null) return 0.88;
  const sustainedPenalty = Math.max(0, speed - 4) / 28;
  const gustPenalty = gust === null ? 0 : Math.max(0, gust - 8) / 35;
  return clamp(1 - sustainedPenalty - gustPenalty, 0.58, 1);
}

export function mistPlacementFactor(time: Date, weather: WeatherPoint | null, inputs: EngineInputs): number {
  const { speed, direction } = windInputs(time, weather, inputs);
  if (speed === null || direction === null) return 0.86;
  if (speed < 0.7) return 0.92;
  // A meteorological wind FROM approximately the overlook-to-falls bearing
  // carries spray back toward the primary overlook. Direction is intentionally
  // a bounded modifier: local gorge turbulence is not resolved by 10 m grids.
  const difference = circularDifference(direction, VIEWPOINT.targetBearing);
  const alignment = (Math.cos(difference * Math.PI / 180) + 1) / 2;
  const directional = 0.62 + 0.38 * alignment;
  const speedShape = speed <= 5 ? 1 : clamp(1 - (speed - 5) / 24, 0.7, 1);
  return clamp(directional * speedShape, 0.5, 1);
}

export function scoreFactors(factors: FactorSet): number {
  const weights = MODEL_CONFIG.weights;
  return 100
    * factors.lunar ** weights.lunar
    * factors.geometry ** weights.geometry
    * factors.cloud ** weights.cloud
    * factors.mist ** weights.mist
    * factors.mistPlacement ** weights.mistPlacement
    * factors.atmosphere ** weights.atmosphere
    * factors.wind ** weights.wind;
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
  if (cloudInput.fused !== null && cloudInput.fused >= 0.97) hardGates.push("Cloud cover blocks direct moonlight");
  if (inputs.weather.dangerousAlerts.length) hardGates.push(`Dangerous weather: ${inputs.weather.dangerousAlerts[0].event}`);
  const factors: FactorSet = {
    lunar: clamp(((astronomy.moonIllumination - 0.82) / 0.18) ** 0.5),
    geometry: astronomyResult.geometry,
    cloud: cloudTransmission(cloudInput.fused, planning, time.getUTCMonth()),
    mist: hydroFactor,
    mistPlacement: mistPlacementFactor(time, weather, inputs),
    atmosphere: atmosphericClarity(time, weather, inputs),
    wind: windFactor(time, weather, inputs),
  };
  const score = hardGates.length ? 0 : round(scoreFactors(factors), 0);
  return { timestamp: time.toISOString(), score, viable: hardGates.length === 0, factors, astronomy, weather, cloudInput, hardGates };
}
