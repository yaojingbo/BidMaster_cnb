# 部署后人工步骤清单（2026-09-04 起）

> 接续：`state/board.md`（状态）、`docs/deployment/credential-rotation-runbook.md`（凭据细节，本清单只引用不复制）。
> 容器名 `backend-fga7l0ngdi1bx9ikv3dulent`、路径 `/var/www/bid-master-web` 均为生产实测值。
> 铁律：每步的判定标准写在括号里，**没拿到证据不算完成**。

## A. 确认本次热修真的健康（现在，5 分钟内）

- [x] A1 稳定性双采样 → **已过**（13:07 部署后两次间隔 2 分钟的采样：`重启次数=0 启动于=2026-09-04T05:07:33Z` 完全一致）

      for i in 1 2; do docker inspect -f '重启次数={{.RestartCount}} 启动于={{.State.StartedAt}}' backend-fga7l0ngdi1bx9ikv3dulent; [ $i = 1 ] && sleep 120; done

  判定：两行一致 = 通过。单点 `Up 41s` 不足以判定——崩溃循环中的容器任意时刻看一眼常常也是 `Up N seconds`；
  `RestartCount` 是容器自创建以来的累计值，0 = docker 从未重启过它。

- [x] A2 判定生产库有没有 pgvector 扩展 → **确认没有**：

      WARN: pgvector 编解码器注册失败（ValueError: unknown type: public.vector）

  这条同时是修复生效的证据：同一个异常在修复前会直接打崩启动。

- [x] A2c 分辨「没有 vector 类型」的两种成因 → **结论是成因③：`coolify-db` 镜像未打包 pgvector**
      （`pg_available_extensions` 里只有 `pg_trgm | 1.6 | 未安装`，没有 `vector` 行；连 `pg_trgm` 也没建成，
      是因为 `RAG_VECTOR_SCHEMA_SQL` 第一条就是 `CREATE EXTENSION vector`，它失败即整批中断）。
      **=> 生产知识库此前从未可用。** 落地方案见 `docs/deployment/pgvector-migration.md`（迁移 runbook，含路线选择与验收）

  生产拓扑实测（09-04）：后端连的是 **`coolify-db:5432/bid_master`**——Coolify 自带的共享 PG，
  机器上没有任何名字含 postgres/pgsql 的独立数据库容器，`docker ps` 全文为
  `frontend-… / backend-… / coolify / coolify-db / coolify-redis / coolify-realtime / coolify-sentinel / coolify-proxy`。
  该实例里**没有 `postgres` 这个角色**（`psql -U postgres` 直接 FATAL），超级用户是 Coolify 生成的，先取名字：

      docker exec coolify-db env | grep -iE '^POSTGRES_USER=|^POSTGRES_DB='      # 只取这两个键，不会打印口令

      # 再用上面的 USER 查：镜像里有没有 pgvector 扩展包 + 本库装没装
      docker exec coolify-db psql -U <USER> -d bid_master -tc "select name, default_version, installed_version from pg_available_extensions where name in ('vector','pg_trgm')"

  **配置侧已排除**（09-04 实测）：容器 env 里 `KNOWLEDGE_BASE_ENABLED` / `RAG_REQUIRED` /
  `RAG_EMBEDDING_MODEL` / `RAG_EMBEDDING_DIMENSION` 四个变量一个都不存在，而 `.dockerignore` 排除了
  `.env`、`.env.*`，镜像内也没有配置文件可覆盖 → 生效值是代码默认 `config.py:60-69`
  （`True` / `False` / `text-embedding-v4` / `1024`），全部满足 `init_schema` 首期约束，
  所以代码确实走到了 `CREATE EXTENSION IF NOT EXISTS vector`。剩下两种成因：

  - `installed_version` 为空但 `vector` 那一行存在 → **成因②：角色权限不足**。用超级用户执行
    `CREATE EXTENSION IF NOT EXISTS vector;` 即可，然后**必须重启后端容器**（编解码器只在建池回调里注册，
    不重启不自愈）。
  - 查询结果里**根本没有 `vector` 这一行** → **成因③：coolify-db 镜像未打包 pgvector**，`CREATE EXTENSION`
    会直接报 "extension is not available"。改代码/改配置都无解，得给那台 PG 装扩展包或换成带 pgvector 的镜像——
    它同时是 Coolify 自己的库，属基础设施变更，风险面完全不同，必须先单独评估再动。
  - 不想碰数据库也能分辨：登录后打开知识库页，503 提示原文就是 `init_schema` 记下的 reason。

- [x] A2b 未带 token `curl -s -o /dev/null -w '%{http_code}\n' https://bidmaster.asia/api/auth/me` → **401**（原 502）：
      后端确实在服务请求，且生产鉴权开着、本地 `AUTH_DISABLED` 试验开关没渗进来。

- [ ] A3 人肉验收页面（浏览器，非 curl，因为要看渲染不能只看状态码）

  `/docs` 可访问；`/statistics` 评标基准价按规则重算（旧数据需重算这条是历史欠债）；登录 → 主流程可用。

## B. 合第二个 MR（纯文档 + 脚本，不动运行时代码）

- [x] B1 已合并（`d954bc3` 进 main）
- [x] B2 CI + 构建部署已完成（`backend/frontend Up 4 hours`，即 13:07 那次部署至今没重启过）
- [x] B3 验收：`/api/auth/me` 由 502 变 **401**、`/docs` 200、容器 Up 4h 且 `RestartCount=0`

## C. 凭据整改（一次做完，之后日常发版不用再碰任何密钥）

> 用户 09-04 明确决定：推迟到本轮功能任务收尾后统一做一次。**可推迟、不可取消**——
> 明文 token 已外泄过一次，它等价于「谁能读到那个脚本，谁就能推 main → 流水线自动把代码部署进生产」。
> 另：本机无生产机入口（腾讯云那台强制微信扫码登录，publickey 被拒），故 C 段所有【你·服务器】步骤不可代做。

顺序固定 §2 → §1 → §3，理由：先换成不可读的机制，再轮换旧值，最后作废外泄令牌；
且 §2 的 ⑤ 要用仓库里的 `scripts/deploy-bidmaster.sh`，必须 B1 已合并。

- [ ] C1 runbook 第 2 节 Deploy Key ①→⑥。**③ 的 `git push origin main --dry-run` 必须被拒**，
      没被拒就说明这把 key 有写权限，回去改成只读——否则整件事没有意义
- [ ] C2 runbook 第 1 节 webhook 密钥轮换 ①→⑥（走「临时新旧都收」，无失败窗口，随时可做）
- [ ] C3 runbook 第 3 节 作废 CNB 个人访问令牌，并同步表中三处存放点
- [ ] C4 runbook 第 4 节 收尾核对 5 项全勾，最后合并一次小改动证明 CD 没被换断

## D. 收尾杂项

- [ ] D1 本地试验开关（下次要测鉴权前必须关）：`.env.local:10` 的 `NEXT_PUBLIC_AUTH_DISABLED=true`、
      `src/backend/.env:22` 的 `AUTH_DISABLED=true`
- [x] D2 A2 结果已回填状态板：生产**没有 vector 类型**，成因待 A2c 分辨
- [ ] D3 校对生产机部署脚本的状态文件（**在 C1 装完新脚本之后看一眼即可，通常不用手改**）：
      `/var/lib/bidmaster-deploy/last-good` 当前内容仍是 `sha=76cecad…`（2026-08-19），与实际运行版本脱节。
      新脚本每次成功部署都会自己写这个文件，所以第一次成功部署后它就自动正确了。
      真正需要人工干预的只有一个窗口——**装完新脚本后首次部署就失败**：此时旧值 `76cecad` 是 7 位短 SHA
      且旧版从不给镜像打 tag，新脚本会判为「无回滚点」并打 WARN（不会误回滚到 8 月版本），
      但也就没有回滚保护，得人工介入。

      装完新脚本后核对（**用完整 SHA，不要用 `--short`**：脚本按完整 SHA 给镜像打 tag，
      短 SHA 会对不上 tag，回滚等于失效）：

      cd /var/www/bid-master-web && git rev-parse HEAD && cat /var/lib/bidmaster-deploy/last-good 2>/dev/null

      两者不一致且尚未跑过一次新脚本部署时：

      cd /var/www/bid-master-web && git rev-parse HEAD | tee /var/lib/bidmaster-deploy/last-good

- [ ] D4 删生产 PG 里的孤儿库 `bidmaster_smoke_20260903`：09-03 我在生产机上做冷启动复现时建的，
      复现完没清（失败分支才保留库，保留即空库）。它占空间、且会让后来的人误以为是有用的业务库。

      docker exec coolify-db psql -U <USER> -d bidmaster_smoke_20260903 -tc "select count(*) from information_schema.tables where table_schema='public'"
      docker exec coolify-db psql -U <USER> -d postgres -c "DROP DATABASE bidmaster_smoke_20260903"

      第一条应出 `0`；不是 0 就先别 drop，把输出贴回来。删库是不可逆动作，且这是共享的 Coolify 实例，
      务必确认库名逐字符对得上再执行第二行。第二行连的是维护库 `postgres`（标准 postgres 镜像自带；
      若报「数据库不存在」，换成 A2c 里查到的 `POSTGRES_DB` 值）。

- [ ] D5 本地收尾：删已合并的排障分支（09-04 已删 6 个，均为 `merge-base --is-ancestor` 验过的全并入）、
      `chore/state-board-cicd-closeout`（`0d1f9fd`）作废——内容已拣进 `8874007`，若它有 MR 请直接关掉

## E. 等拍板的可选项（不做也不影响现状）

- E1 阶段 B：CI 构建镜像推仓库 → 服务器只 `pull && up -d`，彻底摆脱服务器侧慢构建
- E2 构建期注入 `GIT_SHA`，让生产 `/health` 不再是 `git.commit=unknown`（新脚本已打 SHA tag，
  可先靠 tag 定位，注入属锦上添花）
- E3 部署脚本自举：脚本换新版后，靠下一次合并部署生效；而**正是这次替换让 STATE_FILE 失效**。
  规避办法是让 webhookd 先调一层薄封装做自举复制——但那是生产机上的第二个脚本，与本仓库
  「能固化进 Makefile 就不新建 shell」的约定冲突，故列为待拍板而非直接做
- E4 本仓库合并策略是 fast-forward only：并行多 MR 必须串行合，合完一个就 `git rebase cnb/main && git push -f`
      剩下那些（本次 #10 卡住的原因）
