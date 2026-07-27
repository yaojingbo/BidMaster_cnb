---
name: database-design
description: Use when designing database schemas for web applications - covers entity-relationship modeling, table structure design, indexing strategies, migration planning, and Drizzle ORM schema definitions.
depends:
  - real.md
  - cog.md
generates:
  - schema.ts
  - spec-database-design.md (only when explicitly requested)
---

> **AI Agent Note**: This skill directly generates `schema.ts` code files, not design documents. Before generating schemas, you must load context from `real.md` and `cog.md`. If these files don't exist, invoke the `meta-42cog` skill to create them first.

## Prerequisites

### Pre-execution Checklist

Before using this skill, verify:

1. **real.md exists** - Contains reality constraints (up to 4 required + 3 optional)
2. **cog.md exists** - Contains cognitive model (agents + information + context)

If either file is missing, execute:
```
Invoke skill: meta-42cog
```

### Context Loading

Extract from `cog.md`:
- **Information entities**: All data objects with unique codes and classifications
- **Entity relationships**: How entities relate to each other
- **Agent-entity mapping**: Which agents create/read/update/delete which entities

Extract from `real.md`:
- **Data constraints**: Encryption requirements, storage formats (e.g., JSONB for messages)
- **Security constraints**: Password hashing, API key encryption requirements
- **Business rules**: Automatic admin assignment, unique constraints

# Database Design

## Overview

This skill guides database schema design for modern web applications, **directly outputting production-ready schema.ts code**. Only generates spec-database-design.md documentation when explicitly requested by the user.

**Core Principle:** Don't just evaluate for MVP needs - assess whether the data model supports future core user stories and evaluate the **future refactoring cost**.

## When to Use

- Creating database schemas for new projects
- Adding new entities to existing schemas
- Optimizing query performance with indexes
- Planning database migrations
- Generating Drizzle ORM schema definitions and Zod validations

## Workflow

### Phase 0: Design Decision Framework

Evaluate each entity:

1. **Is this entity defined in cog.md?** - Explicit definition → likely needed
2. **Do user stories depend on this entity?** - Statistics/queries/relationships needed → needed
3. **Is future refactoring cost high?** - Involves data migration → add it now

Choose based on project context: code constants, JSONB, or junction tables.

Consider optimistic locking for collaborative scenarios, soft delete for sensitive operations.

### Phase 1: Analyze Entities and Relationships

**Entity Identification:**

Identify from the cognitive model (cog.md):
- Core entities (users, conversations, messages)
- Supporting entities (configurations, templates)
- Junction entities (for many-to-many relationships)

**Relationship Types:**

| Type | Example | Implementation |
|------|---------|----------------|
| One-to-one | User → Profile | FK with unique constraint |
| One-to-many | User → Conversations | FK in child table |
| Many-to-many | Users ↔ Roles | Junction table |

### Phase 2: Determine Table Structure

**Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | users, api_configurations |
| Columns | snake_case | user_id, created_at |
| Primary key | id | id |
| Foreign key | singular_id | user_id |
| Index | idx_table_column | idx_users_email |
| Unique | uniq_table_column | uniq_users_email |

**Standard Column Types:**

| Purpose | PostgreSQL Type | Notes |
|---------|-----------------|-------|
| Primary key (internal) | SERIAL/INTEGER | Use serial() or integer().generatedAlwaysAsIdentity(), Easily enumerable, should not be exposed to external APIs |
| Primary key (public) | UUID | Use uuid().defaultRandom(), Harder to enumerate, but not a permission control mechanism |
| Short text | VARCHAR(N) | Specify max length | - |
| Long text | TEXT | Unlimited length | - |
| JSON data | JSONB | For flexible schemas | - |
| Boolean | BOOLEAN | true/false | - |
| Integer | INTEGER | Standard integer | - |
| Timestamp | TIMESTAMP | Without timezone | - |
| Enum | VARCHAR | Or PostgreSQL ENUM | - |

### Phase 3: Design Indexes

**Index Strategy:**

| Query Pattern | Index Type |
|---------------|------------|
| Equality (WHERE x = ?) | B-tree (default) |
| Range (WHERE x > ?) | B-tree |
| Full-text search | GIN |
| JSON queries | GIN |
| Unique constraint | Unique index |

**Index Guidelines:**
- Create indexes on foreign keys to optimize JOINs
- Index columns used in WHERE clauses
- Avoid over-indexing (slows down writes)
- Consider composite indexes for multi-column queries

### Phase 4: Generate schema.ts

**Output Drizzle schema code directly:**

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

// Recommended: Use UUID primary keys for public resources (prevents enumeration attacks)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }),
  role: varchar('role', { length: 20 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Internal resources can use serial (better performance)
// Note: If exposed via API, should also use UUID
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

// Tables used only internally can use serial
// Examples: audit logs, system configurations, etc. that are not exposed externally
// export const auditLogs = pgTable('audit_logs', {
//   id: serial('id').primaryKey(),
//   ...
// });
```

### Phase 5: Generate Types and Zod Validations

**Type Exports:**

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

**Zod Validation Schemas:**

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

### Phase 6: Migration Commands

```bash
# Generate migration
bunx drizzle-kit generate

# Apply migration
bunx drizzle-kit migrate

# View database
bunx drizzle-kit studio
```

## Output Specification

### Default Output (Direct Code Generation)

1. **schema.ts** - Drizzle schema definitions
2. **types.ts** - TypeScript type exports (optional)
3. **validations/*.ts** - Zod validation schemas (optional)

### Optional Output (Only When Explicitly Requested)

If user says "please also generate design documentation" or "I need spec-database-design.md", additionally generate:

```markdown
# Database Design Document

## 1. Entity Relationship Diagram
[ER Diagram]

## 2. Table Definitions
[Table definitions]

## 3. Index Strategy
[Index definitions and rationale]

## 4. Constraint Documentation
[Business constraints and validation rules]

## 5. Migration Plan
[Migration strategy]
```

## Quality Checklist

### Design Decisions
- [ ] Each entity evaluated: cog.md defined? User story depends? Future refactoring cost?

### Implementation Quality
- [ ] All entities from cog.md are reflected in schema.ts
- [ ] Relationships correctly defined via references()
- [ ] Indexes cover common query patterns
- [ ] Constraints from real.md are implemented
- [ ] Naming conventions consistent (snake_case)
- [ ] JSONB used where flexibility is needed
- [ ] Type exports are complete
- [ ] Zod validations correspond to schema

### Security Checks
- [ ] Tables exposed via public API use UUID primary keys (prevents enumeration attacks)
- [ ] Internal tables can use serial primary keys (performance priority)
- [ ] Do not rely on ID unpredictability as a permission control mechanism
- [ ] Sensitive data fields are encrypted or hashed
- [ ] All public endpoints have permission verification logic

## Relationship with Other Skills

| Skill | Relationship |
|-------|--------------|
| system-architecture | Input: Architecture defines entities |
| coding | Output: schema.ts used in application code |
| quality-assurance | Output: Schema tested in integration tests |
