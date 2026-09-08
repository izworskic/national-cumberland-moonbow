import { addDays, format, isValid, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ageMinutes as sharedAgeMinutes } from "@izworskic/national-outdoor-core";
import { TIMEZONE } from "./config";

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 1): number {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

export function parseTargetDate(value: string | null | undefined, now = new Date()): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parseISO(value);
    if (isValid(parsed)) return value;
  }
  return formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
}

export function localNightBounds(targetDate: string): { start: Date; end: Date } {
  const nextDate = format(addDays(parseISO(targetDate), 1), "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${targetDate}T17:00:00`, TIMEZONE),
    end: fromZonedTime(`${nextDate}T06:00:00`, TIMEZONE),
  };
}

export function buildFiveMinuteTimeline(targetDate: string): Date[] {
  const { start, end } = localNightBounds(targetDate);
  const output: Date[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += 5 * 60_000) output.push(new Date(time));
  return output;
}

export function formatLocal(iso: string | Date, pattern = "h:mm a"): string {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, TIMEZONE, pattern);
}

export function ageMinutes(timestamp: string | null, now = new Date()): number | null {
  return timestamp ? sharedAgeMinutes(timestamp, now.getTime()) : null;
}

export function hoursUntil(target: Date, now: Date): number {
  return (target.getTime() - now.getTime()) / 3_600_000;
}

export function circularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function isoDurationMilliseconds(duration: string): number {
  const match = duration.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return 0;
  return ((Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 60_000 + Number(match[4] ?? 0) * 1_000;
}

export function parseValidTime(value: string): { start: Date; end: Date } | null {
  const [startText, duration = "PT1H"] = value.split("/");
  const start = new Date(startText);
  const ms = isoDurationMilliseconds(duration);
  if (!Number.isFinite(start.getTime()) || ms <= 0) return null;
  return { start, end: new Date(start.getTime() + ms) };
}
