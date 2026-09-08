import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Moonbow Photography Guide", description: "A compact Cumberland Falls moonbow photography setup guide: tripod, exposure, focus, lens, etiquette and weather protection.", alternates: { canonical: "/cumberland-falls-moonbow/photography" } };

export default function Photography() { return <main className="content-page shell" id="main"><p className="content-page__eyebrow">Secondary mode</p><h1>Moonbow photography</h1><p className="lede">Your eyes may see a pale white arc; a long exposure can reveal color. Keep the decision tool primary: no camera setting can compensate for a cloud-blocked Moon or failed geometry.</p>
  <h2>A reliable starting setup</h2><ul><li>Tripod, RAW capture and a clean wide-angle lens.</li><li>Manual focus on the illuminated falls or a distant light, then verify at high magnification.</li><li>Start near f/2.8–f/4, ISO 800–1600 and 10–25 seconds; bracket rather than trusting one recipe.</li><li>Shield the lens from spray and carry a dry microfiber cloth.</li></ul>
  <h2>At the overlook</h2><p>Arrive early, keep headlamps red and dim, avoid sweeping other visitors with white light, and do not climb barriers. Spray makes decks and steps slick after dark.</p>
  <p className="callout"><Link href="/cumberland-falls-moonbow">Check the live viewing window first</Link>, then plan your exposure around the peak period.</p></main>; }
