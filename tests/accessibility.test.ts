import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

it("critical text tokens meet WCAG AA contrast against the decision panel", () => {
  for (const color of ["#ecf3ef", "#a9b8b4", "#83c7c0", "#e9b86a", "#f08f75", "#8fd2a8", "#79918c"]) {
    expect(contrast(color, "#0d1c1e")).toBeGreaterThanOrEqual(4.5);
  }
});

it("interactive controls expose labels and comfortable touch heights", () => {
  const controls = readFileSync("components/decision-controls.tsx", "utf8");
  const timeline = readFileSync("components/timeline-chart.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  expect(controls.match(/<label>/g)).toHaveLength(2);
  expect(timeline).toContain('aria-label="Select a time on the Moonbow Score timeline"');
  expect(css).toMatch(/\.decision-controls input, \.decision-controls select \{[^}]*min-height: 44px/s);
  expect(css).toMatch(/\.feedback-actions button \{[^}]*min-height: 46px/s);
});
