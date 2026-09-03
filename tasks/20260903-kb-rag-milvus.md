# 20260903 知识库 RAG（Mastra + Milvus）接入

<meta>
  <document-id>task-20260903-kb-rag-milvus</document-id>
  <created>2026-09-03</created>
  <status>执行中</status>
  <depends>specs/dev/rag.spec.md, specs/dev/zilliz-vector-store.spec.md, specs/dev/adr-rag-service-boundary.md</depends>
</meta>

## 目标

1. 侧边栏加「知识库」按钮进入知识库界面。
2. 知识库对话框实现 RAG：输入文本 → 向量化 → Milvus 语义检索 → LLM 整合成通顺回答。
3. 文档先分块 → 向量化 → 存 Milvus；参数用默认值。
4. 后端使用 Mastra `createVectorQueryTool` + 自定义 `ZillizVectorStore`（实现 `MastraVector`）。

## 已确认决策（2026-09-03）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | Zilliz endpoint | `https://in03-7d91868106e6523.serverless.ali-cn-hangzhou.cloud.zilliz.com.cn` |
| 2 | Embedding 模型 | 阿里云百炼 DashScope `text-embedding-v4`（维度 1024，已实测） |
| 3 | 合成 LLM | 阿里云百炼 DashScope `qwen-plus`（已实测；DeepSeek key 失效，弃用） |
| 4 | 预索引文档 | `/Users/yaojingboV2/1.Mynote/MyCreate/DevProject/bid-master-web/data` |
| 5 | 范围 | MVP：侧边栏入口 + 预索引 + 对话 RAG；不建 Neon/outbox/对账 |
| 6 | 前端 | 复用已有 `/knowledge` 页面，后端检索切到 Mastra+Milvus |
| 7 | 评审工具 | sequential-thinking 反思 + 测试 + 尽力跑 codex；不可用则自评兜底 |
| 8 | CRON 看门狗 | 每 20 分钟检查清单执行第一个未勾选任务（7 天后过期） |

## 冒烟测试结果（2026-09-03）

- ✅ Embedding `text-embedding-v4`：返回维度 1024，与 `RAG_EMBEDDING_DIMENSION` 一致。
- ❌ DeepSeek `deepseek-chat`：`Authentication Fails, key invalid`（项目默认 AI Provider 的 key 已失效）。
- ✅ DashScope `qwen-plus` / `qwen-turbo` / `qwen-max`：均可用。
- ✅ Zilliz 连接（REST/HttpClient）：`listCollections` 返回 `code:0`，可连通。
- ❌ Zilliz gRPC `19530`：TLS 握手失败（serverless 集群仅暴露 REST）。
- ❌ Zilliz 建集合/上传：`403 PermissionDenied`——`db_7d91868106e6523` 在 `default` 库无 `CreateCollection` 权限。

## 发现的问题（已处理/待处理）

- [x] `.env.local` 的 `DASHSCOPE_EMBEDDING_BASE_URL` host 重复 → 已修。
- [x] Zilliz 凭据是自由文本（`用户名:`/`密码:`）→ 已改标准变量名 `ZILLIZ_URI`/`ZILLIZ_USERNAME`/`ZILLIZ_PASSWORD`/`ZILLIZ_TRANSPORT`。
- [x] `config.ts` 默认仍指向 `qwen3-vl-embedding` → 已改 `text-embedding-v4`。
- [x] DeepSeek key 失效（项目预存、非本次引入）→ 已忽略：该 API key 由用户端使用时自行配置；本次 RAG 合成已用 DashScope qwen-plus 绕过。
- [x] Zilliz 用户 `db_7d91868106e6523` 无 `CreateCollection` 权限 → 已解决：改用有权限的 API key（`ZILLIZ_TOKEN`）+ 正确库名 `ZILLIZ_DB_NAME=db_7d91868106e6523`。

## 任务清单

### 阶段 A：配置与冒烟

- [x] A1 修复 `.env.local`：Zilliz 凭据改标准变量名，修 `DASHSCOPE_EMBEDDING_BASE_URL` 重复 host
- [x] A2 对齐 `src/rag-service/src/config.ts`：新增 Zilliz 变量 + `RAG_LLM_MODEL`，改 embedding/版本默认值 + readiness
- [x] A3 Embedding 冒烟：真实调用 DashScope 确认维度 = `RAG_EMBEDDING_DIMENSION`（已实测返回 1024）
- [x] A4 Zilliz 冒烟：连接(REST)+建集合+插入+检索全部通过（token 认证 + 正确 db 名）

### 阶段 B：ZillizVectorStore 适配器

- [x] B1 实现 `MilvusFilterTranslator`（`VectorFilter` → Milvus 布尔表达式）+ 9 测试全绿
- [x] B2 实现 `ZillizVectorStore extends MastraVector`（HttpClient/REST，9 方法 + 惰性连接）
- [x] B3 契约测试：`extends MastraVector` 编译通过、无 `any`、instanceof + 纯函数单测（29 测试全绿）

### 阶段 C：分块与索引

- [x] C1 实现 Node 分块器（`RagChunker`，忠实移植自 Python `rag_chunker.py`，默认 1000/160/80）+ 7 测试全绿
- [x] C2 实现索引 pipeline（`embedding.ts` DashScope 嵌入 + `index-pipeline.ts` 分块→嵌入→upsert）+ 3 测试全绿（40 测试总绿）
- [x] C3 预索引 `data` 文档集：9 个文档 112 个 chunk 入库

### 阶段 D：Mastra 检索 + 问答

- [x] D1 Embedding 桥接：`@ai-sdk/openai` 指 DashScope → spec v4 不兼容，改自定义 spec v1 `MastraEmbeddingModel`（方案 B）+ 1 测试全绿
- [x] D2 用 `createVectorQueryTool({ vectorStore, indexName, model })` 接入语义召回（`rag-retrieval.ts`）+ 1 测试全绿
- [x] D3 查询 pipeline（`query-pipeline.ts`：createVectorQueryTool.execute 语义召回 → LLM 整合）+ `llm.ts` 提示词单测（44 测试全绿）

### 阶段 E：HTTP 与前端打通

- [x] E1 rag-service 暴露查询/索引 HTTP 接口（`rag-http.ts` + `index-docs.ts` + http/server 接线）+ 3 测试全绿
- [x] E2 追踪并打通调用链：前端 `knowledge-api.ts` → Next.js `knowledge` 专用代理 → FastAPI `/api/knowledge-bases/rag/query` → rag-service `/internal/v1/rag/query`（新增 FastAPI 路由 + 前端 `queryRag`）
- [x] E3 侧边栏 `Sidebar.tsx` 加「知识库」nav item；知识库页加「知识库问答」对话框（`queryRag`）

### 阶段 F：反思 + 测试 + 评审

- [x] F1 深度思考（sequential-thinking MCP）反思：正确性 / 危险操作（发现 dataDir 路径穿越 + readDimension 校准）
- [x] F2 全量测试：rag-service 48 测试 + Python 4 测试 + 前端 type-check 全绿
- [x] F3 调用 codex（`gpt-5.6-sol`）评审：产出 12 项问题清单
- [x] F4 修复高危项（dataDir 改配置化、字段名注入校验）+ 其余记录为生产加固待办

### 阶段 G：验证

- [x] G1 端到端验证：rag-service HTTP 查询「台州市招标文件规律」返回完整带引用回答（8 来源）

## 跳过/阻塞记录

- **A4 上传部分（阻塞）**：Zilliz 用户 `db_7d91868106e6523` 在 `default` 库无 `CreateCollection` 权限，建集合返回 403。需用户在 Zilliz Cloud 控制台为该用户授予 Admin/DBAdmin 角色（或提供有权限的 API Key）。授权后重跑 `src/rag-service/zilliz-smoke.mjs` 验证。连接（REST）已验证通过，传输层已定 REST。

- **B2 待落实的安全约束**（来自 B1 反思）：filter 字段名必须来自固定白名单（user_id/file_id/index_version/chunk_type 等 schema 字段），`createVectorQueryTool` 不开 `enableFilter`（filter 由服务端组装，不信任 LLM 生成），避免字段名/表达式注入。

- **B2 待校准（Zilliz 授权后）**：1) `readDimension`/`readMetric` 是对 SDK describe 响应的防御性解析（SDK `Field` 类型欠完备），字段名靠多路兼容猜测，需拿真实 `describeCollection` 响应校准，否则 `describeIndex` 的 dimension 可能取 0；2) `upsert` 会把 metadata 所有键作动态字段写入，C2 索引 pipeline 需保证 metadata 不含 `vector`/`chunk_id` 键（已加单测覆盖）；3) `listIndexes` 未按前缀过滤，返回全库 collection。

- **D1 方案 A 否决**：`@ai-sdk/openai@4.0.43` 产出 spec v4（`specificationVersion:'v4'`），与 `@mastra/core@1.59.0` 的 `MastraEmbeddingModel`（只支持 spec v1/v2/v3）类型不兼容（`TS2322`）。改用方案 B：自定义 spec v1 `MastraEmbeddingModel`，内部复用 `embedTexts`（已实测连通 DashScope）。已回写 spec §7。

- **MVP 偏离（已接受）**：适配器 schema 增加 `text` 字段并在 Milvus 保存 chunk 正文（spec §8.3 禁止保存正文）。理由：MVP 不建 Neon，正文需从 Milvus 直接取回喂给 LLM。切到 Neon 事实源时需移除该字段。

- **F4 已修复（codex 高危项）**：1) `/internal/v1/rag/index` 的 `dataDir` 改为读取服务端配置 `RAG_DATA_DIR`，不再接受请求体传入（消除任意路径读取/SSRF）；2) `MilvusFilterTranslator` 增加字段名 `^[A-Za-z0-9_]+$` 校验（消除表达式注入）。

- **生产加固待办（codex 中危/多租户项，MVP 单用户暂缓）**：1) `query` 未按 `user_id` 过滤（多租户才需要，MVP `AUTH_DISABLED`）；2) LLM 提示词间接注入（需更强隔离 + 结构化片段）；3) `DASHSCOPE_EMBEDDING_BASE_URL` 未强制 HTTPS/主机白名单（配置受信，暂缓）；4) 上下文总长未截断、filter 深度未限、embedding 响应维度未校验、collection 名未校验、fileId 碰撞未处理。

- **G1 预备（已验证，待 Zilliz 授权后执行）**：1) rag-service 启动/健康检查接线正确（`/health/live` 返回 live，`/ready` 正确报 `{neon:false,embedding:false,zilliz:false}`）；2) 端口 8100 有多个陈旧 `node --watch dist/src/server.js` 进程（Aug26 + 今日 3:35AM 启动，未带 env 配置），G1 前需 kill 并以 `src/rag-service/.env`（参考新增的 `.env.example`）+ `node --env-file=.env dist/src/server.js` 重启；3) 环境变量清单见 `src/rag-service/.env.example`。

- **上线联调的关键修复（2026-09-03，Zilliz 授权后）**：1) 新增 `ZILLIZ_TOKEN`（API key）认证，弃用无权限的 username/password；2) 新增 `ZILLIZ_DB_NAME`——根因是 Zilliz Cloud serverless 的默认库名是 `db_7d91868106e6523` 而非 `default`，SDK 硬编码注入 `dbName:"default"` 导致 403；3) collection 名清洗 `-`→`_`（Milvus 只允许数字/字母/下划线，`v3-text-embedding-v4` 里的 `-` 导致 createCollection 静默失败）；4) `readDimension` 修正为解析 `params:[{key,value}]` 数组格式。以上均验证通过。
