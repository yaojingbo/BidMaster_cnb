# 项目查询系统设计规约

<meta>
  <document-id>bid-master-project-query-system</document-id>
  <version>0.1.0</version>
  <project>Bid Master Web</project>
  <type>System Architecture Extension</type>
  <created>2026-07-09</created>
  <depends>../pm/pr.spec.md, ../pm/project-query-prd.md, ../../meta/meta.md, ../../real/real.md, ../../cog/cog.md</depends>
</meta>

---

## 1. 模块定位

项目查询是 Bid Master Web 在现有功能体系基础上的新增模块，对应总 PRD 中的 `AFF-09: 项目查询`。

该模块定位为：

> 招投标信息源管理 + 项目线索入口。

它补齐招投标全流程中“查找项目信息”这一前置环节，但不替代现有的要素提取、模拟编制、开标分析、文件管理和 PDF 导出能力。

---

## 2. 目标与边界

### 2.1 MVP 目标

MVP 只解决用户高频、明确、低风险的问题：集中保存和打开常用项目信息来源。

| 能力 | 说明 |
|------|------|
| 信息源保存 | 用户保存公共资源交易平台、政府采购、企业采购、行业平台等链接 |
| 分类管理 | 按分类、地区、标签组织信息源 |
| 快速访问 | 点击“打开网站”在新标签页访问外部项目查询网站 |
| 搜索筛选 | 按关键词、分类、地区筛选信息源 |
| 访问记录 | 记录最后访问时间，便于用户判断最近查看情况 |

### 2.2 v1 目标

v1 扩展为项目线索管理：用户可以保存具体项目公告链接，并与上传文件、分析结果建立关联。

### 2.3 明确不做

| 不做内容 | 原因 |
|----------|------|
| 全网招标搜索引擎 | 数据源复杂，合规、成本和稳定性风险高 |
| 自动爬取第三方网页 | 需要处理 robots、版权、反爬、账号权限等问题 |
| 自动报名或投标 | 涉及法律责任、CA 证书和用户账号权限 |
| 第三方账号密码保存 | 敏感信息安全风险高，违反最小化存储原则 |

---

## 3. 系统关系

```text
用户
 │
 ▼
项目查询页面
 │
 ├─ 信息源 CRUD ──────────────┐
 │                            │
 ├─ 搜索/分类/地区筛选          │
 │                            ▼
 ├─ 打开外部网站          FastAPI /api/data/project-sources
 │                            │
 └─ 记录最后访问时间            ▼
                         PostgreSQL project_sources
```

---

## 4. 与现有功能的衔接

| 现有模块 | 衔接方式 |
|----------|----------|
| 文件管理 | v1 项目线索可关联上传后的招标文件 |
| 要素提取 | 用户从外部信息源下载招标文件后进入要素提取 |
| 模拟编制 | 项目进入编制阶段后可使用模拟编制生成材料 |
| 开标分析 | 项目进入开标阶段后可关联开标数据分析 |
| PDF 导出 | 项目线索和分析结果后续可统一导出项目档案 |
| 用户鉴权 | 复用现有 `get_current_user` 鉴权和用户隔离模式 |

---

## 5. 子系统设计

### 5.1 前端子系统

| 组件 | 职责 |
|------|------|
| 项目查询页面 | 展示信息源列表、筛选器、表单、空状态 |
| 信息源表单 | 新增和编辑信息源 |
| 信息源卡片 | 展示名称、URL、分类、地区、标签、备注、最后访问时间 |
| 筛选工具栏 | 关键词、分类、地区、常用过滤 |
| 外链打开动作 | 使用安全方式打开外部网站 |

前端页面应遵循现有 `(main)` 页面模式，优先参考文件管理页的列表、筛选、错误提示和确认删除交互。

### 5.2 后端子系统

| 组件 | 职责 |
|------|------|
| API 路由 | 提供 `/api/data/project-sources` 系列接口 |
| Pydantic 模型 | 校验请求体、URL、分类、状态等字段 |
| Storage 函数 | 执行用户级隔离的 SQL 查询 |
| Schema 初始化 | 在 `db_schema.py` 中创建表和索引 |

---

## 6. 数据流

### 6.1 新增信息源

```text
用户填写表单
  → 前端校验必填项
  → POST /api/data/project-sources
  → 后端鉴权 get_current_user
  → 后端校验 URL 协议
  → storage 插入 project_sources，写入 user_id
  → 返回创建后的信息源
  → 前端刷新列表
```

### 6.2 打开信息源

```text
用户点击“打开网站”
  → 前端调用 POST /api/data/project-sources/{id}/visit
  → 后端按 id + user_id 更新 last_visited_at
  → 前端使用 window.open(url, '_blank', 'noopener,noreferrer') 打开外链
```

外链打开不依赖 visit 接口成功；如果 visit 失败，前端应显示轻量错误，但不阻断用户访问外部网站。

---

## 7. 安全与权限

| 风险 | 规约 |
|------|------|
| 越权访问 | 所有查询、更新、删除必须带当前 `user_id` 条件 |
| 危险 URL | 只允许 `http://` 和 `https://` 协议 |
| 外链反向控制 | 使用 `noopener,noreferrer` 打开新标签页 |
| 敏感信息泄露 | 备注中不要求用户填写账号密码、CA 证书、密钥 |
| 自动抓取合规风险 | MVP 不抓取第三方网页内容 |

---

## 8. 关键文件

| 文件 | 作用 |
|------|------|
| `src/backend/app/infrastructure/db_schema.py` | 创建 `project_sources` 表和索引 |
| `src/backend/app/infrastructure/pg_storage.py` | 信息源数据访问函数 |
| `src/backend/app/api/database.py` | 信息源 API 路由 |
| `src/frontend/lib/data-api.ts` | 前端 API 客户端 |
| `src/app/(main)/project-query/page.tsx` | 项目查询页面 |
| `src/frontend/components/layout/WorkbenchLayout.tsx` | 功能区侧边栏入口 |

---

## 9. 验收标准

| ID | 标准 |
|----|------|
| SYS-01 | 项目查询作为独立页面存在，不影响现有页面 |
| SYS-02 | 信息源数据按用户隔离 |
| SYS-03 | 外链打开使用安全参数 |
| SYS-04 | MVP 不包含自动爬取和全网搜索 |
| SYS-05 | 页面能与文件管理、要素提取等现有工作流形成前后衔接 |
