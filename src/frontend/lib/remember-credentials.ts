/**
 * 登录凭据本地存储。
 * 密码使用 base64 编码存储（简单混淆，适合内部工具场景）。
 */

const STORAGE_KEY = "bid-master-credentials";

interface SavedCredentials {
  email: string;
  password: string;
}

export function saveCredentials(email: string, password: string): void {
  if (typeof window === "undefined") return;
  try {
    const data: SavedCredentials = { email, password: btoa(password) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略
  }
}

export function loadCredentials(): { email: string; password: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: SavedCredentials = JSON.parse(raw);
    if (!data.email || !data.password) return null;
    return { email: data.email, password: atob(data.password) };
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默忽略
  }
}
