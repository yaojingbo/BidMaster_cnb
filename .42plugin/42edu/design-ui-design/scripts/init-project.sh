#!/bin/bash
# Next.js + shadcn/ui 项目初始化脚本（通用）
# 用法: bash .42plugin/42edu/design-ui-design/scripts/init-project.sh
set -e

echo "🚀 开始项目初始化..."

# 1. 检查/创建 Next.js 项目
if [ -f "package.json" ] && grep -q '"next"' package.json 2>/dev/null; then
  echo "✓ 找到现有 Next.js 项目"
else
  echo "→ 创建 Next.js 项目..."

  # 使用合法的临时目录名
  TEMP_DIR="temp-next-app-$(date +%s)"

  bunx create-next-app@latest "$TEMP_DIR" \
    --ts --tailwind --eslint --app --src-dir \
    --import-alias "@/*" --use-bun --yes

  # 保留现有项目文件，复制 Next.js 文件
  echo "→ 整合项目文件..."

  # 复制配置文件
  cp "$TEMP_DIR/package.json" . 2>/dev/null || true
  cp "$TEMP_DIR/tsconfig.json" . 2>/dev/null || true
  cp "$TEMP_DIR/next.config.ts" . 2>/dev/null || true
  cp "$TEMP_DIR/next-env.d.ts" . 2>/dev/null || true
  cp "$TEMP_DIR/eslint.config.mjs" . 2>/dev/null || true
  cp "$TEMP_DIR/postcss.config.mjs" . 2>/dev/null || true
  cp "$TEMP_DIR/bun.lock" . 2>/dev/null || true

  # 复制目录
  cp -r "$TEMP_DIR/public" . 2>/dev/null || true
  cp -r "$TEMP_DIR/node_modules" . 2>/dev/null || true

  # 处理 src 目录（保留现有内容，添加 app 目录）
  if [ -d "$TEMP_DIR/src/app" ]; then
    mkdir -p src
    cp -r "$TEMP_DIR/src/app" src/ 2>/dev/null || true
  fi

  # 清理临时目录
  rm -rf "$TEMP_DIR"

  echo "✓ Next.js 项目创建完成"
fi

# 2. 初始化 shadcn/ui
echo "→ 初始化 shadcn/ui..."
echo "" | bunx shadcn@latest init --defaults 2>/dev/null || bunx shadcn@latest init -y 2>/dev/null || echo "⚠ shadcn/ui 初始化可能需要手动确认"

# 3. 安装核心依赖
echo "→ 安装核心依赖..."
bun add zustand lucide-react uuid 2>/dev/null || npm install zustand lucide-react uuid
bun add -D @types/uuid 2>/dev/null || npm install -D @types/uuid

# 4. 安装 shadcn 组件
echo "→ 安装 shadcn/ui 组件..."
bunx shadcn@latest add button card input label textarea \
  select checkbox switch dialog sheet scroll-area separator \
  dropdown-menu tabs tooltip avatar badge skeleton sonner -y 2>/dev/null || echo "⚠ 部分组件安装可能需要手动确认"

# 5. 启用 TweakCN 实时预览
echo "→ 配置 TweakCN 实时预览..."
LAYOUT_FILE="src/app/layout.tsx"
if [ -f "$LAYOUT_FILE" ]; then
  # 检查是否已添加 TweakCN
  if ! grep -q "tweakcn.com" "$LAYOUT_FILE" 2>/dev/null; then
    # macOS 兼容的 sed 命令，替换 html 标签并添加 TweakCN 脚本
    sed -i '' 's|<html lang="en">|<html lang="zh">\n      <head>\n        <script async crossOrigin="anonymous" src="https://tweakcn.com/live-preview.min.js" />\n      </head>|g' "$LAYOUT_FILE" 2>/dev/null || \
    sed -i 's|<html lang="en">|<html lang="zh">\n      <head>\n        <script async crossOrigin="anonymous" src="https://tweakcn.com/live-preview.min.js" />\n      </head>|g' "$LAYOUT_FILE"
    echo "✓ TweakCN 实时预览已启用"
  else
    echo "✓ TweakCN 已配置"
  fi
else
  echo "⚠ 未找到 layout.tsx，请手动添加 TweakCN"
fi

echo ""
echo "✅ 项目初始化完成！"
echo ""
echo "已完成："
echo "  ✓ Next.js 15+ (App Router)"
echo "  ✓ Tailwind CSS v4"
echo "  ✓ shadcn/ui 组件库"
echo "  ✓ Zustand 状态管理"
echo "  ✓ TweakCN 实时预览"
echo ""
echo "后续步骤："
echo "  1. 根据 UI 规格创建具体的目录结构"
echo "  2. 运行 bun dev 启动开发服务器"
echo ""
