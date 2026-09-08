import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ADSENSE_ACCOUNT, GA_MEASUREMENT_ID } from "@/lib/config";
import { SITE_URL } from "@/lib/site-url";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Cumberland Falls Moonbow Tonight | Live Decision", template: "%s | Cumberland Falls Moonbow" },
  description: "A live, five-minute decision engine for Cumberland Falls moonbow viewing: score, best time, arrival, clouds, river flow, confidence and viewing location.",
  applicationName: "Cumberland Falls Moonbow Window",
  alternates: { canonical: "/cumberland-falls-moonbow" },
  openGraph: { type: "website", siteName: "Cumberland Falls Moonbow Window", title: "Should you go see the Cumberland Falls moonbow tonight?", description: "A live decision, best viewing window and confidence—built from Moon geometry, NWS clouds, NOAA satellite and USGS river flow.", images: [{ url: "/images/cumberland-falls-moonbow.jpg", width: 1200, height: 444, alt: "Moonbow at Cumberland Falls" }] },
  twitter: { card: "summary_large_image", title: "Cumberland Falls Moonbow Tonight", description: "Live Moonbow Score, best time, arrival and forecast confidence.", images: ["/images/cumberland-falls-moonbow.jpg"] },
  other: { "google-adsense-account": ADSENSE_ACCOUNT },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#071315", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <a className="skip-link" href="#main">Skip to decision</a>
    <SiteHeader />{children}<SiteFooter />
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
    <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true});`}</Script>
    <Analytics /><SpeedInsights />
  </body></html>;
}
