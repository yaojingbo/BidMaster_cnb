# System Architecture Document: Bid Master Web

<meta>
  <document-id>bid-master-system-architecture</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>System Architecture</type>
  <created>2026-05-10</created>
  <depends>real.md, cog.md</depends>
</meta>

---

## 1. Architecture Overview

### 1.1 Architecture Pattern

**Pattern:** Layered Architecture + Modular Design

**Rationale:**
- 前端 Next.js 15 App Router 提供清晰的路由和服务器组件边界
- 后端 FastAPI 提供异步 API 支持 SSE 流式响应
- 分层设计确保关注点分离，便于开发和维护

**Deployment:**
- 主生产：腾讯云服务器（Next.js 15、FastAPI 和独立 Node.js/Mastra RAG 服务，由 systemd 管理）
- 数据库：PostgreSQL/Neon
- 向量索引：Zilliz Cloud/Milvus（仅由 RAG 服务访问）
- 主代码仓库：CNB
- 既有业务 LLM 封装：LiteLLM；RAG Embedding 与 Mastra 运行时在独立 Node 服务中

### 1.2 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js 15 (App Router)                     │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │   │
│  │  │  Upload   │  │   Extract │  │    Settings       │   │   │
│  │  │  Page     │  │   Page    │  │    Page           │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   FastAPI Backend                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  File API   │  │  Extract    │  │  Settings   │    │   │
│  │  │  (upload/   │  │  API        │  │  API        │    │   │
│  │  │   download) │  │  (SSE)      │  │  (provider   │    │   │
│  │  └─────────────┘  └─────────────┘  │   config)   │    │   │
│  │          │                          └─────────────┘    │   │
│  │          ▼                                             │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │       Independent Node.js/Mastra RAG Service      │   │   │
│  │  │       (knowledge index, retrieval, citation QA)  │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│            ┌─────────────────┼─────────────────┐                │
│            │                 │                 │                 │
│            ▼                 ▼                 ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   LiteLLM   │    │  PostgreSQL │    │   File      │         │
│  │   Gateway   │    │  (Neon)     │    │   Storage   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
      ┌──────────┐     ┌──────────┐     ┌──────────┐
      │ OpenAI   │     │ DeepSeek │     │ Claude   │
      │ DeepSeek │     │ Ollama   │     │ MiniMax  │
      │ Claude   │     │ ...      │     │ ...      │
      └──────────┘     └──────────┘     └──────────┘
```

---

## 2. Subsystems

### 2.1 Subsystem Overview

| Subsystem | Responsibility | Public API |
|-----------|----------------|------------|
| File Management | 文件上传、存储、下载 | `/api/files/*` |
| Document Analysis | 要素提取、文档转换 | `/api/extract/*` |
| RAG Service | 知识库索引、检索、引用问答 | `/api/knowledge/*`（经 FastAPI 网关） |
| AI Gateway | 多供应商路由、LLM 调用 | `/api/ai/*` |
| Statistics | 开标数据分析、计算 | `/api/statistics/*` |
| Settings | AI 供应商配置管理 | `/api/settings/*` |
| Health | 系统健康检查 | `/api/health` |

---

### 2.2 Subsystem: File Management

**Responsibility:** 负责招标文件的上传、存储、加密和下载

**Components:**
- `FileUploader`: 处理文件上传 multipart/form-data
- `FileStorage`: 文件加密存储（Fernet 对称加密）
- `FileDownloader`: 文件解密下载

**Interfaces:**
- Input: 上传的 PDF/Markdown/Excel 文件
- Output: 文件元数据、下载链接

**Dependencies:**
- Depends on: PostgreSQL（文件元数据）
- Used by: Document Analysis

**Constraints (from real.md):**
- 文件必须加密存储

---

### 2.3 Subsystem: Document Analysis

**Responsibility:** 解析招标文件并提取结构化要素

**Components:**
- `PDFConverter`: PDF 转 Markdown
- `ElementExtractor`: 五要素提取（资质要求、评标办法、业绩门槛、定标方法、合同条款）
- `Streamer`: SSE 流式输出

**Interfaces:**
- Input: 文件 UUID
- Output: SSE 流式五要素数据

**Dependencies:**
- Depends on: File Management, AI Gateway
- Used by: 前端页面

**Constraints (from real.md):**
- 统计分析必须在服务端完成

---

### 2.4 Subsystem: AI Gateway

**Responsibility:** 统一封装多个 LLM 供应商，简化调用

**Components:**
- `LLMFactory`: 供应商工厂
- `Router`: 请求路由
- `StreamHandler`: SSE 流处理

**Interfaces:**
- Input: 供应商名称、模型、消息
- Output: LLM 响应（SSE 或普通）

**Dependencies:**
- Depends on: LiteLLM
- Used by: Document Analysis, Statistics

**Constraints (from real.md):**
- API Key 仅通过环境变量配置

---

### 2.5 Subsystem: Statistics

**Responsibility:** 开标数据统计分析（报价排名、降价幅度、离散系数）

**Components:**
- `ExcelParser`: Excel/CSV 解析
- `StatisticCalculator`: 统计分析计算
- `ReportGenerator`: 分析报告生成

**Interfaces:**
- Input: 开标数据文件
- Output: 统计结果、分析报告

**Dependencies:**
- Depends on: AI Gateway
- Used by: 前端页面

**Constraints (from real.md):**
- 统计分析必须在服务端完成

---

### 2.6 Subsystem: Settings

**Responsibility:** AI 供应商配置管理（环境变量级别）

**Components:**
- `ProviderManager`: 供应商配置管理
- `ConnectionTester`: 连接测试

**Interfaces:**
- Input: 供应商选择
- Output: 配置状态、测试结果

**Dependencies:**
- Depends on: AI Gateway
- Used by: 前端设置页面

---

## 3. API Design

### 3.1 API Structure

```
/api
├── /files
│   ├── POST   /upload           # 上传文件
│   ├── GET    /list             # 文件列表
│   ├── GET    /:id              # 获取文件信息
│   ├── GET    /:id/download     # 下载文件
│   └── DELETE /:id              # 删除文件
├── /extract
│   ├── POST   /element          # 提取要素（支持 SSE）
│   └── GET    /status/:task_id  # 任务状态
├── /settings
│   ├── GET    /providers        # 供应商列表
│   ├── GET    /providers/:name  # 获取供应商状态
│   ├── POST   /providers/:name  # 配置供应商
│   └── POST   /test             # 测试连接
├── /statistics
│   ├── POST   /parse            # 解析开标数据
│   ├── POST   /analyze          # AI 分析（支持 SSE）
│   └── GET    /export/:id       # 导出报告
└── /health
    └── GET    /                 # 健康检查
```

### 3.2 API Endpoints Detail

#### POST /api/files/upload

**Description:** 上传招标文件

**Authentication:** None（无登录）

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: 文件（PDF、Markdown、doc、docx、Excel）
  - `name`: 文件显示名称（可选）

**Response:**
- 200:
```json
{
  "id": "uuid",
  "name": "招标文件.pdf",
  "size": 1024000,
  "type": "application/pdf",
  "created_at": "2026-05-10T12:00:00Z"
}
```
- 400: 文件类型不支持
- 413: 文件过大（超过 50MB）

---

#### POST /api/extract/element

**Description:** 提取招标文件五要素（SSE 流式响应）

**Authentication:** None

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "file_id": "uuid"
}
```

**Response:**
- Content-Type: `text/event-stream`
- 200:
```
data: {"type": "progress", "message": "正在解析文件..."}
data: {"type": "element", "name": "资质要求", "content": "..."}
data: {"type": "element", "name": "评标办法", "content": "..."}
data: {"type": "done", "summary": "提取完成"}
```

---

#### GET /api/settings/providers

**Description:** 获取支持的 AI 供应商列表

**Response:**
- 200:
```json
{
  "providers": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "models": ["deepseek-v4-flash", "deepseek-v4-pro"]
    },
    {
      "id": "dashscope",
      "name": "阿里百炼",
      "models": ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-coder-turbo"]
    },
    {
      "id": "zhipu",
      "name": "智谱 AI",
      "models": ["glm-5.1", "glm-5"]
    },
    {
      "id": "minimax",
      "name": "MiniMax",
      "models": ["MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2-Her"]
    },
  ],
  "active": "deepseek"
}
```

---

#### POST /api/settings/test

**Description:** 测试 AI 供应商连接

**Request:**
```json
{
  "provider": "openai",
  "api_key": "sk-..."
}
```

**Response:**
- 200:
```json
{
  "success": true,
  "message": "连接成功",
  "latency_ms": 120
}
```
- 400:
```json
{
  "success": false,
  "error": "无效的 API Key"
}
```

---

## 4. Directory Structure

### 4.1 Frontend (Next.js 15)

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (main)/               # 主应用路由组
│   │   │   ├── page.tsx          # 首页/上传页面
│   │   │   ├── extract/
│   │   │   │   └── page.tsx      # 要素提取页面
│   │   │   ├── statistics/
│   │   │   │   └── page.tsx      # 开标分析页面
│   │   │   └── settings/
│   │   │       └── page.tsx      # AI 设置页面
│   │   ├── api/                  # API 路由
│   │   │   ├── files/
│   │   │   └── extract/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/               # React 组件
│   │   ├── ui/                   # shadcn/ui 组件
│   │   ├── file-upload/          # 文件上传组件
│   │   ├── extract/              # 要素提取组件
│   │   └── layout/               # 布局组件
│   ├── lib/                      # 工具函数
│   │   ├── api.ts                # API 调用
│   │   └── utils.ts
│   ├── hooks/                    # React hooks
│   │   ├── useFileUpload.ts
│   │   └── useStreamExtract.ts
│   ├── types/                    # TypeScript 类型
│   │   └── index.ts
│   └── constants/                # 常量
│       └── providers.ts
├── public/
├── package.json
└── next.config.js
```

### 4.2 Backend (FastAPI)

```
backend/
├── app/
│   ├── main.py                   # FastAPI 入口
│   ├── config.py                 # 配置管理
│   ├── dependencies.py           # 依赖注入
│   ├── api/                     # API 路由
│   │   ├── files.py
│   │   ├── extract.py
│   │   ├── settings.py
│   │   ├── statistics.py
│   │   └── health.py
│   ├── services/                # 业务逻辑
│   │   ├── file_service.py
│   │   ├── extract_service.py
│   │   ├── statistics_service.py
│   │   └── llm_service.py
│   ├── models/                  # 数据模型
│   │   └── schemas.py           # Pydantic 模型
│   ├── infrastructure/           # 基础设施
│   │   ├── database.py
│   │   ├── storage.py
│   │   └── llm/
│   │       ├── base.py
│   │       └── lite_llm.py
│   └── utils/                   # 工具函数
│       └── crypto.py
├── requirements.txt
├── pyproject.toml
└── Dockerfile
```

---

## 5. Security Architecture

### 5.1 Security Layers

```
┌─────────────────────────────────────┐
│         Transport Layer             │
│         (HTTPS only)               │
├─────────────────────────────────────┤
│         API Gateway                 │
│     (Rate Limiting, CORS)          │
├─────────────────────────────────────┤
│         Input Validation            │
│      (Pydantic, File Validation)   │
├─────────────────────────────────────┤
│         Data Protection             │
│   (Encryption at Rest, Zod)        │
└─────────────────────────────────────┘
```

### 5.2 Security Requirements Matrix

| Layer | Requirement | Implementation |
|-------|-------------|----------------|
| Transport | HTTPS only | 腾讯云 Nginx 终止 TLS，冷备用由平台 HTTPS 提供 |
| API | Rate limiting | slowapi 限流 |
| API | CORS | FastAPI CORS middleware |
| Input | File type validation | python-magicnum 检测 |
| Input | File size limit | 50MB limit |
| Input | Schema validation | Pydantic models |
| Data | Encryption at rest | Fernet symmetric encryption |
| Data | API key protection | Environment variables only |

### 5.3 Constraints Compliance (from real.md)

| Constraint | Implementation |
|-------------|----------------|
| API 密钥通过环境变量配置 | LiteLLM 读取 `os.environ` |
| 文件加密存储 | `cryptography.fernet.Fernet` 加密 |
| 统计分析在服务端完成 | 后端 Python 计算，前端仅展示 |

---

## 6. Technical Decisions

### ADR-001: Frontend Framework Selection

**Status:** Accepted

**Context:**
需要一个现代化的前端框架，支持 SSR、API Routes、组件化开发。

**Decision:**
选择 Next.js 15 (App Router)，原因：
- 内置 SSR/SSG 支持
- API Routes 可简化前后端通信
- shadcn/ui + Tailwind CSS 提供优质组件
- Next.js 提供 SSR、SSG 和 API Routes，生产环境统一部署在腾讯云 systemd。

**Consequences:**
- 前端开发者需要熟悉 Next.js 特定概念（App Router、Server Components）
- 放弃了传统的 React + Vite 方案

---

### ADR-002: Backend Framework Selection

**Status:** Accepted

**Context:**
需要一个高性能异步 Python Web 框架，支持 SSE 流式响应。

**Decision:**
选择 FastAPI + Uvicorn，原因：
- 原生异步支持
- 自动 OpenAPI 文档
- SSE 支持简单（通过 StreamingResponse）
- 与 LiteLLM 异步调用完美匹配

**Consequences:**
- 需要学习 FastAPI 特有的依赖注入模式
- 相比 Django，生态较小

---

### ADR-003: LLM Integration

**Status:** Accepted

**Context:**
需要支持多个 LLM 供应商（OpenAI、DeepSeek、Claude、阿里百炼、MiniMax、Ollama）。

**Decision:**
使用 LiteLLM 统一封装，原因：
- 支持 100+ 模型
- 统一接口，切换供应商简单
- 内置流式响应支持
- 避免重复造轮子

**Consequences:**
- 引入额外依赖
- 需配置各供应商 API Key

---

### ADR-004: Database Selection

**Status:** Accepted

**Context:**
需要生产级数据库，支持 PostgreSQL 和持久化部署。

**历史决策说明：**
当前主生产统一使用 PostgreSQL，具体运行位置和备份策略以腾讯云部署文档为准。

**保留原因：**
- PostgreSQL 功能完整
- 与 SQLAlchemy 兼容
- 便于在腾讯云生产环境中统一维护

**Consequences:**
- 需要根据实际 PostgreSQL 运行环境配置连接池

---

### ADR-005: File Encryption

**Status:** Accepted

**Context:**
用户上传的招标文件包含敏感商业信息，需要加密存储。

**Decision:**
使用 `cryptography.fernet.Fernet` 对称加密，原因：
- AES-128 加密，安全性高
- 密钥通过环境变量管理
- Python 原生支持

**Consequences:**
- 文件加密/解密有一定性能开销
- 密钥管理需谨慎

---

### ADR-006: Streaming Response

**Status:** Accepted

**Context:**
AI 提取要素过程较长，需要实时反馈进度。

**Decision:**
使用 Server-Sent Events (SSE)，原因：
- 服务器向浏览器单向推送，实现简单
- 前端处理成熟（EventSource API）
- 与 FastAPI 原生集成

**Consequences:**
- 仅支持单向推送，不适合交互式对话
- 需处理连接断开重试

---

## 7. Data Flow

### 7.1 File Upload Flow

```
User → Frontend (Drag/Drop) → API Route → FastAPI
                                      ↓
                              FileService.upload()
                                      ↓
                              Fernet.encrypt()
                                      ↓
                              Persistent File Storage
                                      ↓
                              PostgreSQL (metadata)
                                      ↓
                              Response (file_id)
```

### 7.2 Element Extraction Flow

```
User → Frontend (Click Extract) → API Route → FastAPI
                                                ↓
                                        ExtractService
                                                ↓
                                        FileStorage.decrypt()
                                                ↓
                                        PDF/MD Parser
                                                ↓
                                        LLMService.stream()
                                                ↓
                                        SSE Response
                                                ↓
                              Frontend (Streaming Display)
```

---

## 8. Deployment Architecture

### 8.1 Infrastructure

| Component | Platform | Reasoning |
|-----------|----------|----------|
| 主生产 | 腾讯云服务器 + systemd | 统一管理 Next.js 与 FastAPI，使用正式域名承载流量 |
| Database | PostgreSQL | 保存用户、项目和分析数据 |
| File Storage | 腾讯云服务器持久目录 | 上传文件与 OCR 数据不依赖代码仓库恢复 |
| Code Repository | CNB | CNB 为唯一代码仓库 |

### 8.2 Environment Variables

**Backend (.env):**
```bash
# LLM Providers (API Keys)
DEEPSEEK_API_KEY=sk-...
DASHSCOPE_API_KEY=sk-...
ZHIPU_API_KEY=sk-...
MINIMAX_API_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@neon-host/db

# Encryption
FERNET_KEY=your-32-byte-base64-key

# Ollama (optional, for local)
OLLAMA_BASE_URL=http://localhost:11434
```

**Next.js 服务端运行环境：**
```bash
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=https://bidmaster.asia
```

---

## 9. Quality Checklist

- [x] 架构模式适合项目需求（分层 + 模块化）
- [x] 所有子系统职责清晰
- [x] API 遵循 RESTful 规范
- [x] 目录结构支持模块化
- [x] 安全要求已处理（HTTPS、CORS、加密、验证）
- [x] 技术决策已记录（6 个 ADR）
- [x] 符合 real.md 中的约束
- [x] 无需登录注册（简化认证层）

---

**文档版本：** v1.0.0
**创建日期：** 2026-05-10
**维护者：** Bid Master Team
