# 知识库与多文件问答设计规约：Bid Master Web

<meta>
  <document-id>bid-master-rag-spec</document-id>
  <version>3.0.0</version>
  <project>Bid Master Web</project>
  <type>Knowledge Base and RAG Design Specification</type>
  <created>2026-07-03</created>
  <updated>2026-08-16</updated>
  <depends>meta.md, real.md, cog.md, sys.spec.md, db.spec.md, code.spec.md</depends>
</meta>

---

## 1. 文档状态与实现基线

### 1.1 本版变更

本版替代 `2.0.0` 中 PostgreSQL + pgvector 的向量存储方案，并统一数据库、向量索引、Embedding 和 Mastra 接入边界。

确定的新方向是：

> 将知识库建设为功能区中的独立业务能力。登录用户可以创建多个私有知识库，为知识库添加多个文件，手动确认后异步建立向量索引，并在单个知识库范围内进行带引用的多文件问答。

本版同时确定以下基础架构：

1. Neon PostgreSQL 是唯一业务事实源，保存知识库、成员关系、索引状态、chunk 正文、引用定位、任务和审计数据。
2. Milvus（生产环境可使用兼容的 Zilliz Cloud）只保存可从 Neon 重建的语义索引，不保存不可替代业务事实。
3. 阿里云百炼中国内地（北京）地域的 `qwen3-vl-embedding` 是首期固定 Embedding 模型。
4. 自定义 `ZillizVectorStore` 实现项目锁定版本的 `MastraVector`，并作为 `vectorStore` 实例直接传入 `createVectorQueryTool`。
5. RAG 数据库模式由 Drizzle ORM 定义并生成迁移，业务和公开接口主键统一使用 UUID。
6. TypeScript/Mastra 运行在独立 Node.js >=22.13 RAG 服务中，不嵌入 Next.js 或 FastAPI 进程；生产由独立 `bidmaster-rag.service` 管理。
7. 浏览器只访问 Next.js 同源 API；FastAPI 负责认证、文件权限和解析，并通过受保护的内部 HTTP/SSE 协议调用 RAG 服务。

RAG 是知识库的底层检索增强机制，保留后续作为订阅服务可能性，目前全部开放。独立服务边界的正式决策见 `specs/dev/adr-rag-service-boundary.md`。

### 1.2 当前实现状态

当前工作区已经存在知识库页面、API、服务、Repository、切片、Embedding、向量存储和相关测试的在建实现，但主要实现仍基于 PostgreSQL + pgvector、Python 手写 Schema 和 `text-embedding-v4`。

这些在建模块不能作为本版技术选型的权威。继续开发前必须按本规约完成 Neon、Drizzle、Zilliz/Milvus、Mastra 和 `qwen3-vl-embedding` 的架构迁移；迁移完成前不得把现有实现视为生产就绪。

### 1.3 实现权威

知识库数据库结构实施时必须遵守：

1. RAG 业务数据库模式的编码权威是 Drizzle ORM Schema，迁移文件由 Drizzle Kit 生成并经过审查后应用到 Neon PostgreSQL。
2. Neon PostgreSQL 是知识库和 RAG 业务数据的唯一事实源；Zilliz/Milvus 中的数据必须可从 Neon 完整重建。
3. 不再以 `src/backend/app/infrastructure/db_schema.py` 中的手写 SQL 作为 RAG 表的 Schema 权威。
4. 当前 `db.spec.md`、`project-query-db.spec.md`、`src/db/schema.ts` 和 `db_schema.py` 中与本节冲突的旧声明属于迁移依赖，编码前必须统一，不能长期保留双重 Schema 权威。
5. 本文中的表结构用于定义目标模式；实际 SQL 必须由 Drizzle Schema 和生成迁移产生。
6. Mastra 接口以项目锁文件中的实际版本、对应 TypeScript 类型定义和官方文档为权威，不凭示例代码猜测方法签名。

### 1.4 数据通用规则

1. 面向业务和公开接口的表统一使用 UUID 主键，外键类型必须与被引用主键一致。
2. 时间字段统一使用 `timestamptz`，以 UTC 存储和解释；客户端仅负责本地化展示。
3. 表名、列名、索引名和约束名统一使用 `snake_case`。
4. 稳定实体和多对多关系使用关系表；JSONB 仅用于设置、统计快照或无法稳定建模的解析器附加属性。
5. 用户身份只能来自认证上下文；业务表不信任客户端提交的 `user_id`。
6. 每次读取、写入、更新和删除均显式校验认证用户的 `user_id`，不得依赖 UUID 难猜性。

---

## 2. 产品定位

### 2.1 一句话定义

知识库是用户组织招投标资料、建立可检索索引并进行带引用多文件问答的私有工作空间。

### 2.2 核心价值

招投标文件通常篇幅长、结构复杂，并包含扫描页、表格、资格条款和评分规则。用户需要的不是模型常识，而是可以回到原文件核验的依据。

知识库提供以下能力：

1. 将用户凡是做了要素提取的文件，都以卡片形式存在知识库里面
2. 将知识库里面的卡片进行组织编排，按照区域、项目类型（设备、设计、工程）进行分类。
3. 使用语义检索和关键词补召回查找相关片段。
4. 基于检索结果生成回答，并返回文件、页码、章节和引用内容。
5. 在依据不足时拒绝猜测，降低幻觉风险。

### 2.3 不替代的能力

知识库不替代现有的：

- 文件上传、加密存储、预览和下载。
- PDF、OCR 和表格解析。
- 招标文件要素提取。
- 招标文件模拟编制。
- 开标报价分析。
- 确定性的报价排名、降价幅度和离散系数计算。

知识库首期以旁路方式接入，失败不得影响既有功能。

---

## 3. 用户闭环

### 3.1 首期完整流程

1. 用户从功能区左侧页边栏进入“知识库”。
2. 用户查看自己的知识库列表。
3. 用户创建知识库，填写名称和可选说明。
4. 用户从文件管理中选择已有文件，或在知识库页面上传新文件。
5. 文件加入知识库后显示“未索引”，不会自动调用 Embedding。
6. 用户选择文件并点击“开始索引”。
7. 系统显示确认提示：
   - 待索引文件数量。
   - 使用的 Embedding 供应商和模型。
   - 文件文本片段将发送至 DashScope。
   - 调用可能产生模型费用。
   - 索引异步执行，不影响文件预览和其他分析功能。
8. 用户确认后，后端创建持久化索引任务并异步处理。
9. 页面展示每个文件的索引状态、片段数量和失败原因。
10. 至少一个文件索引完成后，用户可对整个知识库提问。
11. 用户可将查询范围限制为知识库内部分文件。
12. 系统返回回答、引用和未参与检索的文件列表。
13. 用户可重试失败文件、重建过期索引或从知识库移除文件。

### 3.2 典型问题

- “本项目投标人资格要求有哪些？”
- “评分办法里价格分怎么计算？”
- “哪些情形会导致废标？”
- “项目负责人有哪些资质要求？”
- “招标文件和补充公告对保证金的要求有什么差异？”
- “答疑文件对原评分办法做了哪些修改？”
- “不同地区分别有哪些招标特点，有什么重大区别”
- “不同年份的招标文件有什么特点，有什么重大区别”

### 3.3 状态定义

知识库文件的索引状态固定为：

| 状态 | 含义 |
|------|------|
| `not_indexed` | 已加入知识库，尚未建立索引 |
| `pending` | 已创建索引任务，等待处理 |
| `processing` | 正在解析、切片或生成向量 |
| `completed` | 当前索引版本可用于查询 |
| `failed` | 本次索引失败，可查看原因并重试 |
| `stale` | 文件、切片版本或 Embedding 配置变化，需要重建 |

索引任务状态固定为：

- `pending`
- `processing`
- `completed`
- `partial_failed`
- `failed`
- `cancelled`

知识库页面状态优先通过成员文件状态聚合，不重复维护容易失真的知识库级索引状态。

---

## 4. 功能边界

### 4.1 首期包含

1. 登录用户创建、查看、修改和删除自己的知识库。
2. 一个用户创建多个私有知识库。
3. 一个知识库包含多个用户自有文件。
4. 同一文件加入同一用户的多个知识库。
5. 从文件管理选择已有文件，或上传新文件后加入知识库。
6. 手动确认并异步建立索引。
7. 文件级索引状态、失败原因、重试和重建。
8. 单知识库内单文件或多文件问答。
9. 返回文件、页码范围、章节和片段引用。
10. 按 `user_id` 严格隔离知识库、成员、索引、片段、任务和查询。
11. 删除知识库、移除成员、删除原始文件时执行明确的级联清理。

### 4.2 首期不做

1. 公开知识库和知识库市场。
2. 跨用户共享和团队复杂 ACL。
3. 跨知识库联合查询。
4. 上传文件后自动索引。
5. 用户自由切换 Embedding 模型和向量维度。
6. 多轮长期记忆和永久聊天历史。
7. 基于知识库自动生成完整投标文件。
8. 对原 PDF 的精确坐标高亮。
9. 对所有现有 AI 任务强制启用 RAG。
10. 首期不自建 Milvus 集群；生产环境优先使用托管 Zilliz Cloud，开发和专有部署可使用兼容的 Milvus。
11. 首期不引入 LangChain 或 LlamaIndex；RAG 工具编排使用 Mastra。
12. 首期不强制引入 Rerank 服务。

---

## 5. 信息架构与前端设计

### 5.1 导航入口

知识库入口必须放在功能区左侧页边栏，对应：

```text
src/frontend/components/layout/WorkbenchLayout.tsx
```

不得将顶部导航组件 `src/frontend/components/layout/Sidebar.tsx` 误认为本次要求的左侧页边栏。

推荐导航结构：

```text
首页

项目机会查询
└── 项目查询

招标文件处理
├── 要素提取
└── 模拟编制

开标数据分析
└── 开标分析

知识与数据
├── 文件管理
└── 知识库

系统工具
├── AI 设置
└── 系统日志
```

知识库是业务能力，不归入“系统工具”。顶部导航首期不重复增加知识库入口。

### 5.2 路由

用户可见路由统一使用：

```text
/knowledge
/knowledge/[knowledgeBaseId]
```

不使用 `/rag` 作为用户可见路由。

### 5.3 知识库列表页

`/knowledge` 至少包含：

- 新建知识库。
- 搜索和状态筛选。
- 名称和说明。
- 文件数量。
- 已索引、索引中、失败和过期文件数量。
- 最近更新时间。
- 进入、重命名和删除操作。
- 空状态和未登录状态。

### 5.4 知识库详情页

`/knowledge/[knowledgeBaseId]` 至少包含：

1. 文件管理区：
   - 添加已有文件。
   - 上传新文件。
   - 选择文件。
   - 从知识库移除。
2. 索引区：
   - 文件级索引状态。
   - 开始索引。
   - 查看失败原因。
   - 重试失败文件。
   - 重建过期索引。
3. 问答区：
   - 默认查询整个知识库。
   - 可选择部分文件。
   - 问题输入。
   - 流式回答。
4. 引用区：
   - 文件名。
   - 页码范围。
   - 章节路径。
   - 片段预览。
   - 查看原文入口。

相似度、向量距离和召回来源只在调试模式展示，不作为普通用户的主要信息。

### 5.5 移动端可达性

当前功能区左侧栏在小屏幕下隐藏。正式实施时必须提供移动端抽屉、菜单入口或等价工作台入口，不能只实现桌面端可达性。

### 5.6 关键文案

统一使用：

- “知识库”
- “开始索引”
- “重建索引”
- “问知识库”
- “引用来源”

普通用户界面不使用“建立 RAG 索引”等技术化文案。

---

## 6. 总体架构

### 6.1 数据边界

1. 浏览器只访问 Next.js 同源 API，不直接访问 FastAPI、RAG、Neon 或 Zilliz。
2. FastAPI 负责认证、文件权限、加密文件存储和解析，不保存知识库向量索引。
3. 独立 Node.js RAG 服务负责知识库索引、检索、引用问答和向量库交互，不承担文件上传和既有业务解析职责。
4. Neon PostgreSQL 是知识库业务事实源；Zilliz Cloud / Milvus 仅保存可重建的语义索引。
5. 所有 RAG 相关调用必须通过受保护的内部 HTTP/SSE 协议，并携带服务间凭据与请求上下文。

```text
Client
  │
  ▼
Next.js 知识库页面 / 同源 API
  │  浏览器认证上下文
  ▼
FastAPI 认证与文件业务网关
  ├── JWT 解析、用户/文件权限
  ├── 加密文件存储
  ├── PDF/OCR/文本解析
  └── 内部 HTTP/SSE client
         │  服务间凭据 + X-Authenticated-User-Id + X-Request-Id
         ▼
独立 Node.js >=22.13 RAG 服务（Mastra）
  ├── Drizzle ORM / Neon 事实模型
  ├── 索引任务与 Neon outbox worker
  ├── qwen3-vl-embedding
  ├── ZillizVectorStore / MastraVector
  ├── 检索、Neon 二次授权、引用问答
  └── RAG SSE 状态机
         │
         ├── Neon PostgreSQL             # 唯一业务事实源
         └── Zilliz Cloud / Milvus        # 可重建语义索引
```

服务边界决策记录在 `specs/dev/adr-rag-service-boundary.md`。浏览器不得直连 RAG 服务、Neon 或 Zilliz；生产由 Next.js、FastAPI 和独立 `bidmaster-rag.service` 三个受控运行单元组成。
### 6.2 索引写入流程

1. 用户确认“开始索引”后，服务端验证知识库、文件和认证用户归属。
2. 文件解析和切片结果写入 Neon，并在同一事务写入向量操作 outbox。
3. worker 消费 outbox，调用阿里云百炼北京地域 `qwen3-vl-embedding`。
4. worker 通过 `ZillizVectorStore` 幂等写入 Zilliz。
5. Zilliz 写入成功后回写 Neon 索引状态；失败时保留可重试状态。
6. 不采用 Neon 与 Zilliz 的跨库强事务假设，通过 outbox、幂等、重试和对账实现最终一致性。

### 6.3 非破坏性接入

1. 文件上传接口维持原有响应行为。
2. 上传和加入知识库只创建“未索引”状态，不自动解析文本或调用 Embedding。
3. 只有用户确认后才创建持久化索引任务。
4. 索引失败不改变原文件上传成功状态。
5. 要素提取、模拟编制和开标分析默认走原链路。
6. Zilliz、Mastra 或 Embedding 不可用时，仅知识库索引和问答不可用。
7. 后续接入其他工作流必须通过显式开关另行设计。

---

## 7. Embedding 选型

### 7.1 首期固定方案

| 项目 | 决策 |
|------|------|
| 服务 | 阿里云百炼 |
| 地域 | 中国内地（北京） |
| 模型 | `qwen3-vl-embedding` |
| 模型文档 | `https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market/detail/qwen3-vl-embedding?serviceSite=asia-pacific-china` |
| 调用封装 | 服务端独立 `EmbeddingService` |
| 凭据来源 | 仅服务端环境变量 `DASHSCOPE_API_KEY` |
| Chat 模型关系 | 与 Chat LLM 完全独立 |
| 向量维度 | 编码前依据北京地域官方文档和真实 API 响应确认，不得猜测 |
| 向量存储 | Zilliz Cloud / Milvus collection |

选择原因：

1. 知识库主要处理中文招投标文本，并可能包含页面图像、表格和多模态内容。
2. 中国内地（北京）地域更符合当前生产环境的网络和数据出站边界。
3. 固定模型和版本可以避免同一有效索引混用不兼容向量。
4. 维度属于模型 API 与 collection schema 的外部契约，不能沿用旧模型的固定值。

### 7.2 配置要求

```env
KNOWLEDGE_BASE_ENABLED=true
RAG_EMBEDDING_PROVIDER=dashscope
RAG_EMBEDDING_MODEL=qwen3-vl-embedding
RAG_EMBEDDING_REGION=cn-beijing
DASHSCOPE_API_KEY=
ZILLIZ_URI=
ZILLIZ_TOKEN=
RAG_EMBEDDING_BATCH_SIZE=10
RAG_VECTOR_TOP_K=30
RAG_KEYWORD_TOP_K=20
RAG_CONTEXT_K=8
RAG_INDEX_VERSION=qwen3-vl-embedding-v1
RAG_CHUNKING_VERSION=v1
```

安全要求：

1. `DASHSCOPE_API_KEY`、`ZILLIZ_URI`、`ZILLIZ_TOKEN` 只能从服务端运行环境读取。
2. 三项凭据不得存入 Neon PostgreSQL、索引任务载荷、outbox、日志、异常详情、API 响应或客户端包。
3. 不使用 `NEXT_PUBLIC_` 前缀暴露上述变量。
4. 不允许用户通过设置页面或请求参数覆盖 RAG Embedding 凭据、模型或向量库连接。

批量上限、单次输入上限和限流规则必须以北京地域当前模型文档为准，并通过真实 API 烟雾测试确认；规约不复制可能变化的供应商限制作为永久常量。

### 7.3 模型与维度一致性

文档片段与用户问题必须使用：

- 相同地域。
- 相同模型。
- 相同调用参数和输出维度。
- 兼容的 collection 与索引版本。

编码阶段必须先完成一个最小真实调用并记录：模型、地域、请求参数、实际向量长度、测试时间和 Zilliz collection 配置。未确认维度时不得创建生产 collection 或写入猜测值。

索引记录必须保存：

```text
embedding_provider
embedding_region
embedding_model
embedding_dimension
collection_name
chunking_version
index_version
```

以下四处必须一致：

1. 百炼响应的实际向量长度。
2. Neon `rag_indexes.embedding_dimension`。
3. Zilliz collection vector field dimension。
4. 当前 `index_version` 对应的配置。

任一不一致时必须失败关闭，禁止截断、补零或混写。模型、维度、切片版本或索引版本变化时，旧索引标记为 `stale`，创建版本化 collection 并全量重建；重建完成前旧有效版本可以继续服务查询。

### 7.4 扩展边界

实现层保留版本化的 Embedding 调用边界，但首期产品不向用户开放模型切换。未来更换模型必须先完成效果、成本、维度、数据地域和重建策略评审，不允许静默回退到其他模型。

---

## 8. Neon PostgreSQL 与 Zilliz/Milvus

### 8.1 固定选型

| 项目 | 决策 |
|------|------|
| 业务数据库 | Neon PostgreSQL，作为唯一业务事实源 |
| 向量数据库 | Milvus；生产环境可使用兼容的 Zilliz Cloud |
| Schema 与迁移 | Drizzle ORM 定义模式并生成迁移 |
| 一致性 | Neon 事务 + outbox + Zilliz 幂等操作和对账 |
| 授权边界 | Neon 中的认证 `user_id` 和知识库成员关系 |

Zilliz/Milvus 不是第二业务数据库。它只保存可重建语义索引；完整 chunk 正文、文件信息、索引状态、任务状态、权限和引用位置必须以 Neon 为准。

### 8.2 Mastra 接入

实现自定义 `ZillizVectorStore`，满足项目当前锁定版本的 `MastraVector` 契约，并将实例直接传入 `createVectorQueryTool`：

```ts
const vectorStore = new ZillizVectorStore(serverOnlyConfig)

const vectorQueryTool = createVectorQueryTool({
  vectorStore,
  // 其他参数以当前 Mastra 版本的类型定义为准
})
```

实施门禁：

1. 从 lockfile 确认 Mastra 相关包和精确版本。
2. 对照该版本的 TypeScript 类型定义和官方文档，确认 `MastraVector` 的实现方式、必需方法、filter 格式、返回类型和 `createVectorQueryTool` 的准确签名。
3. 适配器必须通过 TypeScript 编译期契约检查，禁止使用 `any`、不安全类型断言或旁路包装掩盖不兼容。
4. Mastra 升级必须重新运行适配器契约测试；不兼容时阻止升级或同步修改适配器。
5. `serverOnlyConfig` 只能在服务端读取 `ZILLIZ_URI` 和 `ZILLIZ_TOKEN`。

### 8.3 Zilliz collection 边界

collection 至少包含：

- `chunk_id`：Neon `rag_chunks.id` 的 UUID 字符串表示。
- `vector`：维度与当前索引版本严格一致。
- `user_id`：仅用于候选预过滤。
- `file_id`。
- `index_id`。
- `index_version`。
- 可选的 `chunk_type` 等低敏感检索字段。

禁止默认保存：

- 完整 chunk 正文。
- 文件完整内容或可还原文件的大段上下文。
- 业务状态的唯一副本。
- API Key、URI、Token 或任务载荷。

collection 名称必须版本化。模型、维度或 metric 变化时创建新 collection 并重建，禁止在同一向量字段混用不兼容数据。

### 8.4 双重隔离与不可用策略

1. Zilliz 查询先使用 `user_id`、允许的 `file_id` 和 `index_version` 预过滤。
2. 任何候选进入上下文前，都必须回 Neon 按认证用户、知识库成员关系、chunk UUID 和有效索引状态二次授权。
3. Zilliz metadata 中的 `user_id` 不是最终权限证据。
4. Neon 中不存在、已删除、已过期或越权的候选必须直接丢弃。
5. `KNOWLEDGE_BASE_ENABLED=false` 时，向量服务缺失不得导致既有业务启动失败。
6. 启用知识库但 Zilliz、Mastra 或 Embedding 不可用时，索引和问答 API 返回明确的功能不可用错误。
7. 不允许静默退化为无向量、无提示的普通 Chat 问答。

### 8.5 删除与重建

1. 删除知识库、成员或原始文件时，先在 Neon 事务中使相关业务记录立即不可查询，并写入 delete outbox。
2. worker 对 Zilliz 执行幂等删除；失败可重试，不恢复 Neon 中的业务可见性。
3. 即使 Zilliz 暂时残留陈旧向量，Neon 二次授权也必须阻止其进入回答。
4. 系统必须支持按索引版本从 Neon chunk 全量重建 Zilliz collection。
5. 定期对账 Neon chunk 数量、索引版本和 Zilliz 实体，发现漂移后生成可审计的修复任务。

---

## 9. 文档解析与切片

### 9.1 解析复用

知识库不重新建设文件解析链路：

- PDF：复用现有文本提取和 OCR 服务。
- Markdown：按标题层级解析。
- Word：复用现有转换或 `python-docx` 能力。
- Excel/CSV：首期不进入知识库正文索引，继续用于开标数据分析。

索引失败不能改变原文件的可用状态。

### 9.2 切片策略

招投标文件不能只按固定字符数切片。首期采用：

1. 章节切片：按 Markdown 标题、目录编号和常见条款标题切分。
2. 结构切片：对段落、列表和表格块继续拆分。
3. 长度兜底：超出上限时按字符或 token 切分。

建议参数：

| 参数 | 建议值 |
|------|--------|
| `chunk_size` | 800-1200 中文字符 |
| `chunk_overlap` | 120-200 中文字符 |
| `min_chunk_chars` | 80 |
| `context_k` | 8 |

每个 chunk 必须保留：

- `user_id`
- `file_id`
- `file_name`
- `source_hash`
- `page_start`
- `page_end`
- `section_path`
- `chunk_index`
- `content_hash`
- `chunk_type`
- `extraction_method`

表格应尽量转换为结构稳定的 Markdown 表格，并作为独立 chunk 保存。

---

## 10. Neon 事实模型与 Zilliz 派生索引

### 10.1 设计原则

1. RAG 表由 Drizzle ORM Schema 定义并生成迁移，不维护第二套手写建表 SQL。
2. Neon 保存所有业务事实；Zilliz 只保存可重建派生向量。
3. 知识库成员关系与文件级索引分离，同一用户的相同文件、源哈希、模型和版本可以复用索引。
4. 所有用户所属表显式保存非空 `user_id`，每次操作均使用认证用户 ID 过滤。
5. 所有业务和公开接口主键使用 UUID；时间字段使用 `timestamptz` UTC。
6. 稳定关系使用外键表，不使用 JSONB 保存稳定 ID 数组。
7. Neon 与 Zilliz 通过 outbox、幂等消费和对账实现最终一致性，不尝试跨库分布式事务。

下面的字段表是 Drizzle Schema 的目标约束，实际迁移必须由 Drizzle Kit 生成并审查。

### 10.2 `knowledge_bases`

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | UUID | 主键，默认随机 UUID |
| `user_id` | UUID | 非空，关联认证用户 |
| `name` | VARCHAR(200) | 非空 |
| `description` | TEXT | 可空 |
| `created_at` | TIMESTAMPTZ | 非空，UTC |
| `updated_at` | TIMESTAMPTZ | 非空，UTC |

索引至少覆盖 `user_id`。推荐增加同一用户名称标准化后的唯一约束，禁止忽略大小写后的重名知识库。

### 10.3 `knowledge_base_files`

| 字段 | 类型 | 约束 |
|------|------|------|
| `knowledge_base_id` | UUID | 非空，关联知识库 |
| `file_id` | UUID | 非空，关联文件 |
| `user_id` | UUID | 非空，关联认证用户 |
| `added_at` | TIMESTAMPTZ | 非空，UTC |

以 `(knowledge_base_id, file_id)` 为复合主键或唯一约束，并为 `user_id`、`file_id` 建立索引。添加成员时必须验证知识库和文件均属于认证用户；不能信任请求体中的 `user_id`。

### 10.4 `rag_indexes`

文件级可复用索引至少保存：

- UUID `id`、`user_id`、`file_id`。
- `source_hash`。
- `embedding_provider`、`embedding_region`、`embedding_model`、经验证的 `embedding_dimension`。
- `collection_name`、`chunking_version`、`index_version`。
- `status`、`chunk_count`、`vector_count`。
- `error_code`、经过脱敏的 `error_message`。
- `started_at`、`completed_at`、`created_at`、`updated_at`，均为 `timestamptz` UTC。

唯一约束至少覆盖：

```text
user_id + file_id + source_hash + embedding_region + embedding_model
+ embedding_dimension + chunking_version + index_version
```

只有 `completed` 且版本完全匹配的索引可以参与查询。Zilliz collection 名称只是派生索引定位信息，不是业务状态来源。

### 10.5 `rag_index_jobs` 与 `rag_index_job_files`

`rag_index_jobs` 保存 UUID 主键、知识库、认证用户、任务状态、成功/失败计数、脱敏错误摘要和时间字段。

请求文件集合使用关系表 `rag_index_job_files`，至少包含：

- UUID `job_id`。
- UUID `file_id`。
- UUID `user_id`。
- 文件级状态、错误代码和处理时间。

禁止使用 `requested_file_ids JSONB` 保存稳定关系。任务和文件状态必须持久化，用于恢复、轮询、部分成功和故障审计。

### 10.6 `rag_chunks`

Neon `rag_chunks` 保存业务正文和引用定位，不保存向量列。至少包含：

- UUID `id`、`index_id`、`file_id`、`user_id`。
- `chunk_index`、`chunk_type`、`section_path`。
- `page_start`、`page_end`。
- `content`、`content_hash`、`token_count`。
- `extraction_method`、`source_hash`。
- `metadata` JSONB，仅用于无法稳定建模的解析器附加属性。
- `created_at`、`updated_at`，均为 `timestamptz` UTC。

索引至少覆盖 `(user_id, file_id)`、`(index_id, chunk_index)`，并对 `(index_id, content_hash)` 建立唯一约束。关键词召回所需的全文或 trigram 索引应作为 Neon 数据库能力单独评估，不得重新引入向量列。

### 10.7 `rag_vector_operations`

该 outbox 表用于同步 Zilliz 派生索引，至少包含：

- UUID `id`、`user_id`、`index_id`、可选 `chunk_id`。
- `operation`：`upsert`、`delete`、`rebuild`。
- `collection_name`、`index_version`、幂等键。
- `status`、`attempt_count`、`next_retry_at`、脱敏 `last_error`。
- `created_at`、`updated_at`、`completed_at`，均为 `timestamptz` UTC。

outbox 与 chunk/index 事实变更在同一 Neon 事务提交。worker 按至少一次投递设计，Zilliz upsert/delete 必须幂等；任务载荷不得包含任何连接凭据。

### 10.8 查询日志与稳定关系

`rag_query_logs` 只用于脱敏审计、性能分析和检索评测，不作为聊天历史。主表保存 UUID、知识库、认证用户、脱敏问题、Chat 模型、延迟和时间字段；`token_usage` 等统计快照可以使用 JSONB。

稳定关系拆分为：

- `rag_query_log_files`：查询选择或排除的文件及原因。
- `rag_query_log_chunks`：召回的 chunk、排名、语义分数、关键词分数和融合分数。
- `rag_query_log_citations`：最终引用的 chunk 和引用编号。

禁止使用 `selected_file_ids`、`retrieved_chunk_ids` 或 `cited_file_ids` JSONB 数组替代关系表。如未来需要多轮会话，新增独立 conversation、message 和 citation 表。

### 10.9 Zilliz collection 模式

Zilliz 中每条实体以 Neon `rag_chunks.id` 的 UUID 字符串作为 `chunk_id`，并保存向量、`user_id`、`file_id`、`index_id`、`index_version` 和必要的低敏感过滤字段。

collection 不保存完整正文。回答、文件名、页码、章节和引用预览均从 Neon 读取。collection 被清空或损坏时，系统必须能依据 Neon 中的有效索引和 chunk 重建。

### 10.10 删除语义

| 操作 | Neon 事实结果 | Zilliz 派生结果 |
|------|---------------|-----------------|
| 删除知识库 | 删除成员、知识库任务和查询审计，不删除原始文件 | 写入必要清理事件；共享文件索引可保留 |
| 从知识库移除文件 | 删除成员关系，立即不可通过该知识库查询 | 共享索引可保留 |
| 删除原始文件 | 删除全部成员、文件索引和 chunk，并写 delete outbox | 幂等删除相关向量 |
| 删除用户 | 删除其全部业务和派生记录，并写清理事件 | 最终清理该用户向量 |
| 更换模型、维度或版本 | 旧索引标记 `stale`，新版本完成前保留旧有效版本 | 新建版本化 collection 并重建 |
| 同一文件加入多个知识库 | 复用同一用户当前有效的文件索引 | 复用同一派生向量 |

Neon 删除提交后业务可见性立即失效；Zilliz 物理删除允许最终一致。任何陈旧命中必须在 Neon 二次授权阶段被丢弃。

---

## 11. 手动异步索引

### 11.1 唯一触发策略

> 文件上传或加入知识库后默认不索引。只有用户确认“开始索引”后，系统才允许解析文本并调用 Embedding 服务。

这项策略用于：

1. 控制模型调用成本。
2. 获得明确的数据出站授权。
3. 避免索引失败影响上传体验。
4. 允许用户只索引真正需要问答的文件。

### 11.2 任务行为

1. 添加文件只创建知识库成员关系。
2. 创建索引任务返回 HTTP `202 Accepted` 和 `job_id`。
3. 后端按有限并发处理任务中的文件。
4. 每个文件独立更新状态，允许部分成功。
5. 已存在相同有效索引时直接复用，不重复生成向量。
6. `failed` 文件支持重试。
7. 只有显式 `force=true` 才重建当前有效索引。
8. 重建成功前，旧有效版本可以继续服务查询；切换必须是原子的。

### 11.3 首期任务执行器

首期索引执行器必须围绕 Neon 中的持久化任务和 outbox 工作。可以暂由单进程 worker 执行，但不得把任务状态仅保存在进程内：

- 任务、文件状态和向量操作写入 Neon。
- 进程启动时检查遗留的 `processing` 任务和未完成 outbox。
- 超时或中断任务转为可重试状态，不永久卡死。
- 单文件索引、Zilliz upsert/delete 和状态回写均幂等。
- 不承诺跨多实例的可靠调度。

出现以下任一条件时，应迁移到独立可靠 Worker 或任务队列：

- 部署多个后端或 Mastra 实例。
- 需要可靠投递、自动重试和死信处理。
- 大文件索引并发显著增加。
- 进程重启导致的任务中断不可接受。

无论执行器如何演进，Neon outbox 均是待同步操作的事实来源。

---

## 12. 检索与问答

### 12.1 查询边界

每次查询必须满足：

1. `user_id` 来自服务端认证上下文，不接受请求体身份声明。
2. 知识库属于当前认证用户。
3. 允许参与检索的文件来自该知识库成员关系。
4. 可选 `file_ids` 必须全部属于当前知识库和当前用户。
5. 只有当前版本为 `completed` 的文件索引参与查询。
6. Zilliz 预过滤和 Neon 正文回填均限制认证 `user_id` 与允许的 `file_id` 集合。

不得直接信任前端提交的知识库 ID、文件 ID、索引 ID、chunk ID或任务 ID；也不得把 Zilliz metadata 当作最终授权依据。

### 12.2 检索流程

1. 从认证上下文取得 `user_id` 并验证知识库归属。
2. 从 Neon 获取可检索成员文件和当前有效索引版本。
3. 记录未索引、处理中、失败和过期的排除文件。
4. 使用北京地域 `qwen3-vl-embedding` 生成与当前 collection 维度一致的查询向量。
5. 通过注入自定义 `ZillizVectorStore` 的 `createVectorQueryTool` 执行语义召回。
6. Zilliz 按 `user_id`、允许的 `file_id` 和 `index_version` 预过滤，只返回候选 `chunk_id` 和检索分数。
7. 使用 Neon 对项目名称、证书编号、条款名和精确词执行关键词补召回，查询同样显式过滤用户与文件范围。
8. 将 Zilliz 候选回 Neon，按 `chunk_id + user_id + file_id + completed index` 二次授权并读取正文；丢弃陈旧、不存在或越权候选。
9. 使用 Reciprocal Rank Fusion（RRF）合并语义与关键词排序列表。
10. 去重并合并相邻片段，限制单个文件进入上下文的片段数量。
11. 选择前 `context_k=8` 个证据片段；二次授权后候选不足时可扩大一次召回窗口，但不得绕过授权。
12. 组装结构化上下文并调用现有 Chat LLM。
13. 校验回答中的引用编号，返回回答、Neon 来源引用、排除文件和使用量。

不使用未经归一化的：

```text
vector_score * 0.7 + keyword_score * 0.3
```

Zilliz metric 分数和关键词分数不在相同数值空间，首期统一使用 RRF。普通响应中的 `score` 是应用层融合分数，不是未经转换的 Milvus distance。

### 12.3 多文件规则

- 默认查询知识库中全部已完成索引的文件。
- 用户可限制为知识库内部分文件。
- 至少一个文件可检索时允许问答。
- 所有文件都不可检索时不调用 Chat LLM，直接返回业务错误。
- 部分文件不可用时，回答必须提示知识覆盖不完整。
- 对比类问题应尽量从不同文件召回证据，避免全部片段来自单一文件。
- 不允许未索引文件被静默当作已检索文件。

### 12.4 上下文格式

```text
你只能依据以下知识库片段回答。
若片段不足以回答，请明确说明“未在所选文件中找到足够依据”。
不得使用模型常识补全文件中没有的事实。

[片段 1]
文件：项目招标文件.pdf
页码：18-19
章节：第三章 投标人资格要求
内容：...

[片段 2]
文件：补充公告.pdf
页码：3
章节：评分办法调整
内容：...
```

### 12.5 引用结构

```json
{
  "answer": "投标人须具备……[1][2]",
  "citations": [
    {
      "citation_id": 1,
      "knowledge_base_id": "kb-id",
      "chunk_id": "chunk-id",
      "file_id": "file-id",
      "file_name": "项目招标文件.pdf",
      "page_start": 18,
      "page_end": 19,
      "section_path": "第三章 投标人资格要求",
      "content_preview": "投标人须具备……",
      "score": 0.82
    }
  ],
  "excluded_files": [
    {
      "file_id": "file-id-2",
      "file_name": "答疑文件.pdf",
      "reason": "index_failed"
    }
  ],
  "usage": {}
}
```

引用要求：

1. 回答中的编号必须能映射到 `citations`。
2. 每个事实性关键结论应至少有一个引用。
3. 引用必须包含原始文件和可定位位置。
4. 未找到足够依据时必须拒答，不生成伪引用。

---

## 13. API 设计

面向前端使用知识库资源域 API；内部服务可以继续使用 `rag_*` 命名。

### 13.1 知识库 CRUD

```text
POST   /api/knowledge-bases
GET    /api/knowledge-bases
GET    /api/knowledge-bases/{knowledge_base_id}
PATCH  /api/knowledge-bases/{knowledge_base_id}
DELETE /api/knowledge-bases/{knowledge_base_id}
```

### 13.2 成员文件

```text
POST   /api/knowledge-bases/{knowledge_base_id}/files
GET    /api/knowledge-bases/{knowledge_base_id}/files
DELETE /api/knowledge-bases/{knowledge_base_id}/files/{file_id}
```

添加文件请求：

```json
{
  "file_ids": ["file-id-1", "file-id-2"]
}
```

后端必须验证每个文件属于当前用户。

### 13.3 索引任务

```text
POST /api/knowledge-bases/{knowledge_base_id}/index-jobs
GET  /api/knowledge-bases/{knowledge_base_id}/index-jobs/{job_id}
```

请求：

```json
{
  "file_ids": ["file-id-1", "file-id-2"],
  "force": false
}
```

响应：

```json
{
  "success": true,
  "data": {
    "job_id": "job-id",
    "status": "pending"
  }
}
```

接口行为必须幂等：

- 有完全匹配的 `completed` 索引时复用。
- 有同文件正在处理的任务时返回现有状态。
- `failed` 时允许重新提交。
- 只有 `force=true` 才触发重建。

### 13.4 问答

```text
POST /api/knowledge-bases/{knowledge_base_id}/query
POST /api/knowledge-bases/{knowledge_base_id}/query/stream
```

请求：

```json
{
  "question": "补充公告对评分办法做了哪些修改？",
  "file_ids": ["optional-file-id-1", "optional-file-id-2"],
  "provider": "deepseek",
  "model": "optional-chat-model"
}
```

### 13.5 API 通用安全规则

1. 所有资源 ID 使用 UUID 字符串。
2. API 不接受 `user_id` 作为身份来源，只使用服务端认证上下文。
3. `provider` 和 `model` 仅指 Chat LLM，不得覆盖固定 Embedding 模型、地域、维度或 Zilliz collection。
4. `top_k`、`context_k` 和阈值由服务端限制，不向普通前端开放任意调整。
5. API 不返回 `DASHSCOPE_API_KEY`、`ZILLIZ_URI`、`ZILLIZ_TOKEN` 或可推导凭据的错误详情。

流式事件：

- `retrieving`
- `excluded_files`
- `citation`
- `content`
- `done`
- `error`

---

## 14. 计划新增或调整的模块

目标模块边界如下，具体路径在编码阶段按现有 Next.js、FastAPI 和 Mastra 目录约定确定：

| 模块 | 职责 |
|------|------|
| `KnowledgeBaseService` | 知识库 CRUD、成员管理和认证用户权限验证 |
| `RagRepository` | 仅访问 Neon 中的业务事实和稳定关系 |
| `RagIndexService` | 索引任务编排、幂等、恢复、版本和状态管理 |
| `RagChunker` | 文档切片和引用元数据提取 |
| `EmbeddingService` | 服务端调用北京地域 `qwen3-vl-embedding` 并校验实际维度 |
| `ZillizVectorStore` | 实现当前版本 `MastraVector`，管理 Zilliz 可重建索引 |
| `RagVectorWorker` | 消费 Neon outbox，执行幂等 upsert/delete、重试和状态回写 |
| `RagRetriever` | Zilliz 预过滤、Neon 关键词召回、二次授权、RRF 和去重 |
| `RagAnswerService` | 只使用从 Neon 授权并读取的上下文，调用 Chat LLM 和校验引用 |

Mastra 接入必须复用：

```text
ZillizVectorStore 实例
  └── 作为 vectorStore 参数传入 createVectorQueryTool
```

不得继续维护以 PostgreSQL 向量列为目标的 `VectorStore` 实现。编码时需要同步调整：

- Drizzle RAG Schema 和生成迁移。
- 服务端 Mastra、Zilliz 和百炼依赖及配置。
- `.env.example` 中只保留空凭据占位和安全说明。
- 现有 FastAPI 解析/OCR 与 Mastra RAG 的职责边界。
- 前端知识库页面、API 封装、类型、Store 和测试。
- 删除或迁移当前 pgvector 专用代码、依赖和测试。

---

## 15. 安全与隐私

### 15.1 用户隔离

1. 每个知识库、成员、索引、chunk、任务、outbox 和查询审计记录必须显式绑定非空 `user_id`。
2. `user_id` 只从认证上下文取得；请求体中的同名字段不得作为授权依据。
3. 文件只能加入同一认证用户拥有的知识库。
4. 每个 API 首先验证知识库、文件、索引或任务归属。
5. Zilliz 使用 `user_id` 和允许文件预过滤，但所有候选必须回 Neon 二次授权。
6. 通过猜测 UUID 或伪造 Zilliz metadata、文件、索引、chunk、任务 ID均不能越权。
7. 所有负向权限路径必须有集成测试。

### 15.2 数据出站授权

添加文件不会向 Embedding 供应商或 Zilliz 发送内容。

用户确认“开始索引”前，前端必须提示：

- 系统会解析并切分文件文本。
- 文本或模型所需输入将发送至阿里云百炼中国内地（北京）地域生成向量。
- 生成的向量和最小定位元数据将写入 Zilliz Cloud/Milvus。
- 调用和向量存储可能产生费用。
- 用户可以取消，不影响文件管理和其他功能。

### 15.3 敏感派生数据

- 原始文件继续按现有安全规则存储。
- Neon 中的 `rag_chunks.content` 和 Zilliz 中的 embedding 属于敏感商业派生数据。
- Zilliz 默认不保存完整 chunk 正文；正文、文件名、页码和章节均从 Neon 获取。
- Neon 和 Zilliz 都需要最小权限、网络访问控制、传输加密及适当的备份策略。
- 如果未来要求 chunk 字段级加密，必须重新设计关键词检索和回答上下文读取，不能作为无影响的配置开关。

### 15.4 服务端凭据

- `DASHSCOPE_API_KEY`、`ZILLIZ_URI`、`ZILLIZ_TOKEN` 仅通过服务端环境变量提供。
- 三项凭据不得存入 Neon、用户 `api_keys` 配置、任务载荷、outbox 或测试 fixture。
- 不允许前端提交、覆盖或读取这些凭据，也不得使用 `NEXT_PUBLIC_` 暴露。
- 凭据不得硬编码、提交仓库、写入日志、异常详情、遥测或 API 响应。
- 测试使用假客户端或测试环境注入，不提交真实凭据。

### 15.5 日志

允许记录：

- 脱敏 query。
- 知识库、索引、chunk、文件和 outbox UUID。
- 延迟、token 使用量、排名和分数。
- 脱敏错误代码和重试次数。

禁止记录：

- `DASHSCOPE_API_KEY`、`ZILLIZ_URI`、`ZILLIZ_TOKEN`。
- 原始完整文件内容。
- 大段 chunk 明文或向量数组。
- 可直接还原用户商业文件的上下文请求体。
- 含连接串、Token 或供应商请求头的错误对象。

---

## 16. 评测指标

### 16.1 评测集

正式开发前准备：

1. 10-20 份真实或脱敏招投标文件。
2. 文本 PDF、扫描 PDF 和表格密集 PDF 各至少 2 份。
3. 每份文件 5-8 个黄金问题。
4. 每个问题的标准答案、所在文件、页码和章节。
5. 至少 5 个跨文件对比问题。
6. 至少 5 个文件中无依据、应该拒答的问题。

### 16.2 指标

| 指标 | 首期目标 |
|------|----------|
| Recall@8 | `>= 80%` |
| 引用准确率 | `>= 85%` |
| 引用可定位率 | `100%` |
| 索引成功率 | `>= 95%` |
| 无依据问题 | 必须拒答，不得编造引用 |
| 非流式查询延迟 | `<= 8 秒`，不含供应商异常 |
| 流式首内容延迟 | `<= 3 秒`，不含供应商异常 |
| 跨用户越权测试 | `100%` 拒绝 |
| Neon 二次授权拦截率 | 越权、陈旧和不存在候选 `100%` 丢弃 |
| 删除业务失效 | Neon 事务提交后立即不可检索 |
| Zilliz 可重建性 | 清空测试 collection 后可从 Neon 完整重建 |
| 向量契约一致性 | 模型、实际维度、collection 和索引版本 `100%` 一致 |
| outbox 幂等性 | 重复消费不产生重复业务结果 |

---

## 17. 落地阶段

### 17.1 阶段零：基础设施与契约确认

1. 确认 Neon PostgreSQL 项目、连接、事务能力和 Drizzle 迁移权限。
2. 确认认证专项 ADR 提供可信用户 ID，现有 `users`、`files` 主键可迁移或兼容 UUID 外键。
3. 确认阿里云百炼中国内地（北京）地域已开通 `qwen3-vl-embedding`。
4. 使用最小真实输入验证模型调用和实际向量维度，记录配置、时间和证据。
5. 确认 Zilliz Cloud/Milvus 连接、metric、collection 权限和服务端凭据注入。
6. 从 lockfile、TypeScript 类型和官方文档验证当前 `MastraVector` 与 `createVectorQueryTool` 契约。
7. 准备脱敏文件与黄金问题集。

### 17.2 阶段一：Neon 事实模型与资源管理

1. 使用 Drizzle 定义知识库、成员、索引、chunk、任务关系、查询关系和 outbox 表。
2. 生成、审查并应用 Neon 迁移。
3. 实现知识库 CRUD 和成员管理 API。
4. 实现认证用户来源和每次读写的显式 `user_id` 隔离。
5. 在功能区左侧栏增加“知识库”，实现列表和详情页面。
6. 支持添加已有文件和上传新文件，但不自动索引。

### 17.3 阶段二：手动异步索引与派生同步

1. 实现文档切片，正文和引用定位写入 Neon。
2. 实现北京地域 `qwen3-vl-embedding` 服务及维度校验。
3. 实现当前 Mastra 契约的 `ZillizVectorStore`，注入 `createVectorQueryTool`。
4. 创建版本化 Zilliz collection，写入最小派生索引。
5. 实现 Neon outbox、幂等消费、部分成功、重试、恢复和状态回写。
6. 实现文件哈希、模型、维度和版本过期检测。
7. 实现删除 outbox、Zilliz 最终清理和 Neon/Zilliz 对账重建。
8. 前端展示文件级索引状态和确认弹窗。

### 17.4 阶段三：多文件引用问答

1. 实现 Zilliz 知识库范围语义召回和最小字段预过滤。
2. 实现 Neon 关键词补召回、候选二次授权和正文回填。
3. 实现 RRF、多文件片段配额、相邻合并和去重。
4. 实现非流式和 SSE 流式问答。
5. 实现 citations、排除文件提示和无依据拒答。
6. 完成黄金问题、陈旧向量、删除延迟和跨用户权限评测。

### 17.5 阶段四：质量增强

1. Zilliz 索引参数和性能优化。
2. 表格和章节切片优化。
3. Rerank 评估与接入。
4. 独立可靠任务队列与死信处理。
5. 查询评测和 Neon/Zilliz 漂移监控面板。
6. 对话历史。
7. 要素提取和模拟编制的显式知识库增强。

---

## 18. 风险清单

| 风险 | 等级 | 检测 | 处置 |
|------|------|------|------|
| Neon 与 Zilliz 数据漂移 | 高 | outbox 积压、数量和 UUID 对账 | 幂等重试、定期对账、从 Neon 重建 |
| Zilliz 残留陈旧或越权候选 | 高 | 注入陈旧/跨用户候选的安全测试 | Neon 二次授权，候选不存在或越权即丢弃 |
| 模型实际维度与 collection 不一致 | 高 | 真实 API 烟雾测试和启动校验 | 失败关闭；禁止截断或补零；新建版本化 collection |
| Mastra 版本契约变化 | 高 | 锁文件、TypeScript 编译和契约测试 | 阻止不兼容升级或同步修改适配器 |
| 百炼限流或不可用 | 高 | 识别状态码、超时和调用指标 | 有限重试、批次限流、保留可重试 outbox，不静默切模型 |
| Zilliz 不可用 | 高 | 健康检查和向量任务失败率 | 保留 Neon 事实与可重试状态；问答明确不可用，不影响既有业务 |
| outbox 重复消费或积压 | 高 | 幂等键、重试次数和延迟指标 | 幂等 upsert/delete、退避、死信和人工恢复 |
| 服务端凭据泄漏 | 高 | 客户端构建、日志、响应和数据库扫描 | 仅服务端环境变量，脱敏错误，禁止进入载荷和客户端 |
| 扫描 PDF 解析质量差 | 高 | 解析质量和空文本检查 | 使用 OCR；低质量时提示用户，不生成无效索引 |
| 进程重启中断任务 | 高 | 启动扫描 Neon 遗留任务和 outbox | 将超时 `processing` 转为可重试状态；后续独立 Worker |
| 多文件结果被单文件主导 | 中 | 统计上下文中文件分布 | 限制单文件片段数量，对比问题保证多来源召回 |
| Embedding 模型升级 | 高 | 比较地域、模型、维度和索引版本 | 标记 `stale`，新 collection 重建后原子切换 |
| JSONB 滥用导致关系不可约束 | 中 | Schema 审查 | 稳定 ID 集合拆分为关系表，JSONB 仅用于设置和统计快照 |
| chunk 明文泄漏 | 高 | 日志扫描和权限审计 | Neon 最小权限、网络与备份保护；Zilliz 不保存完整正文 |
| 成本超预期 | 中 | 记录字符数、片段数、调用量和 Zilliz 用量 | 手动索引、索引复用、批处理、费用提示和重建预算 |
| 回答幻觉 | 高 | 无依据集和引用一致性评测 | 强制引用、引用校验、依据不足时拒答 |

---

## 19. 关键决策

以下事项在本版中已经确定，不再作为实施前待选择项：

1. 产品形态是独立私有知识库，入口位于功能区左侧页边栏，用户路由使用 `/knowledge`。
2. 一个用户可创建多个知识库，一个知识库可包含多个文件。
3. 添加文件后不自动索引，用户确认后异步建立索引。
4. 业务数据库使用 Neon PostgreSQL，并作为唯一业务事实源。
5. RAG Schema 使用 Drizzle ORM 定义并生成迁移。
6. 业务和公开接口主键统一使用 UUID，时间统一使用 `timestamptz` UTC，命名统一使用 `snake_case`。
7. 稳定关系使用关系表，JSONB 仅用于设置、统计快照或不稳定附加属性。
8. 身份来自认证专项 ADR 确定的用户 ID，所有业务操作显式校验 `user_id`。
9. 向量数据库使用 Milvus；生产环境可使用兼容的 Zilliz Cloud。
10. Zilliz/Milvus 仅保存可从 Neon 重建的语义索引，不保存不可替代业务事实。
11. Neon 与 Zilliz 使用 outbox、幂等操作、重试和对账实现最终一致性。
12. Zilliz 候选必须回 Neon 二次授权并读取正文。
13. Embedding 固定使用阿里云百炼中国内地（北京）地域 `qwen3-vl-embedding`，与 Chat 模型配置分离。
14. Embedding 维度必须依据官方文档和真实 API 响应确认，不得沿用旧模型值或猜测。
15. `DASHSCOPE_API_KEY`、`ZILLIZ_URI`、`ZILLIZ_TOKEN` 仅允许服务端环境变量。
16. 自定义 `ZillizVectorStore` 实现当前版本 `MastraVector`，作为 `vectorStore` 直接传入 `createVectorQueryTool`。
17. 每次问答限定在一个知识库内，回答必须提供来自 Neon 的可定位引用。
18. 删除知识库不删除原始文件；删除原始文件后 Neon 立即失效，Zilliz 最终清理。
19. 知识库失败不影响现有业务功能。

以下事项保留为后续演进：

- 是否接入 Rerank。
- 是否使用独立可靠任务队列。
- 是否支持团队共享。
- 是否支持跨知识库查询。
- 是否支持精确 PDF 坐标高亮。
- 是否接入要素提取和模拟编制。

### 19.1 跨文档迁移依赖

当前其他规约和代码仍可能声明 Python `db_schema.py` 为唯一 Schema 权威、使用字符串主键或弱化认证要求。实施前必须通过数据库和认证专项 ADR 统一以下事项：

1. `db.spec.md`、`project-query-db.spec.md`、`src/db/schema.ts` 与 `db_schema.py` 的迁移权威。
2. 现有 `users`、`files` 等表与 UUID 外键的类型兼容或迁移路径。
3. 认证用户 ID 的服务端来源和未认证请求行为。
4. Neon 作为唯一可写业务 PostgreSQL，避免出现第二业务事实源。

这些依赖不改变本规约的目标选型，也不能作为继续新增旧架构 RAG 表的理由。

---

## 20. 验收标准

### 20.1 产品验收

1. 用户可通过功能区左侧栏进入知识库。
2. 用户可创建多个知识库。
3. 用户可向知识库添加多个自有文件。
4. 添加文件后不会自动产生 Embedding 调用。
5. 用户确认后可启动异步索引，并查看文件级进度。
6. 失败文件可单独重试。
7. 至少一个文件可检索时可以提问。
8. 多文件回答能区分不同文件的来源。
9. 回答可查看文件、页码、章节和引用片段。
10. 删除知识库不删除文件管理中的原始文件。

### 20.2 权限验收

1. 用户 A 无法查看、修改或查询用户 B 的知识库。
2. 用户不能把他人的文件加入自己的知识库。
3. 伪造 `file_ids`、`chunk_id` 或请求体 `user_id` 不能扩大查询范围。
4. 伪造索引 ID或任务 ID不能读取他人状态。
5. Zilliz 故意返回其他用户、已删除、旧版本或不存在的 chunk 时，Neon 二次授权必须全部丢弃。
6. 删除用户后其 Neon 业务数据立即不可访问，Zilliz 派生数据最终清理。

### 20.3 数据库与索引验收

1. Drizzle Schema 可以生成并应用 Neon 迁移，不依赖 RAG 手写建表 SQL。
2. RAG 业务和公开接口主键为 UUID，用户所属表的 `user_id` 非空。
3. 时间字段使用 `timestamptz` UTC，数据库对象使用 `snake_case`。
4. 稳定文件、任务、召回和引用关系不使用 JSONB ID 数组。
5. Neon `rag_chunks` 不包含向量列，Zilliz 不保存完整 chunk 正文。
6. 编码前已通过官方文档和最小真实调用确认 `qwen3-vl-embedding` 的实际维度。
7. Embedding 输出、Neon 索引记录、Zilliz collection 和索引版本维度完全一致；不一致时失败关闭。
8. 同文件、同哈希、同地域、同模型和同版本不重复生成业务索引或向量。
9. 文件内容、模型、维度或版本变化后旧索引标记 `stale`，新 collection 重建完成前不破坏旧有效索引。
10. outbox 重复消费不产生重复向量，失败可重试且不会永久停留在 `processing`。
11. 删除原始文件后 Neon 立即不可检索；Zilliz 延迟删除不恢复可见性。
12. 清空测试 collection 后可以从 Neon 完整重建。

### 20.4 问答验收

1. 查询只使用当前知识库内已完成索引的文件。
2. 未索引、处理中、失败和过期文件明确列入排除提示。
3. 所有文件均不可检索时不调用 Chat LLM。
4. Zilliz 查询使用用户、文件和版本预过滤，候选回 Neon 二次授权和正文回填。
5. 回答中的引用编号与 citations 一一对应，正文和引用定位来自 Neon。
6. 无足够依据时返回“未在所选文件中找到足够依据”。
7. 对比类问题的上下文不会全部被单文件垄断。
8. Recall@8 和引用准确率达到评测目标。

### 20.5 Mastra、安全与工程验收

1. `ZillizVectorStore` 满足项目锁定版本 `MastraVector` 的 TypeScript 编译期契约。
2. 自定义实例确实作为 `vectorStore` 传入 `createVectorQueryTool`，未使用 `any` 绕过类型检查。
3. `DASHSCOPE_API_KEY`、`ZILLIZ_URI`、`ZILLIZ_TOKEN` 只从服务端环境读取，不出现在代码、Neon、任务载荷、客户端 bundle、网络响应或日志中。
4. Zilliz metadata 不包含完整 chunk 正文，错误栈不包含连接串或 Token。
5. 索引确认框明确提示数据将发送至北京地域百炼并写入 Zilliz/Milvus 派生索引。
6. 后端、Mastra 适配器、前端和权限相关单元、集成、安全测试通过。
7. 前端类型检查和相关组件测试通过。
8. 使用真实或脱敏 PDF 完成端到端流程：创建知识库、添加多文件、确认索引、完成 Zilliz 召回、Neon 二次授权并生成带引用回答。
9. Zilliz、Mastra 或 Embedding 不可用时，现有非知识库功能继续正常运行。
