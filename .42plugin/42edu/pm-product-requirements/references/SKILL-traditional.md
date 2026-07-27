---
name: product-requirements
description: This skill should be used when writing product requirement documents (PRD). It helps define product vision, identify target users, specify functional requirements, establish non-functional requirements, and create acceptance criteria.
depends:
  - real.md
  - cog.md
generates:
  - spec-product-requirements.md
---

# Product Requirements

## Overview

This skill transforms product ideas into comprehensive requirement documents. To create effective PRDs, define product vision, identify target users, specify features with priorities, and establish measurable acceptance criteria.

> **Note for AI Agents**: The generated spec document is designed to be consumed by AI agents (especially Claude Code) to ensure consistent product implementation and reduce trial-and-error during development.

## Prerequisites

Before using this skill, ensure the following foundation documents exist:

1. **real.md** - Reality Constraints Document
2. **cog.md** - Cognitive Model Document

If these documents do not exist, invoke the **meta-42cog** skill first to generate them.

### Pre-execution Checklist

```
[ ] real.md exists in project root or .42cog directory
[ ] cog.md exists in project root or .42cog directory
[ ] Read real.md to understand hard constraints that must be in requirements
[ ] Read cog.md to understand target users and core entities
```

### Context Loading

From **cog.md**, extract:
- Human agents (target user segments)
- Core entities and their relationships
- Information flows between agents and system

From **real.md**, extract:
- Required constraints to include in requirements
- Security and compliance requirements
- Technical environment constraints

## When to Use This Skill

- Starting a new product or feature development
- Documenting existing product requirements
- Creating feature specifications
- Establishing acceptance criteria for development
- Communicating product scope to stakeholders

## Process

### Phase 1: Define Product Overview

**Product Overview Template:**

```markdown
## Product Overview

**Name:** [Product Name]
**Tagline:** [One-line description]
**Version:** [X.Y.Z]

**Description:**
[2-3 sentence description of what the product does and why it matters]

**Target Users:**
- User segment 1
- User segment 2

**Key Value Propositions:**
1. Value 1
2. Value 2
3. Value 3
```

**Questions to Answer:**
- What problem does this product solve?
- Who are the primary users?
- What makes this product unique?
- What are the key success metrics?

### Phase 2: Specify Functional Requirements

Organize features by priority level:

| Priority | Description | Timeline |
|----------|-------------|----------|
| P0 | Must have - core functionality | MVP |
| P1 | Should have - important features | v1.0 |
| P2 | Nice to have - enhancements | Future |

**Feature Specification Template:**

```markdown
## Feature: [Feature ID] [Feature Name]

**Priority:** P0/P1/P2
**Description:** [What this feature does]

### Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| REQ-001 | Requirement description | |
| REQ-002 | Requirement description | |

### Constraints
- Constraint 1 (reference real.md if applicable)
- Constraint 2

### Dependencies
- Depends on: [Other features]
- Required by: [Dependent features]
```

**Standard Feature Categories:**

| Category | Examples |
|----------|----------|
| Authentication | Login, registration, password reset |
| Core Functions | Main product functionality |
| User Management | Profile, settings, preferences |
| Administration | Admin panel, user management |
| Integration | Third-party services, APIs |

### Phase 3: Define Non-Functional Requirements

**Performance Requirements:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page Load | < 3s | First contentful paint |
| API Response | < 500ms | Excluding external calls |
| Concurrent Users | 100+ | Without degradation |

**Security Requirements:**

| Requirement | Implementation |
|-------------|----------------|
| Data Encryption | HTTPS, encrypted storage |
| Authentication | JWT/Session with expiry |
| Authorization | Role-based access control |
| Input Validation | Server-side validation |

**Usability Requirements:**

| Requirement | Target |
|-------------|--------|
| Responsive Design | Mobile + Desktop |
| Accessibility | WCAG 2.1 AA |
| Browser Support | Modern browsers (2 years) |

**Availability Requirements:**

| Metric | Target |
|--------|--------|
| Uptime | 99% |
| Recovery Time | < 1 hour |
| Backup Frequency | Daily |

### Phase 4: Establish Technical Constraints

Document technical decisions that constrain implementation:

```markdown
## Technical Constraints

**Frontend:**
- Framework: [e.g., Next.js 15 + React 19]
- Styling: [e.g., Tailwind CSS + shadcn/ui]
- Language: [e.g., TypeScript]

**Backend:**
- Runtime: [e.g., Node.js / Edge Runtime]
- API Style: [e.g., REST / GraphQL]
- Database: [e.g., PostgreSQL]

**Infrastructure:**
- Hosting: [e.g., Vercel]
- Database: [e.g., Neon Serverless]
- CDN: [e.g., Vercel Edge Network]
```

### Phase 5: Create Acceptance Criteria

For each feature, define measurable acceptance criteria:

**Acceptance Criteria Template:**

```markdown
## Acceptance Criteria

### Feature: [Feature Name]

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-1 | [Testable criterion] | Critical |
| AC-2 | [Testable criterion] | High |
| AC-3 | [Testable criterion] | Medium |
```

**Criteria Guidelines:**
- Use "Given-When-Then" format when helpful
- Make criteria testable and unambiguous
- Include both positive and negative cases
- Reference constraints from real.md

**Example:**

```markdown
### Feature: User Registration

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-1 | User can register with email and password | Critical |
| AC-2 | Password is stored using bcrypt hash | Critical |
| AC-3 | First registered user becomes admin | Critical |
| AC-4 | Duplicate email shows clear error | High |
| AC-5 | Password strength indicator displayed | Medium |
```

## PRD Document Structure

```markdown
# Product Requirements Document

## 1. Product Overview
- Name, tagline, version
- Description
- Target users
- Value propositions

## 2. Functional Requirements
### 2.1 Feature Category 1 (P0)
### 2.2 Feature Category 2 (P1)
### 2.3 Feature Category 3 (P2)

## 3. Non-Functional Requirements
### 3.1 Performance
### 3.2 Security
### 3.3 Usability
### 3.4 Availability

## 4. Technical Constraints
- Frontend stack
- Backend stack
- Infrastructure

## 5. Acceptance Criteria
- Per-feature criteria
- Integration criteria

## 6. Out of Scope
- Explicitly excluded features

## 7. Appendix
- Glossary
- References
```

## Quality Checklist

- [ ] Product vision is clear and compelling
- [ ] Target users are well-defined
- [ ] All P0 features have complete requirements
- [ ] Non-functional requirements are measurable
- [ ] Technical constraints are documented
- [ ] Acceptance criteria are testable
- [ ] Out of scope is explicitly stated
- [ ] Constraints from real.md are referenced

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| user-simulation | Input: provides user personas |
| user-story | Output: features become user stories |
| system-architecture | Output: requirements drive architecture |
| quality-assurance | Output: acceptance criteria become tests |
