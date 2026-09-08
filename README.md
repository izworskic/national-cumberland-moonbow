# Cumberland Falls Moonbow Window

A mobile-first decision engine for one question: should someone go to Cumberland Falls tonight, when should they arrive, and what could prevent a moonbow?

The product publishes a **Moonbow Score**, never an uncalibrated probability. It evaluates five-minute intervals with local astronomy and skyline geometry, USGS flow, NWS forecast/observations, and a GOES-19 cloud nowcast. Confidence is computed independently from opportunity.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/cumberland-falls-moonbow`.

## Release gates

```bash
npm run verify
npm run validate:astronomy
npm run benchmark
npm run test:e2e
```

`npm run benchmark` exits non-zero unless both the 100-point benchmark and weighted VALUE score are at least 93. Production browser/performance evidence is stored in `docs/evidence/production.json` only after the live deployment is verified.

## Runtime configuration

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | For feedback | Postgres connection for observation outcomes |
| `FEEDBACK_HASH_SECRET` | For feedback | Rotating HMAC abuse-control hash; at least 32 random characters |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical production origin |
| `CRON_SECRET` | Managed by Vercel | Optional Vercel cron authentication |

Without database variables the core decision remains available and the feedback control is explicitly disabled. No observation is fabricated.

## Sources

- [Kentucky State Parks](https://parks.ky.gov/explore/cumberland-falls-state-resort-park-7786) and its 2026 viewing calendar
- [USGS Water Data APIs](https://api.waterdata.usgs.gov/ogcapi/v0/openapi) for station 03404500
- [National Weather Service API](https://www.weather.gov/documentation/services-web-api)
- [NOAA GOES-R Clear Sky Mask](https://www.star.nesdis.noaa.gov/goesr/product_land_cloud.php)
- [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program)
- [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)

See [scientific model](docs/SCIENTIFIC_MODEL.md), [data contracts](docs/DATA_CONTRACTS.md), [validation](docs/VALIDATION.md), and [release runbook](docs/RELEASE.md).

## License and media

Source code is MIT licensed. The hero photograph is “Cumberland Falls Moonbow panarama” by Design219, licensed CC BY-SA 4.0 and credited in [third-party notices](THIRD_PARTY_NOTICES.md). Government data remain subject to their source terms.
