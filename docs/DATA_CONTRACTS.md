# Data contracts

All adapters return typed data plus a `SourceStamp`: source URL, observation or forecast timestamp, age, freshness, and a human-readable detail. Missing values are `null`; adapters never invent zeroes.

| Dependency | Production contract | Cache | Independent fallback |
|---|---|---:|---|
| Astronomy | Local apparent Moon/Sun positions, illumination, rise/set and twilight | deterministic | Invalid calculations hard-gate the interval |
| Terrain | Cached USGS 3DEP azimuth profile + separate tree correction | release-pinned | Cached profile is the fallback by design |
| USGS | Modern OGC `latest-continuous` and six-hour `continuous` collections, station `USGS-03404500`, parameters `00060`/`00065` | 5 min | Recent last success is marked stale; otherwise current flow is null |
| NWS | Grid `JKL/28,14`, station observation, and active point alerts | 2–15 min | Astronomy remains; weather confidence falls |
| GOES-19 | ABI L2 ACMC files from NOAA public object storage, quality-filtered 7×7 pixel sample | 5 min | NWS forecast remains; nowcast confidence falls |
| Long-range clouds | NOAA NCEI LCD station `72424303849`, 43,503 nighttime FM-15 reports from 2015–2024 | release-pinned | Explicit neutral planning context, never a forecast |
| Long-range flow | 7,832 approved USGS daily means from 1991–2025; ±7 day seasonal window | release-pinned | No current-flow claim |

Freshness thresholds are centralized in `lib/config.ts`. A Vercel cron warms tonight and tomorrow every five minutes; page requests still tolerate a cold cache.

## Failure rules

- No adapter can crash the primary experience.
- Stale data retain their timestamp and are labeled stale.
- A deterministic astronomy NO-GO skips irrelevant live calls and explains why live data were not needed.
- Beyond seven days, NWS and GOES are marked not live; the engine uses only deterministic geometry and sourced historical distributions.
