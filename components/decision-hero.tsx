import Image from "next/image";
import { AlertIcon, CheckIcon, ClockIcon } from "./icons";
import { formatLocal } from "@/lib/time";
import type { DecisionResult } from "@/lib/types";
import { SourceStamp } from "./source-stamp";

function dateLabel(result: DecisionResult): string {
  const target = new Date(`${result.targetDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { timeZone: result.timezone, weekday: "long", month: "long", day: "numeric" }).format(target);
}

export function DecisionHero({ result }: { result: DecisionResult }) {
  const positive = result.decision === "GO" || result.decision === "GOOD SHOT";
  const primaryLive = result.sources.filter((source) => source.id.startsWith("usgs-") || ["nws-grid", "goes-19-acmc"].includes(source.id));
  const freshest = primaryLive.filter((source) => source.freshness === "fresh").length;
  const liveDataNotNeeded = primaryLive.some((source) => source.detail?.includes("deterministic Moon gates"));
  return <section className="hero" data-decision={result.decision}>
    <Image src="/images/cumberland-falls-moonbow.jpg" alt="A pale moonbow arcing through mist below Cumberland Falls at night" fill priority sizes="100vw" className="hero__image" />
    <div className="hero__wash" />
    <div className="hero__content shell">
      <div className="hero__eyebrow"><span>Cumberland Falls Moonbow</span><span>{dateLabel(result)}</span></div>
      <article className="decision-card" aria-labelledby="decision-title">
        <div className="decision-card__topline">
          <p className="decision-state" id="decision-title">{positive ? <CheckIcon /> : <AlertIcon />}{result.decision}{result.targetDate === new Intl.DateTimeFormat("en-CA", { timeZone: result.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) ? " TONIGHT" : ""}</p>
          <p className="data-live"><span className={freshest ? "pulse" : "pulse pulse--muted"} />{freshest ? `${freshest} live sources fresh` : liveDataNotNeeded ? "Live data not needed" : "Live sources limited"}</p>
        </div>
        <div className="decision-grid">
          <div className="score-block"><span>{result.scoreLabel}</span><strong>{result.score}</strong><small>/ 100</small></div>
          <dl className="decision-facts">
            <div><dt>Best window</dt><dd>{result.bestWindow ? `${formatLocal(result.bestWindow.start)} – ${formatLocal(result.bestWindow.end)}` : "No viable window"}</dd></div>
            <div><dt>Arrive by</dt><dd>{result.arrivalTime ? formatLocal(result.arrivalTime) : "Do not make the trip"}</dd></div>
            <div><dt>Forecast confidence</dt><dd><span className={`confidence confidence--${result.confidence.level.toLowerCase()}`}>{result.confidence.level}</span> {result.confidence.score}/100</dd></div>
          </dl>
        </div>
        <p className="decision-reason">{result.decisionReason}</p>
        <ul className="drivers" aria-label="Conditions driving this recommendation">
          {result.drivers.map((driver, index) => <li key={`${index}-${driver.text}`} data-tone={driver.tone}><span aria-hidden="true" />{driver.text}</li>)}
        </ul>
        <div className="hero-sources">
          {primaryLive.slice(0, 3).map((source) => <SourceStamp key={source.id} source={source} compact />)}
        </div>
        {result.bestWindow ? <p className="peak-line"><ClockIcon />Peak {formatLocal(result.bestWindow.peak)} · Score {result.bestWindow.peakScore} · {result.bestWindow.durationMinutes} min sustained window</p> : null}
      </article>
      <p className="photo-credit">Photo: Design219 / Wikimedia Commons · CC BY-SA 4.0</p>
    </div>
  </section>;
}
