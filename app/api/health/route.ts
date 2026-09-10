import { NextRequest, NextResponse } from "next/server";
import { MODEL_CONFIG } from "@/lib/config";
import { databaseConfigured } from "@/lib/feedback";
import { getLiveDecision } from "@/lib/engine";
import { parseTargetDate } from "@/lib/time";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const generatedAt = new Date().toISOString();
  if (request.nextUrl.searchParams.get("deep") !== "1") {
    return NextResponse.json({ status: "ok", service: "cumberland-moonbow", modelVersion: MODEL_CONFIG.version, modelId: MODEL_CONFIG.id, generatedAt, feedbackStorage: databaseConfigured() ? "configured" : "unconfigured" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await getLiveDecision(parseTargetDate(null), "local", new Date(), true);
    const dependencies = Object.fromEntries(result.sources.map((source) => [source.id, { state: source.freshness, ageMinutes: source.ageMinutes }]));
    const unavailable = result.sources.filter((source) => source.freshness === "unavailable").length;
    return NextResponse.json({ status: unavailable ? "degraded" : "ok", service: "cumberland-moonbow", modelVersion: MODEL_CONFIG.version, modelId: MODEL_CONFIG.id, generatedAt, decision: result.decision, score: result.score, estimatedChance: result.estimatedChance, confidence: result.confidence.score, liveAdaptersExercised: true, dependencies, feedbackStorage: databaseConfigured() ? "configured" : "unconfigured" }, { status: unavailable >= 4 ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ status: "degraded", service: "cumberland-moonbow", modelVersion: MODEL_CONFIG.version, modelId: MODEL_CONFIG.id, generatedAt, error: error instanceof Error ? error.message : "Deep health check failed", liveAdaptersExercised: false, feedbackStorage: databaseConfigured() ? "configured" : "unconfigured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
