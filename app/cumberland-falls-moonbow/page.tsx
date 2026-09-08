import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { DecisionControls } from "@/components/decision-controls";
import { DecisionHero } from "@/components/decision-hero";
import { getLiveDecision } from "@/lib/engine";
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
    "@context": "https://schema.org", "@type": "WebApplication", name: "Cumberland Falls Moonbow Window", applicationCategory: "TravelApplication", operatingSystem: "Any", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://moonbow-window.vercel.app"}/cumberland-falls-moonbow`, description: "Live decision support for Cumberland Falls moonbow viewing.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, about: { "@type": "TouristAttraction", name: "Cumberland Falls State Resort Park", geo: { "@type": "GeoCoordinates", latitude: result.viewpoint.latitude, longitude: result.viewpoint.longitude } }, dateModified: result.generatedAt,
  };
  return <main id="main"><DecisionHero result={result} /><div className="controls-wrap shell"><DecisionControls date={date} drive={drive} /></div><Dashboard result={result} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }} /></main>;
}
