#!/usr/bin/env bash
# deploy-bidmaster.sh 的本地桩测：docker/curl 全部打桩，只验脚本自身的分支逻辑。
# 不碰真实 docker、不碰生产路径。
set -u
SCRIPT="$1"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/state"

# ---- 桩：docker ----
cat > "$T/bin/docker" <<'STUB'
#!/usr/bin/env bash
sub=""
for a in "$@"; do case "$a" in config|build|up) sub="$a";; esac; done
case "$1" in
  compose)
    case "$sub" in
      config) printf 'proj-backend\nproj-frontend\n' ;;
      build)  echo "[stub] build" ;;
      up)     echo "[stub] up" ;;
      *) exit 0 ;;
    esac ;;
  tag)    echo "[stub] tag $2 -> $3" ;;
  image)  exit 0 ;;
  ps)
    if [ -n "${STUB_FAIL_HEALTH:-}" ]; then echo "backend-x Restarting (3) 5 seconds ago"
    else echo "backend-x Up 2 minutes"; fi ;;
  logs)   echo "[stub] fake traceback: RuntimeError: schema boom" ;;
  *) exit 0 ;;
esac
STUB

# ---- 桩：curl ----
cat > "$T/bin/curl" <<'STUB'
#!/usr/bin/env bash
[ -n "${STUB_FAIL_HEALTH:-}" ] && exit 22
exit 0
STUB
chmod +x "$T/bin/docker" "$T/bin/curl"
export PATH="$T/bin:$PATH"

# ---- 造一个可离线 fetch 的假仓库 ----
git init -q --bare "$T/origin.git"
git init -q "$T/seed"
printf 'x\n' > "$T/seed/f.txt"
git -C "$T/seed" -c user.email=t@t -c user.name=t commit -qam init 2>/dev/null \
  || { git -C "$T/seed" add -A; git -C "$T/seed" -c user.email=t@t -c user.name=t commit -qm init; }
git -C "$T/seed" branch -M main
git -C "$T/seed" remote add origin "$T/origin.git"
git -C "$T/seed" push -q origin main
git clone -q "$T/origin.git" "$T/repo"

: > "$T/deploy.log"
base_env() {
  export REPO_DIR="$T/repo" COMPOSE_FILE="$T/compose.yml" DEPLOY_LOG="$T/deploy.log"
  export STATE_FILE="$T/state/deployed-sha" HEALTH_RETRIES=2 HEALTH_INTERVAL=1
}
pass=0; fail=0
check() { # check <名称> <期望exit> <实际exit> <期望日志片段>
  if [ "$2" = "$3" ] && grep -q "$4" "$T/deploy.log"; then
    echo "  ✓ $1"; pass=$((pass+1))
  else
    echo "  ✗ $1（期望 exit=$2 得 $3，日志需含「$4」）"; fail=$((fail+1))
    sed 's/^/      log| /' "$T/deploy.log"
  fi
}

echo "[A] 健康门通过 → 部署完成 + 记录 SHA"
base_env; unset STUB_FAIL_HEALTH
out="$(bash "$SCRIPT" 2>&1)"; rc=$?
check "成功路径" 0 "$rc" "部署完成 sha="
[ -s "$T/state/deployed-sha" ] && echo "  ✓ 状态文件已写入：$(cat "$T/state/deployed-sha")" && pass=$((pass+1)) \
  || { echo "  ✗ 状态文件为空"; fail=$((fail+1)); }

echo "[B] 容器 Restarting → 提前判失败 → 回滚 → 非零退出"
: > "$T/deploy.log"; PREV40=1111111111111111111111111111111111111111; echo "$PREV40" > "$T/state/deployed-sha"
base_env; export STUB_FAIL_HEALTH=1
out="$(bash "$SCRIPT" 2>&1)"; rc=$?
check "失败+回滚路径" 1 "$rc" "FATAL: 部署失败 sha="
grep -q "开始回滚到 $PREV40" "$T/deploy.log" && echo "  ✓ 走了回滚分支" && pass=$((pass+1)) \
  || { echo "  ✗ 未走回滚分支"; fail=$((fail+1)); }
grep -q "fake traceback" "$T/deploy.log" && echo "  ✓ 现场日志已保留进部署日志" && pass=$((pass+1)) \
  || { echo "  ✗ 未保留现场日志"; fail=$((fail+1)); }
[ "$(cat "$T/state/deployed-sha")" = "$PREV40" ] && echo "  ✓ 失败未污染状态文件" && pass=$((pass+1)) \
  || { echo "  ✗ 状态文件被失败部署改写"; fail=$((fail+1)); }

echo "[C] 已跟踪文件被改 → 拒绝部署（D 类守卫）"
: > "$T/deploy.log"; unset STUB_FAIL_HEALTH
printf 'patched on server\n' >> "$T/repo/f.txt"
base_env
out="$(bash "$SCRIPT" 2>&1)"; rc=$?
check "脏工作区拒绝" 1 "$rc" "疑似生产手改补丁"
git -C "$T/repo" checkout -q -- f.txt

echo "[D] origin URL 含明文凭据 → 打印 WARN 但不误判成功"
: > "$T/deploy.log"
git -C "$T/repo" remote set-url origin "https://user:secreTT@example.com/x.git"
base_env
out="$(bash "$SCRIPT" 2>&1)"; rc=$?
grep -q "含明文凭据" "$T/deploy.log" && echo "  ✓ 明文凭据告警生效" && pass=$((pass+1)) \
  || { echo "  ✗ 未告警"; fail=$((fail+1)); }
git -C "$T/repo" remote set-url origin "$T/origin.git"

echo "[E] 状态文件解析（旧格式兼容 + 非法值降级为无回滚点）"
LONG40=2222222222222222222222222222222222222222
run_state_case() { # run_state_case <名称> <文件内容|__MISSING__> <期望 prev 值>
  : > "$T/deploy.log"
  if [ "$2" = "__MISSING__" ]; then rm -f "$T/state/deployed-sha"
  else printf '%s\n' "$2" > "$T/state/deployed-sha"; fi
  base_env; unset STUB_FAIL_HEALTH
  bash "$SCRIPT" >/dev/null 2>&1
  if grep -q "回滚点 prev=$3" "$T/deploy.log"; then echo "  ✓ $1"; pass=$((pass+1))
  else echo "  ✗ $1（期望 prev=$3）"; fail=$((fail+1)); sed 's/^/      log| /' "$T/deploy.log"; fi
}
run_state_case "状态文件不存在 → 无回滚点且部署照常成功" "__MISSING__" "无"
run_state_case "旧版短 SHA 整行 → 视为无回滚点" "sha=76cecad branch=main at=x" "无"
run_state_case "旧版格式但含完整 SHA → 剥前缀认出回滚点" "sha=$LONG40 branch=main at=x" "$LONG40"
run_state_case "非十六进制垃圾 → 视为无回滚点" "not-a-sha" "无"

echo
echo "结果：$pass 通过 / $fail 失败"
[ "$fail" = "0" ]
