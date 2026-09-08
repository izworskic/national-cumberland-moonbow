import { writeFile } from "node:fs/promises";
import path from "node:path";

const YEARS = Array.from({ length: 10 }, (_, index) => 2015 + index);
const STATION = "72424303849";
const OUTPUT = path.resolve("lib/data/cloud-climatology.json");

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(value); value = ""; }
    else value += character;
  }
  values.push(value);
  return values;
}

const accumulators = Array.from({ length: 12 }, () => ({ transmission: 0, clear: 0, blocked: 0, observations: 0 }));

for (const year of YEARS) {
  const url = `https://www.ncei.noaa.gov/data/local-climatological-data/access/${year}/${STATION}.csv`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NCEI ${year} returned ${response.status}`);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const header = splitCsvLine(lines.shift() ?? "");
  const dateIndex = header.indexOf("DATE");
  const reportIndex = header.indexOf("REPORT_TYPE");
  const skyIndex = header.indexOf("HourlySkyConditions");
  if ([dateIndex, reportIndex, skyIndex].some((index) => index < 0)) throw new Error(`NCEI ${year} schema changed`);
  for (const line of lines) {
    const fields = splitCsvLine(line);
    const date = fields[dateIndex];
    const sky = fields[skyIndex];
    if (fields[reportIndex] !== "FM-15" || !date || !sky) continue;
    const localHour = Number(date.slice(11, 13));
    if (localHour < 19 && localHour > 6) continue;
    const coverageCodes = [...sky.matchAll(/(?:CLR|SKC|FEW|SCT|BKN|OVC|VV):(\d{2})/g)].map((match) => Number(match[1]));
    if (!coverageCodes.length) continue;
    const cloudFraction = Math.min(1, Math.max(...coverageCodes) / 8);
    const bucket = accumulators[Number(date.slice(5, 7)) - 1];
    bucket.transmission += Math.exp(-3.2 * cloudFraction ** 1.25);
    bucket.clear += Number(cloudFraction <= 0.25);
    bucket.blocked += Number(cloudFraction >= 0.875);
    bucket.observations += 1;
  }
}

const round = (value: number) => Number(value.toFixed(3));
const payload = {
  station: { id: STATION, name: "London Corbin Airport, KY US", latitude: 37.08958, longitude: -84.06881, distanceFromViewpointKm: 37.6 },
  source: "NOAA NCEI Local Climatological Data",
  period: `${YEARS[0]}-${YEARS.at(-1)}`,
  localNightHours: "19:00-06:59 LST",
  method: "FM-15 hourly reports; maximum reported sky-layer coverage; expected moonlight transmission exp(-3.2 * cloud_fraction^1.25)",
  months: accumulators.map((bucket, index) => ({ month: index + 1, expectedTransmission: round(bucket.transmission / bucket.observations), clearFraction: round(bucket.clear / bucket.observations), blockedFraction: round(bucket.blocked / bucket.observations), observations: bucket.observations })),
};

await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${OUTPUT} from ${payload.months.reduce((sum, month) => sum + month.observations, 0).toLocaleString()} nighttime observations.`);
