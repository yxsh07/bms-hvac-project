# Calibration

`profile.json` is a **synthetic** calibration profile derived from the acceptance
targets in PLAN §3.2. It contains no client identifiers and no raw rows, and is
safe to commit.

It exists so SimSite, the quality layer and the API can be built and tested
before `data/raw/` is provided. When the real export is available, `tools/calibrate.py`
regenerates the numbers (T-011 / gate G1) and the acceptance tests in
`apps/sim/tests/` are re-run against them.

## Open question from §3.1

> Does the "total floor kW" series include plant (chiller) power?

**Status: unresolved (blocked on data/raw, gate G1).** The synthetic profile
currently treats floor kW as **excluding** the central plant, so the simulator
sums floor load and plant power as separate terms. `tools/calibrate.py` must
compare the two series and record the real answer here before the sim is pointed
at the client data. This is flagged as an assumption, not a finding.
