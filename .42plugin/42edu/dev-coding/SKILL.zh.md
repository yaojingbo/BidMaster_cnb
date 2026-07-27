---
name: coding
description: 本技能用于按照既定架构和规约实现应用代码，涵盖编码规范、TypeScript最佳实践、React组件模式、API实现、安全编码和错误处理。
depends:
  - real.md
  - cog.md
generates:
  - spec-coding.md
---

> **AI智能体注意**：本技能生成供AI/Agent（特别是Claude Code）使用的规约文档。生成规约前，必须从`real.md`和`cog.md`加载上下文。如果这些文件不存在，请先调用`meta-42cog`技能创建它们。

## 前置条件

### 执行前检查清单

使用本技能前，请验证：

1. **real.md存在** - 包含现实约束（最多4条必选 + 3条可选）
2. **cog.md存在** - 包含认知模型（智能体 + 信息 + 上下文）

如果任一文件缺失，请执行：
```
调用技能：meta-42cog
```

### 上下文加载

从`cog.md`中提取：
- **智能体能力**：每种智能体类型可以做什么（影响API授权）
- **信息结构**：用于类型定义的数据形状
- **上下文边界**：需要特殊处理的集成点

从`real.md`中提取：
- **安全约束**：密码哈希（bcrypt）、加密（AES-256-GCM）
- **数据处理规则**：JSONB格式、文件上传限制
- **授权规则**：资源所有权、基于角色的访问

# 编码实现

## 概述

本技能指导按照既定架构和规约实现应用代码。编写高质量代码需要遵循编码规范、应用TypeScript最佳实践、实现安全模式，并优雅地处理错误。

## 适用场景

- 根据用户故事实现功能
- 编写React组件和hooks
- 创建API路由和Server Actions
- 实现安全敏感代码
- 重构现有代码

## 流程

### 阶段一：理解上下文

编写代码前：

1. **阅读规约**
   - 检查相关spec文档
   - 理解验收标准
   - 注意real.md中的约束

2. **审查架构**
   - 理解代码的位置
   - 识别受影响的组件
   - 检查现有模式

3. **规划实现**
   - 分解为小步骤
   - 识别依赖关系
   - 考虑边界情况

### 阶段二：应用编码规范

**文件组织：**

| 文件类型 | 位置 | 命名 |
|----------|------|------|
| 页面 | app/*/page.tsx | 小写 |
| API路由 | app/api/*/route.ts | 小写 |
| 组件 | components/*.tsx | PascalCase |
| Hooks | hooks/use*.ts | camelCase |
| 工具 | lib/*.ts | camelCase |
| 服务 | services/*.service.ts | camelCase |
| 类型 | types/*.ts | camelCase |

**命名规范：**

```typescript
// 变量和函数：camelCase
const userData = await fetchUser();
function calculateTotal(items: Item[]) {}

// 常量：UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_COUNT = 3;

// 类型和接口：PascalCase
interface UserProfile {}
type MessageRole = 'user' | 'assistant';

// 组件：PascalCase
function ChatMessage({ content }: Props) {}
```

**导入组织：**

```typescript
// 1. 外部库
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// 2. 内部模块（绝对路径）
import { db } from '@/lib/db';
import { ChatMessage } from '@/components/chat';

// 3. 类型
import type { User, Message } from '@/types';

// 4. 样式（如有）
import styles from './styles.module.css';
```

### 阶段三：TypeScript最佳实践

**类型安全：**

```typescript
// 为函数参数和返回值使用显式类型
async function getUser(id: string): Promise<User | null> {
  return db.query.users.findFirst({
    where: eq(users.id, id)
  });
}

// 为受限值使用联合类型
type Role = 'user' | 'admin';
type Status = 'pending' | 'active' | 'disabled';

// 对象优先使用interface
interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

// 联合和交叉使用type
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

**避免反模式：**

```typescript
// 错误：使用any
function process(data: any) { }

// 正确：使用unknown并收窄
function process(data: unknown) {
  if (isValidData(data)) {
    // data现在有类型了
  }
}

// 错误：无验证的类型断言
const user = data as User;

// 正确：先验证再使用
const user = validateUser(data);
if (!user) throw new Error('Invalid user data');
```

### 阶段四：React组件模式

**组件结构：**

```typescript
// components/chat/ChatMessage.tsx
import { FC, memo } from 'react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
  onRetry?: () => void;
}

export const ChatMessage: FC<ChatMessageProps> = memo(({
  message,
  isLast = false,
  onRetry,
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'p-4 rounded-lg',
      isUser ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
    )}>
      <div className="prose">
        {message.content}
      </div>
      {isLast && onRetry && (
        <button onClick={onRetry}>重试</button>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
```

**自定义Hooks：**

```typescript
// hooks/useChat.ts
import { useState, useCallback } from 'react';
import type { Message } from '@/types';

interface UseChatOptions {
  conversationId: string;
  onError?: (error: Error) => void;
}

export function useChat({ conversationId, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        throw new Error('发送消息失败');
      }
      
      const data = await response.json();
      setMessages(prev => [...prev, data.message]);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onError]);

  return { messages, isLoading, sendMessage };
}
```

### 阶段五：API路由实现

**API路由模式：**

```typescript
// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { chatService } from '@/services/chat.service';
import { createConversationSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    // 1. 认证
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    // 2. 执行业务逻辑
    const conversations = await chatService.getConversations(session.userId);

    // 3. 返回响应
    return NextResponse.json({ data: conversations });
  } catch (error) {
    console.error('GET /api/conversations 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    // 2. 验证输入
    const body = await request.json();
    const validatedData = createConversationSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: '输入无效', details: validatedData.error },
        { status: 400 }
      );
    }

    // 3. 执行业务逻辑
    const conversation = await chatService.createConversation(
      session.userId,
      validatedData.data
    );

    // 4. 返回响应
    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    console.error('POST /api/conversations 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
```

### 阶段六：安全编码实践

**密码处理（bcrypt）：**

```typescript
// lib/auth/password.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**API密钥加密（AES-256-GCM）：**

```typescript
// lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**资源所有权验证：**

```typescript
// 确保用户只能访问自己的数据
async function getConversation(userId: string, conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.userId, userId)  // 始终检查所有权
    )
  });
  
  if (!conversation) {
    throw new NotFoundError('对话未找到');
  }
  
  return conversation;
}
```

### 阶段七：错误处理

**错误类：**

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源未找到') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未授权') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  constructor(message = '验证失败') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

**API中的错误处理：**

```typescript
import { AppError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    // ... 业务逻辑
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    
    console.error('意外错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
```

## 质量检查清单

- [ ] 代码遵循项目规范
- [ ] TypeScript严格模式通过
- [ ] 没有无理由的`any`类型
- [ ] 组件正确类型化
- [ ] API路由验证输入
- [ ] 需要时检查认证
- [ ] 资源所有权已验证
- [ ] 密码使用bcrypt
- [ ] API密钥已加密
- [ ] 错误优雅处理
- [ ] console.error仅用于意外错误

## 与其他技能的关系

| 技能 | 关系 |
|------|------|
| system-architecture | 输入：提供结构 |
| database-design | 输入：提供模式 |
| user-story | 输入：提供需求 |
| quality-assurance | 输出：待测试的代码 |
