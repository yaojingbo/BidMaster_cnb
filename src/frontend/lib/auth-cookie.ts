/**
 * 客户端认证状态 cookie 管理。
 * Next.js rewrites 不一定转发后端的 Set-Cookie（httpOnly refresh_token），
 * 导致 middleware 无法检测登录态。此模块用非 httpOnly 的 auth_status cookie
 * 作为 middleware 可靠的登录指示器。
 */

const AUTH_COOKIE_NAME = "auth_status";
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 天，与 refresh_token 同步

export function setAuthCookie(): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=1; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some(cookie => cookie === `${AUTH_COOKIE_NAME}=1`);
}
