import Image from "next/image";
import Link from "next/link";
import { databaseConfigured } from "@/lib/feedback";
import { OFFICIAL_WINDOWS_2026 } from "@/lib/schedule-2026";
import { round } from "@/lib/time";
import type { DecisionResult } from "@/lib/types";
import { ArrowIcon, CloudIcon, MoonIcon, PinIcon, RiverIcon } from "./icons";
import { TimelineChart } from "./timeline-chart";
import { SourceStamp } from "./source-stamp";
import { FeedbackForm } from "./feedback-form";

function percent(value: number | null | undefined): string { return value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`; }
function numeric(value: number | null | undefined, unit = ""): string { return value === null || value === undefined ? "Unavailable" : `${Math.round(value).toLocaleString()}${unit}`; }
function factorLabel(value: string): string { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }

export function Dashboard({ result }: { result: DecisionResult }) {
  const peakPoint = result.bestWindow
    ? result.timeline.reduce((best, point) => Math.abs(new Date(point.timestamp).getTime() - new Date(result.bestWindow!.peak).getTime()) < Math.abs(new Date(best.timestamp).getTime() - new Date(result.bestWindow!.peak).getTime()) ? point : best, result.timeline[0])
    : result.timeline.reduce((best, point) => point.score > best.score ? point : best, result.timeline[0]);
  const modelPeak = result.bestWindow
    ? result.weather.modelConsensus?.points.find((point) => new Date(result.bestWindow!.peak) >= new Date(point.start) && new Date(result.bestWindow!.peak) < new Date(point.end))
    : null;
  const nextWindows = OFFICIAL_WINDOWS_2026.filter((window) => window.date > result.targetDate).slice(0, 5);
  const chartPoints = result.timeline.map(({ timestamp, score, viable, hardGates }) => ({ timestamp, score, viable, hardGates }));
  const forecastCloud = peakPoint?.cloudInput.forecast;
  const observation = result.weather.observation;
  const planning = result.confidence.mode === "CLIMATOLOGY / PLANNING";
  const climateSource = result.sources.find((source) => source.id === "ncei-cloud-climatology");
  return <>
    <div className="main-content shell">
      <section className="section-block" aria-labelledby="timeline-title">
        <div className="section-heading"><div><p className="kicker">Five-minute engine</p><h2 id="timeline-title">Tonight timeline</h2></div><p>{result.bestWindow ? `${result.bestWindow.startsBecause} ${result.bestWindow.endsBecause}` : "Every interval is stopped by at least one physical or safety gate."}</p></div>
        <TimelineChart points={chartPoints} window={result.bestWindow} />
      </section>

      <div className="dashboard-grid">
        <section className="data-card" aria-labelledby="moon-title"><div className="card-title"><MoonIcon /><div><p className="kicker">Deterministic</p><h2 id="moon-title">Moon + geometry</h2></div></div>
          <div className="metric-row"><div><span>Illumination</span><strong>{percent(result.astronomySummary.illumination)}</strong></div><div><span>Peak altitude</span><strong>{peakPoint ? `${round(peakPoint.astronomy.moonAltitude, 1)}°` : "—"}</strong></div><div><span>Bow error</span><strong>{peakPoint ? `${round(peakPoint.astronomy.geometryError, 1)}°` : "—"}</strong></div></div>
          <div className="skyline-meter"><span style={{ width: `${Math.min(100, (peakPoint?.astronomy.moonAltitude ?? 0) / 42 * 100)}%` }} /><i style={{ left: `${Math.min(100, (peakPoint?.astronomy.effectiveSkyline ?? 0) / 42 * 100)}%` }} /></div>
          <p className="card-note">Effective skyline {peakPoint?.astronomy.effectiveSkyline ?? "—"}°: {peakPoint?.astronomy.terrainHorizon ?? "—"}° bare earth + {peakPoint?.astronomy.treeCorrection ?? "—"}° trees/clearance. The primary-bow cone is checked against the modeled mist field.</p>
          <SourceStamp source={result.sources.find((source) => source.id === "astronomy-engine")!} />
        </section>

        <section className="data-card data-card--cloud" aria-labelledby="cloud-title"><div className="card-title"><CloudIcon /><div><p className="kicker">{planning ? "Seasonal history" : "Multi-model + nowcast"}</p><h2 id="cloud-title">Moonlight path</h2></div></div>
          {planning ? <>
            <div className="metric-row"><div><span>Expected transmission</span><strong>{percent(peakPoint?.factors.cloud)}</strong></div><div><span>Forecast models</span><strong>Not yet</strong></div><div><span>GOES nowcast</span><strong>Not yet</strong></div></div>
            <div className="planning-cloud"><strong>Planning signal only</strong><p>A ten-year nighttime sky-cover history informs this score. It does not predict clouds on this date.</p></div>
            {climateSource ? <SourceStamp source={climateSource} /> : null}
          </> : <>
            <div className="metric-row"><div><span>Model consensus</span><strong>{modelPeak?.cloudCover === null || modelPeak?.cloudCover === undefined ? "—" : `${Math.round(modelPeak.cloudCover)}%`}</strong></div><div><span>Model spread</span><strong>{modelPeak?.spread === null || modelPeak?.spread === undefined ? "—" : `${Math.round(modelPeak.spread * 100)} pts`}</strong></div><div><span>NWS grid</span><strong>{percent(forecastCloud)}</strong></div></div>
            {modelPeak?.models.length ? <ul className="plain-list" aria-label="Forecast model cloud cover">{modelPeak.models.map((model) => <li key={model.model}><strong>{model.model}</strong> {model.cloudCover === null ? "unavailable" : `${Math.round(model.cloudCover)}% cloud`}</li>)}</ul> : <p className="missing-data">Multi-model guidance is unavailable for this hour; the engine falls back to available NWS/observed inputs and lowers confidence.</p>}
            <div className="satellite-frame"><Image src={result.satellite.imageUrl} alt="Latest NOAA GOES East day/night cloud product centered on the NWS Jackson, Kentucky forecast area" width={600} height={600} sizes="(max-width: 760px) 92vw, 42vw" unoptimized /></div>
            <p className="card-note">Low, mid and high clouds receive different optical penalties. GOES gains weight only inside the 0–3 hour nowcast; model disagreement reduces forecast confidence.</p>
            <SourceStamp source={result.satellite.source} />
          </>}
        </section>

        <section className="data-card" aria-labelledby="falls-title"><div className="card-title"><RiverIcon /><div><p className="kicker">USGS 03404500</p><h2 id="falls-title">River + mist</h2></div></div>
          <p className={`mist-label mist-label--${result.hydro.mistLabel.toLowerCase().replace(" ", "-")}`}>{result.hydro.mistLabel}</p>
          <div className="metric-row"><div><span>Discharge</span><strong>{numeric(result.hydro.dischargeCfs, " CFS")}</strong></div><div><span>Seasonal percentile</span><strong>{result.hydro.percentile === null ? "—" : `${Math.round(result.hydro.percentile)}th`}</strong></div><div><span>6-hour trend</span><strong>{result.hydro.trend}</strong></div></div>
          <p className="card-note">Flow drives a saturating mist-production proxy. Exceptional flood flow receives a small conservative overspray penalty rather than assuming more water is always better. Wind direction separately estimates whether spray stays in the useful viewing zone.</p>
          <SourceStamp source={result.hydro.source} />
        </section>

        <section className="data-card" aria-labelledby="why-title"><div className="card-title"><ArrowIcon /><div><p className="kicker">Conjunctive model</p><h2 id="why-title">Why tonight</h2></div></div>
          <ul className="factor-list">
            {Object.entries(peakPoint?.factors ?? {}).map(([label, value]) => <li key={label}><span>{factorLabel(label)}</span><div><i style={{ width: `${Math.round(value * 100)}%` }} /></div><strong>{Math.round(value * 100)}</strong></li>)}
          </ul>
          <p className="card-note">Factors multiply. Impossible geometry is a hard gate; cloud transmission, mist production and mist placement cannot be averaged away by strong unrelated conditions.</p>
        </section>

        <section className="data-card" aria-labelledby="location-title"><div className="card-title"><PinIcon /><div><p className="kicker">Primary viewpoint</p><h2 id="location-title">Falls Overlook</h2></div></div>
          <p>{result.viewpoint.guidance}</p><p className="card-note">{result.viewpoint.accessibility}</p>
          <a className="text-link" href={result.viewpoint.mapUrl} target="_blank" rel="noreferrer">Open driving directions <ArrowIcon /></a>
          <small>{result.viewpoint.coordinateNote}</small>
        </section>

        <section className="data-card" aria-labelledby="confidence-title"><div className="card-title"><span className="confidence-number">{result.confidence.score}</span><div><p className="kicker">{result.confidence.mode}</p><h2 id="confidence-title">Forecast confidence</h2></div></div>
          <ul className="plain-list">{result.confidence.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {result.confidence.missing.length ? <p className="missing-data">Missing or inapplicable now: {result.confidence.missing.join(", ")}.</p> : null}
          {observation ? <SourceStamp source={observation.source} /> : null}
        </section>
      </div>

      <section className="next-windows" aria-labelledby="next-title"><div className="section-heading"><div><p className="kicker">Official planning envelope</p><h2 id="next-title">Next moonbow windows</h2></div><Link href="/cumberland-falls-moonbow/2026">Full 2026 calendar <ArrowIcon /></Link></div>
        {nextWindows.length ? <div className="window-list">{nextWindows.map((window) => <Link key={window.date} href={`/cumberland-falls-moonbow?date=${window.date}`}><time dateTime={window.date}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${window.date}T12:00:00Z`))}</time><span>{window.startLocal}–{window.endLocal}</span><ArrowIcon /></Link>)}</div> : <p>Official 2026 dates have ended. Deterministic lunar planning remains available by selecting a future date above.</p>}
      </section>

      <FeedbackForm targetDate={result.targetDate} enabled={databaseConfigured()} />

      <section className="notices" aria-label="Model notices">{result.notices.map((notice) => <p key={notice}>{notice}</p>)}</section>
    </div>
  </>;
}
