import { clamp, hoursUntil, round } from "./time";
import type { ConfidenceMode, ConfidenceResult, EngineInputs, TimelinePoint } from "./types";

export function confidenceMode(hours: number): ConfidenceMode {
  if (hours <= 3) return "NOWCAST";
  if (hours <= 24) return "HIGH-CONFIDENCE FORECAST";
  if (hours <= 72) return "FORECAST";
  if (hours <= 168) return "PLANNING FORECAST";
  return "CLIMATOLOGY / PLANNING";
}

function consensusSpread(inputs: EngineInputs, timeline: TimelinePoint[]): { mean: number | null; count: number } {
  const viableTimes = new Set(timeline.filter((point) => point.viable).map((point) => point.timestamp.slice(0, 13)));
  const spreads = (inputs.weather.modelConsensus?.points ?? [])
    .filter((point) => viableTimes.has(point.start.slice(0, 13)) && point.spread !== null && point.modelCount >= 2)
    .map((point) => point.spread!);
  if (!spreads.length) return { mean: null, count: 0 };
  return { mean: spreads.reduce((sum, value) => sum + value, 0) / spreads.length, count: spreads.length };
}

export function computeConfidence(inputs: EngineInputs, timeline: TimelinePoint[]): ConfidenceResult {
  const viable = timeline.filter((point) => point.viable);
  const event = new Date(viable[0]?.timestamp ?? timeline[Math.floor(timeline.length / 2)].timestamp);
  const horizon = Math.max(0, hoursUntil(event, inputs.now));
  const mode = confidenceMode(horizon);
  const astronomyImpossible = timeline.every((point) => point.hardGates.some((gate) => [
    "Astronomy calculation is invalid",
    "Moon is below the effective local skyline",
    "Moon is too high for primary-bow geometry",
    "Sky is not yet dark enough",
    "Lunar illumination is below the validated planning envelope",
    "Primary-bow geometry misses the visible mist field",
  ].includes(gate)));
  if (astronomyImpossible) {
    return {
      score: 95,
      level: "HIGH",
      mode,
      reasons: ["Deterministic Moon, darkness, skyline and bow geometry rule out every five-minute interval", "Weather and river uncertainty cannot reverse this physical NO-GO"],
      missing: [],
    };
  }
  let score = { NOWCAST: 90, "HIGH-CONFIDENCE FORECAST": 82, FORECAST: 70, "PLANNING FORECAST": 52, "CLIMATOLOGY / PLANNING": 35 }[mode];
  const reasons: string[] = ["Moon geometry and the cached local skyline are deterministic"];
  const missing: string[] = [];

  if (mode !== "CLIMATOLOGY / PLANNING") {
    if (!inputs.weather.available) { score -= 28; missing.push("NWS forecast"); }
    else if (inputs.weather.sources[0]?.freshness === "stale") { score -= 10; reasons.push("The NWS grid is stale"); }
    else reasons.push("An official NWS grid forecast covers the viewing window");
    if (!inputs.hydro.currentAvailable) { score -= 12; missing.push("current USGS flow"); }
    else if (inputs.hydro.source.freshness === "stale") { score -= 7; reasons.push("The river reading is stale"); }
    else reasons.push("USGS flow is current");

    const model = consensusSpread(inputs, timeline);
    if (!inputs.weather.modelConsensus?.available) {
      score -= 6;
      missing.push("multi-model cloud consensus");
    } else if (model.mean !== null) {
      if (model.mean <= 0.12) { score += 4; reasons.push("HRRR/NBM/global guidance closely agrees on clouds"); }
      else if (model.mean >= 0.35) { score -= 12; reasons.push("Weather models strongly disagree on cloud cover"); }
      else if (model.mean >= 0.25) { score -= 7; reasons.push("Weather models disagree on cloud cover"); }
      else if (model.mean >= 0.16) { score -= 3; reasons.push("Weather-model cloud spread is moderate"); }
      else reasons.push("Weather-model cloud agreement is good");
    }
  } else {
    reasons.push("Weather is intentionally replaced by seasonal planning context beyond seven days");
  }

  if (mode === "NOWCAST") {
    if (!inputs.satellite.available) { score -= 12; missing.push("GOES cloud mask"); }
    else if (inputs.satellite.source.freshness === "stale") { score -= 8; reasons.push("The satellite scan is stale"); }
    else reasons.push("GOES cloud observations are fused into the nowcast");
    if (!inputs.weather.observation) { score -= 8; missing.push("surface observation"); }
    else if (inputs.weather.observation.source.freshness === "stale") { score -= 5; reasons.push("The surface observation is stale"); }
    else reasons.push("A nearby NWS station confirms current conditions");
  }
  if (inputs.weather.errors.length) score -= Math.min(6, inputs.weather.errors.length * 2);
  score = round(clamp(score, 5, 95), 0);
  return { score, level: score >= 70 ? "HIGH" : score >= 45 ? "MODERATE" : "LOW", mode, reasons: reasons.slice(0, 5), missing };
}
