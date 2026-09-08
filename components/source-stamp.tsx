import type { SourceStamp as Stamp } from "@/lib/types";

function stateLabel(source: Stamp): string {
  if (source.freshness === "not-applicable") return "not live";
  if (source.freshness === "unavailable") return "unavailable";
  if (source.ageMinutes === null) return source.freshness;
  if (source.ageMinutes < 1) return "updated now";
  return `updated ${source.ageMinutes} min ago`;
}

export function SourceStamp({ source, compact = false }: { source: Stamp; compact?: boolean }) {
  return <div className={`source-stamp ${compact ? "source-stamp--compact" : ""}`}>
    <span className={`fresh-dot fresh-dot--${source.freshness}`} aria-hidden="true" />
    <span><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>{!compact && source.detail ? <small>{source.detail}</small> : null}</span>
    <strong>{stateLabel(source)}</strong>
  </div>;
}
