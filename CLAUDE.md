# Claude Code 指南

## 项目定位

Bid Master Web：招投标智能分析工具箱

- 目标用户：招投标从业人员（招标方、投标方、代理机构）
- 核心价值：AI 驱动的招标文件智能提取、模拟编制、开标报价分析
- 架构：FastAPI 后端 + React 前端，多 AI 供应商支持

## 核心文档

一切决策必须参考：`.42cog/meta/`（项目元数据）

重大决策必须参考：

- `.42cog/meta/` - 项目元数据、产品定位、商业模式
- `.42cog/real/` - 现实约束、安全规则
- `.42cog/cog/` - 认知模型、实体关系

## 开发环境

| 项目     | 配置                         |
| -------- | ---------------------------- |
| 语言     | TypeScript（前端）+ Python（后端） |
| 包管理   | npm（前端）                   |
| Git 托管 | CNB（主仓库） |
| 运行时   | Node.js 18+ / Python 3.12+   |

## 项目结构

- app/ - Next.js 15 页面（App Router）
- src/frontend/ - 前端共享模块（组件/Hooks/Stores/工具库）
- src/backend/ - FastAPI 后端（Python）
- src/db/ - 数据库 Schema 和类型
- tests/ - 测试套件
- demo/ - 演示/原型代码
- resource/ - 参考资料
- `.42cog/spec/` - 项目规约（pm/、dev/、design/）
- docs/ - 文档（research/、bug-fix-summary/、plan/、error-log/、guide/、templates/）
- notes/ - 个人笔记
- chats/ - 对话记录
- .42cog/ - 认知敏捷法文档（meta/、real/、cog/、work/、others/）
- .42plugin/ - 本地技能库（42edu/）
- .42plugin.yml - 插件安装清单

## 规则

- 语言：代码注释、文档、提交信息、沟通全部使用中文
- 文件名：默认英文命名
- Git：不自动提交，除非用户明确要求
- 敏感信息：存 `.env.local`，绝不保存在 Git 仓库中

## 代码质量

- SOLID / DRY 原则
- 禁止 TODO 或临时方案，遇到时停下重新设计
- 死代码直接删除
- 开工前充分分析

## 自动化

- 使用 Makefile targets，不创建 shell 脚本
- 代码修改完成后，自动重启前后端服务（kill 端口 8000/3000 进程后重新启动）

## 部署与仓库

- 主生产环境：腾讯云服务器，由 systemd 管理
- 主代码仓库：CNB

## 文档

- 项目规约：`./.42cog/spec/`
- 普通文档：`./docs/`
- 部署文档：`./docs/deployment/`
- 工作记录：`./.42cog/work/`