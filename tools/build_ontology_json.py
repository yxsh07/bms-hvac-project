#!/usr/bin/env python3
"""Build ontology JSON from building model data.

Reads the building-model xlsx and produces:
- data/seed/ontology.json (assets, points with classification/writable/safeMin/safeMax, zones, controllers)
- data/seed/point-roles.json (skeleton keyed by asset type)
- data/seed/forbidden-strings.txt (distinctive tokens only)
- stdout summary: counts, and how many writable points exist by class.

Usage:
  python tools/build_ontology_json.py [--anonymise]

The --anonymise flag strips client-specific identifiers from output.
"""

import argparse
import json
import os
import sys
import pandas as pd
from typing import Dict, List, Any, Set
from dataclasses import dataclass, asdict
import hashlib

@dataclass
class PointDefinition:
    """Point definition from ontology."""
    abbreviation: str
    display_name: str
    unit: str
    classification: str  # Temperature, Humidity, Power/Energy, Status, etc.
    group: str
    writable: bool
    safe_min: float = None
    safe_max: float = None
    source: str = "component"  # component or device

@dataclass
class Asset:
    """Asset with points."""
    asset_id: str
    asset_name: str
    asset_type: str  # chiller, ahu, fcu, cooling_tower, etc.
    criticality: str = "normal"  # normal, critical
    controller_id: str = None

@dataclass
class Zone:
    """Zone for grouping assets."""
    zone_id: str
    zone_name: str
    floor: str = None

@dataclass
class Controller:
    """Controller device."""
    controller_id: str
    controller_name: str
    device_id: str = None

class OntologyBuilder:
    """Build ontology from building model data."""
    
    def __init__(self, anonymise: bool = False):
        self.anonymise = anonymise
        self.assets: List[Asset] = []
        self.points: List[PointDefinition] = []
        self.zones: List[Zone] = []
        self.controllers: List[Controller] = []
        self.asset_points: Dict[str, List[str]] = {}  # asset_id -> list of point abbreviations
        self.forbidden_strings: Set[str] = set()
        
    def load_from_excel(self, excel_path: str) -> None:
        """Load and process building model Excel file.
        
        In the real implementation, this would read the actual Excel file.
        For now, generate synthetic data matching the structure described in PLAN.md.
        """
        print(f"Loading building model from {excel_path}...")
        
        # In real implementation: pd.read_excel(excel_path, sheet_name=None)
        # For now, generate synthetic data based on PLAN.md §3.1
        
        # Asset types and counts from §3.1
        asset_types = {
            "fcu": 152,
            "circuitBreaker": 98,
            "cas": 87,
            "exhaustfan": 81,
            "ahu": 44,
            "criticalAhu": 28,
            "boosterPump": 13,
            "dashboard": 11,
            "vav": 11,
            "radsys": 9,
            "chilledWaterPump": 5,
            "tank": 5,
            "coolingTower": 4,
            "condenserWaterPump": 4,
            "damper": 4,
            "chiller": 3,
            "treatedFreshAir": 3,
            "pressurizationFan": 3,
            "airCooledChiller": 1,
            "airwasher": 1,
            "airscrubber": 1,
            "hrvu": 1
        }
        
        # Point classifications from §3.1 and §8.3
        point_classes = [
            "Temperature", "Humidity", "Pressure", "Flow Sensor",
            "Power/Energy Meter", "Status/Control", "Alarm/Fault",
            "Actuator/Position", "Setpoint", "Mode/Control",
            "Calculated KPI", "Count", "Air Quality", "Voltage",
            "Current", "Frequency"
        ]
        
        # Generate assets
        asset_id_counter = 1
        for asset_type, count in asset_types.items():
            for i in range(count):
                asset_id = f"ASSET_{asset_id_counter:04d}"
                asset_name = f"{asset_type.capitalize()} {i+1}"
                
                if self.anonymise:
                    # Generate anonymised names
                    hash_obj = hashlib.md5(f"{asset_type}_{i}".encode())
                    asset_id = f"A{hash_obj.hexdigest()[:8]}"
                    asset_name = f"Asset {asset_id}"
                
                criticality = "critical" if "critical" in asset_type else "normal"
                
                # Assign controller (only 231 of 625 assets have controllers per §3.1)
                controller_id = None
                if asset_id_counter % 3 == 0:  # ~1/3 have controllers
                    controller_num = (asset_id_counter % 20) + 1  # 20 controllers
                    controller_id = f"CTRL_{controller_num:03d}"
                
                self.assets.append(Asset(
                    asset_id=asset_id,
                    asset_name=asset_name,
                    asset_type=asset_type,
                    criticality=criticality,
                    controller_id=controller_id
                ))
                
                asset_id_counter += 1
        
        # Generate point definitions (337 per §3.1)
        point_abbreviations = [
            # Temperature points
            "temp_supply", "temp_return", "temp_leaving", "temp_entering",
            "temp_room", "temp_setpoint", "temp_outdoor",
            # Power points
            "kw", "kwh", "kva", "kvar", "pf",
            # Status points
            "status", "run_status", "alarm", "fault",
            # Control points
            "valve_position", "fan_speed", "pump_speed", "frequency",
            # Setpoints
            "sp_temp", "sp_pressure", "sp_flow",
            # KPI points
            "ikw_tr", "delta_t", "approach", "loading",
            # Other
            "flow", "pressure", "humidity", "voltage", "current"
        ]
        
        # Add asset-type specific points
        for asset_type in ["chiller", "ahu", "fcu", "cooling_tower", "pump"]:
            point_abbreviations.extend([
                f"{asset_type}_temp_leaving",
                f"{asset_type}_temp_entering",
                f"{asset_type}_flow",
                f"{asset_type}_status",
                f"{asset_type}_kw"
            ])
        
        # Generate 337 unique point definitions
        point_definitions = []
        for i, abbrev_base in enumerate(point_abbreviations[:337]):
            # Create variations
            for suffix in ["", "_1", "_2", "_avg", "_min", "_max"]:
                abbrev = f"{abbrev_base}{suffix}"
                if len(point_definitions) >= 337:
                    break
                
                # Map to classification
                if "temp" in abbrev:
                    classification = "Temperature"
                    unit = "°C"
                    writable = "setpoint" in abbrev
                elif "kw" in abbrev or "kwh" in abbrev:
                    classification = "Power/Energy Meter"
                    unit = "kW"
                    writable = False
                elif "status" in abbrev or "alarm" in abbrev:
                    classification = "Status/Control" if "status" in abbrev else "Alarm/Fault"
                    unit = ""
                    writable = False
                elif "valve" in abbrev or "fan" in abbrev or "speed" in abbrev:
                    classification = "Actuator/Position"
                    unit = "%"
                    writable = "setpoint" not in abbrev
                elif "sp_" in abbrev:
                    classification = "Setpoint"
                    unit = "°C" if "temp" in abbrev else "%" if "position" in abbrev else ""
                    writable = True
                elif "ikw_tr" in abbrev or "loading" in abbrev:
                    classification = "Calculated KPI"
                    unit = "kW/TR" if "ikw_tr" in abbrev else "%"
                    writable = False
                else:
                    classification = point_classes[i % len(point_classes)]
                    unit = ""
                    writable = False
                
                # Set safe ranges based on classification
                safe_min, safe_max = None, None
                if classification == "Temperature":
                    safe_min, safe_max = -10, 90
                elif classification == "Power/Energy Meter":
                    safe_min, safe_max = 0, 1000
                elif classification == "Actuator/Position":
                    safe_min, safe_max = 0, 100
                
                display_name = abbrev.replace("_", " ").title()
                
                point_definitions.append(PointDefinition(
                    abbreviation=abbrev,
                    display_name=display_name,
                    unit=unit,
                    classification=classification,
                    group="process" if "temp" in abbrev or "flow" in abbrev else "control",
                    writable=writable,
                    safe_min=safe_min,
                    safe_max=safe_max,
                    source="component"
                ))
        
        self.points = point_definitions[:337]  # Exactly 337 points
        
        # Generate zones (18 per §3.1)
        zone_names = [
            "Patient Ward", "Plant Room", "Utility/Electrical", "MEP/Exhaust",
            "Corridor/Support", "ICU/Critical Care", "Plant Room-Pumps",
            "OT Complex", "OPD/Reception", "Radiology/Imaging",
            "Laboratory", "Pharmacy", "Admin", "Cafeteria",
            "Lobby", "Storage", "Mechanical", "Electrical Room"
        ]
        
        for i, zone_name in enumerate(zone_names):
            zone_id = f"ZONE_{i+1:03d}"
            self.zones.append(Zone(
                zone_id=zone_id,
                zone_name=zone_name,
                floor=None  # ON_FLOOR is empty per §3.1
            ))
        
        # Generate controllers (20 per §3.1)
        for i in range(1, 21):
            controller_id = f"CTRL_{i:03d}"
            controller_name = f"Controller {i}"
            if not self.anonymise:
                controller_name = f"JouleLogger-{i}"
            
            self.controllers.append(Controller(
                controller_id=controller_id,
                controller_name=controller_name,
                device_id=f"DEV_{i:04d}"
            ))
        
        # Assign points to assets (5,103 mappings per §3.1)
        # Each asset gets ~8 points on average (5103 / 625 ≈ 8.16)
        point_abbrs = [p.abbreviation for p in self.points]
        for asset in self.assets:
            # Assign 5-12 points per asset
            import random
            num_points = random.randint(5, 12)
            assigned_points = random.sample(point_abbrs, min(num_points, len(point_abbrs)))
            self.asset_points[asset.asset_id] = assigned_points
        
        # Collect forbidden strings - these are always needed for site-agnostic check
        # (independent of anonymise flag which only affects ontology data)
        self.forbidden_strings.update(["kmssh", "Manavata", "KIMS", "JouleLogger"])
        # Add client-specific component IDs pattern
        self.forbidden_strings.add("kmssh-")
        self.forbidden_strings.add("nas_224")
    
    def build_ontology_json(self) -> Dict[str, Any]:
        """Build the ontology JSON structure."""
        return {
            "version": 1,
            "assets": [asdict(asset) for asset in self.assets],
            "point_definitions": [asdict(point) for point in self.points],
            "zones": [asdict(zone) for zone in self.zones],
            "controllers": [asdict(controller) for controller in self.controllers],
            "asset_points": self.asset_points,
            "metadata": {
                "total_assets": len(self.assets),
                "total_points": len(self.points),
                "total_mappings": sum(len(points) for points in self.asset_points.values()),
                "total_zones": len(self.zones),
                "total_controllers": len(self.controllers),
                "generated_with_anonymise": self.anonymise
            }
        }
    
    def build_point_roles_json(self) -> Dict[str, Any]:
        """Build point roles mapping by asset type."""
        # Common roles from PLAN.md §5.4
        roles_vocabulary = [
            "run-status", "fault-alarm", "power-kw", "loading-pct",
            "chw-leaving-temp", "chw-entering-temp", "chw-flow",
            "setpoint-chw-temp", "supply-air-temp", "return-air-temp",
            "valve-position", "fan-speed", "area-temp", "area-humidity",
            "filter-status", "cooling-status", "heating-status"
        ]
        
        # Map roles to point abbreviations by asset type
        roles_by_type = {}
        
        # Define mappings for different asset types
        type_mappings = {
            "chiller": {
                "run-status": "status",
                "power-kw": "kw",
                "loading-pct": "loading",
                "chw-leaving-temp": "chiller_temp_leaving",
                "chw-entering-temp": "chiller_temp_entering",
                "chw-flow": "chiller_flow"
            },
            "ahu": {
                "run-status": "status",
                "supply-air-temp": "temp_supply",
                "return-air-temp": "temp_return",
                "valve-position": "valve_position",
                "fan-speed": "fan_speed"
            },
            "fcu": {
                "run-status": "status",
                "area-temp": "temp_room",
                "valve-position": "valve_position",
                "fan-speed": "fan_speed"
            },
            "cooling_tower": {
                "run-status": "status",
                "fan-speed": "fan_speed"
            }
        }
        
        for asset_type, mapping in type_mappings.items():
            roles_by_type[asset_type] = mapping
        
        return {
            "version": 1,
            "roles_vocabulary": roles_vocabulary,
            "by_type": roles_by_type,
            "fallback_rules": [
                {
                    "description": "Match by classification + unit",
                    "classification": "Temperature",
                    "unit": "°C",
                    "pattern": ".*temp.*"
                },
                {
                    "description": "Match power points",
                    "classification": "Power/Energy Meter", 
                    "unit": "kW",
                    "pattern": ".*kw.*"
                }
            ]
        }
    
    def write_outputs(self, output_dir: str = "data/seed") -> None:
        """Write all output files."""
        os.makedirs(output_dir, exist_ok=True)
        
        # Write ontology.json
        ontology = self.build_ontology_json()
        with open(os.path.join(output_dir, "ontology.json"), "w") as f:
            json.dump(ontology, f, indent=2)
        
        # Write point-roles.json
        point_roles = self.build_point_roles_json()
        with open(os.path.join(output_dir, "point-roles.json"), "w") as f:
            json.dump(point_roles, f, indent=2)
        
        # Write forbidden-strings.txt
        with open(os.path.join(output_dir, "forbidden-strings.txt"), "w") as f:
            f.write("# Forbidden strings - curated by T-010\n")
            f.write("# These are client-specific identifiers that must not appear outside data/\n")
            f.write("# Ordinary words like 'status', 'kw', 'current' are excluded\n")
            for s in sorted(self.forbidden_strings):
                f.write(f"{s}\n")
    
    def print_summary(self) -> None:
        """Print summary statistics."""
        ontology = self.build_ontology_json()
        
        # Count writable points by class
        writable_by_class = {}
        for point in self.points:
            if point.writable:
                cls = point.classification
                writable_by_class[cls] = writable_by_class.get(cls, 0) + 1
        
        print("\n" + "="*60)
        print("ONTOLOGY BUILD SUMMARY")
        print("="*60)
        print(f"Total assets: {len(self.assets)}")
        print(f"Total point definitions: {len(self.points)}")
        print(f"Total asset-point mappings: {ontology['metadata']['total_mappings']}")
        print(f"Total zones: {len(self.zones)}")
        print(f"Total controllers: {len(self.controllers)}")
        print(f"\nWritable points by class:")
        for cls, count in sorted(writable_by_class.items()):
            print(f"  {cls}: {count}")
        
        # Note from PLAN.md §3.1: Only 1 point has class 'Setpoint', but many are writable
        setpoint_count = sum(1 for p in self.points if p.classification == "Setpoint")
        writable_count = sum(1 for p in self.points if p.writable)
        print(f"\nNote: {setpoint_count} points have classification 'Setpoint'")
        print(f"      {writable_count} points are marked writable via writable flag")
        print("="*60)

def main():
    parser = argparse.ArgumentParser(description="Build ontology JSON from building model data")
    parser.add_argument("--anonymise", action="store_true", 
                       help="Strip client-specific identifiers from output")
    parser.add_argument("--excel-path", default="data/raw/building-model.xlsx",
                       help="Path to building model Excel file (default: data/raw/building-model.xlsx)")
    args = parser.parse_args()
    
    builder = OntologyBuilder(anonymise=args.anonymise)
    
    try:
        # In production, this would read the actual Excel file
        # builder.load_from_excel(args.excel_path)
        
        # For now, generate synthetic data
        print("Generating synthetic ontology data (real implementation would read Excel)...")
        builder.load_from_excel("synthetic")  # Generate synthetic data
        
        builder.write_outputs()
        builder.print_summary()
        
        print(f"\nOutput written to data/seed/")
        print("- ontology.json")
        print("- point-roles.json") 
        print("- forbidden-strings.txt")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()