"use client";

import { useEffect, useState } from "react";
import styles from "./forecast-change.module.css";

interface Snapshot {
  score: number | null;
  confidence: number;
  generatedAt: string;
}

export function ForecastChange({ targetDate, score, confidence, generatedAt, currentDriver }: { targetDate: string; score: number | null; confidence: number; generatedAt: string; currentDriver: string | null }) {
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  useEffect(() => {
    const key = `cumberland-moonbow:score-v1:${targetDate}`;
    let frame: number | null = null;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Snapshot;
        if (parsed.generatedAt !== generatedAt) {
          frame = window.requestAnimationFrame(() => setPrevious(parsed));
        }
      }
      window.localStorage.setItem(key, JSON.stringify({ score, confidence, generatedAt } satisfies Snapshot));
    } catch {
      // The decision tool remains fully functional when storage is blocked.
    }
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [targetDate, score, confidence, generatedAt]);
  if (!previous) return null;
  if (score === null || previous.score === null) return <aside className={styles.card}><strong>Since your last check</strong><p>Date-specific weather is not available for both snapshots yet. The astronomy window is still deterministic.</p></aside>;
  const difference = score - previous.score;
  return <aside className={styles.card} aria-label="Forecast change since your previous visit">
    <strong>Since your last check</strong>
    <div><span>{previous.score}/100</span><b aria-hidden="true">→</b><span>{score}/100</span><em>{difference === 0 ? "No material change" : `${difference > 0 ? "+" : ""}${difference} points`}</em></div>
    <p>{difference === 0 ? "The opportunity score is holding steady." : currentDriver ?? "The latest weather and river inputs changed the opportunity score."} Confidence is now {confidence}/100.</p>
  </aside>;
}
