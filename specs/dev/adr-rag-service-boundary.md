# ADR：RAG 3.0 独立服务边界

<meta>
  <document-id>bid-master-rag-service-boundary</document-id>
  <version>1.0.0</version>
  <status>accepted</status>
  <date>2026-08-18</date>
  <depends>rag.spec.md, sys.spec.md, real.md, cog.md</depends>
</meta>

## 1. 背景

RAG 3.0 的 TypeScript/Mastra 运行时要求 Node.js >=22.13，而现有生产由 Next.js 和 FastAPI 两个运行单元组成。当前知识库在建实现仍把 RAG 编排、pgvector、手写 Schema、Embedding 和进程内任务执行放在 FastAPI/Python 中，无法同时满足 Mastra 运行时、Neon/Drizzle Schema 权威和 Zilliz 派生索引的目标约束。

## 2. 决策

RAG 3.0 采用独立 RAG 服务，作为独立 Node.js 22.13+ 进程和独立部署单元运行：

```text
浏览器
  -> Next.js 同源 API
  -> FastAPI 认证与文件业务网关
  -> 内网 Node.js/Mastra RAG 服务
  -> Neon PostgreSQL + Zilliz Cloud/Milvus
```

RAG 服务不嵌入 Next.js 进程，也不继续嵌入 FastAPI 进程。生产新增独立 `bidmaster-rag.service`，仅监听 loopback 或受控内网地址；Nginx 不直接暴露 RAG 服务。

## 3. 服务职责

### Next.js

- 提供知识库页面和同源 API 代理。
- 保持浏览器认证 Cookie/Bearer 的同源边界。
- 透明转发 JSON 和 SSE，不读取 Neon、Zilliz 或服务端凭据。

### FastAPI

- 继续解析浏览器 JWT，并作为浏览器身份的唯一入口。
- 保留文件所有权校验、Fernet 加密文件存储、文件上传/下载/删除。
- 保留 PDF、OCR、Word 等解析能力，并提供受内部凭据保护的文件解析接口。
- 通过内部 HTTP/SSE 客户端调用 RAG 服务。
- 不创建、迁移或写入 RAG 3.0 目标表；`db_schema.py` 不再作为 RAG Schema 权威。

### Node.js/Mastra RAG 服务

- 通过 Drizzle 独占 RAG 业务 Schema 和迁移。
- 负责知识库、成员、索引、chunk、任务、outbox、查询审计和引用事实。
- 负责切片、Embedding、Mastra 检索编排、Zilliz 派生索引、Neon 二次授权、回答和 SSE。
- 负责 outbox worker 的 claim、重试、幂等 upsert/delete、重建和对账。

### 数据存储

- Neon 是唯一业务事实源。RAG 服务通过 Drizzle 读写 RAG 表。
- Zilliz/Milvus 只保存可从 Neon 重建的向量和最小过滤字段，不保存完整 chunk 正文。
- 任何 Zilliz 候选都必须回 Neon 按认证用户、知识库成员、文件、chunk 和有效索引版本二次授权。

## 4. 内部协议

浏览器 API 路径保持现有 `/api/knowledge/*` 形状。FastAPI 到 RAG 使用版本化内部路径：

```text
GET  /internal/v1/health/live
GET  /internal/v1/health/ready
POST /internal/v1/knowledge-bases/...
POST /internal/v1/knowledge-bases/{id}/index-jobs
POST /internal/v1/knowledge-bases/{id}/query
POST /internal/v1/knowledge-bases/{id}/query/stream
```

内部请求必须包含：

- 服务间认证凭据；
- `X-Authenticated-User-Id`，由 FastAPI 在成功解析浏览器 JWT 后注入；
- `X-Request-Id`；
- `Content-Type`。

RAG 服务拒绝缺少服务间凭据或可信用户身份的请求，不解析浏览器 JWT，不接受请求体中的 `user_id` 覆盖可信身份。可信身份不能替代 Neon 资源级授权。

统一错误至少包含 `success`、`code`、安全 `message`、`request_id` 和 `retryable`，不得泄露密钥、连接串、异常栈或大段正文。

SSE 终态固定为 `done` 或 `error`。发送 `error` 后不得继续发送 `content` 或 `done`；Next.js 和 FastAPI 只透传流，不重新编排 RAG 状态。

## 5. 故障隔离

- RAG 服务关闭、Neon RAG 表不可用、Zilliz 超时或 Embedding 失败，不得阻塞 Next.js/FastAPI 启动。
- 文件上传、下载、预览、OCR、要素提取、模拟编制、开标分析、项目查询和 CLI 授权继续走现有链路。
- 只有知识库索引和问答返回明确的功能不可用或可重试错误。
- `/api/health` 保持轻量，不依赖 RAG 的重型 readiness；RAG 单独提供 live/ready 检查。

## 6. 迁移约束

1. 先完成 Mastra 版本契约、Neon 迁移、百炼真实向量维度和 Zilliz 最小 smoke，再实现生产适配器。
2. 先新建目标 RAG 表并迁移可验证数据，不直接覆盖旧 Python/pgvector 表。
3. `users.id`、`files.id` 当前为字符串时，先完成数据审计和兼容映射决策，不直接强转为 UUID。
4. 先切换知识库资源管理，再切换索引，最后 shadow/灰度切换问答。
5. 旧 Python RAG 仅作为迁移期对比和回滚路径；切流完成后删除 pgvector、旧 Embedding 和进程内 RAG runner，保留文件解析/OCR 和非 RAG 业务。

## 7. 取舍

独立服务增加一个 Node.js 运行单元、内部协议和部署维护成本，但换取了 Node 运行时隔离、Mastra 类型契约清晰、RAG 故障隔离和独立扩展能力。让 FastAPI 管理 Node 子进程或把 Mastra 放入 Next.js 都会模糊进程所有权、重启边界和故障诊断，不作为目标方案。
