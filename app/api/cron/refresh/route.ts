import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { getLiveDecision } from "@/lib/engine";
import { parseTargetDate } from "@/lib/time";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const today = parseTargetDate(null);
  const tomorrow = format(addDays(new Date(`${today}T12:00:00Z`), 1), "yyyy-MM-dd");
  const results = await Promise.all([getLiveDecision(today), getLiveDecision(tomorrow)]);
  return NextResponse.json({ ok: true, warmedAt: new Date().toISOString(), decisions: results.map((result) => ({ date: result.targetDate, decision: result.decision, score: result.score, confidence: result.confidence.score })) });
}
