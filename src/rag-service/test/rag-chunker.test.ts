import assert from 'node:assert/strict';
import test from 'node:test';
import { RagChunker } from '../src/rag-chunker.js';

test('空文本返回空数组', () => {
  assert.deepEqual(new RagChunker().chunk(''), []);
});

test('短文本切成单块，content_hash 为 sha256', () => {
  const chunks = new RagChunker().chunk('这是招标文件的正文内容。');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].content, '这是招标文件的正文内容。');
  assert.equal(chunks[0].chunk_type, 'text');
  assert.equal(chunks[0].content_hash.length, 64);
});

test('标题触发分块并记录 section_path', () => {
  const body1 = '第一条 招标人 '.repeat(20);
  const body2 = '第二条 投标人 '.repeat(20);
  const text = `# 第一章 总则\n\n${body1}\n\n# 第二章 投标\n\n${body2}`;
  const chunks = new RagChunker().chunk(text);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].section_path, '# 第一章 总则');
  assert.equal(chunks[1].section_path, '# 第二章 投标');
});

test('超长内容按窗口切分且每块不超过 chunk_size', () => {
  const chunker = new RagChunker(100, 20, 50);
  const chunks = chunker.chunk('a'.repeat(250));
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) {
    assert.ok(chunk.content.length <= 100, `块过长: ${chunk.content.length}`);
  }
});

test('过短尾块合并到前一块', () => {
  const chunker = new RagChunker(200, 50, 80);
  const text = 'a'.repeat(150) + '\n\n# 标题\n\n短尾内容';
  const chunks = chunker.chunk(text);
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].content.includes('短尾内容'));
});

test('表格页标记设置 chunk_type 和页码', () => {
  const text = '--- 第 1 页文本 ---\n\n普通内容\n\n--- 第 2 页表格 ---\n\n| 表头 | 数据 |';
  const chunks = new RagChunker(1000, 160, 0).chunk(text);
  const tableChunk = chunks.find((c) => c.chunk_type === 'table');
  assert.ok(tableChunk, '应存在表格类型 chunk');
  assert.equal(tableChunk.page_start, 2);
});

test('content_hash 确定性', () => {
  const text = '同一段内容';
  const a = new RagChunker().chunk(text)[0].content_hash;
  const b = new RagChunker().chunk(text)[0].content_hash;
  assert.equal(a, b);
});

test('overlap >= chunk_size 抛错', () => {
  assert.throws(() => new RagChunker(100, 100, 50), /chunk_overlap/);
});
