# Coding Implementation Specification: Bid Master Web

<meta>
  <document-id>bid-master-coding-spec</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>Coding Implementation Specification</type>
  <created>2026-05-10</created>
  <depends>real.md, cog.md, sys.spec.md, db.spec.md, ui.spec.md</depends>
</meta>

---

## 1. Project Structure

### 1.1 Directory Organization

```
bid-master-web/
├── app/                            # Next.js 15 App Router 页面
│   ├── (main)/                    # 主布局组
│   │   ├── page.tsx              # 首页
│   │   ├── layout.tsx            # 侧边栏布局
│   │   ├── extract/
│   │   │   └── page.tsx          # 要素提取
│   │   ├── database/
│   │   │   └── page.tsx          # 数据管理
│   │   ├── settings/
│   │   │   └── page.tsx          # AI 设置
│   │   ├── simulate/
│   │   │   └── page.tsx          # 模拟编制
│   │   └── statistics/
│   │       └── page.tsx          # 开标分析
│   ├── layout.tsx                 # 根布局
│   └── globals.css               # 全局样式 + Markdown 输出样式
│
├── src/                            # 全部源代码
│   ├── db/                        # 数据库：Drizzle Schema + TypeScript 类型
│   │   ├── schema.ts
│   │   └── types.ts
│   │
│   ├── frontend/                  # 前端共享模块
│   │   ├── components/            # React 组件
│   │   │   ├── ui/               # shadcn/ui 基础组件
│   │   │   ├── file-upload/      # 文件上传组件
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   ├── FileList.tsx
│   │   │   │   └── FileRow.tsx
│   │   │   ├── extract/          # 要素提取组件
│   │   │   │   ├── ElementCard.tsx
│   │   │   │   ├── ElementList.tsx
│   │   │   │   └── StreamViewer.tsx
│   │   │   ├── database/         # 数据管理组件
│   │   │   │   ├── DatabasePanel.tsx
│   │   │   │   └── FileActions.tsx
│   │   │   └── layout/           # 布局组件
│   │   │       └── Header.tsx
│   │   ├── lib/                  # 前端工具库（@/lib/* 解析到此）
│   │   │   ├── api.ts            # API 调用
│   │   │   ├── data-api.ts       # 数据管理 API
│   │   │   ├── utils.ts          # 工具函数 (cn, formatFileSize)
│   │   │   ├── crypto.ts         # 加密工具
│   │   │   ├── errors.ts         # 错误类型
│   │   │   └── validations/      # Zod 验证 schemas
│   │   ├── stores/               # Zustand Stores
│   │   │   ├── app-store.ts
│   │   │   ├── file-store.ts
│   │   │   ├── extract-store.ts
│   │   │   ├── database-store.ts
│   │   │   └── settings-store.ts
│   │   ├── hooks/                # 自定义 Hooks
│   │   │   ├── useFileUpload.ts
│   │   │   ├── useStreamExtract.ts
│   │   │   └── useDownload.ts
│   │   ├── types/                # 类型定义
│   │   │   └── index.ts
│   │   └── data/                 # Mock 数据
│   │       └── mock/
│   │           ├── providers.ts
│   │           ├── files.ts
│   │           └── extract-responses.ts
│   │
│   └── backend/                  # FastAPI 后端（Python）
│       ├── app/
│       │   ├── main.py           # FastAPI 入口
│       │   ├── config.py         # 配置管理
│       │   ├── dependencies.py    # 依赖注入
│       │   ├── api/              # API 路由
│       │   │   ├── files.py
│       │   │   ├── extract.py
│       │   │   ├── settings.py
│       │   │   ├── database.py
│       │   │   └── health.py
│       │   ├── services/         # 业务逻辑
│       │   │   ├── file_service.py
│       │   │   ├── extract_service.py
│       │   │   ├── llm_service.py
│       │   │   └── encryption_service.py
│       │   ├── models/           # Pydantic 模型
│       │   │   └── schemas.py
│       │   ├── infrastructure/   # 基础设施
│       │   │   ├── database.py
│       │   │   ├── storage.py
│       │   │   └── llm/
│       │   │       └── lite_llm.py
│       │   └── utils/            # 工具函数
│       │       ├── crypto.py
│       │       └── exceptions.py
│       ├── requirements.txt
│       └── pyproject.toml
│
├── package.json                  # 前端依赖（根目录）
├── next.config.js               # Next.js 配置
├── drizzle.config.ts           # Drizzle 配置
├── tsconfig.json               # TypeScript 配置
│
└── .42cog/                     # 规约文档 + 认知敏捷文档
```

---

## 2. File Naming Conventions

### 2.1 Frontend (Next.js)

| File Type | Convention | Example |
|-----------|------------|---------|
| Pages | `kebab-case/page.tsx` | `extract/page.tsx` |
| API Routes | `kebab-case/route.ts` | `files/route.ts` |
| Components | `PascalCase.tsx` | `FileUploader.tsx` |
| Hooks | `camelCase.ts` | `useFileUpload.ts` |
| Stores | `camelCase.ts` | `fileStore.ts` |
| Utils | `camelCase.ts` | `apiClient.ts` |
| Types | `camelCase.ts` | `apiTypes.ts` |
| Constants | `UPPER_SNAKE_CASE.ts` | `API_CONSTANTS.ts` |

### 2.2 Backend (FastAPI)

| File Type | Convention | Example |
|-----------|------------|---------|
| Routers | `snake_case.py` | `files.py` |
| Services | `snake_case_service.py` | `file_service.py` |
| Models | `schemas.py` | Pydantic models |
| Utils | `snake_case.py` | `crypto.py` |

---

## 3. TypeScript Best Practices

### 3.1 Type Definitions

```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

// 类型守卫
export function isApiResponse<T>(obj: unknown): obj is ApiResponse<T> {
  if (!obj || typeof obj !== 'object') return false
  const resp = obj as Record<string, unknown>
  return 'success' in resp && typeof resp.success === 'boolean'
}

// Union Types
export type DocumentCategory = 'tender' | 'bid'
export type AnalysisType = 'element_extract' | 'opening_analysis' | 'simulated_doc'
export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error'

// Enum-like Objects
export const AI_PROVIDERS = {
  DEEPSEEK: 'deepseek',
  DASHSCOPE: 'dashscope',
  ZHIPU: 'zhipu',
  MINIMAX: 'minimax',
  OLLAMA: 'ollama',
  OPENAI: 'openai',
  CLAUDE: 'claude',
} as const

export type AIProvider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS]
```

### 3.2 React Component Typing

```typescript
// components/file-upload/FileUploader.tsx
import { FC, memo, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'

interface FileUploaderProps {
  onUpload: (files: File[]) => Promise<void>
  accept?: string
  maxSize?: number  // bytes
  className?: string
}

export const FileUploader: FC<FileUploaderProps> = memo(({
  onUpload,
  accept = '.pdf,.md,.doc,.docx,.xlsx,.xls',
  maxSize = 50 * 1024 * 1024,  // 50MB
  className
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ... implementation

  return (
    <div className={cn('relative', className)}>
      {/* drag-drop area */}
    </div>
  )
})

FileUploader.displayName = 'FileUploader'
```

### 3.3 Custom Hook Typing

```typescript
// hooks/useStreamExtract.ts
import { useState, useCallback, useRef } from 'react'
import type { StreamEvent } from '@/lib/validations/analysis'

interface UseStreamExtractOptions {
  documentId: string
  onEvent?: (event: StreamEvent) => void
  onError?: (error: Error) => void
}

export function useStreamExtract({ documentId, onEvent, onError }: UseStreamExtractOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [progress, setProgress] = useState('')
  const eventSourceRef = useRef<EventSource | null>(null)

  const startExtract = useCallback(async () => {
    setIsStreaming(true)
    // SSE connection logic
  }, [documentId])

  const stopExtract = useCallback(() => {
    eventSourceRef.current?.close()
    setIsStreaming(false)
  }, [])

  return {
    isStreaming,
    progress,
    startExtract,
    stopExtract,
  }
}
```

---

## 4. API Route Implementation

### 4.1 Next.js API Route Pattern

```typescript
// app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fileService } from '@/services/file.service'
import { createDocumentSchema } from '@/lib/validations/document'
import { AppError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const result = await fileService.listFiles({ page, limit })

    return NextResponse.json({
      success: true,
      data: result.files,
      pagination: result.pagination
    })
  } catch (error) {
    console.error('GET /api/files error:', error)

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate
    const validatedData = createDocumentSchema.safeParse({
      name: file.name,
      size: file.size,
      mimeType: file.type,
    })

    if (!validatedData.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid file', details: validatedData.error },
        { status: 400 }
      )
    }

    // Upload
    const result = await fileService.uploadFile(file)

    return NextResponse.json({
      success: true,
      data: result
    }, { status: 201 })

  } catch (error) {
    console.error('POST /api/files error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 4.2 SSE Stream Handler

```typescript
// app/api/extract/element/route.ts
import { NextRequest } from 'next/server'
import { extractService } from '@/services/extract.service'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { fileId } = await request.json()

        // SSE event generator
        const events = extractService.streamExtract(fileId)

        for await (const event of events) {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // Close signal
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

      } catch (error) {
        const errorEvent = `data: ${JSON.stringify({ type: 'error', message: 'Stream failed' })}\n\n`
        controller.enqueue(encoder.encode(errorEvent))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

---

## 5. Backend Implementation (FastAPI)

### 5.1 API Route Pattern

```python
# app/api/files.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.services.file_service import FileService
from app.models.schemas import FileUploadResponse, FileListResponse
from app.dependencies import get_file_service

router = APIRouter(prefix="/files", tags=["files"])

@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    service: FileService = Depends(get_file_service)
):
    # Validate file type
    allowed_types = ["application/pdf", "text/markdown", "application/msword"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not supported")

    # Validate file size (50MB max)
    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    # Upload
    result = await service.upload(contents, file.filename, file.content_type)
    return result

@router.get("/list", response_model=FileListResponse)
async def list_files(
    page: int = 1,
    limit: int = 10,
    service: FileService = Depends(get_file_service)
):
    result = await service.list_files(page=page, limit=limit)
    return result
```

### 5.2 Service Layer Pattern

```python
# app/services/file_service.py
from app.infrastructure.storage import StorageService
from app.infrastructure.database import Database
from app.models.schemas import FileUploadResponse
from cryptography.fernet import Fernet

class FileService:
    def __init__(
        self,
        storage: StorageService,
        db: Database,
        encryption_key: bytes
    ):
        self.storage = storage
        self.db = db
        self.fernet = Fernet(encryption_key)

    async def upload(self, contents: bytes, filename: str, content_type: str) -> FileUploadResponse:
        # Encrypt content
        encrypted = self.fernet.encrypt(contents)

        # Store encrypted file
        file_path = await self.storage.save(encrypted, filename)

        # Save metadata
        file_record = await self.db.tender_documents.create({
            "name": filename,
            "size": len(contents),
            "mime_type": content_type,
            "encrypted_path": file_path,
            "status": "ready"
        })

        return FileUploadResponse(
            id=str(file_record.id),
            name=filename,
            size=len(contents),
            type=content_type,
            status="ready"
        )

    async def download(self, file_id: str) -> bytes:
        record = await self.db.tender_documents.get(file_id)
        if not record:
            raise FileNotFoundError("File not found")

        encrypted = await self.storage.read(record.encrypted_path)
        return self.fernet.decrypt(encrypted)
```

### 5.3 LLM Service with LiteLLM

```python
# app/services/llm_service.py
from litellm import acompletion
from typing import AsyncGenerator

class LLMService:
    def __init__(self, provider: str, api_key: str):
        self.provider = provider
        self.api_key = api_key
        self.model = self._get_model_name(provider)

    def _get_model_name(self, provider: str) -> str:
        model_map = {
            "openai": "gpt-4o",
            "deepseek": "deepseek-v4-flash",
            "claude": "claude-sonnet-4-6",
            "dashscope": "qwen-turbo",
            "zhipu": "glm-4-flash",
            "minimax": "MiniMax-M2.7",
        }
        return model_map.get(provider, "gpt-4o")

    async def complete(self, messages: list, stream: bool = True) -> AsyncGenerator:
        response = await acompletion(
            model=self.model,
            messages=messages,
            api_key=self.api_key,
            stream=stream
        )

        if stream:
            async for chunk in response:
                yield chunk.choices[0].delta.content
        else:
            yield response.choices[0].message.content
```

---

## 6. Security Practices

### 6.1 API Key Handling (from real.md)

```typescript
// lib/api-keys.ts (Frontend)
// 浏览器统一访问同源 API，Next.js 服务端负责转发到 FastAPI
const API_BASE_URL = ''

export async function callAPI(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options?.headers,
      // 不在客户端传递 API Key
    }
  })
  return response.json()
}
```

```python
# app/config.py (Backend)
import os
from functools import lru_cache

@lru_cache()
def get_settings():
    return {
        # API Keys 从环境变量读取，不存入数据库
        "openai_api_key": os.environ.get("OPENAI_API_KEY"),
        "deepseek_api_key": os.environ.get("DEEPSEEK_API_KEY"),
        "claude_api_key": os.environ.get("CLAUDE_API_KEY"),
        "dashscope_api_key": os.environ.get("DASHSCOPE_API_KEY"),
        "zhipu_api_key": os.environ.get("ZHIPU_API_KEY"),
        "minimax_api_key": os.environ.get("MINIMAX_API_KEY"),
        # 加密密钥
        "fernet_key": os.environ.get("FERNET_KEY"),
    }
```

### 6.2 File Encryption

```python
# app/services/encryption_service.py
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

class EncryptionService:
    def __init__(self, key: bytes):
        self.fernet = Fernet(key)

    @staticmethod
    def generate_key(password: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password))

    def encrypt(self, data: bytes) -> bytes:
        return self.fernet.encrypt(data)

    def decrypt(self, encrypted_data: bytes) -> bytes:
        return self.fernet.decrypt(encrypted_data)
```

### 6.3 Statistics Calculation (from real.md)

```python
# app/services/statistics_service.py
# 统计分析必须在服务端完成，前端仅负责展示

class StatisticsService:
    @staticmethod
    def calculate_price_statistics(prices: list[float]) -> dict:
        """计算报价统计指标"""
        if not prices:
            return {}

        sorted_prices = sorted(prices)
        n = len(sorted_prices)

        # 报价排名
        rankings = [
            {"price": p, "rank": i + 1}
            for i, p in enumerate(sorted_prices)
        ]

        # 基础统计
        avg_price = sum(prices) / n
        min_price = min(prices)
        max_price = max(prices)

        # 离散系数 (变异系数)
        variance = sum((p - avg_price) ** 2 for p in prices) / n
        std_dev = variance ** 0.5
        dispersion = (std_dev / avg_price * 100) if avg_price > 0 else 0

        # 降价幅度
        price_changes = []
        for i in range(1, len(prices)):
            change = (prices[i-1] - prices[i]) / prices[i-1] * 100
            price_changes.append(change)

        return {
            "price_rankings": rankings,
            "average_price": round(avg_price, 2),
            "lowest_price": min_price,
            "highest_price": max_price,
            "dispersion_coefficient": round(dispersion, 2),
            "price_changes": [round(c, 2) for c in price_changes]
        }
```

---

## 7. Error Handling

### 7.1 Error Classes

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR')
    this.details = details
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxSize: string) {
    super(`File size exceeds ${maxSize}`, 413, 'FILE_TOO_LARGE')
  }
}

export class UnsupportedFileTypeError extends AppError {
  constructor(type: string) {
    super(`File type ${type} is not supported`, 400, 'UNSUPPORTED_FILE_TYPE')
  }
}
```

### 7.2 Error Handling in API Route

```typescript
// app/api/files/route.ts
export async function POST(request: NextRequest) {
  try {
    // ... business logic
  } catch (error) {
    console.error('POST /api/files error:', error)

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    // Unexpected error
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## 8. Import Organization

### 8.1 Frontend Imports Order

```typescript
// 1. React / Next.js
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// 2. External libraries (ordered alphabetically)
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@tanstack/react-query'

// 3. shadcn/ui components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

// 4. Internal components (from src/frontend/components/)
import { FileUploader } from '@/components/file-upload/FileUploader'
import { ElementCard } from '@/components/extract/ElementCard'

// 5. Shared code (from src/)
// 注意：@/ 指向 src/frontend，共享代码用相对路径或配置别名
import { createDocumentSchema } from '@/lib/validations/document'

// 6. Internal modules (from src/frontend/)
import { apiClient } from '@/lib/api'
import { useFileStore } from '@/stores/file-store'
import { useExtractStore } from '@/stores/extract-store'

// 7. Types
import type { FileItem, ElementExtract } from '@/types'

// 8. Utils / Constants
import { cn } from '@/lib/utils'
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '@/lib/constants'
```

---

## 9. Quality Checklist

### 9.1 Code Quality

- [ ] TypeScript strict mode passes
- [ ] No `any` types without explicit justification
- [ ] Components properly typed with explicit Props interface
- [ ] Hooks return typed values
- [ ] API routes validate input with Zod
- [ ] Error handling covers all code paths

### 9.2 Security (from real.md)

- [ ] API keys from environment variables only
- [ ] Files encrypted before storage (Fernet)
- [ ] Statistics calculated on server only
- [ ] Input validation on both frontend and backend
- [ ] File type validation prevents code execution

### 9.3 React Best Practices

- [ ] Components use `memo()` where appropriate
- [ ] Custom hooks extract reusable logic
- [ ] State collocated with its usage
- [ ] Callbacks wrapped in `useCallback`
- [ ] Expensive computations wrapped in `useMemo`

### 9.4 API Design

- [ ] RESTful conventions followed
- [ ] Consistent response format
- [ ] Appropriate HTTP status codes
- [ ] SSE for streaming responses
- [ ] Error messages are actionable

---

## 10. Key Files Reference

| Purpose | Frontend | Backend |
|---------|----------|---------|
| File Upload | `src/frontend/components/file-upload/FileUploader.tsx` | `src/backend/app/api/files.py` |
| Element Extract | `src/frontend/components/extract/ElementList.tsx` | `src/backend/app/api/extract.py` |
| Database | `src/frontend/components/database/DatabasePanel.tsx` | `src/backend/app/api/database.py` |
| AI Settings | `app/(main)/settings/page.tsx` | `src/backend/app/api/settings.py` |
| Encryption | `src/frontend/lib/crypto.ts` | `src/backend/app/services/encryption_service.py` |
| LLM Integration | N/A | `src/backend/app/services/llm_service.py` |
| Statistics | `src/frontend/components/statistics/` | `src/backend/app/services/statistics_service.py` |

---

**文档版本：** v1.0.0
**创建日期：** 2026-05-10
**维护者：** Bid Master Team