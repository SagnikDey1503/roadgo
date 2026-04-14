import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  fetchMe,
  UserGender,
  UserProfile,
  loginWithPassword,
  logoutSession,
  signUpWithPassword,
  toggleSubscription,
  updateProfileGender,
} from '@/lib/api-client';

type AuthContextValue = {
  token: string | null;
  user: UserProfile | null;
  authLoading: boolean;
  signup: (input: { name: string; phone: string; gender: UserGender; password: string }) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  changeGender: (gender: UserGender) => Promise<void>;
  logout: () => Promise<void>;
  setSubscription: (enabled: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = 'roadgo.auth.v1';

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      setAuthLoading(true);
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored) as { token?: string } | null;
        const storedToken = parsed?.token;
        if (!storedToken) {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          return;
        }

        const me = await fetchMe(storedToken);
        if (!isMounted) {
          return;
        }

        setToken(storedToken);
        setUser(me.user);
        await AsyncStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            token: storedToken,
            user: me.user,
          })
        );
      } catch {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        if (!isMounted) {
          return;
        }
        setToken(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      token,
      user,
      authLoading,
      async signup(input) {
        setAuthLoading(true);
        try {
          const response = await signUpWithPassword({
            ...input,
            phone: normalizePhone(input.phone),
          });
          setToken(response.token);
          setUser(response.user);
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              token: response.token,
              user: response.user,
            })
          );
        } finally {
          setAuthLoading(false);
        }
      },
      async login(phone, password) {
        setAuthLoading(true);
        try {
          const response = await loginWithPassword(normalizePhone(phone), password);
          setToken(response.token);
          setUser(response.user);
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              token: response.token,
              user: response.user,
            })
          );
        } finally {
          setAuthLoading(false);
        }
      },
      async refreshProfile() {
        if (!token) {
          return;
        }
        const response = await fetchMe(token);
        setUser(response.user);
        await AsyncStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            token,
            user: response.user,
          })
        );
      },
      async changeGender(gender) {
        if (!token) {
          return;
        }
        setAuthLoading(true);
        try {
          const response = await updateProfileGender(token, gender);
          setUser(response.user);
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              token,
              user: response.user,
            })
          );
        } finally {
          setAuthLoading(false);
        }
      },
      async logout() {
        const activeToken = token;
        setAuthLoading(true);
        try {
          if (activeToken) {
            await logoutSession(activeToken);
          }
        } finally {
          setToken(null);
          setUser(null);
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthLoading(false);
        }
      },
      async setSubscription(enabled) {
        if (!token) {
          return;
        }
        setAuthLoading(true);
        try {
          const response = await toggleSubscription(token, enabled);
          setUser(response.user);
          await AsyncStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              token,
              user: response.user,
            })
          );
        } finally {
          setAuthLoading(false);
        }
      },
    };
  }, [authLoading, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
