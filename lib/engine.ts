import { addMinutes } from "date-fns";
import { astronomyAt, astronomyFactors, astronomySummary } from "./astronomy";
import { getHydro } from "./adapters/usgs";
import { getWeather, unavailableWeather } from "./adapters/nws";
import { getSatellite } from "./adapters/goes";
import { getModelConsensus } from "./adapters/open-meteo";
import { MODEL_CONFIG, SOURCES, TIMEZONE, VIEWPOINT } from "./config";
import { computeConfidence } from "./confidence";
import { decide } from "./decision";
import { flowStats, mistFactor, mistLabel } from "./flow-climatology";
import { logEvent } from "./logging";
import { OFFICIAL_WINDOWS_2026 } from "./schedule-2026";
import { scoreTimestep } from "./scoring";
import { buildFiveMinuteTimeline, clamp, formatLocal, hoursUntil, localNightBounds } from "./time";
import type { ConfidenceResult, DecisionResult, DriveCommitment, EngineInputs, HydroSnapshot, ModelConsensusDataset, SatelliteSnapshot, ViewingWindow } from "./types";
import { selectBestWindow } from "./window";

export function unavailableSatellite(reason: string, notApplicable = false): SatelliteSnapshot {
  return {
    available: false, satellite: null, timestamp: null, cloudProbability: null, classification: "UNAVAILABLE", trend: "unknown", imageUrl: SOURCES.goesImage.url,
    source: { id: "goes-19-acmc", label: "NOAA GOES East Clear Sky Mask", url: SOURCES.goes.url, timestamp: null, ageMinutes: null, freshness: notApplicable ? "not-applicable" : "unavailable", detail: reason }, errors: notApplicable ? [] : [reason],
  };
}

function unavailableConsensus(reason: string, notApplicable = false): ModelConsensusDataset {
  return {
    available: false,
    points: [],
    sources: [{ id: "open-meteo-model-consensus", label: "HRRR/NBM/ECMWF/GFS model consensus", url: SOURCES.openMeteo.url, timestamp: null, ageMinutes: null, freshness: notApplicable ? "not-applicable" : "unavailable", detail: reason }],
    errors: notApplicable ? [] : [reason],
  };
}

function planningWeather() {
  const weather = unavailableWeather("Beyond the seven-day date-specific forecast range", true);
  weather.sources.push({
    id: "ncei-cloud-climatology",
    label: SOURCES.climate.label,
    url: SOURCES.climate.url,
    timestamp: null,
    ageMinutes: null,
    freshness: "not-applicable",
    detail: "2015–2024 London-Corbin nighttime observations; seasonal tendency, not a date-specific forecast",
  });
  weather.modelConsensus = unavailableConsensus("Beyond the date-specific model-consensus range", true);
  return weather;
}

function planningHydro(targetDate: string, detail = "15-day day-of-year window; not a current river reading"): HydroSnapshot {
  const target = new Date(`${targetDate}T12:00:00Z`);
  const stats = flowStats(target);
  const factor = mistFactor(stats.p50);
  return {
    dischargeCfs: null,
    gageHeightFt: null,
    timestamp: null,
    percentile: 50,
    seasonalMedianCfs: stats.p50,
    trend: "unknown",
    mistLabel: mistLabel(factor),
    factor,
    currentAvailable: false,
    source: { id: "usgs-climatology", label: "USGS 1991–2025 daily-flow distribution", url: SOURCES.usgs.url, timestamp: null, ageMinutes: null, freshness: "not-applicable", detail },
    errors: [],
  };
}

export function estimatedMoonbowChance(score: number, confidence: ConfidenceResult, window: ViewingWindow | null): number | null {
  if (!window || score <= 0) return 0;
  if (confidence.mode === "CLIMATOLOGY / PLANNING") return null;
  const evidenceModifier = 0.72 + 0.28 * (confidence.score / 100);
  const confidenceCap = confidence.score >= 70 ? 95 : confidence.score >= 45 ? 80 : 65;
  const raw = clamp(score * evidenceModifier, 5, confidenceCap);
  return Math.round(raw / 5) * 5;
}

function makeDrivers(inputs: EngineInputs, score: number, window: DecisionResult["bestWindow"]): DecisionResult["drivers"] {
  const peak = window ? inputs.weather.points.find((point) => new Date(window.peak) >= new Date(point.start) && new Date(window.peak) < new Date(point.end))?.value : null;
  const modelPeak = window ? inputs.weather.modelConsensus?.points.find((point) => new Date(window.peak) >= new Date(point.start) && new Date(window.peak) < new Date(point.end)) : null;
  const output: DecisionResult["drivers"] = [];
  const illumination = astronomySummary(inputs.targetDate).illumination;
  output.push({ tone: illumination >= 0.97 ? "positive" : illumination >= 0.9 ? "info" : "caution", text: `The Moon is ${Math.round(illumination * 100)}% illuminated.` });
  if (!window) {
    const gateCounts = new Map<string, number>();
    for (const point of buildFiveMinuteTimeline(inputs.targetDate).map((time) => scoreTimestep(time, inputs))) {
      for (const gate of point.hardGates) gateCounts.set(gate, (gateCounts.get(gate) ?? 0) + 1);
    }
    const dominant = [...gateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([gate]) => gate);
    for (const gate of dominant) output.push({ tone: "negative", text: gate.endsWith(".") ? gate : `${gate}.` });
    output.push({ tone: "info", text: "Weather and river conditions cannot override a failed physical Moon gate." });
    return output.slice(0, 4);
  }
  if (modelPeak && modelPeak.modelCount >= 2) {
    const spread = modelPeak.spread === null ? null : Math.round(modelPeak.spread * 100);
    output.push({ tone: (spread ?? 0) <= 15 ? "positive" : (spread ?? 0) >= 30 ? "caution" : "info", text: `${modelPeak.modelCount} forecast models put cloud cover near ${Math.round(modelPeak.cloudCover ?? 0)}%${spread === null ? "" : ` with ${spread}-point spread`}.` });
  } else if (peak?.cloudCover !== null && peak?.cloudCover !== undefined) {
    output.push({ tone: peak.cloudCover <= 25 ? "positive" : peak.cloudCover >= 75 ? "negative" : "caution", text: `NWS expects about ${Math.round(peak.cloudCover)}% cloud cover near the best window.` });
  } else output.push({ tone: "caution", text: "No date-specific cloud forecast is available; weather is not being presented as live." });
  const flowText = inputs.hydro.currentAvailable && inputs.hydro.dischargeCfs !== null
    ? `${Math.round(inputs.hydro.dischargeCfs).toLocaleString()} CFS (${inputs.hydro.percentile ?? "—"}th seasonal percentile)`
    : `${Math.round(inputs.hydro.seasonalMedianCfs).toLocaleString()} CFS seasonal median`;
  output.push({ tone: inputs.hydro.mistLabel === "LOW MIST" ? "caution" : "positive", text: `${inputs.hydro.mistLabel.replace(" MIST", "").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())} mist proxy from ${flowText}.` });
  output.push({ tone: "info", text: `${window.startsBecause} Peak physical score is ${score}.` });
  return output.slice(0, 4);
}

export function evaluateDecision(inputs: EngineInputs): DecisionResult {
  const timeline = buildFiveMinuteTimeline(inputs.targetDate).map((time) => scoreTimestep(time, inputs));
  const selected = selectBestWindow(timeline);
  const confidence = computeConfidence(inputs, timeline);
  const decisionResult = decide(selected.score, confidence, selected.window, timeline, inputs.driveCommitment);
  const estimatedChance = estimatedMoonbowChance(selected.score, confidence, selected.window);
  const arrivalTime = selected.window ? addMinutes(new Date(selected.window.start), -MODEL_CONFIG.decision.arrivalLeadMinutes).toISOString() : null;
  const official = OFFICIAL_WINDOWS_2026.find((window) => window.date === inputs.targetDate);
  const sources = [
    { id: "astronomy-engine", label: SOURCES.astronomy.label, url: SOURCES.astronomy.url, timestamp: null, ageMinutes: null, freshness: "not-applicable" as const, detail: "Calculated locally at five-minute resolution" },
    { id: "usgs-3dep", label: "USGS 3DEP cached horizon", url: SOURCES.terrain.url, timestamp: "2026-09-08T00:00:00.000Z", ageMinutes: null, freshness: "not-applicable" as const, detail: "Bare-earth profile plus separately modeled tree line" },
    inputs.hydro.source,
    ...inputs.weather.sources,
    ...(inputs.weather.observation && !inputs.weather.sources.some((source) => source.id === inputs.weather.observation!.source.id) ? [inputs.weather.observation.source] : []),
    inputs.satellite.source,
  ];
  logEvent("info", "decision_calculated", { target_date: inputs.targetDate, score: selected.score, estimated_chance: estimatedChance, confidence: confidence.score, decision: decisionResult.decision, drive: inputs.driveCommitment, model: MODEL_CONFIG.id, hard_gates: [...new Set(timeline.flatMap((point) => point.hardGates))], source_states: Object.fromEntries(sources.map((source) => [source.id, source.freshness])) });
  return {
    generatedAt: inputs.now.toISOString(), targetDate: inputs.targetDate, timezone: TIMEZONE,
    decision: decisionResult.decision, decisionReason: decisionResult.reason, score: selected.score, scoreLabel: "Moonbow Score",
    estimatedChance, chanceLabel: "Estimated Moonbow Chance",
    confidence, driveCommitment: inputs.driveCommitment, bestWindow: selected.window, arrivalTime,
    drivers: makeDrivers(inputs, selected.score, selected.window), timeline, astronomySummary: astronomySummary(inputs.targetDate), hydro: inputs.hydro, satellite: inputs.satellite, weather: inputs.weather, viewpoint: VIEWPOINT, sources,
    notices: ["Estimated Moonbow Chance is a coarse model estimate, not an empirically calibrated success frequency.", "The Moonbow Score is the underlying physical opportunity index; forecast confidence is calculated separately.", ...(official ? ["This date is inside Kentucky State Parks’ approximate 2026 moonbow schedule."] : []), "The tree-line and mist-placement corrections remain conservative and will be refined with observer reports."],
  };
}

export async function getLiveDecision(targetDate: string, driveCommitment: DriveCommitment = "local", now = new Date(), forceLiveData = false): Promise<DecisionResult> {
  const bounds = localNightBounds(targetDate);
  const hours = hoursUntil(bounds.start, now);
  const planning = hours > 7 * 24;
  const nowcast = hours <= 3 && hours >= -13;
  const astronomyImpossible = buildFiveMinuteTimeline(targetDate).every((time) => astronomyFactors(astronomyAt(time)).gates.length > 0);
  if (astronomyImpossible && !forceLiveData) {
    const detail = "Current flow not queried because deterministic Moon gates rule out this night; seasonal distribution shown for context";
    const weather = unavailableWeather("Weather not queried because deterministic Moon gates rule out this night", true);
    weather.modelConsensus = unavailableConsensus("Model guidance not queried because deterministic Moon gates rule out this night", true);
    return evaluateDecision({ targetDate, now, driveCommitment, weather, hydro: planningHydro(targetDate, detail), satellite: unavailableSatellite("Satellite not queried because deterministic Moon gates rule out this night", true) });
  }
  const [hydro, weather, satellite, modelConsensus] = await Promise.all([
    planning ? Promise.resolve(planningHydro(targetDate)) : getHydro(now),
    planning ? Promise.resolve(planningWeather()) : getWeather(bounds.start, bounds.end, now),
    nowcast || forceLiveData ? getSatellite(now) : Promise.resolve(unavailableSatellite("Satellite nowcast activates inside three hours", true)),
    planning ? Promise.resolve(unavailableConsensus("Beyond the date-specific model-consensus range", true)) : getModelConsensus(bounds.start, bounds.end, now),
  ]);
  if (!planning) {
    weather.modelConsensus = modelConsensus;
    weather.sources.push(...modelConsensus.sources);
    weather.errors.push(...modelConsensus.errors);
  }
  return evaluateDecision({ targetDate, now, driveCommitment, weather, hydro, satellite });
}

export function conciseWindow(result: DecisionResult): string {
  return result.bestWindow ? `${formatLocal(result.bestWindow.start)}–${formatLocal(result.bestWindow.end)}` : "No viable window";
}
