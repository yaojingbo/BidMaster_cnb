// src/admin/app/page.tsx
// AI 友好：参考 next-shadcn-admin-dashboard 的仪表盘设计

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  DollarSign,
  CreditCard,
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { OverviewChart } from "@/admin/components/dashboard/overview-chart";
import { RecentList } from "@/admin/components/dashboard/recent-list";

// [AI生成] 根据业务类型自动调整指标
interface DashboardMetric {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
}

// 示例指标数据 - 实际从数据库获取
const metrics: DashboardMetric[] = [
  {
    title: "总用户数",
    value: "2,350",
    change: 12.5,
    changeLabel: "较上月",
    icon: <Users className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "本月收入",
    value: "¥45,231",
    change: 8.2,
    changeLabel: "较上月",
    icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "付费用户",
    value: "573",
    change: -2.1,
    changeLabel: "较上月",
    icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "活跃率",
    value: "78.5%",
    change: 5.4,
    changeLabel: "较上月",
    icon: <Activity className="h-4 w-4 text-muted-foreground" />,
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-muted-foreground">
            欢迎回来，这是今天的数据概览
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              {metric.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {metric.change > 0 ? (
                  <>
                    <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
                    <span className="text-green-500">+{metric.change}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
                    <span className="text-red-500">{metric.change}%</span>
                  </>
                )}
                <span className="ml-1">{metric.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 图表和列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* 概览图表 */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>概览</CardTitle>
            <CardDescription>
              最近30天的数据趋势
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart />
          </CardContent>
        </Card>

        {/* 最近数据 */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>最近动态</CardTitle>
            <CardDescription>
              最近的用户活动
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentList />
          </CardContent>
        </Card>
      </div>

      {/* 更多数据表格 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="analytics">分析</TabsTrigger>
          <TabsTrigger value="reports">报表</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          {/* 可以放置更多图表或数据表格 */}
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          {/* 分析内容 */}
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          {/* 报表内容 */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
