'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Database,
  FileSearch,
  FileText,
  Settings,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    href: '/extract',
    icon: FileSearch,
    number: '1',
    title: '要素提取',
    desc: '上传招标文件，AI 快速提取资质要求、评分办法、合同条款等关键内容',
    tags: ['PDF', 'Word', 'Excel', '要素提取', '结果导出'],
  },
  {
    href: '/simulate',
    icon: FileText,
    number: '2',
    title: '模拟编制',
    desc: '基于项目特征生成模拟招标文件，辅助编制、复核和多维对比',
    tags: ['四步引导', '模板生成', '多维对比', '文件导出'],
  },
  {
    href: '/statistics',
    icon: BarChart3,
    number: '3',
    title: '开标分析',
    desc: '解析开标一览表，输出报价排名、降价幅度、离散系数和分析报告',
    tags: ['报价排名', '偏差分析', '报告生成', 'Excel解析'],
  },
  {
    href: '/database',
    icon: Settings,
    number: '4',
    title: '系统工具',
    desc: '统一管理 AI 模型、数据资产和系统日志，让招投标工作流更完整',
    tags: ['AI设置', '文件管理', '系统日志', '模型配置'],
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl pb-8">
      <section className="flex min-h-[470px] flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          你的招投标 AI 工作台
        </div>

        <h1 className="mt-8 text-[64px] font-extrabold leading-none tracking-tight text-foreground">
          <span className="text-primary">Bid</span> Master
        </h1>

        <p className="mt-8 text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          <span className="text-primary">更快</span>地提取 ·{' '}
          <span className="text-primary">更稳</span>地编制 ·{' '}
          <span className="text-primary">更清晰</span>地分析 ·{' '}
          <span className="text-primary">更强</span>的工具
        </p>

        <p className="mt-5 text-lg text-muted-foreground">AI 时代的招投标工作流，一站备齐</p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/workbench"
            className="inline-flex h-12 items-center gap-3 rounded-xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            进入工作台
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/statistics"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-7 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            查看功能演示
          </Link>
        </div>
      </section>

      <section className="pt-2">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-foreground">核心功能</h2>
          <p className="mt-4 text-base text-muted-foreground">
            提取关键要素 · 模拟编制文件 · 分析开标报价 · 管理知识数据
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map(feature => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group flex min-h-[320px] flex-col rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <feature.icon className="h-7 w-7" />
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary/20 text-sm font-bold text-primary/40">
                  {feature.number}
                </span>
              </div>

              <h3 className="text-[22px] font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {feature.title}
              </h3>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{feature.desc}</p>

              <div className="mt-auto flex flex-wrap gap-2 pt-7">
                {feature.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/workbench"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            了解全部功能细节
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="mt-12 flex justify-center border-t border-border pt-6 text-sm text-muted-foreground">
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=33010202005876"
          rel="noreferrer"
          target="_blank"
          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
        >
          <Image src="/beian-icon.png" alt="公安备案图标" width={16} height={16} />
          浙公网安备33010202005876号
        </a>
      </footer>
    </div>
  );
}
