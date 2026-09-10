import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { MODEL_CONFIG } from "./config";
import type { DecisionResult } from "./types";

export const feedbackSchema = z.object({
  outcome: z.enum(["YES", "FAINTLY", "NO"]),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pageLoadedAt: z.number().int().positive(),
  website: z.string().max(0).optional().default(""),
});

let initialized = false;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.FEEDBACK_HASH_SECRET);
}

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

async function ensureSchema() {
  if (initialized) return;
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS moonbow_outcomes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), timestamp TIMESTAMPTZ NOT NULL,
    target_date DATE NOT NULL, viewpoint TEXT NOT NULL, moonbow_visible BOOLEAN NOT NULL,
    visibility_strength SMALLINT NOT NULL CHECK (visibility_strength BETWEEN 0 AND 3),
    moon_illumination DOUBLE PRECISION, moon_altitude DOUBLE PRECISION, moon_azimuth DOUBLE PRECISION,
    sun_altitude DOUBLE PRECISION, flow_cfs DOUBLE PRECISION, flow_percentile DOUBLE PRECISION,
    cloud_forecast DOUBLE PRECISION, satellite_cloud_state TEXT, visibility_m DOUBLE PRECISION,
    precipitation_probability DOUBLE PRECISION, wind_speed_mps DOUBLE PRECISION, wind_direction DOUBLE PRECISION,
    model_score DOUBLE PRECISION NOT NULL, model_confidence DOUBLE PRECISION NOT NULL,
    observer_source TEXT NOT NULL, anonymous_reporter_hash TEXT NOT NULL, modeled_conditions JSONB NOT NULL,
    moderation_status TEXT NOT NULL DEFAULT 'unverified', calibration_weight DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    user_agent_family TEXT
  )`;
  await sql`CREATE INDEX IF NOT EXISTS moonbow_outcomes_abuse_idx ON moonbow_outcomes (anonymous_reporter_hash, created_at DESC)`;
  initialized = true;
}

function reporterHash(ip: string): string {
  const secret = process.env.FEEDBACK_HASH_SECRET;
  if (!secret) throw new Error("FEEDBACK_HASH_SECRET is not configured");
  const rotation = new Date().toISOString().slice(0, 7);
  return createHmac("sha256", secret).update(`${rotation}:${ip}`).digest("hex");
}

function browserFamily(userAgent: string): string {
  if (/Firefox/i.test(userAgent)) return "Firefox";
  if (/Edg/i.test(userAgent)) return "Edge";
  if (/Chrome/i.test(userAgent)) return "Chrome";
  if (/Safari/i.test(userAgent)) return "Safari";
  return "Other";
}

export async function storeFeedback(input: z.infer<typeof feedbackSchema>, decision: DecisionResult, ip: string, userAgent: string) {
  if (!databaseConfigured()) throw new Error("Feedback storage is not configured");
  await ensureSchema();
  const sql = getSql();
  const hash = reporterHash(ip);
  const recent = await sql`SELECT COUNT(*)::int AS count FROM moonbow_outcomes WHERE anonymous_reporter_hash = ${hash} AND created_at > NOW() - INTERVAL '1 hour'`;
  if (Number(recent[0]?.count ?? 0) >= 6) throw new Error("RATE_LIMIT");
  const now = new Date();
  const closest = decision.timeline.reduce((best, point) => Math.abs(new Date(point.timestamp).getTime() - now.getTime()) < Math.abs(new Date(best.timestamp).getTime() - now.getTime()) ? point : best, decision.timeline[0]);
  const modelPoint = decision.weather.modelConsensus?.points.find((point) => now >= new Date(point.start) && now < new Date(point.end)) ?? null;
  const strength = input.outcome === "YES" ? 3 : input.outcome === "FAINTLY" ? 1 : 0;
  const visible = input.outcome !== "NO";
  const modeledConditions = {
    modelId: MODEL_CONFIG.id,
    modelVersion: MODEL_CONFIG.version,
    estimatedChance: decision.estimatedChance,
    physicalScore: decision.score,
    confidence: decision.confidence.score,
    factors: closest.factors,
    hardGates: closest.hardGates,
    cloudInput: closest.cloudInput,
    modelConsensus: modelPoint ? { cloudCover: modelPoint.cloudCover, spread: modelPoint.spread, modelCount: modelPoint.modelCount, models: modelPoint.models } : null,
    mist: { dischargeCfs: decision.hydro.dischargeCfs, percentile: decision.hydro.percentile, label: decision.hydro.mistLabel },
    sourceStates: Object.fromEntries(decision.sources.map((source) => [source.id, source.freshness])),
  };
  await sql`INSERT INTO moonbow_outcomes (
    timestamp, target_date, viewpoint, moonbow_visible, visibility_strength,
    moon_illumination, moon_altitude, moon_azimuth, sun_altitude,
    flow_cfs, flow_percentile, cloud_forecast, satellite_cloud_state,
    visibility_m, precipitation_probability, wind_speed_mps, wind_direction,
    model_score, model_confidence, observer_source, anonymous_reporter_hash,
    modeled_conditions, moderation_status, calibration_weight, user_agent_family
  ) VALUES (
    ${now.toISOString()}, ${input.targetDate}, ${decision.viewpoint.id}, ${visible}, ${strength},
    ${closest.astronomy.moonIllumination}, ${closest.astronomy.moonAltitude}, ${closest.astronomy.moonAzimuth}, ${closest.astronomy.sunAltitude},
    ${decision.hydro.dischargeCfs}, ${decision.hydro.percentile}, ${modelPoint?.cloudCover ?? closest.weather?.cloudCover ?? null}, ${decision.satellite.classification},
    ${decision.weather.observation?.visibilityM ?? modelPoint?.visibilityM ?? null}, ${closest.weather?.precipitationProbability ?? null}, ${modelPoint?.windSpeedMps ?? closest.weather?.windSpeedMps ?? null}, ${modelPoint?.windDirection ?? closest.weather?.windDirection ?? null},
    ${decision.score}, ${decision.confidence.score}, 'anonymous_web', ${hash}, ${JSON.stringify(modeledConditions)}::jsonb,
    'unverified', 0.25, ${browserFamily(userAgent)}
  )`;
}
