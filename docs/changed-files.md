# 项目变更文件清单

项目根目录：

```text
/vercel/share/v0-project
```

## 新增文件

| 文件 | 绝对路径 |
| --- | --- |
| 知识库页面 | `/vercel/share/v0-project/src/app/(main)/knowledge/page.tsx` |
| 知识库 API | `/vercel/share/v0-project/src/backend/app/api/knowledge.py` |
| 知识库服务 | `/vercel/share/v0-project/src/backend/app/services/knowledge_service.py` |
| 知识库单元测试 | `/vercel/share/v0-project/src/backend/tests/unit/services/test_knowledge_service.py` |
| Python 依赖锁文件 | `/vercel/share/v0-project/src/backend/uv.lock` |
| 前端知识库 API 客户端 | `/vercel/share/v0-project/src/frontend/lib/knowledge-api.ts` |

## 修改文件

| 文件 | 绝对路径 |
| --- | --- |
| 环境变量示例 | `/vercel/share/v0-project/.env.example` |
| Node.js 项目配置 | `/vercel/share/v0-project/package.json` |
| npm 依赖锁文件 | `/vercel/share/v0-project/package-lock.json` |
| 登录页面 | `/vercel/share/v0-project/src/app/(auth)/login/page.tsx` |
| 后端配置 | `/vercel/share/v0-project/src/backend/app/config.py` |
| PostgreSQL 数据结构 | `/vercel/share/v0-project/src/backend/app/infrastructure/db_schema.py` |
| FastAPI 应用入口 | `/vercel/share/v0-project/src/backend/app/main.py` |
| Python 项目配置 | `/vercel/share/v0-project/src/backend/pyproject.toml` |
| Python 依赖清单 | `/vercel/share/v0-project/src/backend/requirements.txt` |
| TypeScript 数据库 Schema | `/vercel/share/v0-project/src/db/schema.ts` |
| 功能页面左侧导航 | `/vercel/share/v0-project/src/frontend/components/layout/WorkbenchLayout.tsx` |

## 相关目录

```text
/vercel/share/v0-project/src/app/(main)/knowledge
/vercel/share/v0-project/src/backend/app/api
/vercel/share/v0-project/src/backend/app/services
/vercel/share/v0-project/src/backend/tests/unit/services
/vercel/share/v0-project/src/frontend/lib
/vercel/share/v0-project/src/frontend/components/layout
/vercel/share/v0-project/docs
```
