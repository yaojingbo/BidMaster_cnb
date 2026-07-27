---
name: coding
description: This skill should be used when implementing application code following established architecture and specifications. It covers coding standards, TypeScript best practices, React component patterns, API implementation, security coding practices, and error handling.
depends:
  - real.md
  - cog.md
generates:
  - spec-coding.md
---

> **Note for AI Agents**: This skill generates specification documents for AI/Agent consumption (especially Claude Code). Before generating specs, you MUST load context from `real.md` and `cog.md`. If these files don't exist, invoke the `meta-42cog` skill first to create them.

## Prerequisites

### Pre-execution Checklist

Before using this skill, verify:

1. **real.md exists** - Contains reality constraints (max 4 required + 3 optional)
2. **cog.md exists** - Contains cognitive model (Agents + Information + Context)

If either file is missing, execute:
```
Invoke skill: meta-42cog
```

### Context Loading

From `cog.md`, extract:
- **Agent capabilities**: What each agent type can do (affects API authorization)
- **Information structures**: Data shapes for type definitions
- **Context boundaries**: Integration points requiring special handling

From `real.md`, extract:
- **Security constraints**: Password hashing (bcrypt), encryption (AES-256-GCM)
- **Data handling rules**: JSONB format, file upload restrictions
- **Authorization rules**: Resource ownership, role-based access

# Coding Implementation

## Overview

This skill guides the implementation of application code following established architecture and specifications. To write high-quality code, follow coding standards, apply TypeScript best practices, implement secure patterns, and handle errors gracefully.

## When to Use This Skill

- Implementing features from user stories
- Writing React components and hooks
- Creating API routes and server actions
- Implementing security-sensitive code
- Refactoring existing code

## Process

### Phase 1: Understand Context

Before writing code:

1. **Read specifications**
   - Check relevant spec documents
   - Understand acceptance criteria
   - Note constraints from real.md

2. **Review architecture**
   - Understand where code fits
   - Identify affected components
   - Check existing patterns

3. **Plan implementation**
   - Break into small steps
   - Identify dependencies
   - Consider edge cases

### Phase 2: Apply Coding Standards

**File Organization:**

| File Type | Location | Naming |
|-----------|----------|--------|
| Pages | app/*/page.tsx | lowercase |
| API Routes | app/api/*/route.ts | lowercase |
| Components | components/*.tsx | PascalCase |
| Hooks | hooks/use*.ts | camelCase |
| Utilities | lib/*.ts | camelCase |
| Services | services/*.service.ts | camelCase |
| Types | types/*.ts | camelCase |

**Naming Conventions:**

```typescript
// Variables and functions: camelCase
const userData = await fetchUser();
function calculateTotal(items: Item[]) {}

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_COUNT = 3;

// Types and interfaces: PascalCase
interface UserProfile {}
type MessageRole = 'user' | 'assistant';

// Components: PascalCase
function ChatMessage({ content }: Props) {}
```

**Import Organization:**

```typescript
// 1. External libraries
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// 2. Internal modules (absolute paths)
import { db } from '@/lib/db';
import { ChatMessage } from '@/components/chat';

// 3. Types
import type { User, Message } from '@/types';

// 4. Styles (if any)
import styles from './styles.module.css';
```

### Phase 3: TypeScript Best Practices

**Type Safety:**

```typescript
// Use explicit types for function parameters and returns
async function getUser(id: string): Promise<User | null> {
  return db.query.users.findFirst({
    where: eq(users.id, id)
  });
}

// Use union types for constrained values
type Role = 'user' | 'admin';
type Status = 'pending' | 'active' | 'disabled';

// Prefer interface for objects
interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

// Use type for unions and intersections
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

**Avoid Anti-patterns:**

```typescript
// BAD: Using any
function process(data: any) { }

// GOOD: Use unknown and narrow
function process(data: unknown) {
  if (isValidData(data)) {
    // data is now typed
  }
}

// BAD: Type assertion without validation
const user = data as User;

// GOOD: Validate then use
const user = validateUser(data);
if (!user) throw new Error('Invalid user data');
```

### Phase 4: React Component Patterns

**Component Structure:**

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
        <button onClick={onRetry}>Retry</button>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
```

**Custom Hooks:**

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
        throw new Error('Failed to send message');
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

### Phase 5: API Route Implementation

**API Route Pattern:**

```typescript
// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { chatService } from '@/services/chat.service';
import { createConversationSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Execute business logic
    const conversations = await chatService.getConversations(session.userId);

    // 3. Return response
    return NextResponse.json({ data: conversations });
  } catch (error) {
    console.error('GET /api/conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Validate input
    const body = await request.json();
    const validatedData = createConversationSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validatedData.error },
        { status: 400 }
      );
    }

    // 3. Execute business logic
    const conversation = await chatService.createConversation(
      session.userId,
      validatedData.data
    );

    // 4. Return response
    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    console.error('POST /api/conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Phase 6: Security Coding Practices

**Password Handling (bcrypt):**

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

**API Key Encryption (AES-256-GCM):**

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

**Resource Ownership Validation:**

```typescript
// Ensure user can only access their own data
async function getConversation(userId: string, conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.userId, userId)  // Always check ownership
    )
  });
  
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }
  
  return conversation;
}
```

### Phase 7: Error Handling

**Error Classes:**

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
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

**Error Handling in API:**

```typescript
import { AppError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    // ... business logic
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Quality Checklist

- [ ] Code follows project conventions
- [ ] TypeScript strict mode passes
- [ ] No `any` types without justification
- [ ] Components are properly typed
- [ ] API routes validate input
- [ ] Authentication checked where needed
- [ ] Resource ownership validated
- [ ] Passwords use bcrypt
- [ ] API keys are encrypted
- [ ] Errors are handled gracefully
- [ ] Console.error for unexpected errors only

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| system-architecture | Input: provides structure |
| database-design | Input: provides schema |
| user-story | Input: provides requirements |
| quality-assurance | Output: code to be tested |
