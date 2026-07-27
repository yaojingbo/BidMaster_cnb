/**
 * Auth API 代理路由。
 * Next.js rewrites 不保证转发后端的 Set-Cookie 头，
 * 所以用 API Route 代替——在服务器端读取后端响应中的 refresh_token，
 * 再由 Next.js 自己设置 httpOnly cookie 给浏览器。
 */
import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_MAX_AGE = 7 * 86400; // 7 天

/** 从后端响应中提取 refresh_token 值（兼容不同 Node.js 版本的 header 读取） */
function extractRefreshTokenFromHeaders(headers: Headers): string | null {
  // 优先用 getSetCookie()（Node.js 20+ / undici 5.22+）
  if (typeof headers.getSetCookie === "function") {
    for (const c of headers.getSetCookie()) {
      const m = c.match(/refresh_token=([^;]+)/);
      if (m) return m[1];
    }
  }
  // 回退：某些 undici 版本 getSetCookie 返回空但 get 仍可用
  const raw = headers.get("set-cookie");
  if (raw) {
    const m = raw.match(/refresh_token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

/** 从后端 JSON 响应体中提取 refresh_token（最可靠的 fallback） */
function extractRefreshTokenFromBody(data: Record<string, unknown>): string | null {
  if (typeof data.refresh_token === "string" && data.refresh_token) {
    return data.refresh_token;
  }
  return null;
}

async function proxyAuthRequest(
  request: NextRequest,
  segments: string[],
) {
  const action = segments.join("/");
  const backend = getBackendUrl();
  const url = `${backend}/api/auth/${action}`;

  const fwdHeaders: Record<string, string> = {};

  const auth = request.headers.get("Authorization");
  if (auth) fwdHeaders["Authorization"] = auth;

  if (action === "refresh") {
    const token = request.cookies.get("refresh_token")?.value;
    if (token) fwdHeaders["Cookie"] = `refresh_token=${token}`;
  }

  const method = request.method;
  let body: string | undefined;

  if (method !== "GET" && method !== "HEAD") {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = await request.text();
      fwdHeaders["Content-Type"] = "application/json";
    }
  }

  try {
    const backendRes = await fetch(url, { method, headers: fwdHeaders, body });
    const contentType = backendRes.headers.get("Content-Type") || "application/json";
    const text = await backendRes.text();
    const data = text ? JSON.parse(text) : {};

    if (action === "login" || action === "register") {
      const tokenValue = extractRefreshTokenFromBody(data)
        || extractRefreshTokenFromHeaders(backendRes.headers);

      const sanitizedData = { ...data };
      delete sanitizedData.refresh_token;

      const res = NextResponse.json(sanitizedData, { status: backendRes.status });

      if (tokenValue) {
        res.cookies.set("refresh_token", tokenValue, {
          httpOnly: true,
          secure: IS_PRODUCTION,
          sameSite: "lax",
          path: "/",
          maxAge: REFRESH_COOKIE_MAX_AGE,
        });
      } else {
        console.error("[auth-proxy] login/register 响应中未找到 refresh_token，无法设置 cookie");
      }
      return res;
    }

    const res = new NextResponse(text, {
      status: backendRes.status,
      headers: { "Content-Type": contentType },
    });

    if (action === "logout") {
      res.cookies.set("refresh_token", "", {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }

    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    console.error("[auth-proxy] 后端请求失败", { action, backend, message });
    return NextResponse.json({ detail: `后端服务不可用: ${message}` }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyAuthRequest(req, path);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyAuthRequest(req, path);
}