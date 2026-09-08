import { MODEL_CONFIG } from "./config";
import { ageMinutes } from "./time";
import type { FreshnessState, SourceStamp } from "./types";

export function freshness(timestamp: string | null, freshMinutes: number, staleMinutes: number, now: Date): FreshnessState {
  const age = ageMinutes(timestamp, now);
  if (age === null) return "unavailable";
  if (age <= freshMinutes) return "fresh";
  if (age <= staleMinutes) return "aging";
  return "stale";
}

export function sourceStamp(input: Omit<SourceStamp, "ageMinutes" | "freshness"> & { freshMinutes: number; staleMinutes: number; now: Date }): SourceStamp {
  const { freshMinutes, staleMinutes, now, ...source } = input;
  return {
    ...source,
    ageMinutes: ageMinutes(source.timestamp, now),
    freshness: freshness(source.timestamp, freshMinutes, staleMinutes, now),
  };
}

export const freshnessThresholds = MODEL_CONFIG.freshnessMinutes;
