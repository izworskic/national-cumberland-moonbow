import type { Metadata } from "next";
import Link from "next/link";
import { OFFICIAL_WINDOWS_2026 } from "@/lib/schedule-2026";
import { SOURCES } from "@/lib/config";

export const metadata: Metadata = { title: "2026 Moonbow Dates", description: "Official 2026 Cumberland Falls moonbow dates and approximate times, with links to a computed live decision for each night.", alternates: { canonical: "/cumberland-falls-moonbow/2026" } };

export default function Calendar2026() {
  return <main className="content-page shell" id="main"><p className="content-page__eyebrow">Kentucky State Parks schedule</p><h1>2026 moonbow dates</h1><p className="lede">Sixty-five approximate viewing windows, organized by evening of arrival. Pick a date to add local skyline geometry, clouds, Cumberland River flow and forecast confidence.</p>
    <p className="callout">Park times are planning envelopes, not visibility guarantees. Clouds, direct moonlight, mist and the effective skyline still decide the night.</p>
    <table><thead><tr><th>Date</th><th>Approximate time</th><th>Live decision</th></tr></thead><tbody>{OFFICIAL_WINDOWS_2026.map((window) => <tr key={window.date}><td><time dateTime={window.date}>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${window.date}T12:00:00Z`))}</time></td><td>{window.startLocal}–{window.endLocal}</td><td><Link href={`/cumberland-falls-moonbow?date=${window.date}`}>Check this night</Link></td></tr>)}</tbody></table>
    <p><a href={SOURCES.schedule2026.url}>View the original Kentucky State Parks 2026 PDF</a>. Its dates are based on the evening of arrival and all times are approximate.</p>
  </main>;
}
