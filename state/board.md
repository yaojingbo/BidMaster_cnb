# Bid Master Web · 状态板（给 AI · 跨会话唯一接续点）

> 开工先读 `CLAUDE.md` + **`.42cog/` 四份** + 本文件 + `state/memory/MEMORY.md`。
> **非轮规则：每轮有效工作必更新本文件**（倒序追加，新的在上）。

## 2026-09-03 · CNB CI/CD 端到端排障（多轮，全走 MR）【已闭环：构建链 + 生产运行时双验收（09-04 13:07 容器，重启 0 次）】

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

### 追加（09-06）：`20260906-pgvector-migration` 已切换生效，待正证与知识库真跑验收

- 取证已全：PG `15.19` → `pgvector/pgvector:pg15`；库 8.8 MB；4 网络全 bridge → 走 **B1**；
  接入网 `fga7l0ngdi1bx9ikv3dulent_bidmaster`。迁移前 public 表数留底 **18**。
- ✅ **09-06 04:32 切换完成并有运行时证据**：改的是手工 `.env` 第 3 行（先 `cp -a .env .env.bak-2026-09-06`），
  `docker compose up -d` 重建两容器 → `启动于=2026-09-06T04:32:00Z 重启次数=0`、
  `grep -i pgvector` **无输出（rc=1）**= 那句从 09-04 起一直存在的 WARN 消失、`/api/auth/me` 仍 401。
  最硬的一条是「谁在连我」：新库 `pg_stat_activity` 有 `172.21.0.4`（后端）idle 连接，
  旧库除本次 psql 会话外**零活动连接**——排除「其实还连着旧库」这类假通过。
- ✅ 正证已取得：`rag_chunks.embedding` 是 vector 类型列。且 **`rag_chunks` 不在迁移前那 18 张表里**
  （旧库根本建不出它）——它是切换后应用自己建的，等于第二个独立证据：`init_schema` 这次真的走到了
  带 vector 的那批语句并建成，而不只是「没报错」。
- 🔴 **切库后剩两个独立事项，别混**：① 生产没配 AI 供应商，建索引会在 embedding 步失败，
  只需往 `.env` 追加 `DASHSCOPE_API_KEY` + `DASHSCOPE_EMBEDDING_BASE_URL` 两行（`rag_embedding_provider`
  默认已是 `dashscope`，故 `AI_PROVIDER` 不影响 embedding；但 `AI_PROVIDER` 默认 `deepseek` 且
  `deepseek_api_key` 生产为空 → **招标文件提取这条线在生产同样从未可用**，属待拍板）；
  ② 浏览器真跑「上传 → 建索引 → 检索」，这是本次事故最该补却没补过的验收项。

- 中间步骤正证（都是一手输出，非推断）：`dump rc=0` / `restore rc=0`；新库扩展
  `vector 0.8.6` + `pg_trgm 1.6`；18 表对平；五张关键表行数新旧全等
  （users=1 / files=2 / openings=4 / extracts=0 / knowledge_bases=0）；
  后端容器内解析 `bidmaster-pg` = `172.21.0.3`。
- **配置真相源定论**：compose 与 `.env` 都在 `/data/coolify/services/<uuid>/` 且**是手工放的**
  （compose 里 `build.context: /var/www/bid-master-web`；Coolify 库 `environment_variables` 共 **0 行**，
  即它没存过任何界面变量、也不会在部署时重写这个 `.env`）。所以改 `.env` 是持久正解，
  在 Coolify 界面里翻 `DATABASE_URL` 一定翻不到——这条以前只活在聊天记录里，现已进 `pgvector-migration.md` §4。
  变量分两层：应用变量走 `env_file:`（compose 38/74 行），常量走内联 `environment:`（10/48 行）；
  以后加密钥放错层的现象是「改了没生效」。

- 自纠一处：runbook 里我把口令 `echo` 到终端，用户整块贴回对话 → 按我自己定的口径算外泄。
  改文档为 `umask 077` 落盘到 `/root/.bidmaster-pg-password`（可事后读回、不回显），
  并**换掉那个已进聊天记录的口令**——库还是空的，`docker rm -f` + `docker volume rm` 重来 30 秒，
  比带着外泄凭据上线便宜得多。
- 下一步：补 vector 列正证 → 配 embedding 密钥（值在本机 `.env.local:8` 与 `:9`，全程只量长度未打印）
  → 浏览器真跑知识库链路 → 稳定 1-2 天后按迁移文档 §6 收尾（旧库改名保留、删 `bidmaster_smoke_20260903`、
  把不由 Coolify 纳管的 `bidmaster-pg` 登记进备份计划）。
- 仍未做：A3 浏览器验收；合 `chore/deploy-hardening`（`f0ef67d`，**必须早于**在服务器装新脚本）。

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

### 生产验收（09-04 13:07 部署后，逐条取到运行时证据）

- A1 稳定性：间隔 2 分钟两次 `docker inspect`，`重启次数=0 启动于=2026-09-04T05:07:33Z` 完全一致 → 崩溃循环已止。
  （`RestartCount` 是累计值，0 = docker 从未重启过该容器；之前看到的 `Up 41s` 是新容器而非重启）
- A2 `docker logs … | grep -i pgvector` 打出 `WARN: pgvector 编解码器注册失败（ValueError: unknown type: public.vector）`
  → 双证：修复生效（该异常修复前直接打崩启动，现在只降级），且**生产库确实没有 vector 类型**。
- 未带 token `GET /api/auth/me` → **401**（原 502）：后端真的在服务请求，且生产鉴权是开着的，
  本地 `AUTH_DISABLED` 试验开关没渗进生产——这条历史待办一并结掉。
- 结论：#8874007 已进 main 并生效；#10（`d954bc3`）已合并。
- **生产 vector 类型缺失（知识库此前就不可用，只是被崩溃掩盖）—— 成因①已排除**：
  容器 env 里四个知识库变量一个都没有（两种取法都验为空），且 `.dockerignore` 排除 `.env`/`.env.*`
  故镜像内也无配置文件可覆盖 → 生效的是代码默认值 `config.py:60-69`：`knowledge_base_enabled=True`、
  `rag_required=False`、model=`text-embedding-v4`、dimension=`1024`，全部满足 `init_schema` 首期约束
  → 代码确实走到了 `CREATE EXTENSION IF NOT EXISTS vector` 那步；又因 `rag_required` 默认 False，
  该步失败只被吞成知识库就绪原因（接口 503），不影响核心业务——与观察一致。
  **定论＝成因③：`coolify-db` 镜像未打包 pgvector**（`pg_available_extensions` 只有
  `pg_trgm | 1.6 | 未安装`，没有 `vector` 行；该实例连 `postgres` 角色都没有，超级用户由 Coolify 生成）。
  连 `pg_trgm` 也没建成，是因为 `RAG_VECTOR_SCHEMA_SQL` 第一条语句就是 `CREATE EXTENSION vector`，一失败整批中断。
  **即生产知识库自上线以来从未可用**，先后被崩溃循环、降级 WARN 掩盖，直到这次查 `pg_available_extensions` 才见光。
  落地方案已写：`docs/deployment/pgvector-migration.md`——把 `bid_master` 迁到带 pgvector 的独立 PG，
  不碰 Coolify 自己的库；含 B1/B2 路线判据（网络驱动 bridge / overlay）、迁移窗口、
  以及验收必须真跑一次「上传 → 建索引 → 检索」，不能只看 `CREATE EXTENSION` 成功。
  **撤回我自己提过的止血方案 `KNOWLEDGE_BASE_ENABLED=false`**：该开关只被 `main.py:34`、`db_schema.py:527` 读，
  前端没有就绪接口可据其隐藏入口，关掉只会把准确报错换成一句误导性的「功能已关闭」——
  拿准确换假话正是复盘里 C 类根因本身。

修复（`fix/db-pool-init-vector-codec`）：`database.py` 建池回调改为捕 `Exception`、降级不崩，并把原因存
`db.vector_codec_error` 供知识库/RAG 就绪检查报告；配 3 条回归测试（改前必红、改后全绿）。
证据：空库冷启动不再抛异常，仅打印 `WARN: pgvector 编解码器注册失败（ValueError: unknown type: public.vector）`；单测 133 passed。

本轮交付的其他三项（`chore/deploy-hardening`）：
- `docs/reviews/2026-09-03-cicd-retrospective.md`：14 现象 → 5 类根因（A 镜像源拓扑 / B 构建环境三处不一致 /
  C 静默失败 / D 生产状态漂移未入库 / E 从未验证进程能启动）→ 元根因：缺「已自证的不可变产物」边界，环境契约没入库。
- `scripts/deploy-bidmaster.sh`：部署脚本收编进仓库（此前只存在于生产机，即 D 类）。fast-forward-only + 已跟踪文件脏即拒部署、
  镜像打 SHA 不可变 tag、启动健康门 + 失败自动回滚 PREV_SHA + 取证日志。
  **桩测已固化为 `make test-deploy-script`（12 项，`tests/deployment/deploy-bidmaster-harness.sh`），累计抓到三个真 bug**：
  ① `$SHA` 紧跟全角标点被并入变量名，脚本恰好死在「部署完成」那行；② 状态文件不存在时 `awk` 退出码 2 触发 `set -e`，
  **首次部署必失败**；③ 脚本写 12 位短 SHA、回滚点校验要求 40 位，口径不一致会让每次部署都丢掉回滚点 → 统一为完整 SHA。
  ②③ 都不在成功路径上可见，只有桩测能抓——「只在首次/失败分支触发」正是复盘里 C 类根因本身。
- `docs/deployment/credential-rotation-runbook.md` + `.env.example` 占位：凭据轮换手册（含 webhook 密钥「新旧同时接受」的零窗口顺序）。

GitHub 镜像已处置：孤儿根提交 `d14dcc5` 用 bundle 封存于 `~/1.Mynote/_backups/github-orphan-d14dcc5.bundle`，
随后 `push -f` 使 GitHub 成为单向镜像，两 remote 现同为 `04a83fc`。

待办：
- ✅ ~~执行 `docs/deployment/pgvector-migration.md`~~ 已切换生效（09-06 04:32，见上一节）；
  剩该文档 §5 的「真跑一次上传→建索引→检索」与 §6 收尾（旧库改名保留、`bidmaster-pg` 进备份计划）
- ~~合并 `fix/db-pool-init-vector-codec` 并确认容器不再 Restarting~~ ✅ 已合（`8874007`）并生产验收，见上
- ✅ ~~生产 vector 类型缺失的成因待分辨~~ 已定论＝成因③（coolify-db 镜像未打包 pgvector），已迁移解决
- ⚠️ 按 runbook 执行凭据整改：第 1 节 webhook 密钥、第 2 节 Deploy Key、第 3 节作废 CNB token。
  **用户已明确决定推迟到本轮任务收尾后**（可推迟、不可取消：明文 token 已外泄过一次，等价于「读到脚本=能推 main=自动上生产」）
- ⚠️ 生产机换上 `scripts/deploy-bidmaster.sh`（runbook 第 2 节 ⑤）——健康门 + 自动回滚就地生效，本次这类崩溃会被自动退回旧镜像。
  与凭据整改同属「需上台」一批，一起做
- 线上人肉验收：`/docs` 可访问、`/statistics` 评标基准价按旧数据需重算（待用户在浏览器里过）
- 🔴 生产从未配 AI 供应商：知识库需要 `DASHSCOPE_API_KEY` + `DASHSCOPE_EMBEDDING_BASE_URL` 两行（值在本机
  `.env.local:8`/`:9`）；而招标文件提取要的是 `AI_PROVIDER` + 对应 key，**要不要配、配哪家属产品决策，等人拍板**
- 生产健康接口 git.commit=unknown → 新脚本打 SHA tag 后由镜像 tag 承担定位；构建期注入 SHA 尚未做
- 阶段 B 可选：CI 直接构建镜像推仓库→服务器只 `pull && up -d`，彻底摆脱服务器侧慢构建
- ~~可选 CI 加固：`python -c "import app.main"`~~ 作废：本次崩溃发生在 lifespan 建池阶段，import 探测根本抓不到；
  真正能抓的是「起一个真进程 + 空库跑一遍启动」，属阶段 B 的 CI 里带 PG service 时再做
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
