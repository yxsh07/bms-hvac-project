// Development fixtures (PLAN §2.5: fixtures are excluded from the site-agnostic gate).
export interface ReportCatalogEntry {
  id: string;
  key: string;
  name: string;
  persona: string;
  description: string;
  formats: string[];
  status: string;
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { id: 'r1', key: 'energy-by-zone', name: 'Energy by Zone', persona: 'Fac. Manager, Executive', description: 'Group by zone. Counter consumption by successive positive differences with reset counts. Percent of total per zone.', formats: ['PDF', 'XLSX', 'CSV'], status: 'Ready' },
  { id: 'r2', key: 'chiller-plant-performance', name: 'Chiller Plant Performance', persona: 'Engineer', description: 'Runtime hours, mean/peak kW, mean ikW/TR, ΔT, tonnage, tower approach. Degradation view (month-over-month).', formats: ['PDF', 'CSV'], status: 'Ready' },
  { id: 'r3', key: 'setpoint-override-audit', name: 'Set-point & Override Audit', persona: 'Fac. Manager, Executive, Compliance', description: 'From audit table only. Collapse and flag rapid reversals (two changes that cancel within 60s).', formats: ['Signed PDF', 'CSV'], status: 'Ready' },
  { id: 'r4', key: 'equipment-health-coverage', name: 'Equipment Health & Coverage', persona: 'Engineer, Operator', description: 'Active alarms, trip/fault counts, assets below coverage threshold, controllers with stale data, quality-flagged readings.', formats: ['PDF', 'CSV'], status: 'Ready' },
  { id: 'r5', key: 'critical-environment-compliance', name: 'Critical Environment Compliance', persona: 'Fac. Manager, Clinical Engineering', description: 'Critical AHU assets. Time in range for temp/humidity, valve saturation, excursion list. Thresholds from site config.', formats: ['PDF (fileable)'], status: 'Config needed' },
];
