import { SOURCES, MODEL_CONFIG } from "../config";
import { estimatedPercentile, flowStats, mistFactor, mistLabel } from "../flow-climatology";
import { sourceStamp } from "../freshness";
import { timed } from "../logging";
import type { HydroSnapshot } from "../types";
import { fetchJson } from "./fetch";

interface UsgsFeature {
  properties: {
    parameter_code: string;
    time: string;
    value: string;
    unit_of_measure: string;
    approval_status?: string;
  };
}

interface UsgsCollection {
  features: UsgsFeature[];
}

let lastSuccess: HydroSnapshot | null = null;

function trendFrom(features: UsgsFeature[]): HydroSnapshot["trend"] {
  const points = features
    .filter((feature) => feature.properties.parameter_code === "00060")
    .map((feature) => ({ time: Date.parse(feature.properties.time), value: Number(feature.properties.value) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);
  if (points.length < 2) return "unknown";
  const change = points.at(-1)!.value - points[0].value;
  const threshold = Math.max(10, points[0].value * 0.05);
  return change > threshold ? "rising" : change < -threshold ? "falling" : "steady";
}

export async function getHydro(now = new Date()): Promise<HydroSnapshot> {
  const stats = flowStats(now);
  const latestUrl = SOURCES.usgs.url;
  const since = new Date(now.getTime() - 6 * 3_600_000).toISOString();
  const recentUrl = new URL("https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items");
  recentUrl.searchParams.set("f", "json");
  recentUrl.searchParams.set("monitoring_location_id", "USGS-03404500");
  recentUrl.searchParams.set("parameter_code", "00060");
  recentUrl.searchParams.set("time", `${since}/${now.toISOString()}`);
  recentUrl.searchParams.set("limit", "250");

  try {
    const [latest, recent] = await Promise.all([
      timed("usgs_latest", () => fetchJson<UsgsCollection>(latestUrl, { revalidateSeconds: 300 })),
      timed("usgs_recent", () => fetchJson<UsgsCollection>(recentUrl.toString(), { revalidateSeconds: 300 })).catch(() => ({ features: [] })),
    ]);
    const discharge = latest.features.find((feature) => feature.properties.parameter_code === "00060");
    const gage = latest.features.find((feature) => feature.properties.parameter_code === "00065");
    const dischargeCfs = discharge ? Number(discharge.properties.value) : null;
    const gageHeightFt = gage ? Number(gage.properties.value) : null;
    if (dischargeCfs === null || !Number.isFinite(dischargeCfs)) throw new Error("USGS discharge 00060 is absent");
    const factor = mistFactor(dischargeCfs);
    const timestamp = discharge!.properties.time;
    const result: HydroSnapshot = {
      dischargeCfs,
      gageHeightFt: gageHeightFt !== null && Number.isFinite(gageHeightFt) ? gageHeightFt : null,
      timestamp,
      percentile: estimatedPercentile(dischargeCfs, stats),
      seasonalMedianCfs: stats.p50,
      trend: trendFrom(recent.features),
      mistLabel: mistLabel(factor),
      factor,
      currentAvailable: true,
      source: sourceStamp({ id: "usgs-03404500", label: "USGS station 03404500", url: latestUrl, timestamp, freshMinutes: MODEL_CONFIG.freshnessMinutes.usgsFresh, staleMinutes: MODEL_CONFIG.freshnessMinutes.usgsStale, now, detail: "Cumberland River at Cumberland Falls" }),
      errors: [],
    };
    lastSuccess = result;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (lastSuccess?.timestamp && now.getTime() - new Date(lastSuccess.timestamp).getTime() <= MODEL_CONFIG.freshnessMinutes.usgsStale * 60_000) {
      return {
        ...lastSuccess,
        source: { ...lastSuccess.source, freshness: "stale", ageMinutes: Math.round((now.getTime() - new Date(lastSuccess.timestamp).getTime()) / 60_000), detail: "Last known reading; live request failed" },
        errors: [message],
      };
    }
    return {
      dischargeCfs: null,
      gageHeightFt: null,
      timestamp: null,
      percentile: null,
      seasonalMedianCfs: stats.p50,
      trend: "unknown",
      mistLabel: "UNKNOWN",
      factor: null,
      currentAvailable: false,
      source: { id: "usgs-03404500", label: "USGS station 03404500", url: latestUrl, timestamp: null, ageMinutes: null, freshness: "unavailable", detail: "No current reading; seasonal distribution is shown separately" },
      errors: [message],
    };
  }
}
