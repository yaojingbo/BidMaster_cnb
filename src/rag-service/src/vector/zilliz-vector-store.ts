import { HttpClient } from '@zilliz/milvus2-sdk-node';
import {
  MastraVector,
  type CreateIndexParams,
  type DeleteVectorParams,
  type DeleteVectorsParams,
  type DescribeIndexParams,
  type DeleteIndexParams,
  type IndexStats,
  type QueryResult,
  type QueryVectorParams,
  type UpdateVectorParams,
  type UpsertVectorParams,
  type VectorFilter,
} from '@mastra/core/vector';
import { MilvusFilterTranslator } from './milvus-filter-translator.js';

/** Mastra metric → Milvus metric */
const MASTRA_TO_MILVUS_METRIC: Record<string, string> = {
  cosine: 'COSINE',
  euclidean: 'L2',
  dotproduct: 'IP',
};

/** Milvus metric → Mastra metric */
const MILVUS_TO_MASTRA_METRIC: Record<string, IndexStats['metric']> = {
  COSINE: 'cosine',
  L2: 'euclidean',
  IP: 'dotproduct',
};

/** collection 的标量字段（用于检索输出与预过滤） */
const SCALAR_FIELDS = ['chunk_id', 'user_id', 'file_id', 'index_id', 'index_version', 'chunk_type', 'text'] as const;
const VECTOR_FIELD = 'vector';
const PK_FIELD = 'chunk_id';

export interface ZillizVectorStoreOptions {
  /** ZILLIZ_URI：Zilliz Cloud REST endpoint（https） */
  uri: string;
  /** ZILLIZ_USERNAME */
  username?: string;
  /** ZILLIZ_PASSWORD */
  password?: string;
  /** 备选：API Key token（与 username/password 二选一） */
  token?: string;
  /** 数据库名，默认 default */
  database?: string;
  /** MastraVector 的 id，默认 zilliz */
  id?: string;
}

/**
 * Zilliz Cloud（Milvus 兼容）向量存储适配器，实现 MastraVector 契约。
 *
 * 传输层固定使用 HttpClient（REST），原因见 specs/dev/zilliz-vector-store.spec.md §4.4：
 * 本项目 serverless Zilliz Cloud 仅暴露 REST，gRPC 19530 不可用。
 *
 * indexName 直接映射为 Milvus collection 名（版本化，见 spec §4.2）。
 * 注意：filter 字段名必须来自固定白名单，本类只接受 Mastra 的 VectorFilter（服务端组装）。
 */
export class ZillizVectorStore extends MastraVector {
  private readonly options: ZillizVectorStoreOptions;
  private readonly translator = new MilvusFilterTranslator();
  private clientCache: HttpClient | undefined;

  constructor(options: ZillizVectorStoreOptions) {
    super({ id: options.id ?? 'zilliz' });
    this.options = options;
  }

  /** 惰性连接：首次调用才建 HttpClient，避免服务启动因 Zilliz 不可用而失败 */
  private client(): HttpClient {
    if (!this.clientCache) {
      this.clientCache = new HttpClient({
        endpoint: this.options.uri,
        username: this.options.username,
        password: this.options.password,
        token: this.options.token,
        database: this.options.database ?? 'default',
      });
    }
    return this.clientCache;
  }

  async createIndex({ indexName, dimension, metric }: CreateIndexParams): Promise<void> {
    const milvusMetric = MASTRA_TO_MILVUS_METRIC[metric ?? 'cosine'];
    const has = await this.client().hasCollection({
      collectionName: indexName,
      dbName: this.options.database ?? 'default',
    });
    if (has.data?.has) {
      await this.validateExistingIndex(indexName, dimension, metric ?? 'cosine');
      return;
    }
    await this.client().createCollection({
      collectionName: indexName,
      schema: {
        autoID: false,
        enabledDynamicField: true,
        fields: [
          { fieldName: PK_FIELD, dataType: 'VarChar', isPrimary: true, elementTypeParams: { max_length: 64 } },
          { fieldName: VECTOR_FIELD, dataType: 'FloatVector', elementTypeParams: { dim: dimension } },
          { fieldName: 'user_id', dataType: 'VarChar', elementTypeParams: { max_length: 64 } },
          { fieldName: 'file_id', dataType: 'VarChar', elementTypeParams: { max_length: 64 } },
          { fieldName: 'index_id', dataType: 'VarChar', elementTypeParams: { max_length: 64 } },
          { fieldName: 'index_version', dataType: 'VarChar', elementTypeParams: { max_length: 64 } },
          { fieldName: 'chunk_type', dataType: 'VarChar', elementTypeParams: { max_length: 32 } },
          { fieldName: 'text', dataType: 'VarChar', elementTypeParams: { max_length: 8192 } },
        ],
      },
      indexParams: [
        { fieldName: VECTOR_FIELD, indexName: 'vector_idx', metricType: milvusMetric, params: { index_type: 'AUTOINDEX' } },
      ],
    });
    await this.client().loadCollection({ collectionName: indexName });
  }

  async upsert({ indexName, vectors, metadata, ids, deleteFilter }: UpsertVectorParams): Promise<string[]> {
    if (deleteFilter) {
      await this.client().delete({
        collectionName: indexName,
        filter: this.translator.translate(deleteFilter),
      });
    }
    const rows = vectors.map((vector, i) => {
      const row: Record<string, unknown> = {
        [VECTOR_FIELD]: vector,
        [PK_FIELD]: ids?.[i] ?? metadata?.[i]?.[PK_FIELD] ?? metadata?.[i]?.id ?? String(i),
      };
      const meta = metadata?.[i];
      if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) {
          if (key !== PK_FIELD && key !== 'id') row[key] = value;
        }
      }
      return row;
    });
    if (rows.length === 0) return [];
    await this.client().upsert({ collectionName: indexName, data: rows });
    return rows.map((row) => String(row[PK_FIELD]));
  }

  async query({ indexName, queryVector, topK, filter, includeVector }: QueryVectorParams<VectorFilter>): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new Error('ZillizVectorStore 仅支持向量检索，queryVector 不能为空');
    }
    const filterExpr = this.translator.translate(filter ?? null);
    const res = await this.client().search({
      collectionName: indexName,
      data: [queryVector],
      annsField: VECTOR_FIELD,
      limit: topK ?? 10,
      outputFields: [...SCALAR_FIELDS],
      ...(filterExpr ? { filter: filterExpr } : {}),
    });
    return mapSearchResults(res, includeVector ?? false);
  }

  async listIndexes(): Promise<string[]> {
    const res = await this.client().listCollections();
    if (!Array.isArray(res.data)) return [];
    return res.data.filter((name): name is string => typeof name === 'string');
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const describe = await this.client().describeCollection({ collectionName: indexName });
    const stats = await this.client().getCollectionStatistics({ collectionName: indexName });
    const dimension = readDimension(describe.data);
    const metric = readMetric(describe.data);
    return {
      dimension: dimension ?? 0,
      count: Number(stats.data?.rowCount ?? 0),
      metric,
    };
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    await this.client().dropCollection({ collectionName: indexName });
  }

  async updateVector({ indexName, update, ...rest }: UpdateVectorParams<VectorFilter>): Promise<void> {
    if ('filter' in rest && rest.filter) {
      throw new Error('ZillizVectorStore 暂不支持按 filter 批量更新向量');
    }
    const id = rest.id;
    if (!id) throw new Error('updateVector 需要 id');
    if (update.metadata) {
      throw new Error('ZillizVectorStore 暂不支持仅更新 metadata（Milvus REST 无 partial scalar update）');
    }
    if (!update.vector) throw new Error('updateVector 需要 vector');
    await this.client().upsert({
      collectionName: indexName,
      data: [{ [PK_FIELD]: id, [VECTOR_FIELD]: update.vector }],
    });
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    await this.client().delete({
      collectionName: indexName,
      filter: `${PK_FIELD} in [${formatStringList([id])}]`,
    });
  }

  async deleteVectors({ indexName, ids, filter }: DeleteVectorsParams<VectorFilter>): Promise<void> {
    const filterExpr = ids
      ? `${PK_FIELD} in [${formatStringList(ids)}]`
      : this.translator.translate(filter ?? null);
    if (!filterExpr) return;
    await this.client().delete({ collectionName: indexName, filter: filterExpr });
  }
}

function formatStringList(values: string[]): string {
  return values.map((value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ');
}

// 以下纯函数导出供单测（不依赖线上 Zilliz）

/** 把 REST search 响应映射为 Mastra QueryResult[]（导出供单测） */
export function mapSearchResults(res: unknown, includeVector: boolean): QueryResult[] {
  const data = (res as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const id = String(row[PK_FIELD] ?? row.id ?? '');
    const distance = row.distance;
    const score = typeof distance === 'number' ? distance : Number(distance ?? 0);
    const metadata: Record<string, unknown> = {};
    for (const field of SCALAR_FIELDS) {
      if (row[field] !== undefined && row[field] !== null) metadata[field] = row[field];
    }
    const result: QueryResult = { id, score, metadata };
    if (includeVector && Array.isArray(row[VECTOR_FIELD])) {
      result.vector = row[VECTOR_FIELD] as number[];
    }
    return result;
  });
}

/** 从 describeCollection 响应中防御性提取向量维度（无 any，窄化读取，导出供单测） */
export function readDimension(describeData: unknown): number | undefined {
  if (!describeData || typeof describeData !== 'object') return undefined;
  const fields = (describeData as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return undefined;
  for (const raw of fields) {
    if (!raw || typeof raw !== 'object') continue;
    const field = raw as Record<string, unknown>;
    const type = String(field.type ?? field.dataType ?? field.data_type ?? '');
    if (!type.toLowerCase().includes('vector')) continue;
    // Milvus REST：params 是 [{key, value}] 数组
    const params = field.params;
    if (Array.isArray(params)) {
      for (const entry of params) {
        if (!entry || typeof entry !== 'object') continue;
        const param = entry as Record<string, unknown>;
        if (param.key === 'dim') {
          const dim = readDimValue(param.value);
          if (dim !== undefined) return dim;
        }
      }
    }
    const etp = field.elementTypeParams as Record<string, unknown> | undefined;
    const dim = readDimValue(field.dim) ?? readDimValue(etp?.dim);
    if (dim !== undefined) return dim;
  }
  return undefined;
}

function readDimValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** 从 describeCollection 响应中防御性提取 metric（导出供单测） */
export function readMetric(describeData: unknown): IndexStats['metric'] {
  if (!describeData || typeof describeData !== 'object') return undefined;
  const indexes = (describeData as { indexes?: unknown }).indexes;
  if (!Array.isArray(indexes)) return undefined;
  for (const raw of indexes) {
    if (!raw || typeof raw !== 'object') continue;
    const index = raw as Record<string, unknown>;
    const fieldName = String(index.fieldName ?? index.field_name ?? '');
    if (fieldName !== VECTOR_FIELD) continue;
    const metricType = String(index.metricType ?? index.metric_type ?? '');
    return MILVUS_TO_MASTRA_METRIC[metricType];
  }
  return undefined;
}
