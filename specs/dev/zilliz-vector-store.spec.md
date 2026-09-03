# ZillizVectorStore 适配器设计规约：MastraVector → Milvus/Zilliz Cloud

<meta>
  <document-id>bid-master-zilliz-vector-store-spec</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>Zilliz/Milvus MastraVector Adapter Design Specification</type>
  <status>proposed</status>
  <created>2026-09-02</created>
  <updated>2026-09-02</updated>
  <depends>rag.spec.md, adr-rag-service-boundary.md, sys.spec.md, db.spec.md</depends>
</meta>

---

## 1. 文档状态与目标

本文定义 `ZillizVectorStore`（实现 Mastra `MastraVector` 契约的 Milvus/Zilliz Cloud 适配器）的落地设计，是 `rag.spec.md` §8.2「Mastra 接入」与 §10.9「Zilliz collection 模式」的细化实现方案。

`rag.spec.md` 已确定方向：

> 自定义 `ZillizVectorStore` 实现项目锁定版本的 `MastraVector`，并作为 `vectorStore` 实例直接传入 `createVectorQueryTool`。

本文不重复 `rag.spec.md` 的产品与架构决策，只回答「适配器怎么实现、怎么接入、有什么待拍板点」。实现权威（`rag.spec.md` §1.3.6）是**项目 lockfile 锁定的实际包版本 + 对应 TypeScript 类型定义**，本文所有契约均已对照 `src/rag-service/node_modules` 下已安装版本逐一核实，结论记录在第 3 节。

### 1.1 已核实版本基线

| 包 | 锁定版本 | 核实来源 |
|----|---------|---------|
| `@mastra/core` | 1.59.0 | `src/rag-service/node_modules/@mastra/core/dist/vector/` |
| `@mastra/rag` | 2.5.0 | `src/rag-service/node_modules/@mastra/rag/dist/` |
| `@zilliz/milvus2-sdk-node` | 3.0.4 | `src/rag-service/node_modules/@zilliz/milvus2-sdk-node/dist/` |

> 版本升级必须重跑适配器契约测试（`rag.spec.md` §8.2.4），不兼容则阻止升级或同步改适配器。

---

## 2. 现状与差距

当前 `src/rag-service` 存在一处与目标方向不一致的临时实现，本方案落地前必须厘清：

- `src/vector-store.ts` 定义了一个**手写最小接口** `VectorStore`（仅 `search()`），并有 `InMemoryVectorStore` 占位实现。
- `src/server.ts` 当前注入的是 `new InMemoryVectorStore()`。
- `@mastra/rag` 已安装但**尚未被任何源码引用**，`createVectorQueryTool` 尚未接线。

`rag.spec.md` 末尾已明确：**不得继续维护以 PostgreSQL 向量列为目标的 `VectorStore` 实现**。因此 `ZillizVectorStore` 是 `MastraVector` 的实现，与旧 `VectorStore` 接口无继承关系；旧 `VectorStore` 接口与 `InMemoryVectorStore` 在接线完成后删除（删除时机列入第 9 节决策点）。

> 关键提醒：仅实现 `ZillizVectorStore` 并不等于「RAG 已用上 Milvus」。适配器必须有一个消费者——`createVectorQueryTool`（语义召回），其余链路（Neon 关键词补召回、RRF、Neon 二次授权）在 `rag.spec.md` §12.2 由 `RagRetriever` 编排，不在本适配器范围内。本文第 6 节只描述适配器与 `createVectorQueryTool` 的接入契约。

---

## 3. 已核实的契约（实现权威）

### 3.1 `MastraVector` 抽象类

来源：`@mastra/core@1.59.0` `dist/vector/vector.d.ts` 与 `dist/vector/types.d.ts`。

```ts
export declare abstract class MastraVector<Filter = VectorFilter> extends MastraBase {
  id: string;
  disableInit: boolean;
  constructor({ id, disableInit }: { id: string; disableInit?: boolean });
  get indexSeparator(): string;                       // 默认返回 "_"
  abstract query(params: QueryVectorParams<Filter>): Promise<QueryResult[]>;
  abstract upsert(params: UpsertVectorParams): Promise<string[]>;
  abstract createIndex(params: CreateIndexParams): Promise<void>;
  abstract listIndexes(): Promise<string[]>;
  abstract describeIndex(params: DescribeIndexParams): Promise<IndexStats>;
  abstract deleteIndex(params: DeleteIndexParams): Promise<void>;
  abstract updateVector(params: UpdateVectorParams<Filter>): Promise<void>;
  abstract deleteVector(params: DeleteVectorParams): Promise<void>;
  abstract deleteVectors(params: DeleteVectorsParams<Filter>): Promise<void>;
  protected validateExistingIndex(indexName: string, dimension: number, metric: string): Promise<void>;
}
```

实现约束：

1. 构造函数必须调用 `super({ id, disableInit })`；`id` 必须是非空字符串（基类会抛 `VECTOR_INVALID_ID`）。
2. 9 个抽象方法**缺一不可**，否则 TS 编译不过（这正是 `rag.spec.md` §8.2.3「禁止用 `any`/不安全断言掩盖不兼容」的意义）。
3. `indexSeparator` 可覆写；Mastra 用它把 `indexName` 映射为后端索引名。本适配器 `indexName` 直接等于 Milvus collection 名（见 §4.2），保持默认 `"_"` 即可，无需覆写。

关键类型（`dist/vector/types.d.ts`）：

```ts
interface QueryResult { id: string; score: number; metadata?: Record<string, any>; vector?: number[]; document?: string; }
interface IndexStats { dimension: number; count: number; metric?: 'cosine' | 'euclidean' | 'dotproduct'; }
interface UpsertVectorParams<Filter> {
  indexName: string; vectors: number[][]; metadata?: Record<string, any>[]; ids?: string[];
  sparseVectors?: SparseVector[]; deleteFilter?: Filter;   // deleteFilter：先删后插，用于整篇替换
}
interface CreateIndexParams { indexName: string; dimension: number; metric?: 'cosine' | 'euclidean' | 'dotproduct'; }
interface QueryVectorParams<Filter> {
  indexName: string; queryVector?: number[]; topK?: number; filter?: Filter;
  includeVector?: boolean; sparseVector?: SparseVector;
}
interface DescribeIndexParams { indexName: string; }
interface DeleteIndexParams { indexName: string; }
// UpdateVectorParams：判别联合，id 与 filter 互斥
type UpdateVectorParams<Filter> = { indexName; id: string; filter?: never; update: { vector?; metadata? } }
  | { indexName; id?: never; filter: Filter; update: { vector?; metadata? } };
interface DeleteVectorParams { indexName: string; id: string; }
interface DeleteVectorsParams<Filter> { indexName: string; ids?: string[]; filter?: Filter; }
```

### 3.2 `createVectorQueryTool` 签名

来源：`@mastra/rag@2.5.0` `dist/tools/vector-query.d.ts` 与 `dist/tools/types.d.ts`。

```ts
type VectorQueryToolOptions = {
  id?: string; description?: string;
  indexName: string;                       // = 本适配器的 collection 名
  model: MastraEmbeddingModel<string>;     // 工具内部负责把 queryText 转成 queryVector
  enableFilter?: boolean;                  // 开启后在工具 schema 中暴露 filter 入参
  includeVectors?: boolean;                // 默认 false
  includeSources?: boolean;                // 默认 true
  reranker?: RerankConfig;
  databaseConfig?: DatabaseConfig;
} & ProviderOptions & ({ vectorStoreName: string } | { vectorStoreName?: string; vectorStore: MastraVector | VectorStoreResolver });
```

接入要点（均从 `dist/index.js` 反查确认）：

1. 直接实例方式 `vectorStore: new ZillizVectorStore(config)`，不传 `vectorStoreName`。
2. 未传 `vectorStoreName` 时，工具内部 `storeName` 兜底为 `"DirectVectorStore"`，tool id 兜底为 `VectorQuery ${storeName} ${indexName} Tool`。
3. 工具运行时会校验 `vectorStore` 是否为合法的 `MastraVector` 实例；不合法则回退 `mastra.getVector(vectorStoreName)`（本方案无注册名，故校验必须通过）。
4. `model` 必须是 `MastraEmbeddingModel`（AI SDK 嵌入模型）。与当前 DashScope HTTP 嵌入的桥接见第 7 节。

### 3.3 `VectorFilter` 与 `BaseFilterTranslator`

来源：`@mastra/core@1.59.0` `dist/vector/filter/base.d.ts`。

Mastra 的 `filter` 是 MongoDB 风格操作符：`$eq/$ne/$gt/$gte/$lt/$lte/$in/$nin/$all/$exists/$regex/$elemMatch` 与逻辑 `$and/$or/$not/$nor`。Mastra 提供抽象基类 `BaseFilterTranslator<Filter, Result>`（含 `validateFilter`、`isOperator` 等工具方法），适配器可继承它实现 `translate(filter): Result`。本适配器的 `Result` 是 Milvus 布尔表达式字符串（见 §6.2）。

### 3.4 `@zilliz/milvus2-sdk-node` API

来源：`@zilliz/milvus2-sdk-node@3.0.4` `dist/milvus/*`。

两个客户端：

- `MilvusClient`（gRPC，继承 `GRPCClient`）：构造 `(configOrAddress: ClientConfig | string, ssl?, username?, password?, channelOptions?)`。
- `HttpClient`（REST）：同样提供 `insert/upsert/search/delete/createIndex/dropIndex/describeCollection/listCollections/hasCollection/getCollectionStatistics/loadCollection/releaseCollection`。

本适配器用到的方法（gRPC 客户端）：

| 能力 | SDK 方法 | 关键入参（`dist/milvus/types/*`） |
|------|---------|-----------------------------------|
| 建集合 | `createCollection` | `CreateColReq { collection_name, dimension, primary_field_name, id_type, vector_field_name, metric_type, auto_id }` 或 `CreateCollectionReq { fields: FieldType[] }` |
| 集合存在 | `hasCollection({ collection_name })` | → `BoolResponse.value` |
| 描述集合 | `describeCollection({ collection_name })` | → `DescribeCollectionResponse.schema.fields[]`（含 `type_params.dim`/`max_length`） |
| 统计实体数 | `getCollectionStatistics({ collection_name })` | → `StatisticsResponse.data.row_count` |
| 列表集合 | `listCollections({ collection_names? })` | → `ShowCollectionsResponse.data[]` |
| 加载/释放 | `loadCollection` / `releaseCollection` | `{ collection_name }` |
| 删集合 | `dropCollection({ collection_name })` | |
| 建索引 | `createIndex({ collection_name, field_name, index_type, metric_type, index_name })` | `IndexType.AUTOINDEX` 等 |
| 插/改 | `insert` / `upsert` | `{ collection_name, data: RowData[] }`；`UpsertReq` 支持 `partial_update?: boolean`、`field_ops?: FieldPartialUpdateOp[]` |
| 删 | `delete` | `DeleteByIdsReq { ids: string[] }` 或 `DeleteByFilterReq { filter: string }` |
| 检索 | `search` | `SearchSimpleReq { collection_name, data, limit, filter, anns_field, output_fields, metric_type }` → `SearchResultData { score, id, ...output }` |
| 切换库 | `use({ db_name })` | 多库隔离 |

枚举（`dist/milvus/const/milvus.d.ts`）：

- `MetricType`: `L2 = "L2"`, `IP = "IP"`, `COSINE = "COSINE"`（默认 `COSINE`）。
- `IndexType`: `AUTOINDEX = "AUTOINDEX"`, `HNSW = "HNSW"`, `IVF_FLAT = "IVF_FLAT"` 等。
- `DataType`: 含 `VarChar`、`FloatVector`、`Int64`、`JSON`。

字段定义 `FieldType`（`dist/milvus/types/Collection.d.ts`）：

```ts
type FieldType = {
  name: string; data_type: DataType | keyof typeof DataTypeMap;
  is_primary_key?: boolean; autoID?: boolean;
  type_params?: Partial<Record<'dim' | 'max_length' | ..., any>>;
  ...
};
```

---

## 4. 总体设计

### 4.1 适配器类

```ts
// src/rag-service/src/vector/zilliz-vector-store.ts（建议路径）
export class ZillizVectorStore extends MastraVector {
  constructor(config: ZillizServerOnlyConfig) {
    super({ id: config.id ?? 'zilliz' });
    // 惰性连接：构造不建连，首次方法调用时 connect + use(db_name)
  }
  // 实现 9 个抽象方法 + MilvusFilterTranslator
}
```

设计原则：

1. **惰性连接**：构造阶段不建 gRPC 连接，避免 RAG 服务启动时因 Zilliz 不可用而失败（对齐 `adr-rag-service-boundary.md` §5 故障隔离）。首次调用时 `connect`。
2. **`serverOnlyConfig` 只在服务端读**（`rag.spec.md` §8.2.5）：`ZILLIZ_URI`/`ZILLIZ_TOKEN` 等不得进入浏览器 bundle，也不写入 Neon 或 outbox 载荷。
3. **单一 collection = 单一 `indexName`**：本适配器不维护 indexName→collection 的多级映射（`indexSeparator` 保持默认 `"_"`，indexName 直接用 collection 名）。
4. **适配器不承担授权**：`query` 只做预过滤，`user_id`/`file_id`/`index_version` 由上层注入 `filter`；最终授权仍在 Neon（`rag.spec.md` §8.4）。

### 4.2 `indexName` ↔ collection 映射与版本化

`rag.spec.md` §8.3 要求「collection 名称必须版本化」，§10.9 又把 `index_version` 作为 collection 内的过滤字段。二者分层：

| 层 | 触发条件 | 动作 |
|----|---------|------|
| 物理层（collection 名） | 模型、维度、metric 变化（体现为 `RAG_INDEX_VERSION` 提升） | 新建 collection，旧 collection 保留至重建完成 |
| 逻辑层（`index_version` 字段） | 同模型/维度下的重建、重新索引 | 在**同一 collection 内**先写新 `index_version` 向量，再删旧 `index_version`，原子切换 |

**collection 命名（已定）**：`{RAG_VECTOR_COLLECTION}_{RAG_INDEX_VERSION}`，例如 `bidmaster_rag_chunks_v3-qwen3-vl-embedding`。维度与 metric 在建集合时由 `RAG_EMBEDDING_DIMENSION` 校验，不重复编入名；换模型/维度即提升 `RAG_INDEX_VERSION` 主版本建新集合。

`createVectorQueryTool({ indexName })` 的 `indexName` 就是物理 collection 名。查询时 `filter` 里携带 `index_version`、`user_id`、允许的 `file_id` 做预过滤。

### 4.3 Collection Schema（物理）

对齐 `rag.spec.md` §8.3、§10.9 与 `config.ts`：

| 字段 | 类型 | 主键/索引 | 说明 |
|------|------|----------|------|
| `chunk_id` | `VarChar`（max_length 64） | 主键 | = Neon `rag_chunks.id` 的 UUID 字符串 |
| `vector` | `FloatVector`（dim = `RAG_EMBEDDING_DIMENSION`） | AUTOINDEX / COSINE | 与当前索引版本严格同维 |
| `user_id` | `VarChar`（max_length 64） | 标量 | 候选预过滤，非最终授权证据 |
| `file_id` | `VarChar`（max_length 64） | 标量 | 预过滤 |
| `index_id` | `VarChar`（max_length 64） | 标量 | 预过滤 |
| `index_version` | `VarChar`（max_length 64） | 标量 | 逻辑版本过滤 |
| `chunk_type` | `VarChar`（max_length 32） | 标量 | 低敏感检索字段（可选） |

禁止：完整 chunk 正文、文件大段上下文、业务状态唯一副本、凭据（`rag.spec.md` §8.3）。

### 4.4 传输层：REST（HttpClient）

冒烟结论（2026-09-03）：本项目 Zilliz Cloud **serverless 集群仅暴露 REST（HTTPS）**，gRPC `19530` 端口 TLS 握手失败（`SSL_ERROR_SYSCALL`）。因此适配器**固定使用 `HttpClient`（REST）**，不启用 gRPC `MilvusClient`。

`HttpClient` 构造：`new HttpClient({ endpoint, username, password })`（或 `token`）。注意 HTTP API 与 gRPC 接口形状不同：

- `createCollection({ collectionName, schema: { fields }, indexParams })`，字段 `dataType` 用字符串（`VarChar`/`FloatVector`），向量维度在 `elementTypeParams.dim`，varchar 长度在 `elementTypeParams.max_length`。
- `insert/upsert({ collectionName, data: [{ ...字段 }] })`。
- `search({ collectionName, data: [向量], annsField, limit, outputFields, filter })`。
- `delete({ collectionName, filter })`——**HTTP delete 只有 `filter`，没有 `ids`**，按 ID 删除需转成 `chunk_id in ["..."]` 表达式。

---

## 5. 9 个方法 → Milvus 映射

| MastraVector 方法 | Milvus 实现要点 | 返回值转换 |
|------------------|----------------|-----------|
| `createIndex({ indexName, dimension, metric })` | `hasCollection` → 不存在则 `createCollection`（含 schema + `createIndex` + `loadCollection`）；存在则复用基类 `validateExistingIndex` 校验维度 | `void` |
| `upsert({ indexName, vectors, metadata, ids, deleteFilter })` | 逐条映射 `ids[i]`→`chunk_id`、`vectors[i]`→`vector`、`metadata[i]`→标量字段；有 `deleteFilter` 先 `delete({filter})`；再 `upsert({ data })` | `ids`（字符串数组） |
| `query({ indexName, queryVector, topK, filter, includeVector })` | `search({ collection_name: indexName, data: [queryVector], limit: topK, filter: 翻译(filter), output_fields: ['chunk_id','user_id','file_id','index_id','index_version','chunk_type'], anns_field: 'vector', metric_type: 'COSINE' })` | `QueryResult[] { id: chunk_id, score, metadata }` |
| `listIndexes()` | `listCollections({ collection_names: [前缀] })` 过滤本服务前缀 | `string[]`（collection 名） |
| `describeIndex({ indexName })` | `describeCollection` 取 vector 字段 `type_params.dim` + 索引 metric；`getCollectionStatistics` 取 `row_count` | `IndexStats { dimension, count, metric }` |
| `deleteIndex({ indexName })` | `dropCollection({ collection_name })`（危险操作，调用方需确认） | `void` |
| `updateVector({ indexName, id, update })` | `upsert({ collection_name, data: [{ chunk_id: id, vector? , ...scalars? }], partial_update: true })` | `void` |
| `deleteVector({ indexName, id })` | `delete({ collection_name, ids: [id] })` | `void` |
| `deleteVectors({ indexName, ids?, filter? })` | `ids` → `delete({ ids })`；`filter` → `delete({ filter: 翻译(filter) })` | `void` |

要点：

1. **`updateVector` 走 Milvus partial upsert**：SDK `UpsertReq.partial_update: true` 支持只更新部分标量/向量字段，避免「删后重插」的读放大。
2. **`upsert` 返回 id 顺序**：Milvus `MutationResult.IDs` 的 `str_id` 是主键值，与入参 `ids` 一致；适配器返回入参 `ids`（或从结果回读），保证幂等键稳定。
3. **score 语义**：COSINE 下 Milvus 返回相似度（越大越相关），与 Mastra `QueryResult.score`（越大越相关）同向，直接透传，不做归一化。融合与归一化在应用层 RRF（`rag.spec.md` §12.2.9），不在适配器。
4. **`deleteFilter` 原子性**：Milvus 不支持跨 delete+insert 的分布式事务；「先删后插」可能短暂暴露窗口。本方案依赖 Neon 二次授权兜底陈旧向量（`rag.spec.md` §8.5.3），不追求跨库原子。

---

## 6. Filter 翻译器

### 6.1 类

```ts
export class MilvusFilterTranslator extends BaseFilterTranslator<VectorFilter, string> {
  translate(filter: VectorFilter): string;   // → Milvus 布尔表达式
}
```

### 6.2 操作符映射表

| Mastra（MongoDB 风格） | Milvus 布尔表达式 |
|----------------------|------------------|
| `{ user_id: "u1" }`（等值简写） | `user_id == "u1"` |
| `{ $eq: ... }` | `==` |
| `{ $ne: ... }` | `!=` |
| `{ $gt/$gte/$lt/$lte }` | `>` / `>=` / `<` / `<=` |
| `{ $in: [...] }` | `in [...]` |
| `{ $nin: [...] }` | `not in [...]` |
| `{ $and: [...] }` | `expr1 && expr2`（或 `and`） |
| `{ $or: [...] }` | `expr1 || expr2`（或 `or`） |

字符串字面量需转义并加双引号；数字直接拼接。`$not/$nor/$exists/$regex/$elemMatch` 首期不支持——遇到时 `translate` 抛 `MastraError`（`VECTOR_FILTER_UNSUPPORTED`），不静默降级（对齐 `rag.spec.md` §8.4.7「不静默退化」）。

### 6.3 预过滤模板

`query` 与 `deleteVectors` 的 `filter` 由上层拼好传入，典型形如：

```text
user_id == "u_xxx" && index_version == "v3-qwen3-vl-embedding" && file_id in ["f1","f2","f3"]
```

翻译结果注入 `SearchSimpleReq.filter` / `DeleteByFilterReq.filter`。`createVectorQueryTool` 仅在 `enableFilter: true` 时向 LLM 暴露 `filter` 入参；本方案语义召回的 `filter` 由服务端 `RagRetriever` 组装注入，不依赖 LLM 生成。

---

## 7. Embedding 模型接入（`createVectorQueryTool.model`）

`createVectorQueryTool` 内部负责把 `queryText` 转成 `queryVector`，故其 `model` 必须是 `MastraEmbeddingModel`。固定模型为阿里云百炼 DashScope `text-embedding-v4`（维度 1024，已实测）。

**方案 A（`@ai-sdk/openai` 直指 DashScope）已否决**：`@ai-sdk/openai@4.0.43` 产出 spec v4（`specificationVersion:'v4'`），而 `@mastra/core@1.59.0` 的 `MastraEmbeddingModel` 只支持 spec v1/v2/v3，类型不兼容（`TS2322`）。

**方案 B（已采用）**：实现自定义 spec v1 `MastraEmbeddingModel`，内部复用 `embedTexts`（DashScope OpenAI 兼容 `/embeddings`，已实测连通）：

```ts
// src/rag-service/src/embedding-model.ts
export function createEmbeddingModel(config: RagConfig): MastraEmbeddingModel<string> {
  return {
    specificationVersion: 'v1',
    provider: 'dashscope',
    modelId: config.RAG_EMBEDDING_MODEL,   // text-embedding-v4
    maxEmbeddingsPerCall: 10,
    supportsParallelCalls: true,
    doEmbed: async ({ values }) => ({ embeddings: await embedTexts(values, config), usage: { tokens: 0 } }),
  };
}
```

> 冒烟门禁已满足：`text-embedding-v4` 真实返回维度 1024，与 `RAG_EMBEDDING_DIMENSION` 一致（见任务文件「冒烟测试结果」）。

---

## 8. 配置与凭据

`src/config.ts` 已预留字段，本方案对齐并做一处统一：

| 配置项 | 现状 | 本方案 |
|--------|------|--------|
| 地址 | `ZILLIZ_ADDRESS` | 统一为 `ZILLIZ_URI`（`rag.spec.md` §8.2.5 用词），兼容旧键名 |
| 令牌 | `ZILLIZ_TOKEN` | 保留 |
| collection | `RAG_VECTOR_COLLECTION`（默认 `bidmaster_rag_chunks`） | 保留，作为物理 collection 名前缀/基础 |
| 维度 | `RAG_EMBEDDING_DIMENSION` | 保留，建集合与检索前强制校验 |
| 版本 | `RAG_INDEX_VERSION`（默认 `v3-qwen3-vl-embedding`） | 保留，作为逻辑 `index_version` 过滤字段 |
| 传输/库 | 无 | 新增 `ZILLIZ_TRANSPORT`（`grpc`/`rest`）、`ZILLIZ_DB_NAME`（默认 `default`）、`ZILLIZ_SSL` |

凭据只经 `loadConfig()` 服务端读取，不得进入 Neon、outbox 载荷或任何日志（`rag.spec.md` §8.3）。

---

## 9. 决策状态

| # | 决策点 | 状态 | 结论 |
|---|--------|------|------|
| 1 | 传输层 | ✅ 已定（冒烟后修正） | 服务端 Zilliz Cloud 仅暴露 REST；适配器用 `HttpClient`，不用 gRPC |
| 2 | 配置键统一为 `ZILLIZ_URI` | ✅ 已定 | 统一 `ZILLIZ_URI`，兼容旧键 `ZILLIZ_ADDRESS` |
| 3 | 旧 `VectorStore`/`InMemoryVectorStore` 删除时机 | ✅ 已定 | 契约测试 + 接入冒烟通过后删除，此前保留作 `server.ts` 兜底 |
| 4 | Embedding 桥接方案（A：`@ai-sdk/openai` 指百炼；B：自定义 `MastraEmbeddingModel`） | ⏳ 待冒烟 | 先按方案 A 冒烟，验证 `qwen3-vl-embedding` 经 OpenAI 兼容端点的真实返回维度 |
| 5 | collection 命名格式 | ✅ 已定 | `{RAG_VECTOR_COLLECTION}_{RAG_INDEX_VERSION}`，例 `bidmaster_rag_chunks_v3-qwen3-vl-embedding` |

---

## 10. 验证门禁与测试

对齐 `rag.spec.md` §8.2 门禁 + §7.4 冒烟：

1. **契约测试**：`ZillizVectorStore` 通过 `implements`/`extends MastraVector` 编译期校验，无 `any`、无 `as unknown as MastraVector` 旁路。
2. **Filter 翻译器单测**：覆盖 §6.2 全操作符 + 转义 + 不支持操作符抛错。
3. **Embedding 冒烟**：真实调用 `qwen3-vl-embedding`，记录模型、地域、返回维度、时间，与 `RAG_EMBEDDING_DIMENSION` 一致后才建 collection。
4. **Zilliz 最小冒烟**：建集合 → upsert N 条 → query 预过滤 → describeIndex 维度/计数 → deleteVectors → drop，验证幂等（同 `chunk_id` 重复 upsert 覆盖）。
5. **接入冒烟**：`createVectorQueryTool({ vectorStore, indexName, model })` 全链路跑通一次语义召回。
6. **升级门禁**：Mastra 升级后重跑 1–5。

---

## 11. 参考

- `rag.spec.md` §7.4（维度确认）、§8.2（Mastra 接入）、§8.3（collection 边界）、§10.9（collection 模式）、§12.2（检索流程）
- `adr-rag-service-boundary.md`（服务边界与故障隔离）
- 类型权威：`src/rag-service/node_modules/@mastra/core/dist/vector/`、`@mastra/rag/dist/tools/`、`@zilliz/milvus2-sdk-node/dist/milvus/`
