# 腾讯云主生产部署说明

## 部署定位

腾讯云服务器是 Bid Master Web 当前唯一正式生产环境，正式域名为 <https://bidmaster.asia>。前端使用 Next.js，后端使用 FastAPI；RAG 3.0 增加独立 Node.js/Mastra 服务，三个进程均由 systemd 管理。

RAG 服务只监听 `127.0.0.1:8100`（实际端口发布前必须核查），仅允许 FastAPI 通过服务间凭据调用。Nginx 继续只反代 Next.js，不把 RAG 端口暴露到公网。RAG 服务异常只影响知识库索引和问答，不得阻塞文件上传、解析和其他既有业务。

## 发布前检查

1. 确认待发布提交已经进入 CNB `main`。
2. 检查前端类型、测试和生产构建。
4. 检查后端单元测试和数据库迁移要求。
5. 记录当前生产提交 SHA、数据库备份状态和可回滚版本。
6. 确认 `.env`、证书、数据库密码、JWT、Fernet 和 AI 密钥没有写入仓库。

## 服务器核查

发布前先读取现状：

```bash
systemctl list-units --type=service --all | grep -Ei 'bid|next|node|python|uvicorn'
systemctl status <frontend-service> --no-pager
systemctl status <backend-service> --no-pager
systemctl status <rag-service> --no-pager
ss -ltnp | grep -E ':3000|:8000|:8100'
nginx -t
```

确认实际仓库远端以 CNB 为主，并且服务器工作区没有未提交修改：

```bash
git remote -v
git branch -vv
git status --short
```

如服务器存在本地改动、分支分叉或无法快进更新，应停止发布并先查明原因，不使用强制重置覆盖现场。

## 人工发布原则

1. 从 CNB 获取 `main` 最新提交。
2. 只允许 fast-forward 更新。
3. 按锁文件安装前端依赖，按 requirements 安装后端依赖。
4. 在构建阶段提供 Next.js 所需环境变量。
5. 构建和测试成功后再重启服务。
6. 每次只重启已核实的现有服务名。
7. 发布失败时保留当前健康进程，不用跳过测试作为解决办法。

项目不通过代码仓库镜像流水线自动部署腾讯云。代码备份与生产发布是两条独立链路。

## 健康检查

按服务器实际端口和路由验证：

```bash
curl -fsS http://127.0.0.1:8100/health/live
curl -fsS http://127.0.0.1:8100/health/ready
curl -fsS http://127.0.0.1:8000/api/health
curl -fsSI http://127.0.0.1:3000/
curl -fsSI https://bidmaster.asia/
curl -fsS https://bidmaster.asia/api/health
```

RAG `/health/live` 只检查进程；`/health/ready` 分项检查 Neon、Zilliz、Embedding 配置和 outbox worker。RAG readiness 失败不得使 FastAPI `/api/health` 失败。

同时验证：

- HTTP 自动跳转 HTTPS。
- 正式域名证书有效。
- 登录、刷新令牌和退出正常。
- 文件上传、下载和批量下载正常。
- 要素提取和模拟编制 SSE 正常。
- CLI 网页授权正常。
- OCR 和项目查询接口正常。

## 回滚原则

1. 记录失败发布的提交 SHA 和日志。
2. 回到上一个已验证版本，不删除现场日志和上传数据。
3. 如包含数据库迁移，按迁移方案单独处理，不直接回滚代码后假设数据库自动兼容。
4. 恢复服务后重新执行健康检查和关键业务冒烟测试。
5. 将问题修复后重新走正常发布流程，不在服务器直接修改源码。

## 恢复生产保护

1. 生产恢复只能回到已记录的健康提交、已验证数据库状态和受控 systemd 服务，不从本地开发工作区直接覆盖服务器源码。
2. 恢复前先确认前端、后端和 RAG 服务的实际服务名、端口、环境文件和持久化目录，避免误停非本项目进程或覆盖上传数据。
3. RAG 服务恢复失败时，只下线知识库索引和问答入口；不得因此回退或重置 FastAPI、Next.js、数据库和文件存储。
4. 数据库或持久化文件恢复必须先保留现状备份，再按既定备份点恢复；禁止用 `git reset --hard`、删除目录或重新初始化数据库替代恢复流程。
5. 恢复完成后必须重新执行健康检查、登录、上传下载、SSE 和知识库最小问答冒烟，并记录恢复提交、备份点、操作者和时间。

## 敏感信息

以下内容只能保存在服务器受限环境文件或密钥管理服务中：

- 数据库连接串。
- JWT 和 Fernet 密钥。
- 邮件、AI 供应商及对象存储密钥。
- 腾讯云访问凭据。
- TLS 私钥。

仓库中的部署文档和配置模板不得包含真实值。
