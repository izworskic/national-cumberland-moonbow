import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PLANNING_URL = "/cumberland-falls-moonbow?date=2030-09-11";

test("14. mobile first viewport contains the complete decision without horizontal scroll", async ({ page }) => {
  await page.goto(PLANNING_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator(".decision-state")).toBeVisible();
  await expect(page.getByText("Estimated Moonbow Chance", { exact: true })).toBeVisible();
  await expect(page.getByText("Best window", { exact: true })).toBeVisible();
  await expect(page.getByText("Arrive by", { exact: true })).toBeVisible();
  await expect(page.getByText("Forecast confidence", { exact: true }).first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, decisionBottom: document.querySelector(".decision-card")?.getBoundingClientRect().bottom ?? 9999, viewportHeight: window.innerHeight }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  if (dimensions.clientWidth <= 420) {
    expect(dimensions.decisionBottom).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
  }
});

test("timeline has an accessible description and touch control", async ({ page }) => {
  await page.goto(PLANNING_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("svg.timeline-chart")).toHaveAttribute("aria-label", /Moonbow Score/);
  await expect(page.getByRole("slider", { name: /select a time/i })).toBeVisible();
});

test("WCAG A/AA automated scan has no violations", async ({ page }) => {
  await page.goto(PLANNING_URL, { waitUntil: "networkidle", timeout: 60_000 });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});
