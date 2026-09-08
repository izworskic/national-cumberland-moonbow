# Scientific model

## Five-minute opportunity score

After hard gates, each normalized factor is combined multiplicatively:

\[
S = 100L^{0.20}G^{0.25}C^{0.25}M^{0.15}A^{0.08}W^{0.07}
\]

The score is an opportunity index, not a probability. A 35-minute rolling mean supplies the headline score, so a short cloud break cannot create a GO.

| Factor | V1 meaning |
|---|---|
| `L` | Lunar illumination above the validated planning envelope |
| `G` | Distance between the 42° primary-bow cone around the anti-lunar point and the sampled visible mist field |
| `C` | Moonlight transmission from NWS clouds, with observation and GOES weighting inside three hours |
| `M` | Monotonic, saturating mist-production proxy from discharge; no narrow “ideal CFS” is claimed |
| `A` | Visibility/fog clarity; relative humidity is not rewarded |
| `W` | Small wind/plume penalty pending gorge-specific outcomes |

## Hard gates

An interval scores zero when astronomy is invalid, the Moon is below the effective skyline, the Moon exceeds 42° altitude, the Sun is above nautical twilight, illumination falls outside the Kentucky Parks planning envelope, the 42° bow misses the visible mist field, clouds block direct moonlight, or a dangerous NWS warning is active.

The 0.88 illumination threshold is an initial, conservative schedule-envelope value: it retains all 65 official 2026 windows. It is configurable and is not presented as a universal physical constant.

## Viewpoint and skyline

V1 models the Falls Overlook at `36.83885, -84.34435`, looking approximately 256.5° toward the falls/mist target. The bare-earth horizon is a release-pinned USGS 3DEP profile. Tree corrections are stored separately and only raise the skyline, making the decision conservative. One scientific-integrity benchmark point is deliberately withheld until a multi-season set of observed Moon-clearance times can replace the conservative tree envelope.

## Cloud nowcast

Within three hours, the fused cloud fraction weights NWS forecast 0.35, nearby surface sky layers 0.15, and GOES-19 ACMC 0.50, renormalizing when a signal is absent. A clouding/clearing trend makes a small directional adjustment. The cloud factor is applied once, avoiding duplicate penalties from correlated meteorological inputs.

## Confidence and driving distance

Confidence is separate from opportunity and transitions through NOWCAST, HIGH-CONFIDENCE FORECAST, FORECAST, PLANNING FORECAST, and CLIMATOLOGY / PLANNING. Drive time changes only the recommendation threshold; it never changes the Moonbow Score.

Probability language remains disabled until a time-separated outcome dataset beats the three documented baselines and achieves Brier ≤0.18 and expected calibration error ≤0.10, including reliable calibration in the GO region.
