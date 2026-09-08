import {
  Body,
  Equator,
  Horizon,
  Illumination,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from "astronomy-engine";
import { MODEL_CONFIG, VIEWPOINT } from "./config";
import { effectiveSkyline } from "./terrain";
import { clamp, circularDifference, localNightBounds, round } from "./time";
import type { AstronomyPoint } from "./types";

const observer = new Observer(VIEWPOINT.latitude, VIEWPOINT.longitude, VIEWPOINT.elevationMeters);

function horizontal(body: Body, date: Date): { altitude: number; azimuth: number } {
  const equatorial = Equator(body, date, observer, true, true);
  const result = Horizon(date, observer, equatorial.ra, equatorial.dec, "normal");
  return { altitude: result.altitude, azimuth: result.azimuth };
}

function angularDistance(az1: number, alt1: number, az2: number, alt2: number): number {
  const r = Math.PI / 180;
  const a1 = alt1 * r;
  const a2 = alt2 * r;
  const deltaAz = circularDifference(az1, az2) * r;
  return Math.acos(clamp(Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(deltaAz), -1, 1)) / r;
}

export function geometryErrorDegrees(antiAzimuth: number, antiAltitude: number): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let az = VIEWPOINT.targetBearing - VIEWPOINT.targetAzimuthHalfWidth; az <= VIEWPOINT.targetBearing + VIEWPOINT.targetAzimuthHalfWidth; az += 2) {
    for (let alt = VIEWPOINT.targetAltitudeMin; alt <= VIEWPOINT.targetAltitudeMax; alt += 2) {
      minimum = Math.min(minimum, Math.abs(angularDistance(antiAzimuth, antiAltitude, az, alt) - 42));
    }
  }
  return minimum;
}

export function astronomyAt(date: Date): AstronomyPoint {
  try {
    const moon = horizontal(Body.Moon, date);
    const sun = horizontal(Body.Sun, date);
    const illumination = Illumination(Body.Moon, date).phase_fraction;
    const skyline = effectiveSkyline(moon.azimuth);
    const antiLunarAzimuth = (moon.azimuth + 180) % 360;
    const antiLunarAltitude = -moon.altitude;
    const geometryError = geometryErrorDegrees(antiLunarAzimuth, antiLunarAltitude);
    const values = [moon.altitude, moon.azimuth, sun.altitude, illumination, skyline.effectiveDegrees, geometryError];
    return {
      valid: values.every(Number.isFinite),
      moonAltitude: round(moon.altitude, 2),
      moonAzimuth: round(moon.azimuth, 2),
      moonIllumination: round(illumination, 5),
      sunAltitude: round(sun.altitude, 2),
      antiLunarAltitude: round(antiLunarAltitude, 2),
      antiLunarAzimuth: round(antiLunarAzimuth, 2),
      effectiveSkyline: skyline.effectiveDegrees,
      terrainHorizon: skyline.terrainDegrees,
      treeCorrection: skyline.treeCorrectionDegrees,
      geometryError: round(geometryError, 2),
    };
  } catch {
    return {
      valid: false,
      moonAltitude: 0,
      moonAzimuth: 0,
      moonIllumination: 0,
      sunAltitude: 0,
      antiLunarAltitude: 0,
      antiLunarAzimuth: 0,
      effectiveSkyline: 0,
      terrainHorizon: 0,
      treeCorrection: 0,
      geometryError: 180,
    };
  }
}

function isoOrNull(value: ReturnType<typeof SearchRiseSet>): string | null {
  return value ? value.date.toISOString() : null;
}

export function astronomySummary(targetDate: string) {
  const { start } = localNightBounds(targetDate);
  const moonrise = SearchRiseSet(Body.Moon, observer, 1, new Date(start.getTime() - 12 * 3_600_000), 2);
  const moonset = SearchRiseSet(Body.Moon, observer, -1, start, 2);
  const sunset = SearchRiseSet(Body.Sun, observer, -1, new Date(start.getTime() - 8 * 3_600_000), 1);
  const civil = SearchAltitude(Body.Sun, observer, -1, new Date(start.getTime() - 8 * 3_600_000), 1, -6);
  const nautical = SearchAltitude(Body.Sun, observer, -1, new Date(start.getTime() - 8 * 3_600_000), 1, -12);
  const astronomical = SearchAltitude(Body.Sun, observer, -1, new Date(start.getTime() - 8 * 3_600_000), 1, -18);
  return {
    moonrise: isoOrNull(moonrise),
    moonset: isoOrNull(moonset),
    sunset: isoOrNull(sunset),
    civilTwilightEnd: isoOrNull(civil),
    nauticalTwilightEnd: isoOrNull(nautical),
    astronomicalTwilightEnd: isoOrNull(astronomical),
    illumination: round(Illumination(Body.Moon, start).phase_fraction, 5),
  };
}

export function astronomyFactors(point: AstronomyPoint): { lunar: number; geometry: number; gates: string[] } {
  const gates: string[] = [];
  if (!point.valid) gates.push("Astronomy calculation is invalid");
  if (point.moonAltitude <= point.effectiveSkyline) gates.push("Moon is below the effective local skyline");
  if (point.moonAltitude > MODEL_CONFIG.maximumMoonAltitude) gates.push("Moon is too high for primary-bow geometry");
  if (point.sunAltitude > MODEL_CONFIG.darknessSunAltitude) gates.push("Sky is not yet dark enough");
  if (point.moonIllumination < MODEL_CONFIG.lunarIlluminationGate) gates.push("Lunar illumination is below the validated planning envelope");
  if (point.geometryError > MODEL_CONFIG.geometryToleranceDegrees) gates.push("Primary-bow geometry misses the visible mist field");

  const lunar = clamp((point.moonIllumination - MODEL_CONFIG.lunarIlluminationGate) / (1 - MODEL_CONFIG.lunarIlluminationGate));
  const geometry = clamp(Math.exp(-((point.geometryError / MODEL_CONFIG.geometrySoftWidthDegrees) ** 2)));
  return { lunar, geometry, gates };
}
