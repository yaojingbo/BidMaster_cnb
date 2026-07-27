---
name: user-story
description: This skill decomposes product requirements into executable user stories. Based on humanity's three eternal minimal stories (Light, Dark, Grey), it organizes and evaluates story quality, helping create story collections, write user stories, and plan implementation iterations.
depends:
  - real.md
  - cog.md
  - spec-product-requirements.md
generates:
  - spec-user-story.md
---

# User Stories (Based on Three Minimal Stories)

## Overview

This skill transforms product requirements into executable user stories. We adopt traditional user story format but use **humanity's three eternal minimal stories** (Light, Dark, Grey) as an organizing and evaluation framework, ensuring stories are both human-centered and implementation-ready.

> **Core Philosophy**: All complex narratives originate from three minimal stories—Light (bad to good), Dark (good to bad), Grey (cyclical). Good user stories should let users experience these eternal patterns.

> **Note for AI Agents**: This skill generates specification documents for AI/Agent consumption (especially Claude Code), ensuring story implementation has clear user value and testability.

## Prerequisites

Before using this skill, ensure the following foundation documents exist:

1. **real.md** - Reality Constraints Document
2. **cog.md** - Cognitive Model Document
3. **spec-product-requirements.md** - Product Requirements Document

If these files do not exist, invoke the corresponding skills to create them first.

### Pre-execution Checklist

```
[ ] real.md exists in project root or .42cog directory
[ ] cog.md exists in project root or .42cog directory
[ ] spec-product-requirements.md exists and contains core requirements
[ ] User types and their goals have been identified
[ ] Product's core value proposition is understood
```

### Context Loading

From **cog.md**, extract:
- **User Types**: Different user roles
- **User Goals**: What each user type wants to achieve
- **User Capabilities**: Skills and limitations users possess

From **spec-product-requirements.md**, extract:
- **Core Features**: Main features the product provides
- **Feature Priority**: Which features are most important
- **User Value**: Value each feature brings to users

From **real.md**, extract:
- **Boundary Conditions**: Boundaries for user stories
- **Safety Constraints**: Security rules that must be followed
- **Technical Constraints**: Technical limitations for implementation

## Three Minimal Stories Framework

### Story Archetypes

All human narratives can be reduced to three minimal stories:

| Story Type | Pattern | Emotional Arc | User Experience | Product Application |
|-----------|---------|---------------|-----------------|-------------------|
| **Light Story** | Bad to Good | ↗️ Rising | Problem solving, goal achievement | Registration → Successful use |
| **Dark Story** | Good to Bad | ↘️ Falling | Encountering difficulties, needing help | Error handling, exception alerts |
| **Grey Story** | Cyclical | 🔄 Fluctuating | Continuous use, habit formation | Daily operations, repetitive tasks |

### Application in User Stories

**Light Stories (Growth Type)**:
- User goes from "cannot do X" to "can do X"
- From "difficult" to "easy"
- From "don't understand" to "understand"
- Examples: New user registration, first successful operation, skill improvement

**Dark Stories (Challenge Type)**:
- User encounters errors or obstacles
- System helps user identify and resolve problems
- From "normal" to "abnormal" to "recovery"
- Examples: Form validation failure, insufficient permissions, data loss warning

**Grey Stories (Routine Type)**:
- User's repetitive operations
- Need to optimize efficiency and experience
- From "unfamiliar" to "proficient" to "automated"
- Examples: Daily login, routine queries, batch operations

## Story Hierarchy

### Minimal Story (MS)

A minimal story is an **indivisible unit of user value** that can be completed within one iteration.

**Characteristics**:
- Independent and complete user value
- Can be implemented in 1-3 days
- Has clear completion criteria
- User can immediately perceive value

**Numbering Convention**: MS-[Type]-[Number]
- MS-L-01: Light Story 1
- MS-D-01: Dark Story 1
- MS-G-01: Grey Story 1

### Complex Story (CS)

A complex story is a **combination of multiple minimal stories**, forming a complete user journey.

**Characteristics**:
- Contains 3-8 minimal stories
- Spans multiple iterations
- Forms a complete functional module
- Usually mixes multiple story types

**Numbering Convention**: CS-[Number]
- CS-01: User Account Management
- CS-02: Content Creation Flow

## When to Use This Skill

- Decompose product requirements into executable stories
- Create backlog for agile development
- Define acceptance criteria for features
- Plan implementation iterations
- Communicate user value to developers

## Process

### Phase 1: Identify Complex Stories

Extract main user journeys from product requirements to form complex stories.

**Complex Story Template:**

```markdown
## Complex Story: [CS-XX] [Story Name]

**Description:** [Complete user journey this story covers]
**User Type:** [Primary user role]
**Core Value:** [Main value brought to users]

**Story Type Distribution:**
- Light Stories: X (user growth)
- Dark Stories: Y (problem handling)
- Grey Stories: Z (daily use)

**Included Minimal Stories:**
- MS-L-01: Minimal Story 1
- MS-L-02: Minimal Story 2
- MS-D-01: Minimal Story 3
- MS-G-01: Minimal Story 4

**User Journey:**
[Starting Point] → [Key Node 1] → [Key Node 2] → [End Point]
```

**Standard Complex Story Categories:**

| Complex Story | Description | Typical MS Count |
|--------------|-------------|------------------|
| CS-01: User Onboarding | Registration, login, first use | 3-5 |
| CS-02: Core Features | Product's main value features | 5-8 |
| CS-03: User Configuration | Personalization settings | 2-4 |
| CS-04: Admin Features | Administrator operations | 3-6 |

### Phase 2: Write Minimal Stories

**Minimal Story Format:**

```markdown
## Minimal Story: [MS-X-XX] [Title]

**Complex Story:** [CS-XX]
**Story Type:** Light/Dark/Grey
**Priority:** P0/P1/P2
**Story Points:** 1/2/3/5/8

### User Story
As a [user type],
I want to [do something],
So that [achieve goal/gain value].

### Story Evaluation (Based on Three Minimal Stories)

**If Light Story (bad to good):**
- **Starting State**: User's current predicament or limitation
- **Turning Point**: Key capability system provides
- **End State**: Goal achieved or capability gained by user
- **Emotional Experience**: From confusion/restricted → understanding/freedom

**If Dark Story (good to bad):**
- **Starting State**: User's normal operational state
- **Turning Point**: Problem or error that appears
- **End State**: System helps user identify and recover
- **Emotional Experience**: From smooth → blocked → helped

**If Grey Story (cyclical):**
- **Cycle Pattern**: Operations user repeatedly performs
- **Optimization Point**: How to make repetition more efficient
- **Habit Formation**: How to go from unfamiliar to proficient
- **Emotional Experience**: From effortful → easy → automated

### Acceptance Criteria
- AC1: [Testable criterion 1]
- AC2: [Testable criterion 2]
- AC3: [Testable criterion 3]

### User-Perceivable Changes
- **Before Operation**: [What user sees/feels]
- **During Operation**: [What action user performs]
- **After Operation**: [What change user sees/feels]

### Constraints (from real.md)
- [Constraint 1]
- [Constraint 2]

### Dependencies
- **Requires**: [Prerequisite stories]
- **Enables**: [Subsequent stories]
```

**Story Writing Guidelines:**

| Element | Good Example | Bad Example |
|---------|-------------|-------------|
| User Type | "Newly registered user" | "User" |
| Want to Do | "Create first project" | "Use system" |
| Achieve Goal | "Start managing my tasks" | "Be able to work" |
| Acceptance Criteria | "Project created successfully and displayed in list" | "Feature works" |

**INVEST Principles (Maintaining Traditional Best Practices):**
- **I**ndependent: Can be developed and tested independently
- **N**egotiable: Details can be discussed and adjusted
- **V**aluable: Brings clear value to users
- **E**stimable: Work effort can be estimated
- **S**mall: Can be completed within one iteration
- **T**estable: Has clear acceptance criteria

### Phase 3: Define Acceptance Criteria

Each minimal story needs 3-5 testable acceptance criteria.

**Acceptance Criteria Formats:**

**Format 1: Scenario-Based**
```markdown
### Acceptance Criteria

**Scenario 1: Normal Flow**
- Given: [Precondition]
- When: [User action]
- Then: [Expected result]

**Scenario 2: Exception Handling**
- Given: [Exception condition]
- When: [User action]
- Then: [System response]
```

**Format 2: Checklist-Based**
```markdown
### Acceptance Criteria

- [ ] User can see [UI element]
- [ ] After user clicks [button], system [performs action]
- [ ] System displays [feedback message]
- [ ] Data saved to [storage location]
- [ ] User can [subsequent operation]
```

**Criteria Quality Check:**
- [ ] Can be verified through testing
- [ ] User can directly perceive
- [ ] Covers normal and exception cases
- [ ] Complies with constraints in real.md
- [ ] Clearly defines "done" standard

### Phase 4: Create Story Map

Story maps visualize user journeys and determine story priorities.

**Story Map Structure:**

```
User Journey: Onboarding → Using → Mastering → Spreading

Iteration 1 (MVP):
├── CS-01: User Onboarding
│   ├── MS-L-01: Quick Registration (Light)
│   │   └── From "no account" → "has account"
│   ├── MS-L-02: First Login (Light)
│   │   └── From "outside" → "inside"
│   └── MS-D-01: Login Failure Handling (Dark)
│       └── From "smooth" → "blocked" → "recovered"
├── CS-02: Core Features
│   ├── MS-L-03: Create First Project (Light)
│   └── MS-L-04: Complete First Task (Light)

Iteration 2:
├── CS-02: Core Features (continued)
│   ├── MS-G-01: View Project List (Grey)
│   └── MS-G-02: Edit Task (Grey)
├── CS-03: User Configuration
│   └── MS-L-05: Personalization Settings (Light)

Iteration 3:
├── CS-04: Advanced Features
└── CS-05: Collaboration Features
```

**Prioritize by Story Type:**

| Priority | Story Type Mix | Rationale | Decision |
|----------|---------------|-----------|----------|
| P0 | Primarily Light | Users need to see value quickly | Implement first |
| P1 | Light + Dark | Basic features + error handling | Iteration 2 |
| P2 | Primarily Grey | Optimize daily use experience | Later optimization |

### Phase 5: Implementation Planning

**Implementation Plan Template:**

```markdown
## Iteration [N] Plan

**Goal:** [Core goal of this iteration]
**Duration:** [2 weeks]
**Complex Stories:** [CS-XX, CS-YY]

### Minimal Story List

| Story ID | Title | Type | Story Points | Owner |
|----------|-------|------|--------------|-------|
| MS-L-01 | Quick Registration | Light | 3 | Zhang San |
| MS-L-02 | First Login | Light | 2 | Li Si |
| MS-D-01 | Login Failure | Dark | 2 | Wang Wu |

### Story Type Distribution
- Light Stories: 5 (60%) - Main value delivery
- Dark Stories: 2 (25%) - Error handling
- Grey Stories: 1 (15%) - Experience optimization

### Expected User Value
After this iteration, users can:
1. [Completed user journey 1]
2. [Completed user journey 2]
3. [Completed user journey 3]

### Dependencies
- **External**: [API access, design resources]
- **Internal**: [Other team deliverables]

### Risks
- Risk 1: [Description]
  - Mitigation: [Response measures]
```

## Output Template

### User Story Document

```markdown
# User Stories: [Product Name]

## Complex Story Overview

| Complex Story | MS Count | Priority | Story Type Distribution |
|--------------|----------|----------|------------------------|
| CS-01 | 5 | P0 | Light 3, Dark 1, Grey 1 |
| CS-02 | 8 | P0 | Light 4, Dark 2, Grey 2 |

## Grouped by Complex Story

### CS-01: [Name]

#### MS-L-01: [Title]
[Complete minimal story including story evaluation and acceptance criteria]

#### MS-D-01: [Title]
[Complete minimal story including story evaluation and acceptance criteria]

## Story Map

[Visualized user journey and iteration breakdown]

## Implementation Recommendations

[Implementation plan broken down by iterations 1, 2, 3]

## Testing Guide

[How to verify completion criteria for each story]
```

## Quality Checklist

- [ ] All core features have corresponding minimal stories
- [ ] Each minimal story follows INVEST principles
- [ ] Story type distribution is reasonable (primarily Light, supplemented by Dark and Grey)
- [ ] Acceptance criteria are clear and testable
- [ ] Dependencies have been identified
- [ ] Story size is appropriate (1-3 days to complete)
- [ ] Reflects constraints from real.md
- [ ] Story map shows clear user journey
- [ ] Each story has clear user value

## Integration with Other Skills

| Skill | Relationship |
|-------|-------------|
| product-requirements | Input: Requirements transformed into stories |
| system-architecture | Output: Stories influence architecture design |
| ui-design | Output: Stories drive interface design |
| coding | Output: Stories become development tasks |
| quality-assurance | Output: Acceptance criteria become test cases |

---

## Appendix: Deep Understanding of Three Minimal Stories

### Why These Three Stories?

Cognitive science research shows that the human brain is naturally sensitive to these three patterns:

1. **Light Story (Progress Narrative)**
   - Activates brain's reward system
   - Produces dopamine, bringing pleasure
   - Users most easily remember and spread
   - Product examples: First success, skill improvement, problem solving

2. **Dark Story (Crisis Narrative)**
   - Activates brain's alertness system
   - Produces focused attention, promotes learning
   - Helps users establish sense of security
   - Product examples: Error alerts, risk warnings, recovery mechanisms

3. **Grey Story (Cyclical Narrative)**
   - Activates brain's habit system
   - Produces automation, reduces cognitive load
   - Helps users form usage habits
   - Product examples: Daily operations, repetitive tasks, batch processing

### Golden Ratio of Story Types

According to user experience research, the optimal story type distribution is:

| Product Stage | Light | Dark | Grey |
|--------------|-------|------|------|
| MVP Stage | 70% | 20% | 10% |
| Growth Stage | 50% | 30% | 20% |
| Mature Stage | 40% | 20% | 40% |

**Rationale**:
- Early stage needs to quickly demonstrate value (primarily Light)
- Mid stage needs to build trust (increase Dark stories)
- Later stage needs to optimize efficiency (increase Grey stories)

### Simplified Application of Affordance Thinking

While we don't use complex affordance terminology, the core ideas are retained:

| Affordance Concept | Simplified Expression |
|-------------------|----------------------|
| Affordance | What user can do |
| Perception Channel | How user knows they can do it |
| Action | Operation user performs |
| Feedback | Result user sees |

**Reflected in Acceptance Criteria**:
```markdown
- [ ] User can see [button] (perception)
- [ ] After user clicks [button] (action)
- [ ] System displays [result] (feedback)
```

---

**Last Updated**: 2025-12-06
**Document Version**: v3.1 (Based on Three Minimal Stories)
**Maintainer**: 42COG Team
