import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as authApi from "../api/auth";
import { updateProfile } from "../api/auth";
import { scheduleDailyDigest } from "../utils/notifications";
import client from "../api/client";
import type { User } from "../api/auth";

const GUEST_ONBOARDED_KEY = "guest_onboarded";
const GUEST_INTERESTS_KEY  = "guest_interests";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
  guestInterests: string[];
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, interests?: string[]) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  completeOnboarding: (interests: string[]) => Promise<void>;
  /** Re-fetch /auth/me and update user state — call after subscription changes. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [token, setToken]             = useState<string | null>(null);
  const [isGuest, setIsGuest]         = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const [guestOnboarded, setGuestOnboarded] = useState(false);
  const [guestInterests, setGuestInterests] = useState<string[]>([]);
  const interceptorRef = useRef<number | null>(null);

  // Attach a 401 interceptor so expired tokens auto-logout with a clear message
  useEffect(() => {
    interceptorRef.current = client.interceptors.response.use(
      (res) => res,
      async (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          const stored = await SecureStore.getItemAsync("token");
          if (stored) {
            // Token was present but rejected — expired or revoked
            await SecureStore.deleteItemAsync("token");
            setToken(null);
            setUser(null);
            setIsGuest(false);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      if (interceptorRef.current !== null)
        client.interceptors.response.eject(interceptorRef.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Restore auth token
        const stored = await SecureStore.getItemAsync("token");
        if (stored) {
          setToken(stored);
          const me = await authApi.getMe();
          setUser(me);
          scheduleDailyDigest(); // non-blocking, non-fatal
        }
        // Restore guest onboarding state
        const onboarded = await AsyncStorage.getItem(GUEST_ONBOARDED_KEY);
        if (onboarded === "true") setGuestOnboarded(true);
        const interests = await AsyncStorage.getItem(GUEST_INTERESTS_KEY);
        if (interests) setGuestInterests(JSON.parse(interests));
      } catch {
        await SecureStore.deleteItemAsync("token");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // True when the user needs to pick interests before seeing the feed
  const needsOnboarding =
    (isGuest && !guestOnboarded) ||
    (!!user && (user.interests?.length ?? 0) === 0);

  const login = async (email: string, password: string) => {
    const { token: t, user: u } = await authApi.login(email, password);
    await SecureStore.setItemAsync("token", t);
    setToken(t);
    setUser(u);
    setIsGuest(false);
    scheduleDailyDigest();
  };

  const register = async (email: string, name: string, password: string, interests?: string[]) => {
    const { token: t, user: u } = await authApi.register(email, name, password);
    await SecureStore.setItemAsync("token", t);
    setToken(t);
    // If interests were selected during onboarding, save them now while we
    // have the fresh token, then update the user state with the returned profile
    // so needsOnboarding resolves to false immediately.
    if (interests && interests.length > 0) {
      try {
        const updated = await updateProfile({ interests });
        setUser(updated);
      } catch {
        setUser(u);
      }
    } else {
      setUser(u);
    }
    setIsGuest(false);
    scheduleDailyDigest();
  };

  const loginAsGuest = () => {
    setIsGuest(true);
    setUser(null);
    setToken(null);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    setUser(null);
    setToken(null);
    setIsGuest(false);
  };

  /** Re-fetch the current user from the server and update state. */
  const refreshUser = async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {}
  };

  /** Called after the post-auth interests picker is completed */
  const completeOnboarding = async (interests: string[]) => {
    if (user) {
      // Logged-in: save to backend profile
      try {
        const updated = await updateProfile({ interests });
        setUser(updated);
      } catch {}
    } else {
      // Guest: persist locally
      await AsyncStorage.setItem(GUEST_INTERESTS_KEY, JSON.stringify(interests));
      await AsyncStorage.setItem(GUEST_ONBOARDED_KEY, "true");
      setGuestInterests(interests);
      setGuestOnboarded(true);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, token, isGuest, isLoading,
      needsOnboarding, guestInterests,
      login, register, loginAsGuest, logout, completeOnboarding, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
