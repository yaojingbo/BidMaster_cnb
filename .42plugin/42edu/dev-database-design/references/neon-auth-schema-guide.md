# Neon Auth + Drizzle ORM Schema 设计指南

> 本文档指导如何在使用 Neon Auth (Better Auth) 时正确设计和推送数据库表 schema，确保业务表与认证系统正确关联。
>
> **适用版本**：Neon Auth with Better Auth（2025 年起推荐使用）

---

## 目录

1. [Neon Auth 架构概述](#neon-auth-架构概述)
2. [Schema 设计原则](#schema-设计原则)
3. [Drizzle ORM 配置](#drizzle-orm-配置)
4. [业务表外键关联](#业务表外键关联)
5. [迁移工作流程](#迁移工作流程)
6. [验证与排错](#验证与排错)
7. [完整示例](#完整示例)

---

## Neon Auth 架构概述

### 什么是 Neon Auth？

Neon Auth 是 Neon 提供的托管认证服务，基于 [Better Auth](https://better-auth.com) 框架，完全集成到 Neon 平台。

**核心优势**：
- **原生分支支持**：认证数据随数据库分支自动隔离，适合预览环境和测试
- **数据库即真相源**：用户数据直接存储在 Neon 数据库，无需 webhook 同步
- **简化配置**：只需一个环境变量，无需复杂的认证服务配置
- **开源基础**：基于 Better Auth，社区活跃，功能迭代快

### 两个 Schema 的关系

```
┌──────────────────────────────────────────────────────────────┐
│                     Neon Database                            │
├──────────────────────────┬───────────────────────────────────┤
│     neon_auth schema     │         public schema             │
│  (Neon Auth管理，不可修改) │      (业务表，你来设计)            │
├──────────────────────────┼───────────────────────────────────┤
│ • user ◄─────────────────┼─── 外键引用点                      │
│   (用户核心信息)          │                                   │
│ • account                │ • user_profiles                   │
│   (密码 + OAuth tokens)   │ • conversations                   │
│ • session (会话)          │ • messages                        │
│ • verification           │ • api_keys                        │
│   (邮箱验证、密码重置)     │ • groups                          │
│                          │ • ...                             │
└──────────────────────────┴───────────────────────────────────┘
```

### neon_auth 表说明（共 9 个表）

**核心表（4 个）**：Better Auth 框架自动创建

| 表名 | 用途 | 说明 |
|------|------|------|
| `user` | **用户基本信息** | **业务表应关联此表的 id** |
| `account` | 认证凭证 | 密码哈希、OAuth tokens，由 Better Auth 管理 |
| `session` | 用户会话 | 由 Better Auth 自动管理 |
| `verification` | 验证令牌 | 邮箱验证、密码重置 |

**Organization 插件表（3 个）**：Neon Auth 默认启用的多租户支持

| 表名 | 用途 | 说明 |
|------|------|------|
| `organization` | 组织/团队 | 多租户支持 |
| `member` | 组织成员 | 用户-组织多对多关系 |
| `invitation` | 组织邀请 | 待接受的邀请记录 |

**Neon 特有表（2 个）**：Neon 平台扩展

| 表名 | 用途 | 说明 |
|------|------|------|
| `jwks` | JWT 公钥 | 用于 RLS 策略验证 JWT |
| `project_config` | 项目配置 | Neon Auth 配置存储 |

### neon_auth.user 表结构

`neon_auth.user` 表由 Neon Auth (Better Auth) 自动创建和管理，包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text (PK) | 用户唯一标识，业务表外键关联此字段 |
| `email` | text (UNIQUE) | 用户邮箱 |
| `emailVerified` | boolean | 邮箱是否已验证 |
| `name` | text | 用户名 |
| `image` | text | 头像 URL |
| `createdAt` | timestamp | 用户创建时间 |
| `updatedAt` | timestamp | 用户最后更新时间 |

**关键要点：**
- `neon_auth.user` 存储用户基本信息，**安全可靠，可直接关联**
- 密码和 OAuth tokens 存储在 `neon_auth.account` 表，与 `user` 表分离
- Better Auth 自动维护这两个表的关系
- 业务表应该**直接关联 `neon_auth.user.id`**

---

## Schema 设计原则

### 原则 1：定义 neon_auth.user 的引用

在 Drizzle ORM 中，定义 `neon_auth` schema 和 `user` 表，但**不导出**，仅用于外键引用：

```typescript
// 定义 neon_auth schema（不导出）
import { pgSchema } from 'drizzle-orm/pg-core';

const neonAuthSchema = pgSchema('neon_auth');

export const neonAuthUser = neonAuthSchema.table('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified'),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// 导出用于类型提示（可选）
export type NeonAuthUser = typeof neonAuthUser.$inferSelect;
```

### 原则 2：业务表直接关联 neon_auth.user.id

在业务表中使用 `references()` 直接指向 `neon_auth.user.id`：

```typescript
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  // 直接关联 neon_auth.user.id
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  // ...其他字段
});
```

### 原则 3：用户 ID 字段类型必须为 text

Neon Auth 的用户 ID 是 `text` 类型（UUID 格式的字符串），业务表的外键字段也必须是 `text`：

```typescript
// ✅ 正确
userId: text('user_id').references(() => neonAuthUser.id)

// ❌ 错误
userId: uuid('user_id').references(() => neonAuthUser.id)
```

### 原则 4：先启用 Neon Auth，再推送 Schema

必须先在 Neon Console 中启用 Neon Auth，确保 `neon_auth` schema 完整创建（包括 `user` 和 `account` 表），然后再推送业务表 schema。

---

## Drizzle ORM 配置

### 项目结构

```
src/db/
├── index.ts      # 数据库连接
├── schema.ts     # Schema 定义（主文件）
└── migrations/   # 迁移文件（drizzle-kit 生成）
```

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// 显式加载 .env 文件
config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### src/db/index.ts

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

---

## 业务表外键关联

### 基本模式

所有需要关联用户的业务表，都使用相同的模式：

```typescript
import { pgSchema, pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 定义 neon_auth.user 引用（不导出）
const neonAuthSchema = pgSchema('neon_auth');
const neonAuthUser = neonAuthSchema.table('user', {
  id: text('id').primaryKey(),
  // ... 其他字段
});

// 业务表关联用户
export const yourTable = pgTable('your_table', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),

  // 关联 Neon Auth 用户
  userId: text('user_id')
    .notNull()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),

  // 其他字段...
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

> **为什么业务表使用 UUID 主键？**
> - **安全性**：UUID 不可预测，防止资源 ID 被枚举（如 `/api/posts/1`, `/api/posts/2`）
> - **分布式友好**：无需中心化 ID 生成器，适合微服务架构
> - **Neon Auth 兼容**：`neonAuthUser.id` 本身是 `text` 类型（UUID 格式的字符串）
>
> 注意：UUID 本身不是权限控制手段，仍需验证用户对资源的访问权限。

### 常见关联场景

#### 场景 1：用户扩展信息（一对一）

```typescript
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()  // 一对一关系
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').default('member').notNull(),
  preferences: jsonb('preferences'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### 场景 2：用户资源（一对多）

```typescript
export const conversations = pgTable('conversations', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('conversations_user_id_idx').on(table.userId),
]);
```

#### 场景 3：可选用户关联

```typescript
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  // 用户级 API Key（可选）
  userId: text('user_id').references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  // 分组级 API Key（可选）
  groupId: uuid('group_id').references(() => groups.id),
  // ...
});
```

#### 场景 4：创建者/操作者记录

```typescript
export const groups = pgTable('groups', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  creatorId: text('creator_id')
    .notNull()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  // ...
});

export const operationLogs = pgTable('operation_logs', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  operatorId: text('operator_id')
    .notNull()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  // ...
});
```

---

## 迁移工作流程

### 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    迁移工作流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 在 Neon Console 启用 Neon Auth                           │
│     ↓                                                        │
│  2. 设计 schema.ts（在业务表中引用 neon_auth.user）           │
│     ↓                                                        │
│  3. bunx drizzle-kit generate（生成迁移 SQL）                 │
│     ↓                                                        │
│  4. bunx drizzle-kit push（推送到 development 分支）          │
│     ↓                                                        │
│  5. 验证外键关联是否正确                                      │
│     ↓                                                        │
│  6. 测试通过后，合并到 production 分支                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 步骤 1：启用 Neon Auth

⚠️ **关键顺序要求**：
1. 必须在**主分支（main）**先配置 Neon Auth
2. 然后再创建开发分支（或重置已有分支）
3. 开发分支会自动继承 `neon_auth` schema

**方式一：通过 Neon Console**

1. 进入项目 → 左侧栏 **Auth**
2. 点击 **Enable Neon Auth**
3. 配置 OAuth 提供商（Google、GitHub 等）
4. 在 **Configuration** 选项卡获取环境变量
5. 等待 `neon_auth` schema 自动创建（包括 `user`、`account` 等表，约 30 秒）

**方式二：使用 MCP 工具**

```
mcp__plugin_neon-plugin_neon__provision_neon_auth
参数：{ "projectId": "你的项目ID" }
```

⚠️ **生产环境配置提醒**：
- 主分支应在启用 Neon Auth 后立即进行生产环境配置
- 参考[生产环境配置最佳实践](#生产环境配置最佳实践)章节

**环境变量配置**：

```bash
# 从 Neon Console → Auth → Configuration 复制
# 根据框架不同，命名方式可能不同：
# - Vite: VITE_NEON_AUTH_URL
# - Next.js: NEXT_PUBLIC_NEON_AUTH_URL
# - 服务端: NEON_AUTH_URL
NEON_AUTH_URL=https://ep-xxx.neonauth.us-east-1.aws.neon.tech/neondb/auth
```

### 步骤 2：设计 Schema

编辑 `src/db/schema.ts`，使用 `pgSchema` 定义 `neonAuthUser` 引用（参见["Schema 设计原则"](#schema-设计原则)部分）：

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

const neonAuthSchema = pgSchema('neon_auth');
export const neonAuthUser = neonAuthSchema.table('user', {
  id: text('id').primaryKey(),
  // ... 其他字段
});

// 定义你的业务表，使用 neonAuthUser 作为外键引用
```

### 步骤 3：生成迁移

```bash
bunx drizzle-kit generate
```

检查生成的迁移文件，确保：
- 没有尝试创建 `neon_auth` 相关表
- 外键正确指向 `neon_auth.user`

### 步骤 4：推送迁移

**开发环境（直接推送）：**

```bash
bunx drizzle-kit push
```

**生产环境（使用迁移文件）：**

```bash
bunx drizzle-kit migrate
```

### 步骤 5：验证

使用 Neon MCP 工具验证：

```sql
-- 检查 neon_auth 表是否完整
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'neon_auth';

-- 检查业务表外键
SELECT tc.table_name, kcu.column_name,
       ccu.table_schema AS fk_schema,
       ccu.table_name AS fk_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

---

## 验证与排错

### 常见错误 1：relation "neon_auth.user" does not exist

**原因**：Neon Auth 未启用，或未完成初始化。

**解决**：
1. 进入 Neon Console → Auth
2. 点击 **Enable Neon Auth**
3. 等待初始化完成（约 30 秒），`neon_auth.user` 和 `neon_auth.account` 表会自动创建
4. 如使用开发分支，确保分支在启用 Neon Auth 后创建，或执行 `reset_from_parent` 同步
5. 重新执行 `drizzle-kit push`

### 常见错误 2：relation "neon_auth.account" does not exist

**原因**：Neon Auth schema 不完整。

**解决**：
1. 检查 Neon Console 中 Auth 状态
2. 如果显示 "Provisioning"，等待完成
3. 如果长时间未完成，尝试重新启用

### 常见错误 3：外键类型不匹配

**原因**：业务表使用了 `uuid` 类型而不是 `text`。

**错误代码**：
```typescript
userId: uuid('user_id').references(() => neonAuthUser.id)
```

**正确代码**：
```typescript
userId: text('user_id').references(() => neonAuthUser.id)
```

### 常见错误 4：Drizzle 尝试管理 neon_auth 表

**原因**：导出了 `neonAuthUser` 或在 schema.ts 中定义的 neon_auth 表被 Drizzle 纳入迁移。

**解决**：
1. 不要导出 `neonAuthUser`（可选导出类型用于类型提示）
2. 定义 `neonAuthUser` 后，**仅在 `.references()` 中使用它**
3. 确保 Drizzle 生成的迁移文件中没有创建 `neon_auth.*` 表的 SQL

### 验证清单

- [ ] Neon Auth 已启用（Console → Auth 显示 "Enabled"）
- [ ] 环境变量 `NEON_AUTH_URL`（或 `NEXT_PUBLIC_NEON_AUTH_URL`）已配置
- [ ] `neon_auth` schema 包含完整的 9 个表：
  - 核心表：`user`、`account`、`session`、`verification`
  - Organization 插件：`organization`、`member`、`invitation`
  - Neon 特有：`jwks`、`project_config`
- [ ] 业务表使用 `text` 类型的 `user_id` 字段
- [ ] 外键正确指向 `neon_auth.user.id`
- [ ] `neonAuthUser` 已定义但不导出为表（仅用于外键引用）

---

## 完整示例

### schema.ts 完整示例

```typescript
/**
 * 数据库 Schema - 使用 Neon Auth (Better Auth)
 */

import { sql, relations } from 'drizzle-orm';
import {
  pgSchema,
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================================
// Neon Auth 引用 - 定义但不导出
// ============================================================================

const neonAuthSchema = pgSchema('neon_auth');

// 定义 neon_auth.user 表引用（用于外键关联）
const neonAuthUser = neonAuthSchema.table('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified'),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// 导出类型用于类型提示（可选）
export type NeonAuthUser = typeof neonAuthUser.$inferSelect;

// ============================================================================
// 枚举定义
// ============================================================================

export const userRoleEnum = pgEnum('user_role', ['member', 'admin']);

// ============================================================================
// 业务表定义
// ============================================================================

/**
 * 用户扩展信息表
 */
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  // 关联 Neon Auth 用户
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').default('member').notNull(),
  preferences: jsonb('preferences'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_profiles_user_id_idx').on(table.userId),
]);

/**
 * 对话表
 */
export const conversations = pgTable('conversations', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => neonAuthUser.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('conversations_user_id_idx').on(table.userId),
]);

/**
 * 消息表
 */
export const messages = pgTable('messages', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('messages_conversation_id_idx').on(table.conversationId),
]);

// ============================================================================
// 关系定义
// ============================================================================

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// ============================================================================
// 业务表类型导出
// ============================================================================

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

---

## 生产环境配置最佳实践

在将使用 Neon Auth 的数据库上线到生产环境前，请完成以下配置。

### 配置清单

#### 1. 禁用 Scale to Zero（关键！）

⚠️ **主分支必须禁用 Scale to Zero**

**原因**：
- Neon Auth 需要数据库持续在线以处理认证请求
- 冷启动会导致登录延迟 5-10 秒，严重影响用户体验
- 认证系统的可用性对用户体验至关重要

**配置方法**：
1. Neon Console → Branches → `main` → Compute
2. **Autosuspend delay** 设置为 `Never`

#### 2. 调整计算资源

根据用户规模配置：

| 用户规模 | 推荐 CU | 说明 |
|---------|--------|------|
| < 1000 用户 | 2 CU | 基础认证需求 |
| 1000-10000 用户 | 2-4 CU | 启用 Autoscaling |
| > 10000 用户 | 4-8 CU | 高并发认证 |

#### 3. 环境变量配置

确保生产环境正确配置：

```bash
# .env.production
# Neon Auth URL（生产环境，从 Console → Auth → Configuration 复制）
# Next.js 客户端使用 NEXT_PUBLIC_ 前缀
NEXT_PUBLIC_NEON_AUTH_URL=https://ep-xxx.neonauth.us-east-1.aws.neon.tech/neondb/auth

# 数据库连接（main 分支）
DATABASE_URL="postgresql://用户:密码@主机/数据库?sslmode=require"

# 确认分支名称
NEON_BRANCH_NAME="main"
```

#### 4. 分支策略

| 分支 | Neon Auth 配置 | Scale to Zero | 用途 |
|------|--------------|--------------|------|
| `main` | 生产配置 | 禁用 | 生产环境 |
| `staging` | 测试配置 | 可选禁用 | 预生产测试 |
| `dev` | 开发配置 | 允许 | 功能开发 |

### 上线前检查清单

```markdown
Neon Auth 生产环境检查清单：

- [ ] Neon Auth 已在 main 分支启用
- [ ] Scale to Zero 已禁用（main 分支）
- [ ] 计算资源 ≥ 2 CU
- [ ] NEON_AUTH_BASE_URL 已配置（生产环境）
- [ ] OAuth 提供商已配置（Google/GitHub）
- [ ] DATABASE_URL 指向 main 分支
- [ ] SSL 模式已启用（sslmode=require）
- [ ] neon_auth.user 和 neon_auth.account 表存在并可查询
- [ ] 业务表外键正确指向 neon_auth.user
- [ ] 登录流程已在预生产环境测试
```

### 常见配置问题

| 问题 | 后果 | 解决方案 |
|------|------|---------|
| 主分支未禁用 Scale to Zero | 用户登录延迟 5-10 秒 | 设置 Autosuspend = Never |
| 使用开发分支 URL | 生产用户无法登录 | 更新为 main 分支 AUTH_URL |
| 计算资源不足 | 高并发时认证失败 | 升级到 2-4 CU |
| 开发分支未继承 neon_auth | Schema 推送失败 | 执行 reset_from_parent |

---

## 参考链接

- [Neon Auth 概览](https://neon.com/docs/auth/overview)
- [Neon Auth 认证流程](https://neon.com/docs/auth/authentication-flow)
- [Better Auth 官方文档](https://www.better-auth.com/)
- [Drizzle ORM 官方文档](https://orm.drizzle.team/)
- [Neon Database 官方文档](https://neon.tech/docs)

---

## 更新记录

| 日期 | 更新内容 |
|------|----------|
| 2025-12-19 | 初稿 |
| 2025-12-19 | 添加生产环境配置最佳实践、关键顺序要求 |
| 2025-12-24 | drizzle.config.ts 添加 dotenv 加载，补充 UUID 主键策略说明 |
| 2025-12-26 | **重大更新**：修正所有过时的 usersSync 引用为 neonAuthUser |
