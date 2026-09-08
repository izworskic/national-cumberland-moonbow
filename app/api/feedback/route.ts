import { NextRequest, NextResponse } from "next/server";
import { getLiveDecision } from "@/lib/engine";
import { feedbackSchema, storeFeedback } from "@/lib/feedback";
import { logEvent } from "@/lib/logging";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  try {
    const parsed = feedbackSchema.parse(await request.json());
    if (parsed.website || Date.now() - parsed.pageLoadedAt < 2_000 || Date.now() - parsed.pageLoadedAt > 86_400_000) return NextResponse.json({ error: "Report rejected" }, { status: 400 });
    const decision = await getLiveDecision(parsed.targetDate, "local");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await storeFeedback(parsed, decision, ip, request.headers.get("user-agent") ?? "unknown");
    logEvent("info", "visitor_outcome_report", { outcome: parsed.outcome, target_date: parsed.targetDate, model_score: decision.score, confidence: decision.confidence.score });
    return NextResponse.json({ ok: true, message: "Thanks — your report was saved as unverified field evidence." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent("warn", "visitor_outcome_report_failed", { error: message });
    if (message === "RATE_LIMIT") return NextResponse.json({ error: "Report limit reached. Please try again later." }, { status: 429 });
    if (message.includes("not configured")) return NextResponse.json({ error: "Field reporting is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "We could not save that report." }, { status: 400 });
  }
}
