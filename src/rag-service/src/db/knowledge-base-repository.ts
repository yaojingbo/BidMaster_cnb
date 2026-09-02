import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema.js';
import {
  knowledgeBaseFiles,
  knowledgeBaseMembers,
  knowledgeBases,
  ragIndexes,
} from './schema.js';

export type KnowledgeBaseSummary = {
  id: string;
  name: string;
  description: string;
  file_count: number;
  completed_count: number;
  processing_count: number;
  failed_count: number;
  stale_count: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgeBaseRepository = {
  create(userId: string, name: string, description: string): Promise<KnowledgeBaseSummary>;
  list(userId: string, search: string): Promise<KnowledgeBaseSummary[]>;
  get(knowledgeBaseId: string, userId: string): Promise<KnowledgeBaseSummary | undefined>;
  update(
    knowledgeBaseId: string,
    userId: string,
    values: { name?: string; description?: string },
  ): Promise<KnowledgeBaseSummary | undefined>;
  delete(knowledgeBaseId: string, userId: string): Promise<boolean>;
};

type Database = NodePgDatabase<typeof schema>;
type SummaryRow = {
  id: string;
  name: string;
  description: string | null;
  fileCount: number;
  completedCount: number;
  processingCount: number;
  failedCount: number;
  staleCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const summarySelection = {
  id: knowledgeBases.id,
  name: knowledgeBases.name,
  description: knowledgeBases.description,
  fileCount: sql<number>`count(distinct ${knowledgeBaseFiles.fileId})::int`,
  completedCount: sql<number>`count(distinct ${ragIndexes.fileId}) filter (where ${ragIndexes.status} = 'completed' and ${ragIndexes.userId} = ${knowledgeBases.userId})::int`,
  processingCount: sql<number>`count(distinct ${ragIndexes.fileId}) filter (where ${ragIndexes.status} in ('pending', 'processing') and ${ragIndexes.userId} = ${knowledgeBases.userId})::int`,
  failedCount: sql<number>`count(distinct ${ragIndexes.fileId}) filter (where ${ragIndexes.status} = 'failed' and ${ragIndexes.userId} = ${knowledgeBases.userId})::int`,
  staleCount: sql<number>`count(distinct ${ragIndexes.fileId}) filter (where ${ragIndexes.status} = 'stale' and ${ragIndexes.userId} = ${knowledgeBases.userId})::int`,
  createdAt: knowledgeBases.createdAt,
  updatedAt: knowledgeBases.updatedAt,
};

export class DrizzleKnowledgeBaseRepository implements KnowledgeBaseRepository {
  constructor(private readonly db: Database) {}

  async create(userId: string, name: string, description: string): Promise<KnowledgeBaseSummary> {
    const row = await this.db.transaction(async (transaction) => {
      const [created] = await transaction.insert(knowledgeBases).values({
        userId,
        name,
        description,
      }).returning();
      await transaction.insert(knowledgeBaseMembers).values({
        knowledgeBaseId: created.id,
        userId,
        role: 'owner',
      });
      return created;
    });
    return emptySummary(row);
  }

  async list(userId: string, search: string): Promise<KnowledgeBaseSummary[]> {
    const memberIds = this.db.select({ knowledgeBaseId: knowledgeBaseMembers.knowledgeBaseId })
      .from(knowledgeBaseMembers)
      .where(eq(knowledgeBaseMembers.userId, userId));
    const filters = [
      isNull(knowledgeBases.deletedAt),
      or(eq(knowledgeBases.userId, userId), sql`${knowledgeBases.id} in ${memberIds}`),
    ];
    if (search) filters.push(ilike(knowledgeBases.name, `%${search}%`));

    const rows = await this.summaryQuery(and(...filters)).orderBy(desc(knowledgeBases.updatedAt));
    return rows.map(serializeSummary);
  }

  async get(knowledgeBaseId: string, userId: string): Promise<KnowledgeBaseSummary | undefined> {
    const membership = this.db.select({ knowledgeBaseId: knowledgeBaseMembers.knowledgeBaseId })
      .from(knowledgeBaseMembers)
      .where(and(
        eq(knowledgeBaseMembers.knowledgeBaseId, knowledgeBaseId),
        eq(knowledgeBaseMembers.userId, userId),
      ));
    const [row] = await this.summaryQuery(and(
      eq(knowledgeBases.id, knowledgeBaseId),
      isNull(knowledgeBases.deletedAt),
      or(eq(knowledgeBases.userId, userId), sql`exists ${membership}`),
    ));
    return row ? serializeSummary(row) : undefined;
  }

  async update(
    knowledgeBaseId: string,
    userId: string,
    values: { name?: string; description?: string },
  ): Promise<KnowledgeBaseSummary | undefined> {
    const updates: Partial<typeof knowledgeBases.$inferInsert> = { updatedAt: new Date() };
    if (values.name !== undefined) updates.name = values.name;
    if (values.description !== undefined) updates.description = values.description;

    const [row] = await this.db.update(knowledgeBases)
      .set(updates)
      .where(and(
        eq(knowledgeBases.id, knowledgeBaseId),
        eq(knowledgeBases.userId, userId),
        isNull(knowledgeBases.deletedAt),
      ))
      .returning();
    return row ? emptySummary(row) : undefined;
  }

  async delete(knowledgeBaseId: string, userId: string): Promise<boolean> {
    const [row] = await this.db.update(knowledgeBases)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(knowledgeBases.id, knowledgeBaseId),
        eq(knowledgeBases.userId, userId),
        isNull(knowledgeBases.deletedAt),
      ))
      .returning({ id: knowledgeBases.id });
    return Boolean(row);
  }

  private summaryQuery(where: ReturnType<typeof and>) {
    return this.db.select(summarySelection)
      .from(knowledgeBases)
      .leftJoin(knowledgeBaseFiles, eq(knowledgeBaseFiles.knowledgeBaseId, knowledgeBases.id))
      .leftJoin(ragIndexes, and(
        eq(ragIndexes.userId, knowledgeBases.userId),
        eq(ragIndexes.fileId, knowledgeBaseFiles.fileId),
      ))
      .where(where)
      .groupBy(knowledgeBases.id);
  }
}

function emptySummary(row: typeof knowledgeBases.$inferSelect): KnowledgeBaseSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    file_count: 0,
    completed_count: 0,
    processing_count: 0,
    failed_count: 0,
    stale_count: 0,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function serializeSummary(row: SummaryRow): KnowledgeBaseSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    file_count: row.fileCount,
    completed_count: row.completedCount,
    processing_count: row.processingCount,
    failed_count: row.failedCount,
    stale_count: row.staleCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
