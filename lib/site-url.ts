export const DEFAULT_SITE_URL = "https://moonbow-window.vercel.app";

export interface SiteUrlEnvironment {
  publicUrl?: string | null;
  productionUrl?: string | null;
  deploymentUrl?: string | null;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const scheme = raw.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
    if (scheme && scheme !== "https" && scheme !== "http") return null;

    const url = new URL(scheme ? raw : `https://${raw}`);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveSiteUrl(environment: SiteUrlEnvironment = {}): string {
  const candidates = [environment.publicUrl, environment.productionUrl, environment.deploymentUrl];

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }

  return DEFAULT_SITE_URL;
}

export const SITE_URL = resolveSiteUrl({
  publicUrl: process.env.NEXT_PUBLIC_SITE_URL,
  productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  deploymentUrl: process.env.VERCEL_URL,
});
