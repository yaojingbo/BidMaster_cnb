---
name: database-design
description: 本技能用于设计Web应用的数据库模式，涵盖实体关系建模、表结构设计、索引策略、迁移规划和使用Drizzle ORM的模式定义。
depends:
  - real.md
  - cog.md
generates:
  - schema.ts
  - spec-database-design.md (仅当用户明确要求时)
---

> **AI智能体注意**：本技能直接生成 `schema.ts` 代码文件，而非设计文档。生成模式前，必须从 `real.md` 和 `cog.md` 加载上下文。如果这些文件不存在，请先调用 `meta-42cog` 技能创建它们。

## 前置条件

### 执行前检查清单

使用本技能前，请验证：

1. **real.md存在** - 包含现实约束（最多4条必选 + 3条可选）
2. **cog.md存在** - 包含认知模型（智能体 + 信息 + 上下文）

如果任一文件缺失，请执行：
```
调用技能：meta-42cog
```

### 上下文加载

从 `cog.md` 中提取：
- **信息实体**：所有带唯一编码和分类的数据对象
- **实体关系**：实体之间的关联方式
- **智能体-实体映射**：哪些智能体创建/读取/更新/删除哪些实体

从 `real.md` 中提取：
- **数据约束**：加密要求、存储格式（如消息使用JSONB）
- **安全约束**：密码哈希、API密钥加密要求
- **业务规则**：自动管理员分配、唯一约束

# 数据库设计

## 概述

本技能指导现代Web应用的数据库模式设计，**直接输出可用的 schema.ts 代码**。仅当用户明确要求时才生成 spec-database-design.md 文档。

**核心原则：** 不只看 MVP 是否需要，更要评估数据模型是否支撑未来核心用户故事，以及**未来重构成本**的高低。

## 适用场景

- 为新项目创建数据库模式
- 向现有模式添加新实体
- 使用索引优化查询性能
- 规划数据库迁移
- 生成 Drizzle ORM 模式定义和 Zod 验证

## 流程

### 阶段零：设计决策框架

对每个实体评估：

1. **cog.md 是否定义此实体？** - 有明确定义 → 大概率需要
2. **用户故事是否依赖此实体？** - 有统计/查询/关联需求 → 需要
3. **未来重构成本高吗？** - 涉及数据迁移 → 现在就加

根据项目实际情况选择：代码常量、JSONB、或关联表。

协作场景考虑乐观锁，敏感操作考虑软删除。

### 阶段一：分析实体和关系

**实体识别：**

从认知模型(cog.md)中识别：
- 核心实体（用户、对话、消息）
- 支撑实体（配置、模板）
- 关联实体（用于多对多关系）

**关系类型：**

| 类型 | 示例 | 实现 |
|------|------|------|
| 一对一 | User → Profile | 带唯一约束的FK |
| 一对多 | User → Conversations | 子表中的FK |
| 多对多 | Users ↔ Roles | 关联表 |

### 阶段二：确定表结构

**命名规范：**

| 元素 | 规范 | 示例 |
|------|------|------|
| 表 | snake_case，复数 | users, api_configurations |
| 列 | snake_case | user_id, created_at |
| 主键 | id | id |
| 外键 | 单数_id | user_id |
| 索引 | idx_表_列 | idx_users_email |
| 唯一 | uniq_表_列 | uniq_users_email |

**标准列类型：**

| 用途 | PostgreSQL类型 | 说明 |
|------|----------------|------|
| 主键（内部） | SERIAL/INTEGER | 使用 serial() 或 integer().generatedAlwaysAsIdentity()，易被枚举，不应直接暴露给外部 API |
| 主键（公开） | UUID | 使用 uuid().defaultRandom()，更难枚举，但不是权限控制手段 |
| 短文本 | VARCHAR(N) | 指定最大长度 | - |
| 长文本 | TEXT | 无限长度 | - |
| JSON数据 | JSONB | 用于灵活模式 | - |
| 布尔值 | BOOLEAN | true/false | - |
| 整数 | INTEGER | 标准整型 | - |
| 时间戳 | TIMESTAMP | 不带时区 | - |
| 枚举 | VARCHAR | 或PostgreSQL ENUM | - |

### 阶段三：设计索引

**索引策略：**

| 查询模式 | 索引类型 |
|----------|----------|
| 等值查询 (WHERE x = ?) | B-tree（默认） |
| 范围查询 (WHERE x > ?) | B-tree |
| 全文搜索 | GIN |
| JSON查询 | GIN |
| 唯一约束 | 唯一索引 |

**索引指南：**
- 为外键创建索引以优化JOIN性能
- 为WHERE子句中的列创建索引
- 避免过度索引（会降低写入速度）
- 考虑为多列查询使用组合索引

### 阶段四：生成 schema.ts

**直接输出 Drizzle 模式代码：**

```typescript
// src/db/schema.ts
import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  index
} from 'drizzle-orm/pg-core';

// 推荐：公开资源使用 UUID 主键（防止枚举攻击）
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }),
  role: varchar('role', { length: 20 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 内部资源可使用 serial（性能更好）
// 注意：如果通过 API 暴露，也应使用 UUID
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 200 }),
  model: varchar('model', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_conversations_user').on(table.userId),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  role: varchar('role', { length: 20 }).notNull(),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  convIdx: index('idx_messages_conversation').on(table.conversationId),
}));

// 仅内部使用的表可使用 serial
// 例如：审计日志、系统配置等不对外暴露的表
// export const auditLogs = pgTable('audit_logs', {
//   id: serial('id').primaryKey(),
//   ...
// });
```

### 阶段五：生成类型和 Zod 验证

**类型导出：**

```typescript
// src/db/types.ts
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users, conversations, messages } from './schema';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
```

**Zod 验证模式：**

```typescript
// src/lib/validations/user.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

### 阶段六：迁移命令

```bash
# 生成迁移
bunx drizzle-kit generate

# 应用迁移
bunx drizzle-kit migrate

# 查看数据库
bunx drizzle-kit studio
```

## 输出规范

### 默认输出（直接生成代码）

1. **schema.ts** - Drizzle 模式定义
2. **types.ts** - TypeScript 类型导出（可选）
3. **validations/*.ts** - Zod 验证模式（可选）

### 可选输出（仅当用户明确要求）

如果用户说"请同时生成设计文档"或"我需要 spec-database-design.md"，则额外生成：

```markdown
# 数据库设计文档

## 1. 实体关系图
[ER图]

## 2. 表定义
[表定义]

## 3. 索引策略
[索引定义和理由]

## 4. 约束说明
[业务约束和验证规则]

## 5. 迁移计划
[迁移策略]
```

## 质量检查清单

### 设计决策
- [ ] 每个实体已评估：cog.md 定义？用户故事依赖？未来重构成本？

### 实现质量
- [ ] cog.md 中的所有实体已体现在 schema.ts
- [ ] 关系通过 references() 正确定义
- [ ] 索引覆盖常见查询模式
- [ ] real.md 中的约束已实现
- [ ] 命名规范一致（snake_case）
- [ ] 需要灵活性时使用 JSONB
- [ ] 类型导出完整
- [ ] Zod 验证与 schema 对应

### 安全性检查
- [ ] 公开 API 暴露的表使用 UUID 主键（防止枚举攻击）
- [ ] 内部表可使用 serial 主键（性能优先）
- [ ] 不依赖 ID 不可猜测性作为权限控制手段
- [ ] 敏感数据字段已加密或哈希处理
- [ ] 所有公开端点都有权限验证逻辑

## 与其他技能的关系

| 技能 | 关系 |
|------|------|
| system-architecture | 输入：架构定义实体 |
| coding | 输出：schema.ts 用于应用代码 |
| quality-assurance | 输出：模式在集成测试中测试 |

---

**最后更新：** 2025-12-19
**文档版本：** v2 （聚焦schema.ts文件）
**维护者：** 42COG 团队