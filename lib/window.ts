import { MODEL_CONFIG } from "./config";
import { round } from "./time";
import type { TimelinePoint, ViewingWindow } from "./types";

function robustPeak(timeline: TimelinePoint[]): { score: number; index: number } {
  const size = MODEL_CONFIG.decision.minimumGoWindowMinutes / MODEL_CONFIG.timestepMinutes;
  let best = { score: 0, index: 0 };
  for (let start = 0; start <= timeline.length - size; start += 1) {
    const points = timeline.slice(start, start + size);
    if (points.some((point) => !point.viable)) continue;
    const average = points.reduce((sum, point) => sum + point.score, 0) / points.length;
    if (average > best.score) best = { score: average, index: start + Math.floor(size / 2) };
  }
  return { score: round(best.score, 0), index: best.index };
}

function boundaryReason(point: TimelinePoint | undefined, fallback: string): string {
  if (!point) return fallback;
  if (point.hardGates.some((gate) => gate.includes("skyline"))) return "The Moon clears the effective terrain and tree skyline.";
  if (point.hardGates.some((gate) => gate.includes("dark"))) return "Nautical twilight ends and the sky becomes dark enough.";
  if (point.hardGates.some((gate) => gate.includes("too high"))) return "The Moon climbs above viable primary-bow geometry.";
  if (point.hardGates.some((gate) => gate.includes("mist field"))) return "The bow geometry moves outside the visible mist field.";
  if (point.hardGates.some((gate) => gate.includes("Cloud"))) return "Cloud cover blocks direct moonlight.";
  return fallback;
}

export function selectBestWindow(timeline: TimelinePoint[]): { score: number; window: ViewingWindow | null } {
  const robust = robustPeak(timeline);
  if (robust.score <= 0) return { score: 0, window: null };
  const floor = Math.max(45, robust.score - 15);
  let start = robust.index;
  let end = robust.index;
  while (start > 0 && timeline[start - 1].viable && timeline[start - 1].score >= floor) start -= 1;
  while (end < timeline.length - 1 && timeline[end + 1].viable && timeline[end + 1].score >= floor) end += 1;
  const slice = timeline.slice(start, end + 1);
  const peak = slice.reduce((best, point) => point.score > best.score ? point : best, slice[0]);
  const endTime = new Date(new Date(timeline[end].timestamp).getTime() + MODEL_CONFIG.timestepMinutes * 60_000);
  return {
    score: robust.score,
    window: {
      start: timeline[start].timestamp,
      end: endTime.toISOString(),
      peak: peak.timestamp,
      peakScore: peak.score,
      durationMinutes: (end - start + 1) * MODEL_CONFIG.timestepMinutes,
      startsBecause: boundaryReason(timeline[start - 1], "The sustained score enters its strongest period."),
      endsBecause: boundaryReason(timeline[end + 1], "The sustained score falls out of its strongest period."),
    },
  };
}
