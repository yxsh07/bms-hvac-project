import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultBaseUrl } from '../api/client';
import { hasPermission as roleHasPermission, type AuthState, type LoginCredentials, type Site, type User, type UserRole } from '../types/auth';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  setCurrentSite: (siteId: string) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE = 'bms-session';
const empty: AuthState = { user: null, sites: [], currentSiteId: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(defaultBaseUrl() + path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `API request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

interface ApiMe { id: string; name: string; email: string; roles: Record<string, string>; siteIds: string[] }
interface ApiTokens { accessToken: string; refreshToken: string }

function toUser(me: ApiMe, siteId: string): User {
  const role = me.roles[siteId] === 'facility-manager' ? 'facility_manager' : me.roles[siteId];
  return { id: me.id, name: me.name, email: me.email, siteIds: me.siteIds, role: role as UserRole };
}

async function session(tokens: ApiTokens, preferredSite?: string | null): Promise<AuthState> {
  const headers = { Authorization: `Bearer ${tokens.accessToken}` };
  const [me, sites] = await Promise.all([
    api<ApiMe>('/api/v1/me', { headers }),
    api<Site[]>('/api/v1/sites', { headers }),
  ]);
  const currentSiteId = sites.some((site) => site.id === preferredSite) ? preferredSite! : sites[0]?.id ?? null;
  return { user: currentSiteId ? toUser(me, currentSiteId) : null, sites, currentSiteId,
    accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isAuthenticated: Boolean(currentSiteId), isLoading: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...empty, isLoading: true });
  const clear = useCallback(() => { localStorage.removeItem(STORAGE); setState(empty); }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    if (!saved) { setState(empty); return; }
    try {
      const stored = JSON.parse(saved) as ApiTokens & { currentSiteId?: string };
      session(stored, stored.currentSiteId).then(setState).catch(async () => {
        try {
          const tokens = await api<ApiTokens>('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: stored.refreshToken }) });
          const next = await session(tokens, stored.currentSiteId);
          localStorage.setItem(STORAGE, JSON.stringify({ ...tokens, currentSiteId: next.currentSiteId }));
          setState(next);
        } catch { clear(); }
      });
    } catch { clear(); }
  }, [clear]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((previous) => ({ ...previous, isLoading: true }));
    try {
      const tokens = await api<ApiTokens>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      const next = await session(tokens);
      localStorage.setItem(STORAGE, JSON.stringify({ ...tokens, currentSiteId: next.currentSiteId }));
      setState(next);
    } catch (error) { setState(empty); throw error; }
  }, []);

  const logout = useCallback(async () => {
    if (state.refreshToken) {
      await api<void>('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: state.refreshToken }) }).catch(() => undefined);
    }
    clear();
  }, [state.refreshToken, clear]);

  const refreshAccessToken = useCallback(async () => {
    if (!state.refreshToken) { clear(); return; }
    try {
      const tokens = await api<ApiTokens>('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: state.refreshToken }) });
      localStorage.setItem(STORAGE, JSON.stringify({ ...tokens, currentSiteId: state.currentSiteId }));
      setState((previous) => ({ ...previous, ...tokens }));
    } catch { clear(); }
  }, [state.refreshToken, state.currentSiteId, clear]);

  const setCurrentSite = useCallback((siteId: string) => {
    if (!state.user?.siteIds.includes(siteId)) return;
    const stored = JSON.parse(localStorage.getItem(STORAGE) ?? '{}') as Record<string, unknown>;
    localStorage.setItem(STORAGE, JSON.stringify({ ...stored, currentSiteId: siteId }));
    setState((previous) => ({ ...previous, currentSiteId: siteId }));
  }, [state.user]);

  const hasPermission = useCallback((permission: string) => Boolean(state.user && roleHasPermission(state.user.role, permission)), [state.user]);
  const hasRole = useCallback((roles: UserRole[]) => Boolean(state.user && roles.includes(state.user.role)), [state.user]);
  return <AuthContext.Provider value={{ ...state, login, logout, refreshAccessToken, setCurrentSite, hasPermission, hasRole }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
