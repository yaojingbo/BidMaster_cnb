# Bid Master Web · 状态板（给 AI · 跨会话唯一接续点）

> 开工先读 `CLAUDE.md` + **`.42cog/` 四份** + 本文件 + `state/memory/MEMORY.md`。
> **非轮规则：每轮有效工作必更新本文件**（倒序追加，新的在上）。

## 2026-09-03 · CNB CI/CD 端到端排障（多轮，全走 MR）【构建链已闭环；生产后端崩溃已定位并本地修复，待合并上线】

CI/CD 主链路已通：合并→后端测试→前端构建→curl webhook→服务器 git pull + docker compose build。
本轮逐个击破（每个一个分支+MR）：
1. `e3af35d` CI 脚本 + make branch/publish
2. `17d9572` python3 缺失 → stage 指定 python:3.12/node:20 镜像
3. `0398639` docker.volumes 依赖缓存
4. `38d7219`/`90281f9` 国内镜像源（npmmirror；pip 阿里云，清华曾 403）
5. `4c253b3` tsconfig 排除 src/rag-service（前端 next build 误扫 RAG 服务）
6. `5740f01` Dockerfile Debian 源→腾讯云（apt-get 卡 96 分钟解决）
7. `96b371d` typst 下载 http1.1+重试+镜像链，且失败不阻塞构建
8. `aba17e1` CI 过滤 paddlepaddle/paddleocr（数百MB、跨节点无pip缓存→10分钟无输出被杀）；本地无paddle验证 130 测试 4.8s 通过
9. `f996c09`/`a0e3583` CI 再过滤 markitdown（连带 onnxruntime）+ 改用 uv 装依赖，保留 `-v pip` 兜底防静默
10. `1418268` 补 `Dockerfile.frontend`、`.dockerignore` 补 resources/src/rag-service
11. `cab1980` 生产 Dockerfile pip 源 阿里云→`mirrors.cloud.tencent.com`：同机房 **274.7 MB/s**（跨厂商仅 ~100KB/s，几百MB 要 80 分钟）
12. `04a83fc` `.dockerignore` `docs`→`docs/*`+`!docs/QUICKSTART.md`：`/docs` 页 build 期静态预渲染 fs 读该文件，被排除则 next build 以 ENOENT 退出 1；另在 Dockerfile.frontend 加显式 COPY 断言使同类问题 <1s 定位。**教训：CI 绿 ≠ 镜像构建绿**（CI 检完整仓库，只有 Docker 受 .dockerignore 影响）

已验证结论：
- 服务器 22:14:43 `部署完成`，backend/frontend 两容器 Recreated→Started；全量含 paddle 的生产镜像构建通过
- CI 过滤只作用于 CI：生产日志可见 paddlepaddle/paddleocr/markitdown/onnxruntime 全装，线上功能不减
- 耗时构成：CI 约 6-8 min + 服务器构建约 7 min；其中新瓶颈是镜像 export/unpack（后端 110+31s、前端 81+16s，因 paddle 镜像体积大），下次 pip 层命中缓存后服务器侧约 2-3 min

### 追加（09-03 夜 → 09-04）：部署后 backend 进入崩溃重启循环

22:14 那次「部署完成」只是构建与换容器成功，运行时没活：`docker ps` 显示
`backend-… Restarting (3)`，未带 token 打 `/api/auth/me` 得 502（上游无监听）。**我当时把它说成「闭环」，是错的**——
已在 `docs/reviews/2026-09-03-cicd-retrospective.md` 立规约：任何「完成/已上线」结论必须附一条运行时证据，构建日志不算证据。

根因（本地空库复现取得证据，非推测）：
- `a49a48a`（09-02 22:07）把 `register_vector` 挂进了 `_create_pool` 的建池回调，本次部署是该代码**首次**在生产运行。
- 库中未安装 vector 扩展时，asyncpg 抛的是 `ValueError: unknown type: public.vector`，**不是**
  `UndefinedObjectError`/`UndefinedFunctionError`；旧代码只捕后两类 → 异常逃逸 → `create_pool` 失败 →
  lifespan 里 `init_schema` 的 except 分支因生产 `AUTH_DISABLED=false` 走 `raise` → 进程退出 → 循环。
- **09-02 记录的「`DO $$` 语法错误」归因是错的**：`db.execute()` 无参走简单查询协议，多语句与 `DO $` 块均正常。
  本地跑 `init_schema` 建出 18 张表、二次执行幂等。已作废该结论。

修复（`fix/db-pool-init-vector-codec`）：`database.py` 建池回调改为捕 `Exception`、降级不崩，并把原因存
`db.vector_codec_error` 供知识库/RAG 就绪检查报告；配 3 条回归测试（改前必红、改后全绿）。
证据：空库冷启动不再抛异常，仅打印 `WARN: pgvector 编解码器注册失败（ValueError: unknown type: public.vector）`；单测 133 passed。

本轮交付的其他三项（`chore/deploy-hardening`）：
- `docs/reviews/2026-09-03-cicd-retrospective.md`：14 现象 → 5 类根因（A 镜像源拓扑 / B 构建环境三处不一致 /
  C 静默失败 / D 生产状态漂移未入库 / E 从未验证进程能启动）→ 元根因：缺「已自证的不可变产物」边界，环境契约没入库。
- `scripts/deploy-bidmaster.sh`：部署脚本收编进仓库（此前只存在于生产机，即 D 类）。fast-forward-only + 已跟踪文件脏即拒部署、
  镜像打 SHA 不可变 tag、启动健康门 + 失败自动回滚 PREV_SHA + 取证日志。bash 桩测 8/8；过程中抓到并修掉真 bug：
  `$SHA` 紧跟全角标点在 `set -u` 下被并入变量名，脚本恰好死在「部署完成」那一行。
- `docs/deployment/credential-rotation-runbook.md` + `.env.example` 占位：凭据轮换手册（含 webhook 密钥「新旧同时接受」的零窗口顺序）。

GitHub 镜像已处置：孤儿根提交 `d14dcc5` 用 bundle 封存于 `~/1.Mynote/_backups/github-orphan-d14dcc5.bundle`，
随后 `push -f` 使 GitHub 成为单向镜像，两 remote 现同为 `04a83fc`。

待办：
- ⚠️ **合并 `fix/db-pool-init-vector-codec` 并确认容器不再 Restarting**（`docker ps` 无 Restarting + `/api/auth/me` 返回 401 而非 502）
- ⚠️ 确认生产库是否装了 pgvector 扩展：装了则知识库可用；没装则应用现在能起、但 `/knowledge` 类功能会在就绪检查里报上述原因
- ⚠️ 按 runbook 执行凭据整改：第 1 节 webhook 密钥、第 2 节 Deploy Key（需服务器 + CNB 后台，仅本人可操作）、第 3 节作废 CNB token
- ⚠️ 生产机换上 `scripts/deploy-bidmaster.sh`（runbook 第 2 节 ⑤）——健康门 + 自动回滚今天就地生效，本次这类崩溃会被自动退回旧镜像
- 线上人肉验收：`/docs` 可访问、`/statistics` 评标基准价按旧数据需重算
- 生产健康接口 git.commit=unknown → 新脚本打 SHA tag 后由镜像 tag 承担定位；构建期注入 SHA 尚未做
- 阶段 B 可选：CI 直接构建镜像推仓库→服务器只 `pull && up -d`，彻底摆脱服务器侧慢构建
- 可选 CI 加固：构建后加一步 `python -c "import app.main"`（本次未纳入，因缺生产口径 DATABASE_URL，验证不足不塞进热修）
- 本地 `.env.local:10 NEXT_PUBLIC_AUTH_DISABLED=true`、`src/backend/.env:22 AUTH_DISABLED=true` 为绕登录测试所加，需再测鉴权时记得关掉

## 2026-09-02 · CI/CD 已接入（CNB 云原生构建 + Coolify webhook）

- 提交 `e3af35d`（chore: 接入 CNB CI 与分支发布脚本）已推 CNB，main 与 cnb/main 同步。
- 新增 `.cnb.yml`：PR→main 跑测试；push→main 测试+构建+curl Coolify webhook 部署。
- Makefile 追加 `branch`/`publish` 目标（main 拒直推）。
- 部署密钥走 CNB「密钥仓库」bidmaster-secrets 的 deploy.yml（imports 注入 COOLIFY_DEPLOY_WEBHOOK，含 allow_slugs 授权主仓库）。
- 待确认：CNB CI 是否全绿、Coolify 是否被 webhook 触发重部署（我无 CNB/Coolify 面板权限，需用户反馈）。
- 待办：CNB 分支保护（禁止直推 main + 要求 PR）尚未确认是否开启。

## 2026-09-01 · 开标评标规则功能已合并推 CNB（待服务器发布）

- 提交 `5a99ce5`（feat: 开标分析支持按评标办法计算基准价），已推 CNB main（c1de519..5a99ce5）。
- 仅含 11 个文件（评标规则功能），不含 RAG/知识库/元数据重构等其余 130+ 脏文件。
- 回归：后端单测 128 通过；前端 `next build` 通过（过程抓修了一处 benchmark_comparison 可能为 null 的崩溃点）。
- 无数据库迁移（规则存 openings.meta JSON 列）；无新增前后端依赖；生产环境变量无需改（auth 保持真实）。
- 服务器发布：人工，本机无腾讯云 SSH，需用户在服务器执行 runbook（fast-forward 拉取 → 构建 → 重启 → 健康检查）。
- 回滚点：c1de519。

## 2026-08-31 · 评标基准价「无基准价行」真 bug 修复（已验证）

- 真因：benchmark 模块启用被卡在「表格有无现成基准价行」。无基准价行的真实文件 → 前端模块门禁排除 benchmark → 后端跳过 Module F → 规则算了也无处展示；用户看到的「算术平均」实为「统计分析」页签的全量均值。
- 修复：① `column-module-map.ts` 加 `hasEvalRule` 参数，选中规则即启用 benchmark；② `handleAnalyze` 当 evalRule 存在时强制把 benchmark 塞进模块列表；③ 基准价页签外层条件放宽到 `comparison || calculation`。
- 已 Playwright 用无基准价行文件 + 去高去低法验证：按办法计算 1,050,000（手算吻合）、对账块完整。
- 关键口径澄清（写进后续文档）：「统计分析」页签的均值/离散系数是**全量统计，永远不受评标规则影响**；评标规则只决定「基准价对比」页签的基准价与偏离。二者是两码事。
- 未修遗留：金额单位口径错误（元标万），待单独决策。

## 2026-08-31 · 评标基准价「未按规则计算」排查 + 本地测试绕过登录

- 结论：后端规则计算无误（curl 黄金数据 + Playwright 真实 UI 双通道均正确）；用户看到「默认结果」是 UX 缺陷——出结果后规则卡与「开始分析」按钮都带 `!result` 条件而消失，选规则后无重算入口。
- 修复：`page.tsx` 去掉 `!result` 门禁，结果存在时保留规则卡、按钮变「重新分析（按当前规则重算）」。已 Playwright 实测：二次平均法 1,100,000 → 改均值下浮法 K=2 重算 → 1,051,050，正确切换。
- 鉴权旁路（仅本地）：后端 `AUTH_DISABLED=true`（src/backend/.env），前端 `NEXT_PUBLIC_AUTH_DISABLED=true`（.env.local）。**上线/外发前务必改回 false 并删除**。
- 遗留：统计页数字单位口径错误（值=元，标签=万，如「1,051,050万」），属既有问题、影响全页，待单独决策是否做单位换算。
- 黄金数据样例：`_tmp/20260831-opening-golden.csv`（gitignore，不入库）。

## 2026-08-31 · 本地 PG 测试库切换（后端恢复在线）

- 结论：backend 无法启动与代码无关；用户拍板放弃排查网络路径，走本地化。**本地 PG 已就绪并接管：**
  - `postgresql@17`（brew services 常驻，127.0.0.1:5432；@16 已停但未卸）
  - 库 `bidmaster`（角色 user，凭据见根 `.env`），扩展 `vector 0.8.6` + `pg_trgm 1.6`
  - `src/backend/.env` 生效本地 DSN；**Neon 原配置注释保留在下方，取消注释即可切回**
  - 启动自动建表 19 张；健康 200；`/api/statistics/benchmark/suggest` 已挂载（401 待鉴权正常）
- 坑位记录：brew pgvector 0.8.6 只构建 @17/@18；已 cp dylib 为 pkglibdir 下的 `vector.so`（升级 pgvector 后需重做）；psql 默认连同名库需 `-d postgres`；zsh 不分词 `$PSQL` 整串变量
- 待办：人肉验收评标基准价功能（本地空库，需重新上传开标表格走黄金链路）

## 2026-08-27 · aias-meta-init 六组骨架对齐（已完成）

- 备份：`/Users/yaojingboV2/1.Mynote/_backups/bid-master-web-meta-20260827/`
- `.42cog` 方向 A；`specs/`、`resources/` 迁六组命名；CLAUDE.md 融合；.gitignore 补六组规则
- 保留新骨架：`vault/ state/ scripts/ plugin.json 42plugin.json .claude/workflows/ _build _tmp _archive`

**收敛方向**：见 `.42cog/intent.md`——那句话只有一份，别抄到这里。
