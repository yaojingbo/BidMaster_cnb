import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import test from 'node:test';
import type {
  KnowledgeBaseRepository,
  KnowledgeBaseSummary,
} from '../src/db/knowledge-base-repository.js';
import { createHttpServer } from '../src/http.js';
import { KnowledgeBaseHttpController } from '../src/knowledge-base-controller.js';
import { InMemoryVectorStore } from '../src/vector-store.js';

const token = '12345678901234567890123456789012';
const userId = 'owner-user';
const headers = {
  Authorization: `Bearer ${token}`,
  'X-Authenticated-User-Id': userId,
  'X-Request-Id': 'req-crud-1',
};

class MemoryRepository implements KnowledgeBaseRepository {
  readonly items = new Map<string, KnowledgeBaseSummary & { owner: string }>();
  nextId = 1;

  async create(owner: string, name: string, description: string): Promise<KnowledgeBaseSummary> {
    if ([...this.items.values()].some((item) => item.owner === owner && item.name.toLowerCase() === name.toLowerCase())) {
      const error = new Error('rag_kb_owner_name_uq') as Error & { code?: string };
      error.code = '23505';
      throw error;
    }
    const now = new Date().toISOString();
    const item = {
      id: `kb-${this.nextId++}`,
      owner,
      name,
      description,
      file_count: 0,
      completed_count: 0,
      processing_count: 0,
      failed_count: 0,
      stale_count: 0,
      created_at: now,
      updated_at: now,
    };
    this.items.set(item.id, item);
    return item;
  }

  async list(owner: string, search: string): Promise<KnowledgeBaseSummary[]> {
    return [...this.items.values()].filter((item) => item.owner === owner && item.name.includes(search));
  }

  async get(id: string, owner: string): Promise<KnowledgeBaseSummary | undefined> {
    const item = this.items.get(id);
    return item?.owner === owner ? item : undefined;
  }

  async update(id: string, owner: string, values: { name?: string; description?: string }) {
    const item = this.items.get(id);
    if (!item || item.owner !== owner) return undefined;
    Object.assign(item, values, { updated_at: new Date().toISOString() });
    return item;
  }

  async delete(id: string, owner: string): Promise<boolean> {
    const item = this.items.get(id);
    return Boolean(item?.owner === owner && this.items.delete(id));
  }
}

async function runningServer(repository = new MemoryRepository()) {
  const server = createHttpServer({
    token,
    vectorStore: new InMemoryVectorStore(),
    knowledgeBases: new KnowledgeBaseHttpController(repository),
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  return { server, port: address.port, repository };
}

async function call(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  requestHeaders: Record<string, string> = headers,
) {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port,
      method,
      path,
      headers: {
        ...requestHeaders,
        ...(serialized ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(serialized)) } : {}),
      },
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (serialized) req.write(serialized);
    req.end();
  });
}

test('知识库 CRUD 保持稳定 envelope 和 PATCH 语义', async () => {
  const { server, port } = await runningServer();
  try {
    const created = await call(port, 'POST', '/internal/v1/knowledge-bases', {
      name: '  招标资料  ',
      description: '第一版',
      user_id: 'attacker',
    });
    assert.equal(created.status, 422);

    const valid = await call(port, 'POST', '/internal/v1/knowledge-bases', {
      name: '  招标资料  ',
      description: '第一版',
    });
    assert.equal(valid.status, 201);
    assert.equal((valid.body.data as Record<string, unknown>).name, '招标资料');
    assert.equal(valid.body.request_id, 'req-crud-1');

    const listed = await call(port, 'GET', '/internal/v1/knowledge-bases?search=%E6%8B%9B%E6%A0%87');
    assert.equal(listed.status, 200);
    assert.equal(((listed.body.data as { items: unknown[] }).items).length, 1);

    const updated = await call(port, 'PATCH', '/internal/v1/knowledge-bases/kb-1', { description: '' });
    assert.equal(updated.status, 200);
    assert.equal((updated.body.data as Record<string, unknown>).name, '招标资料');
    assert.equal((updated.body.data as Record<string, unknown>).description, '');

    const detail = await call(port, 'GET', '/internal/v1/knowledge-bases/kb-1');
    assert.deepEqual((detail.body.data as Record<string, unknown>).files, []);

    const deleted = await call(port, 'DELETE', '/internal/v1/knowledge-bases/kb-1');
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.message, '知识库已删除，原始文件保持不变');
    assert.equal((await call(port, 'GET', '/internal/v1/knowledge-bases/kb-1')).status, 404);
  } finally {
    server.close();
  }
});

test('知识库 CRUD 隐藏其他用户资源并返回稳定冲突码', async () => {
  const { server, port } = await runningServer();
  try {
    await call(port, 'POST', '/internal/v1/knowledge-bases', { name: '同名库' });
    const conflict = await call(port, 'POST', '/internal/v1/knowledge-bases', { name: '同名库' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'KNOWLEDGE_BASE_NAME_EXISTS');

    const otherHeaders = { ...headers, 'X-Authenticated-User-Id': 'other-user' };
    assert.equal((await call(port, 'GET', '/internal/v1/knowledge-bases/kb-1', undefined, otherHeaders)).status, 404);
    assert.equal((await call(port, 'PATCH', '/internal/v1/knowledge-bases/kb-1', { name: '越权' }, otherHeaders)).status, 404);
    assert.equal((await call(port, 'DELETE', '/internal/v1/knowledge-bases/kb-1', undefined, otherHeaders)).status, 404);
  } finally {
    server.close();
  }
});

test('知识库写接口拒绝非 JSON 和超大请求', async () => {
  const { server, port } = await runningServer();
  try {
    const unsupported = await call(port, 'POST', '/internal/v1/knowledge-bases', undefined);
    assert.equal(unsupported.status, 415);
    const oversized = await call(port, 'POST', '/internal/v1/knowledge-bases', {
      name: '知识库',
      description: 'x'.repeat(70 * 1024),
    });
    assert.equal(oversized.status, 413);
  } finally {
    server.close();
  }
});
