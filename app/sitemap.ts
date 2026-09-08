import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

const routes = [
  "/cumberland-falls-moonbow",
  "/cumberland-falls-moonbow/2026",
  "/cumberland-falls-moonbow/september-2026",
  "/cumberland-falls-moonbow/best-time",
  "/cumberland-falls-moonbow/photography",
  "/cumberland-falls-moonbow/methodology",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path, index) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date("2026-09-08"),
    changeFrequency: index ? "monthly" : "hourly",
    priority: index ? 0.7 : 1,
  }));
}
