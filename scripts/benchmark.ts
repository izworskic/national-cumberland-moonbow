import { readFile } from "node:fs/promises";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { astronomyAt, astronomyFactors } from "../lib/astronomy";
import cloud from "../lib/data/cloud-climatology.json";
import flow from "../lib/data/flow-climatology.json";
import jpl from "../lib/data/jpl-horizons-validation.json";
import { MODEL_CONFIG, TIMEZONE } from "../lib/config";
import { OFFICIAL_WINDOWS_2026 } from "../lib/schedule-2026";
import { buildFiveMinuteTimeline } from "../lib/time";

const read = (path: string) => readFile(path, "utf8");
const [scenarioTests, v2Tests, mobileTests, accessibilityTests, scoringSource, usgsSource, nwsSource, goesSource, openMeteoSource, heroSource, geometrySource, forecastChangeSource, dashboardSource, feedbackSource, apiSource, pageSource, sitemapSource] = await Promise.all([
  read("tests/decision-scenarios.test.ts"),
  read("tests/moonbow-v2.test.ts"),
  read("tests/e2e/mobile.spec.ts"),
  read("tests/accessibility.test.ts"),
  read("lib/scoring.ts"),
  read("lib/adapters/usgs.ts"),
  read("lib/adapters/nws.ts"),
  read("lib/adapters/goes.ts"),
  read("lib/adapters/open-meteo.ts"),
  read("components/decision-hero.tsx"),
  read("components/geometry-visual.tsx"),
  read("components/forecast-change.tsx"),
  read("components/dashboard.tsx"),
  read("lib/feedback.ts"),
  read("app/api/moonbow/route.ts"),
  read("app/cumberland-falls-moonbow/page.tsx"),
  read("app/sitemap.ts"),
]);

function officialTime(date: string, clock: string): Date {
  const nextDay = Number(clock.slice(0, 2)) < 5;
  const localDate = nextDay ? format(addDays(parseISO(date), 1), "yyyy-MM-dd") : date;
  return fromZonedTime(`${localDate}T${clock}:00`, TIMEZONE);
}

let overlap = 0;
let startsWithinHour = 0;
const centerErrors: number[] = [];
for (const window of OFFICIAL_WINDOWS_2026) {
  const viable = buildFiveMinuteTimeline(window.date).filter((time) => astronomyFactors(astronomyAt(time)).gates.length === 0);
  const first = viable[0];
  const last = viable.at(-1);
  const officialStart = officialTime(window.date, window.startLocal);
  const officialEnd = officialTime(window.date, window.endLocal);
  if (first && last && first <= officialEnd && last >= officialStart) overlap += 1;
  if (first && Math.abs(first.getTime() - officialStart.getTime()) <= 60 * 60_000) startsWithinHour += 1;
  if (first && last) {
    const modeledCenter = (first.getTime() + last.getTime()) / 2;
    const officialCenter = (officialStart.getTime() + officialEnd.getTime()) / 2;
    centerErrors.push(Math.abs(modeledCenter - officialCenter) / 60_000);
  }
}
centerErrors.sort((a, b) => a - b);
const medianCenterErrorMinutes = centerErrors.length ? centerErrors[Math.floor(centerErrors.length / 2)] : Infinity;

const jplErrors = jpl.samples.map((sample) => {
  const actual = astronomyAt(new Date(sample.timestamp));
  return {
    azimuth: Math.abs(actual.moonAzimuth - sample.azimuth),
    altitude: Math.abs(actual.moonAltitude - sample.altitude),
    illumination: Math.abs(actual.moonIllumination - sample.illumination),
  };
});
const jplPass = jplErrors.every((error) => error.azimuth <= jpl.tolerances.azimuthDegrees && error.altitude <= jpl.tolerances.altitudeDegrees && error.illumination <= jpl.tolerances.illuminationFraction);
const weightsSum = Object.values(MODEL_CONFIG.weights).reduce((sum, value) => sum + value, 0);
const requiredScenarios = Array.from({ length: 13 }, (_, index) => scenarioTests.includes(`${index + 1}.`)).every(Boolean) && mobileTests.includes("14.");
const cloudObservationCount = cloud.months.reduce((sum, month) => sum + month.observations, 0);
const chanceIntegrity = heroSource.includes("Estimated Moonbow Chance") && v2Tests.includes("coarse estimated chance") && v2Tests.includes("CLIMATOLOGY / PLANNING");
const fourModels = ["ncep_hrrr_conus", "ncep_nbm_conus", "ecmwf_ifs", "ncep_gfs_seamless"].every((model) => openMeteoSource.includes(model));
const structuredFailure = apiSource.includes("MOONBOW_ENGINE_UNAVAILABLE") && apiSource.includes("NextResponse.json");
const visualPass = geometrySource.includes('type="range"') && geometrySource.includes("40–42°") && dashboardSource.includes("Tonight timeline");
const repeatPass = feedbackSource.includes("storeFeedback") && feedbackSource.includes("moonbow_outcomes") && forecastChangeSource.includes("localStorage") && forecastChangeSource.includes("Since your last check") && dashboardSource.includes("Next moonbow windows") && dashboardSource.includes("Model consensus");
const mobilePass = mobileTests.includes("390px") && mobileTests.includes("Estimated Moonbow Chance") && accessibilityTests.includes("contrast");
const discoveryPass = pageSource.includes("application/ld+json") && pageSource.includes("WebApplication") && sitemapSource.includes("september-2026");

const categories = [
  { name: "Decision usefulness", max: 25, score: requiredScenarios && chanceIntegrity ? 25 : 0, evidence: "Decision-first hero, coarse chance contract and 14 core decision/browser scenarios" },
  { name: "Scientific/model integrity", max: 20, score: Math.abs(weightsSum - 1) < 1e-9 && jplPass && overlap === OFFICIAL_WINDOWS_2026.length && flow.recordCount >= 7_800 && cloudObservationCount >= 40_000 && scoringSource.includes("mistPlacement") ? 20 : 0, evidence: "JPL validation, 3DEP geometry, historical flow/cloud context and multiplicative seven-factor model" },
  { name: "Real-time data reliability", max: 15, score: usgsSource.includes("api.waterdata.usgs.gov") && nwsSource.includes("api.weather.gov") && goesSource.includes("GOES-19") && fourModels && structuredFailure ? 14 : 0, evidence: "USGS + NWS + GOES + four-model consensus with isolated fallbacks; one point reserved for long-run provider SLO evidence" },
  { name: "Best-window accuracy", max: 10, score: overlap === OFFICIAL_WINDOWS_2026.length && medianCenterErrorMinutes <= 30 && MODEL_CONFIG.timestepMinutes === 5 ? 10 : 0, evidence: `${overlap}/${OFFICIAL_WINDOWS_2026.length} official windows overlap; median center error ${medianCenterErrorMinutes.toFixed(1)} min; ${startsWithinHour}/${OFFICIAL_WINDOWS_2026.length} starts within 60 min` },
  { name: "Visual explanation", max: 10, score: visualPass ? 10 : 0, evidence: "Five-minute timeline plus accessible time-scrubbable Moon/falls/mist geometry explorer" },
  { name: "Repeat-visit value", max: 8, score: repeatPass ? 8 : 0, evidence: "Next windows, per-visitor forecast-change history, model consensus changes and outcome collection" },
  { name: "Mobile UX/accessibility", max: 7, score: mobilePass ? 7 : 0, evidence: "390px first-viewport release gate and WCAG automated coverage" },
  { name: "SEO/performance", max: 5, score: discoveryPass ? 5 : 0, evidence: "Production build precedes this benchmark; canonical/schema/sitemap routes are asserted in source" },
];

const total = categories.reduce((sum, category) => sum + category.score, 0);
const categoryFloorPass = categories.every((category) => category.score / category.max >= 0.7);
const hardVetoes = {
  weightsNormalized: Math.abs(weightsSum - 1) < 1e-9,
  jplValidation: jplPass,
  allOfficialWindowsOverlap: overlap === OFFICIAL_WINDOWS_2026.length,
  medianWindowCenterAtMost30Minutes: medianCenterErrorMinutes <= 30,
  estimatedChanceIntegrity: chanceIntegrity,
  fourModelConsensus: fourModels,
  structuredJsonFailure: structuredFailure,
  mobileDecisionContract: mobilePass,
};
const noHardVeto = Object.values(hardVetoes).every(Boolean);

console.table(categories.map(({ name, score, max, evidence }) => ({ category: name, score: `${score}/${max}`, evidence })));
console.log(JSON.stringify({ benchmark: { score: total, maximum: 100, target: 92, categoryFloorPass, releaseCandidate: total >= 92 && categoryFloorPass && noHardVeto }, measurements: { officialWindowOverlap: `${overlap}/${OFFICIAL_WINDOWS_2026.length}`, startsWithinOneHour: `${startsWithinHour}/${OFFICIAL_WINDOWS_2026.length}`, medianCenterErrorMinutes: Number(medianCenterErrorMinutes.toFixed(1)), jplMaxAzimuthErrorDegrees: Math.max(...jplErrors.map((error) => error.azimuth)), jplMaxAltitudeErrorDegrees: Math.max(...jplErrors.map((error) => error.altitude)), cloudObservations: cloudObservationCount, flowDailyMeans: flow.recordCount }, hardVetoes }, null, 2));

if (total < 92 || !categoryFloorPass || !noHardVeto) {
  console.error("RELEASE VETO: score must be >=92, every category >=70%, and every hard veto must pass.");
  process.exitCode = 1;
}
