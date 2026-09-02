import { NextRequest } from 'next/server';
import { getBackendUrl } from '@/lib/server/backend-url';

export const maxDuration = 300;

async function proxyRequest(request: NextRequest, segments: string[]) {
  const backendUrl = new URL(`${getBackendUrl()}/api/${segments.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => backendUrl.searchParams.append(key, value));

  const headers = new Headers();
  for (const name of ['Authorization', 'Content-Type', 'Accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();

  try {
    const backendResponse = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });
    const contentType = backendResponse.headers.get('Content-Type') || 'application/json';
    if (contentType.includes('text/event-stream') && backendResponse.body) {
      return new Response(backendResponse.body, {
        status: backendResponse.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }
    return new Response(await backendResponse.arrayBuffer(), {
      status: backendResponse.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return Response.json({ detail: `后端服务不可用：${message}` }, { status: 502 });
  }
}

type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Context) { return proxyRequest(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Context) { return proxyRequest(req, (await ctx.params).path); }
export async function PATCH(req: NextRequest, ctx: Context) { return proxyRequest(req, (await ctx.params).path); }
export async function DELETE(req: NextRequest, ctx: Context) { return proxyRequest(req, (await ctx.params).path); }
