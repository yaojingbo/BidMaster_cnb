---
name: quality-assurance
description: 本技能用于定义Web应用的测试策略和质量标准，涵盖单元测试、集成测试、端到端测试、安全测试和持续集成配置。
depends:
  - real.md
  - cog.md
generates:
  - spec-quality-assurance.md
---

> **AI智能体注意**：本技能生成供AI/Agent（特别是Claude Code）使用的规约文档。生成规约前，必须从`real.md`和`cog.md`加载上下文。如果这些文件不存在，请先调用`meta-42cog`技能创建它们。

## 前置条件

### 执行前检查清单

使用本技能前，请验证：

1. **real.md存在** - 包含现实约束（最多4条必选 + 3条可选）
2. **cog.md存在** - 包含认知模型（智能体 + 信息 + 上下文）

如果任一文件缺失，请执行：
```
调用技能：meta-42cog
```

### 上下文加载

从`cog.md`中提取：
- **智能体类型**：需要测试的不同用户角色（用户、管理员、访客）
- **关键用户旅程**：必须进行E2E测试的关键工作流
- **信息流**：需要集成测试的数据路径

从`real.md`中提取：
- **安全约束**：转化为安全测试用例的要求
- **数据约束**：转化为单元测试用例的验证规则
- **业务规则**：需要显式测试的边界情况

# 质量保证

## 概述

本技能指导为Web应用创建全面的测试策略。确保质量需要定义测试金字塔、编写单元测试、创建集成测试、实现E2E测试，并建立CI流水线。

## 适用场景

- 为新项目建立测试策略
- 为现有功能编写测试
- 创建安全测试检查清单
- 配置CI/CD流水线
- 定义质量指标和覆盖率目标

## 流程

### 阶段一：定义测试策略

**测试金字塔：**

```
          /\
         /  \
        / E2E \           10% - 关键用户旅程
       /──────\
      /        \
     /  集成测试 \        30% - API和数据库测试
    /────────────\
   /              \
  /    单元测试    \      60% - 函数和组件
 /──────────────────\
```

**测试工具：**

| 层级 | 工具 | 用途 |
|------|------|------|
| 单元 | Vitest | 快速单元测试 |
| 组件 | Testing Library | React组件测试 |
| 集成 | Vitest + Supertest | API测试 |
| E2E | Playwright | 浏览器自动化 |

**覆盖率目标：**

| 类型 | 最低 | 目标 |
|------|------|------|
| 单元测试 | 70% | 85% |
| 集成测试 | 50% | 70% |
| 关键路径 | 100% | 100% |

### 阶段二：编写单元测试

**单元测试结构：**

```typescript
// __tests__/lib/auth/password.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('密码工具', () => {
  describe('hashPassword', () => {
    it('应使用bcrypt哈希密码', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$.{56}$/);
    });

    it('相同密码应生成不同哈希', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('应验证正确密码', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('应拒绝错误密码', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const result = await verifyPassword('WrongPassword', hash);
      expect(result).toBe(false);
    });
  });
});
```

**测试分类：**

| 分类 | 测试内容 | 示例 |
|------|----------|------|
| 纯函数 | 输入/输出 | 工具函数、格式化器 |
| 验证 | 模式验证 | Zod模式 |
| 安全 | 加密操作 | 加密、哈希 |
| 业务逻辑 | 服务方法 | 领域规则 |

### 阶段三：创建集成测试

**API测试模式：**

```typescript
// __tests__/api/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

describe('认证API', () => {
  const testEmail = 'test@example.com';
  
  afterAll(async () => {
    // 清理测试数据
    await db.delete(users).where(eq(users.email, testEmail));
  });

  describe('POST /api/auth/register', () => {
    it('应注册新用户', async () => {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'SecurePassword123!',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.email).toBe(testEmail);
    });

    it('应拒绝重复邮箱', async () => {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'AnotherPassword123!',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('首个用户应成为管理员', async () => {
      // 清除所有用户
      await db.delete(users);
      
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'first@example.com',
          password: 'SecurePassword123!',
        }),
      });

      const data = await response.json();
      expect(data.data.role).toBe('admin');
    });
  });
});
```

**数据库测试模式：**

```typescript
// __tests__/db/conversations.test.ts
describe('对话数据库', () => {
  it('应将消息内容存储为JSONB', async () => {
    const [conv] = await db.insert(conversations).values({
      userId: testUserId,
      title: '测试',
    }).returning();

    const [msg] = await db.insert(messages).values({
      conversationId: conv.id,
      role: 'user',
      content: {
        text: '你好',
        metadata: { tokens: 10 },
      },
    }).returning();

    expect(msg.content).toEqual({
      text: '你好',
      metadata: { tokens: 10 },
    });
  });
});
```

### 阶段四：实现E2E测试

**E2E测试结构：**

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('认证', () => {
  test('用户可以注册和登录', async ({ page }) => {
    // 导航到注册页
    await page.goto('/register');
    
    // 填写表单
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.fill('[name="password"]', 'Password123!');
    await page.fill('[name="confirmPassword"]', 'Password123!');
    
    // 提交
    await page.click('button[type="submit"]');
    
    // 验证跳转
    await expect(page).toHaveURL('/');
    
    // 登出
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');
    
    // 再次登录
    await page.goto('/login');
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.fill('[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
  });
});
```

**关键用户旅程：**

| 旅程 | 步骤 | 优先级 |
|------|------|--------|
| 注册流程 | 注册 → 验证 → 登录 | 关键 |
| 聊天流程 | 登录 → 创建对话 → 发送消息 | 关键 |
| API配置 | 登录 → 添加API密钥 → 测试 | 高 |
| 管理访问 | 管理员登录 → 查看仪表板 | 高 |

### 阶段五：安全测试

**安全测试检查清单：**

```markdown
## 认证安全

- [ ] 密码使用bcrypt哈希（cost >= 12）
- [ ] 登录不泄露邮箱是否存在
- [ ] 会话适时过期
- [ ] 登出使会话失效

## 授权安全

- [ ] 用户只能访问自己的资源
- [ ] 管理路由需要管理员角色
- [ ] API端点检查认证

## 数据安全

- [ ] API密钥静态加密
- [ ] 防止SQL注入（ORM）
- [ ] 防止XSS（React转义）
- [ ] 启用CSRF保护

## 输入验证

- [ ] 所有输入服务端验证
- [ ] 文件上传限制为允许的类型
- [ ] 请求大小限制已实施
```

**安全测试示例：**

```typescript
describe('安全', () => {
  describe('资源所有权', () => {
    it('不应允许访问其他用户的对话', async () => {
      // 以用户A创建对话
      const convId = await createConversation(userAToken);
      
      // 尝试以用户B访问
      const response = await fetch(`/api/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      
      expect(response.status).toBe(404); // 返回404而非403以避免枚举
    });
  });

  describe('管理员访问', () => {
    it('应拒绝普通用户的管理员访问', async () => {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${regularUserToken}` },
      });
      
      expect(response.status).toBe(403);
    });
  });
});
```

### 阶段六：CI/CD配置

**GitHub Actions工作流：**

```yaml
# .github/workflows/test.yml
name: 测试

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run type-check

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - uses: codecov/codecov-action@v3

  e2e-test:
    runs-on: ubuntu-latest
    needs: [lint, unit-test]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx playwright install --with-deps
      - run: bun run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

**测试命令：**

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## 输出模板

```markdown
# 质量保证计划

## 1. 测试策略
- 金字塔分布
- 工具和框架
- 覆盖率目标

## 2. 单元测试
- 测试文件结构
- 关键测试用例

## 3. 集成测试
- API测试场景
- 数据库测试场景

## 4. E2E测试
- 关键用户旅程
- 测试场景

## 5. 安全测试
- 安全检查清单
- 具体测试用例

## 6. CI/CD流水线
- 工作流配置
- 测试命令
```

## 质量检查清单

- [ ] 测试金字塔平衡
- [ ] 单元测试覆盖关键函数
- [ ] 集成测试覆盖API
- [ ] E2E测试覆盖关键旅程
- [ ] 安全测试验证约束
- [ ] CI流水线运行所有测试
- [ ] 覆盖率达到最低目标

## 与其他技能的关系

| 技能 | 关系 |
|------|------|
| user-story | 输入：验收标准成为测试用例 |
| coding | 输入：待测试的代码 |
| deployment | 输出：测试在CI/CD中运行 |
