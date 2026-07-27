import { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

export const maxDuration = 300;

async function proxyRequest(request: NextRequest, segments: string[]) {
  const path = segments.join("/");
  const backend = getBackendUrl();
  const url = new URL(`${backend}/api/cli-auth/${path}`);
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

    const payload = await backendRes.arrayBuffer();

    return new Response(payload, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    console.error("[cli-auth-proxy] 后端请求失败", { path, backend, message });
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
