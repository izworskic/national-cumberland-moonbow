export type DecisionState = "GO" | "GOOD SHOT" | "CONDITIONAL" | "NO-GO" | "TOO EARLY TO CALL";
export type ConfidenceMode =
  | "NOWCAST"
  | "HIGH-CONFIDENCE FORECAST"
  | "FORECAST"
  | "PLANNING FORECAST"
  | "CLIMATOLOGY / PLANNING";
export type FreshnessState = "fresh" | "aging" | "stale" | "unavailable" | "not-applicable";
export type DriveCommitment = "local" | "30m" | "1h" | "2h" | "3h";

export interface SourceStamp {
  id: string;
  label: string;
  url: string;
  timestamp: string | null;
  ageMinutes: number | null;
  freshness: FreshnessState;
  detail?: string;
}

export interface AstronomyPoint {
  valid: boolean;
  moonAltitude: number;
  moonAzimuth: number;
  moonIllumination: number;
  sunAltitude: number;
  antiLunarAltitude: number;
  antiLunarAzimuth: number;
  effectiveSkyline: number;
  terrainHorizon: number;
  treeCorrection: number;
  geometryError: number;
}

export interface WeatherPoint {
  cloudCover: number | null;
  precipitationProbability: number | null;
  quantitativePrecipitationMm: number | null;
  relativeHumidity: number | null;
  windSpeedMps: number | null;
  windDirection: number | null;
  temperatureC: number | null;
  conditions: string[];
}

export interface ObservationSnapshot {
  stationId: string | null;
  stationName: string | null;
  timestamp: string | null;
  cloudCover: number | null;
  visibilityM: number | null;
  windSpeedMps: number | null;
  windDirection: number | null;
  temperatureC: number | null;
  conditions: string[];
  source: SourceStamp;
}

export interface WeatherDataset {
  available: boolean;
  generatedAt: string | null;
  points: Array<{ start: string; end: string; value: WeatherPoint }>;
  observation: ObservationSnapshot | null;
  dangerousAlerts: Array<{ event: string; headline: string; onset: string | null; ends: string | null; url: string }>;
  sources: SourceStamp[];
  errors: string[];
}

export interface HydroSnapshot {
  dischargeCfs: number | null;
  gageHeightFt: number | null;
  timestamp: string | null;
  percentile: number | null;
  seasonalMedianCfs: number;
  trend: "rising" | "steady" | "falling" | "unknown";
  mistLabel: "LOW MIST" | "ADEQUATE MIST" | "STRONG MIST" | "UNKNOWN";
  factor: number | null;
  currentAvailable: boolean;
  source: SourceStamp;
  errors: string[];
}

export interface SatelliteSnapshot {
  available: boolean;
  satellite: string | null;
  timestamp: string | null;
  cloudProbability: number | null;
  classification: "CLEAR" | "PROBABLY CLEAR" | "PROBABLY CLOUDY" | "CLOUDY" | "UNAVAILABLE";
  trend: "clearing" | "steady" | "clouding" | "unknown";
  imageUrl: string;
  source: SourceStamp;
  errors: string[];
}

export interface FactorSet {
  lunar: number;
  geometry: number;
  cloud: number;
  mist: number;
  atmosphere: number;
  wind: number;
}

export interface TimelinePoint {
  timestamp: string;
  score: number;
  viable: boolean;
  factors: FactorSet;
  astronomy: AstronomyPoint;
  weather: WeatherPoint | null;
  cloudInput: {
    forecast: number | null;
    observed: number | null;
    satellite: number | null;
    fused: number | null;
  };
  hardGates: string[];
}

export interface ViewingWindow {
  start: string;
  end: string;
  peak: string;
  peakScore: number;
  durationMinutes: number;
  startsBecause: string;
  endsBecause: string;
}

export interface ConfidenceResult {
  score: number;
  level: "HIGH" | "MODERATE" | "LOW";
  mode: ConfidenceMode;
  reasons: string[];
  missing: string[];
}

export interface DecisionResult {
  generatedAt: string;
  targetDate: string;
  timezone: string;
  decision: DecisionState;
  decisionReason: string;
  score: number;
  scoreLabel: "Moonbow Score";
  confidence: ConfidenceResult;
  driveCommitment: DriveCommitment;
  bestWindow: ViewingWindow | null;
  arrivalTime: string | null;
  drivers: Array<{ tone: "positive" | "caution" | "negative" | "info"; text: string }>;
  timeline: TimelinePoint[];
  astronomySummary: {
    moonrise: string | null;
    moonset: string | null;
    sunset: string | null;
    civilTwilightEnd: string | null;
    nauticalTwilightEnd: string | null;
    astronomicalTwilightEnd: string | null;
    illumination: number;
  };
  hydro: HydroSnapshot;
  satellite: SatelliteSnapshot;
  weather: WeatherDataset;
  viewpoint: typeof import("./config").VIEWPOINT;
  sources: SourceStamp[];
  notices: string[];
}

export interface EngineInputs {
  targetDate: string;
  now: Date;
  driveCommitment: DriveCommitment;
  weather: WeatherDataset;
  hydro: HydroSnapshot;
  satellite: SatelliteSnapshot;
}
