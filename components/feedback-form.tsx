"use client";

import { useState } from "react";

export function FeedbackForm({ targetDate, enabled }: { targetDate: string; enabled: boolean }) {
  const [loadedAt] = useState(() => Date.now());
  const [message, setMessage] = useState(enabled ? "One tap. Reports are unverified until corroborated." : "Field reporting is temporarily unavailable.");
  const [busy, setBusy] = useState(false);
  async function submit(outcome: "YES" | "FAINTLY" | "NO") {
    setBusy(true);
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, targetDate, pageLoadedAt: loadedAt, website: "" }) });
      const data = await response.json() as { message?: string; error?: string };
      setMessage(data.message ?? data.error ?? "We could not save that report.");
    } catch { setMessage("We could not reach the reporting service."); }
    finally { setBusy(false); }
  }
  return <div className="feedback-card">
    <div><p className="kicker">Field calibration</p><h2>Did you see the moonbow?</h2><p>{message}</p></div>
    <div className="feedback-actions" aria-label="Report a moonbow sighting">
      {(["YES", "FAINTLY", "NO"] as const).map((outcome) => <button key={outcome} type="button" disabled={!enabled || busy} onClick={() => submit(outcome)}>{outcome === "YES" ? "Yes" : outcome === "FAINTLY" ? "Faintly" : "No"}</button>)}
    </div>
    <label className="honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" name="website" /></label>
  </div>;
}
