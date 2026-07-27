# Neon + Drizzle 数据库配置教程

## 配置流程概览

**不使用 Neon Auth 时：**
```
0. 安装 Neon Plugin → 获取 MCP 工具能力
1. 创建 Neon 项目 → 获取数据库连接
2. 创建开发分支 → 隔离开发环境
3. 安装依赖 → drizzle-orm + @neondatabase/serverless
4. 配置连接 → .env + drizzle.config.ts + src/db/index.ts
5. 定义/检查 Schema → src/db/schema.ts
6. 推送 Schema → bun run db:push
```

**使用 Neon Auth (Better Auth) 时：**
```
0. 安装 Neon Plugin → 获取 MCP 工具能力
1. 创建 Neon 项目 → 获取数据库连接
2. 在主分支启用 Neon Auth → 自动创建 neon_auth schema
3. 创建开发分支 → 隔离开发环境（会继承 neon_auth schema）
4. 安装依赖 → drizzle-orm + @neondatabase/serverless + @neondatabase/neon-js
5. 配置连接 → .env + drizzle.config.ts + src/db/index.ts
6. 设置 API Route Handler → app/api/auth/[...path]/route.ts（Next.js App Router）
7. 定义/检查 Schema → src/db/schema.ts（在业务表中引用 neon_auth.user）
8. 推送 Schema → bun run db:push（仅推送 public schema，neon_auth 由系统管理）
```

---

## 第零步：安装 Neon Claude Code Plugin

> 首次使用前需要安装，已安装可跳过

在 Claude Code 中执行以下命令：

### 1. 添加 Neon 市场

```bash
/plugin marketplace add neondatabase-labs/ai-rules
```

### 2. 安装插件

```bash
/plugin install neon-plugin@neon
```

### 3. 验证安装

询问 Claude Code：
```
which skills do you have access to?
```

应该看到以下四项 Neon 技能：
- `neon-drizzle` - 设置 Drizzle ORM
- `neon-serverless` - 配置无服务器驱动
- `neon-toolkit` - 使用管理 API
- `add-neon-knowledge` - 访问文档片段

安装成功后，就可以使用 Neon MCP 工具了！

---

## 第一步：创建 Neon 数据库项目

### 使用 Neon MCP 工具

```
请 Claude 执行：
mcp__plugin_neon-plugin_neon__create_project
参数：{ "name": "你的项目名" }
```

**返回信息解读：**
```
project_id: soft-silence-77820819     ← 项目唯一标识
branch name: main                      ← 默认主分支
database: neondb                       ← 默认数据库名
Connection URI: postgresql://...       ← 连接字符串（重要！）
```

### 为什么要记住 project_id？

后续所有操作（创建分支、执行 SQL、获取连接）都需要 project_id。

---

## 第二步：创建开发分支

### 什么是数据库分支？

类似 Git 分支，可以：
- 在开发分支上随意测试，不影响主分支数据
- 多人开发时各自有独立的数据环境
- 出问题可以直接删除分支重来

### 分支命名规范

为了团队协作和环境管理，建议遵循以下命名规范：

| 分支类型 | 命名格式 | 示例 |
|---------|---------|------|
| 主分支 | `main` | `main` |
| 开发分支 | `dev` 或 `dev/{feature}` | `dev`, `dev/auth` |
| 功能分支 | `feat/{feature-name}` | `feat/user-profile` |
| 测试分支 | `test` 或 `staging` | `staging` |
| 个人分支 | `dev/{name}` | `dev/myname` |

### 创建分支命令

```
mcp__plugin_neon-plugin_neon__create_branch
参数：{
  "projectId": "你的项目ID",
  "branchName": "dev"
}
```

### 获取分支连接字符串

```
mcp__plugin_neon-plugin_neon__get_connection_string
参数：{
  "projectId": "你的项目ID",
  "branchId": "分支ID"
}
```

⚠️ **注意**：不同分支的连接字符串不同！切换分支后要更新 `.env`

---

## 第三步：安装依赖

### 运行时依赖

```bash
bun add drizzle-orm @neondatabase/serverless ws
```

| 包名 | 用途 |
|------|------|
| `drizzle-orm` | ORM 核心，提供类型安全的查询构建 |
| `@neondatabase/serverless` | Neon 的 Serverless 驱动，支持 Edge 运行时 |
| `ws` | WebSocket 库，Node.js < v22 需要（用于持久连接） |

### 开发依赖

```bash
bun add -D drizzle-kit dotenv @types/ws
```

| 包名 | 用途 |
|------|------|
| `drizzle-kit` | CLI 工具，生成迁移、推送 Schema |
| `dotenv` | 加载 .env 文件中的环境变量 |
| `@types/ws` | ws 库的 TypeScript 类型定义 |

---

## 第四步：配置数据库连接

### 4.1 创建 .env 文件

```bash
# Neon Database Configuration
# Project: 你的项目名
# Branch: dev (development)

DATABASE_URL="postgresql://用户:密码@主机/数据库?sslmode=require&channel_binding=require"

# Neon Project Info（可选，方便后续操作）
NEON_PROJECT_ID="你的项目ID"
NEON_BRANCH_ID="你的分支ID"
NEON_BRANCH_NAME="dev"
```

⚠️ **安全提醒**：`.env` 必须加入 `.gitignore`，永远不要提交到代码仓库！

### 4.2 创建 drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// 显式加载 .env 文件（关键！）
config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',      // Schema 文件位置
  out: './src/db/migrations',         // 迁移文件输出目录
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**常见错误**：`url: undefined` → 没有正确加载环境变量，检查 `config({ path: '...' })` 路径是否正确。

### 4.3 创建数据库连接文件

Neon 提供两种连接方式，根据应用类型选择：

#### 方式一：HTTP 适配器（推荐用于 Serverless/Edge）

适用于 Next.js、Vercel Edge Functions、AWS Lambda 等短生命周期环境。

`src/db/index.ts`：

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

// 创建 Neon HTTP 客户端
const sql = neon(process.env.DATABASE_URL!);

// 导出 Drizzle 实例
export const db = drizzle(sql);
```

#### 方式二：WebSocket 适配器（用于长运行服务）

适用于传统 Node.js 服务器、需要事务支持的场景。

`src/db/index.ts`：

```typescript
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Node.js < v22 需要配置 WebSocket 构造函数
neonConfig.webSocketConstructor = ws;

// 创建连接池
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// 导出 Drizzle 实例
export const db = drizzle(pool);
```

**如何选择？**

| 特性 | HTTP 适配器 | WebSocket 适配器 |
|------|------------|-----------------|
| 适用环境 | Serverless/Edge | 传统 Node.js 服务器 |
| 连接方式 | 每次查询新连接 | 持久连接池 |
| 事务支持 | 单语句事务 | 完整事务支持 |
| 冷启动延迟 | 更低 | 略高 |
| 推荐场景 | Next.js、Vercel | Express、Fastify |

---

## 第五步：Schema 定义

### 场景 A：已有 Schema 文件

如果项目已有 `src/db/schema.ts`，直接使用即可。

### 场景 B：新建 Schema 文件

`src/db/schema.ts` 示例：

```typescript
import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core';

// 用户表
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 会话表
export const sessions = pgTable('sessions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

// 导出类型（用于 TypeScript 类型安全）
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
```

### Schema 字段类型速查

| Drizzle 类型 | PostgreSQL 类型 | 用途 |
|-------------|-----------------|------|
| `integer().generatedAlwaysAsIdentity()` | INTEGER GENERATED ALWAYS AS IDENTITY | 自增整数主键（推荐） |
| `serial` | SERIAL | 自增整数（旧语法，仍可用） |
| `uuid` | UUID | UUID 主键 |
| `varchar` | VARCHAR | 变长字符串 |
| `text` | TEXT | 长文本 |
| `boolean` | BOOLEAN | 布尔值 |
| `timestamp` | TIMESTAMP | 时间戳 |
| `integer` | INTEGER | 整数 |
| `jsonb` | JSONB | JSON 数据 |

### 主键策略选择

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `integer().generatedAlwaysAsIdentity()` | 存储小、索引快、排序有序 | 可预测、易枚举 | 内部表、不暴露给用户的 ID |
| `uuid` | 不可预测、全局唯一 | 存储大、索引慢、无序 | 对外 API、需要安全性的场景 |

> ⚠️ **安全提示**：自增 ID 容易被猜测和枚举（如 `/api/users/1`, `/api/users/2`）。对于暴露给用户的资源 ID，建议使用 UUID。但请注意，UUID 本身不是权限控制手段，仍需在业务逻辑中验证访问权限。

---

## 第六步：添加数据库脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 脚本说明

| 命令 | 用途 | 使用场景 |
|------|------|----------|
| `db:generate` | 根据 Schema 变化生成迁移 SQL | 生产环境需要迁移记录 |
| `db:migrate` | 执行迁移 SQL | 应用迁移到数据库 |
| `db:push` | 直接推送 Schema 到数据库 | 开发环境快速同步 |
| `db:studio` | 打开可视化数据库管理界面 | 查看/编辑数据 |

---

## 第七步：推送 Schema 到数据库

### 开发环境（推荐）

```bash
bun run db:push
```

直接将 Schema 同步到数据库，简单快速。

### 生产环境

```bash
bun run db:generate  # 生成迁移文件
bun run db:migrate   # 执行迁移
```

生成的迁移文件在 `src/db/migrations/` 目录，可以追溯每次变更。

---

## 验证配置

### 方法 1：使用 MCP 工具测试

```
mcp__plugin_neon-plugin_neon__run_sql
参数：{
  "projectId": "你的项目ID",
  "branchId": "你的分支ID",
  "sql": "SELECT version();"
}
```

应返回 PostgreSQL 版本信息。

### 方法 2：使用 Drizzle Studio

```bash
bun run db:studio
```

打开浏览器访问 https://local.drizzle.studio 查看数据库。

---

## Neon Auth 配置 (Better Auth)

Neon Auth 是 Neon 提供的托管认证服务，基于 [Better Auth](https://www.better-auth.com/) 框架。所有认证数据（用户、会话、OAuth 配置）直接存储在 Neon 数据库的 `neon_auth` schema 中，由系统自动管理。

### 步骤 1：安装 Neon Auth SDK

```bash
npm install @neondatabase/neon-js
```

或使用 bun：

```bash
bun add @neondatabase/neon-js
```

### 步骤 2：在 Neon Console 启用 Neon Auth

⚠️ **关键顺序**：必须先在**主分支（main）**启用 Neon Auth，然后再创建开发分支（或重置已有分支）。

**操作步骤：**
1. 进入 Neon Console → 选择项目 → 左侧栏 **Auth**
2. 点击 **Enable Neon Auth**
3. 配置 OAuth 提供商（Google、GitHub 等，可选）
4. 点击 **Configuration** 选项卡，复制 **Auth Base URL**

**或使用 MCP 工具：**

```
mcp__plugin_neon-plugin_neon__provision_neon_auth
参数：{ "projectId": "你的项目ID" }
```

### 步骤 3：配置环境变量

在 `.env` 或 `.env.local` 中添加：

```bash
# Neon Auth URL（从 Console → Auth → Configuration 复制）
# 根据框架不同，命名方式可能不同：
# - Vite: VITE_NEON_AUTH_URL
# - Next.js 客户端: NEXT_PUBLIC_NEON_AUTH_URL
# - 服务端: NEON_AUTH_URL
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.us-east-1.aws.neon.tech/neondb/auth

# 数据库连接
DATABASE_URL="postgresql://用户:密码@主机/数据库?sslmode=require&channel_binding=require"
```

### 步骤 4：设置 API Route Handler（Next.js App Router 必须）

Neon Auth 通过 REST API 与你的应用通信，需要在 Next.js 中创建 API route handler。

**创建 `app/api/auth/[...path]/route.ts`：**

```typescript
import { authApiHandler } from "@neondatabase/neon-js/auth/next";

export const { GET, POST } = authApiHandler();
```

这个 handler 会自动处理所有认证相关的 API 请求（登录、登出、注册等）。

### 步骤 4.5：创建 Auth Client（客户端 SDK）

**⚠️ 重要**：这是官方推荐的客户端 SDK 初始化方式。

**创建 `src/auth.ts`（或 `lib/auth.ts`）：**

```typescript
import { createAuthClient } from "@neondatabase/neon-js/auth";

// 使用环境变量初始化 Auth Client
export const authClient = createAuthClient(
  process.env.NEXT_PUBLIC_NEON_AUTH_URL!
);
```

**在客户端组件中使用：**

```typescript
"use client";

import { authClient } from "@/auth";

// 登录
const handleSignIn = async (email: string, password: string) => {
  const { data, error } = await authClient.signIn.email({
    email,
    password,
  });
  if (error) {
    console.error("Sign in failed:", error);
    return;
  }
  console.log("Signed in:", data.user);
};

// 注册
const handleSignUp = async (email: string, password: string, name: string) => {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
  });
  if (error) {
    console.error("Sign up failed:", error);
    return;
  }
  console.log("Signed up:", data.user);
};

// OAuth 登录（如 Google）
const handleGoogleSignIn = async () => {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
};
```

### 步骤 5（可选）：设置中间件保护路由

如果需要在路由级别保护某些页面，可以使用 middleware：

**创建 `middleware.ts`：**

```typescript
import { neonAuthMiddleware } from "@neondatabase/neon-js/auth/next";

export default neonAuthMiddleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: ["/account/:path*", "/dashboard/:path*"],
};
```

这会自动重定向未认证用户到登录页。

### 步骤 6（可选）：使用官方 UI 组件快速构建

官方提供了可视化 UI 组件，可以快速构建登录页和账户管理页。

**在 `app/layout.tsx` 中包装应用：**

```typescript
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react/ui";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <NeonAuthUIProvider>
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
```

**创建登录页 `app/auth/sign-in/page.tsx`：**

```typescript
import { AuthView } from "@neondatabase/neon-js/auth/react/ui";

export default function SignInPage() {
  return <AuthView pathname="sign-in" />;
}
```

**创建账户管理页 `app/account/page.tsx`：**

```typescript
import { AccountView } from "@neondatabase/neon-js/auth/react/ui";

export default function AccountPage() {
  return <AccountView />;
}
```

### 步骤 7：Drizzle 中关联 neon_auth.user

⚠️ **重要**：`neon_auth` schema 是系统托管的，**不要用 drizzle-kit 去迁移**。你只需在业务表中声明对 `neon_auth.user` 的引用即可。

**声明 neon_auth.user 引用（新建 `db/neon-auth.schema.ts`）：**

```typescript
import { pgSchema, text, timestamp, boolean } from "drizzle-orm/pg-core";

// 声明 neon_auth schema
const neonAuth = pgSchema("neon_auth");

// 声明 neon_auth.user 表（仅用于外键引用，不导出为迁移表）
// 只声明需要用到的列，完整列表见官方文档
export const neonAuthUser = neonAuth.table("user", {
  id: text("id").primaryKey(),           // UUID 格式的字符串
  email: text("email"),
  emailVerified: boolean("email_verified"),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```

**在业务表中引用用户：**

```typescript
// db/schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { neonAuthUser } from "./neon-auth.schema";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => neonAuthUser.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**推送 Schema：**

```bash
bun run db:push
```

Drizzle 会自动检测 `neon_auth` schema 不需要迁移，只推送 `public` schema 中的表。

### 分支未继承 neon_auth 的处理

如果开发分支创建于 Neon Auth 配置之前，需要重置以继承 `neon_auth` schema：

```
mcp__plugin_neon-plugin_neon__reset_from_parent
参数：{
  "projectId": "你的项目ID",
  "branchIdOrName": "开发分支ID",
  "preserveUnderName": "backup-分支名"  // 可选，保留旧数据
}
```

### 常见错误处理

**错误：`relation "neon_auth.user" does not exist`**

**原因**：Neon Auth 未启用或未完成初始化

**解决方案：**
1. 进入 Neon Console → Auth，检查状态是否为 "Enabled"
2. 如果显示 "Provisioning"，等待完成（约 30 秒）
3. 如使用开发分支且创建于 Neon Auth 配置之前，执行 `reset_from_parent` 重置分支

**错误：Drizzle 尝试迁移 neon_auth schema**

**原因**：不小心在 schema.ts 中导出了 neonAuthUser

**解决方案：**
1. 在 `db/neon-auth.schema.ts` 中定义 neonAuthUser，但不导出该表本身
2. 仅导出类型（`export type NeonAuthUser = ...`）用于类型提示
3. 确保 Drizzle 生成的迁移文件中没有 `CREATE TABLE neon_auth.*` 的 SQL

---

## 常见问题

### Q: `url: undefined` 错误

**原因**：drizzle-kit 没有加载到环境变量

**解决**：确保 `drizzle.config.ts` 中有 `config({ path: '.env' })`

### Q: 连接超时

**原因**：Neon 数据库休眠后首次连接需要冷启动

**解决**：等待几秒重试，或在 Neon 控制台启用 "Always On"

### Q: Schema 推送失败

**原因**：可能是 Schema 语法错误或表已存在冲突

**解决**：检查错误信息，必要时手动删除冲突表

### Q: 如何在代码中获取当前用户？

**Next.js App Router 服务端获取用户（推荐）：**

```typescript
// app/account/page.tsx (Server Component)
import { neonAuth } from "@neondatabase/neon-js/auth/next";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AccountPage() {
  // 在服务端获取当前用户
  const { user } = await neonAuth();

  if (!user) {
    return <div>Not signed in</div>;
  }

  // 从业务表查询扩展信息
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });

  return (
    <div>
      <h1>Welcome {user.name}</h1>
      <p>Email: {user.email}</p>
      <pre>{JSON.stringify({ user, profile }, null, 2)}</pre>
    </div>
  );
}
```

**客户端获取会话（React 组件）：**

```typescript
"use client"; // 客户端组件

import { useSession } from "@neondatabase/neon-js/auth/react";

export function UserProfile() {
  const session = useSession();

  if (!session) {
    return <div>Not signed in</div>;
  }

  return (
    <div>
      <p>User ID: {session.user.id}</p>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

---

## 生产环境配置最佳实践

在将数据库上线到生产环境前，**必须**进行以下配置，否则可能导致性能问题或服务中断。

### 配置清单

#### 1. 禁用 Scale to Zero（关键！）

⚠️ **生产环境必须禁用 Scale to Zero**

**原因**：
- 默认情况下，Neon 会在 5 分钟无活动后将计算资源缩减到零
- 下次请求时需要冷启动（5-10 秒），导致用户体验极差
- 生产环境应始终保持数据库在线

**配置方法**：

通过 Neon Console：
1. 进入项目 → **Branches** → 选择 `main` 分支
2. 点击 **Compute** 标签
3. 找到 **Autosuspend delay**
4. 设置为 `Never` 或设定一个较长的时间（如 7 天）

通过 MCP 工具（需通过 API 配置）：
```sql
-- 查询当前配置
SELECT * FROM neon.compute_settings;
```

#### 2. 调整计算资源（推荐）

根据负载选择合适的计算单元（CU）：

| 环境类型 | 推荐 CU | 说明 |
|---------|--------|------|
| 开发/测试 | 0.25 - 0.5 CU | 允许 Scale to Zero |
| 预生产 | 1 - 2 CU | 建议禁用 Scale to Zero |
| 生产（小型） | 2 - 4 CU | 必须禁用 Scale to Zero |
| 生产（中型） | 4 - 8 CU | 必须禁用 Scale to Zero |

**配置方法**：
1. Neon Console → Branches → main → Compute
2. 设置 **Compute size** 范围
3. 启用 **Autoscaling** 以应对流量波动

#### 3. 启用分支保护

保护主分支免受意外修改：

1. Neon Console → Settings → **Branch Protection**
2. 添加保护规则：
   - Protected branch: `main`
   - Require review: 启用（如适用）
   - Restrict deletions: 启用

#### 4. 配置备份策略

Neon 默认提供 7 天的时间点恢复（PITR），但生产环境建议：

- 升级到 **Scale Plan** 或更高，获得 30 天 PITR
- 定期导出关键数据快照（通过 `pg_dump`）

### 上线前安全检查清单

使用以下清单确保配置正确：

```markdown
生产环境配置检查清单：

- [ ] Scale to Zero 已禁用（main 分支）
- [ ] 计算资源设置为至少 2 CU
- [ ] Autoscaling 已启用（可选，建议）
- [ ] 主分支保护已启用
- [ ] DATABASE_URL 使用生产分支连接
- [ ] SSL 模式已启用（sslmode=require）
- [ ] 环境变量已在生产环境配置（Vercel/Netlify 等）
- [ ] 数据库迁移已在预生产环境测试
- [ ] 备份策略已确认（7 天或 30 天 PITR）
- [ ] 监控告警已配置（可选）
```

### 常见配置错误

| 错误 | 后果 | 解决方案 |
|------|------|---------|
| 生产环境未禁用 Scale to Zero | 用户频繁遇到 5-10 秒延迟 | 设置 Autosuspend = Never |
| 计算资源过小（< 1 CU） | 高负载时性能瓶颈 | 升级到 2-4 CU |
| 使用开发分支连接 | 生产数据写入测试环境 | 更新 DATABASE_URL 为 main |
| 未启用 SSL | 数据传输不加密 | 确保 `sslmode=require` |

### 性能优化建议

#### 开发环境优化
```bash
# .env.development
DATABASE_URL="postgresql://...?sslmode=require"
NEON_BRANCH_NAME="dev"
# 允许 Scale to Zero 以节省成本
```

#### 生产环境优化
```bash
# .env.production
DATABASE_URL="postgresql://...?sslmode=require&connect_timeout=10"
NEON_BRANCH_NAME="main"
# 连接池配置（如使用 Prisma）
DATABASE_POOL_SIZE=10
```

---

## 查询最佳实践

### 批量操作优化

在 Neon Serverless 环境中，批量操作比多次单独操作更高效：

```typescript
import { db } from './db';
import { users, type NewUser } from './schema';

// ✅ 推荐：批量插入
async function batchInsertUsers(newUsers: NewUser[]) {
  return db.insert(users).values(newUsers).returning();
}

// ❌ 避免：循环单独插入
async function slowInsertUsers(newUsers: NewUser[]) {
  for (const user of newUsers) {
    await db.insert(users).values(user);  // 每次都是一个 HTTP 请求
  }
}
```

### 事务处理

使用 WebSocket 适配器时支持完整事务：

```typescript
import { db } from './db';
import { users, sessions } from './schema';

async function createUserWithSession(userData: NewUser) {
  return await db.transaction(async (tx) => {
    // 创建用户
    const [newUser] = await tx.insert(users).values(userData).returning();

    // 创建会话
    await tx.insert(sessions).values({
      userId: newUser.id,
      token: crypto.randomUUID(),
    });

    return newUser;
  });
}
```

> ⚠️ **注意**：HTTP 适配器（`neon-http`）不支持跨语句事务，每个语句都是独立的。需要事务时请使用 WebSocket 适配器。

### 预编译语句

对于频繁执行的查询，使用预编译语句提升性能：

```typescript
import { db } from './db';
import { users } from './schema';
import { eq, sql } from 'drizzle-orm';

// 预编译查询
const getUserByEmailPrepared = db.select()
  .from(users)
  .where(eq(users.email, sql.placeholder('email')))
  .prepare('get_user_by_email');

// 使用预编译查询
async function getUserByEmail(email: string) {
  return getUserByEmailPrepared.execute({ email });
}
```

---

## 目录结构总览

```
your-project/
├── .env                    # 数据库连接配置（不提交）
├── drizzle.config.ts       # Drizzle CLI 配置
├── package.json            # 添加 db:* 脚本
└── src/
    └── db/
        ├── index.ts        # 数据库连接导出
        ├── schema.ts       # Schema 定义
        └── migrations/     # 迁移文件（可选）
```

---

## 更新记录

| 日期 | 更新内容 |
|------|----------|
| 2025-12-19 | 初稿 |
| 2025-12-19 | 添加分支命名规范、生产环境配置最佳实践 |
| 2025-12-24 | 连接字符串添加 `channel_binding`，添加 `ws` 依赖，更新主键语法为 `generatedAlwaysAsIdentity()`，补充 WebSocket 适配器配置、事务处理、批量操作最佳实践 |
| 2025-12-26 | **重大更新**：按官方文档完全重新组织 Neon Auth 部分 |
