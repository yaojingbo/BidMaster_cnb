# Bid Master Web - 项目元信息

<meta>
  <document-id>bid-master-meta</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>Project Meta</type>
  <created>2026-05-10</created>
  <depends>real.md, cog.md</depends>
</meta>

## 基本信息

| 字段 | 内容 |
|------|------|
| 项目名称 | Bid Master Web |
| 项目标语 | 招投标智能分析工具箱 |
| 版本 | 0.1.0 |
| 创建日期 | 2026-05-10 |
| 负责人 | yaojingbo |

## 项目描述

面向招投标全流程的智能分析 Web 应用，覆盖招标文件要素提取、招标文件模拟编制、开标报价分析三大核心场景，内置多 AI 模型支持与流式交互。帮助招投标从业人员提升工作效率，降低人为错误。

## 目标用户

| 用户群体 | 描述 |
|----------|------|
| 投标方 | 施工单位、设计单位、设备供应商 |
| 招标方 | 招标方/代理机构 |
| 评标专家 | 参与评标的专家 |

## 核心价值主张

1. AI 驱动的招标文件智能要素提取，替代人工逐一比对
2. 四步引导式招标文件模拟编制，降低编制门槛
3. 开标报价数据智能分析，辅助评标决策

## 技术栈

### 前端

| 项目 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| 语言 | TypeScript |
| 图表 | ECharts 6 |

### 后端

| 项目 | 技术 |
|------|------|
| 框架 | FastAPI + Uvicorn |
| 语言 | Python 3.12+ |
| LLM 封装 | LiteLLM |
| 数据库 | PostgreSQL |

### AI 集成

| 项目 | 技术 |
|------|------|
| 多供应商 | OpenAI / DeepSeek / Claude / 阿里百炼 / MiniMax / Ollama |
| 流式响应 | SSE (Server-Sent Events) |

### 基础设施

| 项目 | 技术 |
|------|------|
| 生产环境 | 腾讯云服务器 |
| 部署方式 | systemd |
| 主代码仓库 | CNB |

## 项目里程碑

| 阶段 | 功能 |
|------|------|
| MVP | 要素提取 + AI 设置 |
| v1.0 | 模拟编制 + 开标分析 |
| v2.0 | 批量处理 + 团队协作 |

## 相关链接

| 类型 | 链接 |
|------|------|
| 主代码仓库（CNB） | https://cnb.cool/yaojingbo-2026/bidmaster |
| 部署地址 | https://bidmaster.asia/ |
| 文档地址 | [填写] |

## 交接（上下游）

这个系统在更大链条里的位置：

```
（上游：招标方 / 招投标平台导出）──给我──▶  Bid Master Web  ──我给出──▶（下游：投标方 / 决策人）
```

| | 是谁 | 交接什么 |
|---|---|---|
| 上游 | 招标方、招投标信息平台 | 招标文件 PDF/Markdown、开标一览表 |
| 下游 | 投标方、评标专家、代理机构 | 要素提取结果、模拟编制文件、开标分析报告 |

## 依赖

| 依赖 | 版本 | 缺了会怎样 |
|---|---|---|
| Python | 3.12+ | 后端 / CLI 无法运行 |
| Node.js | 18+ | 前端无法构建 |
| PostgreSQL | —— | 数据持久化失败（开发可用 SQLite 兜底） |
| LLM 供应商 Key | 各家 | 核心 AI 功能不可用（可本地 Ollama 兜底） |
| 腾讯云服务器 | —— | 生产部署下线 |

## 现实约束

详见 [.42cog/real/real.md](../real/real.md)

## 认知模型

详见 [.42cog/cog/cog.md](../cog/cog.md)