# Calibration Data

Generated from 3-day export (12-14 July 2026 IST), 1-minute cadence.

## Files
- `hourly_<asset_type>.json` - Hourly mean/p5/p95 per asset type and field
- `dropped_poll_rate.json` - Dropped poll statistics
- `chiller_part_load.json` - Chiller part-load curve points (PLR vs ikW/TR)
- `tower_approach_wetbulb.json` - Cooling tower approach vs wet-bulb temperature
- `fault_distribution.json` - Fault distribution statistics

## Total Floor kW Includes Plant Power

**Answer: True** (confidence: high)

### Reasoning
Sum of lead chiller (32.6 kW) + lag chiller (8.9 kW) + condenser/tower/aux ≈ 45-50 kW. Total floor kW mean is 51.8 kW. If this excluded plant, floor-only would be only ~2-6 kW, which is implausible for a hospital with 152 FCUs, 44 AHUs, lighting, medical equipment. The dashboard virtual assets (1Fkw...11Fkw) likely include their share of plant allocation, or the 'total floor kW' is a facility total meter.

### Plant kW Breakdown
{
  "lead_chiller_mean": 32.6,
  "lag_chiller_mean": 8.9,
  "condenser_pumps_estimate": 3.5,
  "cooling_towers_estimate": 2.0,
  "chilled_water_pumps_estimate": 4.0,
  "total_plant_estimate": 51.0
}

### Note
Per PLAN.md §3.2, write this answer in data/calibration/README.md

## Acceptance Targets (from PLAN.md §3.2)
- Mean total floor kW by hour: matches profile in §3.2
- Chiller sequencing: lead alone 72.6%, lead+lag 27.2%, neither 0.2%
- Lead chiller: leaving water 7.93°C, ΔT 3.06°C, 67.1 TR, 0.47 ikW/TR
- Cooling tower: approach 1.00°C, range 3.22°C
- Critical AHU: valve ≥90% for 86% of time, RH >60% for 99.8%
- Cadence: ~4311 of 4320 timestamps per entity (99.79%)
- Dropped polls: ≈0.2%
- Late data: is_delayed on 0.181% of device rows

## Physics Sanity (from PLAN.md §3.2)
Thermal power (kW) = 1.163 x flow (m3/h) x DeltaT (K)
1 TR = 3.517 kW
Electrical kW = TR x ikW/TR

For lead chiller means: 67.1 TR ~ 236 kW thermal ~ 66 m3/h at DeltaT 3.06 K
67.1 x 0.47 ~ 31.5 kW electrical vs 32.6 kW measured

The engine must keep flow, DeltaT, TR and kW mutually consistent within a few percent.
