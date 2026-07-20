# Bid Master Web — 招投标智能分析工具箱

面向招投标全流程的智能分析 Web 应用，覆盖招标文件要素提取、招标文件模拟编制、开标报价分析三大核心场景，内置多 AI 模型支持与流式交互。

## 功能概览

| 模块 | 说明 |
|------|------|
| **要素提取** | 从 PDF/Markdown 招标文件中提取资质要求、评标办法、业绩门槛、定标方法、合同条款五大要素，支持单文件提取与批量对比 |
| **模拟编制** | 四步引导式流程：PDF 转换 → 结构化提取 → 跨项目对比 → 基于模板生成同类型招标文件，支持设计/施工/设备三类项目 |
| **开标分析** | 解析 Excel/CSV 开标一览表，自动计算报价排名、降价幅度、离散系数等统计指标，AI 生成综合分析报告 |
| **AI 设置** | 支持 OpenAI / DeepSeek / 阿里百炼 / Claude / MiniMax / Ollama 多供应商切换与连接测试 |

## 技术栈

**后端**
- FastAPI + Uvicorn（Python 3.12+）
- SQLAlchemy 2.x（async） + SQLite / PostgreSQL
- 多 AI 供应商抽象层（OpenAI / Claude / Ollama）
- markitdown、pandoc、pandas 处理多格式文件

**前端**
- Next.js 15（App Router）+ React 19 + TypeScript
- Tailwind CSS 4 + Radix UI
- Recharts（图表）
- Fetch API + SSE（流式响应）

## 目录结构

```text
bid-master-web/
├── src/app/                  # Next.js 页面与 API 代理
├── src/frontend/             # 前端组件、Hooks、Stores 与工具库
├── src/backend/              # FastAPI 后端与 CLI
├── src/db/                   # 数据库 Schema 和类型
├── tests/                    # 后端测试套件
├── e2e/                      # Playwright 端到端测试
├── demo/                     # 演示与原型代码
├── docs/                     # 使用、部署与恢复文档
├── notes/                    # 本地个人笔记
├── chats/                    # Claude Code 对话记录
├── .42cog/                   # 元数据、现实约束、规约和工作记录
├── .42plugin/                # 本地技能库
├── CLAUDE.md                 # Claude Code 项目指南
└── .42plugin.yml             # 插件安装清单
```

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+

### CLI 一键安装

macOS / Linux：

```bash
bash install.sh
```

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

安装器会创建独立虚拟环境，安装 `bidmaster` 及依赖，并生成全局可调用的 `bidmaster` 命令。安装完成后验证：

```bash
bidmaster --version
bidmaster tools list
bidmaster auth login
```

如果系统未安装 Python 3.12+，请先安装 Python 后重新执行安装器。

### 开发启动

```bash
# 1. 安装前端依赖
npm install

# 2. 启动前后端开发服务
make dev
```

开发服务默认使用后端端口 8000、前端端口 3000。

## AI 供应商配置

通过环境变量或前端「设置」页面配置，支持以下供应商：

| 环境变量 | 供应商 |
|---------|--------|
| `DASHSCOPE_API_KEY` | 阿里云百炼 |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `OPENAI_API_KEY` | OpenAI |
| `CLAUDE_API_KEY` | Anthropic Claude |
| `MINIMAX_API_KEY` | MiniMax |
| `OLLAMA_BASE_URL` | 本地 Ollama |

## 部署与代码仓库

| 角色 | 当前方案 |
|------|----------|
| 主生产环境 | 腾讯云服务器 + systemd |
| 正式域名 | <https://bidmaster.asia> |
| 主代码仓库 | [CNB](https://cnb.cool/yaojingbo-2026/bidmaster) |

腾讯云是当前唯一正式生产环境，CNB `main` 是开发与发布基准。

- [腾讯云主部署说明](docs/deployment/tencent-cloud-systemd.md)
- [macOS CLI 安装指南](docs/guide/mac-cli-install.md)

## API 概览

| 路径前缀 | 功能 |
|---------|------|
| `/api/files` | 文件上传、批量上传、列表、删除 |
| `/api/extract` | 单文件/批量要素提取、门槛分析（SSE 流式） |
| `/api/opening` | 报价统计分析、AI 综合分析报告（SSE） |
| `/api/simulate` | 模拟编制四步流程（SSE） |
| `/api/data` | 数据统计与 CRUD |
| `/api/settings` | AI 供应商查询、切换、连接测试 |
| `/api/health` | 健康检查 |