import { MODEL_CONFIG } from "./config";
import { clamp, round } from "./time";

export interface HorizonSample {
  azimuth: number;
  terrainDegrees: number;
  treeCorrectionDegrees: number;
  peakDistanceMeters: number;
}

// Bare-earth angles sampled from the Falls Overlook with the USGS 3DEP EPQS
// at 75–8,000 m along each ray on 2026-09-08. Tree corrections are a
// deliberately conservative V1 skyline envelope and remain separately visible.
export const HORIZON_PROFILE: HorizonSample[] = [
  [25, 3.5, 2.5, 1200], [30, 4.1, 2.5, 1200], [35, 6.3, 3, 300],
  [40, 6.9, 3.5, 300], [45, 7.2, 4, 150], [50, 7.8, 4.5, 150],
  [55, 9.6, 5, 150], [60, 12.4, 5.5, 150], [65, 16, 5.5, 150],
  [70, 17, 5.5, 150], [75, 17.2, 5.5, 150], [80, 16.9, 5.5, 150],
  [85, 16.5, 5.5, 150], [90, 15.8, 5.5, 150], [95, 14.8, 5, 150],
  [100, 13.7, 5, 150], [105, 12.5, 4.5, 150], [110, 11.2, 4.5, 150],
  [115, 10.1, 4, 150], [120, 9.1, 4, 150], [125, 8.1, 4, 150],
  [130, 7.2, 3.5, 150], [135, 6.5, 3.5, 150], [140, 5.8, 3, 150],
  [145, 4.6, 3, 150], [150, 3.5, 2.5, 1200], [160, 3, 2.5, 1200],
  [180, 2.5, 2, 1200], [210, 2, 2, 1200], [240, 1.5, 2, 1200],
  [270, 1, 2, 1200], [300, 1.5, 2, 1200], [330, 2.5, 2, 1200], [360, 3.5, 2.5, 1200],
].map(([azimuth, terrainDegrees, treeCorrectionDegrees, peakDistanceMeters]) => ({
  azimuth,
  terrainDegrees,
  treeCorrectionDegrees,
  peakDistanceMeters,
}));

function interpolate(azimuth: number): HorizonSample {
  const normalized = ((azimuth % 360) + 360) % 360;
  const profile = HORIZON_PROFILE;
  let upperIndex = profile.findIndex((point) => point.azimuth >= normalized);
  if (upperIndex < 0) upperIndex = profile.length - 1;
  const upper = profile[upperIndex];
  const lower = profile[Math.max(0, upperIndex - 1)];
  if (upper.azimuth === lower.azimuth) return upper;
  const mix = clamp((normalized - lower.azimuth) / (upper.azimuth - lower.azimuth));
  return {
    azimuth: normalized,
    terrainDegrees: lower.terrainDegrees + (upper.terrainDegrees - lower.terrainDegrees) * mix,
    treeCorrectionDegrees:
      lower.treeCorrectionDegrees + (upper.treeCorrectionDegrees - lower.treeCorrectionDegrees) * mix,
    peakDistanceMeters: Math.round(lower.peakDistanceMeters + (upper.peakDistanceMeters - lower.peakDistanceMeters) * mix),
  };
}

export function effectiveSkyline(azimuth: number): HorizonSample & { effectiveDegrees: number } {
  const point = interpolate(azimuth);
  return { ...point, terrainDegrees: round(point.terrainDegrees, 1), treeCorrectionDegrees: round(point.treeCorrectionDegrees, 1), effectiveDegrees: round(point.terrainDegrees + point.treeCorrectionDegrees + MODEL_CONFIG.horizonClearanceDegrees, 1) };
}
