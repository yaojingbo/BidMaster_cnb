# User Stories: Bid Master Web

<meta>
  <document-id>bid-master-user-stories</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>User Stories</type>
  <created>2026-05-10</created>
  <depends>real.md, cog.md, spec-product-requirements.md</depends>
</meta>

---

## Complex Story Overview

| Complex Story | MS Count | Priority | Story Type Distribution |
|--------------|----------|----------|------------------------|
| CS-01: 快速上手 | 1 | P0 | Light 1 |
| CS-02: 核心功能（要素提取） | 5 | P0 | Light 3, Dark 1, Grey 1 |
| CS-03: AI 配置管理 | 3 | P0 | Light 2, Dark 1 |
| CS-04: 结果对比与导出 | 3 | P1 | Light 1, Grey 2 |
| CS-05: 模拟编制 | 4 | P1 | Light 3, Dark 1 |
| CS-06: 开标分析 | 4 | P1 | Light 2, Dark 1, Grey 1 |

---

## Minimal Stories

### CS-01: 快速上手

**Description:** 用户无需注册，直接访问即可使用核心功能

**User Type:** 投标方/招标方/评标专家

**Core Value:** 零门槛，立即体验

**Story Type Distribution:**
- Light Stories: 1
- Dark Stories: 0
- Grey Stories: 0

---

### MS-L-01: 上传招标文件

**Complex Story:** CS-01
**Story Type:** Light（从"无法分析"到"文件已就绪"）
**Priority:** P0
**Story Points:** 3

#### User Story
作为一个投标方用户，
我想要上传招标文件（PDF/Markdown/doc/docx/Excel），
以便系统能够提取文件中的关键要素。

#### Story Evaluation (Light Story)
- **Starting State**: 用户访问系统，看到上传区域，但没有上传任何文件
- **Turning Point**: 用户拖拽或选择文件上传
- **End State**: 文件上传成功，显示在文件列表中
- **Emotional Experience**: 从"不知道放哪里"到"找到方法"到"文件已就绪"

#### Acceptance Criteria
- [ ] 用户可以拖拽文件到上传区域
- [ ] 用户可以点击选择文件
- [ ] 上传过程显示进度条
- [ ] 上传成功后文件名显示在列表中
- [ ] 支持 PDF、Markdown、doc、docx、Excel 文件（服务端验证）
- [ ] 文件大小限制 50MB

#### User-Perceivable Changes
- **Before Operation**: 看到拖拽区域和提示文字
- **During Operation**: 拖拽文件或点击选择，查看进度
- **After Operation**: 文件名显示，可以点击触发分析

#### Constraints (from real.md)
- 文件必须加密存储在服务端

---

### MS-L-02: 触发要素提取

**Complex Story:** CS-02
**Story Type:** Light（从"等待"到"获得结果"）
**Priority:** P0
**Story Points:** 5

#### User Story
作为一个投标方用户，
我想要一键触发要素提取，
以便从招标文件中快速获取资质要求、评标办法等关键信息。

#### Story Evaluation (Light Story)
- **Starting State**: 用户已上传文件
- **Turning Point**: 点击"提取要素"按钮
- **End State**: 实时看到五要素（资质要求、评标办法、业绩门槛、定标方法、合同条款）
- **Emotional Experience**: 从"等待"到"期待"到"收获满满"

#### Acceptance Criteria
- [ ] 上传文件后显示"提取要素"按钮
- [ ] 点击后显示 loading 动画
- [ ] 结果通过 SSE 流式实时显示
- [ ] 五要素完整展示：资质要求、评标办法、业绩门槛、定标方法、合同条款
- [ ] 支持中断操作

#### User-Perceivable Changes
- **Before Operation**: 文件已上传，按钮可用
- **During Operation**: 等待时显示 loading 和流式输出
- **After Operation**: 五要素以结构化形式展示

#### Constraints (from real.md)
- 统计分析必须在服务端完成

---

### MS-D-01: 文件类型不支持

**Complex Story:** CS-02
**Story Type:** Dark（从"正常"到"异常"到"恢复"）
**Priority:** P0
**Story Points:** 2

#### User Story
作为一个投标方用户，
我想要在上传不支持的文件类型时获得清晰的错误提示，
以便我知道应该上传什么格式的文件。

#### Story Evaluation (Dark Story)
- **Starting State**: 用户选择了一个文件
- **Turning Point**: 文件类型不支持
- **End State**: 系统提示错误，用户选择正确格式的文件
- **Emotional Experience**: 从"顺畅"到"受阻"到"被指引"

#### Acceptance Criteria
- [ ] 不支持的文件类型显示错误提示
- [ ] 错误消息列出支持的文件类型
- [ ] 用户可关闭错误提示并重新选择文件

#### User-Perceivable Changes
- **Before Operation**: 选择文件
- **During Operation**: 点击上传
- **After Operation**: 看到错误提示，了解支持的格式

---

### MS-G-01: 查看文件列表

**Complex Story:** CS-04
**Story Type:** Grey（日常重复操作）
**Priority:** P1
**Story Points:** 1

#### User Story
作为一个投标方用户，
我想要查看已上传的文件列表，
以便管理我的招标文件。

#### Story Evaluation (Grey Story)
- **Cycle Pattern**: 定期查看文件列表
- **Optimization Point**: 列表支持搜索和排序
- **Habit Formation**: 快速定位目标文件
- **Emotional Experience**: 从"翻找"到"快速定位"

#### Acceptance Criteria
- [ ] 显示所有已上传文件（名称、上传时间、状态）
- [ ] 支持按名称搜索
- [ ] 支持按时间排序
- [ ] 文件数量过多时分页

#### User-Perceivable Changes
- **Before Operation**: 文件散落或无序
- **During Operation**: 滚动或搜索
- **After Operation**: 找到目标文件

---

### MS-G-02: 导出分析报告

**Complex Story:** CS-04
**Story Type:** Grey（日常操作）
**Priority:** P1
**Story Points:** 2

#### User Story
作为一个投标方用户，
我想要将分析结果导出为报告，
以便离线查看或分享给同事。

#### Story Evaluation (Grey Story)
- **Cycle Pattern**: 每次分析后导出
- **Optimization Point**: 一键导出
- **Habit Formation**: 习惯性地导出留存
- **Emotional Experience**: 从"麻烦"到"简单"到"自动化"

#### Acceptance Criteria
- [ ] 显示"导出报告"按钮
- [ ] 支持导出为 PDF/Markdown 格式
- [ ] 点击后浏览器下载文件
- [ ] 报告包含完整的五要素信息

#### User-Perceivable Changes
- **Before Operation**: 分析结果仅在线可看
- **During Operation**: 点击导出按钮
- **After Operation**: 文件下载到本地

---

### MS-L-03: 对比多个文件

**Complex Story:** CS-04
**Story Type:** Light（从"单一"到"对比"）
**Priority:** P1
**Story Points:** 3

#### User Story
作为一个投标方用户，
我想要对比多个招标文件的分析结果，
以便选择最优的投标策略。

#### Story Evaluation (Light Story)
- **Starting State**: 用户有多个文件，需要逐一查看
- **Turning Point**: 切换到对比视图
- **End State**: 多个文件结果并排显示
- **Emotional Experience**: 从"繁琐"到"清晰"到"洞察"

#### Acceptance Criteria
- [ ] 显示"对比"视图切换按钮
- [ ] 用户可选择 2-5 个文件进行对比
- [ ] 对比视图以表格或列形式并排展示
- [ ] 差异部分高亮显示

#### User-Perceivable Changes
- **Before Operation**: 切换查看不同文件
- **During Operation**: 选择文件并切换到对比视图
- **After Operation**: 看到并排对比结果

---

### MS-L-04: 切换 AI 供应商

**Complex Story:** CS-03
**Story Type:** Light（从"受限"到"自由选择"）
**Priority:** P0
**Story Points:** 2

#### User Story
作为一个投标方用户，
我想要在多个 LLM 供应商之间切换，
以便使用我偏好的 AI 模型进行分析。

#### Story Evaluation (Light Story)
- **Starting State**: 用户使用默认供应商
- **Turning Point**: 在设置中选择切换供应商
- **End State**: 切换成功，后续请求使用新供应商
- **Emotional Experience**: 从"受限"到"选择"到"自主"

#### Acceptance Criteria
- [ ] 供应商列表包含：OpenAI、DeepSeek、Claude、阿里百炼、MiniMax、Ollama
- [ ] 用户可选中切换
- [ ] 切换后显示成功提示
- [ ] 当前选中的供应商高亮显示

#### User-Perceivable Changes
- **Before Operation**: 看到当前供应商名称
- **During Operation**: 点击下拉、选择新供应商
- **After Operation**: 看到切换成功的提示和新供应商名称

#### Constraints (from real.md)
- API Key 仅通过环境变量配置，不存储在数据库

---

### MS-D-02: AI 连接测试失败

**Complex Story:** CS-03
**Story Type:** Dark（从"正常"到"异常"到"恢复"）
**Priority:** P0
**Story Points:** 2

#### User Story
作为一个投标方用户，
我想要在配置 AI 供应商时测试连接，
以便确保 API 可用后再进行正式分析。

#### Story Evaluation (Dark Story)
- **Starting State**: 用户配置了 API Key 并点击测试
- **Turning Point**: 网络超时或 Key 无效
- **End State**: 系统显示错误详情，用户可重新配置
- **Emotional Experience**: 从"期待"到"困惑"到"明确方向"

#### Acceptance Criteria
- [ ] 点击"测试连接"按钮后显示测试中状态
- [ ] 连接成功显示绿色对勾和"连接成功"
- [ ] 连接失败显示红色叉和具体错误（如"无效的 API Key"）
- [ ] 错误信息具有可操作性

#### User-Perceivable Changes
- **Before Operation**: 输入 API Key
- **During Operation**: 点击测试按钮
- **After Operation**: 看到成功或失败的明确反馈

---

## Story Map

```
用户旅程：上传 → 分析 → 导出/对比

Iteration 1 (MVP) - 核心价值验证
├── CS-01: 快速上手
│   └── MS-L-01: 上传招标文件 (Light)
│       └── 从"无法分析" → "文件已就绪"
└── CS-02: 核心功能（要素提取）
    ├── MS-L-02: 触发要素提取 (Light)
    │   └── 从"等待" → "获得结果"
    └── MS-D-01: 文件类型不支持 (Dark)
        └── 从"正常" → "异常" → "恢复"

Iteration 2 - AI 配置与错误处理
├── CS-03: AI 配置管理
│   ├── MS-L-04: 切换 AI 供应商 (Light)
    │   └── 从"受限" → "自由选择"
    └── MS-D-02: AI 连接测试失败 (Dark)
        └── 从"正常" → "异常" → "恢复"

Iteration 3 - 效率提升
└── CS-04: 结果对比与导出
    ├── MS-G-01: 查看文件列表 (Grey)
    ├── MS-G-02: 导出分析报告 (Grey)
    └── MS-L-03: 对比多个文件 (Light)
```

---

## Story Type Distribution

| 阶段 | Light | Dark | Grey | 说明 |
|------|-------|------|------|------|
| MVP (Iteration 1) | 2 | 1 | 0 | 快速验证核心价值 |
| Iteration 2 | 1 | 1 | 0 | 完善 AI 配置 |
| Iteration 3 | 1 | 0 | 2 | 提升效率 |
| **总计** | **4** | **2** | **2** | |

---

## Implementation Recommendations

### Iteration 1 (MVP) - 2周
**目标:** 用户可以直接上传文件并获得要素提取结果

| Story ID | Title | Type | Points |
|----------|-------|------|--------|
| MS-L-01 | 上传招标文件 | Light | 3 |
| MS-L-02 | 触发要素提取 | Light | 5 |
| MS-D-01 | 文件类型不支持 | Dark | 2 |

**Expected User Value:**
1. 用户可以直接访问系统，无需注册
2. 用户可以上传 PDF/Markdown 招标文件
3. 用户可以获得五要素提取结果
4. 系统在异常文件类型时提供清晰提示

### Iteration 2 - 2周
**目标:** 完善 AI 配置和错误处理

**Expected User Value:**
1. 用户可以切换 AI 供应商
2. 用户可以测试 AI 连接
3. 系统在 AI 异常时提供清晰反馈

### Iteration 3 - 2周
**目标:** 提升使用效率

**Expected User Value:**
1. 用户可以查看文件列表并搜索
2. 用户可以导出分析报告
3. 用户可以对比多个文件

---

## Testing Guide

### MS-L-01 验证
- [ ] 用户可直接访问系统（无登录页）
- [ ] PDF 文件上传成功，显示进度条
- [ ] Markdown 文件上传成功
- [ ] 不支持的文件类型显示错误提示

### MS-L-02 验证
- [ ] 上传 PDF 文件成功
- [ ] 点击提取后流式输出显示
- [ ] 五要素完整：资质要求、评标办法、业绩门槛、定标方法、合同条款

### MS-D-02 验证
- [ ] 无效 API Key 显示明确错误
- [ ] 网络超时显示超时提示
- [ ] 有效 Key 显示连接成功

---

**文档版本：** v1.0.0
**创建日期：** 2026-05-10
**维护者：** Bid Master Team