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

- [ ] A2c 分辨「没有 vector 类型」的两种成因（处置完全不同，别直接装扩展）

      # 分辨 ①配置未开启/不匹配 vs ②扩展真没装（只看这几个变量，别 dump DATABASE_URL，里面含口令）
      docker exec backend-fga7l0ngdi1bx9ikv3dulent sh -c 'env | grep -iE "^KNOWLEDGE_BASE_ENABLED=|^RAG_REQUIRED=|^RAG_EMBEDDING_MODEL=|^RAG_EMBEDDING_DIMENSION="'
      docker ps --format '{{.Names}}' | grep -iE 'postgres|pgsql'                                  # 取 pg 容器名
      docker exec <pg容器名> psql -U user -d bidmaster -tc "select extname from pg_extension order by 1"

  - `KNOWLEDGE_BASE_ENABLED` 不为 true，或 model/dimension 不满足首期约束（`text-embedding-v4` / `1024`）
    → 成因①：`init_schema` 在执行建扩展那条 SQL 之前就 return 了，扩展本来就不会被创建。此时该问的是
    「生产要不要开知识库」，而不是「怎么装扩展」。
  - 配置正常而 `pg_extension` 里没有 `vector` → 成因②：数据库角色权限不足或镜像未带扩展包，需
    `CREATE EXTENSION IF NOT EXISTS vector;`（超级用户执行），**装完必须重启后端容器**——编解码器只在
    建池回调里注册，不重启不会自愈。

- [x] A2b 未带 token `curl -s -o /dev/null -w '%{http_code}\n' https://bidmaster.asia/api/auth/me` → **401**（原 502）：
      后端确实在服务请求，且生产鉴权开着、本地 `AUTH_DISABLED` 试验开关没渗进来。

- [ ] A3 人肉验收页面（浏览器，非 curl，因为要看渲染不能只看状态码）

  `/docs` 可访问；`/statistics` 评标基准价按规则重算（旧数据需重算这条是历史欠债）；登录 → 主流程可用。

## B. 合第二个 MR（纯文档 + 脚本，不动运行时代码）

- [x] B1 已合并（`d954bc3` 进 main）
- [ ] B2 等 CI 约 6-8 min + 服务器构建约 2-3 min（pip 层命中缓存时）
- [ ] B3 验收：`curl -s -o /dev/null -w '%{http_code}\n' https://bidmaster.asia/` 出 200，且 A1 的 inspect 命令仍显示不重启

## C. 凭据整改（一次做完，之后日常发版不用再碰任何密钥）

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
- [ ] D2 确认 A2 的结果并回填 `state/board.md` 待办（装了/没装，决定知识库这条线是否还要做事）
- [ ] D3 改生产机部署脚本的状态文件（**要在 C1 装完新脚本之后做**：旧脚本不读这个文件，
      提前改会被下一次部署覆写，等于没改）。`/opt/webhookd/scripts/deploy-bidmaster.sh` 第 3 行
      `STATE_FILE=/var/lib/bidmaster-deploy/last-good` 当前内容仍是 `sha=76cecad…`（2026-08-19），已过时。
      改成当前实际运行的版本（**用命令取值，别照抄文档里任何硬编码 SHA**）：

      cd /var/www/bid-master-web && git rev-parse --short HEAD | tee /var/lib/bidmaster-deploy/last-good

  正向部署不受影响，但一旦某次部署失败触发自动回滚，这个值会把镜像退回 8 月 19 日的版本——属埋雷。

## E. 等拍板的可选项（不做也不影响现状）

- E1 阶段 B：CI 构建镜像推仓库 → 服务器只 `pull && up -d`，彻底摆脱服务器侧慢构建
- E2 构建期注入 `GIT_SHA`，让生产 `/health` 不再是 `git.commit=unknown`（新脚本已打 SHA tag，
  可先靠 tag 定位，注入属锦上添花）
- E3 部署脚本自举：脚本换新版后，靠下一次合并部署生效；而**正是这次替换让 STATE_FILE 失效**。
  规避办法是让 webhookd 先调一层薄封装做自举复制——但那是生产机上的第二个脚本，与本仓库
  「能固化进 Makefile 就不新建 shell」的约定冲突，故列为待拍板而非直接做
- E4 本仓库合并策略是 fast-forward only：并行多 MR 必须串行合，合完一个就 `git rebase cnb/main && git push -f`
      剩下那些（本次 #10 卡住的原因）
