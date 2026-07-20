# macOS 安装 Bid Master CLI 命令

> 适用场景：Homebrew / pipx 安装失败，使用 Python 虚拟环境隔离安装 `bidmaster`。

## 1. 创建隔离环境

```bash
python3 -m venv "$HOME/.bid-master-cli/venv"
```

## 2. 升级虚拟环境里的 pip

```bash
"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U pip
```

## 3. 安装或升级 Bid Master CLI

```bash
"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U bid-master-cli
```

## 4. 创建全局命令入口

```bash
mkdir -p "$HOME/.local/bin"
printf '%s\n' '#!/usr/bin/env bash' 'exec "$HOME/.bid-master-cli/venv/bin/bidmaster" "$@"' > "$HOME/.local/bin/bidmaster"
chmod +x "$HOME/.local/bin/bidmaster"
```

## 5. 让当前终端立即识别 bidmaster

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## 6. 让以后新终端也能识别 bidmaster

```bash
grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.zshrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

## 7. 验证安装

```bash
bidmaster --version
bidmaster tools list
```

预期版本：

```bash
Bid Master CLI 1.0.3
```

## 8. 登录网页端授权

```bash
bidmaster auth login
```

## 9. 常用命令示例

```bash
bidmaster extract tender.pdf --out result.md
bidmaster quote opening.xlsx --out quote-report.md
bidmaster simulate tender.pdf --project-name 项目名称 --project-type design --out simulate.md
```

## 10. 以后升级 CLI

```bash
"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U bid-master-cli
bidmaster --version
```

## 一次性复制执行版

```bash
python3 -m venv "$HOME/.bid-master-cli/venv"
"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U pip
"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U bid-master-cli
mkdir -p "$HOME/.local/bin"
printf '%s\n' '#!/usr/bin/env bash' 'exec "$HOME/.bid-master-cli/venv/bin/bidmaster" "$@"' > "$HOME/.local/bin/bidmaster"
chmod +x "$HOME/.local/bin/bidmaster"
export PATH="$HOME/.local/bin:$PATH"
grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.zshrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
bidmaster --version
bidmaster tools list
```
