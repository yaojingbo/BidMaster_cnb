/**
 * Statistics SSE 代理路由。
 * 与 extract 代理同理，确保 SSE 流式响应不被 Next.js rewrite 缓冲。
 */
import { NextRequest } from "next/server";
import { getBackendUrl } from "@/lib/server/backend-url";

// 开标分析 LLM 调用耗时较长
export const maxDuration = 300;

async function proxyRequest(request: NextRequest, segments: string[]) {
  const path = segments.join("/");
  const backend = getBackendUrl();
  const url = new URL(`${backend}/api/statistics/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  const method = request.method;

  const headers: Record<string, string> = {};
  const auth = request.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;

  const contentType = request.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const backendRes = await fetch(url, { method, headers, body } as RequestInit);

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
