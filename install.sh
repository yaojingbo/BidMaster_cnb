#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/src/backend"
INSTALL_DIR="$HOME/.bid-master-cli"
VENV_DIR="$INSTALL_DIR/venv"
BIN_DIR="$HOME/.local/bin"
LAUNCHER="$BIN_DIR/bidmaster"

info() {
  printf '%s\n' "$1"
}

fail() {
  printf '错误：%s\n' "$1" >&2
  exit 1
}

version_ge_312() {
  "$1" - <<'PY'
import sys
raise SystemExit(0 if sys.version_info >= (3, 12) else 1)
PY
}

find_python() {
  for candidate in python3.12 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && version_ge_312 "$candidate"; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

if [ ! -f "$BACKEND_DIR/pyproject.toml" ]; then
  fail "请在 bid-master-web 仓库根目录执行：bash install.sh"
fi

PYTHON_BIN="$(find_python || true)"
if [ -z "$PYTHON_BIN" ]; then
  fail "未找到 Python 3.12+。请先安装 Python 3.12 或更高版本后重试。"
fi

info "使用 Python：$PYTHON_BIN"
info "创建隔离环境：$VENV_DIR"
mkdir -p "$INSTALL_DIR" "$BIN_DIR"
"$PYTHON_BIN" -m venv "$VENV_DIR"

VENV_PYTHON="$VENV_DIR/bin/python"
VENV_BIDMASTER="$VENV_DIR/bin/bidmaster"

info "升级 pip..."
"$VENV_PYTHON" -m pip install --upgrade pip

info "安装 Bid Master CLI 及依赖..."
"$VENV_PYTHON" -m pip install -e "$BACKEND_DIR"

cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
exec "$VENV_BIDMASTER" "\$@"
EOF
chmod +x "$LAUNCHER"

info "验证 bidmaster 命令..."
"$LAUNCHER" --version
"$LAUNCHER" tools list >/dev/null

info ""
info "安装完成。"
info "命令入口：$LAUNCHER"
if case ":$PATH:" in *":$BIN_DIR:"*) false ;; *) true ;; esac; then
  info ""
  info "提示：$BIN_DIR 尚未在当前 PATH 中。"
  info "请把下面一行加入 ~/.zshrc 或 ~/.bashrc，然后重新打开终端："
  info "export PATH=\"$BIN_DIR:\$PATH\""
fi
info ""
info "下一步：执行 bidmaster auth login 登录网页端，然后运行 bidmaster --help 查看用法。"
