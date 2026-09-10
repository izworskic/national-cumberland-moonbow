import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { DecisionControls } from "@/components/decision-controls";
import { DecisionHero } from "@/components/decision-hero";
import { MoonbowGeometryVisual } from "@/components/geometry-visual";
import { getLiveDecision } from "@/lib/engine";
import { SITE_URL } from "@/lib/site-url";
import { parseTargetDate } from "@/lib/time";
import type { DriveCommitment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const drives = new Set<DriveCommitment>(["local", "30m", "1h", "2h", "3h"]);

export const metadata: Metadata = { alternates: { canonical: "/cumberland-falls-moonbow" } };

export default async function MoonbowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const date = parseTargetDate(typeof params.date === "string" ? params.date : null);
  const rawDrive = typeof params.drive === "string" ? params.drive as DriveCommitment : "local";
  const drive = drives.has(rawDrive) ? rawDrive : "local";
  const result = await getLiveDecision(date, drive);
  const schema = {
    "@context": "https://schema.org", "@type": "WebApplication", name: "Cumberland Falls Moonbow Live", applicationCategory: "TravelApplication", operatingSystem: "Any", url: `${SITE_URL}/cumberland-falls-moonbow`, description: "Live decision support for Cumberland Falls moonbow viewing, including estimated chance, best window, Moon geometry, weather-model consensus and river mist conditions.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, about: { "@type": "TouristAttraction", name: "Cumberland Falls State Resort Park", geo: { "@type": "GeoCoordinates", latitude: result.viewpoint.latitude, longitude: result.viewpoint.longitude } }, dateModified: result.generatedAt,
  };
  return <main id="main"><DecisionHero result={result} /><div className="controls-wrap shell"><DecisionControls date={date} drive={drive} /></div><div className="shell"><MoonbowGeometryVisual points={result.timeline} peakTimestamp={result.bestWindow?.peak ?? null} /></div><Dashboard result={result} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }} /></main>;
}
