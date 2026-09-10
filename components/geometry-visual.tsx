"use client";

import { useMemo, useState } from "react";
import type { TimelinePoint } from "@/lib/types";
import styles from "./geometry-visual.module.css";

function localTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

export function MoonbowGeometryVisual({ points, peakTimestamp }: { points: TimelinePoint[]; peakTimestamp: string | null }) {
  const defaultIndex = useMemo(() => {
    if (!peakTimestamp) return Math.floor(points.length / 2);
    const target = new Date(peakTimestamp).getTime();
    return points.reduce((best, point, index) => Math.abs(new Date(point.timestamp).getTime() - target) < Math.abs(new Date(points[best].timestamp).getTime() - target) ? index : best, 0);
  }, [peakTimestamp, points]);
  const [index, setIndex] = useState(defaultIndex);
  const point = points[Math.min(index, points.length - 1)];
  if (!point) return null;
  const altitude = Math.max(0, Math.min(42, point.astronomy.moonAltitude));
  const moonY = 134 - altitude / 42 * 94;
  const geometryStrength = Math.max(0, Math.min(1, point.factors.geometry));
  const mistStrength = Math.max(0, Math.min(1, point.factors.mist * point.factors.mistPlacement));
  const cloudTransmission = Math.max(0, Math.min(1, point.factors.cloud));

  return <section className={styles.panel} aria-labelledby="geometry-explorer-title">
    <div className={styles.heading}><div><p>Optical geometry</p><h2 id="geometry-explorer-title">Why this time works</h2></div><strong>{localTime(point.timestamp)}</strong></div>
    <svg className={styles.scene} viewBox="0 0 760 260" role="img" aria-label={`Moonbow geometry at ${localTime(point.timestamp)}. Moon altitude ${point.astronomy.moonAltitude.toFixed(1)} degrees, geometry error ${point.astronomy.geometryError.toFixed(1)} degrees.`}>
      <path className={styles.ridge} d="M0 176 C110 160 170 171 260 168 C350 165 400 174 478 166 C560 155 632 166 760 154 L760 260 L0 260 Z" />
      <line className={styles.falls} x1="575" y1="150" x2="575" y2="235" />
      <ellipse className={styles.mist} cx="548" cy="210" rx={48 + 24 * mistStrength} ry={20 + 16 * mistStrength} />
      <circle className={styles.observer} cx="205" cy="193" r="7" />
      <line className={styles.sight} x1="212" y1="190" x2="535" y2="205" />
      <circle className={styles.moon} cx="78" cy={moonY} r="15" />
      <line className={styles.moonbeam} x1="92" y1={moonY + 5} x2="545" y2="195" style={{ opacity: 0.18 + 0.82 * cloudTransmission }} />
      <path className={styles.bow} d="M500 224 Q548 155 596 224" style={{ opacity: 0.12 + 0.88 * geometryStrength }} />
      <text x="48" y={moonY - 24}>Moon</text><text x="170" y="218">Overlook</text><text x="585" y="174">Falls</text><text x="520" y="246">mist zone</text>
    </svg>
    <label className={styles.scrubber}>Explore the night
      <input type="range" min="0" max={Math.max(0, points.length - 1)} value={index} onChange={(event) => setIndex(Number(event.target.value))} aria-label="Explore moonbow conditions through the night" />
    </label>
    <div className={styles.metrics}>
      <div><span>Moon altitude</span><strong>{point.astronomy.moonAltitude.toFixed(1)}°</strong></div>
      <div><span>Bow/mist error</span><strong>{point.astronomy.geometryError.toFixed(1)}°</strong></div>
      <div><span>Mist placement</span><strong>{Math.round(point.factors.mistPlacement * 100)}/100</strong></div>
      <div><span>Cloud transmission</span><strong>{Math.round(point.factors.cloud * 100)}/100</strong></div>
      <div><span>Physical score</span><strong>{point.score}/100</strong></div>
    </div>
    <p className={styles.note}>This is an explanatory cross-section, not a literal camera view. The engine itself uses topocentric Moon position, the 40–42° primary-bow geometry, the cached local skyline and a modeled mist volume at five-minute resolution.</p>
  </section>;
}
