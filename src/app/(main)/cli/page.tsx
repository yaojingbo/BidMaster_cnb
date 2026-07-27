import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Folder,
  KeyRound,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';

const benefits = [
  {
    title: '一键安装',
    desc: '使用独立 Python 环境安装，不污染系统依赖，避开 Homebrew 与全局 pip 冲突。',
    icon: ShieldCheck,
  },
  {
    title: '远程调用',
    desc: '登录网页账号后，CLI 直接复用云端提取、分析和模拟编制能力。',
    icon: Zap,
  },
  {
    title: '批量交付',
    desc: '命令行天然适合批量文件、脚本自动化和 Agent 工作流调用。',
    icon: Folder,
  },
];

const macInstallCommands = [
  'python3 -m venv "$HOME/.bid-master-cli/venv"',
  '"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U pip',
  '"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U bid-master-cli',
  'mkdir -p "$HOME/.local/bin"',
  'printf \'%s\\n\' \'#!/usr/bin/env bash\' \'exec "$HOME/.bid-master-cli/venv/bin/bidmaster" "$@"\' > "$HOME/.local/bin/bidmaster"',
  'chmod +x "$HOME/.local/bin/bidmaster"',
  'export PATH="$HOME/.local/bin:$PATH"',
  'grep -q \'export PATH="$HOME/.local/bin:$PATH"\' ~/.zshrc || echo \'export PATH="$HOME/.local/bin:$PATH"\' >> ~/.zshrc',
];

const windowsInstallCommands = [
  'py -3.12 -m venv "$env:USERPROFILE\\.bid-master-cli\\venv"',
  '& "$env:USERPROFILE\\.bid-master-cli\\venv\\Scripts\\python.exe" -m pip install -U pip',
  '& "$env:USERPROFILE\\.bid-master-cli\\venv\\Scripts\\python.exe" -m pip install -U bid-master-cli',
  'New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\\Programs\\BidMaster"',
  'Set-Content "$env:LOCALAPPDATA\\Programs\\BidMaster\\bidmaster.cmd" \'@echo off`n"%USERPROFILE%\\.bid-master-cli\\venv\\Scripts\\bidmaster.exe" %*\'',
  '[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";" + "$env:LOCALAPPDATA\\Programs\\BidMaster", "User")',
];

const quickSteps = [
  {
    title: '安装 CLI',
    desc: '复制上方 macOS 安装命令，在终端执行一次即可。',
    command: '"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U bid-master-cli',
  },
  {
    title: '网页登录授权',
    desc: '打开网页端授权本机 CLI，凭证会保存到本机用户目录。',
    command: 'bidmaster auth login',
  },
  {
    title: '开始处理文件',
    desc: '把招标文件、开标表格或模板文件交给 CLI。',
    command: 'bidmaster extract tender.pdf --out result.md',
  },
];

const commandGroups = [
  {
    title: '安装与升级',
    desc: '面向 macOS 用户的稳定安装与升级命令。',
    commands: [
      {
        command: '"$HOME/.bid-master-cli/venv/bin/python" -m pip install -U bid-master-cli',
        desc: '安装或升级到 PyPI 上的最新版 CLI。',
      },
      {
        command: 'bidmaster --version',
        desc: '安装后验证当前版本，最新版本应为 Bid Master CLI 1.0.3。',
      },
      {
        command: 'bidmaster tools list',
        desc: '查看当前 CLI 支持的招投标工具。',
      },
    ],
  },
  {
    title: '账号授权',
    desc: '让本机 CLI 代表网页账号调用云端服务。',
    commands: [
      {
        command: 'bidmaster auth login',
        desc: '打开浏览器完成网页登录授权。',
      },
      {
        command: 'bidmaster auth status',
        desc: '检查当前 CLI 是否已经登录，以及连接的服务地址。',
      },
      {
        command: 'bidmaster auth logout',
        desc: '清除本机 CLI 登录凭证。',
      },
    ],
  },
  {
    title: '核心任务',
    desc: '直接生成 Markdown 结果，可用于交付、复核和 Agent 后续处理。',
    commands: [
      {
        command: 'bidmaster extract tender.pdf --out result.md',
        desc: '提取招标文件关键要素。',
      },
      {
        command: 'bidmaster analyze tender.pdf --out analysis.md',
        desc: '生成招标文件风险与响应建议报告。',
      },
      {
        command: 'bidmaster quote opening.xlsx --out quote-report.md',
        desc: '解析开标报价并输出排名、统计和分析报告。',
      },
      {
        command:
          'bidmaster simulate tender.pdf --project-name 项目名称 --project-type design --out simulate.md',
        desc: '按网页端四步流程生成模拟编制结果。',
      },
    ],
  },
  {
    title: '批量与本地模式',
    desc: '适合文件夹批处理、本地报价解析和自动化脚本。',
    commands: [
      {
        command: 'bidmaster ./docs --out ./results -w 2 -y',
        desc: '批量处理目录内支持的文件，使用 2 个并发任务。',
      },
      {
        command: 'bidmaster quote opening.csv --local --out quote-report.md',
        desc: '本地解析 CSV / Excel 开标报价，不依赖网页登录。',
      },
      {
        command: 'bidmaster opening.xlsx --type quote --out quote-report.md',
        desc: '自动识别或显式指定任务类型。',
      },
    ],
  },
];

function CommandBlock({ commands, className = '' }: { commands: string[]; className?: string }) {
  return (
    <div className={`flex min-h-[320px] w-full flex-col overflow-hidden rounded-3xl border border-primary/20 bg-[#07150f] text-left shadow-[0_24px_80px_rgba(0,128,96,0.18)] ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          terminal
        </span>
      </div>
      <pre className="flex-1 overflow-x-auto px-6 py-5 text-sm leading-7 text-emerald-50">
        <code>{commands.map(command => `$ ${command}`).join('\n')}</code>
      </pre>
    </div>
  );
}

function MiniCommand({ command, desc }: { command: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-start gap-3">
        <Terminal className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <code className="block overflow-x-auto whitespace-nowrap rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
            {command}
          </code>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default function CliPage() {
  return (
    <div className="mx-auto max-w-6xl pb-10">
      <section className="flex min-h-[460px] flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
          <Terminal className="h-4 w-4" />
          Bid Master CLI 1.0.3
        </div>

        <h1 className="mt-8 text-[56px] font-extrabold leading-none tracking-tight text-foreground md:text-[56px]">
          一行命令调用
          <br />
          <span className="text-primary">招投标 AI 工具箱</span>
        </h1>

        <p className="mt-7 max-w-3xl text-xl font-semibold leading-9 text-foreground md:text-2xl">
          更快安装 · 更稳授权 · 更适合批量与 Agent 工作流
        </p>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          本地终端发起任务，网页端完成 AI 提取、分析和模拟编制，结果直接保存为 Markdown。
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="#install"
            className="inline-flex h-12 items-center gap-3 rounded-xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            立即安装
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="#commands"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-7 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            查看命令速查
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {benefits.map(benefit => (
          <div
            key={benefit.title}
            className="rounded-2xl border border-border bg-card p-7 shadow-sm"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <benefit.icon className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">{benefit.title}</h2>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{benefit.desc}</p>
          </div>
        ))}
      </section>

      <section
        id="install"
        className="mt-16 rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-9"
      >
        <div className="mb-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            <ClipboardCheck className="h-4 w-4" />
            macOS / Windows 安装方案
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            创建独立环境，不污染系统 Python
          </h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            选择你的系统复制命令。安装器会创建独立虚拟环境，安装 PyPI 上的 `bid-master-cli`，并生成
            `bidmaster` 全局入口。
          </p>
          <div className="mt-6 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              避免系统 Python 限制
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              避免全局依赖冲突
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              后续升级只需一条命令
            </div>
          </div>
        </div>
        <div className="grid items-stretch gap-6 xl:grid-cols-2">
          <div className="flex flex-col">
            <h3 className="mb-3 text-lg font-bold text-foreground">macOS</h3>
            <CommandBlock commands={macInstallCommands} className="flex-1" />
          </div>
          <div className="flex flex-col">
            <h3 className="mb-3 text-lg font-bold text-foreground">Windows PowerShell</h3>
            <CommandBlock commands={windowsInstallCommands} className="flex-1" />
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">三步开始使用</h2>
          <p className="mt-4 text-base text-muted-foreground">
            安装、授权、处理文件，流程和网页端能力保持一致。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {quickSteps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.desc}</p>
              <code className="mt-5 block overflow-x-auto whitespace-nowrap rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                {step.command}
              </code>
            </div>
          ))}
        </div>
      </section>

      <section id="commands" className="mt-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">命令速查</h2>
          <p className="mt-4 text-base text-muted-foreground">
            按任务分组，一眼找到当前要执行的命令。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {commandGroups.map(group => (
            <div
              key={group.title}
              className="rounded-3xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-5 flex items-start gap-3">
                <KeyRound className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {group.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.desc}</p>
                </div>
              </div>
              <div className="space-y-3">
                {group.commands.map(item => (
                  <MiniCommand key={item.command} command={item.command} desc={item.desc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] border border-primary/20 bg-primary/5 p-8 text-center md:p-10">
        <FileSearch className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground">
          CLI 与网页端协同工作
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
          在终端批量发起任务，在网页端统一管理授权、模型和历史记录。适合招投标团队的自动化处理与复核流程。
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/workbench"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            打开网页工作台
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/cli-auth"
            className="inline-flex h-11 items-center rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            查看授权页面
          </Link>
        </div>
      </section>
    </div>
  );
}
