import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Chris Izworski network analytics contract", () => {
  it("installs the shared GA4 measurement ID in the root layout", async () => {
    const [config, layout] = await Promise.all([
      readFile("lib/config.ts", "utf8"),
      readFile("app/layout.tsx", "utf8"),
    ]);

    expect(config).toContain('GA_MEASUREMENT_ID = "G-Y5D2V2W7HN"');
    expect(layout).toContain("www.googletagmanager.com/gtag/js");
    expect(layout).toContain("GA_MEASUREMENT_ID");
    expect(layout).toContain("anonymize_ip:true");
  });
});
