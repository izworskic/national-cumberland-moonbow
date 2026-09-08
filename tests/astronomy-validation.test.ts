import { expect, it } from "vitest";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { astronomyAt, astronomyFactors } from "@/lib/astronomy";
import { OFFICIAL_WINDOWS_2026 } from "@/lib/schedule-2026";
import { TIMEZONE } from "@/lib/config";
import { buildFiveMinuteTimeline } from "@/lib/time";
import jpl from "@/lib/data/jpl-horizons-validation.json";

function clock(date: string, time: string): Date { const overnight = Number(time.slice(0, 2)) < 5; const day = overnight ? format(addDays(parseISO(date), 1), "yyyy-MM-dd") : date; return fromZonedTime(`${day}T${time}:00`, TIMEZONE); }

it("astronomy envelope overlaps every official 2026 park window", () => {
  const misses = OFFICIAL_WINDOWS_2026.filter((window) => {
    const start = clock(window.date, window.startLocal), end = clock(window.date, window.endLocal);
    return !buildFiveMinuteTimeline(window.date).some((time) => time >= start && time <= end && astronomyFactors(astronomyAt(time)).gates.length === 0);
  });
  expect(misses).toEqual([]);
});

it("matches direct NASA/JPL Horizons samples across the 2026 seasons", () => {
  for (const sample of jpl.samples) {
    const actual = astronomyAt(new Date(sample.timestamp));
    expect(Math.abs(actual.moonAzimuth - sample.azimuth)).toBeLessThanOrEqual(jpl.tolerances.azimuthDegrees);
    // Astronomy Engine applies standard atmospheric refraction; Horizons samples
    // use its default apparent-elevation treatment, hence the explicit tolerance.
    expect(Math.abs(actual.moonAltitude - sample.altitude)).toBeLessThanOrEqual(jpl.tolerances.altitudeDegrees);
    expect(Math.abs(actual.moonIllumination - sample.illumination)).toBeLessThanOrEqual(jpl.tolerances.illuminationFraction);
  }
});
