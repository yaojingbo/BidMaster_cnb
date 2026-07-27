/**
 * 认证状态管理（zustand）。
 * accessToken 仅存储在内存中（不 persist）。
 * refresh_token 由后端设为 httpOnly cookie，前端无法直接读取。
 */
import { create } from "zustand";
import { authLogin, authRegister, authRefresh, authMe } from "@/lib/auth-api";
import { setAuthCookie, clearAuthCookie, hasAuthCookie } from "@/lib/auth-cookie";
import { useFileStore } from "@/stores/file-store";
import { useTaskStore } from "@/stores/task-store";
import { useLogStore } from "@/stores/log-store";

const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";
const DEMO_USER: User = {
  id: "demo-user",
  username: "demo",
  email: "demo@example.com",
  role: "user",
};

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string, code: string, username?: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: AUTH_DISABLED ? DEMO_USER : null,
  accessToken: null,
  isAuthenticated: AUTH_DISABLED,
  isLoading: false,
  authReady: AUTH_DISABLED,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authLogin(email, password);
      useFileStore.getState().clearFiles();
      useTaskStore.getState().clearExtract();
      useTaskStore.getState().clearSimulate();
      useTaskStore.getState().clearStatistics();
      useLogStore.getState().clearLogs();
      set({
        accessToken: res.access_token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
        authReady: true,
      });
      setAuthCookie();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email, password, confirmPassword, code, username) => {
    set({ isLoading: true });
    try {
      const res = await authRegister(email, password, confirmPassword, code, username);
      useFileStore.getState().clearFiles();
      useTaskStore.getState().clearExtract();
      useTaskStore.getState().clearSimulate();
      useTaskStore.getState().clearStatistics();
      useLogStore.getState().clearLogs();
      set({
        accessToken: res.access_token,
        user: res.user,
        isAuthenticated: true,
        isLoading: false,
        authReady: true,
      });
      setAuthCookie();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    if (AUTH_DISABLED) {
      set({ accessToken: null, user: DEMO_USER, isAuthenticated: true, authReady: true });
      return;
    }
    // 先清除客户端可见状态，确保 middleware 不再认为已认证
    clearAuthCookie();
    set({ accessToken: null, user: null, isAuthenticated: false, authReady: true });
    // 清空所有 persist store，防止下一个用户看到当前用户数据
    useFileStore.getState().clearFiles();
    useTaskStore.getState().clearExtract();
    useTaskStore.getState().clearSimulate();
    useTaskStore.getState().clearStatistics();
    useLogStore.getState().clearLogs();
    // 最后通知后端清除 httpOnly cookie（fire-and-forget，但 cookie 会通过 Set-Cookie 响应头清除）
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  },

  refreshAccessToken: async () => {
    if (AUTH_DISABLED) {
      set({ accessToken: null, user: DEMO_USER, isAuthenticated: true, authReady: true });
      return null;
    }
    try {
      const res = await authRefresh();
      set({ accessToken: res.access_token, isAuthenticated: true });
      const user = await authMe(res.access_token);
      set({ user });
      setAuthCookie();
      return res.access_token;
    } catch {
      set({ accessToken: null, user: null, isAuthenticated: false });
      clearAuthCookie();
      return null;
    }
  },

  initAuth: async () => {
    if (AUTH_DISABLED) {
      set({ accessToken: null, user: DEMO_USER, isAuthenticated: true, authReady: true });
      return;
    }
    const { accessToken, refreshAccessToken } = get();
    if (!hasAuthCookie()) {
      set({ accessToken: null, user: null, isAuthenticated: false, authReady: true });
      return;
    }
    if (accessToken) {
      try {
        const user = await authMe(accessToken);
        set({ user, isAuthenticated: true, authReady: true });
        setAuthCookie();
      } catch {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          set({ isAuthenticated: false, authReady: true });
          clearAuthCookie();
        } else {
          set({ authReady: true });
          setAuthCookie();
        }
      }
    } else {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        set({ isAuthenticated: false, authReady: true });
        clearAuthCookie();
      } else {
        set({ authReady: true });
        setAuthCookie();
      }
    }
  },
}));