/**
 * 通用后端 API 代理路由。
 * 认证、提取、模拟编制和开标分析使用各自专用代理；其余后端接口在这里转发。
 */
import { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

export const maxDuration = 300;

const DEDICATED_PROXY_PREFIXES = new Set(["auth", "cli-auth", "extract", "simulate", "statistics", "knowledge"]);

async function proxyRequest(request: NextRequest, segments: string[]) {
  const prefix = segments[0];
  if (DEDICATED_PROXY_PREFIXES.has(prefix)) {
    return new Response(JSON.stringify({ detail: "接口由专用代理处理" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const path = segments.join("/");
  const backend = getBackendUrl();
  const url = new URL(`${backend}/api/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {};
  const auth = request.headers.get("Authorization");
  if (auth) headers.Authorization = auth;

  const contentType = request.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const backendRes = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const responseHeaders = new Headers();
    const backendContentType = backendRes.headers.get("Content-Type");
    if (backendContentType) responseHeaders.set("Content-Type", backendContentType);

    const disposition = backendRes.headers.get("Content-Disposition");
    if (disposition) responseHeaders.set("Content-Disposition", disposition);

    const payload = await backendRes.arrayBuffer();

    return new Response(payload, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    console.error("[api-proxy] 后端请求失败", { path, backend, message });
    return new Response(JSON.stringify({ detail: `后端服务不可用: ${message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}
