# 生产 pgvector 落地：把 bid_master 迁到带 pgvector 的独立 PG

> 关联：`docs/deployment/post-deploy-checklist.md`（A2c 结论）、`docs/reviews/2026-09-03-cicd-retrospective.md`、
> `.42cog/intent.md:15`（知识库 RAG 检索命中率是核心目标，故本迁移属主干能力恢复，不是可选项）。

## 0. 事实基线（全部 09-04 生产实测，非推测）

- 后端连的是 `coolify-db:5432/bid_master`——**Coolify 自己的共享 PG 实例**，机器上没有独立数据库容器。
- 该实例里**没有 `postgres` 角色**（超级用户由 Coolify 生成，用 `printenv POSTGRES_USER` 取）。
- `pg_available_extensions` 只有 `pg_trgm | 1.6 | (未安装)`，**没有 `vector` 这一行**
  → 镜像未打包 pgvector，`CREATE EXTENSION vector` 在该实例上根本不可能成功。
- 配置侧已排除：容器 env 无知识库四个变量、`.dockerignore` 排除 `.env`，生效值是
  `config.py:60-69` 默认（`True` / `False` / `text-embedding-v4` / `1024`），满足首期约束，
  代码确实执行到了建扩展那步。
- `RAG_VECTOR_SCHEMA_SQL` 第一条语句就是 `CREATE EXTENSION IF NOT EXISTS vector;`，它一失败整个批次中断，
  所以连 `pg_trgm` 也没建成——**生产知识库此前从未可用，只是先后被崩溃循环和降级 WARN 掩盖**。

### 为什么不在 coolify-db 里 apt install 扩展包

容器一旦由 Coolify 重建（升级、改配置、换镜像都会重建）装进去的东西就没了，且该实例同时承载 Coolify 自身的库。
属临时方案，禁止。

### 为什么不设 `KNOWLEDGE_BASE_ENABLED=false`（一度被列为"止血"，已撤回）

该开关只在 `main.py:34` 与 `db_schema.py:527` 被读，前端没有任何就绪接口可据其隐藏入口。
关掉它的唯一效果是把准确原因「数据库缺少 vector 或 pg_trgm 扩展」换成一句「知识库功能已关闭」——
用准确报错换一句假话，正是复盘中 C 类静默失败的反面教材。

## 1. 路线选择

- **B1（推荐，命令确定）**：新起一个 `pgvector` 官方镜像的 PG 容器，`pg_dump`/`pg_restore` 迁数据，
  后端 `DATABASE_URL` 指过去。全程不碰 Coolify 自己的库；回滚 = 把连接串改回去。
  代价：这个容器不由 Coolify 纳管，Coolify 界面里看不到它（须在 D6 登记，见第 6 节）。
- **B2（若第 2 步网络检查报 overlay/swarm 不可用）**：改走 Coolify 界面，在**同一项目**下新增一个
  PostgreSQL 数据库资源、镜像填 `pgvector/pgvector:pg<大版本>`，后续 dump/restore 与切连接串两步完全照搬。
  好处是仍在 Coolify 纳管内；界面标签随版本变，以 B1 的命令为验证真相。

## 2. 第 0 步：取证 + 一个决定性问题（决定走 B1 还是 B2）

```bash
U=$(docker exec coolify-db printenv POSTGRES_USER)
docker exec coolify-db psql -U "$U" -d bid_master -tc "show server_version"
docker exec coolify-db psql -U "$U" -d bid_master -tc "select pg_size_pretty(pg_database_size('bid_master'))"
docker exec coolify-db psql -U "$U" -tc "select datname from pg_database where not datistemplate"
NET=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' backend-fga7l0ngdi1bx9ikv3dulent)
echo "backend 网络=$NET"
docker network inspect -f '{{.Driver}}' $NET
```

判读与记录：
- `server_version` 的大版本决定新镜像 tag（必须对齐，跨大版本 restore 不保证）。
- 库大小决定要不要挑窗口：几十 MB 级随时可做；GB 级要先估时间。
- `datname` 列表里能看见 Coolify 自己的库（通常叫 `coolify`）——**迁移全程只碰 `bid_master`**，
  后面任何 `psql`/`pg_dump` 都显式带 `-d`，不许用通配或循环。
- 网络驱动是 `bridge` → 走 B1；是 `overlay` → `docker run` 会拒绝加入 swarm 网络，改走 B2。

### 2.1 本机实测值（09-06 已跑完上面那段，下面第 3 节按这些值写好，可直接执行）

| 项 | 实测值 |
| --- | --- |
| PG 大版本 | `15.19` → 新镜像 `pgvector/pgvector:pg15` |
| `bid_master` 体积 | `8815 kB`（8.8 MB）→ 迁移数秒，不需要专门窗口 |
| 实例内的库 | `postgres`、`coolify`（Coolify 自己的，**不碰**）、`bid_master` |
| `coolify-db` 超级用户 | 没有 `postgres` 角色；由 `printenv POSTGRES_USER` 取，存 shell 变量 `$U` |
| backend 所在网络 | 4 个且全是 `bridge`：`bid-master-web_bidmaster`、`coolify`、`fga7l0ngdi1bx9ikv3dulent`、`fga7l0ngdi1bx9ikv3dulent_bidmaster` |

新库接入网选 `fga7l0ngdi1bx9ikv3dulent_bidmaster`（Coolify 当前服务的 compose 网络）。
不选 `coolify`：那是 Coolify 自己的管理网，把业务库挂进去会扩大它的可达面。

**待查遗留**：`bid-master-web_bidmaster` 疑似早期手工 compose 部署留下的残骸网络。查一下还有没有容器在里面：

    docker ps -a --filter network=bid-master-web_bidmaster --format '{{.Names}}'

空则可清理（属 D 类生产状态漂移，不阻塞本迁移）。

另外两点：换新 SSH 会话后 `$U` 会丢，重新 `printenv` 取一次；Docker Hub 拉取若超时，
改用 `docker.m.daocloud.io/pgvector/pgvector:pg15`（只是拉取源不同，跑起来的容器完全一样）。

## 3. 迁移动作（B1，参数已按 2.1 实测值写死，可整段直接执行）

后端先停——**只停 backend，前端继续服务**（静态页不受影响）。8.8 MB 的库，整个写入中断只有几十秒：

```bash
U=$(docker exec coolify-db printenv POSTGRES_USER)      # 新会话必须重取
docker exec coolify-db psql -U "$U" -d bid_master -tc "select count(*) from information_schema.tables where table_schema='public'"
docker stop backend-fga7l0ngdi1bx9ikv3dulent            # 验证点：上一条的表数记下来，稍后要一致
```

```bash
# 口令只落盘、不回显。之前写成 echo 到终端，结果整块输出被复制进对话，按本书自己的口径即视为外泄；
# 落盘版既能事后读回（后面填 Coolify 要用），也不会顺带进聊天记录
umask 077; openssl rand -hex 24 > /root/.bidmaster-pg-password
PW=$(cat /root/.bidmaster-pg-password)
docker run -d --name bidmaster-pg --restart unless-stopped \
  --network fga7l0ngdi1bx9ikv3dulent_bidmaster --network-alias bidmaster-pg \
  -e POSTGRES_PASSWORD="***" -e POSTGRES_DB=bid_master \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v bidmaster_pg_data:/var/lib/postgresql/data \
  pgvector/pgvector:pg15
sleep 10; docker exec bidmaster-pg pg_isready -U postgres -d bid_master
```

验证点：`accepting connections`。第一次报 `no response` 是**正常**的——镜像首次启动要先跑 `initdb`，
十几秒内才开始监听；等 10 秒仍无响应再看 `docker logs --tail=20 bidmaster-pg` 定位，别急着重删容器。
后面填 Coolify 用的口令随时 `cat /root/.bidmaster-pg-password` 取（复制到自己终端 → Coolify 界面之间即可，
不必也不应贴进对话）。

（`-e PGDATA` 指到子目录是官方镜像的硬性要求：named volume 根目录非空时它拒绝初始化。
显式 `--network-alias` 是防一手——部分 Docker 版本不把容器名注册进 embedded DNS。）

```bash
docker exec coolify-db pg_dump -U "$U" -d bid_master -Fc -f /tmp/bid_master.dump; echo "dump rc=$?"
docker cp coolify-db:/tmp/bid_master.dump /tmp/bid_master.dump
docker cp /tmp/bid_master.dump bidmaster-pg:/tmp/bid_master.dump
docker exec bidmaster-pg pg_restore -U postgres -d bid_master --no-owner /tmp/bid_master.dump; echo "restore rc=$?"
```

两个 `rc=` **都必须是 0**，非 0 立刻停手贴回来——半截 restore 比不迁更糟。`--no-owner` 是因为两边角色名不同。

```bash
docker exec bidmaster-pg psql -U postgres -d bid_master -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec bidmaster-pg psql -U postgres -d bid_master -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
docker exec bidmaster-pg psql -U postgres -d bid_master -tc "select extname, extversion from pg_extension order by 1"
docker exec bidmaster-pg psql -U postgres -d bid_master -tc "select count(*) from information_schema.tables where table_schema='public'"
```

验证点：扩展列表出现 `vector | 0.8.x` 与 `pg_trgm | 1.6`；表数量与迁移前记下的那个数一致。
这里手动建扩展只是为了**先验证镜像确实带 pgvector**，不等应用启动时再隐式建。

## 4. 切连接串（唯一影响线上的动作）

**先验 DNS 再改配置**——不通的话改了也白改，而且改完的现象（连不上库）会让人以为是迁移坏了：

```bash
docker start backend-fga7l0ngdi1bx9ikv3dulent
docker exec backend-fga7l0ngdi1bx9ikv3dulent python -c "import socket;print(socket.gethostbyname('bidmaster-pg'))"
```

出 IP 才算通。报 `gaierror` / 名字解析失败，说明该 compose 网络不认这个别名，退一步把它同时接入服务网络：

```bash
docker network connect fga7l0ngdi1bx9ikv3dulent bidmaster-pg
docker exec backend-fga7l0ngdi1bx9ikv3dulent python -c "import socket;print(socket.gethostbyname('bidmaster-pg'))"
```

通了之后，在 Coolify 该服务的环境变量里把 `DATABASE_URL` 改为：

```
postgresql://postgres:<PW>@bidmaster-pg:5432/bid_master
```

`<PW>` 换成 `/root/.bidmaster-pg-password` 的内容。**这个值只存在于 Coolify 环境变量和服务器上，
不进 git、不进聊天记录**（若曾在聊天里出现，按 `credential-rotation-runbook.md` 的口径当外泄处理：
趁库还是空的 `docker rm -f bidmaster-pg && docker volume rm bidmaster_pg_data` 重来一次，成本 30 秒）。

改完在 Coolify 里重新部署（或 `docker compose up -d` 该服务）。回滚方案就一条：把 `DATABASE_URL` 改回原值再部署。

**一条已知的长期风险**：`bidmaster-pg` 不由 compose 管理，若哪天 Coolify 重建了这个服务的网络
（改网络配置、删服重建），它就不在网里了，表现是后端突然连不上库。第 5 节要求把它登记进部署文档与备份计划，
正是为了下次换机/重建时不至于无痕丢数据。

## 5. 验收（缺一条就不算完成）

```bash
docker logs backend-fga7l0ngdi1bx9ikv3dulent 2>&1 | grep -i pgvector      # 应无 WARN 输出
docker inspect -f '重启次数={{.RestartCount}} 启动于={{.State.StartedAt}}' backend-fga7l0ngdi1bx9ikv3dulent
curl -s -o /dev/null -w '%{http_code}\n' https://bidmaster.asia/api/auth/me   # 仍应是 401
```

然后浏览器登录后**真跑一次知识库链路**：上传文件 → 建索引 → 检索一次拿到结果。
理由：`CREATE EXTENSION` 成功只证明数据库准备好了，不证明 embedding 与检索链路通。这是本次事故最大的教训——
**过去我们从来没有把「知识库到底能不能用」当成一个待验收项**。

## 6. 收尾

- [ ] 稳定 1-2 天后，把旧库改名保留而非直接删（可逆）：

      docker exec coolify-db psql -U "$U" -d postgres -c "ALTER DATABASE bid_master RENAME TO bid_master_old_20260904"

  确认新库无异常再 `DROP DATABASE bid_master_old_20260904`。
- [ ] 顺手删掉我 09-03 遗留在同一实例上的孤儿库 `bidmaster_smoke_20260903`（见 checklist D4，先验空再删）。
- [ ] 把 `bidmaster-pg` 登记进 `docs/deployment/` 与服务器备份计划：**它不由 Coolify 纳管**，
      所以 Coolify 的自动备份不会覆盖它——这一点必须在状态板写清，否则下次换机就是无痕丢数据。
- [ ] 回填 `state/board.md`：pgvector 从「生产从未可用」变为「已落地并有运行时证据」。
- [ ] 可选（下一个功能决策，不属本迁移）：给前端加一个知识库就绪接口，让入口在能力不可用时显式置灰而不是点了才 503。
