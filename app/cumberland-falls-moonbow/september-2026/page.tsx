import type { Metadata } from "next";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { astronomyAt } from "@/lib/astronomy";
import { OFFICIAL_WINDOWS_2026 } from "@/lib/schedule-2026";
import { TIMEZONE } from "@/lib/config";

export const metadata: Metadata = { title: "September 2026 Moonbow Times", description: "September 2026 Cumberland Falls moonbow dates with computed Moon altitude, azimuth and effective skyline at each official start time.", alternates: { canonical: "/cumberland-falls-moonbow/september-2026" } };

function localStart(date: string, clock: string) { const next = Number(clock.slice(0, 2)) < 5; const day = next ? format(addDays(parseISO(date), 1), "yyyy-MM-dd") : date; return fromZonedTime(`${day}T${clock}:00`, TIMEZONE); }

export default function September2026() {
  const windows = OFFICIAL_WINDOWS_2026.filter((window) => window.date.startsWith("2026-09")).map((window) => ({ ...window, astronomy: astronomyAt(localStart(window.date, window.startLocal)) }));
  return <main className="content-page shell" id="main"><p className="content-page__eyebrow">Monthly field plan</p><h1>September 2026 moonbow</h1><p className="lede">The official window runs September 24–28. The Moon shifts northward each evening, so the effective tree-lined skyline becomes progressively more important.</p>
    <table><thead><tr><th>Arrival date</th><th>Park time</th><th>Moon at start</th><th>Effective skyline</th></tr></thead><tbody>{windows.map((window) => <tr key={window.date}><td><Link href={`/cumberland-falls-moonbow?date=${window.date}`}>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${window.date}T12:00:00Z`))}</Link></td><td>{window.startLocal}–{window.endLocal}</td><td>{window.astronomy.moonAltitude.toFixed(1)}° at {Math.round(window.astronomy.moonAzimuth)}°</td><td>{window.astronomy.effectiveSkyline.toFixed(1)}°</td></tr>)}</tbody></table>
    <h2>What changes as the date approaches</h2><p>More than seven days out, the tool keeps weather in planning mode. At seven days it adds the NWS grid. Inside three hours it gives NOAA’s GOES cloud mask and surface observations more influence. The Moon geometry itself does not change between those modes.</p>
  </main>;
}
