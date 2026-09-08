import climatology from "./data/flow-climatology.json";
import { clamp, round } from "./time";

interface DayStats {
  day: number;
  samples: number;
  min: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  max: number;
}

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000) + 1;
}

export function flowStats(date: Date): DayStats {
  return (climatology.days as DayStats[])[Math.min(365, Math.max(0, dayOfYear(date) - 1))];
}

export function estimatedPercentile(value: number, stats: DayStats): number {
  const knots: Array<[number, number]> = [
    [stats.min, 0], [stats.p10, 10], [stats.p25, 25], [stats.p50, 50],
    [stats.p75, 75], [stats.p90, 90], [stats.max, 100],
  ];
  if (value <= knots[0][0]) return 0;
  for (let index = 1; index < knots.length; index += 1) {
    const [upperValue, upperPercent] = knots[index];
    const [lowerValue, lowerPercent] = knots[index - 1];
    if (value <= upperValue) {
      if (upperValue === lowerValue) return upperPercent;
      return round(lowerPercent + ((value - lowerValue) / (upperValue - lowerValue)) * (upperPercent - lowerPercent), 0);
    }
  }
  return 100;
}

export function mistFactor(dischargeCfs: number): number {
  // A monotonic, saturating proxy: extra water helps progressively less. V1 does
  // not assert a narrow optimum before sighting reports support one.
  return clamp(0.18 + 0.82 * (1 - Math.exp(-Math.max(0, dischargeCfs) / 520)));
}

export function mistLabel(factor: number): "LOW MIST" | "ADEQUATE MIST" | "STRONG MIST" {
  if (factor < 0.48) return "LOW MIST";
  if (factor < 0.76) return "ADEQUATE MIST";
  return "STRONG MIST";
}

export const FLOW_CLIMATOLOGY_META = {
  station: climatology.station,
  period: climatology.period,
  recordCount: climatology.recordCount,
  generatedAt: climatology.generatedAt,
  windowDays: climatology.windowDays,
};
