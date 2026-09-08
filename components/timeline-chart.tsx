"use client";

import { useMemo, useState } from "react";
import { formatLocal } from "@/lib/time";
import type { TimelinePoint, ViewingWindow } from "@/lib/types";

type ChartPoint = Pick<TimelinePoint, "timestamp" | "score" | "viable" | "hardGates">;

export function TimelineChart({ points, window }: { points: ChartPoint[]; window: ViewingWindow | null }) {
  const compact = useMemo(() => points.filter((_, index) => index % 3 === 0), [points]);
  const [selected, setSelected] = useState(() => {
    if (!window) return Math.floor(compact.length / 2);
    const index = compact.findIndex((point) => point.timestamp >= window.peak);
    return Math.max(0, index);
  });
  const active = compact[selected] ?? compact[0];
  const width = 720, height = 210, pad = 28;
  const coords = compact.map((point, index) => ({ x: pad + index / Math.max(1, compact.length - 1) * (width - pad * 2), y: height - pad - point.score / 100 * (height - pad * 2) }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const description = `Moonbow Score from ${compact[0] ? formatLocal(compact[0].timestamp) : "evening"} through ${compact.at(-1) ? formatLocal(compact.at(-1)!.timestamp) : "morning"}. ${window ? `Best sustained window ${formatLocal(window.start)} to ${formatLocal(window.end)}, peak score ${window.peakScore}.` : "No viable sustained window."}`;
  return <div className="timeline-widget">
    <div className="chart-readout" aria-live="polite"><strong>{active ? formatLocal(active.timestamp) : "—"}</strong><span>Score {active?.score ?? 0}</span><span>{active?.viable ? "Physical gates pass" : active?.hardGates[0] ?? "Not viable"}</span></div>
    <svg className="timeline-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
      <title>{description}</title>
      {[25, 50, 75, 100].map((score) => <g key={score}><line x1={pad} x2={width - pad} y1={height - pad - score / 100 * (height - pad * 2)} y2={height - pad - score / 100 * (height - pad * 2)} /><text x="2" y={height - pad - score / 100 * (height - pad * 2) + 4}>{score}</text></g>)}
      <path d={`${path} L${width - pad},${height - pad} L${pad},${height - pad}Z`} className="chart-area" />
      <path d={path} className="chart-line" />
      {coords[selected] ? <circle cx={coords[selected].x} cy={coords[selected].y} r="6" className="chart-dot" /> : null}
    </svg>
    <label className="timeline-scrubber"><span>Explore the timeline</span><input aria-label="Select a time on the Moonbow Score timeline" type="range" min="0" max={Math.max(0, compact.length - 1)} value={selected} onChange={(event) => setSelected(Number(event.target.value))} /></label>
  </div>;
}
