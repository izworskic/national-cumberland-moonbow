# Release runbook

1. Run `npm run verify`, `npm run validate:astronomy`, and the browser suite.
2. Deploy the exact committed source to Vercel.
3. Configure `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, and `FEEDBACK_HASH_SECRET` without exposing secrets to the client.
4. Verify `/api/health` and `/api/health?deep=1`; inspect each source timestamp/freshness state.
5. Verify the canonical page and `/api/moonbow` on a 390×844 browser, including first viewport, controls, timeline and horizontal overflow.
6. Record warm-cache LCP/CLS and an actual interaction duration; run accessibility checks.
7. Submit a synthetic feedback report, verify one unverified row, then remove or mark that release-check row outside the public workflow.
8. Save only measured results in `docs/evidence/production.json` and run `npm run benchmark`.
9. Release only when critical tests pass, BENCHMARK ≥93, VALUE ≥93, and no hard veto is present.

## Incident behavior

- Satellite failure: NWS remains, NOWCAST confidence falls.
- USGS failure: a recent cached reading may be marked stale; otherwise current flow is absent.
- NWS failure: astronomy remains, weather confidence falls, and no weather is fabricated.
- Terrain service failure: irrelevant at runtime because the validated profile is bundled.
- Database failure: the decision remains available; feedback reports fail transparently.

Structured JSON logs record adapter latency, failures, decisions, confidence, hard gates and source states. `/diagnostics` is the human view; `/api/health?deep=1` is the machine view.
