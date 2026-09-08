import { MODEL_CONFIG } from "./config";
import type { ConfidenceResult, DecisionState, DriveCommitment, TimelinePoint, ViewingWindow } from "./types";

export function decide(score: number, confidence: ConfidenceResult, window: ViewingWindow | null, timeline: TimelinePoint[], drive: DriveCommitment): { decision: DecisionState; reason: string } {
  const safetyGate = timeline.flatMap((point) => point.hardGates).find((gate) => gate.startsWith("Dangerous weather:"));
  if (safetyGate) return { decision: "NO-GO", reason: safetyGate };
  const anyAstronomyViable = timeline.some((point) => point.viable || point.hardGates.every((gate) => gate.startsWith("Cloud") || gate.startsWith("Dangerous")));
  if (!anyAstronomyViable) return { decision: "NO-GO", reason: "No five-minute interval passes the physical moon, darkness, skyline, and bow-geometry gates." };
  if (confidence.score < MODEL_CONFIG.decision.tooEarlyConfidence) return { decision: "TOO EARLY TO CALL", reason: "The astronomy can be planned now, but reliable weather inputs are not available yet." };
  if (!window || score < MODEL_CONFIG.decision.conditionalScore) return { decision: "NO-GO", reason: "No sustained viewing period clears the minimum opportunity score." };
  const adjustment = MODEL_CONFIG.driveScoreAdjustments[drive];
  if (score >= MODEL_CONFIG.decision.goScore + adjustment && confidence.score >= MODEL_CONFIG.decision.goConfidence && window.durationMinutes >= MODEL_CONFIG.decision.minimumGoWindowMinutes) {
    return { decision: "GO", reason: `A sustained ${window.durationMinutes}-minute window clears the score and confidence thresholds for this trip.` };
  }
  if (score >= MODEL_CONFIG.decision.goodShotScore + Math.ceil(adjustment * 0.6) && confidence.score >= MODEL_CONFIG.decision.goodShotConfidence) {
    return { decision: "GOOD SHOT", reason: "Conditions are favorable, with at least one material uncertainty still worth watching." };
  }
  return { decision: "CONDITIONAL", reason: drive === "local" ? "A viable window exists, but one or more ingredients remain marginal." : "A viable window exists, but the evidence is not strong enough for this travel commitment." };
}
