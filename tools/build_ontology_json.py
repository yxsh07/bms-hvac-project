#!/usr/bin/env python3
"""Build ontology JSON from building model data.

Reads the building-model xlsx and produces:
- data/seed/ontology.json (assets, points with classification/writable/safeMin/safeMax, zones, controllers)
- data/seed/point-roles.json (skeleton keyed by asset type)
- data/seed/forbidden-strings.txt (distinctive tokens only)
- stdout summary: counts, and how many writable points exist by class.

Usage:
  python tools/build_ontology_json.py --anonymise

The --anonymise flag strips client-specific identifiers from output.
"""

import argparse
import json
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="Build ontology JSON from building model data")
    parser.add_argument("--anonymise", action="store_true", help="Strip client-specific identifiers")
    args = parser.parse_args()
    
    # Placeholder: read from real data and produce ontology
    # In Phase 1, this runs on the client's actual data
    # For now, emit a minimal scaffold
    
    ontology = {
        "version": 1,
        "assets": [],
        "zones": [],
        "controllers": [],
        "point_definitions": []
    }
    
    roles = {}
    
    forbidden = set()
    
    # Emit fixture data
    os.makedirs("data/seed", exist_ok=True)
    
    with open("data/seed/ontology.json", "w") as f:
        json.dump(ontology, f, indent=2)
    
    with open("data/seed/point-roles.json", "w") as f:
        json.dump(roles, f, indent=2)
    
    with open("data/seed/forbidden-strings.txt", "w") as f:
        f.write("# Forbidden strings - curated by T-010\n")
        f.write("# These are client-specific identifiers that must not appear outside data/\n")
        f.write("kmssh\n")
        f.write("Manavata\n")
        f.write("KIMS\n")
        f.write("JouleLogger\n")
    
    print("Emitted minimal ontology fixture")
    print("Counts: 0 assets, 0 points, 0 writable points by class")

if __name__ == "__main__":
    main()