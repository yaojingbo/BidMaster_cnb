# Mock 数据示例

本文档提供聊天应用的 Mock 数据示例，可根据具体应用类型调整。

## Mock 对话数据

```typescript
// data/mock/conversations.ts
export const MOCK_CONVERSATIONS = [
  // 1. 最近活跃对话（多消息）
  {
    id: 'conv-1',
    title: 'TypeScript 类型体操技巧讨论',
    modelId: 'mock-gpt-4',
    createdAt: '2025-12-10T10:00:00Z',
    updatedAt: '2025-12-11T09:30:00Z',
    messages: [
      { id: 'msg-1', role: 'user', content: '能解释一下 TypeScript 的泛型吗？' },
      { id: 'msg-2', role: 'assistant', content: '泛型是 TypeScript 中非常强大的特性...' },
    ],
  },
  // 2. 短对话
  { id: 'conv-2', title: '你好', modelId: 'mock-gpt-4', messages: [] },
  // 3. 长标题
  { id: 'conv-3', title: '关于 React Server Components 和 Client Components 的最佳实践探讨', messages: [] },
  // 4. 代码块对话
  { id: 'conv-4', title: '帮我写一个排序算法', modelId: 'mock-claude', messages: [] },
  // 5. 不同模型
  { id: 'conv-5', title: '用 Claude 分析代码', modelId: 'mock-claude', messages: [] },
  // 6-8. 更多对话...
  { id: 'conv-6', title: 'API 设计讨论', messages: [] },
  { id: 'conv-7', title: '性能优化方案', messages: [] },
  { id: 'conv-8', title: '数据库选型', messages: [] },
  // 9. 已归档
  { id: 'conv-9', title: '旧项目讨论（已归档）', archived: true, messages: [] },
  // 10. 很久以前
  { id: 'conv-10', title: '去年的对话', createdAt: '2024-06-15T10:00:00Z', messages: [] },
]
```

## Mock 消息内容示例

```typescript
// 包含各种内容类型的消息
const MESSAGE_EXAMPLES = {
  // 简短问候
  greeting: { role: 'assistant', content: '你好！有什么我可以帮助你的吗？' },

  // Markdown 格式长回复
  markdown: {
    role: 'assistant',
    content: `# 标题

这是一段**加粗**和*斜体*文字。

## 列表
1. 第一项
2. 第二项

> 引用文字
`,
  },

  // 代码块
  code: {
    role: 'assistant',
    content: `好的，这是示例代码：

\`\`\`typescript
function example<T>(arg: T): T {
  return arg;
}
\`\`\`

这段代码展示了泛型的基本用法。`,
  },
}
```

## Mock 模型配置

```typescript
// data/mock/models.ts
export const MOCK_MODELS = [
  {
    id: 'mock-gpt-4',
    provider: 'openai',
    modelId: 'gpt-4',
    name: 'GPT-4（演示）',
    apiKey: '',  // 空 = Mock 模式
    enabled: true,
    isMock: true,
  },
  {
    id: 'mock-claude',
    provider: 'anthropic',
    modelId: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet（演示）',
    apiKey: '',
    enabled: true,
    isMock: true,
  },
]

export const DEFAULT_MODEL_ID = 'mock-gpt-4'
```

## Mock AI 响应生成器

```typescript
// lib/mock/ai-responses.ts
const RESPONSES = [
  '这是一个很好的问题！让我来解释...',
  '根据我的理解，可以从以下几个方面来看...',
  '我来帮你分析一下这个情况...',
]

export async function generateMockResponse(message: string): Promise<string> {
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))

  if (message.includes('代码') || message.includes('code')) {
    return `好的，这是示例代码：\n\n\`\`\`typescript\nfunction example() {\n  console.log('Hello');\n}\n\`\`\``
  }

  return RESPONSES[Math.floor(Math.random() * RESPONSES.length)]
}

// 流式响应
export async function* streamMockResponse(message: string) {
  const response = await generateMockResponse(message)
  for (const char of response) {
    yield char
    await new Promise(r => setTimeout(r, 20 + Math.random() * 30))
  }
}
```
