# Validation evidence

## Deterministic fixtures

`npm test` covers the 13 model/failure scenarios in the product specification, multiplicative collapse, complete source stamps, direct JPL comparison, and WCAG contrast/touch invariants. Scenario 14 is the 390px production-browser gate.

## Astronomy

`npm run validate:astronomy` checks every official Kentucky State Parks 2026 window and five direct NASA/JPL Horizons samples spread across January, March, June, September, and December.

- Official overlap: 65/65 windows.
- Modeled start within one hour of the official planning envelope: 62/65 windows.
- Maximum direct JPL azimuth difference: less than 0.01°.
- Maximum apparent-altitude difference: less than 0.06°.
- Maximum illuminated-fraction difference: less than 0.0011.

The official calendar is an approximate public viewing envelope, not a labeled visibility dataset. It validates schedule alignment, not weather outcomes.

## Historical inputs

- Flow: 7,832 approved daily means for USGS 03404500, 1991–2025, summarized by day-of-year ±7 days.
- Clouds: 43,503 local-standard-time nighttime observations at London-Corbin Airport, 2015–2024, summarized by month. Sky transmission uses the same nonlinear transmission transform as the live engine.

## Release interpretation

The model is intentionally conservative against false GO. The calibration feedback table begins all anonymous reports as `unverified` with weight 0.25, rate limits six reports per rotating reporter hash per hour, and stores the exact modeled state with each report. No visitor report alone is ground truth.
