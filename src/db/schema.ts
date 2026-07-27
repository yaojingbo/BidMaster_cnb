import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  bigint,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// 后端真实建表逻辑以 src/backend/app/infrastructure/db_schema.py 为唯一权威来源。
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: varchar('salt', { length: 64 }).notNull(),
  role: varchar('role', { length: 20 }).default('user'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const files = pgTable('files', {
  id: varchar('id', { length: 64 }).primaryKey(),
  originalName: text('original_name').notNull(),
  path: text('path').notNull(),
  size: bigint('size', { mode: 'number' }).default(0),
  type: varchar('type', { length: 50 }),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
  encryptedContent: bytea('encrypted_content'),
  fileHash: varchar('file_hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const simulates = pgTable('simulates', {
  taskId: varchar('task_id', { length: 64 }).primaryKey(),
  name: text('name'),
  status: varchar('status', { length: 30 }).default('pending'),
  sourceHash: text('source_hash'),
  currentStep: integer('current_step').default(0),
  params: jsonb('params').default({}),
  stepResults: jsonb('step_results').default({}),
  fileIds: jsonb('file_ids').default([]),
  files: jsonb('files').default([]),
  fileNames: jsonb('file_names').default([]),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const openings = pgTable('openings', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name'),
  fileId: varchar('file_id', { length: 64 }),
  fileName: text('file_name'),
  meta: jsonb('meta').default({}),
  bidderCount: integer('bidder_count').default(0),
  bidRanking: jsonb('bid_ranking').default([]),
  bidStats: jsonb('bid_stats').default({}),
  aiAnalysis: text('ai_analysis'),
  status: varchar('status', { length: 20 }).default('completed'),
  sourceHash: text('source_hash'),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const extracts = pgTable('extracts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name'),
  fileId: text('file_id'),
  fileName: text('file_name'),
  templateType: varchar('template_type', { length: 50 }),
  mode: varchar('mode', { length: 20 }),
  content: text('content'),
  elements: jsonb('elements').default([]),
  status: varchar('status', { length: 30 }).default('completed'),
  sourceHash: text('source_hash'),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  userId: varchar('user_id', { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.provider] }),
}));

export const verificationCodes = pgTable('verification_codes', {
  email: varchar('email', { length: 255 }).primaryKey(),
  code: varchar('code', { length: 10 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const resetTokens = pgTable('reset_tokens', {
  token: varchar('token', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const cliDeviceCodes = pgTable('cli_device_codes', {
  deviceCode: text('device_code').primaryKey(),
  userCode: varchar('user_code', { length: 16 }).notNull().unique(),
  status: varchar('status', { length: 20 }).default('pending'),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  authorizedAt: timestamp('authorized_at', { withTimezone: true }),
});

export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  simulates: many(simulates),
  openings: many(openings),
  extracts: many(extracts),
  apiKeys: many(apiKeys),
  resetTokens: many(resetTokens),
  cliDeviceCodes: many(cliDeviceCodes),
}));

export const filesRelations = relations(files, ({ one }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
}));

export const simulatesRelations = relations(simulates, ({ one }) => ({
  user: one(users, {
    fields: [simulates.userId],
    references: [users.id],
  }),
}));

export const openingsRelations = relations(openings, ({ one }) => ({
  user: one(users, {
    fields: [openings.userId],
    references: [users.id],
  }),
}));

export const extractsRelations = relations(extracts, ({ one }) => ({
  user: one(users, {
    fields: [extracts.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const resetTokensRelations = relations(resetTokens, ({ one }) => ({
  user: one(users, {
    fields: [resetTokens.userId],
    references: [users.id],
  }),
}));

export const cliDeviceCodesRelations = relations(cliDeviceCodes, ({ one }) => ({
  user: one(users, {
    fields: [cliDeviceCodes.userId],
    references: [users.id],
  }),
}));
