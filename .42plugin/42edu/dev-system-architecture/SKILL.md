---
name: system-architecture
description: This skill should be used when designing system architecture for web applications. It covers architectural patterns, subsystem decomposition, API design, directory structure, security architecture, and technical decision documentation.
depends:
  - real.md
  - cog.md
generates:
  - spec-system-architecture.md
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
- **Agents**: All human and AI agents that interact with the system
- **Information**: Data entities and their relationships
- **Context**: Operating environment and integration points
- **Subsystems**: Logical boundaries already identified

From `real.md`, extract:
- **Required constraints**: Security, data handling, deployment requirements
- **Optional constraints**: Performance, compatibility preferences

# System Architecture Design

## Overview

This skill guides the design of system architecture for modern web applications. To create robust architecture, select appropriate patterns, decompose into subsystems, design APIs, establish directory structure, and document technical decisions.

> 💡 **Affordance Perspective** (Optional)  
> <details>
> <summary>Click to expand: Understanding architecture through affordances</summary>
> 
> Architecture isn't just code organization—it's the infrastructure that enables action possibilities for both human and AI agents. Good architecture makes actions perceivable (through clear APIs), executable (through well-defined interfaces), and feedback-rich (through structured responses).
> 
> While this skill uses traditional terminology (layers, subsystems, APIs), you can optionally think of:
> - **APIs** as programmatic affordances for AI agents
> - **Components** as visual affordances for humans
> - **State management** as affordance availability tracking
> 
> See `SKILL-affordance-theory.md` for the complete affordance-based perspective.
> </details>

## When to Use This Skill

- Starting a new web application project
- Refactoring existing system architecture
- Designing API structure and endpoints
- Establishing project directory conventions
- Making and documenting technical decisions

## Process

### Phase 1: Select Architecture Pattern

**Common Patterns for Web Apps:**

| Pattern | Best For | Trade-offs |
|---------|----------|------------|
| Layered (N-tier) | CRUD apps, clear separation | Can be rigid |
| Modular Monolith | Medium complexity | Deployment coupling |
| Microservices | Large scale, team independence | Operational complexity |
| Serverless | Variable load, cost optimization | Cold starts, vendor lock |

**Recommended for Next.js Apps:**

```
Layered Architecture + Modular Design
├── Presentation Layer (React Components)
├── Application Layer (API Routes, Server Actions)
├── Domain Layer (Business Logic, Services)
└── Infrastructure Layer (Database, External APIs)
```

> 💡 **Affordance Hint**: Each layer exposes affordances to the layer above. APIs are affordances for the presentation layer; components are affordances for users.

### Phase 2: Decompose into Subsystems

Identify bounded contexts and create subsystems.

**Subsystem Template:**

```markdown
## Subsystem: [Name]

**Responsibility:** [Single sentence description]

**Components:**
- Component 1: [Description]
- Component 2: [Description]

**Interfaces:**
- Input: [What it receives]
- Output: [What it produces]

**Dependencies:**
- Depends on: [Other subsystems]
- Used by: [Dependent subsystems]
```

**Standard Subsystems for Chat App:**

| Subsystem | Responsibility |
|-----------|----------------|
| Auth | User authentication and authorization |
| Chat | Conversation and message management |
| LLM Gateway | Multi-model routing and API calls |
| Search | Web search integration |
| Templates | Prompt template management |
| Admin | System administration |
| Health | System monitoring |

### Phase 3: Design API Structure

**RESTful API Design Principles:**

| Principle | Example |
|-----------|---------|
| Use nouns for resources | `/conversations` not `/getConversations` |
| Use HTTP methods | GET, POST, PUT, DELETE |
| Use plural names | `/users` not `/user` |
| Nest related resources | `/conversations/:id/messages` |
| Version if needed | `/api/v1/...` |

> 💡 **Affordance Hint**: When designing APIs, ask "What action does this endpoint afford?" Instead of just CRUD operations, think about the actual capabilities each endpoint provides to agents (human developers or AI assistants).

**API Endpoint Template:**

```markdown
### [METHOD] /api/[resource]

**Description:** [What this endpoint does]

**Authentication:** Required/Optional/None

**Request:**
- Headers: [Required headers]
- Params: [URL parameters]
- Query: [Query parameters]
- Body: [Request body schema]

**Response:**
- 200: [Success response]
- 400: [Bad request]
- 401: [Unauthorized]
- 404: [Not found]
- 500: [Server error]
```

**Standard API Structure:**

```
/api
├── /auth
│   ├── POST /register     # User registration
│   ├── POST /login        # User login
│   ├── POST /logout       # User logout
│   └── GET  /session      # Get current session
├── /conversations
│   ├── GET  /             # List conversations
│   ├── POST /             # Create conversation
│   ├── GET  /:id          # Get conversation
│   ├── PUT  /:id          # Update conversation
│   ├── DELETE /:id        # Delete conversation
│   └── POST /:id/messages # Send message
├── /config
│   ├── GET  /api          # List API configs
│   ├── POST /api          # Add API config
│   └── ... 
└── /admin
    ├── GET  /stats        # System statistics
    ├── GET  /users        # User list
    └── ...
```

### Phase 4: Establish Directory Structure

**Next.js App Router Structure:**

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Auth route group
│   │   ├── login/
│   │   └── register/
│   ├── (main)/               # Main app route group
│   │   ├── chat/
│   │   │   └── [id]/
│   │   └── settings/
│   ├── admin/                # Admin routes
│   ├── api/                  # API routes
│   │   ├── auth/
│   │   ├── conversations/
│   │   └── ...
│   ├── layout.tsx
│   └── page.tsx
├── components/               # React components
│   ├── ui/                   # Base UI components
│   ├── chat/                 # Feature components
│   └── layout/               # Layout components
├── lib/                      # Utilities and config
│   ├── db/                   # Database
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── auth/                 # Auth utilities
│   └── utils.ts
├── services/                 # Business logic
│   ├── auth.service.ts
│   ├── chat.service.ts
│   └── ...
├── hooks/                    # React hooks
├── types/                    # TypeScript types
└── constants/                # Constants
```

**Directory Guidelines:**

| Directory | Purpose | Naming |
|-----------|---------|--------|
| app/ | Routes and pages | lowercase, kebab-case |
| components/ | React components | PascalCase.tsx |
| lib/ | Utilities | camelCase.ts |
| services/ | Business logic | camelCase.service.ts |
| types/ | Type definitions | camelCase.ts |

> 💡 **Affordance Hint**: Organize code by the affordances it enables, not just by technical type. For example, `services/chat.service.ts` contains the logic that enables all chat-related affordances (create, send, view).

### Phase 5: Design Security Architecture

**Security Layers:**

```
┌─────────────────────────────────────┐
│         Transport Layer             │
│         (HTTPS, HSTS)               │
├─────────────────────────────────────┤
│         Authentication              │
│     (JWT/Session, Password Hash)    │
├─────────────────────────────────────┤
│         Authorization               │
│     (RBAC, Resource Ownership)      │
├─────────────────────────────────────┤
│         Data Protection             │
│   (Encryption, Input Validation)    │
└─────────────────────────────────────┘
```

**Security Requirements Matrix:**

| Layer | Requirement | Implementation |
|-------|-------------|----------------|
| Transport | Encrypted communication | HTTPS only |
| Auth | Password protection | bcrypt hash |
| Auth | Session management | JWT with expiry |
| Authz | Role-based access | user/admin roles |
| Authz | Resource ownership | User ID validation |
| Data | API key protection | AES encryption |
| Data | Input validation | Zod/Pydantic schemas |
| Data | SQL injection | Parameterized queries |
| Data | XSS prevention | React auto-escape |

### Phase 6: Document Technical Decisions

**Architecture Decision Record (ADR) Template:**

```markdown
## ADR-[XXX]: [Title]

**Status:** Proposed/Accepted/Deprecated

**Context:**
[What is the issue that we're seeing that is motivating this decision?]

**Decision:**
[What is the change that we're proposing and/or doing?]

**Consequences:**
[What becomes easier or more difficult to do because of this change?]
```

**Example ADRs:**

| ADR | Title | Decision |
|-----|-------|----------|
| ADR-001 | Framework Selection | Next.js 15 with App Router |
| ADR-002 | Database Choice | PostgreSQL via Neon Serverless |
| ADR-003 | ORM Selection | Drizzle ORM for type safety |
| ADR-004 | API Key Storage | AES-256-GCM encryption |
| ADR-005 | Streaming Response | Server-Sent Events |

## Output Template

```markdown
# System Architecture Document

## 1. Architecture Overview
- Pattern: [Selected pattern]
- Deployment: [Deployment strategy]

## 2. System Diagram
[ASCII or image diagram]

## 3. Subsystems
### 3.1 [Subsystem 1]
### 3.2 [Subsystem 2]
...

## 4. API Design
### 4.1 Authentication APIs
### 4.2 Core APIs
...

## 5. Directory Structure
[Project structure]

## 6. Security Architecture
[Security layers and measures]

## 7. Technical Decisions
### ADR-001: [Title]
...
```

## Quality Checklist

- [ ] Architecture pattern is appropriate for requirements
- [ ] All subsystems have clear responsibilities
- [ ] APIs follow RESTful conventions
- [ ] Directory structure supports modularity
- [ ] Security requirements are addressed
- [ ] Technical decisions are documented
- [ ] Constraints from real.md are incorporated

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| product-requirements | Input: requirements drive architecture |
| database-design | Output: architecture informs schema |
| coding | Output: provides structure for code |
| deployment | Output: architecture affects deployment |

---

## Additional Resources

- **SKILL-affordance-theory.md**: Complete affordance-based architecture perspective (theoretical)
- **MAS-concept.md**: Understanding architecture through Minimum Affordance Stories

---

**Last Updated:** 2025-12-05  
**Document Version:** v3.1 (Practical with Affordance Hints)  
**Maintainer:** 42COG Team
