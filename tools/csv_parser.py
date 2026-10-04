#!/usr/bin/env python3
"""Multi-block annotated CSV parser.

Parses CSV files with:
- Blank line ends a block
- '#' rows are annotations (metadata)
- Header per block
- Ragged-row guard (handles varying column counts)
- UTC -> IST timezone conversion
- Maps field 'is_delayed_data' onto 'is_delayed'
- Line counts must reconcile to manifest.json

Usage:
  python tools/csv_parser.py --manifest manifest.json --input-dir data/raw/components --output-dir data/seed/parsed
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Generator, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib


@dataclass
class ParsedBlock:
    """A single block from the multi-block CSV."""
    file_name: str
    block_number: int
    annotations: Dict[str, str]
    headers: List[str]
    rows: List[Dict[str, Any]]
    start_line: int
    end_line: int


@dataclass
class ReconciliationResult:
    """Result of manifest reconciliation."""
    file_name: str
    expected_rows: int
    actual_rows: int
    expected_blocks: int
    actual_blocks: int
    match: bool
    errors: List[str]


IST_OFFSET = timedelta(hours=5, minutes=30)


class MultiBlockCSVParser:
    """Parse multi-block annotated CSV files."""
    
    def __init__(self, input_dir: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def parse_file(self, file_path: Path) -> List[ParsedBlock]:
        """Parse a single multi-block CSV file."""
        blocks = []
        current_block = None
        pending_annotations = {}
        line_number = 0
        block_number = 0
        
        with open(file_path, 'r', encoding='utf-8', newline='') as f:
            reader = csv.reader(f)
            
            for row in reader:
                line_number += 1
                
                # Skip empty rows (block separator)
                if not row or all(cell.strip() == '' for cell in row):
                    if current_block is not None:
                        # End current block
                        current_block.end_line = line_number - 1
                        blocks.append(current_block)
                        current_block = None
                    continue
                
                # Check for annotation row (starts with #)
                if row[0].startswith('#'):
                    # Parse annotation - store for next block
                    annotation_text = row[0][1:].strip()  # Remove #
                    if ':' in annotation_text:
                        key, value = annotation_text.split(':', 1)
                        pending_annotations[key.strip()] = value.strip()
                    continue
                
                # Regular data row
                if current_block is None:
                    # Start new block
                    block_number += 1
                    current_block = ParsedBlock(
                        file_name=file_path.name,
                        block_number=block_number,
                        annotations=pending_annotations.copy(),  # Attach pending annotations
                        headers=row,
                        rows=[],
                        start_line=line_number,
                        end_line=line_number
                    )
                    pending_annotations.clear()
                else:
                    # Check if this looks like a new header (different column count or first row after annotations)
                    if not current_block.headers:
                        current_block.headers = row
                    else:
                        # Data row - handle ragged rows
                        row_data = self._parse_row(current_block.headers, row)
                        if row_data:
                            # Convert UTC to IST
                            row_data = self._convert_timestamps(row_data)
                            # Map is_delayed_data to is_delayed
                            row_data = self._map_delayed_field(row_data)
                            current_block.rows.append(row_data)
                        current_block.end_line = line_number
            
            # Don't forget the last block
            if current_block is not None:
                current_block.end_line = line_number
                blocks.append(current_block)
        
        return blocks
    
    def _parse_row(self, headers: List[str], row: List[str]) -> Optional[Dict[str, Any]]:
        """Parse a row with ragged-row guard."""
        if len(row) == 0:
            return None
            
        # Pad or truncate row to match headers
        if len(row) < len(headers):
            row = row + [''] * (len(headers) - len(row))
        elif len(row) > len(headers):
            row = row[:len(headers)]
            
        return dict(zip(headers, row))
    
    def _convert_timestamps(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Convert UTC timestamps to IST."""
        result = row.copy()
        
        # Look for timestamp columns
        for key, value in row.items():
            if key.lower() in ('time', 'timestamp', 'datetime', 'ts', 'event_time'):
                if value and isinstance(value, str):
                    try:
                        # Try parsing as ISO format (could be UTC or with offset)
                        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        if dt.tzinfo is None:
                            # Assume UTC if no timezone
                            dt = dt.replace(tzinfo=timezone.utc)
                        # Convert to IST
                        dt_ist = dt.astimezone(timezone(IST_OFFSET))
                        result[key] = dt_ist.isoformat()
                    except ValueError:
                        # Not a valid timestamp, keep as-is
                        pass
                        
        return result
    
    def _map_delayed_field(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Map is_delayed_data field to is_delayed."""
        result = row.copy()
        
        # Check for is_delayed_data field (from device measurement)
        if 'is_delayed_data' in result:
            # Convert to boolean
            delayed_value = result['is_delayed_data']
            if isinstance(delayed_value, str):
                result['is_delayed'] = delayed_value.lower() in ('1', '1.0', 'true', 'yes')
            else:
                result['is_delayed'] = bool(delayed_value)
            # Keep original field for reference
            result['is_delayed_data_original'] = result.pop('is_delayed_data')
        elif 'is_delayed' not in result:
            result['is_delayed'] = False
            
        return result
    
    def write_blocks(self, blocks: List[ParsedBlock]) -> None:
        """Write parsed blocks to output files."""
        for block in blocks:
            # Create a unique filename
            output_file = self.output_dir / f"{block.file_name.replace('.csv', '')}_block_{block.block_number:04d}.json"
            
            output_data = {
                "file_name": block.file_name,
                "block_number": block.block_number,
                "annotations": block.annotations,
                "headers": block.headers,
                "row_count": len(block.rows),
                "start_line": block.start_line,
                "end_line": block.end_line,
                "rows": block.rows
            }
            
            with open(output_file, 'w') as f:
                json.dump(output_data, f, indent=2)


def load_manifest(manifest_path: str) -> Dict[str, Any]:
    """Load manifest.json file."""
    with open(manifest_path, 'r') as f:
        return json.load(f)


def reconcile_blocks(parser: MultiBlockCSVParser, manifest: Dict[str, Any]) -> List[ReconciliationResult]:
    """Reconcile parsed blocks with manifest.json."""
    results = []
    
    # Group blocks by file
    blocks_by_file = {}
    for file_info in manifest.get('file_breakdown', []):
        filename = file_info['filename']
        blocks = parser.parse_file(parser.input_dir / filename)
        blocks_by_file[filename] = blocks
    
    # Check each file
    for file_info in manifest.get('file_breakdown', []):
        filename = file_info['filename']
        expected_rows = file_info['rows']
        expected_blocks = file_info['blocks']
        
        blocks = blocks_by_file.get(filename, [])
        actual_blocks = len(blocks)
        actual_rows = sum(len(b.rows) for b in blocks)
        
        errors = []
        if actual_rows != expected_rows:
            errors.append(f"Row count mismatch: expected {expected_rows}, got {actual_rows}")
        if actual_blocks != expected_blocks:
            errors.append(f"Block count mismatch: expected {expected_blocks}, got {actual_blocks}")
            
        results.append(ReconciliationResult(
            file_name=filename,
            expected_rows=expected_rows,
            actual_rows=actual_rows,
            expected_blocks=expected_blocks,
            actual_blocks=actual_blocks,
            match=len(errors) == 0,
            errors=errors
        ))
        
    return results


def main():
    parser = argparse.ArgumentParser(description="Multi-block annotated CSV parser")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    parser.add_argument("--input-dir", required=True, help="Input directory with CSV files")
    parser.add_argument("--output-dir", required=True, help="Output directory for parsed blocks")
    parser.add_argument("--reconcile-only", action="store_true", 
                       help="Only run reconciliation, don't write output files")
    args = parser.parse_args()
    
    # Load manifest
    manifest = load_manifest(args.manifest)
    
    # Create parser
    csv_parser = MultiBlockCSVParser(args.input_dir, args.output_dir)
    
    # Parse all files
    all_blocks = []
    for file_info in manifest.get('file_breakdown', []):
        filename = file_info['filename']
        file_path = Path(args.input_dir) / filename
        
        if file_path.exists():
            print(f"Parsing {filename}...")
            blocks = csv_parser.parse_file(file_path)
            all_blocks.extend(blocks)
            
            if not args.reconcile_only:
                csv_parser.write_blocks(blocks)
                print(f"  Wrote {len(blocks)} blocks to {args.output_dir}")
        else:
            print(f"Warning: File {filename} not found at {file_path}")
    
    # Reconcile
    print("\nReconciling with manifest...")
    results = reconcile_blocks(csv_parser, manifest)
    
    all_match = True
    for result in results:
        status = "PASS" if result.match else "FAIL"
        print(f"  {status} {result.file_name}: rows={result.actual_rows}/{result.expected_rows}, "
              f"blocks={result.actual_blocks}/{result.expected_blocks}")
        for error in result.errors:
            print(f"    ERROR: {error}")
            all_match = False
    
    # Print summary
    total_expected_rows = sum(r.expected_rows for r in results)
    total_actual_rows = sum(r.actual_rows for r in results)
    total_expected_blocks = sum(r.expected_blocks for r in results)
    total_actual_blocks = sum(r.actual_blocks for r in results)
    
    print(f"\nTotal: rows={total_actual_rows}/{total_expected_rows}, "
          f"blocks={total_actual_blocks}/{total_expected_blocks}")
    
    if not all_match:
        print("\nRECONCILIATION FAILED")
        sys.exit(1)
    else:
        print("\nRECONCILIATION PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()