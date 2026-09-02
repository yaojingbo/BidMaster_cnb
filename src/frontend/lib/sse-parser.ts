export interface ParsedSseEvent {
  event: string;
  data: string;
}

export function parseSseBlock(block: string): ParsedSseEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return data.length ? { event, data: data.join('\n') } : null;
}

export async function consumeSse(
  response: Response,
  onEvent: (event: ParsedSseEvent) => void
): Promise<void> {
  if (!response.body) throw new Error('流式响应为空');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) onEvent(event);
    }
    if (done) break;
  }
  const last = parseSseBlock(buffer);
  if (last) onEvent(last);
}
