import type { Metadata } from "next";
import { databaseConfigured } from "@/lib/feedback";
import { getLiveDecision } from "@/lib/engine";
import { parseTargetDate } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "System Diagnostics", robots: { index: false, follow: false } };

export default async function Diagnostics() {
  const result = await getLiveDecision(parseTargetDate(null), "local", new Date(), true);
  return <main className="content-page shell" id="main"><p className="content-page__eyebrow">Operational visibility</p><h1>System diagnostics</h1><p className="lede">Current adapter state, timestamps and data age for the production decision path.</p><div className="diagnostic-grid">{result.sources.map((source) => <div className="diagnostic-item" key={source.id}><strong>{source.label}</strong><span>{source.freshness}</span><p>{source.ageMinutes === null ? "No rolling age" : `${source.ageMinutes} minutes old`}</p><small>{source.detail}</small></div>)}<div className="diagnostic-item"><strong>Feedback database</strong><span>{databaseConfigured() ? "configured" : "unconfigured"}</span><p>Anonymous reports are rate limited and begin unverified.</p></div></div><h2>Latest calculation</h2><p>{result.decision} · score {result.score}/100 · confidence {result.confidence.score}/100 · generated <time dateTime={result.generatedAt}>{result.generatedAt}</time>.</p><p><a href="/api/health?deep=1">Machine-readable deep health check</a></p></main>;
}
