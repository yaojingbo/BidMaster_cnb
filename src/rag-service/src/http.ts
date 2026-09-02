import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { KnowledgeBaseHttpController } from './knowledge-base-controller.js';
import { KnowledgeBaseHttpError } from './knowledge-base-controller.js';
import type { VectorStore } from './vector-store.js';

const LIVE_PATH = '/internal/v1/health/live';
const READY_PATH = '/internal/v1/health/ready';
const KNOWLEDGE_BASES_PATH = '/internal/v1/knowledge-bases';
const USER_ID = 'x-authenticated-user-id';
const REQUEST_ID = 'x-request-id';
const MAX_JSON_BYTES = 64 * 1024;

export type ReadinessReport = Record<string, boolean>;
export type ServiceDependencies = {
  vectorStore: VectorStore;
  knowledgeBases?: KnowledgeBaseHttpController;
  readiness?: () => ReadinessReport | Promise<ReadinessReport>;
};
export type ServerOptions = ServiceDependencies & { token: string };

export function createHttpServer(options: ServerOptions): Server {
  return createServer(async (request, response) => {
    const suppliedRequestId = header(request.headers, REQUEST_ID);
    const requestId = suppliedRequestId && isRequestId(suppliedRequestId) ? suppliedRequestId : randomUUID();
    response.setHeader('X-Request-Id', requestId);
    try {
      const url = new URL(request.url ?? '/', 'http://rag.internal');
      if (url.pathname === LIVE_PATH && request.method === 'GET') {
        return sendJson(response, 200, { success: true, data: { status: 'live' }, request_id: requestId });
      }
      if (url.pathname === READY_PATH && request.method === 'GET') {
        const checks = await (options.readiness?.() ?? { service: true });
        const ready = Object.values(checks).every(Boolean);
        return sendJson(response, ready ? 200 : 503, ready
          ? { success: true, data: { status: 'ready', checks }, request_id: requestId }
          : { ...errorBody('SERVICE_NOT_READY', '服务尚未就绪', requestId, true), data: { checks } });
      }
      const authError = validateInternalHeaders(request.headers, options.token, suppliedRequestId ?? '', requestId);
      if (authError) return sendJson(response, authError.status, authError.body);
      const userId = header(request.headers, USER_ID)!;
      if (options.knowledgeBases) {
        const handled = await handleKnowledgeBaseRoute(
          request,
          response,
          url,
          requestId,
          userId,
          options.knowledgeBases,
        );
        if (handled) return;
      }
      return sendJson(response, 404, errorBody('NOT_FOUND', '请求路径不存在', requestId, false));
    } catch (error) {
      if (error instanceof KnowledgeBaseHttpError) {
        return sendJson(response, error.status, errorBody(error.code, error.message, requestId, error.retryable));
      }
      return sendJson(response, 500, errorBody('INTERNAL_ERROR', '服务内部错误', requestId, true));
    }
  });
}

async function handleKnowledgeBaseRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  requestId: string,
  userId: string,
  controller: KnowledgeBaseHttpController,
): Promise<boolean> {
  if (url.pathname === KNOWLEDGE_BASES_PATH) {
    if (request.method === 'GET') {
      const data = await controller.list(userId, url.searchParams.get('search') ?? '');
      sendJson(response, 200, successBody(data, requestId));
      return true;
    }
    if (request.method === 'POST') {
      const data = await controller.create(userId, await readJson(request));
      sendJson(response, 201, successBody(data, requestId));
      return true;
    }
    return false;
  }

  const match = url.pathname.match(/^\/internal\/v1\/knowledge-bases\/([^/]+)$/);
  if (!match) return false;
  const knowledgeBaseId = decodeURIComponent(match[1]);
  if (request.method === 'GET') {
    sendJson(response, 200, successBody(await controller.detail(knowledgeBaseId, userId), requestId));
    return true;
  }
  if (request.method === 'PATCH') {
    sendJson(response, 200, successBody(
      await controller.update(knowledgeBaseId, userId, await readJson(request)),
      requestId,
    ));
    return true;
  }
  if (request.method === 'DELETE') {
    await controller.delete(knowledgeBaseId, userId);
    sendJson(response, 200, {
      success: true,
      message: '知识库已删除，原始文件保持不变',
      request_id: requestId,
    });
    return true;
  }
  return false;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = header(request.headers, 'content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new KnowledgeBaseHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', '请求必须使用 JSON 格式');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_JSON_BYTES) {
      throw new KnowledgeBaseHttpError(413, 'PAYLOAD_TOO_LARGE', '请求内容过大');
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new KnowledgeBaseHttpError(400, 'INVALID_JSON', 'JSON 请求内容无效');
  }
}

type ErrorResponse = { status: number; body: Record<string, unknown> };
function validateInternalHeaders(
  headers: IncomingHttpHeaders,
  token: string,
  suppliedRequestId: string,
  responseRequestId: string,
): ErrorResponse | undefined {
  if (!hasValidToken(header(headers, 'authorization'), token)) {
    return { status: 401, body: errorBody('UNAUTHORIZED', '服务间认证失败', responseRequestId, false) };
  }
  const userId = header(headers, USER_ID);
  if (!userId || !isUserId(userId)) {
    return { status: 400, body: errorBody('INVALID_USER_ID', '认证用户标识无效', responseRequestId, false) };
  }
  if (!isRequestId(suppliedRequestId)) {
    return { status: 400, body: errorBody('INVALID_REQUEST_ID', '请求标识无效', responseRequestId, false) };
  }
  return undefined;
}
function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] : value;
}
function hasValidToken(authorization: string | undefined, token: string): boolean {
  if (!authorization?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function isUserId(value: string): boolean { return value.length <= 64 && /^[A-Za-z0-9._:-]+$/.test(value); }
function isRequestId(value: string): boolean { return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value); }
function successBody(data: Record<string, unknown>, requestId: string): Record<string, unknown> {
  return { success: true, data, request_id: requestId };
}
function errorBody(code: string, message: string, requestId: string, retryable: boolean): Record<string, unknown> {
  return { success: false, code, message, request_id: requestId, retryable };
}
function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
export function startServer(options: ServerOptions & { host?: string; port?: number }): Server {
  const server = createHttpServer(options); server.listen(options.port ?? 8100, options.host ?? '127.0.0.1'); return server;
}
