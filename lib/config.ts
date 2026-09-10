export const TIMEZONE = "America/New_York";

export const VIEWPOINT = {
  id: "falls-overlook-primary",
  name: "Falls Overlook",
  latitude: 36.83885,
  longitude: -84.34435,
  elevationMeters: 252.8,
  parkingLatitude: 36.837636,
  parkingLongitude: -84.343597,
  targetLatitude: 36.8387142,
  targetLongitude: -84.3450618,
  targetBearing: 256.5,
  targetDistanceMeters: 65,
  targetAzimuthHalfWidth: 24,
  targetAltitudeMin: -19,
  targetAltitudeMax: 6,
  guidance:
    "Park at the Visitor Center lot, follow signs toward the lower Falls overlooks, and use the Falls Overlook facing the mist below the main drop.",
  accessibility:
    "A paved accessible overlook is available from the Visitor Center area. The closest lower platforms include stairs and can be wet after dark.",
  mapUrl: "https://www.google.com/maps/dir/?api=1&destination=36.83885,-84.34435",
  coordinateNote:
    "Platform coordinate mapped from public trail and aerial data; verify posted park routing on arrival.",
} as const;

export const SOURCES = {
  park: {
    label: "Kentucky State Parks",
    url: "https://parks.ky.gov/explore/cumberland-falls-state-resort-park-7786",
  },
  schedule2026: {
    label: "Kentucky State Parks 2026 Moonbow Dates",
    url: "https://kentucky.simpleviewcrm.com/sched/getfilebykey.cfm?filekey=32b16ec1-f7ab-4c3b-bc66-cdd75c48730a",
  },
  usgs: {
    label: "USGS Water Data",
    url: "https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&monitoring_location_id=USGS-03404500",
  },
  nws: {
    label: "National Weather Service",
    url: "https://api.weather.gov/points/36.83885,-84.34435",
  },
  openMeteo: {
    label: "Open-Meteo model access",
    url: "https://open-meteo.com/en/docs",
  },
  climate: {
    label: "NOAA NCEI nighttime cloud history",
    url: "https://www.ncei.noaa.gov/data/local-climatological-data/",
  },
  goes: {
    label: "NOAA GOES East Clear Sky Mask",
    url: "https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc%3AC01503",
  },
  goesImage: {
    label: "NOAA/NESDIS GOES East",
    url: "https://cdn.star.nesdis.noaa.gov/WFO/jkl/DayNightCloudMicroCombo/600x600.jpg",
  },
  terrain: {
    label: "USGS 3DEP",
    url: "https://www.usgs.gov/3d-elevation-program",
  },
  astronomy: {
    label: "Astronomy Engine (JPL-validated)",
    url: "https://github.com/cosinekitty/astronomy",
  },
  jpl: {
    label: "NASA/JPL Horizons",
    url: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
  },
} as const;

export const MODEL_CONFIG = {
  id: "moonbow-model-v2",
  version: "2.0.0",
  timestepMinutes: 5,
  lunarIlluminationGate: 0.88,
  maximumMoonAltitude: 42,
  darknessSunAltitude: -12,
  geometryToleranceDegrees: 8,
  geometrySoftWidthDegrees: 4.5,
  horizonClearanceDegrees: 0.35,
  weights: {
    lunar: 0.18,
    geometry: 0.24,
    cloud: 0.24,
    mist: 0.14,
    mistPlacement: 0.08,
    atmosphere: 0.07,
    wind: 0.05,
  },
  modelWeights: {
    HRRR: 0.4,
    NBM: 0.3,
    ECMWF: 0.15,
    GFS: 0.15,
  },
  decision: {
    goScore: 80,
    goConfidence: 70,
    goodShotScore: 70,
    goodShotConfidence: 65,
    conditionalScore: 55,
    tooEarlyConfidence: 45,
    minimumGoWindowMinutes: 35,
    arrivalLeadMinutes: 25,
  },
  driveScoreAdjustments: {
    local: 0,
    "30m": 2,
    "1h": 5,
    "2h": 9,
    "3h": 14,
  },
  freshnessMinutes: {
    usgsFresh: 45,
    usgsStale: 180,
    observationFresh: 45,
    observationStale: 120,
    satelliteFresh: 20,
    satelliteStale: 60,
    forecastFresh: 180,
    forecastStale: 480,
  },
} as const;

export const DANGEROUS_ALERT_EVENTS = [
  "Tornado Warning",
  "Severe Thunderstorm Warning",
  "Flash Flood Warning",
  "Flood Warning",
  "Extreme Wind Warning",
  "Ice Storm Warning",
  "Winter Storm Warning",
  "Blizzard Warning",
] as const;

export const GA_MEASUREMENT_ID = "G-Y5D2V2W7HN";
export const ADSENSE_ACCOUNT = "ca-pub-8222782620788075";
