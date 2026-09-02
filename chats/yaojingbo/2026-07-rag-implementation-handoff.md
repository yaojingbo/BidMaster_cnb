# RAG 知识库实施交接记录

## 当前目标

依据 `.42cog/spec/dev/rag.spec.md` 建设知识库/RAG 前后端完整模块，并在本地持续测试直至不依赖外部基础设施的检测全部通过。

## 已完成

- 已完成旧 RAG 规约升级，当前版本为 2.0.0。
- 已完成代码架构探索和全栈实施计划。
- 已确认生产技术方案：PostgreSQL + pgvector、DashScope `text-embedding-v3`、1024 维、手动异步索引、RRF 混合检索、强制引用和无依据拒答。
- 已创建知识库/RAG 数据表、配置、仓储、切片、Embedding、异步索引、混合检索、回答引用校验和 FastAPI API。
- 已创建 `/knowledge`、`/knowledge/[knowledgeBaseId]`、左侧导航、文件关联、索引确认与轮询、SSE 问答和引用 UI。
- 已增加专用 Next.js 流式代理和测试用 deterministic fake。
- 已新增统一知识源表、知识库来源关系和索引任务明细，兼容原有文件成员关系。
- 已支持引用文件管理中的要素提取、模拟编制 step2/3/4、开标统计和开标 AI 分析，并明确标记派生来源。
- 已支持知识库上传 PDF 或仅含 PDF 的 ZIP；ZIP 包含路径穿越、密码包、嵌套包、压缩率、成员数、单项及总解压大小等安全检查。
- 已在知识库详情页增加任务总进度、阶段进度和逐文件进度，页面刷新后通过 active job 恢复。
- 当前普通文件与 ZIP 上传默认上限均为 50 MiB；ZIP 最多 100 个成员、50 个 PDF，单 PDF 50 MiB、总解压 250 MiB。
- RAG 后端专项测试 13 项通过；前端 60 项通过；TypeScript、ESLint（0 错误）和 Next.js production build 通过。

## 当前工作区

开始实施时已存在、不能覆盖的用户改动：

- `.42cog/spec/dev/rag.spec.md`：本轮此前完成的规约修改。
- `tests/integration/services/`：未跟踪目录。
- `tests/unit/infrastructure/`：未跟踪目录。
- `tests/unit/services/test_export_markdown_builder.py`：未跟踪文件。
- `tests/unit/services/test_pdf_export_service.py`：未跟踪文件。

后续只修改 RAG 任务相关文件，并保留以上未跟踪测试。

## 关键实现决策

1. 知识库入口为 `/knowledge`，详情为 `/knowledge/[knowledgeBaseId]`。
2. 文件加入知识库后不自动索引，用户确认后才发送文本到 DashScope。
3. 所有知识库和检索 SQL 必须直接包含 `user_id`。
4. 生产路径外部能力失败时返回明确不可用状态，不静默切换 fake。
5. 测试通过依赖注入使用 deterministic fake embedding、内存仓储和 fake LLM。
6. 先完成非流式引用校验，再通过 SSE 分段输出已校验结果。
7. 自动化只写入 Makefile，不创建 shell 脚本。

## 外部环境状态

当前探索未发现本机 `psql`、Docker 或 Ollama，因此默认本地测试不能声称真实 pgvector、pg_trgm 或 DashScope 已通过。真实验证将通过独立 Makefile target 执行，并明确记录是否跳过。

## 当前执行中的检测

- `make test-rag`：通过。
  - RAG 后端单元测试：13 项通过（含 ZIP 安全测试）。
  - 前端单元测试：9 个文件、60 项通过。
  - TypeScript 类型检查：通过。
- 稳定后端回归集合：229 项通过。
- 前端 ESLint：0 错误，存在统计页面 2 条既有 Hook 依赖警告。
- Next.js 生产构建：通过，已生成 `/knowledge`、`/knowledge/[knowledgeBaseId]` 和 `/api/knowledge/[...path]`。
- Playwright 知识库页面冒烟测试：1 项通过。
- 真实 PostgreSQL：`vector 0.8.0`、`pg_trgm 1.6` 已启用；6 张知识库/RAG 表已创建。
- 真实 pgvector：1024 维向量事务内写入和 cosine 检索通过，测试数据已回滚。
- 代码审查后已补强：扩展创建后重新注册 pgvector codec、空白文件 ID 拒绝、重建完成后旧索引标记 stale、未 claim 的索引不再误计成功、启动时重置超时 processing 索引。
- 安全边界说明：规约允许 `rag_chunks.content` 明文以支持 `pg_trgm`，依赖数据库磁盘/备份加密和最小权限保护；若要求字段级加密，需要放弃或重构数据库关键词召回，不能作为本次无影响修改。
- 全量旧后端测试仍有历史失败：旧 API 测试请求字段与当前接口不一致，旧数据库测试 patch 已删除的 `get_connection`。这些失败在 RAG 之外，已通过 229 项稳定回归集合隔离验证。

## 下一步最小动作

1. 收集基线测试结果。
2. 修复 `SCHEMA_SQL` 的全新数据库初始化顺序。
3. 增加 RAG 配置、表结构和领域契约。
4. 逐步实现知识库 CRUD、索引、检索、问答、API 和前端。

## Git

本任务不自动提交、不自动推送。
