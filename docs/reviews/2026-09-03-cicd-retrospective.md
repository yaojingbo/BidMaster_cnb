# CI/CD 接入两天复盘（2026-09-02 ~ 09-03）

> 复盘对象：从「合并即自动部署」接入到第一次自动部署后后端崩溃重启循环。
> 一手记录不在本文重复：`notes/yaojingbo/2026-09-02-bidmaster-deploy-record-20260902.md`（09-02 手工部署 7 个坑）、
> `state/board.md:6-35`（09-03 十二个修复提交链）。本文只做归因与决策，不抄现象。

## 一、现象清单（14 个）

09-02 手工部署：容器无部署记录、后端连接被拒、`init_schema` 报 `syntax error at or near "$"`、
`COPY --from=bidmaster-backend` 失败、Traefik 指向已不存在的旧容器名、邮件密钥缺失、前端未重建。
09-03 自动部署：CI 无 python3、npm ECONNRESET、清华源 403、tsconfig 误扫 `src/rag-service`、
apt 卡 96 分钟、typst 下载 INTERNAL_ERROR、CI 10 分钟无输出被杀、markitdown 连带 onnxruntime、
阿里云 pip 100KB/s、服务器本地改动挡住 `git pull`、webhook 返回空原因的 `Deploy failed`、
`.dockerignore` 排除 docs 致镜像内 `next build` ENOENT、部署后后端崩溃重启循环（未定因）。

## 二、压缩成 5 类

| 类 | 成员 | 共同前提错误 |
| --- | --- | --- |
| A 网络拓扑与镜像源 | npm/pip/apt/typst/跨厂商慢 | 没先测「构建机 → 各源」实际带宽就按常识选源；同一份 Dockerfile 内 apt 用腾讯、pip 用阿里云，自相矛盾直到 100KB/s 才回头查 |
| B 构建环境三处不一致 | python3 缺失、tsconfig 误扫、`.dockerignore` 排除 docs | CI / Docker / 本地三处上下文与工具链不同，每次都用「另一处绿了」推断这一处也会绿。**CI 绿 ≠ 镜像构建绿**（CI 检出完整仓库，只有 Docker 受 `.dockerignore` 影响） |
| C 静默失败 | CI 无输出被杀、webhook 空 `Deploy failed`、typst 主动降级 WARN | 缺「每一步必须留下可归因的一行」的设计；失败发生了但没留名字 |
| D 生产状态漂移未入库 | 服务器手改 `init_schema`、Traefik 上游、建库建用户 SQL、服务 `.env` 内容 | 真相的一部分只在生产机上，仓库只是子集 → 每次重新部署等于重新考古；且补丁进生产不进仓库，必然被下次 `git pull` 丢弃 |
| E 从未验证「进程真能启动」 | 后端崩溃循环 | 验收止步于 pytest 通过 / `next build` 通过 / 镜像 `Built`。`lifespan` 里的 `init_schema` 在单测、CI、镜像构建三处都不执行，只有容器真启动那一刻才炸 |

## 三、元根因（一个，不是五个）

**链路里缺一个「已自证的不可变产物」边界，且环境契约没有入库。**

- 构建发生在目标机器上（服务器现装 pip 依赖、现 `npm ci`、现 `next build`）→ 机器的网络位置与工具链直接进入失败面 → A、B
- 产物没有自证能力（`Built` 不代表能启动）→ 失败被推迟到生产运行时才暴露 → C、E
- 「怎样让它跑起来」的知识只存在于生产机与聊天记录 → D，且每次部署重新踩一遍

因此第 15 次逐条打补丁不是解法。解法是移动边界：**CI 一次性构建出能自证的不可变产物 → 服务器只 pull + up**，同时把生产配置与补丁以文件形式纳入版本库。改完后 A/B 在服务器侧物理消失（服务器不再取包）、C/E 前移到 CI 与部署门、D 被强制显形（不在仓库里就无法部署）。

## 四、本次崩溃循环的归因状态（诚实版）

最高先验是 D→E 的合流：09-02 为解决 `DO $$` 在服务器手改了 `init_schema`，该补丁从未进仓库；
09-03 它挡住了 `git pull`，被丢弃；仓库版本原样上线。生产 `auth_disabled=false`，
`src/backend/app/main.py:48-53` 的 `except` 分支不再走 mock storage 而是 `raise` → lifespan 失败 → 容器退出 → 重启循环 → Traefik 502。

**但这仍是假设，未定论**，两点反证在案：

1. 项目 `Database.execute()` 转发到 asyncpg 无参 `conn.execute()`（asyncpg 0.31），走 simple query 协议，
   理论上支持多语句与 dollar-quoting，与 09-02 的报错现象不完全自洽；
2. 容器 `ExitCode=3`，与 uvicorn 常规启动异常（通常 1）不一致。

次要候选：数据库连接/`coolify` 网络、缺 `vector`/`pg_trgm` 扩展、`rag_required` 触发的 RuntimeError、
新镜像某个只在生产安装的包（paddle/ocrmypdf）import 期失败——CI 从不装它们，这四项 CI 全绿也覆盖不到。

复现脚本已备好（`AUTH_DISABLED=false` + 临时空库跑 `init_schema` 两遍验证幂等），但它需要一台
有建库权限角色的 PG；本机 `user` 角色无 CREATEDB，且**本地 PG 与生产 PG 不是同一台，本地跑通不能证明生产不崩**。
定因只能来自服务器一次输出：

```bash
docker logs --tail=120 backend-fga7l0ngdi1bx9ikv3dulent 2>&1 | tail -60
docker inspect -f 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}} restarts={{.RestartCount}}' backend-fga7l0ngdi1bx9ikv3dulent
cd /var/www/bid-master-web && git log --oneline -1 && git status --short
```

第 3 行专门用来判断是否又出现了本地漂移（D 类复发）。**修复必须以进仓库补丁的形式落地**——
在服务器上再手改一次是把同一个雷埋回第三次。

## 五、解法优先级

| 级别 | 动作 | 打掉哪类 | 成本 | 状态 |
| --- | --- | --- | --- | --- |
| P0 | 按上面三条定因，把修复写成仓库补丁 | D、E | 一次往返 | 阻塞于服务器输出 |
| P1 | `scripts/deploy-bidmaster.sh`：镜像打 SHA 不可变 tag + 启动健康门 + 失败自动回滚 + 原因写日志 | C、E、部分 D | 一份脚本 | **本次已交付** |
| P2 | 生产 `docker-compose.yml`、Traefik 动态配置、`.env` 键清单入版本库；`/opt/webhookd` 纳入 git | D | 需服务器 cat | 待服务器配合 |
| P3 | 阶段 B：CI 构建镜像推 registry，服务器只 `pull + up -d` | A、B 物理消除 | 需选 registry 并先测拉取带宽 | 决策待定 |
| P4 | 凭据机制：Deploy Key 取代明文个人 token + 轮换已外泄凭据 | 安全债 | 见 runbook | 进行中 |

P3 有一条必须先量的风险：后端镜像含 paddle 数 GB，**先测 registry 拉取带宽再上，别把慢构建换成慢拉取**。

## 六、验收铁律（对人和对 AI 同等生效）

本次复盘中，"已闭环"这个结论下早了：看到 `部署完成` + 容器 `Started` 就判定成功，
验收口径停在「构建通过」，与被复盘的 E 类是同一个错。据此加一条：

> **任何「完成/已上线」结论必须附一条运行时证据（HTTP 状态码或进程存活状态），构建日志不算证据。**
> 构建日志只能证明「产物被造出来」，不能证明「产物在工作」。

配套：`make publish` 之后必须跑一次 `/api/health` 与一个受保护接口的状态码核对，才能写「部署完成」。
