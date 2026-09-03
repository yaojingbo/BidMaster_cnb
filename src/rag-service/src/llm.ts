import type { RagConfig } from './config.js';

/** 组装 RAG 问答提示词（纯函数，导出供单测） */
export function buildRagPrompt(contexts: string[], question: string): { system: string; user: string } {
  const contextBlock = contexts.map((text, index) => `[片段${index + 1}]\n${text}`).join('\n\n');
  return {
    system: '你是招投标文件问答助手。只依据提供的文档片段回答；若片段不足以回答，请明确说明未找到足够依据。',
    user: `问题：${question}\n\n参考文档片段：\n${contextBlock || '（无）'}\n\n请把相关片段整合成一段通顺、准确的回答。`,
  };
}

/** 用 DashScope qwen（OpenAI 兼容 chat/completions）把检索片段整合成回答 */
export async function synthesizeAnswer(contexts: string[], question: string, config: RagConfig): Promise<string> {
  const { system, user } = buildRagPrompt(contexts, question);
  const url = `${config.DASHSCOPE_EMBEDDING_BASE_URL}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.RAG_LLM_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`DashScope chat 失败: HTTP ${response.status}`);
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('DashScope chat 响应缺少 content');
  return content;
}
