'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';

import { ApiError, get, post } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await get<{ user: User }>('/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await post<{ user: User }>('/auth/login', {
        email,
        password,
      });
      queryClient.setQueryData(['auth', 'me'], res.user);
    },
    [queryClient],
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string,
    ) => {
      const res = await post<{ user: User }>('/auth/register', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      queryClient.setQueryData(['auth', 'me'], res.user);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user: data ?? null, isLoading, login, signup, logout }),
    [data, isLoading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
