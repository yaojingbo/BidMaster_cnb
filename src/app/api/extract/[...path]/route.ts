/**
 * Extract SSE 代理路由。
 * Next.js rewrites 不支持 SSE 流式转发，此 API Route 手动代理请求，
 * 确保 text/event-stream 响应逐块流式返回给浏览器。
 */
import { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

// LLM 提取可能需要 1-3 分钟，代理超时需覆盖完整处理过程
export const maxDuration = 300;

async function proxyRequest(request: NextRequest, segments: string[]) {
  const path = segments.join("/");
  const backend = getBackendUrl();
  const url = `${backend}/api/extract/${path}`;
  const method = request.method;

  const headers: Record<string, string> = {};
  const auth = request.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.text();
    headers["Content-Type"] = "application/json";
  }

  try {
    const backendRes = await fetch(url, { method, headers, body } as RequestInit);

    // SSE 流式转发
    if (backendRes.headers.get("Content-Type")?.includes("text/event-stream")) {
      if (!backendRes.body) {
        return new Response(null, { status: backendRes.status });
      }

      const reader = backendRes.body.getReader();
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          } catch {
            controller.close();
          }
        },
        cancel() {
          reader.cancel();
        },
      });

      return new Response(stream, {
        status: backendRes.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // 常规 JSON 响应
    const data = await backendRes.text();
    return new Response(data, {
      status: backendRes.status,
      headers: { "Content-Type": backendRes.headers.get("Content-Type") || "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ detail: "后端服务不可用" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}
