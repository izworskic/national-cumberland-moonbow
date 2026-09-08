import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, resolveSiteUrl } from "@/lib/site-url";

describe("site URL resolution", () => {
  it("prefers a valid configured public URL and reduces it to an origin", () => {
    expect(resolveSiteUrl({ publicUrl: "https://moonbow.example/path/" })).toBe("https://moonbow.example");
  });

  it("uses Vercel's production hostname when the public value is empty", () => {
    expect(resolveSiteUrl({ publicUrl: "  ", productionUrl: "moonbow.vercel.app" })).toBe(
      "https://moonbow.vercel.app",
    );
  });

  it("uses the deployment hostname when earlier candidates are malformed", () => {
    expect(
      resolveSiteUrl({
        publicUrl: "not a valid url",
        productionUrl: "javascript:alert(1)",
        deploymentUrl: "moonbow-preview.vercel.app",
      }),
    ).toBe("https://moonbow-preview.vercel.app");
  });

  it("falls back to a safe absolute URL instead of throwing", () => {
    expect(resolveSiteUrl({ publicUrl: "://", productionUrl: "ftp://example.com" })).toBe(DEFAULT_SITE_URL);
    expect(() => new URL(resolveSiteUrl({ publicUrl: "%%%" }))).not.toThrow();
  });
});
