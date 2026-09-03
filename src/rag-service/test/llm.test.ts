import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRagPrompt } from '../src/llm.js';

test('buildRagPrompt 组装提示词包含片段与问题', () => {
  const { system, user } = buildRagPrompt(['片段甲内容', '片段乙内容'], '台州市招标文件规律');
  assert.match(system, /只依据提供的文档片段/);
  assert.match(user, /台州市招标文件规律/);
  assert.match(user, /片段甲内容/);
  assert.match(user, /片段乙内容/);
  assert.match(user, /\[片段1\]/);
  assert.match(user, /\[片段2\]/);
});

test('buildRagPrompt 无片段时标注（无）', () => {
  const { user } = buildRagPrompt([], '问题');
  assert.match(user, /（无）/);
});
