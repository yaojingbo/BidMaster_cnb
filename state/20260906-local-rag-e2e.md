# 20260906-local-rag-e2e

## 背景
用户要求先在本地跑通 RAG 知识库链路，以区分代码问题与生产部署/路由问题。目标不是只让独立 Node RAG 的 health=ready，而是验证实际的创建知识库、上传、建索引、检索链路。

## 当前事实（2026-09-06 10:12 更新）
- 状态板已记录生产 pgvector 已迁移，生产待做上传→建索引→检索。
- 本地独立 `src/rag-service` 已监听 `127.0.0.1:8100`，live=200；ready 检查为 `neon=false`、`embedding=true`、`zilliz=true`。`neon` 只由 `RAG_DATABASE_URL` 是否存在决定。
- FastAPI 知识库路由真实前缀为 `/api/knowledge-bases`；Next 专用代理将浏览器 `/api/knowledge/knowledge-bases` 改写到该路径。
- 生产日志曾显示后端直接收到 `/api/knowledge/knowledge-bases` 并返回 404（未改写）。
- 本地配置：`src/rag-service/.env` 有 `RAG_INTERNAL_TOKEN`、DashScope、Zilliz，但没有 `RAG_DATABASE_URL`。
- **本地 FastAPI 主链路已通过 `RAG_SERVICE_ENABLED=false` 绕过独立 RAG 委托，直接走本地 PostgreSQL/pgvector。**

## 本地链路验证结果（运行时证据）

### 已通过（2026-09-06）
| 步骤 | 证据 |
|------|------|
| FastAPI direct `/api/knowledge-bases` | 200 OK |
| Next proxy `/api/knowledge/knowledge-bases` | 200 OK |
| 创建知识库 | 201，ID `105e3d76-276f-485f-bd5d-302817df4d9c` |
| 上传 PDF（`rag-smoke-en.pdf`） | 200，file_id `e3f83ea6-e011-48d5-93ff-7a239b1ca87a` |
| 创建索引任务（`force=false`） | 202，job_id `a174e7bf-481f-4697-910c-c341b4478a9c` |
| 索引任务完成 | status=completed，1 chunk，8 秒内完成 |
| DashScope embedding 生成 | 1024 维向量写入 `rag_chunks`，数据库核对 `vector_dims=1024` |
| 检索命中 | `retrieved_chunk_ids` 非空，query_log 记录 chunk 命中 |
| 真实 LLM 回答（独立脚本） | `refused=False`，答案含 `[1]` 引用，citations=1，正确提取「30 calendar days」和「RMB 50,000」 |

### 发现的代码问题
1. **`force=true` 触发 VARCHAR(50) 溢出**：`rag_repository.py:45-47` 拼接 `index_version:force:<uuid>` 得 63 字符，超过 `rag_indexes.index_version VARCHAR(50)` 限制。任何 force 重建索引请求都会返回 500。根因：`create_index()` 在 force 模式下未对版本号做长度控制。
2. **`auth_disabled=True` 短路 LLM 为 demo**：`lite_llm.py:269` 判断 `demo_mode or auth_disabled` 即走 `_demo_complete()`，返回固定文本（不含 `[1]` 引用），导致 `rag_answer_service.py:87` 引用校验失败 → `refused=True`。本地为绕登录设的 `AUTH_DISABLED=true` 同时把真实 LLM 调用短路了，使得通过 API 的查询永远返回「未在所选文件中找到足够依据」。生产 `AUTH_DISABLED=false` 不受此影响。

### 本地测试注意事项
- 用 PyMuPDF `insert_textbox` 生成测试 PDF 时默认字体不支持中文，提取出的文本全是 `?`，会导致检索语义失败。测试应使用英文或指定中文字体。
- 本地 `src/backend/.env` 里 `DEEPSEEK_API_KEY`/`DASHSCOPE_API_KEY` 为空字符串，真实 key 在 `.env.local`。独立脚本验证时需从 `.env.local` 读取并注入环境变量。
- 通过 HTTP API 查询知识库时，`auth_disabled=True` 会导致答案被 demo 短路拒绝。要验证真实 LLM 回答需临时设置 `AUTH_DISABLED=false` 并重启后端，或用独立脚本直接调用 `RagAnswerService`。

## 编排决策
1. 先运行现有本地单测/烟测和配置存在性检查，不改代码、不泄露凭据。
2. 分开验证两套 RAG：
   - FastAPI + 本地 PostgreSQL/pgvector 的知识库主链路；
   - 独立 Node RAG + Neon/Zilliz 的服务链路。
3. 对本地 Next 代理与 FastAPI 真实路径分别取运行时状态；只有本地代理成功且生产仍 404，才将生产问题收敛到部署入口/反向代理配置，不能简单归因于环境变量。
4. 若本地失败，按失败层定位：路由、鉴权、数据库/pgvector、embedding、索引任务、检索/LLM。

## 进展
- [x] 读取状态板、意向书、知识库前端 API、Next 专用代理。
- [x] 读取 FastAPI 知识库路由与配置。
- [x] 用脱敏方式检查本地配置存在性。
- [x] 运行本地相关测试与服务运行时烟测（FastAPI direct + Next proxy 均 200）。
- [x] 验证本地创建→上传→索引→检索→真实 LLM 回答（全链路通过）。
- [x] 对照生产 404，形成代码/部署结论（见下方）。

## 修复后回归（2026-09-06）
- 后端全量单测：`133 passed`。
- 真实 PostgreSQL 仓储集成测试：`3 passed`，已覆盖 force 版本长度和两次重建唯一性。
- 前端单元测试：`60 passed`。
- Next.js 生产构建：通过。
- 生产部署脚本桩测：`12 通过 / 0 失败`。
- 先前的 `pgvector` 导入失败不是代码或依赖声明缺陷，而是误用了 `src/backend/.venv`；Makefile 指向仓库根 `.venv`，其中 `pgvector.asyncpg` 可正常导入。

## 生产 404 归因

### 本地证据
- 本地 Next 代理 `/api/knowledge/[...path]/route.ts` 正确将 `/api/knowledge/knowledge-bases` 改写为 `/api/knowledge-bases` 并返回 200。
- 本地 FastAPI 知识库路由 `/api/knowledge-bases` 正常工作。

### 生产现象
- 生产日志显示后端直接收到 `POST /api/knowledge/knowledge-bases`（未改写路径）并返回 404。
- 这说明生产请求**没有经过 Next 代理的改写**。

### 根因确认（2026-09-06 诊断完成）

**Traefik 路由规则将 `/api/*` 全量转发到 FastAPI 后端**，Next.js catch-all 代理在生产环境中从未被执行。

外部探测证据：
- `https://bidmaster.asia/api/knowledge/knowledge-bases` → `{"detail":"Not Found"}` server: uvicorn — 请求直接到后端，未改写
- `https://bidmaster.asia/api/knowledge-bases` → `{"detail":"未认证"}` — FastAPI 真实路由前缀正确，鉴权开启时返回 401
- `https://bidmaster.asia/` → 200 — 前端静态页面正常

修复方案：前端 API client（`src/frontend/lib/knowledge-api.ts`）不再使用 `/api/knowledge/` 前缀，改为直接调用后端真实路径 `/api/knowledge-bases`。
- 生产：浏览器 `/api/knowledge-bases` → Traefik → FastAPI → 正确
- 开发：浏览器 `/api/knowledge-bases` → Next.js catch-all (app/api/[...path]) → FastAPI → 正确

### 待验证

用户部署新版本后需测试：创建知识库、上传文件、建索引、检索问答。之前报 404 的端点应恢复正常工作。

**生产 404 根因已确认并修复**：Traefik `/api/*` → FastAPI，Next.js 代理不执行。前端已改为直接调用后端真实路径 `/api/knowledge-bases`（分支待合并）。

**阻塞已清除**：不再需要服务器权限验证镜像和 Traefik 配置。
