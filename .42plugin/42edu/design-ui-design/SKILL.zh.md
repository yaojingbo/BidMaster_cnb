---
name: ui-design
description: "用于生成 Next.js Web 应用的前端 UI 规格。创建完整的 UI 规格文档，涵盖布局设计、响应式断点、组件规格、Zustand 状态管理和 Mock 数据规划。输出 spec/design/ui.spec.md，使用本地 JSON 存储实现可运行的功能。"
depends:
  required:
    - .42cog/meta/meta.md
    - .42cog/real/real.md
    - .42cog/cog/cog.md
  optional:
    - spec/pm/pr.spec.md
    - spec/pm/userstory.spec.md
    - spec/dev/sys.spec.md
generates:
  - spec/design/ui.spec.md
---

# UI 设计技能

## 概述

为 Next.js Web 应用生成前端 UI 规格，使用本地存储实现可运行的功能。重点是**即时可用性** - 用户首次加载就能看到完整 UI。

**核心原则：**
- **功能独立**：每个功能无需先配置其他功能即可使用
- **丰富 Mock 数据**：预填充 Store，让 UI 立即可测试
- **本地优先存储**：开发期间使用 Zustand + localStorage
- **扩展点**：为未来数据库/API 集成留下清晰接口

---

## ⚠️ 强制步骤：首先执行项目初始化

> **AI Agent 必须在生成任何规格文档之前执行此步骤。**

### 步骤 1：检查是否需要初始化

```bash
# 先运行此检查
if [ ! -f "package.json" ] || ! grep -q '"next"' package.json 2>/dev/null; then
  echo "INIT_REQUIRED"
else
  echo "INIT_SKIPPED"
fi
```

### 步骤 2：如果输出 INIT_REQUIRED，执行初始化脚本

```bash
bash .42plugin/42edu/design-ui-design/scripts/init-project.sh
```

### 步骤 3：等待初始化完成，然后继续生成规格

**初始化完成之前，不要继续生成规格！**

---

## 适用场景

- 设计 AI 对话应用、SaaS 工具、管理后台的 UI
- 创建完整的 UI 规格文档供开发参考
- 需要具有本地数据持久化的前端页面

**不适用于：** 数据库模式设计、后端 API 实现、认证系统（使用后续技能）。

## 快速参考

| 任务 | 操作 |
|------|------|
| 技术栈 | Next.js 15+, React 19+, Tailwind CSS v4, shadcn/ui, Zustand |
| 输出 | `spec/design/ui.spec.md` |
| Mock 数据示例 | 参见 `references/mock-data-examples.md` |
| Store 模板 | 参见 `references/store-templates.md` |

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15+ (App Router) |
| UI | React 19+ (优先服务端组件) |
| 样式 | Tailwind CSS v4 (OKLCH 色彩空间) |
| 组件 | shadcn/ui |
| 表单 | React Hook Form + Zod |
| 状态 | Zustand + localStorage 持久化 |
| 图标 | Lucide React |

**重要：** 不使用 Google Fonts（中国无法访问）。使用系统字体栈。

---

## 工作流程

### 阶段 0：前置条件

**必需文档（必须全部存在）：**
1. `.42cog/meta/meta.md` - 项目元信息
2. `.42cog/real/real.md` - 现实约束
3. `.42cog/cog/cog.md` - 认知模型（智能体、实体、流程）

如缺失，执行：`调用技能：meta-42cog`

**可选文档**（如存在，作为参考）：
- `spec/pm/pr.spec.md` - 产品需求
- `spec/pm/userstory.spec.md` - 用户故事
- `spec/dev/sys.spec.md` - 系统架构

### 阶段 1：智能分析

基于上下文做出三个关键决策：

#### 1.1 应用类型

| 判断标准 | SPA | MPA |
|----------|-----|-----|
| 核心交互 | 频繁状态变化、实时更新 | 独立模块 |
| 用户任务 | 连续流程 | 离散任务 |
| 示例 | 聊天、编辑器、仪表盘 | 文档、电商 |

#### 1.2 导航结构

| 类型 | 适用场景 | 项目数 |
|------|----------|--------|
| 顶部导航 | 功能少、品牌重要 | 3-5 |
| 侧边导航 | 功能多、层级深 | 5-10 |
| 底部导航 | 移动优先 | 3-5 |
| 混合 | 复杂应用 | 顶部 + 侧边 |

#### 1.3 配色方案 (OKLCH)

| 产品类型 | 建议色相 | 情感 |
|----------|----------|------|
| AI 聊天/助手 | 200-280° (蓝/紫) | 智能、可信 |
| 生产力工具 | 180-240° (蓝/绿) | 专业、高效 |
| 创意工具 | 270-30° (紫/橙) | 创新、活力 |

### 阶段 2：设计系统

**设计令牌**（Tailwind CSS v4）：
```css
@theme inline {
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --radius-md: 0.5rem;
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

**系统字体栈：**
```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
```

### 阶段 3：页面布局

**响应式断点：**

| 名称 | 宽度 | 布局 |
|------|------|------|
| 移动端 | <640px | 单列、底部导航 |
| 平板 | 640-1024px | 可折叠侧边栏 |
| 桌面端 | >1024px | 完整侧边栏 |

### 阶段 4：组件规格

使用 shadcn/ui 组件：
- **基础**：Button, Badge, Card, Avatar
- **表单**：Input, Textarea, Select, Switch（配合 React Hook Form + Zod）
- **布局**：Dialog, Sheet, ScrollArea, Separator
- **导航**：DropdownMenu, Tabs, Tooltip
- **反馈**：Skeleton, Sonner (toast)

---

## 关键原则

### 功能独立（必需）

每个功能必须立即可用，无需先配置其他功能。

**三条规则：**

1. **无阻塞依赖**
   - ❌ 错误：必须配置 API 密钥才能测试聊天
   - ✅ 正确：聊天默认使用 Mock 响应

2. **默认 Mock，就绪后切换真实**
   - Store 应有 `useMockMode: boolean` 标志
   - 组件检查 Mock 模式并使用相应处理器

3. **Mock 模式的视觉反馈**
   - 显示微妙的指示器：`🎭 演示模式` 徽章

### 丰富 Mock 数据（必需）

Store 必须用 Mock 数据初始化，而非空数组。

**要求：**
- 核心实体 8-10 条不同的 Mock 项
- 覆盖边缘情况：长标题、已归档、旧日期
- 包含 Mock AI 响应生成器用于聊天应用
- 预配置 Mock 模型（无需 API 密钥）

**参考：** 完整示例见 `references/mock-data-examples.md`。

### 状态管理

使用 Zustand 配合 persist 中间件自动同步到 localStorage。

**关键模式：**
```typescript
export const useStore = create<State>()(
  persist(
    (set) => ({
      items: MOCK_DATA,  // 用 Mock 数据初始化！
      // ... 操作
    }),
    { name: 'storage-key' }
  )
)
```

**参考：** 完整模板见 `references/store-templates.md`。

---

## 输出规格

生成 `spec/design/ui.spec.md`，包含以下章节：

1. **智能分析** - 应用类型、导航、配色
2. **设计系统** - 令牌、字体
3. **页面布局** - 断点、结构
4. **组件规格** - shadcn/ui 使用
5. **状态管理** - Store 定义
6. **功能独立** - Mock 模式配置
7. **Mock 数据** - 数据结构、AI 响应生成器
8. **核心功能** - P0/P1 实现
9. **交互模式** - 加载、反馈、空状态
10. **无障碍性** - WCAG 检查清单
11. **扩展点** - 数据库/API 迁移路径
12. **验收检查清单** - 质量门禁

> **说明**：项目初始化由上述强制步骤处理，不包含在规格输出中。

**参考：** 详细模板见 `references/output-template.md`。

---

## 质量检查清单

### 前置条件
- [ ] 三个必需文档已加载
- [ ] 应用类型已判断并说明理由
- [ ] 导航结构已确定
- [ ] OKLCH 配色方案已定义

### 功能独立（关键）
- [ ] 每个功能无需配置即可使用
- [ ] 未配置依赖项时有 Mock/回退行为
- [ ] Mock 模式指示器可见

### 丰富 Mock 数据（关键）
- [ ] Store 用 Mock 数据初始化（非空数组）
- [ ] 核心实体有 8-10 条不同的 Mock 项
- [ ] 包含 Mock AI 响应生成器
- [ ] 预配置 Mock 模型

### 实现
- [ ] Zustand Store 使用 persist 中间件
- [ ] P0 功能配合本地存储完全可用
- [ ] 错误处理已定义
- [ ] 符合 WCAG AA

### 扩展点
- [ ] 数据库迁移路径已记录
- [ ] API 实现路径已记录

---

## 资源

### 脚本
- `scripts/init-project.sh` - 初始化 Next.js + shadcn/ui 项目

### 参考文档
- `references/mock-data-examples.md` - Mock 数据代码示例
- `references/store-templates.md` - Zustand Store 模板
- `references/output-template.md` - 输出文档模板

---

## 技能关系

| 技能 | 关系 |
|------|------|
| meta-42cog | 前置：提供核心文档 |
| dev-database-design | 后续：将本地模式转换为数据库 |
| dev-coding | 后续：基于预留实现 API |

---

**最后更新：** 2025-12-11
**文档版本：** v2
**维护者：** 42COG 团队