---
name: system-architecture
description: 设计 Web 应用系统架构（架构模式、子系统、API、目录结构、安全、ADR）
depends:
  - real.md
  - cog.md
generates:
  - sys.spec.md
---

# 系统架构设计

## 前置条件

1. 读取 `real.md` 获取约束
2. 读取 `cog.md` 获取实体和关系
3. 读取 `pr.spec.md` 获取功能需求

## 流程

### 1. 选择架构模式

| 模式 | 适用场景 |
|------|----------|
| 分层架构 | CRUD 应用 |
| 模块化单体 | 中等复杂度 |
| 微服务 | 大规模系统 |
| 无服务器 | 可变负载 |

**Next.js 推荐**：分层架构 + 模块化
```
表现层（组件）→ 应用层（API）→ 领域层（服务）→ 基础设施层（DB）
```

### 2. 分解子系统

```markdown
### [子系统名称]
**职责**：[单句描述]
**组件**：[主要文件]
**接口**：输入 [X] / 输出 [Y]
**约束**：[来自 real.md]
```

### 3. 设计 API

RESTful 原则：名词资源、HTTP 方法、复数命名

```markdown
| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/auth/login | 登录 | 无 |
| GET | /api/conversations | 列表 | 必需 |
```

### 4. 目录结构

```
src/
├── app/              # 路由（小写 kebab-case）
│   ├── (auth)/       # 认证路由组
│   ├── (main)/       # 主应用路由组
│   └── api/          # API 路由
├── components/       # 组件（PascalCase.tsx）
├── lib/              # 工具（db/, auth/）
├── services/         # 业务逻辑（*.service.ts）
├── hooks/            # React Hooks
└── types/            # TypeScript 类型
```

### 5. 安全架构

| 层级 | 措施 |
|------|------|
| 传输 | HTTPS |
| 认证 | Session/JWT |
| 授权 | userId 过滤 |
| 数据 | 加密、Zod 验证、参数化查询 |

### 6. 技术决策（ADR）

```markdown
### ADR-XXX：[标题]
**决策**：[选择什么]
**理由**：[为什么]
```

## 输出结构

```markdown
# 系统架构规格书

## 1. 架构概述（模式 + 技术栈）
## 2. 系统架构图（ASCII）
## 3. 子系统设计
## 4. API 设计（表格）
## 5. 目录结构
## 6. 数据库 Schema
## 7. 安全架构（约束映射）
## 8. 技术决策（ADR）
```

## 质量检查

- [ ] 子系统职责清晰
- [ ] API 遵循 RESTful
- [ ] 安全约束已实现
- [ ] ADR 已记录

---

**版本**：v4.0-lite
**更新**：2025-12-06
