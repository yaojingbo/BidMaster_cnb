import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeFileId } from '../src/index-docs.js';

test('sanitizeFileId 去掉扩展名并保留中文', () => {
  assert.equal(sanitizeFileId('01_天台平桥污水厂.md'), '01_天台平桥污水厂');
});

test('sanitizeFileId 清洗空白与路径分隔符', () => {
  assert.equal(sanitizeFileId('test file (1).md'), 'test_file_(1)');
  assert.equal(sanitizeFileId('a/b\\c.md'), 'a_b_c');
});

test('sanitizeFileId 空名回退 unnamed', () => {
  assert.equal(sanitizeFileId('.md'), 'unnamed');
});
