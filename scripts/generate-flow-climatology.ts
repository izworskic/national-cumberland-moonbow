import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const endpoint = new URL("https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items");
endpoint.searchParams.set("f", "json");
endpoint.searchParams.set("monitoring_location_id", "USGS-03404500");
endpoint.searchParams.set("parameter_code", "00060");
endpoint.searchParams.set("time", "1991-01-01/2025-12-31");
endpoint.searchParams.set("limit", "10000");

interface Feature {
  properties: { time: string; value: string; statistic_id: string };
}

interface Page {
  features: Feature[];
  links?: Array<{ rel: string; href: string }>;
}

function circularDistance(a: number, b: number): number {
  const difference = Math.abs(a - b);
  return Math.min(difference, 366 - difference);
}

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const value = sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  return Math.round(value);
}

async function main() {
  const records: Array<{ day: number; value: number }> = [];
  let next: string | null = endpoint.toString();
  while (next) {
    const response = await fetch(next, { headers: { "User-Agent": "CumberlandMoonbow/1.0" } });
    if (!response.ok) throw new Error(`USGS daily request failed (${response.status})`);
    const page = (await response.json()) as Page;
    for (const feature of page.features) {
      if (feature.properties.statistic_id !== "00003") continue;
      const value = Number(feature.properties.value);
      const date = new Date(`${feature.properties.time}T12:00:00Z`);
      const start = Date.UTC(date.getUTCFullYear(), 0, 1);
      const day = Math.floor((date.getTime() - start) / 86_400_000) + 1;
      if (Number.isFinite(value) && value >= 0) records.push({ day, value });
    }
    next = page.links?.find((link) => link.rel === "next")?.href ?? null;
  }

  const days = Array.from({ length: 366 }, (_, index) => {
    const day = index + 1;
    const values = records.filter((record) => circularDistance(record.day, day) <= 7).map((record) => record.value).sort((a, b) => a - b);
    return {
      day,
      samples: values.length,
      min: values[0], p10: quantile(values, 0.1), p25: quantile(values, 0.25),
      p50: quantile(values, 0.5), p75: quantile(values, 0.75), p90: quantile(values, 0.9), max: values.at(-1),
    };
  });

  const output = resolve("lib/data/flow-climatology.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ station: "USGS-03404500", parameter: "00060", statistic: "00003", period: "1991-01-01/2025-12-31", windowDays: 7, generatedAt: new Date().toISOString(), recordCount: records.length, days }, null, 2)}\n`);
  console.log(`Wrote ${days.length} day-of-year distributions from ${records.length} approved daily means.`);
}

void main();
