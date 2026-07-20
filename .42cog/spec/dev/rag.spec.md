# RAG 功能设计规约：Bid Master Web

<meta>
  <document-id>bid-master-rag-spec</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>RAG Feature Design Specification</type>
  <created>2026-07-03</created>
  <depends>meta.md, real.md, cog.md, sys.spec.md, db.spec.md, code.spec.md</depends>
</meta>

---

## 1. 功能定位

### 1.1 一句话定义

RAG 功能是 Bid Master Web 的“文件片段检索与证据增强层”，用于在大量招投标文件片段中快速找到可引用依据，并把检索到的片段作为 AI 分析、问答、要素提取、模拟编制的上下文来源。

### 1.2 不替代的能力

RAG 不替代现有的文件上传、PDF/OCR 解析、要素提取、模拟编制、开标分析功能。

它只新增三类能力：

1. 文件内容切片、索引、检索。
2. AI 回答时附带可追溯证据片段。
3. 为既有分析任务按需提供更小、更准的上下文。

### 1.3 首期业务目标

首期只解决一个闭环：

> 用户在文件库中选择一个或多个招标文件，输入问题，系统返回基于文件片段的回答，并展示引用来源。

典型问题：

- “本项目投标人资格要求有哪些？”
- “评分办法里价格分怎么计算？”
- “废标条款有哪些？”
- “项目负责人需要什么证书？”
- “多个文件中保证金要求有什么差异？”

---

## 2. 元、反、空分析

### 2.1 元：从本质看 RAG

RAG 的本质不是“让 AI 更聪明”，而是把 AI 的生成边界约束在用户上传的招投标文件事实内。

在本项目中，RAG 的元问题是：

> 招投标文件很长、结构复杂、包含大量表格和扫描页，用户真正需要的是“可验证依据”，不是泛化回答。

因此本功能的核心不是聊天，而是：

1. 将文件拆成稳定、可追溯、可复用的证据片段。
2. 根据用户问题找出最相关片段。
3. 将片段交给 LLM 进行归纳、对比、引用。
4. 将回答与原始文件位置绑定，降低幻觉风险。

### 2.2 反：从失败面看 RAG

RAG 容易失败的地方不是调用 LLM，而是以下环节：

| 失败点 | 表现 | 设计约束 |
|--------|------|----------|
| 解析失败 | 扫描 PDF、表格、页眉页脚导致片段缺失 | 复用现有 PDF/OCR 解析链路，保留页码和表格上下文 |
| 切片失败 | 评分办法、资格要求被切断 | 按章节优先切片，token 切片只作为兜底 |
| 检索失败 | 问“废标条款”却召回“投标保证金” | 使用向量检索 + 关键词检索的混合检索 |
| 引用失败 | 回答正确但无法定位来源 | 每个 chunk 必须有 file_id、page_no、section_path、chunk_index |
| 权限失败 | 用户检索到他人文件片段 | 所有索引和检索必须绑定 user_id |
| 成本失控 | 每次上传都重复 embedding | 用 file_hash + chunk_hash + index_version 去重 |
| 旧功能受影响 | 上传、提取变慢或失败 | 索引任务异步旁路执行，失败不阻塞原功能 |

### 2.3 空：从留白看演进

首期不要把 RAG 设计成一个“大而全知识库”。

需要保留三层空位：

1. 检索空位：先实现 pgvector + SQL 关键词，后续可替换为 Qdrant、Milvus、Elasticsearch。
2. 模型空位：embedding、rerank、chat completion 都通过服务接口封装，不绑定单一供应商。
3. 场景空位：首期做文件问答，后续再接入要素提取增强、模拟编制引用、跨项目知识库。

---

## 3. 功能边界

### 3.1 首期范围

首期包含：

1. 文件解析结果进入 RAG 索引。
2. 单文件和多文件问答。
3. 返回回答、引用片段、来源文件、页码、章节。
4. 数据管理页可查看某文件索引状态。
5. 删除文件时删除对应 RAG 片段。
6. 支持按用户隔离检索。

### 3.2 首期不做

首期不做：

1. 全站公开知识库。
2. 自动跨用户共享文件片段。
3. 基于 RAG 的自动投标文件生成。
4. 向量库多租户复杂权限模型。
5. 多轮长期记忆。
6. 对原 PDF 的精确坐标高亮。
7. 对所有既有 AI 任务强制启用 RAG。

---

## 4. 总体架构

### 4.1 新增子系统

新增 `RAG Retrieval` 子系统，位于 FastAPI 后端。

```
Client
  │
  ▼
Next.js 页面 / API 代理
  │
  ▼
FastAPI
  ├── File Management        # 现有：上传、加密、下载
  ├── Document Analysis      # 现有：PDF/OCR/要素提取
  ├── AI Gateway             # 现有：LiteLLM 多供应商
  └── RAG Retrieval          # 新增：切片、索引、检索、引用问答
        ├── Chunker
        ├── EmbeddingService
        ├── VectorStore
        ├── HybridRetriever
        ├── Reranker
        └── RagAnswerService
```

### 4.2 非破坏性接入方式

RAG 必须旁路接入现有功能：

1. 文件上传成功后，原返回逻辑不变。
2. 后端异步触发索引任务，索引失败不影响上传成功。
3. 要素提取默认走原链路。
4. 新增 `use_rag` 参数后，部分任务可显式启用 RAG 上下文增强。
5. 前端先新增文件问答入口，不替换现有数据库预览和提取结果页面。

---

## 5. 关键技术点

### 5.1 文档解析

RAG 不重新发明解析链路，优先复用现有能力：

- PDF：复用现有 PyMuPDF / pdfplumber / pypdf / OCR 流程。
- Markdown：直接按标题层级解析。
- Word：复用 python-docx 或既有转换流程。
- Excel/CSV：首期不进入 RAG 正文索引，只作为开标分析数据使用；后续可把表格转为 Markdown 表格片段。

解析输出必须包含：

```json
{
  "file_id": "文件 ID",
  "file_name": "原始文件名",
  "content": "解析后的文本或 Markdown",
  "pages": [
    {
      "page_no": 1,
      "text": "页面文本",
      "tables": []
    }
  ],
  "source_hash": "文件内容哈希"
}
```

### 5.2 切片策略

招投标文件不能只按固定 token 切片。

首期采用三层切片：

1. 章节切片：按 Markdown 标题、目录编号、常见条款标题切分。
2. 语义切片：对过长章节按自然段、列表项、表格块继续拆分。
3. token 兜底：超过上限时按 token 或字符长度硬切。

建议参数：

| 参数 | 建议值 |
|------|--------|
| chunk_size | 800-1200 中文字符 |
| chunk_overlap | 120-200 中文字符 |
| max_context_chunks | 6-10 |
| min_chunk_chars | 80 |

必须保留的元数据：

- user_id
- file_id
- file_name
- source_hash
- page_no
- section_path
- chunk_index
- content_hash
- chunk_type：text/table/title/list
- extraction_method：text/ocr/table/manual

### 5.3 Embedding

Embedding 必须独立于 Chat 模型配置。

推荐首期选型：

| 场景 | 推荐 |
|------|------|
| 默认云端 | OpenAI-compatible embedding 接口 |
| 国内优先 | 阿里百炼 text-embedding-v3 或同类中文 embedding |
| 本地开发 | Ollama + nomic-embed-text / bge-m3 |
| 长期扩展 | 通过 LiteLLM 或独立 EmbeddingService 统一封装 |

配置项：

```env
RAG_ENABLED=true
RAG_EMBEDDING_PROVIDER=dashscope
RAG_EMBEDDING_MODEL=text-embedding-v3
RAG_EMBEDDING_DIM=1024
RAG_TOP_K=20
RAG_CONTEXT_K=8
RAG_MIN_SCORE=0.25
```

### 5.4 向量库

首期推荐使用 PostgreSQL + pgvector。

原因：

1. 项目现有数据库已经是 PostgreSQL。
2. 用户文件、用户权限、分析结果都在同一个数据库内。
3. MVP 阶段避免额外部署 Qdrant / Milvus。
4. 主生产沿用当前 PostgreSQL 可减少新增基础设施。

前置条件：

1. 确认当前 PostgreSQL 环境支持 `CREATE EXTENSION vector`。
2. 如果主生产 PostgreSQL 不支持或受限，再评估独立 pgvector 实例或 Qdrant Cloud。

索引建议：

- 小数据量：直接 cosine distance 查询。
- 中等数据量：HNSW 索引。
- 大数据量：按 user_id / file_id 过滤后再向量召回。

### 5.5 混合检索

仅向量检索不够，招投标场景有大量精确词：

- “废标”
- “否决”
- “投标保证金”
- “项目负责人”
- “类似业绩”
- “评分办法”
- “商务标”
- “技术标”

首期检索策略：

1. 向量召回 top_k=20。
2. SQL 关键词召回 top_k=20。
3. 合并去重。
4. 按加权分数排序。
5. 取前 context_k=8 进入 LLM。

建议权重：

```text
final_score = vector_score * 0.7 + keyword_score * 0.3
```

当问题包含强关键词时提高关键词权重。

### 5.6 Rerank

首期预留 Reranker 接口，但不强制引入。

接口：

```python
class Reranker:
    async def rerank(self, query: str, chunks: list[Chunk]) -> list[Chunk]:
        ...
```

后续可选：

- bge-reranker
- Cohere Rerank
- 阿里百炼 Rerank
- LLM 小模型重排

### 5.7 上下文组装

给 LLM 的上下文必须结构化，不能简单拼接。

格式：

```text
你只能基于以下文件片段回答。若片段不足以回答，请说明“当前文件片段未提供足够依据”。

[片段 1]
文件：xxx.pdf
页码：12
章节：第三章 评标办法 > 2.2.4 评分标准
内容：...

[片段 2]
文件：xxx.pdf
页码：13
章节：第三章 评标办法 > 价格分
内容：...
```

回答要求：

1. 先给结论。
2. 再分点说明。
3. 每个关键结论后附引用编号。
4. 不得编造文件中没有的内容。

### 5.8 引用溯源

API 返回必须包含 citations。

```json
{
  "answer": "...",
  "citations": [
    {
      "citation_id": 1,
      "chunk_id": "...",
      "file_id": "...",
      "file_name": "招标文件.pdf",
      "page_no": 12,
      "section_path": "第三章 评标办法 > 评分标准",
      "content_preview": "...",
      "score": 0.82
    }
  ]
}
```

---

## 6. 技术选型

### 6.1 推荐选型表

| 模块 | 首期选型 | 备选 | 选择理由 |
|------|----------|------|----------|
| 后端框架 | FastAPI | 不变 | 项目现有架构 |
| 数据库 | PostgreSQL | 不变 | 项目现有数据库 |
| 向量扩展 | pgvector | Qdrant | MVP 部署简单，权限过滤方便 |
| DB 客户端 | asyncpg | SQLAlchemy | 项目现有基础设施使用 asyncpg |
| Embedding | 供应商兼容接口 | Ollama 本地模型 | 复用多供应商能力，便于切换 |
| Chat LLM | LiteLLM | 不变 | 项目现有 AI Gateway |
| Rerank | 首期接口预留 | bge-reranker / 云服务 | 避免首期复杂度过高 |
| 文档解析 | 复用现有 PDF/OCR | MarkItDown | 避免重复建设 |
| 前端状态 | Zustand | 不变 | 项目现有状态管理 |
| 流式输出 | SSE | 不变 | 项目现有流式链路 |

### 6.2 不推荐首期使用的方案

| 方案 | 不推荐原因 |
|------|------------|
| Milvus | 部署和运维复杂，不适合当前 MVP |
| Elasticsearch/OpenSearch | 对向量检索不是首期最小成本方案 |
| LangChain 全量接入 | 抽象重，容易侵入现有代码结构 |
| LlamaIndex 全量接入 | 对当前业务可控性不如自建轻量服务 |
| 前端本地向量检索 | 文件敏感，且无法复用服务端权限和加密 |

---

## 7. 数据库设计

### 7.1 扩展启用

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 7.2 新增表：rag_indexes

用于记录文件索引状态。

```sql
CREATE TABLE IF NOT EXISTS rag_indexes (
    id VARCHAR(64) PRIMARY KEY,
    file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    source_hash TEXT NOT NULL,
    embedding_provider VARCHAR(50) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    embedding_dim INT NOT NULL,
    index_version VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    chunk_count INT DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

索引：

```sql
CREATE INDEX IF NOT EXISTS idx_rag_indexes_file ON rag_indexes(file_id);
CREATE INDEX IF NOT EXISTS idx_rag_indexes_user ON rag_indexes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rag_index_version
ON rag_indexes(file_id, user_id, source_hash, embedding_model, index_version);
```

### 7.3 新增表：rag_chunks

```sql
CREATE TABLE IF NOT EXISTS rag_chunks (
    id VARCHAR(64) PRIMARY KEY,
    index_id VARCHAR(64) REFERENCES rag_indexes(id) ON DELETE CASCADE,
    file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_type VARCHAR(30) DEFAULT 'text',
    section_path TEXT,
    page_no INT,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    token_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

索引：

```sql
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_file ON rag_chunks(user_id, file_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_index ON rag_chunks(index_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rag_chunk_hash
ON rag_chunks(index_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_content_trgm
ON rag_chunks USING gin (content gin_trgm_ops);
```

如果默认 embedding 维度不是 1024，需要同步调整 `vector(1024)`。

### 7.4 新增表：rag_query_logs

用于调试、评测和成本分析。

```sql
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    file_ids JSONB DEFAULT '[]',
    retrieved_chunk_ids JSONB DEFAULT '[]',
    provider VARCHAR(50),
    model VARCHAR(100),
    latency_ms INT,
    token_usage JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. 后端模块设计

### 8.1 新增目录

```text
src/backend/app/api/rag.py
src/backend/app/services/rag_service.py
src/backend/app/services/rag_chunker.py
src/backend/app/services/embedding_service.py
src/backend/app/services/rag_retriever.py
src/backend/app/services/rag_answer_service.py
src/backend/app/infrastructure/vector_store.py
```

### 8.2 API 设计

#### POST /api/rag/index

手动触发文件索引。

Request：

```json
{
  "file_id": "...",
  "force": false
}
```

Response：

```json
{
  "success": true,
  "data": {
    "index_id": "...",
    "status": "pending"
  }
}
```

#### GET /api/rag/index/{file_id}

查询文件索引状态。

Response：

```json
{
  "success": true,
  "data": {
    "file_id": "...",
    "status": "completed",
    "chunk_count": 128,
    "embedding_model": "text-embedding-v3",
    "updated_at": "..."
  }
}
```

#### POST /api/rag/query

基于文件片段问答。

Request：

```json
{
  "query": "评分办法是什么？",
  "file_ids": ["..."],
  "provider": "deepseek",
  "model": "...",
  "top_k": 20,
  "context_k": 8,
  "stream": false
}
```

Response：

```json
{
  "success": true,
  "data": {
    "answer": "...",
    "citations": [],
    "usage": {}
  }
}
```

#### POST /api/rag/query/stream

SSE 流式问答，事件类型：

- `retrieving`
- `citation`
- `content`
- `done`
- `error`

### 8.3 服务职责

| 服务 | 职责 |
|------|------|
| RagService | 索引任务编排、状态管理 |
| RagChunker | 文档切片、元数据提取 |
| EmbeddingService | 调用 embedding 模型 |
| VectorStore | 写入和查询 pgvector |
| RagRetriever | 混合检索、去重、排序 |
| RagAnswerService | 组装上下文、调用 LLM、生成引用回答 |

---

## 9. 前端设计

### 9.1 新增入口

首期推荐在数据管理页增加“文件问答”能力，而不是新增复杂一级菜单。

位置：

- `src/app/(main)/database/page.tsx`：文件详情抽屉中增加“问文件”页签。
- 后续稳定后可新增 `/rag` 或 `/knowledge` 页面。

### 9.2 UI 组成

1. 文件选择区：支持当前文件或多文件。
2. 索引状态区：未索引、索引中、已索引、失败。
3. 问题输入框。
4. 回答区。
5. 引用片段区。
6. 点击引用后定位到文件、页码、章节。

### 9.3 前端类型

```typescript
export interface RagCitation {
  citation_id: number
  chunk_id: string
  file_id: string
  file_name: string
  page_no?: number
  section_path?: string
  content_preview: string
  score: number
}

export interface RagQueryResult {
  answer: string
  citations: RagCitation[]
  usage?: Record<string, unknown>
}
```

---

## 10. 与现有功能的关系

### 10.1 文件上传

上传成功后可异步触发索引，但不能阻塞上传响应。

### 10.2 要素提取

首期不改变默认要素提取逻辑。

后续可增加：

```json
{
  "use_rag": true,
  "rag_focus": ["资质要求", "评分办法", "废标条款"]
}
```

### 10.3 模拟编制

后续可用 RAG 提供原文件依据，减少模拟编制时遗漏关键条款。

### 10.4 开标分析

开标分析以结构化表格计算为主，RAG 只适合用于解释“招标文件中的评分规则”，不参与报价排名、离散系数等服务端确定性计算。

---

## 11. 安全与合规

### 11.1 敏感文件约束

来自 `real.md` 的约束：用户上传的招标文件包含敏感商业信息，必须加密存储在服务端。

RAG 设计必须遵守：

1. 原文件继续加密存储。
2. chunk 表中的 `content` 属于可检索明文，必须视为敏感数据。
3. 所有 chunk 必须绑定 user_id。
4. API 查询必须通过当前登录用户过滤。
5. 删除文件时必须级联删除索引和片段。
6. 如果启用云端 embedding，需要在设置中明确提示用户文本片段会发送到对应 AI 供应商。

### 11.2 API Key

Embedding 和 LLM 的 API Key 仍通过环境变量或用户密钥配置读取，不得写入代码和仓库。

### 11.3 日志

默认不记录完整 chunk 内容到日志。

允许记录：

- query
- chunk_id
- file_id
- latency
- token_usage
- score

不允许记录：

- 原始完整文件内容
- 大段 chunk 明文
- API Key

---

## 12. 评测指标

### 12.1 必备评测集

落地前需要准备至少 10 份真实或脱敏招标文件，并为每份文件准备黄金问题。

每份文件建议问题：

1. 资格要求。
2. 业绩要求。
3. 人员要求。
4. 评分办法。
5. 废标条款。
6. 保证金要求。
7. 工期要求。
8. 合同付款条件。

### 12.2 指标

| 指标 | 目标 |
|------|------|
| Recall@8 | >= 80% |
| 引用准确率 | >= 85% |
| 无依据拒答率 | 合理问题不误拒，文件缺失问题必须拒答 |
| 单次查询延迟 | 非流式 <= 8 秒，流式首 token <= 3 秒 |
| 索引成功率 | >= 95% |

---

## 13. 落地阶段

### 13.1 阶段一：RAG MVP

目标：单文件/多文件问答可用。

任务：

1. 增加 pgvector 支持。
2. 增加 `rag_indexes`、`rag_chunks`、`rag_query_logs`。
3. 实现 chunker。
4. 实现 embedding service。
5. 实现 vector store。
6. 实现 `/api/rag/index` 和 `/api/rag/query`。
7. 前端在数据管理页增加文件问答入口。

验收：

- 上传 PDF 后可索引。
- 对文件提问可返回答案。
- 回答包含引用片段。
- 删除文件后片段被删除。
- 原上传、预览、要素提取功能不受影响。

### 13.2 阶段二：增强检索质量

任务：

1. 混合检索。
2. 章节识别优化。
3. 表格片段保真。
4. Reranker 接入。
5. 查询日志评测面板。

### 13.3 阶段三：接入既有 AI 工作流

任务：

1. 要素提取支持 `use_rag`。
2. 模拟编制支持引用依据。
3. 多文件对比支持跨文件引用。
4. 数据管理页支持文件知识库视图。

---

## 14. 用户需要提前准备的事项

### 14.1 产品准备

必须先确定首期入口：

1. 数据管理页中的“问文件”。
2. 独立“知识库/RAG”页面。
3. 要素提取页中的“引用增强”。

推荐选择 1。

### 14.2 数据准备

需要准备：

1. 10-20 份脱敏招标文件。
2. 每份文件 5-8 个标准问题。
3. 每个问题的正确答案和所在页码。
4. 扫描 PDF、文本 PDF、表格密集 PDF 各至少 2 份。

### 14.3 技术准备

需要确认：

1. 生产 PostgreSQL 是否支持 pgvector。
2. 默认 embedding 供应商。
3. embedding 文本是否允许发送到云端模型。
4. RAG chunk 明文是否可以存数据库。
5. 是否需要对 chunk 内容再次加密。

### 14.4 成本准备

需要估算：

```text
总成本 ≈ 文件总字符数 / 平均 chunk 字符数 * 单 chunk embedding 成本
```

首期建议只在用户显式点击“建立索引”时索引，避免上传即产生不可控成本。

---

## 15. 关键决策

### 15.1 默认不自动索引

首期默认不在上传后自动索引，而是在文件详情中显示“建立 RAG 索引”按钮。

原因：

1. 避免上传大文件后自动产生 embedding 成本。
2. 避免索引失败影响用户对上传功能的判断。
3. 方便用户明确授权将文本片段发送给 embedding 供应商。

### 15.2 首期使用 pgvector

首期使用 pgvector，不引入独立向量数据库。

原因：

1. 当前系统已有 PostgreSQL 和 user_id 权限模型。
2. MVP 规模下 pgvector 足够。
3. 降低部署和维护复杂度。

### 15.3 首期不引入 LangChain

首期不引入 LangChain / LlamaIndex 作为核心框架。

原因：

1. 当前业务需要强引用、强权限、强可控的轻量链路。
2. 自建 5-6 个服务类即可满足 MVP。
3. 避免框架抽象侵入现有 FastAPI 服务结构。

---

## 16. 风险清单

| 风险 | 等级 | 应对 |
|------|------|------|
| pgvector 生产不可用 | 高 | 预留 VectorStore 接口，可切 Qdrant |
| 中文 embedding 效果差 | 高 | 准备黄金问答集，比较至少 2 个模型 |
| 扫描 PDF 解析质量差 | 高 | RAG 复用现有 OCR 证据链，低质量文件提示用户 |
| 表格切片破坏语义 | 中 | 表格转 Markdown 后作为独立 chunk |
| 成本超预期 | 中 | 手动索引、hash 去重、显示索引预估 |
| 回答幻觉 | 高 | 强制引用回答，无依据时拒答 |
| 用户数据泄漏 | 高 | user_id 过滤、删除级联、日志脱敏 |

---

## 17. 最小实现建议

如果只做第一版，按以下顺序实现：

1. 数据库增加 `rag_indexes`、`rag_chunks`。
2. 在后端实现 Markdown/text chunker。
3. 接入一个 embedding 模型。
4. 写入 pgvector。
5. 实现基于 file_id + user_id 的向量查询。
6. 实现非流式 `/api/rag/query`。
7. 前端文件详情增加“建立索引”和“问文件”。
8. 回答展示 citations。

第一版不要做：

- rerank
- 自动索引
- 跨用户知识库
- 复杂管理后台
- 精确 PDF 坐标高亮

---

## 18. 验收标准

功能验收：

1. 用户只能查询自己的文件片段。
2. 文件未索引时，前端提示建立索引。
3. 索引完成后，可对单文件提问。
4. 多文件提问时，引用能区分不同文件。
5. 回答必须显示引用片段。
6. 删除文件后，RAG 索引和 chunk 被删除。
7. RAG 失败不影响上传、预览、要素提取。

技术验收：

1. 通过后端单元测试。
2. 通过前端类型检查。
3. 本地完成一次真实 PDF 索引和问答。
4. 对至少 10 个黄金问题评测 Recall@8。
5. 不在日志输出 API Key 和大段文件内容。
