"use client";

import { useEffect, useState } from "react";
import styles from "./forecast-change.module.css";

interface Snapshot {
  chance: number | null;
  confidence: number;
  generatedAt: string;
}

export function ForecastChange({ targetDate, chance, confidence, generatedAt, currentDriver }: { targetDate: string; chance: number | null; confidence: number; generatedAt: string; currentDriver: string | null }) {
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  useEffect(() => {
    const key = `cumberland-moonbow:${targetDate}`;
    let frame: number | null = null;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Snapshot;
        if (parsed.generatedAt !== generatedAt) {
          frame = window.requestAnimationFrame(() => setPrevious(parsed));
        }
      }
      window.localStorage.setItem(key, JSON.stringify({ chance, confidence, generatedAt } satisfies Snapshot));
    } catch {
      // The decision tool remains fully functional when storage is blocked.
    }
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [targetDate, chance, confidence, generatedAt]);
  if (!previous) return null;
  if (chance === null || previous.chance === null) return <aside className={styles.card}><strong>Since your last check</strong><p>Date-specific weather is not available for both snapshots yet. The astronomy window is still deterministic.</p></aside>;
  const difference = chance - previous.chance;
  return <aside className={styles.card} aria-label="Forecast change since your previous visit">
    <strong>Since your last check</strong>
    <div><span>{previous.chance}%</span><b aria-hidden="true">→</b><span>{chance}%</span><em>{difference === 0 ? "No material change" : `${difference > 0 ? "+" : ""}${difference} points`}</em></div>
    <p>{difference === 0 ? "The estimated chance is holding steady." : currentDriver ?? "The latest weather and river inputs changed the estimate."} Confidence is now {confidence}/100.</p>
  </aside>;
}
