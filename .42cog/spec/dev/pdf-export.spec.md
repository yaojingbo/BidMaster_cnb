# PDF Export Feature Specification: Bid Master Web

<meta>
  <document-id>bid-master-pdf-export-spec</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>Feature Specification</type>
  <created>2026-07-08</created>
  <depends>meta.md, real.md, cog.md, sys.spec.md, code.spec.md</depends>
</meta>

---

## 1. 功能定位

PDF 导出是任务结果的补充下载格式，用于让用户在任务完成后将 AI 输出结果保存为 PDF 报告。

该功能不替代现有 Markdown 下载能力。现有 `.md` 文件下载必须继续保留，且文件名、内容和入口行为保持不变。

---

## 2. 适用范围

首期覆盖三类任务输出：

| 页面 | 原 Markdown 下载 | 新增 PDF 下载 |
|------|------------------|---------------|
| 要素提取 | `extract_result.md` | `extract_result.pdf` |
| 模拟编制 | `simulate_result.md` | `simulate_result.pdf` |
| 开标分析 | `comprehensive_analysis.md` | `comprehensive_analysis.pdf` |

---

## 3. 设计约束

1. 不删除、不替换现有 Markdown 下载。
2. 不改变现有 Markdown 文件名和内容。
3. PDF 是任务完成后的新增下载选项。
4. 不新增后端 API。
5. 不修改数据库结构。
6. 不改变任务执行、轮询、SSE 流式响应流程。
7. PDF 生成失败时，不影响 Markdown 下载、复制、预览等既有功能。

---

## 4. 技术方案

首期采用前端生成 PDF。

依赖：

```txt
html2canvas
jspdf
```

生成流程：

1. 使用现有 Markdown 渲染逻辑将任务结果转成 HTML。
2. 创建隐藏白底报告容器。
3. 使用 `html2canvas` 将报告容器转为 canvas。
4. 使用 `jsPDF` 按 A4 纵向分页生成 PDF。
5. 浏览器触发下载。
6. 清理临时 DOM。

选择原因：

- 三类任务结果已经在前端完整可用。
- 不需要新增后端导出接口和鉴权逻辑。
- 对现有功能侵入最小。
- 图像型 PDF 对中文输出兼容稳定。

已知取舍：

- PDF 内容不可像文本 PDF 一样选择复制。
- 长报告生成时会有短暂等待。
- 文件体积可能大于文本型 PDF。

---

## 5. UI 规范

每个任务输出工具栏保留原按钮：

```txt
下载
```

该按钮继续下载 Markdown。

在旁边新增：

```txt
PDF
```

PDF 按钮规则：

- 有输出内容时显示。
- 任务仍在流式生成中时禁用。
- 生成中显示 `生成中`。
- 生成失败提示：`PDF 生成失败，请稍后重试或先下载 Markdown。`

---

## 6. 文件命名规范

| 场景 | PDF 文件名 |
|------|------------|
| 要素提取 | `extract_result.pdf` |
| 模拟编制 | `simulate_result.pdf` |
| 开标分析 | `comprehensive_analysis.pdf` |

---

## 7. 验收标准

### 7.1 要素提取

1. 提取完成后可继续下载 `extract_result.md`。
2. 提取完成后可下载 `extract_result.pdf`。
3. 提取进行中 PDF 按钮不可用。
4. PDF 中文内容正常显示。

### 7.2 模拟编制

1. 模拟编制完成后可继续下载 `simulate_result.md`。
2. 模拟编制完成后可下载 `simulate_result.pdf`。
3. 流式执行中 PDF 按钮不可用。
4. PDF 包含当前结果标题和正文。

### 7.3 开标分析

1. AI 综合分析完成后可继续下载 `comprehensive_analysis.md`。
2. AI 综合分析完成后可下载 `comprehensive_analysis.pdf`。
3. AI 分析流式生成中 PDF 按钮不可用。
4. 长内容 PDF 能分页打开。

### 7.4 回归要求

以下功能保持可用：

- Markdown 下载。
- Markdown 预览切换。
- 复制输出。
- 任务执行和停止。
- 页面刷新后的任务状态恢复。

---

## 8. 不做范围

首期不做：

1. 后端生成文本型 PDF。
2. 中文字体嵌入。
3. PDF 文本选择复制。
4. 页眉、页脚、页码、水印。
5. 数据管理页历史记录 PDF 导出。
6. 批量 ZIP 导出 Markdown + PDF。

---

## 9. 后续演进

后续如果用户对 PDF 质量提出更高要求，可演进为后端报告服务：

1. 后端 HTML 模板渲染。
2. 服务端 PDF 生成。
3. 嵌入中文字体。
4. 支持可复制文本型 PDF。
5. 支持批量报告导出。
