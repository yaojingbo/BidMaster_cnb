---
name: admin-business
description: "Use when generating or enhancing business-specific admin dashboards - automatically detects if admin exists, then either generates complete admin backend or adds BI reports module with decision dashboard, 4减4增 analytics, data-driven insights, and data backup capabilities following the Next.js + Shadcn-ui stack."
version: 3.3.0
depends:
  - .42cog/real/real.md
  - .42cog/cog/cog.md
generates:
  - .42cog/spec/admin-{business}.spec.md
  - src/admin/
  - src/admin/scripts/seed/
  - src/admin/app/reports/
reference: https://github.com/arhamkhnz/next-shadcn-admin-dashboard
---

# admin-business: 业务管理后台一键生成

> **核心原则**：通过自动探索项目代码和文档理解业务上下文，**v3.2 新增智能检测**：如已有管理后台则接入 BI 报表模块；如无则生成完整后台。报表基于 4减4增 框架支持数据驱动决策。

## 功能概览

**模式 A - 完整生成**（无管理后台时）：
- 完整的管理后台，包含 v3.1 所有功能

**模式 B - BI 报表增强**（已有管理后台时）：
- **[v3.2 新增]** 决策驾驶舱 (Decision Dashboard)
- **[v3.2 新增]** 4减4增分析框架
- **[v3.2 新增]** R1 付费转化漏斗报表
- **[v3.2 新增]** R2 客单价与收入分析
- **[v3.2 新增]** R3 复购率与流失分析
- **[v3.2 新增]** R4 推荐率追踪
- **[v3.2 新增]** C1-C4 成本监控

**核心功能**（所有版本）：
- 业务实体管理页面
- 完整 CRUD 操作与软删除
- 行级操作菜单
- 业务流程对齐的工作流
- 基于角色的访问控制

## 技术栈（AI友好 + 现代化）

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Next.js | 15+ | App Router, Server Actions |
| 语言 | TypeScript | 5.x | 严格类型 |
| 样式 | Tailwind CSS | 4.x | 原子化CSS |
| 组件 | Shadcn-ui | latest | 可定制、美观 |
| 表单 | React Hook Form + Zod | - | 类型安全验证 |
| 状态 | Zustand | - | 轻量级状态管理 |
| URL状态 | Nuqs | - | 搜索参数同步 |
| 数据库 | Neon + Drizzle ORM | - | Serverless PostgreSQL |
| 认证 | Neon Auth | - | 开箱即用 |
| 表格 | TanStack Table | v8 | 强大的数据表格 |
| 图表 | Recharts | - | 数据可视化 |
| 命令面板 | kbar | - | Command+K |
| 主题 | next-themes | - | 明暗模式 |

## RCSW+S 工作流程

### 阶段零：项目状态检测 [v3.2 新增]

**首先自动检测项目是否已有管理后台：**

```markdown
## 检测清单

1. **目录结构检查**
   - [ ] src/admin/ 是否存在？
   - [ ] src/app/admin/ 是否存在？
   - [ ] src/app/(admin)/ 是否存在？

2. **路由检查**
   - [ ] /admin 路由是否定义？
   - [ ] Admin layout.tsx 是否存在？
   - [ ] Admin page.tsx 是否存在？

3. **功能检查**
   - [ ] Dashboard 组件是否存在？
   - [ ] 用户管理是否存在？
   - [ ] 实体 CRUD 页面是否存在？

4. **数据库检查**
   - [ ] 管理后台专用表是否存在？（audit_logs, admin_users 等）
```

**检测输出：**

```toml
[detection]
admin_exists = {true|false}
admin_path = "{检测到的路径或 null}"
existing_features = ["{功能1}", "{功能2}"]
missing_features = ["{功能1}", "{功能2}"]
recommended_mode = "{full_generation|bi_enhancement}"
```

**模式选择：**

| 条件 | 模式 | 执行动作 |
|------|------|----------|
| 未找到管理后台 | 模式 A：完整生成 | 执行阶段 1-5（完整管理后台） |
| 已有管理后台，无报表 | 模式 B：BI 增强 | 仅执行阶段 6（添加报表） |
| 已有管理后台和报表 | 模式 C：报表升级 | 增强现有报表 |

---

```
┌─────────────────────────────────────────────────────────────────┐
│  Real（现实约束）                                                │
│  ↓ 读取 .42cog/real/real.md                                     │
│  ↓ 探索项目代码结构                                              │
│  ↓ 分析数据库 Schema                                            │
│  ↓ 识别现有 UI 规范                                              │
├─────────────────────────────────────────────────────────────────┤
│  Cog（认知建模）                                                 │
│  ↓ 读取 .42cog/cog/cog.md                                       │
│  ↓ 推断业务实体和关系                                            │
│  ↓ 识别核心工作流                                                │
│  ↓ 【有疑问则反问用户确认】                                       │
├─────────────────────────────────────────────────────────────────┤
│  Spec（规约生成）                                                │
│  ↓ 生成 admin-{business}.spec.md                                │
│  ↓ 用户确认规约                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Work（一键生成）                                                │
│  ↓ 生成完整可运行的管理后台代码                                    │
│  ↓ 自动安装依赖                                                  │
│  ↓ 启动开发服务器                                                │
├─────────────────────────────────────────────────────────────────┤
│  Seed（测试数据）[v3.0 新增]                                     │
│  → 为每个实体生成 100+ 条真实感测试数据                            │
│  → 数据关联关系正确、状态分布合理                                  │
│  → 支持验证和演示各种功能                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 阶段一：Reality - 现实约束探索

### 1.1 自动探索清单

执行以下探索任务（无需用户参与）：

```markdown
## 必须探索的文件

1. **项目约束文件**
   - .42cog/real/real.md     → 项目约束条件
   - .42cog/cog/cog.md       → 认知模型定义
   - CLAUDE.md               → AI 指令

2. **代码结构**
   - src/                    → 项目源码结构
   - src/db/schema/          → 数据库 Schema（识别业务实体）
   - src/app/                → 现有路由结构
   - src/components/         → UI 组件规范

3. **配置文件**
   - package.json            → 依赖和脚本
   - tailwind.config.*       → 样式配置
   - components.json         → Shadcn 配置
   - drizzle.config.*        → 数据库配置

4. **UI 规范（如存在）**
   - src/styles/             → 全局样式
   - src/components/ui/      → UI 组件库
   - 任何 design-system 相关文件
```

### 1.2 探索输出模板

```toml
# 探索结果摘要

[project]
name = "{从 package.json 获取}"
type = "{推断的业务类型}"
existing_admin = {true|false}

[database]
orm = "{drizzle|prisma|none}"
entities = ["{从 schema 识别的实体列表}"]

[ui]
component_library = "{shadcn|自定义|none}"
theme = "{现有主题配置}"
has_dark_mode = {true|false}

[constraints]
# 从 real.md 提取的约束
required = ["{C1}", "{C2}", ...]
optional = ["{C5}", "{C6}", ...]
```

### 1.3 反问确认点

只在以下情况反问用户：

| 场景 | 问题示例 |
|------|----------|
| 业务类型不明确 | "项目看起来像是 {A} 或 {B}，请确认？" |
| 实体关系模糊 | "{实体A} 和 {实体B} 的关系是一对多还是多对多？" |
| 缺少关键约束 | "管理后台是否需要独立登录？" |
| UI 规范冲突 | "发现两套 UI 规范，使用哪一套？" |

---

## 阶段二：Cognition - 认知建模

### 2.1 业务实体识别

从数据库 Schema 和代码自动识别：

```typescript
// 识别模式
interface EntityRecognition {
  // 从 db/schema/*.ts 识别
  fromSchema: {
    tableName: string;
    fields: Field[];
    relations: Relation[];
  }[];

  // 从 API routes 识别
  fromRoutes: {
    path: string;
    methods: string[];
    entity: string;
  }[];

  // 从类型定义识别
  fromTypes: {
    name: string;
    properties: Property[];
  }[];
}
```

### 2.2 管理页面推断规则

| 实体特征 | 生成页面 | 功能 |
|----------|----------|------|
| 有 CRUD 操作 | 列表 + 详情 + 表单 | 增删改查 |
| 有状态字段 | 列表含状态筛选 | 状态流转 |
| 有时间字段 | 列表含日期范围 | 时间筛选 |
| 有关联实体 | 详情含关联数据 | 关联展示 |
| 有统计需求 | 仪表盘卡片 | 数据概览 |
| 有审核流程 | 审核列表 | 审核操作 |

### 2.3 认知表达式输出

```toml
# admin-{business}.cog.toml

[admin]
business_type = "{识别的业务类型}"
domain = "admin.{project}.com"

[admin.entities]
# 按重要性排序
primary = [
  { name = "{实体1}", table = "{表名}", pages = ["list", "detail", "form"] },
  { name = "{实体2}", table = "{表名}", pages = ["list", "detail"] },
]
secondary = [
  { name = "{实体3}", table = "{表名}", pages = ["list"] },
]

[admin.dashboard]
# 仪表盘配置
stats = ["{统计项1}", "{统计项2}", "{统计项3}", "{统计项4}"]
charts = ["{图表1}", "{图表2}"]
recent = ["{最近数据1}", "{最近数据2}"]

[admin.workflows]
# 核心工作流
{workflow_name} = {
  entity = "{实体}",
  states = ["{状态1}", "{状态2}", "{状态3}"],
  actions = ["{操作1}", "{操作2}"]
}
```

---

## 阶段三：Specification - 规约生成

### 3.1 规约文档结构

生成 `.42cog/spec/admin-{business}.spec.md`：

```markdown
# {业务名称} 管理后台规约

## 1. 概述
- 业务类型：{type}
- 核心实体：{entities}
- 目标用户：管理员

## 2. 页面结构
/admin
├── /                    # 仪表盘
├── /login               # 登录页
├── /{entity1}           # 实体1管理
│   ├── /                # 列表页
│   ├── /new             # 新建页
│   └── /[id]            # 详情/编辑页
├── /{entity2}           # 实体2管理
├── /settings            # 系统设置
└── /audit-logs          # 审计日志

## 3. 实体详情
### 3.1 {实体1}
- 字段：{fields}
- 操作：{actions}
- 状态流转：{states}

## 4. 仪表盘设计
- 统计卡片：{stats}
- 图表：{charts}
- 快捷操作：{actions}

## 5. 约束检查（4+3 框架）
### 必选约束（4条）
- [x] A1: 独立入口 - admin.{domain}.com
- [x] A2: 独立登录 - 独立认证，不共享 Session
- [x] A3: 数据脱敏 - 手机138****5678，邮箱ab***@gmail.com
- [x] A4: 审计日志 - 操作者、时间、类型、变更内容

### 可选约束（3条）
- [ ] A5: UI主题 - 明暗模式切换
- [ ] A6: 左侧导航 - 可折叠侧边栏
- [ ] A7: 列表分页 - 默认20条/页
```

### 3.2 用户确认

输出规约后，请求用户确认：

```
已生成管理后台规约，包含：
- {N} 个核心实体的管理页面
- 仪表盘统计和图表
- 符合 4 条必选约束

确认后将一键生成完整代码。是否继续？
```

---

## 阶段四：Work - 一键生成

### 4.1 生成目录结构

```
src/admin/
├── app/
│   ├── layout.tsx                 # 管理后台布局
│   ├── page.tsx                   # 仪表盘
│   ├── login/
│   │   └── page.tsx               # 登录页
│   ├── {entity}/
│   │   ├── page.tsx               # 列表页（Server Component）
│   │   ├── new/
│   │   │   └── page.tsx           # 新建页
│   │   ├── [id]/
│   │   │   └── page.tsx           # 详情/编辑页
│   │   └── _components/
│   │       ├── columns.tsx        # 表格列定义
│   │       ├── data-table.tsx     # 数据表格
│   │       ├── form.tsx           # 表单组件
│   │       └── actions.ts         # Server Actions
│   ├── settings/
│   │   └── page.tsx
│   └── audit-logs/
│       └── page.tsx
├── components/
│   ├── layout/
│   │   ├── admin-layout.tsx       # 整体布局
│   │   ├── sidebar.tsx            # 侧边栏
│   │   ├── header.tsx             # 顶栏
│   │   ├── nav-main.tsx           # 主导航
│   │   ├── nav-user.tsx           # 用户菜单
│   │   └── theme-toggle.tsx       # 主题切换
│   ├── dashboard/
│   │   ├── stats-cards.tsx        # 统计卡片
│   │   ├── overview-chart.tsx     # 概览图表
│   │   └── recent-list.tsx        # 最近数据
│   └── shared/
│       ├── data-table/
│       │   ├── data-table.tsx     # 通用表格
│       │   ├── pagination.tsx     # 分页
│       │   ├── column-header.tsx  # 列头
│       │   └── toolbar.tsx        # 工具栏
│       ├── page-header.tsx        # 页面标题
│       ├── status-badge.tsx       # 状态徽章
│       ├── confirm-dialog.tsx     # 确认对话框
│       ├── empty-state.tsx        # 空状态
│       └── loading-skeleton.tsx   # 加载骨架
├── lib/
│   ├── auth.ts                    # 认证逻辑
│   ├── db.ts                      # 数据库连接
│   ├── mask.ts                    # 数据脱敏
│   ├── audit.ts                   # 审计日志
│   └── utils.ts                   # 工具函数
├── hooks/
│   ├── use-data-table.ts          # 表格Hook
│   └── use-confirm.ts             # 确认弹窗Hook
└── types/
    └── index.ts                   # 类型定义
```

### 4.2 UI 规范（参考 next-shadcn-admin-dashboard）

#### 布局规范

```tsx
// 整体布局：侧边栏 + 主内容区
<div className="flex h-screen bg-background">
  {/* 可折叠侧边栏 */}
  <Sidebar collapsible="icon" className="border-r">
    <SidebarHeader>
      <Logo />
    </SidebarHeader>
    <SidebarContent>
      <NavMain items={navItems} />
    </SidebarContent>
    <SidebarFooter>
      <NavUser user={user} />
    </SidebarFooter>
  </Sidebar>

  {/* 主内容区 */}
  <main className="flex-1 overflow-auto">
    <Header />
    <div className="p-6">
      {children}
    </div>
  </main>
</div>
```

#### 页面标题规范

```tsx
// 所有列表页顶部
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    <p className="text-muted-foreground">{description}</p>
  </div>
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    新建{entityName}
  </Button>
</div>
```

#### 统计卡片规范

```tsx
// 仪表盘统计卡片
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">
        <span className={trend > 0 ? "text-green-500" : "text-red-500"}>
          {trend > 0 ? "+" : ""}{trend}%
        </span>
        {" "}较上期
      </p>
    </CardContent>
  </Card>
</div>
```

#### 数据表格规范

```tsx
// TanStack Table + Shadcn UI
<div className="space-y-4">
  {/* 工具栏：搜索 + 筛选 + 操作 */}
  <div className="flex items-center gap-2">
    <Input placeholder="搜索..." className="max-w-sm" />
    <DataTableFacetedFilter column={column} title="状态" options={statusOptions} />
    <DataTableViewOptions table={table} />
  </div>

  {/* 表格 */}
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <TableHead key={header.id}>
                <DataTableColumnHeader column={header.column} title={header.column.columnDef.header} />
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>

  {/* 分页 */}
  <DataTablePagination table={table} />
</div>
```

#### 表单规范

```tsx
// React Hook Form + Zod + Shadcn Form
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>名称</FormLabel>
          <FormControl>
            <Input placeholder="请输入名称" {...field} />
          </FormControl>
          <FormDescription>这是公开显示的名称</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />

    <div className="flex gap-4">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        保存
      </Button>
      <Button type="button" variant="outline" onClick={() => router.back()}>
        取消
      </Button>
    </div>
  </form>
</Form>
```

#### 颜色规范

```css
/* 使用 Shadcn 默认主题变量 */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

### 4.3 核心代码模板

#### 列表页模板（Server Component）

```tsx
// src/admin/app/{entity}/page.tsx
import { Suspense } from "react";
import { PageHeader } from "@/admin/components/shared/page-header";
import { DataTable } from "./_components/data-table";
import { columns } from "./_components/columns";
import { get{Entity}List } from "./_components/actions";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
  }>;
}

export default async function {Entity}Page({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="{实体名称}管理"
        description="管理所有{实体名称}数据"
        createUrl="/admin/{entity}/new"
        createLabel="新建{实体名称}"
      />

      <Suspense fallback={<TableSkeleton />}>
        <{Entity}Table params={params} />
      </Suspense>
    </div>
  );
}

async function {Entity}Table({ params }: { params: Record<string, string | undefined> }) {
  const { data, total } = await get{Entity}List({
    page: Number(params.page) || 1,
    limit: Number(params.limit) || 20,
    search: params.search,
    status: params.status,
  });

  return <DataTable columns={columns} data={data} total={total} />;
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
```

#### Server Actions 模板

```tsx
// src/admin/app/{entity}/_components/actions.ts
"use server";

import { db } from "@/admin/lib/db";
import { {entity} } from "@/db/schema";
import { eq, like, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/admin/lib/audit";
import { getCurrentAdmin } from "@/admin/lib/auth";

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

export async function get{Entity}List({ page, limit, search, status }: ListParams) {
  const offset = (page - 1) * limit;

  let query = db.select().from({entity});

  // 条件筛选
  const conditions = [];
  if (search) {
    conditions.push(like({entity}.name, `%${search}%`));
  }
  if (status) {
    conditions.push(eq({entity}.status, status));
  }

  const [data, countResult] = await Promise.all([
    query
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc({entity}.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from({entity})
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  return {
    data,
    total: Number(countResult[0].count),
  };
}

export async function create{Entity}(formData: FormData) {
  const admin = await getCurrentAdmin();

  const data = {
    id: crypto.randomUUID(),
    name: formData.get("name") as string,
    // ... 其他字段
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert({entity}).values(data);

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "create",
    targetType: "{entity}",
    targetId: data.id,
  });

  revalidatePath("/admin/{entity}");
  return { success: true, id: data.id };
}

export async function update{Entity}(id: string, formData: FormData) {
  const admin = await getCurrentAdmin();

  const [old] = await db.select().from({entity}).where(eq({entity}.id, id));

  const data = {
    name: formData.get("name") as string,
    // ... 其他字段
    updatedAt: new Date(),
  };

  await db.update({entity}).set(data).where(eq({entity}.id, id));

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "update",
    targetType: "{entity}",
    targetId: id,
    changes: { name: { old: old.name, new: data.name } },
  });

  revalidatePath("/admin/{entity}");
  return { success: true };
}

export async function delete{Entity}(id: string) {
  const admin = await getCurrentAdmin();

  await db.delete({entity}).where(eq({entity}.id, id));

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "delete",
    targetType: "{entity}",
    targetId: id,
  });

  revalidatePath("/admin/{entity}");
  return { success: true };
}
```

### 4.4 一键生成命令

确认规约后执行：

```bash
# 1. 创建目录结构
mkdir -p src/admin/{app,components,lib,hooks,types}

# 2. 安装依赖（如尚未安装）
bun add @tanstack/react-table recharts date-fns kbar next-themes
bun add react-hook-form @hookform/resolvers zod zustand nuqs

# 3. 安装 Shadcn 组件
bunx shadcn@latest add button card input form table dialog \
  dropdown-menu select badge avatar separator \
  sheet tooltip popover command calendar \
  sidebar skeleton

# 4. 生成代码文件
# （AI 自动生成所有页面和组件代码）

# 5. 启动开发服务器
bun dev

# 6. 访问管理后台
# http://localhost:3000/admin
```

---

## 阶段五：Seed - 测试数据填充 [v3.0 新增]

> **目标**：为每个业务实体生成 100+ 条真实感测试数据，确保关联关系正确、状态分布合理，支持验证和演示各种功能。

### 5.1 数据生成原则

| 数据特性 | 要求 | 说明 |
|----------|------|------|
| **数量** | 每核心实体 ≥ 100 条 | 关联实体 20-50 条，日志记录 500+ 条 |
| **真实感** | 使用 Faker.js 中文 locale | 姓名、地址、手机号符合中国习惯 |
| **关联性** | 外键引用 100% 有效 | 不出现孤儿数据 |
| **状态分布** | 符合真实业务比例 | 如订单：已完成 60%，待发货 15%... |
| **时间分布** | 模拟业务增长曲线 | 早期少、近期多 |

### 5.2 状态分布规则

```typescript
// 各实体状态的真实分布比例
const statusDistribution = {
  // 博客文章
  post: { draft: 0.15, published: 0.80, archived: 0.05 },

  // 电商订单
  order: {
    pending_payment: 0.05, paid: 0.10, shipped: 0.15,
    delivered: 0.60, completed: 0.08, cancelled: 0.02
  },

  // 评论审核
  comment: { pending: 0.10, approved: 0.85, rejected: 0.05 },

  // SaaS 租户
  tenant: { trial: 0.20, active: 0.70, suspended: 0.05, churned: 0.05 },

  // 工单
  ticket: { open: 0.20, pending: 0.30, resolved: 0.40, closed: 0.10 },
};
```

### 5.3 数据生成命令

```bash
# 安装 Faker 依赖
bun add -d @faker-js/faker

# 生成博客测试数据（100条基准）
bun run scripts/seed-generator.ts blog --count=100

# 生成电商测试数据（200条基准）
bun run scripts/seed-generator.ts ecommerce --count=200

# 生成 SaaS 测试数据（150条基准）
bun run scripts/seed-generator.ts saas --count=150

# 输出 SQL 格式
bun run scripts/seed-generator.ts blog --format=sql --output=seed.sql

# 输出 JSON 格式（默认）
bun run scripts/seed-generator.ts blog --output=seed.json
```

### 5.4 各业务类型数据量

| 业务类型 | 核心实体 | 基准数量 | 关联数据 | 总记录数 |
|----------|----------|----------|----------|----------|
| **blog** | posts | 100 | categories(15), tags(50), comments(200), media(50) | ~415 |
| **ecommerce** | products, orders | 100/250 | categories(20), customers(50), coupons(30) | ~450 |
| **saas** | tenants | 100 | plans(4), users(300), subscriptions(80), tickets(150) | ~634 |

### 5.5 Seed 脚本集成

生成的代码结构中会自动包含 seed 脚本：

```
src/admin/scripts/seed/
├── index.ts              # 主入口
├── utils.ts              # 工具函数
├── blog.seed.ts          # 博客数据生成器
├── ecommerce.seed.ts     # 电商数据生成器
└── saas.seed.ts          # SaaS 数据生成器
```

### 5.6 数据验证清单

生成数据后，自动验证以下内容：

- [ ] 每个核心实体 ≥ 100 条数据
- [ ] 外键关联全部有效（无孤儿数据）
- [ ] 状态分布符合预期比例（±5%）
- [ ] 时间分布呈增长趋势
- [ ] 列表页加载性能正常（< 500ms）
- [ ] 分页、筛选、搜索功能正常
- [ ] 仪表盘统计数据正确

---

## 增强功能 [v3.0 新增]

除测试数据生成外，v3.0 还增加以下增强功能：

### 6.1 批量操作

| 功能 | 说明 | 实现 |
|------|------|------|
| 批量删除 | 选中多条后一键删除 | Checkbox + Bulk Action |
| 批量状态变更 | 如批量发布、批量审核 | Dropdown Action |
| 批量导出 | 导出选中数据为 CSV | csv-stringify |

```tsx
// 批量操作工具栏
<DataTableToolbar>
  {selectedRows.length > 0 && (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        已选中 {selectedRows.length} 项
      </span>
      <Button variant="outline" size="sm" onClick={handleBulkDelete}>
        <Trash className="mr-2 h-4 w-4" />
        删除
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            更多操作 <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleBulkStatus('published')}>
            批量发布
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleBulkExport}>
            导出 CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )}
</DataTableToolbar>
```

### 6.2 导入/导出

| 功能 | 格式 | 用途 |
|------|------|------|
| 导出 CSV | UTF-8 BOM | Excel 兼容 |
| 导出 Excel | xlsx | 完整格式保留 |
| 导入 CSV | 模板下载 + 验证 | 批量创建/更新 |

```tsx
// 导出功能
async function exportToCSV(data: any[], filename: string) {
  const BOM = '\uFEFF';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(v =>
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
    ).join(',')
  );
  const csv = BOM + headers + '\n' + rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
```

### 6.3 高级搜索

| 功能 | 说明 |
|------|------|
| 多字段搜索 | 同时搜索标题、内容、标签 |
| 筛选组合 | 状态 + 分类 + 时间范围 |
| 搜索保存 | 保存常用搜索条件 |
| 搜索历史 | 最近 10 条搜索记录 |

```tsx
// 高级筛选面板
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline" size="sm">
      <Filter className="mr-2 h-4 w-4" />
      高级筛选
    </Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>高级筛选</SheetTitle>
    </SheetHeader>
    <div className="space-y-4 py-4">
      <div>
        <Label>状态</Label>
        <MultiSelect options={statusOptions} value={filters.status} onChange={...} />
      </div>
      <div>
        <Label>分类</Label>
        <Select options={categoryOptions} value={filters.category} onChange={...} />
      </div>
      <div>
        <Label>创建时间</Label>
        <DateRangePicker value={filters.dateRange} onChange={...} />
      </div>
    </div>
    <SheetFooter>
      <Button variant="outline" onClick={resetFilters}>重置</Button>
      <Button onClick={applyFilters}>应用筛选</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### 6.4 快捷键支持

已集成 kbar 命令面板，支持以下快捷键：

| 快捷键 | 功能 |
|--------|------|
| `⌘ + K` | 打开命令面板 |
| `⌘ + /` | 显示快捷键帮助 |
| `⌘ + N` | 新建记录 |
| `⌘ + S` | 保存 |
| `⌘ + F` | 搜索 |
| `⌘ + E` | 导出 |

### 6.5 实时通知

```tsx
// 操作结果通知
import { toast } from 'sonner';

// 成功通知
toast.success('保存成功', {
  description: '数据已更新',
  action: { label: '撤销', onClick: handleUndo },
});

// 错误通知
toast.error('操作失败', {
  description: error.message,
});

// 加载通知
const toastId = toast.loading('正在保存...');
// 完成后
toast.success('保存成功', { id: toastId });
```

---

## 约束检查清单（4+3 框架）

生成的管理后台必须满足以下约束。

> **4+3约束结构**：对应工作记忆容量（4±1项）。普通个人应用4+3约束够了，复杂应用可以分层——项目层级约束、子系统层级约束、模块层级约束。

### 必选约束（4条，不可妥协）

| 约束 | 现实约束 | 理由 | 实现方式 |
|------|----------|------|----------|
| **A1: 独立入口** | 管理后台使用独立子域名（admin.xxx.com） | 安全隔离、权限清晰、部署独立 | Next.js route group |
| **A2: 独立登录** | 不共享前端登录Session，需要管理员专用凭证 | 权限分离，防止普通用户误入后台 | 独立认证逻辑 |
| **A3: 数据脱敏** | 敏感信息（邮箱/手机/地址）部分打码显示 | 保护用户隐私、合规要求（GDPR、个人信息保护法） | mask.ts 工具函数 |
| **A4: 审计日志** | 记录所有管理员操作（操作者、时间、类型、变更内容） | 合规追溯、问题排查、防止误操作 | audit.ts 服务 |

**数据脱敏格式规范**：
- 手机号显示为：`138****5678`
- 邮箱显示为：`ab***@gmail.com`

**参考案例**：
- 企业微信：admin.work.weixin.qq.com
- 阿里云：account.aliyun.com

### 可选约束（3条，推荐实现）

| 约束 | 现实约束 | 理由 | 实现方式 |
|------|----------|------|----------|
| **A5: UI主题** | 支持白天/黑夜模式切换 | 用户习惯、长时间使用护眼 | next-themes |
| **A6: 左侧导航** | 导航栏位于左侧 | 管理后台的用户习惯 | 可折叠 Sidebar |
| **A7: 列表分页** | 列表默认分页，每页20条 | 性能优化、大数据量场景 | 服务端分页 |

### UI 检查清单

| 项目 | 要求 |
|------|------|
| 响应式 | 支持桌面端（>1024px） |
| 主题 | 支持明/暗模式切换（A5） |
| 导航 | 左侧可折叠导航栏（A6） |
| 分页 | 默认20条/页（A7） |
| 加载状态 | 骨架屏 + Spinner |
| 空状态 | 友好的空数据提示 |
| 错误处理 | Toast 提示 + 错误边界 |

---

## 执行示例

```
用户：/admin-business

AI：开始探索项目...

[探索] 读取 .42cog/real/real.md ✓
[探索] 读取 .42cog/cog/cog.md ✓
[探索] 分析 src/db/schema/ ✓
  → 发现实体：user, post, category, comment
[探索] 检查 UI 规范 ✓
  → 使用 Shadcn-ui，已配置 Tailwind

[认知] 业务类型：个人博客
[认知] 核心实体：
  - post（文章）：列表、详情、表单
  - category（分类）：列表、表单
  - comment（评论）：列表、审核
[认知] 仪表盘指标：文章数、访问量、评论数、最近文章

确认以上分析？[Y/n]

用户：Y

AI：生成规约文档... ✓
AI：生成管理后台代码...
  [1/8] 创建目录结构 ✓
  [2/8] 生成布局组件 ✓
  [3/8] 生成仪表盘页面 ✓
  [4/8] 生成文章管理页面 ✓
  [5/8] 生成分类管理页面 ✓
  [6/8] 生成评论管理页面 ✓
  [7/8] 生成设置和审计日志页面 ✓
  [8/8] 安装依赖并启动 ✓

AI：生成测试数据... [v3.0 新增]
  [Seed] 生成 categories: 15 条 ✓
  [Seed] 生成 tags: 50 条 ✓
  [Seed] 生成 posts: 150 条 ✓
  [Seed] 生成 comments: 300 条 ✓
  [Seed] 生成 media: 100 条 ✓
  [Seed] 总计: 615 条测试数据 ✓
  [Seed] 数据验证通过 ✓

管理后台已生成！访问 http://localhost:3000/admin

功能清单：
- 仪表盘：统计卡片、趋势图表、最近文章
- 文章管理：列表、新建、编辑、删除、批量操作
- 分类管理：列表、新建、编辑
- 评论管理：列表、审核、批量审核
- 高级搜索：多条件筛选、日期范围
- 数据导出：CSV、Excel 格式
- 快捷键：Command+K 命令面板
```

---

## 阶段六：BI 报表模块 [v3.2 新增]

> **目标**：为现有管理后台添加全面的 BI 报表能力，基于 4减4增 框架实现数据驱动决策。

### 6.1 何时使用本阶段

执行阶段六的场景：
- 管理后台已存在（阶段零检测为模式 B）
- 用户请求"添加报表"、"添加分析"、"添加 BI 仪表盘"
- 现有管理后台缺乏数据可视化能力

### 6.2 决策驾驶舱

核心理念：**管理后台是你的决策驾驶舱，而非功能集合。**

```
数据 → 洞察 → 决策 → 行动
```

**目录结构：**

```
src/admin/app/reports/
├── page.tsx                    # 决策驾驶舱主页
├── conversion/page.tsx         # R1: 付费转化报表
├── revenue/page.tsx            # R2: 收入分析
├── retention/page.tsx          # R3: 留存分析
├── referral/page.tsx           # R4: 推荐追踪
├── costs/page.tsx              # C1-C4: 成本监控
└── _components/
    ├── stats-overview.tsx      # 今日/本月概览卡片
    ├── conversion-funnel.tsx   # 用户转化漏斗
    ├── revenue-chart.tsx       # 收入趋势图表
    ├── churn-analysis.tsx      # 流失率分析
    ├── referral-metrics.tsx    # NPS 和推荐统计
    └── cost-breakdown.tsx      # API 成本、利润率
```

### 6.3 报表类型（基于 4减4增 框架）

#### 今日核心数据

| 指标 | 说明 | 计算公式 |
|------|------|----------|
| 新增用户 | 今日注册用户 | `COUNT(users WHERE createdAt = today)` |
| 活跃用户 | 今日活跃用户 | `COUNT(DISTINCT sessions WHERE date = today)` |
| 付费转化率 | 免费转付费 | `paying_users / total_users * 100` |
| 今日收入 | 当日营收 | `SUM(payments WHERE date = today)` |

#### 本月核心数据

| 指标 | 说明 | 计算公式 |
|------|------|----------|
| MRR | 月度经常性收入 | `SUM(active_subscriptions.price)` |
| 用户总数 | 所有注册用户 | `COUNT(users)` |
| 付费用户数 | 活跃订阅者 | `COUNT(subscriptions WHERE status = 'active')` |
| 流失用户数 | 取消的用户 | `COUNT(subscriptions WHERE cancelled_at = this_month)` |

#### 成本监控

| 指标 | 说明 | 计算公式 |
|------|------|----------|
| API 调用次数 | API 请求总数 | `COUNT(api_logs)` |
| API 成本 | API 使用成本 | `SUM(api_logs.cost)` |
| 毛利率 | 收入减成本 | `(revenue - costs) / revenue * 100` |

### 6.4 R1：付费转化漏斗报表（增付费转化）

```tsx
// 转化漏斗可视化
interface FunnelStep {
  name: string;
  value: number;
  rate: number;
}

const conversionFunnel: FunnelStep[] = [
  { name: '访客', value: 10000, rate: 100 },
  { name: '注册', value: 2500, rate: 25 },
  { name: '激活', value: 1500, rate: 60 },
  { name: '付费', value: 375, rate: 25 },
];

// 支持的决策：
// - "转化率下降37% - 检查定价页"
// - "78%用户卡在 Onboarding 第2步 - 优化体验"
```

**报表组件：**
- 漏斗可视化图表
- 转化率趋势（日/周/月）
- Onboarding 完成率
- A/B 测试结果追踪

### 6.5 R2：收入分析（增客单价）

```tsx
// 订阅分布分析
interface PlanDistribution {
  plan: string;
  users: number;
  percentage: number;
  revenue: number;
}

const planDistribution: PlanDistribution[] = [
  { plan: '基础版', users: 92, percentage: 90, revenue: 828 },
  { plan: '专业版', users: 5, percentage: 5, revenue: 145 },
  { plan: '团队版', users: 5, percentage: 5, revenue: 495 },
];

// 关键指标：
// - ARPU（用户平均收入）: total_revenue / total_users
// - 价格点效果分析
// - 升级机会识别
```

**报表组件：**
- 方案分布饼图
- ARPU 趋势线
- 定价层级对比
- 升级/降级流动图

### 6.6 R3：留存分析（增复购率）

```tsx
// 流失分析
interface ChurnData {
  month: string;
  churnRate: number;
  renewalRate: number;
  lostMRR: number;
}

// 关键警报：
// - "本月流失率15%（上月10%）"
// - "80%流失用户在到期前3天未登录"
// - "每周登录<2次的用户流失风险高5倍"
```

**报表组件：**
- 留存热力图（Cohort）
- 流失率趋势
- 高风险用户列表（到期前7天、低活跃）
- LTV（用户生命周期价值）分析
- 续费提醒效果

### 6.7 R4：推荐追踪（增推荐率）

```tsx
// 推荐指标
interface ReferralMetrics {
  nps: number;              // 净推荐值 (-100 到 +100)
  referralRate: number;     // 推荐过的用户比例
  kFactor: number;          // 病毒系数
  referralConversion: number; // 推荐用户转化率
}

// 关键洞察：
// - "NPS: 45（30%满意用户未推荐 - 优化入口）"
// - "推荐用户 LTV 高2倍"
```

**报表组件：**
- NPS 仪表盘
- 推荐漏斗
- 推荐达人排行榜
- 推荐渠道效果

### 6.8 C1-C4：成本监控（降本四策）

```tsx
// 成本分解
interface CostMetrics {
  apiCalls: number;
  apiCost: number;
  infrastructureCost: number;
  grossMargin: number;
  burnRate: number;
}

// 支持的决策：
// - "API 成本上涨20% - 优化缓存"
// - "毛利率91.8% - 健康"
```

**报表组件：**
- API 使用趋势
- 按服务分解成本
- 毛利率趋势
- 单用户成本（CAC趋势）

### 6.9 一周决策日历

报表使用的实践模式：

| 日期 | 重点 | 关键报表 | 决策 |
|------|------|----------|------|
| **周一** | 周计划 | Dashboard 概览 | 确定优先级 |
| **周三** | 用户分析 | 转化、留存 | 优化 Onboarding |
| **周五** | 周复盘 | 收入、导出周报 | 规划下周 |
| **周日** | 事件复盘 | 审计日志 | 快速定位问题 |

### 6.10 快速启动（模式 B）

```bash
# 当管理后台已存在时，仅添加报表模块：

# 1. 安装图表依赖
bun add recharts date-fns

# 2. 添加所需 Shadcn 组件
bunx shadcn@latest add tabs chart

# 3. 生成报表模块
# AI 将创建 src/admin/app/reports/ 结构

# 4. 添加导航入口
# 更新侧边栏添加"数据报表"菜单项

# 5. 启动开发
bun dev

# 访问报表：http://localhost:3000/admin/reports
```

### 6.11 报表数据库 Schema

```typescript
// BI 报表所需的额外表
export const dailyMetrics = sqliteTable("daily_metrics", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),              // YYYY-MM-DD
  newUsers: integer("new_users").default(0),
  activeUsers: integer("active_users").default(0),
  payingUsers: integer("paying_users").default(0),
  revenue: integer("revenue").default(0),     // 单位：分
  apiCalls: integer("api_calls").default(0),
  apiCost: integer("api_cost").default(0),   // 单位：分
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userEvents = sqliteTable("user_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),   // signup, activate, subscribe, churn, refer
  metadata: text("metadata"),                 // JSON 额外数据
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// 聚合定时任务：events → daily_metrics
```

### 6.12 报表验证清单

生成报表后验证：

- [ ] Dashboard 加载时间 < 500ms
- [ ] 所有指标卡片数值正确
- [ ] 趋势指示器（↑/↓）计算正确
- [ ] 日期范围选择器正常（今日、7天、30天、自定义）
- [ ] 图表渲染正确并有图例
- [ ] 导出功能生成有效 CSV
- [ ] 移动端响应式（可选）

---

## 与其他技能的关系

| 技能 | 关系 |
|------|------|
| admin-scaffold | 本技能替代，提供更完整的业务定制能力 |
| admin-better-auth | 可选扩展：更复杂的认证需求 |
| admin-data-reports | v3.2 已内置核心报表；此技能用于更高级的报表定制 |

---

## 能力框架参考

详见 `references/enhancement-patterns.md`，包含：

```
Layer 0: 实体管理能力 [v3.1 新增]
├── CRUD Operations（增删改查）✅ 已实现
├── Soft Delete（软删除）✅ 已实现
└── Action Menu（操作菜单）✅ 已实现

Layer 1: 数据层能力
├── Seed（测试数据填充）✅ 已实现
├── Import/Export（导入导出）✅ 已实现
└── Validation（数据验证）✅ 已实现

Layer 2: 操作层能力
├── Bulk Operations（批量操作）✅ 已实现
├── Advanced Search（高级搜索）✅ 已实现
└── Workflow Actions（工作流操作）✅ 已实现

Layer 3: 交互层能力
├── Keyboard Shortcuts（快捷键）✅ 已实现
├── Real-time Notifications（实时通知）✅ 已实现
└── Command Palette（命令面板）✅ 已实现

Layer 4: BI 报表能力 [v3.2 新增]
├── Decision Dashboard（决策驾驶舱）✅ 已实现
├── Conversion Funnel（R1 转化漏斗）✅ 已实现
├── Revenue Analytics（R2 收入分析）✅ 已实现
├── Retention Analysis（R3 留存分析）✅ 已实现
├── Referral Tracking（R4 推荐追踪）✅ 已实现
└── Cost Monitoring（C1-C4 成本监控）✅ 已实现

Layer 5: 数据备份能力 [v3.3 新增]
├── Manual Backup（一键备份）✅ 已实现
├── Backup Management（备份管理）✅ 已实现
├── Download Backup（下载备份）✅ 已实现
├── Restore Backup（数据恢复）✅ 已实现
└── Pre-Restore Safety（恢复安全网）✅ 已实现

Layer 6: 质量保障能力
├── E2E Test Generation（测试生成）📋 规划中
├── Performance Benchmark（性能基准）📋 规划中
└── Accessibility Check（可访问性检查）📋 规划中
```

详见 `references/backup-patterns.md`，了解数据备份的完整实现模式。

### 能力启用矩阵

| 能力 | MVP | 标准版 | 企业版 |
|------|:---:|:------:|:------:|
| CRUD Operations | ✅ | ✅ | ✅ |
| Soft Delete | ✅ | ✅ | ✅ |
| Action Menu | ✅ | ✅ | ✅ |
| Seed 测试数据 | ✅ | ✅ | ✅ |
| Import/Export | - | ✅ | ✅ |
| Bulk Operations | - | ✅ | ✅ |
| Advanced Search | - | ✅ | ✅ |
| Keyboard Shortcuts | - | ✅ | ✅ |
| **BI Reports** [v3.2] | - | ✅ | ✅ |
| **Data Backup** [v3.3] | - | ✅ | ✅ |
| Command Palette | - | - | ✅ |
| E2E Tests | - | - | ✅ |
| Performance | - | - | ✅ |
| Accessibility | - | - | ✅ |
