import { describe, expect, it } from "vitest";
import { estimatedMoonbowChance, evaluateDecision } from "@/lib/engine";
import { scoreTimestep } from "@/lib/scoring";
import { buildFiveMinuteTimeline } from "@/lib/time";
import type { ModelConsensusDataset, WeatherDataset } from "@/lib/types";
import { makeInputs, makeSatellite, makeWeather, TARGET_DATE } from "./helpers";

function consensus(weather: WeatherDataset, clouds: [number, number, number, number], spread: number): ModelConsensusDataset {
  const names = ["HRRR", "NBM", "ECMWF", "GFS"] as const;
  return {
    available: true,
    errors: [],
    sources: names.map((name) => ({ id: `open-meteo-${name.toLowerCase()}`, label: name, url: "https://open-meteo.com", timestamp: "2026-09-27T00:30:00.000Z", ageMinutes: 0, freshness: "fresh" as const })),
    points: weather.points.map((point) => ({
      start: point.start,
      end: point.end,
      cloudCover: clouds.reduce((sum, value) => sum + value, 0) / clouds.length,
      cloudCoverLow: clouds.reduce((sum, value) => sum + value, 0) / clouds.length,
      cloudCoverMid: 0,
      cloudCoverHigh: 0,
      visibilityM: 16_000,
      windSpeedMps: 2,
      windDirection: 256.5,
      windGustMps: 3,
      spread,
      modelCount: 4,
      models: names.map((name, index) => ({ model: name, cloudCover: clouds[index], cloudCoverLow: clouds[index], cloudCoverMid: 0, cloudCoverHigh: 0, visibilityM: 16_000, windSpeedMps: 2, windDirection: 256.5, windGustMps: 3 })),
    })),
  };
}

describe("moonbow live v2 evidence model", () => {
  it("publishes a coarse estimated chance only when date-specific evidence exists", () => {
    const weather = makeWeather();
    weather.modelConsensus = consensus(weather, [5, 8, 6, 7], 0.012);
    weather.sources.push(...weather.modelConsensus.sources);
    const result = evaluateDecision(makeInputs({ weather }));
    expect(result.estimatedChance).not.toBeNull();
    expect(result.estimatedChance! % 5).toBe(0);
    expect(result.notices.join(" ")).toContain("not an empirically calibrated success frequency");
    expect(estimatedMoonbowChance(result.score, { ...result.confidence, mode: "CLIMATOLOGY / PLANNING" }, result.bestWindow)).toBeNull();
  });

  it("model disagreement lowers confidence without inventing certainty", () => {
    const agreeingWeather = makeWeather();
    agreeingWeather.modelConsensus = consensus(agreeingWeather, [5, 7, 6, 5], 0.01);
    const disagreeingWeather = makeWeather();
    disagreeingWeather.modelConsensus = consensus(disagreeingWeather, [0, 95, 10, 90], 0.43);
    const agreeing = evaluateDecision(makeInputs({ weather: agreeingWeather, satellite: makeSatellite() }));
    const disagreeing = evaluateDecision(makeInputs({ weather: disagreeingWeather, satellite: makeSatellite() }));
    expect(agreeing.confidence.score).toBeGreaterThan(disagreeing.confidence.score);
    expect(disagreeing.confidence.reasons.join(" ")).toMatch(/disagree/i);
  });

  it("wind direction changes mist placement but never overrides physical gates", () => {
    const viable = buildFiveMinuteTimeline(TARGET_DATE).find((time) => scoreTimestep(time, makeInputs()).viable)!;
    const favorableWeather = makeWeather();
    favorableWeather.observation = null;
    favorableWeather.points.forEach((point) => { point.value.windDirection = 256.5; point.value.windSpeedMps = 3; });
    const adverseWeather = makeWeather();
    adverseWeather.observation = null;
    adverseWeather.points.forEach((point) => { point.value.windDirection = 76.5; point.value.windSpeedMps = 3; });
    const favorable = scoreTimestep(viable, makeInputs({ weather: favorableWeather }));
    const adverse = scoreTimestep(viable, makeInputs({ weather: adverseWeather }));
    expect(favorable.factors.mistPlacement).toBeGreaterThan(adverse.factors.mistPlacement);
    expect(favorable.score).toBeGreaterThan(adverse.score);
  });
});
