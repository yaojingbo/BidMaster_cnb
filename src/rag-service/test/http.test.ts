import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import test from 'node:test';
import { createHttpServer } from '../src/http.js';
import { InMemoryVectorStore } from '../src/vector-store.js';

const userId = '123e4567-e89b-12d3-a456-426614174000';
async function runningServer(ready = true) {
  const server = createHttpServer({
    token: 'secret',
    vectorStore: new InMemoryVectorStore(),
    readiness: () => ({ neon: ready, embedding: ready, zilliz: ready }),
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  return { server, port: address.port };
}
async function get(port: number, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = request({ port, host: '127.0.0.1', path, headers }, (response) => {
      let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(body) }));
    }); req.on('error', reject); req.end();
  });
}
test('live endpoint is public and returns JSON', async () => {
  const { server, port } = await runningServer(); try { const result = await get(port, '/internal/v1/health/live'); assert.equal(result.status, 200); assert.equal(result.body.success, true); } finally { server.close(); }
});
test('ready endpoint reports unavailable state', async () => {
  const { server, port } = await runningServer(false); try {
    const result = await get(port, '/internal/v1/health/ready');
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'SERVICE_NOT_READY');
    assert.deepEqual(result.body.data, { checks: { neon: false, embedding: false, zilliz: false } });
  } finally { server.close(); }
});
test('protected routes validate token, user, and request id', async () => {
  const { server, port } = await runningServer(); try {
    assert.equal((await get(port, '/internal/v1/knowledge-bases')).status, 401);
    assert.equal((await get(port, '/internal/v1/knowledge-bases', {
      Authorization: 'Bearer secret',
      'X-Authenticated-User-Id': userId,
    })).status, 400);
    const result = await get(port, '/internal/v1/knowledge-bases', {
      Authorization: 'Bearer secret',
      'X-Authenticated-User-Id': 'smoke-user',
      'X-Request-Id': 'req-1',
    });
    assert.equal(result.status, 404); assert.equal(result.body.success, false); assert.equal(result.body.request_id, 'req-1');
  } finally { server.close(); }
});
