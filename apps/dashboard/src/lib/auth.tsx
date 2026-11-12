"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { authApi, currentAuthRevision, invalidateAuthRequests } from "./api";
import { ACTIVITY_KEY, watchIdleSession } from "./idle-session";

interface User {
  id: string;
  email: string;
  name?: string | null;
  telegramId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pendingLogout = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    const revision = invalidateAuthRequests();
    localStorage.removeItem("token");
    const expired = () => {
      invalidateAuthRequests();
      localStorage.removeItem(ACTIVITY_KEY);
      setUser(null);
    };
    window.addEventListener("auth:expired", expired);
    authApi
      .me()
      .then((profile) => {
        if (active && revision === currentAuthRevision()) setUser(profile);
      })
      .catch(() => {
        if (active && revision === currentAuthRevision()) expired();
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("auth:expired", expired);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    return watchIdleSession(
      () => {
        void logout();
      },
      () =>
        authApi
          .activity()
          .then(() => undefined)
          .catch(() => undefined),
    );
  }, [user]);

  const login = async (email: string, password: string) => {
    invalidateAuthRequests();
    await pendingLogout.current;
    const { user: userData } = await authApi.login({
      email,
      password,
    });
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setUser(userData);
  };

  const register = async (email: string, password: string, name?: string) => {
    invalidateAuthRequests();
    await pendingLogout.current;
    const { user: userData } = await authApi.register({
      email,
      password,
      name,
    });
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setUser(userData);
  };

  const loginWithGoogle = async (credential: string) => {
    invalidateAuthRequests();
    await pendingLogout.current;
    const { user: userData } = await authApi.google(credential);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setUser(userData);
  };

  const logout = () => {
    invalidateAuthRequests();
    pendingLogout.current = authApi.logout().catch(() => undefined);
    localStorage.removeItem(ACTIVITY_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    const revision = currentAuthRevision();
    const userData = await authApi.me();
    if (revision === currentAuthRevision()) setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
