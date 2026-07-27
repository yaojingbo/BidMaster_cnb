---
name: admin-business
description: "Use when generating or enhancing business-specific admin dashboards - automatically detects if admin exists, then either generates complete admin backend or adds BI reports module with decision dashboard, 4减4增 analytics, and data-driven insights following the Next.js + Shadcn-ui stack. v3.3 adds smart seed data generation based on business context."
version: 3.3.0
depends:
  - .42cog/real/real.md
  - .42cog/cog/cog.md
generates:
  - .42cog/spec/admin-{business}.spec.md
  - src/admin/
  - src/admin/scripts/seed/
  - src/admin/app/reports/
reference: https://github.com/arhamkhnz/next-shadcn-admin-dashboard
---

> **AI Agent Note**: This skill generates or enhances admin dashboards based on business context. **v3.2 adds intelligent detection**: if admin exists, it adds BI reports module; if not, generates complete admin. Reports follow the 4减4增 framework for data-driven decision making. **v3.3 adds smart seed generation** with context-aware test data creation based on detected business entities.

## Overview

Generate or enhance admin backends based on business context. **v3.3 introduces smart seed generation capability**:

**Mode A - Full Generation** (no admin exists):
- Complete admin backend with all features from v3.1

**Mode B - BI Reports Enhancement** (admin exists):
- **[v3.2 NEW]** Decision Dashboard (决策驾驶舱)
- **[v3.2 NEW]** 4减4增 Analytics Framework
- **[v3.2 NEW]** Conversion Funnel Reports (R1)
- **[v3.2 NEW]** Revenue Analytics (R2)
- **[v3.2 NEW]** Retention & Churn Analysis (R3)
- **[v3.2 NEW]** Referral Tracking (R4)
- **[v3.2 NEW]** Cost Monitoring (C1-C4)

**Core Features** (all versions):
- Business-specific entity management pages
- Full CRUD operations with soft delete
- Action menu for row-level operations
- Workflows aligned with business processes
- Role-based access control for business rules

## Tech Stack

> Reference: https://github.com/arhamkhnz/next-shadcn-admin-dashboard

| Category | Technology | Description |
|----------|------------|-------------|
| Framework | Next.js 14 | App Router |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS | Atomic CSS |
| Components | Shadcn-ui | Customizable components |
| Validation | Zod | Schema validation |
| State | Zustand | Lightweight state management |
| URL State | Nuqs | Search params management |
| Database | Neon | Serverless PostgreSQL |
| Auth | Neon Auth | Authentication solution |
| Tables | TanStack Tables | Data tables |
| Forms | React Hook Form | Form handling |
| Command Palette | kbar | Command+K interface |
| Linting | ESLint + Prettier | Code quality |
| Git Hooks | Husky | Pre-commit checks |

## Workflow

### Phase 0: Admin Detection [v3.2 NEW]

**First, automatically detect if admin already exists:**

```markdown
## Detection Checklist

1. **Directory Structure Check**
   - [ ] src/admin/ exists?
   - [ ] src/app/admin/ exists?
   - [ ] src/app/(admin)/ exists?

2. **Route Check**
   - [ ] /admin route defined?
   - [ ] Admin layout.tsx exists?
   - [ ] Admin page.tsx exists?

3. **Feature Check**
   - [ ] Dashboard component exists?
   - [ ] User management exists?
   - [ ] Entity CRUD pages exist?

4. **Database Check**
   - [ ] Admin-specific tables exist? (audit_logs, admin_users, etc.)
```

**Detection Output:**

```toml
[detection]
admin_exists = {true|false}
admin_path = "{detected path or null}"
existing_features = ["{feature1}", "{feature2}"]
missing_features = ["{feature1}", "{feature2}"]
recommended_mode = "{full_generation|bi_enhancement}"
```

**Mode Selection:**

| Condition | Mode | Action |
|-----------|------|--------|
| No admin found | Mode A: Full Generation | Execute Phase 1-5 (complete admin) |
| Admin exists, no reports | Mode B: BI Enhancement | Execute Phase 6 only (add reports) |
| Admin exists with reports | Mode C: Report Upgrade | Enhance existing reports |

### Phase 1: Business Context Collection

**First, ask the user these questions:**

```markdown
## Business Context Questionnaire

1. **Business Type**: What type of product/service is this?
   - Examples: personal blog, e-commerce platform, logistics system, SaaS tool, online education...

2. **Core Entities**: What are the 3-5 most important entities in this business?
   - Examples: users, articles, orders, products, courses...

3. **User Roles**: What admin roles exist? What are their responsibilities?
   - Examples: super admin, content editor, customer service, finance...

4. **Key Workflows**: What are the most frequent daily management operations?
   - Examples: content review, order processing, ticket handling...

5. **Data Reporting Needs**: What core metrics need to be tracked?
   - Examples: DAU, conversion rate, revenue, inventory...
```

### Phase 2: Business Entity Modeling

**Based on collected information, generate business cognitive expression:**

```toml
# Business Cognitive Expression Template

[business]
name = "{business_name}"
type = "{business_type}"  # blog | ecommerce | logistics | saas | education | ...
domain = "admin.{project}.com"

[business.entities]
primary = ["{entity1}", "{entity2}", "{entity3}"]
secondary = ["{entity4}", "{entity5}"]

[business.roles]
super_admin = ["*"]
{role1} = ["{entity1}:*", "{entity2}:read"]
{role2} = ["{entity3}:read", "{entity3}:update"]

[business.workflows]
{workflow1} = ["{step1}", "{step2}", "{step3}"]
{workflow2} = ["{step1}", "{step2}"]

[business.metrics]
kpi = ["{metric1}", "{metric2}", "{metric3}", "{metric4}"]
```

### Phase 3: Business Template Matching

**Select base template based on business type, then customize:**

| Type | Core Entities | Key Pages |
|------|---------------|-----------|
| blog | posts, categories, tags, comments, media | Post editor, comment moderation |
| ecommerce | products, orders, customers, coupons, inventory | Order processing, inventory alerts |
| logistics | shipments, tracks, stations, drivers, vehicles | Dispatch center, exception handling |
| saas | tenants, users, plans, subscriptions, tickets | Tenant management, billing |
| education | courses, sections, lessons, students, enrollments | Course builder, progress tracking |

See `references/business-templates.md` for detailed entity definitions.

### Phase 4: Code Generation

**Generate code structure based on business model:**

```
src/admin/
├── app/
│   ├── layout.tsx              # Admin layout
│   ├── page.tsx                # Dashboard
│   ├── login/page.tsx          # Login page
│   ├── {entity1}/              # Entity 1 management
│   │   ├── page.tsx            # List page
│   │   ├── new/page.tsx        # Create page
│   │   └── [id]/page.tsx       # Detail/Edit page
│   ├── {entity2}/              # Entity 2 management
│   │   └── ...
│   ├── reports/page.tsx        # Data reports
│   ├── settings/page.tsx       # System settings
│   └── audit-logs/page.tsx     # Audit logs
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx         # Sidebar (dynamic menu)
│   │   └── header.tsx          # Header
│   ├── {entity1}/              # Entity 1 components
│   │   ├── columns.tsx         # Table column definitions
│   │   ├── form.tsx            # Form component
│   │   └── actions.tsx         # Action buttons
│   └── shared/
│       ├── data-table.tsx      # Generic data table
│       ├── status-badge.tsx    # Status badge
│       └── confirm-dialog.tsx  # Confirmation dialog
├── lib/
│   ├── db.ts                   # Database connection
│   ├── auth.ts                 # Auth logic
│   ├── mask.ts                 # Data masking
│   └── audit.ts                # Audit logging
└── types/
    └── {business}.ts           # Business type definitions
```

### Phase 5: Universal Constraints Check (4+3 Framework)

**All generated admin backends must satisfy these constraints.**

> **4+3 Constraint Structure**: Aligns with working memory capacity (4±1 items). For typical personal applications, 4+3 constraints are sufficient. For complex applications, use layered constraints: project-level, subsystem-level, module-level.

#### Required Constraints (4 items, non-negotiable)

```markdown
## A1: Independent Entry
- Reality Constraint: Admin uses independent subdomain (admin.xxx.com)
- Rationale: Security isolation, clear permissions, independent deployment
- Reference: WeChat Work uses admin.work.weixin.qq.com, Aliyun uses account.aliyun.com

## A2: Independent Login
- Reality Constraint: No shared frontend session, requires admin-specific credentials
- Rationale: Permission separation, prevent regular users from accessing admin

## A3: Data Masking
- Reality Constraint: Sensitive info (email, phone, address) partially masked
- Format: Phone displayed as 138****5678, email as ab***@gmail.com
- Rationale: User privacy protection, compliance requirements (GDPR, data protection laws)

## A4: Audit Logging
- Reality Constraint: Record all admin operations (actor, timestamp, action type, changes)
- Rationale: Compliance traceability, troubleshooting, prevent misoperations
```

#### Optional Constraints (3 items, recommended)

```markdown
## A5: UI Theme
- Constraint: Support light/dark mode toggle
- Rationale: User preference, reduced eye strain for long sessions
- Implementation: next-themes or CSS variables

## A6: Left Sidebar Navigation
- Constraint: Navigation positioned on left side
- Rationale: Established user habit, follows admin dashboard conventions
- Implementation: Collapsible sidebar with icon-only mode

## A7: List Pagination
- Constraint: Paginated lists, default 20 items per page
- Rationale: Performance optimization, better UX for large datasets
- Implementation: Server-side pagination with page/limit params
```

## Quick Start

```bash
# 1. Invoke this skill
# User: /admin-business
# AI: Please tell me about your business type and core entities...

# 2. Install dependencies
bun add drizzle-orm @neondatabase/serverless zustand nuqs
bun add @tanstack/react-table react-hook-form @hookform/resolvers zod
bun add recharts date-fns kbar
bun add -d drizzle-kit

# 3. Install Shadcn components
bunx shadcn@latest add button card table input form dialog select badge dropdown-menu

# 4. Database migration
bun run db:push

# 5. Start development
bun dev
```

## Output Checklist

After executing this skill:

| Output | Description |
|--------|-------------|
| `spec/admin-{business}.spec.md` | Business admin specification |
| `src/admin/app/` | Admin pages |
| `src/admin/components/` | Business components |
| `src/admin/lib/` | Business logic |
| `src/db/schema/{entity}.ts` | Database schema |

## Related Skills

| Skill | Relationship |
|-------|--------------|
| admin-scaffold | Base: provides generic admin skeleton |
| admin-better-auth | Extension: adds authentication |
| admin-data-reports | Extension: adds data reports |
| admin-backup | Extension: adds backup functionality |

---

## Phase 5: Seed - Test Data Generation [v3.0 NEW]

> **Goal**: Generate 100+ realistic test data records per business entity with correct relationships and realistic status distribution for validation and demo purposes.

### 5.1 Data Generation Principles

| Property | Requirement | Description |
|----------|-------------|-------------|
| **Quantity** | ≥ 100 per core entity | Related entities 20-50, logs 500+ |
| **Realism** | Use Faker.js with Chinese locale | Names, addresses, phones match local format |
| **Relations** | 100% valid foreign keys | No orphan data |
| **Status Distribution** | Match real business ratios | e.g., orders: 60% delivered, 15% shipped... |
| **Time Distribution** | Simulate business growth | Earlier = fewer, recent = more |

### 5.2 Status Distribution Rules

```typescript
const statusDistribution = {
  post: { draft: 0.15, published: 0.80, archived: 0.05 },
  order: {
    pending_payment: 0.05, paid: 0.10, shipped: 0.15,
    delivered: 0.60, completed: 0.08, cancelled: 0.02
  },
  comment: { pending: 0.10, approved: 0.85, rejected: 0.05 },
  tenant: { trial: 0.20, active: 0.70, suspended: 0.05, churned: 0.05 },
};
```

### 5.3 Seed Commands

```bash
# Install Faker dependency
bun add -d @faker-js/faker

# Generate blog test data (100 base count)
bun run scripts/seed-generator.ts blog --count=100

# Generate ecommerce test data (200 base count)
bun run scripts/seed-generator.ts ecommerce --count=200

# Generate SaaS test data (150 base count)
bun run scripts/seed-generator.ts saas --count=150

# Output SQL format
bun run scripts/seed-generator.ts blog --format=sql --output=seed.sql
```

### 5.4 Data Volume per Business Type

| Type | Core Entity | Base Count | Related Data | Total Records |
|------|-------------|------------|--------------|---------------|
| **blog** | posts | 100 | categories(15), tags(50), comments(200), media(50) | ~415 |
| **ecommerce** | products, orders | 100/250 | categories(20), customers(50), coupons(30) | ~450 |
| **saas** | tenants | 100 | plans(4), users(300), subscriptions(80), tickets(150) | ~634 |

### 5.5 Seed Script Structure

```
src/admin/scripts/seed/
├── index.ts              # Main entry
├── utils.ts              # Utility functions
├── blog.seed.ts          # Blog data generator
├── ecommerce.seed.ts     # E-commerce data generator
└── saas.seed.ts          # SaaS data generator
```

---

## Enhanced Features [v3.0 NEW]

### 6.1 Bulk Operations

| Feature | Description | Implementation |
|---------|-------------|----------------|
| Bulk Delete | Delete multiple selected items | Checkbox + Bulk Action |
| Bulk Status Change | e.g., bulk publish, bulk approve | Dropdown Action |
| Bulk Export | Export selected data to CSV | csv-stringify |

### 6.2 Import/Export

| Feature | Format | Use Case |
|---------|--------|----------|
| Export CSV | UTF-8 BOM | Excel compatible |
| Export Excel | xlsx | Full formatting |
| Import CSV | Template download + validation | Batch create/update |

### 6.3 Advanced Search

| Feature | Description |
|---------|-------------|
| Multi-field Search | Search title, content, tags simultaneously |
| Filter Combination | Status + Category + Date Range |
| Save Search | Save frequently used filters |
| Search History | Last 10 search queries |

### 6.4 Keyboard Shortcuts

Integrated kbar command palette with shortcuts:

| Shortcut | Function |
|----------|----------|
| `⌘ + K` | Open command palette |
| `⌘ + /` | Show shortcut help |
| `⌘ + N` | Create new record |
| `⌘ + S` | Save |
| `⌘ + F` | Search |
| `⌘ + E` | Export |

### 6.5 Real-time Notifications

```tsx
import { toast } from 'sonner';

// Success notification
toast.success('Saved successfully', {
  description: 'Data has been updated',
  action: { label: 'Undo', onClick: handleUndo },
});
```

---

## Entity Management [v3.1 NEW]

### CRUD Operations Pattern

Each business entity should have complete CRUD operations:

| Operation | Trigger | UI Component | Server Action |
|-----------|---------|--------------|---------------|
| Create | Page button | Dialog + Form | `createEntity()` |
| Read | List/Detail page | Table / Card | `getEntities()` / `getEntityById()` |
| Update | Row action menu | Dialog + Form | `updateEntity()` |
| Delete | Row action menu | AlertDialog | `deleteEntity()` |

### Soft Delete Implementation

```typescript
// Schema: Add deletedAt field
export const entity = sqliteTable("entity", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp" }), // Soft delete marker
})

// Query: Filter out deleted records by default
export async function getEntities(params: { includeDeleted?: boolean } = {}) {
  const { includeDeleted = false } = params
  const conditions = []
  if (!includeDeleted) {
    conditions.push(isNull(entity.deletedAt))
  }
  return db.select().from(entity).where(and(...conditions))
}
```

### Action Menu Component

```tsx
export function EntityActions({ entity }: { entity: Entity }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/entities/${entity.id}`}>
              <Eye className="mr-2 h-4 w-4" /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditEntityDialog entity={entity} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteEntityDialog entity={entity} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  )
}
```

### Required Shadcn Components

```bash
bunx shadcn@latest add dialog alert-dialog dropdown-menu checkbox
```

---

## Phase 6: BI Reports Module [v3.2 NEW]

> **Goal**: Add comprehensive BI reports to existing admin dashboards, enabling data-driven decision making based on the 4减4增 (4-reduce 4-increase) framework.

### 6.1 When to Use This Phase

Execute Phase 6 when:
- Admin dashboard already exists (Mode B detected in Phase 0)
- User requests "add reports", "add analytics", "add BI dashboard"
- Existing admin lacks data visualization capabilities

### 6.2 Decision Dashboard (决策驾驶舱)

The core concept: **Admin dashboard is your Decision Cockpit, not just a feature collection.**

```
Data → Insights → Decisions → Actions
```

**Dashboard Structure:**

```
src/admin/app/reports/
├── page.tsx                    # Main decision dashboard
├── conversion/page.tsx         # R1: Conversion reports
├── revenue/page.tsx            # R2: Revenue analytics
├── retention/page.tsx          # R3: Retention analysis
├── referral/page.tsx           # R4: Referral tracking
├── costs/page.tsx              # C1-C4: Cost monitoring
└── _components/
    ├── stats-overview.tsx      # Today/Monthly overview cards
    ├── conversion-funnel.tsx   # User conversion funnel
    ├── revenue-chart.tsx       # Revenue trend charts
    ├── churn-analysis.tsx      # Churn rate analysis
    ├── referral-metrics.tsx    # NPS and referral stats
    └── cost-breakdown.tsx      # API costs, margins
```

### 6.3 Report Types (Based on 4减4增 Framework)

#### Today's Overview (今日核心数据)

| Metric | Description | Formula |
|--------|-------------|---------|
| New Users | Today's registrations | `COUNT(users WHERE createdAt = today)` |
| Active Users | Today's active users | `COUNT(DISTINCT sessions WHERE date = today)` |
| Conversion Rate | Free to paid conversion | `paying_users / total_users * 100` |
| Today's Revenue | Revenue generated today | `SUM(payments WHERE date = today)` |

#### Monthly Overview (本月核心数据)

| Metric | Description | Formula |
|--------|-------------|---------|
| MRR | Monthly Recurring Revenue | `SUM(active_subscriptions.price)` |
| Total Users | All registered users | `COUNT(users)` |
| Paying Users | Active subscribers | `COUNT(subscriptions WHERE status = 'active')` |
| Churned Users | Users who cancelled | `COUNT(subscriptions WHERE status = 'cancelled' AND cancelled_at = this_month)` |

#### Cost Monitoring (成本监控)

| Metric | Description | Formula |
|--------|-------------|---------|
| API Calls | Total API requests | `COUNT(api_logs)` |
| API Cost | Cost of API usage | `SUM(api_logs.cost)` |
| Gross Margin | Revenue minus costs | `(revenue - costs) / revenue * 100` |

### 6.4 R1: Conversion Funnel Reports (增付费转化)

```tsx
// Conversion funnel visualization
interface FunnelStep {
  name: string;
  value: number;
  rate: number;
}

const conversionFunnel: FunnelStep[] = [
  { name: 'Visitors', value: 10000, rate: 100 },
  { name: 'Registered', value: 2500, rate: 25 },
  { name: 'Activated', value: 1500, rate: 60 },
  { name: 'Paying', value: 375, rate: 25 },
];

// Key decisions enabled:
// - "Conversion dropped 37% - check pricing page"
// - "78% users stuck at Onboarding Step 2 - optimize UX"
```

**Report Components:**
- Funnel visualization chart
- Conversion rate trend (daily/weekly/monthly)
- Onboarding completion rates
- A/B test results tracking

### 6.5 R2: Revenue Analytics (增客单价)

```tsx
// Subscription distribution analysis
interface PlanDistribution {
  plan: string;
  users: number;
  percentage: number;
  revenue: number;
}

const planDistribution: PlanDistribution[] = [
  { plan: 'Basic', users: 92, percentage: 90, revenue: 828 },
  { plan: 'Pro', users: 5, percentage: 5, revenue: 145 },
  { plan: 'Team', users: 5, percentage: 5, revenue: 495 },
];

// Key metrics:
// - ARPU (Average Revenue Per User): total_revenue / total_users
// - Price point effectiveness
// - Upsell opportunities
```

**Report Components:**
- Plan distribution pie chart
- ARPU trend line
- Pricing tier comparison
- Upgrade/downgrade flow

### 6.6 R3: Retention Analysis (增复购率)

```tsx
// Churn analysis
interface ChurnData {
  month: string;
  churnRate: number;
  renewalRate: number;
  lostMRR: number;
}

// Key alerts:
// - "15% churn this month (was 10% last month)"
// - "80% of churned users last logged in 3+ days before expiry"
// - "Users with < 2 logins/week have 5x higher churn risk"
```

**Report Components:**
- Cohort retention heatmap
- Churn rate trend
- At-risk user list (7 days before expiry, low activity)
- LTV (Lifetime Value) analysis
- Renewal reminder effectiveness

### 6.7 R4: Referral Tracking (增推荐率)

```tsx
// Referral metrics
interface ReferralMetrics {
  nps: number;              // Net Promoter Score (-100 to +100)
  referralRate: number;     // % of users who referred
  kFactor: number;          // Viral coefficient
  referralConversion: number; // Referred user conversion rate
}

// Key insights:
// - "NPS: 45 (30% satisfied users not referring - improve entry point)"
// - "Referred users have 2x higher LTV"
```

**Report Components:**
- NPS gauge chart
- Referral funnel
- Top referrers leaderboard
- Referral channel effectiveness

### 6.8 C1-C4: Cost Monitoring (降本四策)

```tsx
// Cost breakdown
interface CostMetrics {
  apiCalls: number;
  apiCost: number;
  infrastructureCost: number;
  grossMargin: number;
  burnRate: number;
}

// Decisions enabled:
// - "API costs up 20% - optimize caching"
// - "Gross margin 91.8% - healthy"
```

**Report Components:**
- API usage trend
- Cost breakdown by service
- Margin trend
- Cost per user (CAC trend)

### 6.9 Weekly Decision Calendar

A practical pattern for using the reports:

| Day | Focus | Key Reports | Decisions |
|-----|-------|-------------|-----------|
| **Monday** | Weekly planning | Dashboard overview | Identify priorities |
| **Wednesday** | User analysis | Conversion, Retention | Optimize onboarding |
| **Friday** | Weekly review | Revenue, Export weekly report | Plan next week |
| **Sunday** | Incident review | Audit logs | Quick issue location |

### 6.10 Report Generation Code Structure

```
src/admin/
├── app/reports/
│   ├── page.tsx              # Decision dashboard
│   ├── conversion/
│   │   ├── page.tsx          # R1 conversion reports
│   │   └── _components/
│   │       ├── funnel-chart.tsx
│   │       └── conversion-trend.tsx
│   ├── revenue/
│   │   ├── page.tsx          # R2 revenue analytics
│   │   └── _components/
│   │       ├── plan-distribution.tsx
│   │       └── arpu-chart.tsx
│   ├── retention/
│   │   ├── page.tsx          # R3 retention analysis
│   │   └── _components/
│   │       ├── cohort-heatmap.tsx
│   │       ├── churn-trend.tsx
│   │       └── at-risk-users.tsx
│   ├── referral/
│   │   ├── page.tsx          # R4 referral tracking
│   │   └── _components/
│   │       ├── nps-gauge.tsx
│   │       └── referral-funnel.tsx
│   └── costs/
│       ├── page.tsx          # C1-C4 cost monitoring
│       └── _components/
│           ├── cost-breakdown.tsx
│           └── margin-trend.tsx
├── lib/
│   ├── reports/
│   │   ├── conversion.ts     # Conversion calculations
│   │   ├── revenue.ts        # Revenue calculations
│   │   ├── retention.ts      # Retention calculations
│   │   ├── referral.ts       # Referral calculations
│   │   └── costs.ts          # Cost calculations
│   └── utils/
│       └── date-ranges.ts    # Date range utilities
└── components/reports/
    ├── date-range-picker.tsx # Date range selector
    ├── metric-card.tsx       # Reusable metric card
    ├── trend-indicator.tsx   # Up/down trend badge
    └── export-button.tsx     # Export to CSV/Excel
```

### 6.11 Quick Start (Mode B)

```bash
# When admin exists, only add reports module:

# 1. Install chart dependencies
bun add recharts date-fns

# 2. Add required Shadcn components
bunx shadcn@latest add tabs chart

# 3. Generate reports module
# AI will create src/admin/app/reports/ structure

# 4. Add navigation entry
# Update sidebar to include "Reports" menu item

# 5. Start development
bun dev

# Access reports at http://localhost:3000/admin/reports
```

### 6.12 Database Schema for Reports

```typescript
// Additional tables for BI reports
export const dailyMetrics = sqliteTable("daily_metrics", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),              // YYYY-MM-DD
  newUsers: integer("new_users").default(0),
  activeUsers: integer("active_users").default(0),
  payingUsers: integer("paying_users").default(0),
  revenue: integer("revenue").default(0),     // in cents
  apiCalls: integer("api_calls").default(0),
  apiCost: integer("api_cost").default(0),   // in cents
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userEvents = sqliteTable("user_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),   // signup, activate, subscribe, churn, refer
  metadata: text("metadata"),                 // JSON for additional data
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Aggregation cron job: aggregate events → daily_metrics
```

### 6.13 Report Validation Checklist

After generating reports, verify:

- [ ] Dashboard loads under 500ms
- [ ] All metric cards show correct values
- [ ] Trend indicators (↑/↓) calculate correctly
- [ ] Date range picker works (today, 7d, 30d, custom)
- [ ] Charts render with proper legends
- [ ] Export function generates valid CSV
- [ ] Mobile responsive (optional)

---

---

## Phase 7: Smart Seed Generation [v3.3 NEW]

> **Goal**: Intelligently generate realistic test data based on detected business context, enabling immediate demo and validation without manual data entry.

### 7.1 When to Use This Phase

**Prompt user after Phase 0 detection:**

```markdown
## Seed Data Generation

Would you like to generate test data for your admin dashboard?

- [x] Yes, generate realistic seed data (recommended for development/demo)
- [ ] No, I'll add data manually

If yes, select data volume:
- [ ] Minimal (50 records per entity)
- [x] Standard (100+ records per entity) - recommended
- [ ] Large (500+ records per entity)
```

### 7.2 Context-Aware Entity Detection

**Automatically detect entities from existing schema:**

```typescript
// Schema analysis output
interface DetectedEntities {
  users: {
    table: "user" | "users" | "admin_user"
    hasRole: boolean
    hasEmail: boolean
    hasPassword: boolean
  }
  businessEntities: {
    name: string
    tableName: string
    fields: string[]
    relationships: ForeignKey[]
    statusField?: string
    statusValues?: string[]
  }[]
  auditLogs?: {
    table: string
    actorField: string
    actionField: string
  }
  subscriptions?: {
    planTable: string
    subscriptionTable: string
    userField: string
  }
  metrics?: {
    dailyTable: string
    eventTable: string
  }
}
```

### 7.3 Smart Data Generation Rules

#### 7.3.1 User Data Generation

```typescript
const userSeedRules = {
  quantity: {
    users: 100,        // Base users
    admins: 15,        // 15% admin ratio
  },
  distribution: {
    role: { user: 0.85, admin: 0.10, super_admin: 0.05 },
    status: { active: 0.85, inactive: 0.10, banned: 0.05 },
    verified: { true: 0.80, false: 0.20 },
  },
  timeDistribution: {
    // More users created recently (growth simulation)
    weight: (dayIndex: number, totalDays: number) => {
      return 1 + (dayIndex / totalDays) * 0.5  // 50% growth over period
    }
  },
  locale: "zh-CN",  // Use Chinese names, phones, addresses
}
```

#### 7.3.2 Business Entity Distribution

```typescript
const statusDistributionRules = {
  // Generic status patterns by entity type
  content: { draft: 0.15, published: 0.75, archived: 0.10 },
  order: {
    pending: 0.05, processing: 0.10, shipped: 0.15,
    delivered: 0.60, completed: 0.08, cancelled: 0.02
  },
  subscription: {
    trial: 0.20, active: 0.65, expired: 0.10, cancelled: 0.05
  },
  ticket: { open: 0.25, in_progress: 0.15, resolved: 0.55, closed: 0.05 },
  comment: { pending: 0.10, approved: 0.85, rejected: 0.05 },

  // Auto-detect status field and values from schema
  detectStatus: (entity: EntitySchema) => {
    const statusField = entity.fields.find(f =>
      f.name === "status" || f.name.endsWith("_status")
    )
    if (statusField?.enum) {
      return deriveDistribution(statusField.enum)
    }
    return null
  }
}
```

#### 7.3.3 Time-Based Growth Simulation

```typescript
const growthSimulation = {
  // Simulate realistic business growth
  pattern: "exponential",  // linear | exponential | seasonal

  // Value calculation with growth factor
  calculateValue: (
    baseValue: number,
    dayIndex: number,
    totalDays: number,
    pattern: string
  ): number => {
    const progress = dayIndex / totalDays
    switch (pattern) {
      case "linear":
        return baseValue * (1 + progress * 0.3)  // 30% linear growth
      case "exponential":
        return baseValue * Math.pow(1.3, progress)  // 30% compound growth
      case "seasonal":
        return baseValue * (1 + Math.sin(progress * Math.PI) * 0.3)
      default:
        return baseValue
    }
  },

  // Add random fluctuation
  addNoise: (value: number, variance: number = 0.2): number => {
    return Math.floor(value * (1 - variance + Math.random() * variance * 2))
  }
}
```

#### 7.3.4 Foreign Key Relationship Handling

```typescript
const relationshipRules = {
  // Ensure 100% valid foreign keys
  validation: {
    orphanRecords: false,  // Never create orphan records
    cascadeCreate: true,   // Create parent records if needed
  },

  // Distribution of related records
  oneToMany: {
    // e.g., User has many Skills
    min: 1,
    max: 10,
    average: 5,
    distribution: "poisson",  // normal | uniform | poisson
  },

  manyToMany: {
    // e.g., Skill has many Categories (via join table)
    min: 1,
    max: 5,
    average: 2,
  },

  // Ensure referential integrity order
  creationOrder: (entities: EntitySchema[]) => {
    return topologicalSort(entities, "foreignKeys")
  }
}
```

### 7.4 BI Metrics Seed Data

```typescript
const biMetricsSeedRules = {
  dailyMetrics: {
    days: 120,  // 4 months of historical data

    // Funnel conversion rates (R1)
    conversion: {
      visitorToSignup: { base: 0.20, variance: 0.05 },      // 15-25%
      signupToActivation: { base: 0.60, variance: 0.10 },   // 50-70%
      activationToPayment: { base: 0.20, variance: 0.05 },  // 15-25%
    },

    // Revenue metrics (R2)
    revenue: {
      baseDaily: 5000,   // ¥50 base daily revenue
      growthRate: 0.02,  // 2% daily compound growth
      planDistribution: {
        basic: 0.70,    // 70% basic plan
        pro: 0.20,      // 20% pro plan
        team: 0.10,     // 10% team plan
      }
    },

    // Retention metrics (R3)
    retention: {
      baseChurnRate: 0.03,    // 3% monthly churn
      renewalRate: 0.85,      // 85% renewal rate
    },

    // Cost metrics (C1-C4)
    costs: {
      apiCostPerCall: 0.001,           // ¥0.001 per API call
      baseInfrastructureCost: 1000,    // ¥10/day base
      infrastructureGrowthRate: 0.01,  // 1% daily growth
    }
  },

  userEvents: {
    eventsPerUser: { min: 5, max: 20, average: 10 },
    eventTypes: [
      { type: "visit", weight: 0.40 },
      { type: "signup", weight: 0.15 },
      { type: "activate", weight: 0.12 },
      { type: "subscribe", weight: 0.08 },
      { type: "renew", weight: 0.10 },
      { type: "refer", weight: 0.05 },
      { type: "churn", weight: 0.05 },
      { type: "upgrade", weight: 0.03 },
      { type: "downgrade", weight: 0.02 },
    ]
  }
}
```

### 7.5 Seed Script Template

```typescript
// scripts/seed-all.ts
import Database from "better-sqlite3"

interface SeedConfig {
  dbPath: string
  counts: {
    users: number
    admins: number
    skills: number
    auditLogs: number
    dailyMetricsDays: number
    eventsPerUser: number
  }
  locale: "zh-CN" | "en-US"
  growth: "linear" | "exponential" | "seasonal"
}

const defaultConfig: SeedConfig = {
  dbPath: "./sqlite.db",
  counts: {
    users: 100,
    admins: 15,
    skills: 120,
    auditLogs: 500,
    dailyMetricsDays: 120,
    eventsPerUser: 10,
  },
  locale: "zh-CN",
  growth: "exponential",
}

async function seedAll(config: SeedConfig = defaultConfig) {
  const db = new Database(config.dbPath)

  try {
    console.log("🌱 Starting seed generation...")

    // Order matters for foreign key relationships
    const userIds = await seedUsers(db, config)
    const adminIds = await seedAdmins(db, config)
    const categoryIds = await seedCategories(db)
    await seedSkills(db, config, userIds, categoryIds)
    await seedAuditLogs(db, config, [...userIds, ...adminIds])

    // BI Reports data (if reports module exists)
    if (tableExists(db, "subscription_plan")) {
      const planIds = await seedSubscriptionPlans(db)
      await seedUserSubscriptions(db, userIds, planIds)
    }
    if (tableExists(db, "user_event")) {
      await seedUserEvents(db, userIds, config)
    }
    if (tableExists(db, "daily_metrics")) {
      await seedDailyMetrics(db, config)
    }

    console.log("✅ Seed generation complete!")
    printSummary(db)

  } finally {
    db.close()
  }
}

// Usage:
// npx tsx scripts/seed-all.ts
// npx tsx scripts/seed-all.ts --count=200 --growth=linear
```

### 7.6 Seed Commands

```bash
# Add to package.json scripts
"seed:all": "npx tsx ./scripts/seed-all.ts",
"seed:users": "npx tsx ./scripts/seed-all.ts --only=users",
"seed:metrics": "npx tsx ./scripts/seed-all.ts --only=metrics",
"seed:clean": "npx tsx ./scripts/seed-all.ts --clean"

# Usage examples
bun run seed:all                    # Generate all test data
bun run seed:all --count=200        # 200 base records per entity
bun run seed:all --growth=linear    # Linear growth pattern
bun run seed:all --locale=en-US     # English locale
bun run seed:clean                  # Clear all seed data
```

### 7.7 Volume Guidelines by Business Type

| Business Type | Core Entity | Base Count | Related Data | Total Records |
|--------------|-------------|------------|--------------|---------------|
| **Blog** | posts | 100 | categories(15), tags(50), comments(200) | ~365 |
| **E-commerce** | products, orders | 100/250 | categories(20), customers(50) | ~420 |
| **SaaS** | tenants | 100 | plans(5), users(300), subscriptions(80) | ~485 |
| **Education** | courses | 100 | sections(300), lessons(900), students(200) | ~1500 |
| **Skill Platform** | skills | 120 | users(100), categories(10), audit_logs(500) | ~730 |

### 7.8 Integration with Mode Selection

**Updated workflow:**

```
Phase 0: Admin Detection
    ↓
    ├─ No admin → Mode A: Full Generation
    │      ↓
    │      Phases 1-5
    │      ↓
    │      [Ask] Generate seed data? → Phase 7
    │
    └─ Admin exists → Mode B: BI Enhancement
           ↓
           Phase 6: Add Reports
           ↓
           [Ask] Generate BI test data? → Phase 7 (metrics only)
```

### 7.9 Seed Data Validation Checklist

After generating seed data, verify:

- [ ] All foreign key relationships are valid (no orphan records)
- [ ] Status distribution matches defined ratios (±5%)
- [ ] Time distribution shows expected growth pattern
- [ ] Locale-specific data is correct (names, phones, addresses)
- [ ] BI metrics show realistic trends (gradual growth, not flat)
- [ ] Total record counts meet minimum thresholds

---

## Arbitrage Perspective

> From the arbitrage mindset in cog.md

- **Reduce Fixed Costs**: Auto-generate based on business, no development from scratch
- **Reduce Labor Costs**: AI understands business and generates code automatically
- **Reduce Trial-Error Costs**: Pre-built templates avoid architecture mistakes
- **Reduce Time Costs**: 1 hour to generate complete business admin vs 1 week manual work
- **[v3.0]** **Reduce Demo Costs**: Auto-fill realistic test data for immediate validation
- **[v3.1]** **Reduce CRUD Costs**: Complete entity management with soft delete out of the box
- **[v3.2]** **Reduce Decision Costs**: BI reports enable data-driven decisions in minutes vs gut feelings
- **[v3.2]** **Increase Revenue Visibility**: 4减4增 framework reports directly track R1-R4 metrics
- **[v3.3]** **Reduce Data Entry Costs**: Smart seed generation creates realistic demo data automatically
- **[v3.3]** **Accelerate Validation**: Test full workflows immediately with contextual seed data
