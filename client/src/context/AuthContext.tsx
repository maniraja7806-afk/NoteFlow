import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage, tokenStore } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(tokenStore.get());
  const [loading, setLoading] = useState<boolean>(Boolean(tokenStore.get()));

  // Restore the session on mount if a token is present.
  useEffect(() => {
    let active = true;
    const existing = tokenStore.get();
    if (!existing) {
      setLoading(false);
      return;
    }
    api
      .get<{ success: boolean; user: User }>('/auth/me')
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        tokenStore.clear();
        if (active) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persistSession = useCallback((data: AuthResponse) => {
    tokenStore.set(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
        persistSession(data);
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    },
    [persistSession]
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      try {
        const { data } = await api.post<AuthResponse>('/auth/register', {
          username,
          email,
          password,
        });
        persistSession(data);
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
