#!/usr/bin/env bash
# Bid Master Web 生产部署脚本（仓库内为权威版本；服务器 /opt/webhookd/scripts/ 使用本文件）
#
# 设计目标是终结复盘中的 C/D/E 三类故障（见 docs/reviews/2026-09-03-cicd-retrospective.md）：
#   D  只允许 fast-forward，已跟踪文件有改动就拒绝部署并打印清单 —— 不给生产补丁留藏身处
#   C  每个失败分支都以非零码退出并打印可归因的一行，杜绝「Deploy failed」空原因
#   E  构建成功后必须过启动健康门（进程存活 + /api/health 200）才算完成；
#      不过则自动回滚到上一个不可变 tag，线上不会停在崩溃循环里等人来看
#
# 凭据：本文件不含任何 token。git 走 Deploy Key（仓库专用只读 SSH 密钥），
#       步骤见 docs/deployment/credential-rotation-runbook.md 第 2 节。
#
# 兼容性：只用 POSIX/bash 3 通用语法（无 mapfile、无 printf %(...)T），便于静态审查与本地桩测。
# 可用同名环境变量覆盖路径，方便 `--self-test` 之外的人工演练。

set -euo pipefail

# ---------- 配置 ----------
REPO_DIR="${REPO_DIR:-/var/www/bid-master-web}"
COMPOSE_FILE="${COMPOSE_FILE:-/data/coolify/services/fga7l0ngdi1bx9ikv3dulent/docker-compose.yml}"
DEPLOY_LOG="${DEPLOY_LOG:-/var/log/bidmaster-deploy.log}"
STATE_FILE="${STATE_FILE:-/opt/webhookd/state/deployed-sha}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-backend-fga7l0ngdi1bx9ikv3dulent}"
HEALTH_URLS_DEFAULT="http://127.0.0.1:8000/api/health https://bidmaster.asia/api/health"
HEALTH_URLS="${HEALTH_URLS:-$HEALTH_URLS_DEFAULT}"
HEALTH_RETRIES="${HEALTH_RETRIES:-24}"   # 24 × 5s = 120s 启动窗口（paddle 首次加载较慢）
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$DEPLOY_LOG"; }
die() { log "FATAL: $*"; exit 1; }

# ---------- 1. 拉代码（只允许快进） ----------
cd "$REPO_DIR" || die "仓库目录不存在：$REPO_DIR"

# 旧版脚本可能把 token 留在 remote URL 里；先报警不阻断，便于平滑迁移
if git remote get-url origin 2>/dev/null | grep -q '://[^/]*:[^@]*@'; then
  log "WARN: origin URL 含明文凭据，应改为 Deploy Key 的 git@ 形式"
fi

# 只看已跟踪文件：D 类风险是「生产上改了仓库里有的文件」（如 db_schema.py）；
# uploads/ 等运行时产物未跟踪，不该阻断部署
dirty="$(git status --porcelain --untracked-files=no)"
[ -z "$dirty" ] || die "工作区有未提交改动，疑似生产手改补丁（D 类）。先入库再部署。清单：$dirty"

git fetch origin main --quiet || die "git fetch 失败（网络或 Deploy Key 权限）"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git merge --ff-only origin/main >/dev/null 2>&1 \
    || die "无法 fast-forward：本地与 origin/main 已分叉，人工介入，不用强制重置覆盖现场"
fi
# 用完整 40 位 SHA 作镜像 tag 与状态文件内容：短 SHA 会让「tag / 回滚目标 / 状态文件」三处的
# 长度口径不一致（本脚本曾写 12 位、旧版脚本写 7 位），回滚点校验就无从判真伪。
# 日志里略长，但换来的是回滚目标唯一可比、可验证。
SHA="$(git rev-parse HEAD)"
log "代码就绪 sha=$SHA"

# ---------- 2. 解析镜像名与回滚点 ----------
IMAGES="$(docker compose -f "$COMPOSE_FILE" config --images)"
[ -n "$IMAGES" ] || die "compose 未解析出任何镜像名：$COMPOSE_FILE"
# 状态文件兼容处理：旧版脚本写的是「sha=<短SHA> branch=… at=…」整行、且用 7 位短 SHA，
# 而本版按完整 40 位 SHA 给镜像打 tag。直接 cat 会把整行当 tag，回滚时变成一个非法镜像名。
# 故：取第一个字段 → 剥 sha= 前缀 → 只承认 40 位十六进制，其余一律视为无回滚点。
# 宁可「无回滚点」并告警，也不拿一个对不上的 tag 去回滚（那会把线上换成一个来源不明的镜像）。
# 注意：必须先判文件存在——脚本开了 set -e，直接对不存在的文件跑 awk 会以退出码 2 终止整个部署
# （首次运行时状态文件本就不存在，等于让每一次部署都失败）。
PREV_SHA=""
if [ -f "$STATE_FILE" ]; then
  PREV_SHA="$(awk '{print $1; exit}' "$STATE_FILE" | sed 's/^sha=//')"
  case "$PREV_SHA" in ''|*[!0-9a-fA-F]*) PREV_SHA="" ;; esac
  [ "${#PREV_SHA}" -eq 40 ] || PREV_SHA=""
fi
if [ -n "$PREV_SHA" ]; then
  for img in $IMAGES; do
    docker image inspect "${img}:${PREV_SHA}" >/dev/null 2>&1 \
      || log "WARN: 回滚镜像不存在 ${img}:${PREV_SHA}（可能已被 prune），本次可能无回滚点"
  done
fi
log "回滚点 prev=${PREV_SHA:-无}"

# ---------- 3. 构建（此时旧容器仍在服务，失败不影响线上） ----------
docker compose -f "$COMPOSE_FILE" build --pull \
  || die "镜像构建失败（见上方构建日志），旧容器未被替换"
for img in $IMAGES; do
  docker tag "${img}:latest" "${img}:${SHA}" || die "打不可变 tag 失败：$img:$SHA"
done
log "构建完成，已打 tag :$SHA"

# ---------- 4. 换容器 ----------
docker compose -f "$COMPOSE_FILE" up -d || die "docker compose up 失败"

# ---------- 5. 启动健康门（E 类唯一防线） ----------
containers_restarting() {
  docker ps --format '{{.Names}} {{.Status}}' | grep -E 'backend|frontend' | grep -q 'Restarting'
}

health_gate() {
  attempt=1
  while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
    sleep "$HEALTH_INTERVAL"
    if containers_restarting; then
      log "健康门第 $attempt 次：容器处于 Restarting，提前判失败"
      return 1
    fi
    ok=1
    for url in $HEALTH_URLS; do
      if curl -fsS --max-time 8 "$url" >/dev/null 2>&1; then
        :
      else
        ok=0; log "健康门第 $attempt 次：$url 未通过"
      fi
    done
    if [ "$ok" = "1" ]; then
      log "健康门第 $attempt 次：全部通过"
      return 0
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

if health_gate; then
  mkdir -p "$(dirname "$STATE_FILE")"
  echo "$SHA" > "$STATE_FILE"
  log "部署完成 sha=${SHA}（已通过启动健康门，回滚点 prev=${PREV_SHA:-无}）"
  exit 0
fi

# ---------- 6. 回滚 ----------
log "健康门未通过，开始回滚到 ${PREV_SHA:-无可用回滚点}"
if [ -n "$PREV_SHA" ]; then
  for img in $IMAGES; do
    docker tag "${img}:${PREV_SHA}" "${img}:latest" 2>/dev/null || true
  done
  docker compose -f "$COMPOSE_FILE" up -d || log "WARN: 回滚 up 也失败，需人工介入"
  first_url="$(echo "$HEALTH_URLS" | cut -d' ' -f1)"
  if curl -fsS --max-time 15 "$first_url" >/dev/null 2>&1; then
    log "回滚成功，线上恢复到 ${PREV_SHA}；本次 sha=$SHA 失败详情：docker logs --tail=120 $BACKEND_CONTAINER"
  else
    log "回滚后健康检查仍失败，服务不可用，立即人工介入"
  fi
fi
# 保留现场日志供归因（不清理、不覆盖）
docker logs --tail=40 "$BACKEND_CONTAINER" 2>&1 | tee -a "$DEPLOY_LOG" || true
die "部署失败 sha=${SHA}：镜像构建通过但应用未能启动，已保留现场日志"
