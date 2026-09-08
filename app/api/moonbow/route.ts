import { NextRequest, NextResponse } from "next/server";
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
  const result = await getLiveDecision(targetDate, drive);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Moonbow-Model": "1.0.0",
    },
  });
}
