import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MODEL_CONFIG, SOURCES, VIEWPOINT } from "../config";
import { sourceStamp } from "../freshness";
import { timed } from "../logging";
import { clamp, round } from "../time";
import type { SatelliteSnapshot } from "../types";
import { fetchBuffer, fetchText } from "./fetch";

interface H5Attribute { value: unknown }
interface H5Dataset { shape: number[]; attrs: Record<string, H5Attribute>; slice(selection: Array<Array<number>>): ArrayLike<number> }
interface H5File { get(name: string): H5Dataset; close(): void }

function utcDayOfYear(date: Date): number {
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
}

function scanTimestamp(key: string): Date | null {
  const match = key.match(/_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})\d_/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), 0, Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])));
}

async function listKeys(now: Date): Promise<string[]> {
  const batches = await Promise.all(Array.from({ length: 3 }, async (_, offset) => {
    const date = new Date(now.getTime() - offset * 3_600_000);
    const prefix = `ABI-L2-ACMC/${date.getUTCFullYear()}/${String(utcDayOfYear(date)).padStart(3, "0")}/${String(date.getUTCHours()).padStart(2, "0")}/`;
    const url = `https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=${prefix}&max-keys=1000`;
    const xml = await fetchText(url, { timeoutMs: 12_000, revalidateSeconds: 120 });
    return Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g), (match) => match[1]);
  }));
  const keys = batches.flat();
  return [...new Set(keys)].sort((a, b) => (scanTimestamp(a)?.getTime() ?? 0) - (scanTimestamp(b)?.getTime() ?? 0));
}

function attrNumber(dataset: H5Dataset, name: string): number {
  const value = dataset.attrs[name]?.value;
  return Number(ArrayBuffer.isView(value) || Array.isArray(value) ? Array.from(value as ArrayLike<number>)[0] : value);
}

function fixedGridIndex(projection: H5Dataset, xDataset: H5Dataset, yDataset: H5Dataset): { x: number; y: number } {
  const req = attrNumber(projection, "semi_major_axis");
  const rpol = attrNumber(projection, "semi_minor_axis");
  const H = attrNumber(projection, "perspective_point_height") + req;
  const lon0 = attrNumber(projection, "longitude_of_projection_origin") * Math.PI / 180;
  const lat = VIEWPOINT.latitude * Math.PI / 180;
  const lon = VIEWPOINT.longitude * Math.PI / 180;
  const geocentric = Math.atan((rpol ** 2 / req ** 2) * Math.tan(lat));
  const rc = rpol / Math.sqrt(1 - (1 - rpol ** 2 / req ** 2) * Math.cos(geocentric) ** 2);
  const deltaLon = lon - lon0;
  const sx = H - rc * Math.cos(geocentric) * Math.cos(deltaLon);
  const sy = -rc * Math.cos(geocentric) * Math.sin(deltaLon);
  const sz = rc * Math.sin(geocentric);
  const radius = Math.sqrt(sx ** 2 + sy ** 2 + sz ** 2);
  const xRadians = Math.asin(-sy / radius);
  const yRadians = Math.atan(sz / Math.sqrt(sx ** 2 + sy ** 2));
  const x = Math.round((xRadians - attrNumber(xDataset, "add_offset")) / attrNumber(xDataset, "scale_factor"));
  const y = Math.round((yRadians - attrNumber(yDataset, "add_offset")) / attrNumber(yDataset, "scale_factor"));
  return { x, y };
}

async function sampleFile(key: string): Promise<number> {
  const url = `https://noaa-goes19.s3.amazonaws.com/${key}`;
  const buffer = await fetchBuffer(url, { timeoutMs: 15_000, revalidateSeconds: 300 });
  const filename = join("/tmp", `moonbow-goes-${randomUUID()}.nc`);
  await writeFile(filename, new Uint8Array(buffer));
  let file: H5File | null = null;
  try {
    const h5 = await import("h5wasm/node");
    await h5.ready;
    file = new h5.File(filename, "r") as unknown as H5File;
    const probability = file.get("Cloud_Probabilities");
    const quality = file.get("DQF");
    const index = fixedGridIndex(file.get("goes_imager_projection"), file.get("x"), file.get("y"));
    const radius = 3;
    const selection = [[index.y - radius, index.y + radius + 1], [index.x - radius, index.x + radius + 1]];
    const rawProbability = Array.from(probability.slice(selection));
    const rawQuality = Array.from(quality.slice(selection));
    const scale = attrNumber(probability, "scale_factor");
    const offset = attrNumber(probability, "add_offset");
    const valid = rawProbability.map((value, i) => ({ value: value * scale + offset, quality: rawQuality[i] })).filter((point) => point.quality === 0 && point.value >= 0 && point.value <= 1).map((point) => point.value).sort((a, b) => a - b);
    if (valid.length < 20) throw new Error("Insufficient good-quality GOES pixels near the park");
    return valid[Math.floor(valid.length / 2)];
  } finally {
    file?.close();
    await unlink(filename).catch(() => undefined);
  }
}

function classify(value: number): SatelliteSnapshot["classification"] {
  if (value < 0.25) return "CLEAR";
  if (value < 0.5) return "PROBABLY CLEAR";
  if (value < 0.75) return "PROBABLY CLOUDY";
  return "CLOUDY";
}

export async function getSatellite(now = new Date()): Promise<SatelliteSnapshot> {
  try {
    const keys = await timed("goes_catalog", () => listKeys(now));
    if (!keys.length) throw new Error("No recent GOES-19 CONUS clear-sky-mask files found");
    const latestKey = keys.at(-1)!;
    const latestTime = scanTimestamp(latestKey);
    const priorKey = [...keys].reverse().find((key) => {
      const time = scanTimestamp(key);
      return time && latestTime && latestTime.getTime() - time.getTime() >= 15 * 60_000;
    });
    const [latest, prior] = await Promise.all([
      timed("goes_latest_mask", () => sampleFile(latestKey)),
      priorKey ? timed("goes_prior_mask", () => sampleFile(priorKey)).catch(() => null) : Promise.resolve(null),
    ]);
    const timestamp = latestTime?.toISOString() ?? null;
    const delta = prior === null ? 0 : latest - prior;
    const trend = prior === null ? "unknown" : delta > 0.12 ? "clouding" : delta < -0.12 ? "clearing" : "steady";
    return {
      available: true,
      satellite: "GOES-19",
      timestamp,
      cloudProbability: round(clamp(latest), 2),
      classification: classify(latest),
      trend,
      imageUrl: SOURCES.goesImage.url,
      source: sourceStamp({ id: "goes-19-acmc", label: "NOAA GOES-19 Clear Sky Mask", url: `https://noaa-goes19.s3.amazonaws.com/${latestKey}`, timestamp, freshMinutes: MODEL_CONFIG.freshnessMinutes.satelliteFresh, staleMinutes: MODEL_CONFIG.freshnessMinutes.satelliteStale, now, detail: "Median of a 7×7 pixel neighborhood (~14 km), with quality flags" }),
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      satellite: null,
      timestamp: null,
      cloudProbability: null,
      classification: "UNAVAILABLE",
      trend: "unknown",
      imageUrl: SOURCES.goesImage.url,
      source: { id: "goes-19-acmc", label: "NOAA GOES East Clear Sky Mask", url: SOURCES.goes.url, timestamp: null, ageMinutes: null, freshness: "unavailable", detail: "Satellite unavailable; NWS forecast remains active" },
      errors: [message],
    };
  }
}
