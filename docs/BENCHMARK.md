# Release benchmark

The executable source of truth is `npm run benchmark`. It checks implementation artifacts, recalculates the astronomy comparisons, and consumes the production evidence record only after live verification.

| Category | Max | Evidence required for full credit |
|---|---:|---|
| Decision usefulness | 25 | All required fixtures plus 390px first-viewport proof |
| Scientific / physical integrity | 20 | Multiplicative model, JPL, 3DEP, flow/cloud histories; V1 caps at 19 pending observed tree-line calibration |
| Window accuracy | 15 | 65/65 official overlap, ≥95% starts within one hour, five-minute resolution, sustained-window rule |
| Live-data integration | 10 | Isolated adapters plus verified production sources |
| Uncertainty / calibration | 10 | Score/confidence separation and no probability claim |
| Resilience | 5 | Independent dependency and stale-data fixtures |
| Mobile UX | 5 | Mobile-first implementation and live 390px proof |
| Performance / accessibility | 5 | LCP <2.5s, CLS <0.10, synthetic interaction <200ms, zero critical accessibility findings |
| Search / discovery | 3 | Canonical tool, computed support routes, sitemap, structured data |
| Learning / observability | 2 | Health/logging plus verified outcome persistence |

The benchmark cannot award production-only points without `docs/evidence/production.json`. Both BENCHMARK and weighted VALUE must reach 93 before release.
