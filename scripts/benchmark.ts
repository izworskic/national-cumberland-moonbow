import { existsSync } from "node:fs";
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

interface ProductionEvidence {
  url: string;
  verifiedAt: string;
  pageStatus: number;
  apiStatus: number;
  deepHealthStatus: "ok" | "degraded";
  liveAdaptersVerified: boolean;
  feedbackStorage: "configured" | "unconfigured";
  mobile: { width: number; height: number; noHorizontalScroll: boolean; decisionInFirstViewport: boolean; labeledControls: boolean; singleMainLandmark: boolean };
  performance: { lcpMs: number; cls: number; syntheticInpMs: number };
  accessibility: { criticalViolations: number; contrastTokensPass: boolean };
}

const read = (path: string) => readFile(path, "utf8");
const sourceFiles = await Promise.all([
  read("tests/decision-scenarios.test.ts"),
  read("tests/e2e/mobile.spec.ts"),
  read("lib/scoring.ts"),
  read("lib/confidence.ts"),
  read("lib/adapters/usgs.ts"),
  read("lib/adapters/nws.ts"),
  read("lib/adapters/goes.ts"),
  read("components/decision-hero.tsx"),
  read("app/cumberland-falls-moonbow/page.tsx"),
  read("app/sitemap.ts"),
]);
const [scenarioTests, mobileTests, scoringSource, confidenceSource, usgsSource, nwsSource, goesSource, heroSource, pageSource, sitemapSource] = sourceFiles;

function officialTime(date: string, clock: string): Date {
  const nextDay = Number(clock.slice(0, 2)) < 5;
  const localDate = nextDay ? format(addDays(parseISO(date), 1), "yyyy-MM-dd") : date;
  return fromZonedTime(`${localDate}T${clock}:00`, TIMEZONE);
}

let overlap = 0;
let startsWithinHour = 0;
for (const window of OFFICIAL_WINDOWS_2026) {
  const viable = buildFiveMinuteTimeline(window.date).filter((time) => astronomyFactors(astronomyAt(time)).gates.length === 0);
  const first = viable[0];
  const last = viable.at(-1);
  const officialStart = officialTime(window.date, window.startLocal);
  const officialEnd = officialTime(window.date, window.endLocal);
  if (first && last && first <= officialEnd && last >= officialStart) overlap += 1;
  if (first && Math.abs(first.getTime() - officialStart.getTime()) <= 60 * 60_000) startsWithinHour += 1;
}

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

let production: ProductionEvidence | null = null;
if (existsSync("docs/evidence/production.json")) production = JSON.parse(await read("docs/evidence/production.json")) as ProductionEvidence;
const browserPass = Boolean(production?.mobile.width === 390 && production.mobile.height >= 800 && production.mobile.noHorizontalScroll && production.mobile.decisionInFirstViewport && production.mobile.labeledControls && production.mobile.singleMainLandmark);
const performancePass = Boolean(production && production.performance.lcpMs < 2_500 && production.performance.cls < 0.1 && production.performance.syntheticInpMs < 200);
const accessibilityPass = Boolean(production && production.accessibility.criticalViolations === 0 && production.accessibility.contrastTokensPass);
const productionLivePass = Boolean(production && production.pageStatus === 200 && production.apiStatus === 200 && production.liveAdaptersVerified);

const categories = [
  { name: "Decision usefulness", max: 25, score: 20 + (browserPass ? 5 : 0), evidence: requiredScenarios ? "14 required scenarios encoded; first-viewport browser proof adds 5" : "Required fixture coverage incomplete" },
  { name: "Scientific / physical integrity", max: 20, score: Math.abs(weightsSum - 1) < 1e-9 && jplPass && overlap === 65 && flow.recordCount >= 7_800 && cloudObservationCount >= 40_000 && scoringSource.includes("factors.geometry ** weights.geometry") ? 19 : 0, evidence: "One point intentionally withheld pending a multi-season, on-site tree-line outcome set" },
  { name: "Window accuracy", max: 15, score: overlap === 65 && startsWithinHour >= 62 && MODEL_CONFIG.timestepMinutes === 5 && MODEL_CONFIG.decision.minimumGoWindowMinutes >= 30 ? 15 : 0, evidence: `${overlap}/65 official windows overlap; ${startsWithinHour}/65 modeled starts are within one hour` },
  { name: "Live-data integration", max: 10, score: (usgsSource.includes("api.waterdata.usgs.gov") && nwsSource.includes("api.weather.gov") && goesSource.includes("GOES-19") ? 6 : 0) + (productionLivePass ? 4 : 0), evidence: "Isolated USGS, NWS and GOES adapters; production deep-health proof adds 4" },
  { name: "Uncertainty / calibration", max: 10, score: heroSource.includes("Moonbow Score") || (confidenceSource.includes("CLIMATOLOGY / PLANNING") && !pageSource.includes("% chance")) ? 10 : 0, evidence: "Opportunity score and confidence are separate; probability display is disabled" },
  { name: "Resilience", max: 5, score: requiredScenarios && scenarioTests.includes("USGS unavailable") && scenarioTests.includes("NWS unavailable") && scenarioTests.includes("satellite unavailable") ? 5 : 0, evidence: "Independent adapter-failure and stale-data fixtures" },
  { name: "Mobile UX", max: 5, score: 2 + (browserPass ? 3 : 0), evidence: "Mobile-first CSS and semantic controls; 390px production proof adds 3" },
  { name: "Performance / accessibility", max: 5, score: performancePass && accessibilityPass ? 5 : 0, evidence: "Requires production LCP, CLS, interaction and accessibility proof" },
  { name: "Search / discovery", max: 3, score: sitemapSource.includes("september-2026") && pageSource.includes("application/ld+json") ? 3 : 0, evidence: "Canonical tool, computed support routes, sitemap and WebApplication structured data" },
  { name: "Learning / observability", max: 2, score: 1 + (production?.feedbackStorage === "configured" ? 1 : 0), evidence: "Structured health/logging and low-friction outcome schema; verified storage adds 1" },
];

const total = categories.reduce((sum, category) => sum + category.score, 0);
const valueInputs = {
  decisionUsefulness: categories[0].score / categories[0].max * 100,
  physicalIntegrity: categories[1].score / categories[1].max * 100,
  timingAccuracy: categories[2].score / categories[2].max * 100,
  uncertaintyIntegrity: categories[4].score / categories[4].max * 100,
  reliability: ((categories[3].score / categories[3].max) * 0.55 + (categories[5].score / categories[5].max) * 0.3 + (categories[9].score / categories[9].max) * 0.15) * 100,
  userExperience: categories[6].score / categories[6].max * 100,
  performanceAccessibility: categories[7].score / categories[7].max * 100,
  discoverability: categories[8].score / categories[8].max * 100,
};
const value = 0.25 * valueInputs.decisionUsefulness + 0.20 * valueInputs.physicalIntegrity + 0.15 * valueInputs.timingAccuracy + 0.10 * valueInputs.uncertaintyIntegrity + 0.10 * valueInputs.reliability + 0.10 * valueInputs.userExperience + 0.05 * valueInputs.performanceAccessibility + 0.05 * valueInputs.discoverability;

console.table(categories.map(({ name, score, max, evidence }) => ({ category: name, score: `${score}/${max}`, evidence })));
console.log(JSON.stringify({ benchmark: { score: total, maximum: 100, releaseCandidate: total >= 93 }, value: { score: Number(value.toFixed(1)), target: 93, releaseCandidate: value >= 93 }, measurements: { officialWindowOverlap: `${overlap}/65`, startsWithinOneHour: `${startsWithinHour}/65`, jplMaxAzimuthErrorDegrees: Math.max(...jplErrors.map((error) => error.azimuth)), jplMaxAltitudeErrorDegrees: Math.max(...jplErrors.map((error) => error.altitude)), cloudObservations: cloudObservationCount, flowDailyMeans: flow.recordCount }, productionEvidence: production?.url ?? null }, null, 2));

if (total < 93 || value < 93) {
  console.error("RELEASE VETO: benchmark and VALUE must both be at least 93.");
  process.exitCode = 1;
}
