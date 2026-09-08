import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer"><div className="shell site-footer__grid">
    <div><strong>Cumberland Falls Moonbow Window</strong><p>A conservative decision tool built from public observations and local physical modeling. Not affiliated with Kentucky State Parks.</p></div>
    <div><span>Plan</span><Link href="/cumberland-falls-moonbow/2026">2026 windows</Link><Link href="/cumberland-falls-moonbow/best-time">Best time</Link><Link href="/cumberland-falls-moonbow/photography">Photography</Link></div>
    <div><span>Transparency</span><Link href="/cumberland-falls-moonbow/methodology">Methodology</Link><Link href="/diagnostics">System health</Link><a href="https://parks.ky.gov/explore/cumberland-falls-state-resort-park-7786">Official park page</a></div>
  </div><div className="shell site-footer__bottom"><span>Moonbow Score is not a probability.</span><span>© {new Date().getUTCFullYear()} Chris Izworski</span></div></footer>;
}
