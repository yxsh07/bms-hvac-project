// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  siteIds: string[];
  avatarUrl?: string;
}

export type UserRole = 'admin' | 'engineer' | 'facility_manager' | 'operator' | 'executive';

export interface Site {
  id: string;
  name: string;
  timezone: string;
  environment?: {
    wetBulbTemp?: number;
    dryBulbTemp?: number;
    relativeHumidity?: number;
  };
}

export interface AuthState {
  user: User | null;
  sites: Site[];
  currentSiteId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  sites: Site[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Role permissions matrix (simplified for UI)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  engineer: [
    'telemetry:read', 'ontology:read', 'alarms:read', 'alarms:acknowledge',
    'setpoints:read', 'setpoints:propose', 'schedules:read', 'schedules:write',
    'overrides:read', 'overrides:create', 'reports:read', 'reports:run', 'reports:export',
    'audit:read', 'users:read'
  ],
  facility_manager: [
    'telemetry:read', 'ontology:read', 'alarms:read', 'alarms:acknowledge',
    'setpoints:read', 'setpoints:approve', 'schedules:read', 'schedules:write',
    'overrides:read', 'overrides:create', 'overrides:approve',
    'reports:read', 'reports:run', 'reports:export', 'audit:read', 'audit:export'
  ],
  operator: [
    'telemetry:read', 'ontology:read', 'alarms:read', 'alarms:acknowledge',
    'setpoints:read', 'reports:read', 'reports:run'
  ],
  executive: [
    'telemetry:read', 'ontology:read', 'alarms:read',
    'setpoints:read', 'reports:read', 'reports:run', 'reports:export', 'audit:read'
  ]
};

export function hasPermission(userRole: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}