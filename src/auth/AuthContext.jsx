import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { setAuthHandlers, requestJsonNoAuth } from '../api';

const AuthContext = createContext(null);

const REFRESH_TOKEN_KEY = 'burnup_refresh_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(null); // null = unknown, true/false
  const accessTokenRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const scheduleRefreshRef = useRef(null);

  const clearAuth = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback((expiresInMs) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 2 minutes before expiry
    const delay = Math.max(expiresInMs - 2 * 60 * 1000, 10_000);
    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return;
      try {
        const data = await requestJsonNoAuth('/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        accessTokenRef.current = data.access_token;
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        setUser(data.user);
        scheduleRefreshRef.current(28 * 60 * 1000); // assume ~30min token
      } catch {
        clearAuth();
      }
    }, delay);
  }, [clearAuth]);

  // Keep ref in sync so the recursive setTimeout call always uses the latest version
  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh;
  }, [scheduleRefresh]);

  const handleTokenResponse = useCallback((data) => {
    accessTokenRef.current = data.access_token;
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    setUser(data.user);
    scheduleRefresh(28 * 60 * 1000);
  }, [scheduleRefresh]);

  const silentRefresh = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    try {
      const data = await requestJsonNoAuth('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      handleTokenResponse(data);
      return data.access_token;
    } catch {
      clearAuth();
      return null;
    }
  }, [handleTokenResponse, clearAuth]);

  // Check system init status and attempt silent refresh on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await requestJsonNoAuth('/api/auth/status');
        setInitialized(status.initialized);

        if (status.initialized) {
          await silentRefresh();
        }
      } catch {
        // API unavailable
      }
      setIsLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Register auth handlers for api.js
  useEffect(() => {
    setAuthHandlers({
      getToken: () => accessTokenRef.current,
      onUnauthorized: silentRefresh,
    });
  }, [silentRefresh]);

  const login = useCallback(async (username, password) => {
    const data = await requestJsonNoAuth('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    handleTokenResponse(data);
    setInitialized(true);
    return data.user;
  }, [handleTokenResponse]);

  const bootstrap = useCallback(async (username, password) => {
    const data = await requestJsonNoAuth('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    handleTokenResponse(data);
    setInitialized(true);
    return data.user;
  }, [handleTokenResponse]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken && accessTokenRef.current) {
      try {
        await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/auth/logout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessTokenRef.current}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }
        );
      } catch {
        // ignore
      }
    }
    clearAuth();
  }, [clearAuth]);

  const value = {
    user,
    isLoading,
    initialized,
    login,
    bootstrap,
    logout,
    getToken: () => accessTokenRef.current,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
