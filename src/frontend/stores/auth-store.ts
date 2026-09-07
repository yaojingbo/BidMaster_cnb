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
const GUEST_MODE = process.env.NEXT_PUBLIC_GUEST_MODE !== "false";

const DEMO_USER: User = {
  id: "demo-user",
  username: "demo",
  email: "demo@example.com",
  role: "user",
};

// 游客只读身份：游客模式下未登录用户可浏览功能页，role=guest 供侧边栏区分展示
const GUEST_USER: User = {
  id: "guest-demo",
  username: "游客",
  email: "guest-demo@bidmaster.local",
  role: "guest",
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
  user: GUEST_MODE ? GUEST_USER : AUTH_DISABLED ? DEMO_USER : null,
  accessToken: null,
  isAuthenticated: GUEST_MODE || AUTH_DISABLED,
  isLoading: false,
  // 游客模式仍需 initAuth 探测真实会话（可能残留 cookie）；AUTH_DISABLED 则无需
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
    set({
      accessToken: null,
      // 游客模式退出登录后回到游客只读身份；正常模式回到未登录
      user: GUEST_MODE ? GUEST_USER : null,
      isAuthenticated: GUEST_MODE,
      authReady: true,
    });
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
      // 游客模式刷新失败 → 回到游客只读身份；正常模式 → 未登录
      set({ accessToken: null, user: GUEST_MODE ? GUEST_USER : null, isAuthenticated: GUEST_MODE });
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
      // 游客模式：无会话落到游客只读身份；正常模式：未登录
      set({
        accessToken: null,
        user: GUEST_MODE ? GUEST_USER : null,
        isAuthenticated: GUEST_MODE,
        authReady: true,
      });
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
          set({ isAuthenticated: GUEST_MODE, user: GUEST_MODE ? GUEST_USER : null, authReady: true });
          clearAuthCookie();
        } else {
          set({ authReady: true });
          setAuthCookie();
        }
      }
    } else {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        set({ isAuthenticated: GUEST_MODE, user: GUEST_MODE ? GUEST_USER : null, authReady: true });
        clearAuthCookie();
      } else {
        set({ authReady: true });
        setAuthCookie();
      }
    }
  },
}));
