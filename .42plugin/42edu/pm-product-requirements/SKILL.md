---
name: product-requirements
description: This skill should be used when writing product requirement documents (PRD) based on affordance theory. It helps define environmental affordances, identify action possibilities, specify interaction design, and establish perception-action coupling.
depends:
  - real.md
  - cog.md
generates:
  - spec-product-requirements.md
---

# Product Requirements (Affordance-Driven)

## Overview

This skill transforms product ideas into comprehensive requirement documents **centered on affordances** - the action possibilities that the environment (product) offers to agents (users). Rather than focusing on abstract features, we define what **actions the product environment invites, supports, and constrains**.

> **Core Philosophy**: In the AI era, products are environments that afford specific actions. Great products make affordances **perceivable, learnable, and exploitable** by both humans and AI agents.

> **Note for AI Agents**: The generated spec document is designed to be consumed by AI agents (especially Claude Code) to ensure consistent product implementation with clear affordance structures.

## Prerequisites

Before using this skill, ensure the following foundation documents exist:

1. **real.md** - Reality Constraints Document
2. **cog.md** - Cognitive Model Document

If these documents do not exist, invoke the **meta-42cog** skill first to generate them.

### Pre-execution Checklist

```
[ ] real.md exists in project root or .42cog directory
[ ] cog.md exists in project root or .42cog directory
[ ] Read real.md to understand environmental constraints
[ ] Read cog.md to understand agents and their capabilities
```

### Context Loading

From **cog.md**, extract:
- **Agents** (human and AI) and their action capabilities
- **Goals** and typical action sequences
- **Perception systems** (what agents can sense)

From **real.md**, extract:
- **Physical constraints** that limit possible actions
- **Environmental invariants** that shape affordances
- **Safety boundaries** that constrain action spaces

## Affordance Theory Foundation

### Gibson's Core Concepts

**Affordance**: The relationship between an environmental property and an agent's action capabilities.

- **Objective**: Exists independent of agent's perception
- **Relational**: Depends on both environment and agent
- **Actionable**: Directly linked to possible actions

**Examples**:
- A button **affords pressing** (to agents with fingers or pointing devices)
- A search box **affords querying** (to agents with text input capability)
- A file upload area **affords dragging** (to agents with drag-drop capability)

### Affordance vs. Usability

| Dimension | Affordance-Driven | Usability-Driven |
|-----------|-------------------|------------------|
| **Focus** | What actions the environment invites | How easy features are to use |
| **Starting Point** | Agent-environment coupling | User interface design |
| **Core Question** | "What can be done here?" | "How usable is this?" |
| **Design Driver** | Action possibilities | Efficiency & satisfaction |
| **Measurement** | Perception-action directness | Task completion metrics |

### Why Affordance Matters in AI Era

1. **AI-Human Equivalence**: AI agents perceive affordances through APIs, DOM structures, and semantic markup - same environmental cues, different perception systems
2. **Context-Action Coupling**: Affordances encode action possibilities directly in the environment, reducing need for explicit instructions
3. **Discoverability**: Well-designed affordances are self-evident, minimizing learning curves for both humans and AI
4. **Composability**: Complex behaviors emerge from composing simple, well-defined affordances


## 🚀 Quick Start: Traditional → Affordance Mapping

**If you're familiar with traditional PRDs**, here's how to map concepts:

| Traditional Concept | Affordance Equivalent | Quick Tip |
|---------------------|----------------------|-----------|
| **Feature** | Affordance (action possibility) | Ask: "What action does this enable?" |
| **MVP** | MAS-1 (first complete story) | Focus on one meaningful narrative |
| **User** | Agent (human/AI/both) | Consider both perception channels |
| **Use case** | Affordance sequence | Chain of perceive → act → feedback |
| **Priority (P0/P1/P2)** | MAS-1/MAS-2/MAS-3 | Story completeness, not features |
| **Acceptance criteria** | Perception criteria | Test: Is it perceivable? Executable? |

**30-Second Decision Tree:**

```
Are you comfortable with new paradigms?
├─ Yes → Use this version (affordance + MAS)
│         Benefits: Richer thinking, AI-ready, meaning-driven
└─ No  → Use traditional MVP approach
          Benefits: Familiar, proven, stakeholder-friendly
```

**Want both?** Write affordance-driven PRD first (deeper thinking), then extract traditional PRD for stakeholders.

> 💡 **Pro tip**: Even if you use traditional format, understanding affordances will make your requirements clearer and more actionable.

---

## 🔄 Using Traditional MVP Approach

**When the user explicitly requests traditional MVP-style PRD**, follow these steps:

1. **Load the traditional skill reference:**
   ```
   Read file: references/SKILL-traditional.md
   ```

2. **Follow the traditional 5-stage process:**
   - Stage 1: Define Product Overview
   - Stage 2: Specify Functional Requirements (P0/P1/P2 prioritization)
   - Stage 3: Define Non-Functional Requirements
   - Stage 4: Establish Technical Constraints
   - Stage 5: Create Acceptance Criteria

3. **Generate traditional PRD format** as specified in the reference file

**Trigger phrases for traditional approach:**
- "Use traditional PRD format"
- "Generate MVP-style requirements"
- "I prefer the familiar PRD structure"
- "Use P0/P1/P2 prioritization"
- "Follow traditional product requirements"

**Note:** The traditional approach is available in `references/SKILL-traditional.md` (English) and `references/SKILL-traditional.zh.md` (Chinese) for reference.

---
## When to Use This Skill
## MAS: Minimum Affordance Story

### From MVP to MAS

Traditional product development focuses on **MVP (Minimum Viable Product)** - the smallest product that delivers value. In the AI era and affordance-driven design, we introduce **MAS (Minimum Affordance Story)** - the smallest coherent narrative of action possibilities that generates meaning.

**Paradigm Comparison:**

| Dimension | MVP (Minimum Viable Product) | MAS (Minimum Affordance Story) |
|-----------|------------------------------|--------------------------------|
| **Measurement** | Value (utility) | Meaning (significance) |
| **Interaction Focus** | Usability (ease of use) | Affordance (action possibility) |
| **External Form** | Product (artifact) | Story (narrative) |
| **Evolution Path** | Trial-and-error, bottom-up | Deduction, top-down, biomimicry |
| **Influence Strategy** | Extrinsic rewards | Intrinsic motivation (interest, passion) |
| **Success Criterion** | Market validation | Meaning resonance |
| **Agent Relationship** | User consumes product | Agent inhabits environment |
| **Design Question** | "Is this useful?" | "Does this invite meaningful action?" |

### Core Principles of MAS

**1. Meaning Over Value**

- MVP asks: "Does this solve a problem?"
- MAS asks: "Does this action sequence create meaning?"
- Meaning emerges from coherent affordance narratives, not isolated features

**2. Story Over Product**

- MVP delivers a product (object)
- MAS delivers a story (experience)
- Stories are sequences of affordances that agents can enact
- Each MAS is a complete narrative arc: perceive → act → transform → reflect

**3. Deduction Over Trial-and-Error**

- MVP: Build → Measure → Learn (inductive, empirical)
- MAS: Story → Affordances → Implementation (deductive, principled)
- MAS derives from first principles of perception-action coupling
- Evolution follows natural patterns (biomimicry)

**4. Intrinsic Over Extrinsic**

- MVP optimizes for external metrics (conversion, retention, revenue)
- MAS optimizes for internal experience (interest, mastery, passion)
- Affordances that align with intrinsic motivation create sustained engagement

### MAS Structure

A Minimum Affordance Story consists of:

```
Story Theme: [What meaningful transformation this enables]
  ↓
Core Affordance Sequence: [Chain of perceivable actions]
  ↓
Meaning Closure: [How the sequence creates significance]
```

**Example MAS for a Writing Tool:**

```markdown
## MAS-01: Capture Fleeting Thought

**Story Theme:** 
Transform a fleeting thought into a permanent note before it vanishes

**Core Affordance Sequence:**
1. Entry affordance: One-tap note creation (perceive: floating button)
2. Capture affordance: Voice or text input (perceive: input field)
3. Closure affordance: Auto-save on pause (perceive: fade-out animation)

**Meaning Closure:**
The thought, once ephemeral, is now persistent. The agent has extended their memory.

**Intrinsic Motivation:**
- Interest: Capturing insights feels rewarding
- Mastery: Getting better at externalizing thoughts
- Autonomy: No forced categorization or structure

**Not Included (Out of Scope):**
- Search (different story: "Rediscover Past Insights")
- Sharing (different story: "Collaborate on Ideas")
- Formatting (different story: "Refine Expression")
```

### MAS vs. MVP in Practice

**MVP Thinking:**
"Our minimum viable product needs login, note creation, and a list view. Let's launch and see if users like it."

**MAS Thinking:**
"Our first affordance story is 'Capture Fleeting Thought.' What is the absolute minimum affordance sequence that makes this story complete and meaningful? Login isn't part of this story - deferring authentication maintains story flow."

### MAS Prioritization

Replace traditional feature prioritization with **story prioritization**:

| Priority | MAS Criteria | Traditional MVP Criteria |
|----------|--------------|-------------------------|
| **MAS-1** | Most fundamental story, enables other stories | Core value proposition |
| **MAS-2** | Story that compounds with MAS-1 | Important feature |
| **MAS-3** | Story for advanced agents | Nice-to-have enhancement |

**Story Dependencies:**

```
MAS-1: Capture Thought
  ↓ (enables)
MAS-2: Rediscover Thought
  ↓ (enables)
MAS-3: Connect Thoughts
  ↓ (enables)
MAS-4: Share Insight
```

Each story is complete on its own, yet enables richer stories.

### Implementing MAS in Product Requirements

When defining product requirements with MAS:

1. **Identify Core Stories (not features)**
   - What meaningful transformations do agents seek?
   - What complete narrative arcs exist?

2. **Design Affordance Sequences (not feature lists)**
   - What perception-action-feedback loops tell each story?
   - What is the absolute minimum to close the narrative?

3. **Validate Meaning (not utility)**
   - Does completing this story create significance?
   - Do agents return because of intrinsic motivation?

4. **Evolve Through Deduction (not iteration)**
   - What is the next logical story extension?
   - What does nature/cognition tell us about story progression?

### MAS in Affordance Hierarchy

MAS maps onto affordance levels:

| MAS | Affordance Level | Story Completion |
|-----|------------------|------------------|
| MAS-1 | Primary affordances only | One complete story |
| MAS-2 | Primary + Secondary | Story with nuance |
| MAS-3 | All levels | Story with mastery path |

**Critical Insight:**

- MVP thinks in **features**: "Add search functionality"
- MAS thinks in **stories**: "Enable the story of rediscovering forgotten insights through search affordance"

The affordance (search) is the same, but MAS embeds it in a meaningful narrative that guides design decisions (e.g., search should surface serendipitous connections, not just exact matches).

---

**Remember:** Products are built. Stories are told. In the AI era, agents don't want products - they want to be protagonists in meaningful stories.

- Starting a new product or feature development
- Redesigning interaction models
- Creating AI-agent-friendly interfaces
- Defining multi-modal interaction patterns
- Establishing clear action spaces

## Process

### Phase 1: Define Product Environment

**Product Environment Template:**

```markdown
## Product Environment

**Name:** [Product Name]
**Tagline:** [Action-oriented description: "A place to...", "An environment for..."]
**Version:** [X.Y.Z]

**Environmental Description:**
[2-3 sentences describing the **action space** this product creates]

**Primary Agents:**
- Agent type 1 (with their action capabilities)
- Agent type 2 (with their action capabilities)

**Core Affordances:**
1. Primary affordance (enables action X)
2. Secondary affordance (enables action Y)
3. Supporting affordance (enables action Z)
```

**Questions to Answer:**
- What action space does this product create?
- What agents will act in this environment?
- What are the fundamental action possibilities?
- How do agents perceive these possibilities?

### Phase 2: Specify Affordance Structures

Organize by **MAS (Minimum Affordance Story)** - story-driven prioritization:

| Priority | Description | Story Completeness |
|----------|-------------|-------------------|
| **MAS-1** | First complete affordance story - enables all other stories | Fundamental narrative |
| **MAS-2** | Second story that compounds with MAS-1 | Complementary narrative |
| **MAS-3** | Advanced stories for mastery | Enrichment narrative |

**MAS Prioritization Framework:**

Instead of isolated affordances, organize by **complete stories**:

```markdown
## MAS-[N]: [Story Title]

**Story Theme:** [What meaningful transformation this enables]

**Core Affordance Sequence:**
1. [Affordance 1]: [Action enabled] (perceive: [signifier])
2. [Affordance 2]: [Action enabled] (perceive: [signifier])
3. [Affordance 3]: [Action enabled] (perceive: [signifier])

**Meaning Closure:**
[How this sequence creates significance for the agent]

**Intrinsic Motivation:**
- Interest: [What makes this engaging]
- Mastery: [How agents improve through repetition]
- Autonomy: [What choices agents have]

**Story Dependencies:**
- Enables: [What stories become possible after this]
- Requires: [What stories must exist before this]

**Out of Scope:**
- [Actions deliberately excluded to keep story coherent]
```

**Affordance Hierarchy Within Each MAS:**

| Level | Description | Perceivability | Story Role |
|-------|-------------|----------------|------------|
| **Primary** | Core actions - must be immediately perceivable | High | Story driver |
| **Secondary** | Supporting actions - revealed through interaction | Medium | Story enhancement |
| **Latent** | Advanced actions - discovered through exploration | Low | Story mastery |

**Affordance Specification Template:**
```markdown
## Affordance: [Affordance ID] [Affordance Name]

**Level:** Primary/Secondary/Latent
**Action Enabled:** [Specific action this affords]

### Environmental Properties

| Property | Value | Perceivable By |
|----------|-------|----------------|
| Visual cue | Description | Human |
| Semantic markup | Description | AI Agent |
| Interaction pattern | Description | Both |

### Agent Requirements

| Agent Type | Required Capabilities |
|------------|----------------------|
| Human | Vision, pointing device |
| AI Agent | DOM access, click capability |

### Perception-Action Coupling

**Human Perception:**
- **See**: [What visual cues indicate this affordance]
- **Do**: [What action is invited]
- **Feedback**: [What confirms action was taken]

**AI Perception:**
- **Detect**: [What semantic/structural cues indicate this affordance]
- **Execute**: [What API/interaction method to use]
- **Verify**: [What state change confirms success]

### Constraints
- Constraint 1 (from real.md)
- Constraint 2

### Dependencies
- **Requires**: [Prior affordances that must exist]
- **Enables**: [Subsequent affordances this makes possible]
```

**Standard Affordance Categories:**

| Category | Example Affordances |
|----------|---------------------|
| **Entry** | Sign up, log in, guest access |
| **Creation** | Write, upload, compose, generate |
| **Manipulation** | Edit, move, resize, transform |
| **Navigation** | Browse, search, filter, jump |
| **Communication** | Message, share, comment, notify |
| **Organization** | Tag, categorize, group, archive |
| **Observation** | View, preview, inspect, monitor |

### Phase 3: Define Environmental Constraints

Environmental constraints shape the **affordance landscape**:

**Physical Constraints:**

| Constraint | Impact on Affordances |
|------------|----------------------|
| Screen size | Limits simultaneous affordances |
| Input methods | Defines interaction affordances |
| Network latency | Affects real-time affordances |

**Structural Constraints:**

| Constraint | Impact on Affordances |
|------------|----------------------|
| Data model | Defines what can be manipulated |
| Access control | Limits action availability by agent |
| State dependencies | Sequences affordance availability |

**Safety Constraints (from real.md):**

| Constraint | Affordance Limitations |
|------------|----------------------|
| Data privacy | Some data not afforded to all agents |
| Rate limiting | Actions artificially constrained |
| Validation rules | Constrain action parameters |

### Phase 4: Establish Perception Channels

How agents **discover and recognize** affordances:

**For Human Agents:**

```markdown
### Visual Affordances

| Element | Perceived Action | Design Pattern |
|---------|-----------------|----------------|
| Button | Pressable | Raised, shadowed, labeled |
| Input field | Typeable | Bordered, placeholder text |
| Drag handle | Moveable | Grip icon, cursor change |
| Link | Navigable | Colored, underlined |
```

**For AI Agents:**

```markdown
### Semantic Affordances

| Element | Semantic Marker | Perceived Action |
|---------|----------------|------------------|
| `<button>` | role="button" | Clickable action |
| `<input>` | type="text" | Text entry point |
| `aria-label` | Descriptive text | Action purpose |
| `data-action` | Action identifier | Specific behavior |
```

**For Multi-Modal Agents:**

```markdown
### Cross-Modal Affordances

| Affordance | Human Channel | AI Channel | Unified Action |
|------------|---------------|------------|----------------|
| Submit form | Click button | POST to endpoint | Data submission |
| Upload file | Drag-drop | File API call | File storage |
| Search | Type + Enter | Query parameter | Content retrieval |
```

### Phase 5: Define Feedback Mechanisms

Affordances require **clear feedback** to close the perception-action loop:

**Immediate Feedback (< 100ms):**

| Action | Human Feedback | AI Feedback |
|--------|---------------|-------------|
| Click | Visual state change | DOM update event |
| Type | Character appears | Value change event |
| Drag | Element follows cursor | Position update |

**Progressive Feedback (< 1s):**

| Action | Human Feedback | AI Feedback |
|--------|---------------|-------------|
| Form submit | Loading indicator | Pending state |
| File upload | Progress bar | Upload progress event |
| Save | "Saving..." message | State transition |

**Completion Feedback (< 5s):**

| Action | Human Feedback | AI Feedback |
|--------|---------------|-------------|
| Form submit | Success message | Response data |
| File upload | "Upload complete" | Success callback |
| Save | "Saved" confirmation | State confirmed |

### Phase 6: Create Affordance Acceptance Criteria

**Acceptance Criteria Template:**

```markdown
## Affordance Validation

### Affordance: [Affordance Name]

| ID | Criterion | Human Test | AI Test |
|----|-----------|------------|---------|
| AFF-1 | Affordance is perceivable | Visual inspection | Semantic check |
| AFF-2 | Action is executable | User interaction | API call |
| AFF-3 | Feedback is clear | User confirmation | State verification |
| AFF-4 | Constraints respected | Boundary testing | Validation check |
```

**Example:**

```markdown
### Affordance: File Upload

| ID | Criterion | Human Test | AI Test |
|----|-----------|------------|---------|
| AFF-1 | Upload area is visible | User sees drop zone | Element has dropzone attribute |
| AFF-2 | Drag-drop works | User can drag file | FileReader API available |
| AFF-3 | Progress shown | User sees upload % | Progress events fire |
| AFF-4 | File type validated | Only images accepted | MIME type checked |
| AFF-5 | Size limit enforced | 10MB max shown | 413 error on exceed |
```

## PRD Document Structure (Affordance-Driven)

```markdown
# Product Requirements Document (Affordance-Driven)

## 1. Product Environment
- Name, tagline, version
- Action space description
- Primary agents
- Core affordances

## 2. Affordance Catalog
### 2.1 Primary Affordances (Immediately Perceivable)
### 2.2 Secondary Affordances (Revealed Through Interaction)
### 2.3 Latent Affordances (Discovered Through Exploration)

## 3. Environmental Constraints
### 3.1 Physical Constraints
### 3.2 Structural Constraints
### 3.3 Safety Constraints (from real.md)

## 4. Perception Channels
### 4.1 Visual Affordances (Human)
### 4.2 Semantic Affordances (AI)
### 4.3 Cross-Modal Affordances (Both)

## 5. Feedback Mechanisms
- Immediate feedback (< 100ms)
- Progressive feedback (< 1s)
- Completion feedback (< 5s)

## 6. Affordance Acceptance Criteria
- Per-affordance validation
- Cross-affordance interactions

## 7. Non-Affordances (Explicitly Prevented Actions)
- Actions deliberately not supported
- Rationale for each

## 8. Technical Implementation
- Frontend affordance rendering
- Backend affordance support
- Infrastructure requirements

## 9. Appendix
### 9.1 Affordance Theory Reference
### 9.2 Glossary
### 9.3 Traditional Usability Mapping (for reference)
```

## Quality Checklist

- [ ] Core affordances are clearly defined
- [ ] Each affordance specifies what action it enables
- [ ] Perception channels defined for both humans and AI
- [ ] Feedback mechanisms close the perception-action loop
- [ ] Environmental constraints are documented (from real.md)
- [ ] Acceptance criteria test affordance perceivability
- [ ] Non-affordances explicitly prevent confusion
- [ ] Agent capabilities matched to affordance requirements

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| user-simulation | Input: Provides agent action capabilities |
| user-story | Output: Affordances become action scenarios |
| system-architecture | Output: Affordance structures drive architecture |
| interface-design | Output: Visual/semantic affordance implementation |
| quality-assurance | Output: Affordance validation tests |

---

## Appendix: From Usability to Affordance

### Traditional Usability Framework (For Reference)

The traditional usability-focused approach (preserved for teams transitioning to affordance-driven design):

<details>
<summary>Click to expand: Traditional Usability Requirements Template</summary>

#### Usability Requirements

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

**Accessibility Requirements:**

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

</details>

### Mapping Table: Usability → Affordance

| Usability Concept | Affordance Equivalent |
|-------------------|----------------------|
| Feature | Affordance (action possibility) |
| User flow | Affordance sequence |
| UI element | Affordance signifier |
| Interaction design | Perception-action coupling |
| Error message | Constraint feedback |
| Help text | Affordance clarification |
| Loading state | Progressive affordance |

### Why the Shift Matters

**Traditional thinking**: "We need a button that users can easily click"
**Affordance thinking**: "This environment affords submitting - perceivable through button (human) and form action (AI)"

**Traditional thinking**: "The search feature should be user-friendly"
**Affordance thinking**: "This environment affords querying - through search box (visual), input element (semantic), and search API (programmatic)"

The affordance perspective **unifies** human and AI interaction by focusing on the **action possibilities** the environment provides, rather than on separate "user interface" and "API" designs.

---

**Last Updated:** 2025-12-05
**Document Version:** v3.0 (Affordance-Driven)
**Maintainer:** 42COG Team
