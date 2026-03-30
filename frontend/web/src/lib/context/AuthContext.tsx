'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import axios from 'axios';

const AUTH_URL  = process.env.NEXT_PUBLIC_AUTH_URL;
const SS_KEY    = 'nerdco_auth'; // sessionStorage key — cleared when browser tab closes

export type UserRole = 'system_admin' | 'org_admin' | 'first_responder';
export type OrgType  = 'ambulance_service' | 'hospital' | 'police_station' | 'fire_station' | null;

export interface AuthUser {
  id:              string;
  name:            string;
  email:           string;
  role:            UserRole;
  org:             string | null;
  org_type:        OrgType;
  access_token:    string;
  refresh_token:   string;
}

interface AuthContextValue {
  user:         AuthUser | null;
  login:        (email: string, password: string) => Promise<AuthUser>;
  logout:       () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  updateUser:   (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getTokenExpMs(token: string): number | null {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rehydrate from sessionStorage on mount (survives F5, not browser close)
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  // Axios interceptor to catch 401 responses and automatically log out
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
          setUser(null);
          try { sessionStorage.removeItem(SS_KEY); } catch {}
          document.cookie = 'nerdco_role=; path=/; max-age=0';
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
            return new Promise(() => {}); // Halts the promise chain to prevent unhandled rejection during redirect
          }
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Keep sessionStorage and the role cookie in sync whenever user changes
  useEffect(() => {
    if (user) {
      try { sessionStorage.setItem(SS_KEY, JSON.stringify(user)); } catch {}
      document.cookie = `nerdco_role=${user.role}; path=/; SameSite=Strict`;
    } else {
      try { sessionStorage.removeItem(SS_KEY); } catch {}
      document.cookie = 'nerdco_role=; path=/; max-age=0';
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post(`${AUTH_URL}/auth/login`, { email, password });
    // Decode JWT payload to get org + org_type without an extra round-trip
    const payload = JSON.parse(atob(data.access_token.split('.')[1]));
    const authUser: AuthUser = {
      id:            data.user.id,
      name:          data.user.name,
      email:         data.user.email,
      role:          data.user.role,
      org:           payload.org   ?? null,
      org_type:      payload.org_type ?? null,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
    };
    // Write synchronously BEFORE router.replace() so the new page always
    // reads a valid user from sessionStorage even if React hasn't re-rendered yet.
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(authUser)); } catch {}
    document.cookie = `nerdco_role=${authUser.role}; path=/; SameSite=Strict`;
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(async () => {
    if (user) {
      await axios.post(`${AUTH_URL}/auth/logout`,
        { refresh_token: user.refresh_token },
        { headers: { Authorization: `Bearer ${user.access_token}` } }
      ).catch(() => {});
    }
    setUser(null);
    // sessionStorage + cookie cleared by useEffect above
  }, [user]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
    // sessionStorage sync is handled by the useEffect that watches `user`
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data } = await axios.post(`${AUTH_URL}/auth/refresh-token`, { refresh_token: user.refresh_token });
      setUser(prev => prev ? { ...prev, access_token: data.access_token } : null);
      return data.access_token;
    } catch {
      setUser(null);
      return null;
    }
  }, [user]);

  // Schedule a proactive token refresh 60s before expiry
  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expMs = getTokenExpMs(token);
    if (!expMs) return;
    const delayMs = expMs - Date.now() - 60_000;
    if (delayMs <= 0) return; // already expired or within 60s — refresh immediately on next request
    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await refreshToken();
      if (newToken) scheduleRefresh(newToken);
    }, delayMs);
  }, [refreshToken]);

  // Start/cancel the proactive refresh timer whenever the access token changes
  useEffect(() => {
    if (user?.access_token) {
      scheduleRefresh(user.access_token);
    } else {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [user?.access_token, scheduleRefresh]);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshToken, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
