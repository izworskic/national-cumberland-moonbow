import { NextRequest, NextResponse } from "next/server";
import { MODEL_CONFIG } from "@/lib/config";
import { getLiveDecision } from "@/lib/engine";
import { parseTargetDate } from "@/lib/time";
import type { DriveCommitment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const drives = new Set<DriveCommitment>(["local", "30m", "1h", "2h", "3h"]);

export async function GET(request: NextRequest) {
  const targetDate = parseTargetDate(request.nextUrl.searchParams.get("date"));
  const requestedDrive = request.nextUrl.searchParams.get("drive") as DriveCommitment | null;
  const drive = requestedDrive && drives.has(requestedDrive) ? requestedDrive : "local";
  try {
    const result = await getLiveDecision(targetDate, drive);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        "X-Moonbow-Model": MODEL_CONFIG.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown moonbow engine failure";
    return NextResponse.json({ ok: false, error: { code: "MOONBOW_ENGINE_UNAVAILABLE", message }, model: MODEL_CONFIG.id }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
