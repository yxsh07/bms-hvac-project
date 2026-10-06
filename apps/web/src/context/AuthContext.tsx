import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Site, AuthState, LoginCredentials, LoginResponse, TokenPair, UserRole } from '../types/auth';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  setCurrentSite: (siteId: string) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Demo users for development
const DEMO_USERS: Record<string, { user: User; password: string }> = {
  'admin@bms.local': {
    user: {
      id: 'u1',
      email: 'admin@bms.local',
      name: 'Admin User',
      role: 'admin',
      siteIds: ['simsite-hospital', 'office-small']
    },
    password: 'admin123'
  },
  'engineer@bms.local': {
    user: {
      id: 'u2',
      email: 'engineer@bms.local',
      name: 'HVAC Engineer',
      role: 'engineer',
      siteIds: ['simsite-hospital', 'office-small']
    },
    password: 'eng123'
  },
  'manager@bms.local': {
    user: {
      id: 'u3',
      email: 'manager@bms.local',
      name: 'Facility Manager',
      role: 'facility_manager',
      siteIds: ['simsite-hospital']
    },
    password: 'mgr123'
  },
  'operator@bms.local': {
    user: {
      id: 'u4',
      email: 'operator@bms.local',
      name: 'Operator',
      role: 'operator',
      siteIds: ['simsite-hospital']
    },
    password: 'op123'
  },
  'executive@bms.local': {
    user: {
      id: 'u5',
      email: 'executive@bms.local',
      name: 'Executive',
      role: 'executive',
      siteIds: ['simsite-hospital', 'office-small']
    },
    password: 'exec123'
  }
};

const DEMO_SITES: Site[] = [
  {
    id: 'simsite-hospital',
    name: 'SimSite Hospital',
    timezone: 'Asia/Kolkata',
    environment: {
      wetBulbTemp: 24.5,
      dryBulbTemp: 32.1,
      relativeHumidity: 65
    }
  },
  {
    id: 'office-small',
    name: 'Office Small',
    timezone: 'America/New_York',
    environment: {
      wetBulbTemp: 18.2,
      dryBulbTemp: 24.8,
      relativeHumidity: 52
    }
  }
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    sites: [],
    currentSiteId: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true
  });

  const clearAuth = useCallback(() => {
    localStorage.removeItem('bms-user');
    localStorage.removeItem('bms-access-token');
    localStorage.removeItem('bms-refresh-token');
    localStorage.removeItem('bms-current-site');
    setState({
      user: null,
      sites: [],
      currentSiteId: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false
    });
  }, []);

  // Initialize auth from localStorage
  useEffect(() => {
    const initAuth = () => {
      const storedUser = localStorage.getItem('bms-user');
      const storedToken = localStorage.getItem('bms-access-token');
      const storedRefresh = localStorage.getItem('bms-refresh-token');
      const storedSite = localStorage.getItem('bms-current-site');

      if (storedUser && storedToken) {
        try {
          const user = JSON.parse(storedUser) as User;
          const sites = DEMO_SITES.filter(s => user.siteIds.includes(s.id));
          const currentSiteId = storedSite && user.siteIds.includes(storedSite) ? storedSite : user.siteIds[0] || null;

          setState({
            user,
            sites,
            currentSiteId,
            accessToken: storedToken,
            refreshToken: storedRefresh,
            isAuthenticated: true,
            isLoading: false
          });
        } catch {
          clearAuth();
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, [clearAuth]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true }));

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const demoUser = DEMO_USERS[credentials.email];
    if (!demoUser || demoUser.password !== credentials.password) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Invalid credentials');
    }

    const sites = DEMO_SITES.filter(s => demoUser.user.siteIds.includes(s.id));
    const currentSiteId = demoUser.user.siteIds[0] || null;

    const accessToken = `demo-access-${Date.now()}`;
    const refreshToken = `demo-refresh-${Date.now()}`;

    localStorage.setItem('bms-user', JSON.stringify(demoUser.user));
    localStorage.setItem('bms-access-token', accessToken);
    localStorage.setItem('bms-refresh-token', refreshToken);
    if (currentSiteId) {
      localStorage.setItem('bms-current-site', currentSiteId);
    }

    setState({
      user: demoUser.user,
      sites,
      currentSiteId,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isLoading: false
    });
  }, []);

  const logout = useCallback(async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));
    clearAuth();
  }, [clearAuth]);

  const refreshAccessToken = useCallback(async () => {
    // In real implementation, call refresh endpoint
    const newAccessToken = `demo-access-${Date.now()}`;
    localStorage.setItem('bms-access-token', newAccessToken);
    setState(prev => ({ ...prev, accessToken: newAccessToken }));
  }, []);

  const setCurrentSite = useCallback((siteId: string) => {
    if (state.user?.siteIds.includes(siteId)) {
      localStorage.setItem('bms-current-site', siteId);
      setState(prev => ({ ...prev, currentSiteId: siteId }));
    }
  }, [state.user?.siteIds]);

  const hasPermission = useCallback((permission: string) => {
    if (!state.user) return false;
    if (state.user.role === 'admin') return true;
    // In real app, check against actual permissions from backend
    return true; // Simplified for demo
  }, [state.user]);

  const hasRole = useCallback((roles: UserRole[]) => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  }, [state.user]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshAccessToken,
    setCurrentSite,
    hasPermission,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}