import { describe, expect, it } from 'vitest';
import { parseSseBlock } from '@/lib/sse-parser';

describe('SSE 解析', () => {
  it('解析事件名称和 JSON 数据', () => {
    expect(parseSseBlock('event: content\ndata: {"text":"你好"}')).toEqual({
      event: 'content',
      data: '{"text":"你好"}',
    });
  });

  it('支持多行 data', () => {
    expect(parseSseBlock('event: message\ndata: 第一行\ndata: 第二行')).toEqual({
      event: 'message',
      data: '第一行\n第二行',
    });
  });
});
