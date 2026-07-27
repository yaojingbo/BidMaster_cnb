---
name: ui-design
description: "Use when generating frontend UI specifications for Next.js web applications. Creates complete UI spec documents covering layout design, responsive breakpoints, component specifications, state management with Zustand, and mock data planning. Outputs spec/design/ui.spec.md with working functionality using local JSON storage."
depends:
  required:
    - .42cog/meta/meta.md
    - .42cog/real/real.md
    - .42cog/cog/cog.md
  optional:
    - spec/pm/pr.spec.md
    - spec/pm/userstory.spec.md
    - spec/dev/sys.spec.md
generates:
  - spec/design/ui.spec.md
---

# UI Design Skill

## Overview

Generate frontend UI specifications for Next.js web applications with working functionality using local storage. Focus on **immediate usability** - users should see a complete UI on first load.

**Core Principles:**
- **Feature Independence**: Each feature works without configuring others first
- **Rich Mock Data**: Pre-populate stores so UI is immediately testable
- **Local-First Storage**: Use Zustand + localStorage during development
- **Extension Points**: Leave clear interfaces for future database/API integration

---

## ⚠️ MANDATORY: Execute Project Initialization First

> **AI Agent MUST execute this step BEFORE generating any spec document.**

### Step 1: Check if initialization is needed

```bash
# Run this check first
if [ ! -f "package.json" ] || ! grep -q '"next"' package.json 2>/dev/null; then
  echo "INIT_REQUIRED"
else
  echo "INIT_SKIPPED"
fi
```

### Step 2: If INIT_REQUIRED, execute initialization script

```bash
bash .42plugin/42edu/design-ui-design/scripts/init-project.sh
```

### Step 3: Wait for initialization to complete, then proceed to generate spec

**Do NOT proceed to spec generation until initialization is complete!**

---

## When to Use

- Designing UI for AI conversation apps, SaaS tools, admin dashboards
- Creating complete UI specification documents for development reference
- Need frontend pages with local data persistence

**Don't use for:** Database schema design, backend API implementation, authentication systems (use subsequent skills).

## Quick Reference

| Task | Action |
|------|--------|
| Tech stack | Next.js 15+, React 19+, Tailwind CSS v4, shadcn/ui, Zustand |
| Output | `spec/design/ui.spec.md` |
| Mock data examples | See `references/mock-data-examples.md` |
| Store templates | See `references/store-templates.md` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15+ (App Router) |
| UI | React 19+ (Server Components first) |
| Styling | Tailwind CSS v4 (OKLCH colors) |
| Components | shadcn/ui |
| Forms | React Hook Form + Zod |
| State | Zustand + localStorage persist |
| Icons | Lucide React |

**Important:** No Google Fonts (inaccessible in China). Use system font stacks.

---

## Workflow

### Phase 0: Prerequisites

**Required documents (all must exist):**
1. `.42cog/meta/meta.md` - Project meta info
2. `.42cog/real/real.md` - Real-world constraints
3. `.42cog/cog/cog.md` - Cognitive model (agents, entities, flows)

If missing, run: `Call skill: meta-42cog`

**Optional documents** (if exist, use as reference):
- `spec/pm/pr.spec.md` - Product requirements
- `spec/pm/userstory.spec.md` - User stories
- `spec/dev/sys.spec.md` - System architecture

### Phase 1: Intelligent Analysis

Make three key decisions based on context:

#### 1.1 Application Type

| Criteria | SPA | MPA |
|----------|-----|-----|
| Core interaction | Frequent state changes, real-time | Independent modules |
| User tasks | Continuous flow | Discrete tasks |
| Examples | Chat, editors, dashboards | Docs, e-commerce |

#### 1.2 Navigation Structure

| Type | When to Use | Items |
|------|-------------|-------|
| Top nav | Few features, brand important | 3-5 |
| Side nav | Many features, deep hierarchy | 5-10 |
| Bottom nav | Mobile first | 3-5 |
| Hybrid | Complex apps | Top + Side |

#### 1.3 Color Scheme (OKLCH)

| Product Type | Suggested Hue | Emotion |
|--------------|---------------|---------|
| AI Chat/Assistant | 200-280° (Blue/Purple) | Intelligent, trustworthy |
| Productivity Tools | 180-240° (Blue/Green) | Professional, efficient |
| Creative Tools | 270-30° (Purple/Orange) | Innovative, vibrant |

### Phase 2: Design System

**Design Tokens** (Tailwind CSS v4):
```css
@theme inline {
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --radius-md: 0.5rem;
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

**System Font Stack:**
```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
```

### Phase 3: Page Layout

**Responsive Breakpoints:**

| Name | Width | Layout |
|------|-------|--------|
| Mobile | <640px | Single column, bottom nav |
| Tablet | 640-1024px | Collapsible sidebar |
| Desktop | >1024px | Full sidebar |

### Phase 4: Component Specifications

Use shadcn/ui components:
- **Base**: Button, Badge, Card, Avatar
- **Form**: Input, Textarea, Select, Switch (with React Hook Form + Zod)
- **Layout**: Dialog, Sheet, ScrollArea, Separator
- **Navigation**: DropdownMenu, Tabs, Tooltip
- **Feedback**: Skeleton, Sonner (toast)

---

## Critical Principles

### Feature Independence (Required)

Each feature must work immediately without configuring other features first.

**Three Rules:**

1. **No Blocking Dependencies**
   - ❌ BAD: Must configure API key before testing chat
   - ✅ GOOD: Chat works with mock responses by default

2. **Mock by Default, Real When Ready**
   - Store should have `useMockMode: boolean` flag
   - Components check mock mode and use appropriate handler

3. **Visual Feedback for Mock Mode**
   - Show subtle indicator: `🎭 Demo Mode` badge

### Rich Mock Data (Required)

Stores must initialize with mock data, not empty arrays.

**Requirements:**
- 8-10 varied mock items for core entities
- Cover edge cases: long titles, archived items, old dates
- Include mock AI response generator for chat apps
- Pre-configured mock models (no API key required)

**Reference:** See `references/mock-data-examples.md` for complete examples.

### State Management

Use Zustand with persist middleware for automatic localStorage sync.

**Key Pattern:**
```typescript
export const useStore = create<State>()(
  persist(
    (set) => ({
      items: MOCK_DATA,  // Initialize with mock data!
      // ... actions
    }),
    { name: 'storage-key' }
  )
)
```

**Reference:** See `references/store-templates.md` for complete templates.

---

## Output Specification

Generate `spec/design/ui.spec.md` with these sections:

1. **Intelligent Analysis** - App type, navigation, colors
2. **Design System** - Tokens, fonts
3. **Page Layout** - Breakpoints, structure
4. **Component Specs** - shadcn/ui usage
5. **State Management** - Store definitions
6. **Feature Independence** - Mock mode configuration
7. **Mock Data** - Data structure, AI response generator
8. **Core Features** - P0/P1 implementation
9. **Interaction Patterns** - Loading, feedback, empty states
10. **Accessibility** - WCAG checklist
11. **Extension Points** - Database/API migration paths
12. **Acceptance Checklist** - Quality gates

> **Note**: Project initialization is handled by the mandatory step above, not included in the spec output.

**Reference:** See `references/output-template.md` for detailed template.

---

## Quality Checklist

### Prerequisites
- [ ] Three required documents loaded
- [ ] App type judged with rationale
- [ ] Navigation structure determined
- [ ] OKLCH color scheme defined

### Feature Independence (Critical)
- [ ] Each feature works without configuration
- [ ] Mock/fallback behavior for unconfigured dependencies
- [ ] Mock mode indicator visible

### Rich Mock Data (Critical)
- [ ] Stores initialized with mock data (not empty arrays)
- [ ] 8-10 varied mock items for core entities
- [ ] Mock AI response generator included
- [ ] Pre-configured mock models

### Implementation
- [ ] Zustand stores with persist middleware
- [ ] P0 features fully functional with local storage
- [ ] Error handling defined
- [ ] WCAG AA compliant

### Extension Points
- [ ] Database migration path documented
- [ ] API implementation path documented

---

## Resources

### Scripts
- `scripts/init-project.sh` - Initialize Next.js + shadcn/ui project

### References
- `references/mock-data-examples.md` - Mock data code examples
- `references/store-templates.md` - Zustand store templates
- `references/output-template.md` - Output document template

---

## Skill Relationships

| Skill | Relationship |
|-------|--------------|
| meta-42cog | Prerequisite: provides core documents |
| dev-database-design | Subsequent: converts local schema to database |
| dev-coding | Subsequent: implements API based on reservations |
