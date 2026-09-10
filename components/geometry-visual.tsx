"use client";

import { useMemo, useState } from "react";
import type { TimelinePoint } from "@/lib/types";
import styles from "./geometry-visual.module.css";

type HotspotId = "moon" | "overlook" | "falls" | "mist" | "bow" | "ridge";

const HOTSPOTS: Record<HotspotId, { label: string; description: string }> = {
  moon: {
    label: "Moon",
    description: "The Moon must be bright, clear of the ridge and in the right part of the sky. Its altitude changes the bow geometry through the night.",
  },
  overlook: {
    label: "Falls Overlook",
    description: "This is the reference observer position. The engine evaluates the Moon, skyline and mist geometry from the public viewing area.",
  },
  falls: {
    label: "Cumberland Falls",
    description: "The waterfall creates the spray field that makes a moonbow possible. River flow affects how much mist is available.",
  },
  mist: {
    label: "Mist zone",
    description: "The bow has to intersect usable spray. Flow controls mist production, while wind can move the spray toward or away from the best viewing geometry.",
  },
  bow: {
    label: "Moonbow zone",
    description: "A primary moonbow appears roughly 40–42° from the anti-lunar point. The brighter this arc appears here, the better the modeled bow-to-mist alignment.",
  },
  ridge: {
    label: "Gorge skyline",
    description: "Local terrain and trees can block low moonlight. The model uses a cached local skyline rather than assuming a flat horizon.",
  },
};

function localTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function MoonbowGeometryVisual({ points, peakTimestamp }: { points: TimelinePoint[]; peakTimestamp: string | null }) {
  const defaultIndex = useMemo(() => {
    if (!points.length) return 0;
    if (!peakTimestamp) return Math.floor(points.length / 2);
    const target = new Date(peakTimestamp).getTime();
    return points.reduce(
      (best, point, index) =>
        Math.abs(new Date(point.timestamp).getTime() - target) < Math.abs(new Date(points[best].timestamp).getTime() - target)
          ? index
          : best,
      0,
    );
  }, [peakTimestamp, points]);

  const [index, setIndex] = useState(defaultIndex);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotId>("bow");
  const point = points[Math.min(index, Math.max(0, points.length - 1))];
  if (!point) return null;

  const peakIndex = peakTimestamp
    ? points.reduce(
        (best, candidate, candidateIndex) =>
          Math.abs(new Date(candidate.timestamp).getTime() - new Date(peakTimestamp).getTime()) <
          Math.abs(new Date(points[best].timestamp).getTime() - new Date(peakTimestamp).getTime())
            ? candidateIndex
            : best,
        0,
      )
    : defaultIndex;

  const altitude = clamp(point.astronomy.moonAltitude, 0, 42);
  const moonY = 112 - (altitude / 42) * 72;
  const geometryStrength = clamp(point.factors.geometry, 0, 1);
  const mistStrength = clamp(point.factors.mist * point.factors.mistPlacement, 0, 1);
  const cloudTransmission = clamp(point.factors.cloud, 0, 1);
  const sceneState = point.viable ? "Geometry is working" : point.hardGates[0] ?? "Conditions are limiting the bow";
  const selected = HOTSPOTS[selectedHotspot];
  const bowOpacity = 0.18 + geometryStrength * 0.82;
  const mistOpacity = 0.32 + mistStrength * 0.48;
  const beamOpacity = 0.12 + cloudTransmission * 0.62;

  return (
    <section className={styles.panel} aria-labelledby="geometry-explorer-title">
      <div className={styles.heading}>
        <div>
          <p>Interactive moonbow diorama</p>
          <h2 id="geometry-explorer-title">See why this time works</h2>
          <span>Scrub the evening, then tap a feature to understand the geometry.</span>
        </div>
        <div className={styles.timeBadge} aria-live="polite">
          <small>Viewing time</small>
          <strong>{localTime(point.timestamp)}</strong>
        </div>
      </div>

      <div className={styles.sceneShell}>
        <svg
          className={styles.scene}
          viewBox="0 0 920 470"
          role="img"
          aria-label={`Explanatory Cumberland Falls moonbow diorama at ${localTime(point.timestamp)}. Moon altitude ${point.astronomy.moonAltitude.toFixed(1)} degrees, geometry error ${point.astronomy.geometryError.toFixed(1)} degrees, physical score ${point.score} out of 100.`}
        >
          <defs>
            <linearGradient id="moonbowSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b9d9e7" />
              <stop offset="58%" stopColor="#dcebed" />
              <stop offset="100%" stopColor="#edf2e9" />
            </linearGradient>
            <linearGradient id="farRidge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7e9f91" />
              <stop offset="100%" stopColor="#658778" />
            </linearGradient>
            <linearGradient id="nearRidge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#547568" />
              <stop offset="100%" stopColor="#35594f" />
            </linearGradient>
            <linearGradient id="riverFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8fc7d1" />
              <stop offset="55%" stopColor="#b7dce0" />
              <stop offset="100%" stopColor="#78b4c0" />
            </linearGradient>
            <linearGradient id="fallsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8ffff" />
              <stop offset="55%" stopColor="#d8eef0" />
              <stop offset="100%" stopColor="#a8d0d7" />
            </linearGradient>
            <radialGradient id="mistGlow" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity=".96" />
              <stop offset="55%" stopColor="#e8f4f4" stopOpacity=".76" />
              <stop offset="100%" stopColor="#c7dfe0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff9d8" stopOpacity=".8" />
              <stop offset="100%" stopColor="#fff9d8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bowStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b5b7e8" />
              <stop offset="35%" stopColor="#d7b9dd" />
              <stop offset="68%" stopColor="#cbd9a7" />
              <stop offset="100%" stopColor="#a8cde2" />
            </linearGradient>
            <filter id="softBlur"><feGaussianBlur stdDeviation="10" /></filter>
            <filter id="waterBlur"><feGaussianBlur stdDeviation="2" /></filter>
          </defs>

          <rect width="920" height="470" rx="28" fill="url(#moonbowSky)" />
          <circle cx="118" cy={moonY + 8} r="48" fill="url(#moonGlow)" />
          <circle className={styles.moon} cx="118" cy={moonY + 8} r="19" />

          <path className={styles.farRidge} d="M0 220 C95 181 173 206 246 189 C332 168 397 205 475 188 C555 171 624 191 703 166 C775 144 845 164 920 132 L920 470 L0 470 Z" fill="url(#farRidge)" />
          <path className={styles.nearRidge} d="M0 302 C110 266 214 285 313 257 C407 230 476 266 568 240 C653 215 719 238 805 207 C850 191 884 194 920 180 L920 470 L0 470 Z" fill="url(#nearRidge)" />

          <path className={styles.upperRiver} d="M570 244 C655 242 708 231 775 213 C826 199 875 191 920 187 L920 222 C866 228 820 238 773 253 C702 276 642 279 570 272 Z" fill="url(#riverFill)" />
          <path className={styles.ledge} d="M565 246 C612 249 657 246 704 235 L704 268 C658 280 614 282 565 277 Z" />
          <path className={styles.fallsBody} d="M571 263 C606 266 644 263 681 252 L681 356 C649 368 612 370 575 359 Z" fill="url(#fallsFill)" />
          <path className={styles.fallsThread} d="M590 271 C598 300 593 328 602 354 M620 268 C624 294 620 329 628 361 M650 261 C649 294 651 320 646 353" />
          <path className={styles.lowerRiver} d="M558 359 C639 347 700 357 772 378 C822 393 865 395 920 392 L920 470 L523 470 C539 432 548 392 558 359 Z" fill="url(#riverFill)" />
          <path className={styles.waterHighlight} d="M585 393 C658 380 720 391 789 409 C827 419 861 421 902 418" />

          <ellipse
            className={styles.mistGlow}
            cx="635"
            cy="355"
            rx={86 + 34 * mistStrength}
            ry={48 + 22 * mistStrength}
            fill="url(#mistGlow)"
            style={{ opacity: mistOpacity }}
          />
          <ellipse className={styles.mistSoft} cx="624" cy="344" rx="74" ry="30" style={{ opacity: mistOpacity }} />

          <path className={styles.overlookShelf} d="M154 311 L308 305 L333 325 L169 334 Z" />
          <path className={styles.railing} d="M179 304 L179 280 M211 306 L211 282 M244 306 L244 282 M277 307 L277 283 M177 285 L279 287" />
          <circle className={styles.observerHead} cx="255" cy="280" r="7" />
          <path className={styles.observerBody} d="M255 288 L255 308 M255 294 L243 302 M255 294 L266 302 M255 308 L246 321 M255 308 L265 321" />

          <path
            className={styles.moonbeam}
            d={`M142 ${moonY + 16} C315 ${moonY + 60} 478 214 616 326`}
            style={{ opacity: beamOpacity }}
          />
          <path className={styles.sight} d="M267 285 C380 302 500 318 606 338" />
          <path
            className={styles.bowGlow}
            d="M567 369 C594 301 663 278 708 355"
            style={{ opacity: bowOpacity * 0.42 }}
          />
          <path
            className={styles.bow}
            d="M567 369 C594 301 663 278 708 355"
            stroke="url(#bowStroke)"
            style={{ opacity: bowOpacity }}
          />

          <g className={styles.sceneLabel} transform={`translate(78 ${moonY - 18})`}><rect width="80" height="27" rx="13.5" /><text x="40" y="18">Moon</text></g>
          <g className={styles.sceneLabel} transform="translate(176 340)"><rect width="108" height="27" rx="13.5" /><text x="54" y="18">Overlook</text></g>
          <g className={styles.sceneLabel} transform="translate(677 232)"><rect width="118" height="27" rx="13.5" /><text x="59" y="18">Upper river</text></g>
          <g className={styles.sceneLabel} transform="translate(688 325)"><rect width="93" height="27" rx="13.5" /><text x="46.5" y="18">Falls</text></g>
          <g className={styles.sceneLabel} transform="translate(533 400)"><rect width="105" height="27" rx="13.5" /><text x="52.5" y="18">Mist zone</text></g>
        </svg>

        <div className={styles.hotspots} aria-label="Diorama features">
          <button className={`${styles.hotspot} ${styles.hotspotMoon} ${selectedHotspot === "moon" ? styles.hotspotActive : ""}`} type="button" onClick={() => setSelectedHotspot("moon")} aria-pressed={selectedHotspot === "moon"} aria-label="Explain the Moon"><span>1</span></button>
          <button className={`${styles.hotspot} ${styles.hotspotOverlook} ${selectedHotspot === "overlook" ? styles.hotspotActive : ""}`} type="button" onClick={() => setSelectedHotspot("overlook")} aria-pressed={selectedHotspot === "overlook"} aria-label="Explain the Falls Overlook"><span>2</span></button>
          <button className={`${styles.hotspot} ${styles.hotspotFalls} ${selectedHotspot === "falls" ? styles.hotspotActive : ""}`} type="button" onClick={() => setSelectedHotspot("falls")} aria-pressed={selectedHotspot === "falls"} aria-label="Explain Cumberland Falls"><span>3</span></button>
          <button className={`${styles.hotspot} ${styles.hotspotMist} ${selectedHotspot === "mist" ? styles.hotspotActive : ""}`} type="button" onClick={() => setSelectedHotspot("mist")} aria-pressed={selectedHotspot === "mist"} aria-label="Explain the mist zone"><span>4</span></button>
          <button className={`${styles.hotspot} ${styles.hotspotBow} ${selectedHotspot === "bow" ? styles.hotspotActive : ""}`} type="button" onClick={() => setSelectedHotspot("bow")} aria-pressed={selectedHotspot === "bow"} aria-label="Explain the moonbow zone"><span>5</span></button>
          <button className={`${styles.hotspot} ${styles.hotspotRidge} ${selectedHotspot === "ridge" ? styles.hotspotActive : ""}`} type="button" onClick={() => setSelectedHotspot("ridge")} aria-pressed={selectedHotspot === "ridge"} aria-label="Explain the gorge skyline"><span>6</span></button>
        </div>

        <div className={styles.sceneStatus}>
          <span className={point.viable ? styles.statusGood : styles.statusLimited} aria-hidden="true" />
          <strong>{sceneState}</strong>
          <small>{point.viable ? `Physical score ${point.score}/100` : "Scrub the timeline to see what changes."}</small>
        </div>
      </div>

      <div className={styles.explainer} aria-live="polite">
        <div className={styles.explainerIndex}>{Object.keys(HOTSPOTS).indexOf(selectedHotspot) + 1}</div>
        <div>
          <strong>{selected.label}</strong>
          <p>{selected.description}</p>
        </div>
      </div>

      <div className={styles.timelineControls}>
        <div className={styles.jumpControls} aria-label="Jump through the viewing window">
          <button type="button" onClick={() => setIndex(0)}>Start</button>
          <button type="button" className={styles.peakButton} onClick={() => setIndex(peakIndex)}>Best</button>
          <button type="button" onClick={() => setIndex(points.length - 1)}>End</button>
        </div>
        <label className={styles.scrubber}>
          <span><strong>Explore the night</strong><small>{localTime(points[0].timestamp)} → {localTime(points.at(-1)?.timestamp ?? point.timestamp)}</small></span>
          <input type="range" min="0" max={Math.max(0, points.length - 1)} value={index} onChange={(event) => setIndex(Number(event.target.value))} aria-label="Explore moonbow conditions through the night" />
        </label>
      </div>

      <div className={styles.metrics}>
        <div><span>Moon altitude</span><strong>{point.astronomy.moonAltitude.toFixed(1)}°</strong></div>
        <div><span>Bow/mist error</span><strong>{point.astronomy.geometryError.toFixed(1)}°</strong></div>
        <div><span>Mist placement</span><strong>{Math.round(point.factors.mistPlacement * 100)}/100</strong></div>
        <div><span>Cloud transmission</span><strong>{Math.round(point.factors.cloud * 100)}/100</strong></div>
        <div><span>Physical score</span><strong>{point.score}/100</strong></div>
      </div>

      <p className={styles.note}>This is an explanatory diorama, not a literal camera view. The engine itself uses topocentric Moon position, the 40–42° primary-bow geometry, the cached local skyline and a modeled mist volume at five-minute resolution.</p>
    </section>
  );
}
