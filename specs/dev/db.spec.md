# Database Design Document: Bid Master Web

<meta>
  <document-id>bid-master-database-design</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>Database Design</type>
  <created>2026-05-10</created>
  <depends>real.md, cog.md</depends>
</meta>

---

## 1. Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│  tender_documents   │       │  ai_configurations  │
├─────────────────────┤       ├─────────────────────┤
│ id (PK, UUID)       │       │ id (PK, UUID)       │
│ name                │       │ provider            │
│ size                │       │ model               │
│ mime_type           │       │ is_active           │
│ category            │◄───────│ is_tested           │
│ status              │       └─────────────────────┘
│ encrypted_path      │               ▲
│ created_at          │               │
└─────────┬───────────┘               │
          │ 1:N                      │
          ▼                          │
┌─────────────────────┐               │
│  analysis_results   │               │
├─────────────────────┤               │
│ id (PK, UUID)       │               │
│ document_id (FK)    │───────────────┘
│ type                │
│ status              │
│ result (JSONB)      │
│ model               │
│ provider            │
│ error               │
└─────────┬───────────┘
          │ 1:N
          ▼
┌─────────────────────┐       ┌─────────────────────┐
│  extracted_elements │       │     statistics      │
├─────────────────────┤       ├─────────────────────┤
│ id (PK, UUID)       │       │ id (PK, UUID)       │
│ analysis_id (FK)    │       │ analysis_id (FK)    │
│ name                │       │ data (JSONB)        │
│ content             │       └─────────────────────┘
│ confidence          │
│ position (JSONB)     │
└─────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│   download_logs     │       │     audit_logs      │
├─────────────────────┤       ├─────────────────────┤
│ id (PK, UUID)       │       │ id (PK, UUID)       │
│ document_id (FK)    │       │ action              │
│ source              │       │ entity_type         │
│ ip_address          │       │ entity_id           │
│ created_at          │       │ details (JSONB)     │
└─────────────────────┘       │ ip_address          │
                              │ created_at          │
                              └─────────────────────┘
```

---

## 2. Table Definitions

### 2.1 tender_documents（招标文件表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| name | VARCHAR(500) | NOT NULL | 文件显示名称 |
| original_name | VARCHAR(500) | | 原始文件名 |
| size | INTEGER | NOT NULL | 文件大小（字节） |
| mime_type | VARCHAR(100) | NOT NULL | MIME 类型 |
| category | VARCHAR(50) | NOT NULL, DEFAULT 'tender' | 类别：tender/bid |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'uploading' | 状态 |
| encrypted_path | TEXT | NOT NULL | 加密文件路径 |
| encryption_key_id | VARCHAR(100) | | 加密密钥 ID |
| metadata | JSONB | | 元数据（上传者IP、提取状态等） |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT now() | 更新时间 |

**Indexes:**
- `idx_tender_documents_status` - 按状态查询
- `idx_tender_documents_created` - 按时间排序

### 2.2 analysis_results（分析结果表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| document_id | UUID | FK → tender_documents.id | 关联文件 |
| type | VARCHAR(50) | NOT NULL | 分析类型 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 状态 |
| result | JSONB | | 结构化结果 |
| model | VARCHAR(100) | | 使用的模型 |
| provider | VARCHAR(50) | | 供应商 |
| error | TEXT | | 错误信息 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT now() | 更新时间 |

**Indexes:**
- `idx_analysis_results_document` - 按文档查询
- `idx_analysis_results_type` - 按类型查询

### 2.3 ai_configurations（AI 配置表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| provider | VARCHAR(50) | NOT NULL, UNIQUE | 供应商名称 |
| model | VARCHAR(100) | NOT NULL | 模型名称 |
| api_key_ref | VARCHAR(200) | | API 密钥引用 |
| api_endpoint | VARCHAR(500) | | API 端点 |
| is_active | BOOLEAN | NOT NULL, DEFAULT false | 是否激活 |
| is_tested | BOOLEAN | NOT NULL, DEFAULT false | 是否测试过 |
| last_tested_at | TIMESTAMP | | 最后测试时间 |
| last_test_result | JSONB | | 测试结果 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT now() | 更新时间 |

**Indexes:**
- `uniq_ai_config_provider` - 唯一约束，同一时刻只能有一个活跃配置

### 2.4 extracted_elements（提取要素表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| analysis_id | UUID | FK → analysis_results.id | 关联分析结果 |
| name | VARCHAR(100) | NOT NULL | 要素名称 |
| content | TEXT | NOT NULL | 要素内容 |
| confidence | INTEGER | | 可信度 0-100 |
| position | JSONB | | 位置信息 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |

**Indexes:**
- `idx_extracted_elements_analysis` - 按分析结果查询
- `idx_extracted_elements_name` - 按要素名称查询

### 2.5 statistics（统计表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| analysis_id | UUID | FK → analysis_results.id | 关联分析结果 |
| data | JSONB | | 统计数据 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT now() | 更新时间 |

**Indexes:**
- `idx_statistics_analysis` - 按分析结果查询

### 2.6 download_logs（下载日志表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| document_id | UUID | FK → tender_documents.id | 关联文件 |
| source | VARCHAR(20) | NOT NULL, DEFAULT 'web' | 下载来源 |
| ip_address | VARCHAR(50) | | 下载者 IP |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |

**Indexes:**
- `idx_download_logs_document` - 按文件查询
- `idx_download_logs_created` - 按时间查询

### 2.7 system_configurations（系统配置表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| key | VARCHAR(100) | NOT NULL, UNIQUE | 配置键 |
| value | TEXT | | 配置值 |
| description | VARCHAR(500) | | 配置描述 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT now() | 更新时间 |

### 2.8 audit_logs（审计日志表）

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT random() | 主键 |
| action | VARCHAR(100) | NOT NULL | 操作类型 |
| entity_type | VARCHAR(50) | NOT NULL | 实体类型 |
| entity_id | UUID | | 实体 ID |
| details | JSONB | | 操作详情 |
| ip_address | VARCHAR(50) | | 操作者 IP |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() | 创建时间 |

**Indexes:**
- `idx_audit_logs_entity` - 按实体查询
- `idx_audit_logs_created` - 按时间查询

---

## 3. Index Strategy

### 3.1 Index Overview

| Table | Index Name | Columns | Type | Purpose |
|-------|------------|---------|------|---------|
| tender_documents | idx_tender_documents_status | status | B-tree | 状态筛选 |
| tender_documents | idx_tender_documents_created | created_at | B-tree | 时间排序 |
| analysis_results | idx_analysis_results_document | document_id | B-tree | 关联查询 |
| analysis_results | idx_analysis_results_type | type | B-tree | 类型筛选 |
| ai_configurations | uniq_ai_config_provider | provider | Unique | 唯一约束 |
| extracted_elements | idx_extracted_elements_analysis | analysis_id | B-tree | 关联查询 |
| extracted_elements | idx_extracted_elements_name | name | B-tree | 名称筛选 |
| statistics | idx_statistics_analysis | analysis_id | B-tree | 关联查询 |
| download_logs | idx_download_logs_document | document_id | B-tree | 关联查询 |
| download_logs | idx_download_logs_created | created_at | B-tree | 时间查询 |
| audit_logs | idx_audit_logs_entity | entity_type, entity_id | B-tree | 实体查询 |
| audit_logs | idx_audit_logs_created | created_at | B-tree | 时间查询 |

### 3.2 Index Design Rationale

1. **B-tree 索引**：用于等值查询和范围查询（如 status = 'ready', created_at > '2025-01-01'）
2. **Unique 索引**：用于强制唯一约束（如 ai_configurations.provider）
3. **复合索引**：audit_logs 使用复合索引支持联合查询

---

## 4. Constraint Documentation

### 4.1 From real.md Constraints

| Constraint | Implementation |
|------------|----------------|
| 文件加密存储 | `encrypted_path` 字段存储加密文件路径，文件内容在存储前加密 |
| 统计分析服务端完成 | `statistics.data` JSONB 存储计算结果，前端仅展示 |
| API 密钥环境变量 | `api_key_ref` 仅存储引用，实际密钥在环境变量中 |

### 4.2 Business Rules

1. **文件删除**：分析结果随文件级联删除（`onDelete: 'cascade'`）
2. **唯一活跃配置**：同一时刻只能有一个活跃的 AI 配置
3. **审计追踪**：敏感操作记录到 audit_logs

### 4.3 Data Validation

| Field | Validation Rule |
|-------|----------------|
| size | 正整数，最大 50MB |
| mime_type | 仅允许 PDF、Markdown、Word、Excel、CSV |
| category | 仅允许 'tender' 或 'bid' |
| confidence | 0-100 整数 |
| status | 枚举值：pending, processing, done, failed |

---

## 5. Migration Plan

### 5.1 Drizzle ORM Commands

```bash
# 生成迁移文件
bunx drizzle-kit generate

# 应用迁移
bunx drizzle-kit migrate

# 查看数据库（开发环境）
bunx drizzle-kit studio
```

### 5.2 Migration File Location

迁移文件将生成在 `./drizzle/` 目录下：

```
drizzle/
├── 0000_<timestamp>_initial_migration.sql
└── meta/
    └── _journal.json
```

### 5.3 Rollback Strategy

Drizzle 支持向下迁移：

```bash
# 回滚上一次迁移
bunx drizzle-kit rollback
```

---

## 6. Security Considerations

### 6.1 Primary Key Selection

- **Public-facing 资源**（tender_documents, analysis_results）：使用 UUID 防止枚举攻击
- **Internal 资源**（audit_logs, system_configurations）：可考虑使用 SERIAL，但当前也使用 UUID 保持一致性

### 6.2 Sensitive Data

| Data | Protection Method |
|------|-------------------|
| 文件内容 | Fernet 加密存储在 `encrypted_path` |
| AI API Keys | 环境变量，不存储在数据库 |
| 下载者 IP | 下载日志记录（需符合隐私法规） |

### 6.3 Index Security Note

> **重要**：不能依赖 UUID 的不可预测性作为权限控制机制。所有公开 API 必须有明确的权限验证逻辑。

---

## 7. Quality Checklist

- [x] 所有 cog.md 中的实体都有对应的表
- [x] 关系通过外键正确建立（references）
- [x] 索引覆盖常见查询模式
- [x] real.md 中的约束已实现
- [x] 命名规范一致（snake_case）
- [x] JSONB 用于需要灵活结构的场景
- [x] 类型导出完整
- [x] Zod 验证与 schema 对应
- [x] 公开 API 使用 UUID 主键
- [x] 敏感数据加密处理

---

**文档版本：** v1.0.0
**创建日期：** 2026-05-10
**维护者：** Bid Master Team