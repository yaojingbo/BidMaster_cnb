# BI Report Templates Reference

> Reference document for admin-business v3.2 BI Reports module, based on the 4减4增 (4-Reduce 4-Increase) framework from CH08 course.

## Report Framework Overview

The BI reports system is built around the 4减4增 framework, transforming admin dashboards from "feature collections" into "decision cockpits."

```
                    ┌─────────────────────────────────────┐
                    │         Decision Dashboard          │
                    │        (决策驾驶舱)                  │
                    └─────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────┴───────┐           ┌────────┴────────┐          ┌────────┴────────┐
│  Overview     │           │  4增 Reports    │          │  4减 Reports    │
│  今日/本月    │           │  R1-R4 增收     │          │  C1-C4 降本     │
└───────────────┘           └─────────────────┘          └─────────────────┘
```

---

## 1. Overview Reports (概览报表)

### 1.1 Today's Overview (今日核心数据)

**Purpose**: Quick morning check to set daily priorities.

| Metric | Display Name | Data Source | Visualization |
|--------|-------------|-------------|---------------|
| New Users | 新增用户 | `users.createdAt = today` | Number + trend |
| Active Users | 活跃用户 | `sessions.date = today` | Number + trend |
| Conversion Rate | 付费转化 | `paying / total * 100` | Percentage + trend |
| Today's Revenue | 今日收入 | `payments.date = today` | Currency + trend |

**Component Template**:

```tsx
// components/reports/today-overview.tsx
interface TodayMetrics {
  newUsers: number;
  newUsersTrend: number;  // percentage change vs yesterday
  activeUsers: number;
  activeUsersTrend: number;
  conversionRate: number;
  conversionTrend: number;
  todayRevenue: number;
  revenueTrend: number;
}

export function TodayOverview({ metrics }: { metrics: TodayMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="新增用户"
        value={metrics.newUsers}
        trend={metrics.newUsersTrend}
        icon={<Users />}
      />
      <MetricCard
        title="活跃用户"
        value={metrics.activeUsers}
        trend={metrics.activeUsersTrend}
        icon={<Activity />}
      />
      <MetricCard
        title="付费转化"
        value={`${metrics.conversionRate}%`}
        trend={metrics.conversionTrend}
        icon={<TrendingUp />}
      />
      <MetricCard
        title="今日收入"
        value={formatCurrency(metrics.todayRevenue)}
        trend={metrics.revenueTrend}
        icon={<DollarSign />}
      />
    </div>
  );
}
```

### 1.2 Monthly Overview (本月核心数据)

**Purpose**: Monthly health check for strategic planning.

| Metric | Display Name | Calculation | Alert Threshold |
|--------|-------------|-------------|-----------------|
| MRR | 月度经常性收入 | `SUM(active_subscriptions.price)` | < last month |
| Total Users | 用户总数 | `COUNT(users)` | Growth < 5% |
| Paying Users | 付费用户数 | `COUNT(active_subscriptions)` | < last month |
| Churned Users | 流失用户数 | `COUNT(cancelled_this_month)` | > 10% of paying |

---

## 2. R1: Conversion Reports (付费转化报表)

### 2.1 Conversion Funnel (转化漏斗)

**Purpose**: Identify where users drop off in the conversion journey.

**Data Model**:

```typescript
interface FunnelStep {
  name: string;
  count: number;
  rate: number;      // conversion from previous step
  dropOff: number;   // users lost at this step
}

interface ConversionFunnel {
  steps: FunnelStep[];
  overallConversion: number;  // end-to-end conversion rate
  dateRange: { start: Date; end: Date };
}
```

**Standard Funnel Steps**:

| Step | Event | Expected Rate |
|------|-------|---------------|
| 1. Visit | page_view | 100% (baseline) |
| 2. Sign Up | user.created | 20-30% |
| 3. Activate | first_core_action | 50-70% |
| 4. Subscribe | subscription.created | 3-10% |

**Decision Matrix**:

| Observation | Insight | Action |
|-------------|---------|--------|
| Visit→SignUp < 15% | Landing page issues | A/B test headlines, CTA |
| SignUp→Activate < 40% | Onboarding friction | Simplify first-time UX |
| Activate→Subscribe < 2% | Value not demonstrated | Improve free trial, add tutorials |

### 2.2 Onboarding Analysis (引导流程分析)

**Purpose**: Track completion rates of onboarding steps.

```typescript
interface OnboardingStep {
  stepNumber: number;
  stepName: string;
  completedUsers: number;
  dropOffUsers: number;
  avgTimeToComplete: number;  // seconds
  commonBlockers: string[];   // from user feedback
}
```

**Alert Thresholds**:
- Any step with > 30% drop-off rate
- Average time > 5 minutes for any step
- More than 3 attempts to complete a step

---

## 3. R2: Revenue Reports (收入分析报表)

### 3.1 Subscription Distribution (订阅分布)

**Purpose**: Understand pricing tier effectiveness and identify upsell opportunities.

**Data Model**:

```typescript
interface PlanMetrics {
  planName: string;
  planPrice: number;
  userCount: number;
  percentage: number;
  totalRevenue: number;
  avgLifetime: number;  // months
}

interface SubscriptionDistribution {
  plans: PlanMetrics[];
  arpu: number;          // Average Revenue Per User
  arppu: number;         // Average Revenue Per Paying User
}
```

**Visualization**: Pie chart + breakdown table

**Decision Matrix**:

| Distribution Pattern | Insight | Action |
|---------------------|---------|--------|
| 90%+ on lowest tier | Pricing too high or anchoring failed | Add enterprise tier as anchor |
| Middle tier empty | Decoy pricing not working | Adjust middle tier features/price |
| High tier popular | Strong value perception | Consider adding higher tier |

### 3.2 Revenue Trend (收入趋势)

**Purpose**: Track MRR growth and identify seasonality.

```typescript
interface RevenueTrend {
  date: string;  // YYYY-MM or YYYY-MM-DD
  mrr: number;
  newMrr: number;      // from new customers
  expansionMrr: number; // from upgrades
  contractionMrr: number; // from downgrades
  churnedMrr: number;   // from cancellations
  netMrr: number;       // mrr + new + expansion - contraction - churned
}
```

**Visualization**: Stacked bar chart showing MRR components

---

## 4. R3: Retention Reports (留存分析报表)

### 4.1 Cohort Retention (同期群留存)

**Purpose**: Track how well different user cohorts are retained over time.

**Data Model**:

```typescript
interface CohortData {
  cohortMonth: string;  // YYYY-MM
  initialUsers: number;
  retentionByMonth: {
    month: number;      // 0 = signup month
    retainedUsers: number;
    retentionRate: number;
  }[];
}
```

**Visualization**: Heatmap with color intensity indicating retention rate

**Benchmarks** (SaaS):
- Month 1: 60-80%
- Month 3: 40-60%
- Month 6: 30-50%
- Month 12: 20-40%

### 4.2 Churn Analysis (流失分析)

**Purpose**: Identify and predict churn risks.

```typescript
interface ChurnMetrics {
  period: string;
  churnedUsers: number;
  churnRate: number;
  lostMrr: number;
  reasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
}

interface AtRiskUser {
  userId: string;
  email: string;
  subscriptionEnd: Date;
  lastLoginDays: number;
  activityScore: number;  // 0-100
  riskLevel: 'high' | 'medium' | 'low';
}
```

**Risk Indicators**:
- Last login > 7 days before subscription end
- Activity score < 30
- Login frequency < 2 times/week (when previously higher)

**Decision Matrix**:

| Risk Level | Criteria | Action |
|------------|----------|--------|
| High | No login 7+ days, ending soon | Personal outreach |
| Medium | Low activity, mid-subscription | Automated re-engagement email |
| Low | Active but showing slowdown | In-app feature tips |

---

## 5. R4: Referral Reports (推荐追踪报表)

### 5.1 NPS Tracking (净推荐值追踪)

**Purpose**: Measure customer satisfaction and predict organic growth.

```typescript
interface NPSData {
  period: string;
  promoters: number;     // score 9-10
  passives: number;      // score 7-8
  detractors: number;    // score 0-6
  nps: number;           // (promoters - detractors) / total * 100
  responseRate: number;
}
```

**Visualization**: Gauge chart (-100 to +100)

**Benchmarks**:
- < 0: Poor
- 0-30: Good
- 30-50: Great
- 50+: Excellent

### 5.2 Referral Metrics (推荐指标)

**Purpose**: Track viral growth and referral program effectiveness.

```typescript
interface ReferralMetrics {
  period: string;
  totalReferrers: number;      // users who referred
  totalReferrals: number;      // new users from referrals
  referralRate: number;        // referrers / total users
  conversionRate: number;      // referred signups / referral links clicked
  kFactor: number;             // viral coefficient
  avgReferralsPerReferrer: number;
}
```

**K-Factor Calculation**:
```
K = (invites sent per user) × (conversion rate of invites)
K > 1 = viral growth
K < 1 = needs paid acquisition
```

---

## 6. C1-C4: Cost Reports (成本监控报表)

### 6.1 API Cost Tracking (API 成本追踪)

**Purpose**: Monitor and optimize API usage costs.

```typescript
interface APICostData {
  date: string;
  service: string;  // 'openai' | 'anthropic' | 'vercel' | ...
  calls: number;
  cost: number;
  avgCostPerCall: number;
}

interface CostSummary {
  period: string;
  totalCost: number;
  costByService: { service: string; cost: number }[];
  costPerUser: number;
  grossMargin: number;
}
```

**Visualization**:
- Line chart for cost trend
- Pie chart for cost breakdown by service

**Alert Thresholds**:
- Daily cost > 150% of daily average
- Cost per user > revenue per user (negative margin)
- Single service > 50% of total costs

### 6.2 Margin Analysis (毛利分析)

**Purpose**: Track profitability and unit economics.

```typescript
interface MarginMetrics {
  period: string;
  revenue: number;
  directCosts: number;    // API, infrastructure
  grossProfit: number;
  grossMargin: number;    // (revenue - directCosts) / revenue
  cac: number;            // Customer Acquisition Cost
  ltv: number;            // Lifetime Value
  ltvCacRatio: number;    // LTV / CAC (target > 3)
}
```

**Healthy Benchmarks**:
- Gross Margin: > 70% for SaaS
- LTV:CAC Ratio: > 3:1
- Payback Period: < 12 months

---

## 7. Report Component Templates

### 7.1 Metric Card

```tsx
// components/reports/metric-card.tsx
interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, trend, trendLabel, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <p className="text-xs text-muted-foreground">
            <span className={trend >= 0 ? "text-green-500" : "text-red-500"}>
              {trend >= 0 ? "+" : ""}{trend}%
            </span>
            {" "}{trendLabel || "vs last period"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### 7.2 Trend Indicator

```tsx
// components/reports/trend-indicator.tsx
interface TrendIndicatorProps {
  value: number;
  goodDirection?: 'up' | 'down';  // default: 'up'
}

export function TrendIndicator({ value, goodDirection = 'up' }: TrendIndicatorProps) {
  const isPositive = value >= 0;
  const isGood = (isPositive && goodDirection === 'up') || (!isPositive && goodDirection === 'down');

  return (
    <span className={cn(
      "inline-flex items-center text-sm",
      isGood ? "text-green-500" : "text-red-500"
    )}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}
```

### 7.3 Date Range Picker

```tsx
// components/reports/date-range-picker.tsx
type DatePreset = 'today' | '7d' | '30d' | '90d' | 'ytd' | 'custom';

interface DateRangePickerProps {
  value: { from: Date; to: Date };
  onChange: (range: { from: Date; to: Date }) => void;
  presets?: DatePreset[];
}

export function DateRangePicker({ value, onChange, presets = ['today', '7d', '30d'] }: DateRangePickerProps) {
  // Implementation using Shadcn Calendar + Popover
}
```

---

## 8. Data Aggregation Patterns

### 8.1 Daily Metrics Aggregation

```typescript
// lib/reports/aggregation.ts

// Run daily at midnight
export async function aggregateDailyMetrics(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  const metrics = {
    date: dateStr,
    newUsers: await countNewUsers(date),
    activeUsers: await countActiveUsers(date),
    payingUsers: await countPayingUsers(date),
    revenue: await sumRevenue(date),
    apiCalls: await countApiCalls(date),
    apiCost: await sumApiCost(date),
  };

  await db.insert(dailyMetrics).values(metrics)
    .onConflictDoUpdate({
      target: dailyMetrics.date,
      set: metrics,
    });
}
```

### 8.2 Event Tracking

```typescript
// lib/reports/events.ts

type EventType = 'signup' | 'activate' | 'subscribe' | 'upgrade' | 'downgrade' | 'churn' | 'refer';

export async function trackEvent(
  userId: string,
  eventType: EventType,
  metadata?: Record<string, unknown>
) {
  await db.insert(userEvents).values({
    id: nanoid(),
    userId,
    eventType,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(),
  });
}
```

---

## 9. Report Page Templates

### 9.1 Main Dashboard Page

```tsx
// app/admin/reports/page.tsx
export default async function ReportsPage() {
  const todayMetrics = await getTodayMetrics();
  const monthlyMetrics = await getMonthlyMetrics();
  const recentTrends = await getRecentTrends();

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据报表"
        description="决策驾驶舱 - 数据驱动的商业洞察"
      />

      <DateRangePicker />

      <section>
        <h2 className="text-lg font-semibold mb-4">今日概览</h2>
        <TodayOverview metrics={todayMetrics} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">本月概览</h2>
        <MonthlyOverview metrics={monthlyMetrics} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">趋势分析</h2>
        <TrendCharts data={recentTrends} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">快速入口</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/admin/reports/conversion" label="转化分析" icon={<Funnel />} />
          <QuickLink href="/admin/reports/revenue" label="收入分析" icon={<DollarSign />} />
          <QuickLink href="/admin/reports/retention" label="留存分析" icon={<Users />} />
          <QuickLink href="/admin/reports/costs" label="成本监控" icon={<Calculator />} />
        </div>
      </section>
    </div>
  );
}
```

---

## 10. Weekly Decision Calendar Integration

The report system is designed to support a weekly decision-making rhythm:

| Day | Report Focus | Key Actions |
|-----|-------------|-------------|
| **Monday** | Dashboard Overview | Set weekly priorities based on data |
| **Tuesday** | Conversion Funnel | Identify biggest drop-off points |
| **Wednesday** | User Behavior | Analyze retention patterns |
| **Thursday** | Revenue Analysis | Review pricing effectiveness |
| **Friday** | Weekly Summary | Generate and export weekly report |
| **Weekend** | Alerts Only | Monitor critical thresholds |

### Automated Weekly Report

```typescript
// lib/reports/weekly-report.ts
export async function generateWeeklyReport(weekStart: Date) {
  return {
    period: { start: weekStart, end: addDays(weekStart, 6) },
    highlights: await getWeekHighlights(weekStart),
    metrics: {
      users: await getUserMetrics(weekStart),
      revenue: await getRevenueMetrics(weekStart),
      retention: await getRetentionMetrics(weekStart),
      costs: await getCostMetrics(weekStart),
    },
    alerts: await getActiveAlerts(),
    recommendations: await generateRecommendations(),
  };
}
```

---

## Appendix: Source Attribution

This report framework is based on the 4减4增 (4-Reduce 4-Increase) methodology from:

> **CH08 演讲逐字稿 - 数据决策版（v6-B）**
>
> 标题：管理与商业：扩大你的软件资产收益
> 核心：建立"数据→洞察→决策→行动"的决策驾驶舱叙事
>
> Framework credit: 阳老师 (阳志平)

Key concepts adapted:
- Decision Cockpit (决策驾驶舱) metaphor
- Weekly Decision Calendar pattern
- "Have dashboard vs No dashboard" comparison approach
- 4减4增 framework mapping to reports
