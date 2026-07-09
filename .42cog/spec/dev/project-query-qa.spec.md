# 项目查询 QA 规约

<meta>
  <document-id>bid-master-project-query-qa</document-id>
  <version>0.1.0</version>
  <project>Bid Master Web</project>
  <type>Quality Assurance Extension</type>
  <created>2026-07-09</created>
  <depends>project-query-sys.spec.md, project-query-db.spec.md, project-query-api.spec.md, ../pm/project-query-prd.md, ../../real/real.md</depends>
</meta>

---

## 1. 测试目标

项目查询功能的测试目标是验证：

- 用户可以稳定管理项目信息源。
- 数据按用户隔离，不能越权访问。
- 外链打开安全。
- MVP 不引入自动爬取、全网搜索等超范围能力。
- 新功能不影响现有文件管理、要素提取、模拟编制、开标分析和 PDF 导出。

---

## 2. 测试范围

### 2.1 MVP 必测

| 范围 | 内容 |
|------|------|
| API | 信息源新增、列表、筛选、更新、删除、访问记录 |
| 数据库 | 表创建、默认值、索引、用户隔离 |
| 前端 | 页面入口、空状态、表单、卡片、筛选、外链打开 |
| 安全 | URL 协议校验、多用户越权、noopener/noreferrer |
| 回归 | 现有核心页面不受影响 |

### 2.2 不测范围

| 不测内容 | 原因 |
|----------|------|
| 自动爬取网页内容 | MVP 不实现 |
| 全网搜索准确率 | MVP 不实现 |
| 项目线索完整生命周期 | v1 才实现 |
| 第三方平台登录 | 不保存第三方账号，不代替用户登录 |

---

## 3. 后端 API 测试用例

### 3.1 鉴权

| ID | 用例 | 预期 |
|----|------|------|
| API-AUTH-01 | 未登录 GET `/api/data/project-sources` | 返回 401 |
| API-AUTH-02 | 未登录 POST `/api/data/project-sources` | 返回 401 |
| API-AUTH-03 | 未登录 PATCH `/api/data/project-sources/{id}` | 返回 401 |
| API-AUTH-04 | 未登录 DELETE `/api/data/project-sources/{id}` | 返回 401 |
| API-AUTH-05 | 未登录 POST `/api/data/project-sources/{id}/visit` | 返回 401 |

### 3.2 新增信息源

| ID | 用例 | 输入 | 预期 |
|----|------|------|------|
| API-CREATE-01 | 新增合法 HTTPS 链接 | `https://example.com` | 返回 200 和信息源对象 |
| API-CREATE-02 | 新增合法 HTTP 链接 | `http://example.com` | 返回 200 和信息源对象 |
| API-CREATE-03 | 名称为空 | `name = ""` | 返回 400 |
| API-CREATE-04 | URL 为空 | `url = ""` | 返回 400 |
| API-CREATE-05 | 危险协议 | `javascript:alert(1)` | 返回 400 |
| API-CREATE-06 | 文件协议 | `file:///tmp/a` | 返回 400 |
| API-CREATE-07 | 标签为空 | `tags = []` | 创建成功 |

### 3.3 列表与筛选

| ID | 用例 | 预期 |
|----|------|------|
| API-LIST-01 | 当前用户有 3 条信息源 | 返回 3 条 |
| API-LIST-02 | 按关键词搜索名称 | 只返回匹配名称的记录 |
| API-LIST-03 | 按关键词搜索备注 | 只返回匹配备注的记录 |
| API-LIST-04 | 按分类筛选 | 只返回该分类记录 |
| API-LIST-05 | 按地区筛选 | 只返回该地区记录 |
| API-LIST-06 | 只看常用 | 只返回 `is_favorite = true` 记录 |
| API-LIST-07 | 分页参数生效 | 返回指定页数据和 total |

### 3.4 更新与删除

| ID | 用例 | 预期 |
|----|------|------|
| API-UPDATE-01 | 更新名称、分类、地区 | 返回更新后数据 |
| API-UPDATE-02 | 更新 URL 为危险协议 | 返回 400 |
| API-UPDATE-03 | 更新不存在 ID | 返回 404 |
| API-UPDATE-04 | 更新其他用户 ID | 返回 404 |
| API-DELETE-01 | 删除自己的信息源 | 返回 `{ success: true }` |
| API-DELETE-02 | 删除不存在 ID | 返回 404 |
| API-DELETE-03 | 删除其他用户 ID | 返回 404 |

### 3.5 访问记录

| ID | 用例 | 预期 |
|----|------|------|
| API-VISIT-01 | 访问自己的信息源 | `last_visited_at` 更新 |
| API-VISIT-02 | 访问不存在 ID | 返回 404 |
| API-VISIT-03 | 访问其他用户 ID | 返回 404 |

---

## 4. 数据库测试用例

| ID | 用例 | 预期 |
|----|------|------|
| DB-01 | 应用启动初始化 schema | `project_sources` 表存在 |
| DB-02 | 新增时不传 tags | `tags` 默认为 `[]` |
| DB-03 | 新增时不传 status | `status` 默认为 `active` |
| DB-04 | 新增时不传 is_favorite | `is_favorite` 默认为 `false` |
| DB-05 | 按 user_id 查询 | 不返回其他用户数据 |
| DB-06 | 按 id + user_id 更新 | 只能更新自己的数据 |
| DB-07 | 按 id + user_id 删除 | 只能删除自己的数据 |

---

## 5. 前端交互测试用例

### 5.1 页面入口

| ID | 用例 | 预期 |
|----|------|------|
| UI-NAV-01 | 侧边栏显示“项目查询” | 可见入口 |
| UI-NAV-02 | 点击“项目查询” | 进入项目查询页面 |
| UI-NAV-03 | 页面加载中 | 显示加载状态或稳定空状态 |

### 5.2 空状态

| ID | 用例 | 预期 |
|----|------|------|
| UI-EMPTY-01 | 用户没有信息源 | 显示空状态 |
| UI-EMPTY-02 | 空状态点击新增 | 打开新增表单 |

### 5.3 新增与编辑

| ID | 用例 | 预期 |
|----|------|------|
| UI-FORM-01 | 填写合法名称和 URL | 可提交 |
| UI-FORM-02 | URL 非法 | 显示中文错误 |
| UI-FORM-03 | 编辑信息源 | 表单带入旧数据 |
| UI-FORM-04 | 保存编辑 | 列表更新 |

### 5.4 筛选与搜索

| ID | 用例 | 预期 |
|----|------|------|
| UI-FILTER-01 | 输入关键词 | 列表按关键词过滤 |
| UI-FILTER-02 | 切换分类 | 列表按分类过滤 |
| UI-FILTER-03 | 切换地区 | 列表按地区过滤 |
| UI-FILTER-04 | 只看常用 | 列表只显示常用项 |

### 5.5 删除与外链打开

| ID | 用例 | 预期 |
|----|------|------|
| UI-DELETE-01 | 点击删除 | 出现二次确认 |
| UI-DELETE-02 | 确认删除 | 卡片从列表移除 |
| UI-OPEN-01 | 点击打开网站 | 新标签页打开 URL |
| UI-OPEN-02 | 打开网站 | 使用 `noopener,noreferrer` |
| UI-OPEN-03 | 打开网站后 | 触发 visit 接口更新最后访问时间 |

---

## 6. 安全测试

| ID | 风险 | 测试 | 预期 |
|----|------|------|------|
| SEC-01 | XSS URL | 输入 `javascript:alert(1)` | 后端拒绝 |
| SEC-02 | 本地文件 URL | 输入 `file:///etc/passwd` | 后端拒绝 |
| SEC-03 | data URL | 输入 `data:text/html,...` | 后端拒绝 |
| SEC-04 | 越权读取 | 用户 A 查询用户 B 数据 | 不返回 |
| SEC-05 | 越权更新 | 用户 A 更新用户 B 记录 | 返回 404 |
| SEC-06 | 越权删除 | 用户 A 删除用户 B 记录 | 返回 404 |
| SEC-07 | 外链反向控制 | 检查 window.open 参数 | 必须含 `noopener,noreferrer` |

---

## 7. 回归测试

| ID | 页面/功能 | 预期 |
|----|-----------|------|
| REG-01 | 首页 | 正常打开 |
| REG-02 | 文件管理 | 正常加载文件和结果列表 |
| REG-03 | 要素提取 | 页面可打开，上传/提取入口不受影响 |
| REG-04 | 模拟编制 | 页面可打开 |
| REG-05 | 开标分析 | 页面可打开 |
| REG-06 | PDF 导出 | 既有 PDF 下载按钮不受影响 |
| REG-07 | 登录状态 | 未登录仍按现有逻辑跳转或刷新登录 |

---

## 8. 自动化验证建议

### 8.1 后端

- Python 语法检查：

```bash
python3 -m py_compile src/backend/app/infrastructure/db_schema.py src/backend/app/infrastructure/pg_storage.py src/backend/app/api/database.py
```

- 手动接口检查：

```bash
curl -i http://127.0.0.1:8000/api/data/project-sources
```

未登录应返回 401。

### 8.2 前端

- TypeScript 检查：

```bash
npm run type-check
```

- 浏览器 E2E：
  - 进入项目查询页面。
  - 新增信息源。
  - 搜索和筛选。
  - 打开外链。
  - 删除信息源。

---

## 9. 完成标准

| ID | 标准 |
|----|------|
| DONE-01 | API 验收用例通过 |
| DONE-02 | 前端交互验收用例通过 |
| DONE-03 | 安全测试通过 |
| DONE-04 | 回归测试通过 |
| DONE-05 | MVP 范围未扩张到自动爬取或全网搜索 |
