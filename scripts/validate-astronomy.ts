import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { astronomyAt, astronomyFactors } from "../lib/astronomy";
import { TIMEZONE } from "../lib/config";
import { OFFICIAL_WINDOWS_2026 } from "../lib/schedule-2026";
import { buildFiveMinuteTimeline, formatLocal } from "../lib/time";
import jpl from "../lib/data/jpl-horizons-validation.json";

function officialTime(date: string, clock: string): Date {
  const nextDay = Number(clock.slice(0, 2)) < 5;
  const localDate = nextDay ? format(addDays(parseISO(date), 1), "yyyy-MM-dd") : date;
  return fromZonedTime(`${localDate}T${clock}:00`, TIMEZONE);
}

let overlapCount = 0;
let startErrors = 0;
const detail = OFFICIAL_WINDOWS_2026.map((window) => {
  const officialStart = officialTime(window.date, window.startLocal);
  const officialEnd = officialTime(window.date, window.endLocal);
  const viable = buildFiveMinuteTimeline(window.date).filter((time) => astronomyFactors(astronomyAt(time)).gates.length === 0);
  const engineStart = viable[0] ?? null;
  const engineEnd = viable.at(-1) ?? null;
  const overlap = engineStart && engineEnd && engineStart <= officialEnd && engineEnd >= officialStart;
  if (overlap) overlapCount += 1;
  const startErrorMinutes = engineStart ? Math.round((engineStart.getTime() - officialStart.getTime()) / 60_000) : null;
  if (startErrorMinutes !== null && Math.abs(startErrorMinutes) > 60) startErrors += 1;
  const start = astronomyAt(officialStart);
  return {
    date: window.date,
    official: `${window.startLocal}-${window.endLocal}`,
    modeled: engineStart && engineEnd ? `${formatLocal(engineStart)}-${formatLocal(engineEnd)}` : "none",
    overlap: Boolean(overlap),
    startErrorMinutes,
    moon: `${start.moonAltitude.toFixed(1)}° @ ${start.moonAzimuth.toFixed(0)}°`,
    skyline: `${start.effectiveSkyline.toFixed(1)}°`,
    geometryError: start.geometryError,
    illumination: start.moonIllumination,
    gatesAtOfficialStart: astronomyFactors(start).gates,
  };
});

console.table(detail);
console.log(JSON.stringify({
  windows: detail.length,
  overlapCount,
  overlapRate: overlapCount / detail.length,
  startsWithinOneHour: detail.length - startErrors,
}, null, 2));

const jplComparisons = jpl.samples.map((sample) => {
  const actual = astronomyAt(new Date(sample.timestamp));
  return {
    timestamp: sample.timestamp,
    azimuthErrorDegrees: Number(Math.abs(actual.moonAzimuth - sample.azimuth).toFixed(4)),
    altitudeErrorDegrees: Number(Math.abs(actual.moonAltitude - sample.altitude).toFixed(4)),
    illuminationError: Number(Math.abs(actual.moonIllumination - sample.illumination).toFixed(6)),
  };
});
console.table(jplComparisons);
console.log(`JPL validation: ${jplComparisons.length}/${jplComparisons.length} samples within pinned tolerances.`);
