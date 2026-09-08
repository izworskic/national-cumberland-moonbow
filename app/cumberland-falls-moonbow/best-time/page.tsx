import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Best Time to See the Moonbow", description: "How to choose the best Cumberland Falls moonbow time using darkness, effective moonrise, cloud cover, mist and a sustained viewing window.", alternates: { canonical: "/cumberland-falls-moonbow/best-time" } };

export default function BestTime() { return <main className="content-page shell" id="main"><p className="content-page__eyebrow">Practical viewing guide</p><h1>Best time to see the moonbow</h1><p className="lede">The best time is not simply “at full moon” or “between moonrise and moonset.” It begins when direct moonlight clears the gorge and tree line, the sky is dark, and the 42° primary bow intersects the visible mist.</p>
  <h2>Use the sustained window</h2><p>The live tool evaluates every five minutes and reports the strongest contiguous period. A brief cloud hole can score well for one sample, but it cannot create a long-distance GO unless at least 35 minutes remain viable.</p>
  <h2>Arrive before it begins</h2><p>The arrival recommendation is 25 minutes before the computed start. That leaves time to park at the Visitor Center area, follow signed paths in the dark, and settle at the Falls Overlook without using a bright light near other viewers.</p>
  <h2>The five checks that matter</h2><ol><li>Near-full lunar illumination.</li><li>The Moon above the effective local skyline but below 42° altitude.</li><li>Direct, mostly unobstructed moonlight over the mist.</li><li>Enough river flow to sustain spray.</li><li>No fog, poor visibility or dangerous weather.</li></ol>
  <p className="callout"><Link href="/cumberland-falls-moonbow">Check tonight’s score and exact window</Link>. The score is an opportunity index, not a calibrated probability.</p></main>; }
