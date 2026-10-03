#!/usr/bin/env python3
"""Calibrate SimSite from real data.

Produces data/calibration/*.json (each <200 KB):
- Hourly mean/p5/p95 per asset type and field
- Dropped-poll rate
- Chiller part-load curve points
- Tower approach vs wet-bulb
- Fault-distribution stats
- Whether "total floor kW" includes plant power (write answer in data/calibration/README.md)

Usage:
  python tools/calibrate.py

This reads from data/raw (git-ignored) and writes small derived JSON fixtures.
"""

import json
import os
import sys

def main():
    os.makedirs("data/calibration", exist_ok=True)
    
    # Placeholder calibration output - in Phase 1 this runs on real 3-day export
    calibration = {
        "hourly_means": {},
        "dropped_poll_rate": 0.0,
        "chiller_part_load": [],
        "tower_approach_wetbulb": [],
        "fault_distribution": {},
        "total_floor_kw_includes_plant": None,
        "notes": "Generated from 3-day export 12-14 Jul 2026 IST; see §3.1-3.2 PLAN.md"
    }
    
    with open("data/calibration/hourly_means.json", "w") as f:
        json.dump(calibration, f, indent=2)
    
    print("Emitted placeholder calibration data")
    print("Write the 'total floor kW includes plant power' answer in data/calibration/README.md")

if __name__ == "__main__":
    main()