# 项目查询数据库规约

<meta>
  <document-id>bid-master-project-query-database</document-id>
  <version>0.1.0</version>
  <project>Bid Master Web</project>
  <type>Database Design Extension</type>
  <created>2026-07-09</created>
  <depends>project-query-sys.spec.md, ../pm/project-query-prd.md, ../../real/real.md, ../../cog/cog.md</depends>
</meta>

---

## 1. 数据库设计原则

项目查询功能新增数据必须遵循当前项目的数据管理方式：

- 真实 schema 源为 `src/backend/app/infrastructure/db_schema.py`。
- `src/db/schema.ts` 仅用于 TypeScript/Drizzle 对齐，不作为迁移入口。
- 所有用户数据必须带 `user_id`。
- 查询、更新、删除必须按当前登录用户隔离。
- MVP 只落地 `project_sources` 表；`project_leads` 作为 v1 预留设计。

---

## 2. 实体关系

```text
users
  │ 1:N
  ▼
project_sources
  │ 1:N（v1）
  ▼
project_leads
  │
  ├── linked_file_id       → files / tender_documents（后续实现时按真实表名对齐）
  └── linked_analysis_id   → analysis_results / extract/simulate/opening 结果（后续实现时按真实表名对齐）
```

MVP 阶段只实现：

```text
users 1:N project_sources
```

---

## 3. 表定义：project_sources

### 3.1 用途

`project_sources` 用于保存用户关注的招投标项目信息来源，例如公共资源交易平台、政府采购平台、企业采购平台、行业平台和第三方聚合平台。

### 3.2 字段定义

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PK | 信息源 ID，建议使用短 UUID 或现有 ID 生成规则 |
| user_id | VARCHAR(50) | NOT NULL | 所属用户 ID |
| name | VARCHAR(200) | NOT NULL | 信息源名称 |
| url | TEXT | NOT NULL | 外部链接地址，仅允许 http/https |
| category | VARCHAR(50) | NOT NULL DEFAULT 'other' | 分类 |
| region | VARCHAR(100) | DEFAULT '' | 地区，如全国、浙江省、杭州市 |
| tags | JSONB | DEFAULT '[]' | 标签数组，如建设工程、政府采购 |
| note | TEXT | DEFAULT '' | 备注 |
| is_favorite | BOOLEAN | NOT NULL DEFAULT false | 是否常用 |
| status | VARCHAR(20) | NOT NULL DEFAULT 'active' | 状态 |
| last_visited_at | TIMESTAMP | NULL | 最后访问时间 |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL DEFAULT now() | 更新时间 |

---

## 4. 字段枚举

### 4.1 category

| Value | Label | 说明 |
|-------|-------|------|
| public_resource | 公共资源交易平台 | 全国、省、市公共资源交易中心 |
| government_procurement | 政府采购 | 政府采购网、财政采购平台 |
| enterprise_procurement | 企业采购 | 国企、央企、集团采购平台 |
| industry | 行业平台 | 建设、交通、水利、能源等行业平台 |
| aggregator | 第三方聚合 | 招标信息聚合网站 |
| other | 其他 | 用户自定义来源 |

### 4.2 status

| Value | Label | 说明 |
|-------|-------|------|
| active | 正常 | 默认状态，可正常展示和访问 |
| inactive | 停用 | 用户主动停用，但不删除 |
| invalid | 疑似失效 | 用户手动标记失效，MVP 不自动探测 |

---

## 5. 索引设计

| Index Name | Columns | Purpose |
|------------|---------|---------|
| idx_project_sources_user | user_id | 用户数据隔离与列表查询 |
| idx_project_sources_user_category | user_id, category | 分类筛选 |
| idx_project_sources_user_region | user_id, region | 地区筛选 |
| idx_project_sources_user_favorite | user_id, is_favorite | 常用筛选 |
| idx_project_sources_user_updated | user_id, updated_at DESC | 默认排序 |

MVP 不强制创建全文索引；关键词搜索可先使用 `ILIKE` 覆盖 `name`、`url`、`region`、`note`。

---

## 6. 约束与校验

### 6.1 数据库层约束

| 约束 | 说明 |
|------|------|
| `name` 非空 | 防止无意义卡片 |
| `url` 非空 | 信息源必须可打开 |
| `user_id` 非空 | 保证用户隔离 |
| `status` 默认 active | 新增后默认可用 |
| `tags` 默认空数组 | 避免前端处理 null |

### 6.2 应用层校验

| 校验 | 说明 |
|------|------|
| URL 协议 | 只允许 `http://`、`https://` |
| 名称长度 | 建议不超过 200 字符 |
| 分类枚举 | 不在枚举内时使用 `other` 或返回 400 |
| 标签数量 | MVP 建议最多 10 个 |
| 备注长度 | 建议不超过 2000 字符 |

---

## 7. 用户隔离规则

所有 SQL 必须遵守以下模式：

```sql
-- 列表
SELECT * FROM project_sources
WHERE user_id = $1
ORDER BY is_favorite DESC, updated_at DESC;

-- 单条更新
UPDATE project_sources
SET ...
WHERE id = $1 AND user_id = $2;

-- 删除
DELETE FROM project_sources
WHERE id = $1 AND user_id = $2;
```

禁止只按 `id` 查询、更新或删除用户数据。

---

## 8. v1 预留表：project_leads

`project_leads` 用于保存具体项目线索。该表仅作为 v1 设计预留，MVP 不实现。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PK | 项目线索 ID |
| user_id | VARCHAR(50) | NOT NULL | 所属用户 ID |
| source_id | VARCHAR(50) | NULL | 来源信息源 ID |
| project_name | VARCHAR(300) | NOT NULL | 项目名称 |
| announcement_url | TEXT | NOT NULL | 公告链接 |
| region | VARCHAR(100) | DEFAULT '' | 地区 |
| stage | VARCHAR(50) | NOT NULL DEFAULT 'other' | 项目阶段 |
| status | VARCHAR(50) | NOT NULL DEFAULT 'watching' | 跟进状态 |
| deadline_at | TIMESTAMP | NULL | 截止时间 |
| note | TEXT | DEFAULT '' | 备注 |
| linked_file_id | VARCHAR(50) | NULL | 关联文件 ID |
| linked_analysis_id | VARCHAR(50) | NULL | 关联分析结果 ID |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL DEFAULT now() | 更新时间 |

---

## 9. 迁移实施要求

- 在 `db_schema.py` 中新增表创建语句和索引创建语句。
- 不新建 shell 脚本。
- 不把 `src/db/schema.ts` 当作数据库迁移源。
- 如需 TypeScript 类型同步，后续实现阶段再按现有项目约定补充。

---

## 10. 数据库验收标准

| ID | 标准 |
|----|------|
| DB-01 | 应用启动后 `project_sources` 表存在 |
| DB-02 | `user_id`、`name`、`url` 必填字段生效 |
| DB-03 | `tags` 默认为空数组 |
| DB-04 | 新增信息源默认 `status = active` |
| DB-05 | 按 `user_id` 查询只能返回当前用户数据 |
| DB-06 | 更新和删除必须同时匹配 `id` 与 `user_id` |
| DB-07 | v1 预留表不在 MVP 阶段创建，除非后续明确批准 |
