import { describe, expect, it } from "vitest";
import { astronomyAt, astronomyFactors } from "@/lib/astronomy";
import { evaluateDecision, unavailableSatellite } from "@/lib/engine";
import { unavailableWeather } from "@/lib/adapters/nws";
import { scoreTimestep } from "@/lib/scoring";
import { buildFiveMinuteTimeline, localNightBounds } from "@/lib/time";
import { makeHydro, makeInputs, makeSatellite, makeWeather, TARGET_DATE } from "./helpers";

describe("required deterministic decision scenarios", () => {
  it("1. full Moon + clear + good flow + valid geometry => GO", () => {
    const result = evaluateDecision(makeInputs());
    expect(result.decision).toBe("GO");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.bestWindow?.durationMinutes).toBeGreaterThanOrEqual(35);
  });

  it("2. 100% cloud => NO-GO despite excellent other variables", () => {
    const result = evaluateDecision(makeInputs({ weather: makeWeather({ cloud: 100, observationCloud: 100 }), satellite: makeSatellite({ cloud: 1 }) }));
    expect(result.decision).toBe("NO-GO");
    expect(result.timeline.some((point) => point.hardGates.includes("Cloud cover blocks direct moonlight"))).toBe(true);
  });

  it("3. clear sky + Moon below skyline => timestep NO-GO", () => {
    const inputs = makeInputs();
    const time = buildFiveMinuteTimeline(TARGET_DATE).find((candidate) => {
      const point = astronomyAt(candidate);
      return point.moonAltitude > 0 && point.moonAltitude <= point.effectiveSkyline;
    });
    expect(time).toBeDefined();
    const scored = scoreTimestep(time!, inputs);
    expect(scored.score).toBe(0);
    expect(scored.hardGates).toContain("Moon is below the effective local skyline");
  });

  it("4. clear sky + Moon too high => no viable timestep", () => {
    const date = "2026-01-03";
    const inputs = makeInputs({ targetDate: date, now: new Date("2026-01-04T04:00:00Z"), weather: { ...makeWeather(), points: [] } });
    const time = buildFiveMinuteTimeline(date).find((candidate) => astronomyAt(candidate).moonAltitude > 42);
    expect(time).toBeDefined();
    const scored = scoreTimestep(time!, inputs);
    expect(scored.viable).toBe(false);
    expect(scored.hardGates).toContain("Moon is too high for primary-bow geometry");
  });

  it("5. near-full Moon + weak flow materially reduces score", () => {
    const strong = evaluateDecision(makeInputs());
    const weak = evaluateDecision(makeInputs({ hydro: makeHydro({ factor: 0.2 }) }));
    expect(strong.score - weak.score).toBeGreaterThanOrEqual(12);
    expect(weak.hydro.mistLabel).toBe("LOW MIST");
  });

  it("6. excellent astronomy five days away stays a lower-confidence planning forecast", () => {
    const result = evaluateDecision(makeInputs({ now: new Date("2026-09-21T01:30:00Z"), satellite: unavailableSatellite("Not inside nowcast", true) }));
    expect(result.confidence.mode).toBe("PLANNING FORECAST");
    expect(result.confidence.score).toBeLessThan(70);
    expect(result.score).toBeGreaterThan(0);
    expect(result.decision).not.toBe("GO");
  });

  it("7. full Moon three weeks away uses planning mode, not fake weather", () => {
    const result = evaluateDecision(makeInputs({ now: new Date("2026-09-05T01:30:00Z"), weather: unavailableWeather("Beyond seven days", true), hydro: makeHydro({ available: false }), satellite: unavailableSatellite("Not inside nowcast", true) }));
    expect(result.confidence.mode).toBe("CLIMATOLOGY / PLANNING");
    expect(result.confidence.score).toBeLessThan(45);
    expect(result.decision).toBe("TOO EARLY TO CALL");
    expect(result.weather.sources[0].freshness).toBe("not-applicable");
  });

  it("8. satellite turning cloudy degrades a clear forecast nowcast", () => {
    const clear = evaluateDecision(makeInputs());
    const clouding = evaluateDecision(makeInputs({ satellite: makeSatellite({ cloud: .98, trend: "clouding" }) }));
    expect(clouding.score).toBeLessThan(clear.score - 15);
    expect(clouding.satellite.trend).toBe("clouding");
  });

  it("9. USGS unavailable is transparent and never fabricates current flow", () => {
    const result = evaluateDecision(makeInputs({ hydro: makeHydro({ available: false }) }));
    expect(result.hydro.dischargeCfs).toBeNull();
    expect(result.hydro.currentAvailable).toBe(false);
    expect(result.hydro.source.freshness).toBe("unavailable");
    expect(result.confidence.missing).toContain("current USGS flow");
  });

  it("10. NWS unavailable preserves astronomy and collapses weather confidence", () => {
    const result = evaluateDecision(makeInputs({ weather: unavailableWeather("NWS failed"), satellite: makeSatellite() }));
    expect(result.timeline.some((point) => point.astronomy.valid)).toBe(true);
    expect(result.confidence.score).toBeLessThan(60);
    expect(result.confidence.missing).toContain("NWS forecast");
  });

  it("11. satellite unavailable preserves forecast with lower nowcast confidence", () => {
    const complete = evaluateDecision(makeInputs());
    const missing = evaluateDecision(makeInputs({ satellite: makeSatellite({ available: false }) }));
    expect(missing.weather.available).toBe(true);
    expect(missing.confidence.score).toBeLessThan(complete.confidence.score);
    expect(missing.confidence.missing).toContain("GOES cloud mask");
  });

  it("12. stale observation remains visibly labeled stale", () => {
    const result = evaluateDecision(makeInputs({ weather: makeWeather({ observationFreshness: "stale" }) }));
    expect(result.weather.observation?.source.freshness).toBe("stale");
    expect(result.sources.find((source) => source.id === "nws-KBYL")?.freshness).toBe("stale");
  });

  it("13. a ten-minute cloud break cannot trigger a long-distance GO", () => {
    const { start } = localNightBounds(TARGET_DATE);
    const breakStart = new Date(start.getTime() + 5 * 3_600_000);
    const weather = makeWeather({ observationCloud: null, fiveMinuteCloud: (time) => Math.abs(time.getTime() - breakStart.getTime()) <= 5 * 60_000 ? 0 : 100 });
    const result = evaluateDecision(makeInputs({ driveCommitment: "3h", weather, satellite: makeSatellite({ available: false }) }));
    expect(result.decision).not.toBe("GO");
    expect(result.bestWindow?.durationMinutes ?? 0).toBeLessThan(35);
  });
});

describe("physics invariants", () => {
  it("multiplicative gates never allow a zero factor to score", () => {
    const time = buildFiveMinuteTimeline(TARGET_DATE).find((candidate) => astronomyFactors(astronomyAt(candidate)).gates.length === 0)!;
    const result = scoreTimestep(time, makeInputs({ hydro: makeHydro({ factor: 0 }) }));
    expect(result.score).toBe(0);
  });

  it("all output points retain explicit astronomy and source time context", () => {
    const result = evaluateDecision(makeInputs());
    expect(result.timeline).toHaveLength(157);
    expect(result.timeline.every((point) => point.timestamp && Number.isFinite(point.astronomy.moonAltitude))).toBe(true);
    expect(result.sources.every((source) => source.url && "timestamp" in source && "freshness" in source)).toBe(true);
  });
});
