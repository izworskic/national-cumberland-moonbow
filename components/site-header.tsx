import Link from "next/link";
import { MoonIcon } from "./icons";

export function SiteHeader() {
  return <header className="site-header"><div className="shell site-header__inner">
    <Link href="/cumberland-falls-moonbow" className="brand"><MoonIcon /><span>Cumberland Falls <strong>Moonbow</strong></span></Link>
    <nav aria-label="Primary navigation"><Link href="/cumberland-falls-moonbow/2026">2026 windows</Link><Link href="/cumberland-falls-moonbow/best-time">Best time</Link><Link href="/cumberland-falls-moonbow/photography">Photography</Link></nav>
  </div></header>;
}
