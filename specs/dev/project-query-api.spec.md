# 项目查询 API 规约

<meta>
  <document-id>bid-master-project-query-api</document-id>
  <version>0.1.0</version>
  <project>Bid Master Web</project>
  <type>API Design Extension</type>
  <created>2026-07-09</created>
  <depends>project-query-sys.spec.md, project-query-db.spec.md, ../pm/project-query-prd.md, ../../real/real.md</depends>
</meta>

---

## 1. API 设计原则

项目查询 API 归属于数据管理能力，路径统一放在 `/api/data/project-sources` 下。

设计原则：

- 所有接口必须鉴权。
- 所有接口只能访问当前用户的数据。
- 请求和响应使用 JSON。
- 错误信息使用中文，可直接展示给前端用户。
- URL 只允许 `http://` 和 `https://` 协议。
- MVP 只实现信息源 API，不实现项目线索 API。

---

## 2. 鉴权与用户隔离

所有接口必须复用现有模式：

```python
current_user: dict = Depends(get_current_user)
```

所有 storage 调用必须传入：

```python
user_id=current_user["id"]
```

更新、删除、访问记录接口必须同时匹配 `id` 和 `user_id`。

---

## 3. 数据结构

### 3.1 ProjectSource

```json
{
  "id": "src_abc123",
  "user_id": "user_abc123",
  "name": "浙江省公共资源交易服务平台",
  "url": "https://example.com",
  "category": "public_resource",
  "region": "浙江省",
  "tags": ["建设工程", "政府采购"],
  "note": "每天上午查看公告和澄清",
  "is_favorite": true,
  "status": "active",
  "last_visited_at": "2026-07-09T10:00:00Z",
  "created_at": "2026-07-09T09:00:00Z",
  "updated_at": "2026-07-09T09:30:00Z"
}
```

前端响应中可以返回 `user_id`，但页面不应展示。

### 3.2 CreateProjectSourceRequest

```json
{
  "name": "浙江省公共资源交易服务平台",
  "url": "https://example.com",
  "category": "public_resource",
  "region": "浙江省",
  "tags": ["建设工程"],
  "note": "每天上午查看",
  "is_favorite": false,
  "status": "active"
}
```

### 3.3 UpdateProjectSourceRequest

所有字段可选，但至少包含一个可更新字段。

```json
{
  "name": "浙江省公共资源交易平台",
  "category": "public_resource",
  "region": "浙江省",
  "tags": ["建设工程", "招标公告"],
  "note": "重点关注澄清答疑",
  "is_favorite": true,
  "status": "active"
}
```

---

## 4. 接口定义

### 4.1 获取信息源列表

```http
GET /api/data/project-sources
```

#### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| page_size | number | 否 | 每页数量，默认 50，最大 100 |
| q | string | 否 | 关键词，匹配 name、url、region、note |
| category | string | 否 | 分类筛选 |
| region | string | 否 | 地区筛选 |
| is_favorite | boolean | 否 | 是否只看常用 |
| status | string | 否 | 状态筛选，默认不限制 |

#### Response 200

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 50
}
```

#### 排序规则

默认排序：

```text
is_favorite DESC, updated_at DESC
```

---

### 4.2 新增信息源

```http
POST /api/data/project-sources
```

#### Request

使用 `CreateProjectSourceRequest`。

#### Response 200

返回创建后的 `ProjectSource`。

#### 错误

| 状态码 | 说明 |
|--------|------|
| 400 | 名称不能为空、URL 不合法、分类不合法 |
| 401 | 未登录 |

---

### 4.3 更新信息源

```http
PATCH /api/data/project-sources/{id}
```

#### Request

使用 `UpdateProjectSourceRequest`。

#### Response 200

返回更新后的 `ProjectSource`。

#### 错误

| 状态码 | 说明 |
|--------|------|
| 400 | 请求体为空、URL 不合法、分类不合法 |
| 401 | 未登录 |
| 404 | 信息源不存在 |

不存在包括两种情况：

- `id` 不存在。
- `id` 存在但不属于当前用户。

---

### 4.4 删除信息源

```http
DELETE /api/data/project-sources/{id}
```

#### Response 200

```json
{
  "success": true
}
```

#### 错误

| 状态码 | 说明 |
|--------|------|
| 401 | 未登录 |
| 404 | 信息源不存在 |

删除必须是物理删除还是软删除由实现阶段按现有项目习惯决定；无论哪种方式，必须带 `user_id` 条件。

---

### 4.5 记录访问信息源

```http
POST /api/data/project-sources/{id}/visit
```

#### Response 200

返回更新后的 `ProjectSource`，其中 `last_visited_at` 为当前时间。

#### 错误

| 状态码 | 说明 |
|--------|------|
| 401 | 未登录 |
| 404 | 信息源不存在 |

---

## 5. URL 安全校验

### 5.1 允许

```text
https://example.com
http://example.com
```

### 5.2 禁止

```text
javascript:alert(1)
file:///etc/passwd
data:text/html,<script>alert(1)</script>
ftp://example.com/file
```

禁止的 URL 必须返回 400：

```json
{
  "detail": "仅支持 http 或 https 链接"
}
```

---

## 6. 前端 API 客户端

在 `src/frontend/lib/data-api.ts` 中新增：

```typescript
export interface ProjectSource {
  id: string;
  name: string;
  url: string;
  category: string;
  region?: string;
  tags: string[];
  note?: string;
  is_favorite: boolean;
  status: string;
  last_visited_at?: string | null;
  created_at: string;
  updated_at: string;
}
```

新增函数：

```typescript
listProjectSources(params)
createProjectSource(payload)
updateProjectSource(id, payload)
deleteProjectSource(id)
visitProjectSource(id)
```

必须复用现有 `authFetch` / `apiFetch` 模式。

---

## 7. 错误处理

| 场景 | 后端错误 | 前端展示 |
|------|----------|----------|
| 未登录 | 401 | 由现有鉴权流程处理 |
| URL 协议非法 | 400 | 表单错误或页面错误条 |
| 信息源不存在 | 404 | “信息源不存在或已删除” |
| 数据库异常 | 500 | “保存失败，请稍后重试” |

---

## 8. API 验收标准

| ID | 标准 |
|----|------|
| API-01 | 未登录访问所有接口返回 401 |
| API-02 | 新增合法信息源成功 |
| API-03 | 非 http/https URL 返回 400 |
| API-04 | 列表接口只返回当前用户数据 |
| API-05 | 关键词搜索可匹配名称、URL、地区、备注 |
| API-06 | 分类和地区筛选生效 |
| API-07 | 更新非当前用户信息源返回 404 |
| API-08 | 删除非当前用户信息源返回 404 |
| API-09 | visit 接口更新 `last_visited_at` |
