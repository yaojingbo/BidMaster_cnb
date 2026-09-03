import assert from 'node:assert/strict';
import test from 'node:test';
import { MilvusFilterTranslator } from '../src/vector/milvus-filter-translator.js';

const translator = new MilvusFilterTranslator();

test('空过滤器返回空串', () => {
  assert.equal(translator.translate(null), '');
  assert.equal(translator.translate(undefined), '');
  assert.equal(translator.translate({}), '');
});

test('等值简写', () => {
  assert.equal(translator.translate({ user_id: 'u1' }), 'user_id == "u1"');
});

test('比较操作符', () => {
  assert.equal(translator.translate({ user_id: { $eq: 'u1' } }), 'user_id == "u1"');
  assert.equal(translator.translate({ status: { $ne: 'active' } }), 'status != "active"');
  assert.equal(translator.translate({ score: { $gte: 0.8 } }), 'score >= 0.8');
  assert.equal(translator.translate({ age: { $lt: 10 } }), 'age < 10');
});

test('同一字段多操作符合并为 AND', () => {
  assert.equal(
    translator.translate({ score: { $gte: 0.5, $lte: 0.9 } }),
    '(score >= 0.5 && score <= 0.9)',
  );
});

test('$in / $nin', () => {
  assert.equal(translator.translate({ file_id: { $in: ['f1', 'f2'] } }), 'file_id in ["f1", "f2"]');
  assert.equal(translator.translate({ file_id: { $nin: ['f3'] } }), 'file_id not in ["f3"]');
});

test('逻辑 $and / $or', () => {
  assert.equal(
    translator.translate({ $and: [{ user_id: 'u1' }, { index_version: 'v3' }] }),
    '(user_id == "u1" && index_version == "v3")',
  );
  assert.equal(
    translator.translate({ $or: [{ a: 1 }, { b: 2 }] }),
    '(a == 1 || b == 2)',
  );
});

test('顶层多字段默认 AND 连接', () => {
  assert.equal(
    translator.translate({ user_id: 'u1', index_version: 'v3' }),
    'user_id == "u1" && index_version == "v3"',
  );
});

test('字符串转义', () => {
  assert.equal(translator.translate({ text: 'a"b\\c' }), 'text == "a\\"b\\\\c"');
});

test('不支持的操作符抛错', () => {
  assert.throws(() => translator.translate({ name: { $regex: '^台州' } }), /不支持的操作符: \$regex/);
  assert.throws(() => translator.translate({ $not: { a: 1 } }), /不支持的操作符: \$not/);
});

test('非法字段名抛错（防表达式注入）', () => {
  assert.throws(() => translator.translate({ 'user_id OR 1==1': 'u1' }), /非法的字段名/);
  assert.throws(() => translator.translate({ 'a b': 1 }), /非法的字段名/);
  assert.throws(() => translator.translate({ 'field) OR (1': 1 }), /非法的字段名/);
});
