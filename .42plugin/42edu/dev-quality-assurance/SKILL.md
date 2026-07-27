---
name: quality-assurance
description: This skill should be used when defining testing strategies and quality standards for web applications. It covers unit testing, integration testing, end-to-end testing, security testing, and continuous integration setup.
depends:
  - real.md
  - cog.md
generates:
  - spec-quality-assurance.md
---

> **Note for AI Agents**: This skill generates specification documents for AI/Agent consumption (especially Claude Code). Before generating specs, you MUST load context from `real.md` and `cog.md`. If these files don't exist, invoke the `meta-42cog` skill first to create them.

## Prerequisites

### Pre-execution Checklist

Before using this skill, verify:

1. **real.md exists** - Contains reality constraints (max 4 required + 3 optional)
2. **cog.md exists** - Contains cognitive model (Agents + Information + Context)

If either file is missing, execute:
```
Invoke skill: meta-42cog
```

### Context Loading

From `cog.md`, extract:
- **Agent types**: Different user roles to test (user, admin, guest)
- **Critical user journeys**: Key workflows that must be tested E2E
- **Information flows**: Data paths requiring integration tests

From `real.md`, extract:
- **Security constraints**: Requirements that become security test cases
- **Data constraints**: Validation rules that become unit test cases
- **Business rules**: Edge cases that need explicit testing

# Quality Assurance

## Overview

This skill guides the creation of comprehensive testing strategies for web applications. To ensure quality, define testing pyramid, write unit tests, create integration tests, implement E2E tests, and establish CI pipelines.

## When to Use This Skill

- Establishing testing strategy for new projects
- Writing tests for existing features
- Creating security test checklists
- Setting up CI/CD pipelines
- Defining quality metrics and coverage targets

## Process

### Phase 1: Define Testing Strategy

**Testing Pyramid:**

```
          /\
         /  \
        / E2E \           10% - Critical user journeys
       /──────\
      /        \
     /Integration\        30% - API and DB tests
    /────────────\
   /              \
  /   Unit Tests   \      60% - Functions and components
 /──────────────────\
```

**Testing Tools:**

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Fast unit testing |
| Component | Testing Library | React component testing |
| Integration | Vitest + Supertest | API testing |
| E2E | Playwright | Browser automation |

**Coverage Targets:**

| Type | Minimum | Target |
|------|---------|--------|
| Unit Tests | 70% | 85% |
| Integration | 50% | 70% |
| Critical Paths | 100% | 100% |

### Phase 2: Write Unit Tests

**Unit Test Structure:**

```typescript
// __tests__/lib/auth/password.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$.{56}$/);
    });

    it('should generate unique hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const result = await verifyPassword('WrongPassword', hash);
      expect(result).toBe(false);
    });
  });
});
```

**Test Categories:**

| Category | What to Test | Examples |
|----------|--------------|----------|
| Pure Functions | Input/output | Utilities, formatters |
| Validation | Schema validation | Zod schemas |
| Security | Crypto operations | Encryption, hashing |
| Business Logic | Service methods | Domain rules |

### Phase 3: Create Integration Tests

**API Test Pattern:**

```typescript
// __tests__/api/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

describe('Auth API', () => {
  const testEmail = 'test@example.com';
  
  afterAll(async () => {
    // Clean up test data
    await db.delete(users).where(eq(users.email, testEmail));
  });

  describe('POST /api/auth/register', () => {
    it('should register new user', async () => {
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

    it('should reject duplicate email', async () => {
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

    it('should make first user admin', async () => {
      // Clear all users
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

**Database Test Pattern:**

```typescript
// __tests__/db/conversations.test.ts
describe('Conversations DB', () => {
  it('should store message content as JSONB', async () => {
    const [conv] = await db.insert(conversations).values({
      userId: testUserId,
      title: 'Test',
    }).returning();

    const [msg] = await db.insert(messages).values({
      conversationId: conv.id,
      role: 'user',
      content: {
        text: 'Hello',
        metadata: { tokens: 10 },
      },
    }).returning();

    expect(msg.content).toEqual({
      text: 'Hello',
      metadata: { tokens: 10 },
    });
  });
});
```

### Phase 4: Implement E2E Tests

**E2E Test Structure:**

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can register and login', async ({ page }) => {
    // Navigate to registration
    await page.goto('/register');
    
    // Fill form
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.fill('[name="password"]', 'Password123!');
    await page.fill('[name="confirmPassword"]', 'Password123!');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify redirect
    await expect(page).toHaveURL('/');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');
    
    // Login again
    await page.goto('/login');
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.fill('[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
  });
});
```

**Critical User Journeys:**

| Journey | Steps | Priority |
|---------|-------|----------|
| Registration | Register → Verify → Login | Critical |
| Chat Flow | Login → Create chat → Send message | Critical |
| API Config | Login → Add API key → Test | High |
| Admin Access | Admin login → View dashboard | High |

### Phase 5: Security Testing

**Security Test Checklist:**

```markdown
## Authentication Security

- [ ] Passwords hashed with bcrypt (cost >= 12)
- [ ] Login doesn't reveal if email exists
- [ ] Session expires appropriately
- [ ] Logout invalidates session

## Authorization Security

- [ ] Users can only access own resources
- [ ] Admin routes require admin role
- [ ] API endpoints check authentication

## Data Security

- [ ] API keys encrypted at rest
- [ ] SQL injection prevented (ORM)
- [ ] XSS prevented (React escaping)
- [ ] CSRF protection enabled

## Input Validation

- [ ] All inputs validated server-side
- [ ] File uploads restricted to allowed types
- [ ] Request size limits enforced
```

**Security Test Examples:**

```typescript
describe('Security', () => {
  describe('Resource Ownership', () => {
    it('should not allow access to other user conversations', async () => {
      // Create conversation as user A
      const convId = await createConversation(userAToken);
      
      // Try to access as user B
      const response = await fetch(`/api/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      
      expect(response.status).toBe(404); // Not 403 to avoid enumeration
    });
  });

  describe('Admin Access', () => {
    it('should deny admin access to regular users', async () => {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${regularUserToken}` },
      });
      
      expect(response.status).toBe(403);
    });
  });
});
```

### Phase 6: CI/CD Setup

**GitHub Actions Workflow:**

```yaml
# .github/workflows/test.yml
name: Test

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

**Test Commands:**

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

## Output Template

```markdown
# Quality Assurance Plan

## 1. Testing Strategy
- Pyramid distribution
- Tools and frameworks
- Coverage targets

## 2. Unit Tests
- Test file structure
- Key test cases

## 3. Integration Tests
- API test scenarios
- Database test scenarios

## 4. E2E Tests
- Critical user journeys
- Test scenarios

## 5. Security Tests
- Security checklist
- Specific test cases

## 6. CI/CD Pipeline
- Workflow configuration
- Test commands
```

## Quality Checklist

- [ ] Testing pyramid is balanced
- [ ] Unit tests cover critical functions
- [ ] Integration tests cover APIs
- [ ] E2E tests cover critical journeys
- [ ] Security tests validate constraints
- [ ] CI pipeline runs all tests
- [ ] Coverage meets minimum targets

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| user-story | Input: AC become test cases |
| coding | Input: code to be tested |
| deployment | Output: tests run in CI/CD |
