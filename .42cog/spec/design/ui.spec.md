# Bid Master Web UI 设计规格

<meta>
  <document-id>bid-master-ui-spec</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>UI 设计规格</type>
  <created>2026-05-10</created>
  <tech-stack>Next.js 15+, React 19+, Tailwind CSS v4, shadcn/ui, Zustand</tech-stack>
</meta>

## 1. 智能分析结论

### 1.1 应用类型
**结论**: MPA（多页面应用）
**理由**:
- 三个核心功能模块相对独立（要素提取、模拟编制、开标分析）
- 用户任务离散，非连续性对话流
- 适合页面切换而非单页内切换

### 1.2 导航结构
**类型**: 顶部导航（Top Nav）
**主导航**:
| 项目 | 页面 | 说明 |
|------|------|------|
| Logo | 首页 | 品牌标识，点击返回首页 |
| 要素提取 | /extract | 招标文件要素提取 |
| 模拟编制 | /simulate | 招标文件模拟编制（v1.0） |
| 开标分析 | /statistics | 开标报价分析（v1.0） |
| 数据管理 | /database | 文件数据库管理 |
| AI 设置 | /settings | AI 供应商配置 |

### 1.3 配色方案
**主色相**: 340°（粉色）
**OKLCH 配置**:
```css
--color-primary: oklch(55% 0.18 340);      /* 主色：樱花粉 */
--color-primary-foreground: oklch(98% 0 0); /* 主色前景 */
--color-secondary: oklch(65% 0.14 340);    /* 次要色 */
--color-accent: oklch(70% 0.12 360);        /* 强调色：玫瑰粉 */
--color-destructive: oklch(55% 0.2 25);      /* 危险色：红色 */
--color-success: oklch(60% 0.15 145);       /* 成功色：绿色 */
--color-warning: oklch(75% 0.15 80);       /* 警告色：黄色 */
--color-background: oklch(98% 0 0);        /* 背景：接近白色 */
--color-foreground: oklch(20% 0 0);        /* 前景：深灰 */
--color-muted: oklch(95% 0 0);             /* 柔和背景 */
--color-muted-foreground: oklch(50% 0 0);  /* 柔和前景 */
--color-border: oklch(90% 0 0);            /* 边框 */
--color-card: oklch(100% 0 0);             /* 卡片背景 */
--color-card-foreground: oklch(20% 0 0);  /* 卡片前景 */
```

---

## 2. 设计系统

### 2.1 设计令牌

```css
/* Tailwind CSS v4 OKLCH 格式 */
@theme inline {
  /* 间距 */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;

  /* 圆角 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);

  /* 颜色（继承上方配色） */
  --color-primary: oklch(55% 0.18 340);
  --color-secondary: oklch(65% 0.14 340);
}
```

### 2.2 字体配置

```css
/* 系统字体栈（无 Google Fonts） */
--font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
--font-mono: ui-monospace, "SF Mono", "Menlo", monospace;
```

### 2.3 图标

使用 Lucide React（shadcn/ui 默认图标库）:
- 上传：`Upload`、`FileUp`
- 分析：`FileSearch`、`Sparkles`
- 设置：`Settings`、`SlidersHorizontal`
- 导出：`Download`、`FileDown`
- 切换：`ChevronDown`、`Check`

---

## 3. 页面布局

### 3.1 响应式断点

| 名称 | 宽度 | 布局 |
|------|------|------|
| Mobile | <640px | 单列，底部操作按钮 |
| Tablet | 640-1024px | 卡片网格 2 列 |
| Desktop | >1024px | 侧边栏 + 主内容 |

### 3.2 页面结构

```
┌─────────────────────────────────────────────────────┐
│  Header（固定顶部）                                   │
│  ┌───────┬───────────┬──────────┬────────┬──────┐  │
│  │ Logo  │  要素提取  │ 模拟编制  │ 开标分析 │ AI设置│  │
│  └───────┴───────────┴──────────┴────────┴──────┘  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Main Content                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │           [页面内容区域]                      │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Footer（可选，部分页面显示）                         │
└─────────────────────────────────────────────────────┘
```

### 3.3 首页布局

```
┌─────────────────────────────────────────────────────┐
│                    Hero Section                      │
│  ┌─────────────────────────────────────────────┐   │
│  │  招投标智能分析工具箱                          │   │
│  │  上传招标文件，AI 自动提取关键要素              │   │
│  │  [开始使用] [了解更多]                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  功能卡片（3列）                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │   要素提取   │ │   模拟编制   │ │   开标分析   │  │
│  │   Icon      │ │   Icon      │ │   Icon      │  │
│  │   快速准确   │ │   智能引导   │ │   数据驱动   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                     │
│  最近文件（可选，如果有的话）                          │
└─────────────────────────────────────────────────────┘
```

---

## 4. 组件规格

### 4.1 基础组件

| 组件 | 用途 | shadcn/ui 对应 |
|------|------|---------------|
| Button | 操作按钮 | `ui/button` |
| Badge | 状态标签 | `ui/badge` |
| Card | 内容容器 | `ui/card` |
| Avatar | 文件类型图标 | `ui/avatar` |
| Input | 文本输入 | `ui/input` |
| Textarea | 多行文本 | `ui/textarea` |
| Select | 下拉选择 | `ui/select` |
| Switch | 开关 | `ui/switch` |

### 4.2 业务组件

| 组件 | 用途 | 说明 |
|------|------|------|
| FileUploader | 文件上传 | 拖拽区域 + 点击选择 |
| FileList | 文件列表 | 展示已上传文件 |
| ElementCard | 要素卡片 | 展示单个提取要素 |
| ElementList | 要素列表 | 五要素的完整展示 |
| StreamViewer | 流式查看器 | SSE 响应展示 |
| ProviderSelector | 供应商选择 | AI 供应商切换 |
| ModelSelector | 模型选择 | 同一供应商的模型选择 |
| TestResult | 测试结果 | 连接测试状态展示 |
| DatabasePanel | 数据库管理 | 文件列表、搜索、筛选、下载 |
| FileRow | 文件行 | 单个文件的展示和操作 |

### 4.3 布局组件

| 组件 | 用途 | shadcn/ui 对应 |
|------|------|---------------|
| Dialog | 模态框 | `ui/dialog` |
| Sheet | 侧边抽屉 | `ui/sheet` |
| ScrollArea | 滚动区域 | `ui/scroll-area` |
| Separator | 分隔线 | `ui/separator` |
| Tabs | 标签页 | `ui/tabs` |
| Tooltip | 提示 | `ui/tooltip` |
| Toast | 轻提示 | `ui/sonner` |

---

## 5. 状态管理

### 5.1 Store 概览

```
lib/stores/
├── app-store.ts      # 全局应用状态
├── file-store.ts     # 文件管理状态
├── extract-store.ts  # 要素提取状态
├── database-store.ts # 数据管理状态
└── settings-store.ts # AI 设置状态
```

### 5.2 文件 Store

```typescript
// lib/stores/file-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface FileItem {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'ready' | 'processing' | 'done' | 'error'
  createdAt: string
  elements?: ElementExtract[] // 提取结果
}

interface FileState {
  files: FileItem[]
  currentFileId: string | null

  addFile: (file: Omit<FileItem, 'id' | 'createdAt'>) => string
  updateFile: (id: string, data: Partial<FileItem>) => void
  deleteFile: (id: string) => void
  setCurrentFile: (id: string | null) => void
}

export const useFileStore = create<FileState>()(
  persist(
    (set) => ({
      files: [],  // 初始化为空，用户上传后才有数据
      currentFileId: null,

      addFile: (data) => {
        const id = crypto.randomUUID()
        set((s) => ({
          files: [{ ...data, id, createdAt: new Date().toISOString() }, ...s.files],
          currentFileId: id,
        }))
        return id
      },

      updateFile: (id, data) => {
        set((s) => ({
          files: s.files.map((f) => (f.id === id ? { ...f, ...data } : f)),
        }))
      },

      deleteFile: (id) => {
        set((s) => ({
          files: s.files.filter((f) => f.id !== id),
          currentFileId: s.currentFileId === id ? null : s.currentFileId,
        }))
      },

      setCurrentFile: (id) => set({ currentFileId: id }),
    }),
    { name: 'bid-master-files', storage: createJSONStorage(() => localStorage) }
  )
)
```

### 5.3 提取 Store

```typescript
// lib/stores/extract-store.ts
import { create } from 'zustand'

export interface ElementExtract {
  id: string
  name: string  // 资质要求/评标办法/业绩门槛/定标方法/合同条款
  content: string
  confidence?: number
}

interface ExtractState {
  isExtracting: boolean
  progress: string
  elements: ElementExtract[]
  error: string | null

  startExtract: () => void
  updateProgress: (progress: string) => void
  addElement: (element: ElementExtract) => void
  setElements: (elements: ElementExtract[]) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useExtractStore = create<ExtractState>()((set) => ({
  isExtracting: false,
  progress: '',
  elements: [],
  error: null,

  startExtract: () => set({ isExtracting: true, progress: '', elements: [], error: null }),
  updateProgress: (progress) => set({ progress }),
  addElement: (element) => set((s) => ({ elements: [...s.elements, element] })),
  setElements: (elements) => set({ elements }),
  setError: (error) => set({ error, isExtracting: false }),
  reset: () => set({ isExtracting: false, progress: '', elements: [], error: null }),
}))
```

### 5.4 设置 Store

```typescript
// lib/stores/settings-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Provider {
  id: string
  name: string
  models: string[]
}

export interface SettingsState {
  activeProvider: string
  activeModel: string
  useMockMode: boolean
  providers: Provider[]

  setActiveProvider: (providerId: string) => void
  setActiveModel: (modelId: string) => void
  setMockMode: (mock: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeProvider: 'deepseek',
      activeModel: 'deepseek-v4-flash',
      useMockMode: true,  // 默认 Mock 模式，无需 API Key 即可演示
      providers: [
        { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
        { id: 'dashscope', name: '阿里百炼', models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-coder-turbo'] },
        { id: 'zhipu', name: '智谱 AI', models: ['glm-4-flash', 'glm-4-plus', 'glm-4-pro', 'glm-4-long', 'glm-4-9b', 'glm-3'] },
        { id: 'minimax', name: 'MiniMax', models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2-Her'] },
        { id: 'ollama', name: 'Ollama', models: ['llama3', 'llama3.1', 'mistral', 'qwen2.5'] },
        { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'] },
        { id: 'claude', name: 'Claude', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'] },
      ],

      setActiveProvider: (providerId) => {
        const provider = useSettingsStore.getState().providers.find((p) => p.id === providerId)
        set({ activeProvider: providerId, activeModel: provider?.models[0] || '' })
      },
      setActiveModel: (modelId) => set({ activeModel: modelId }),
      setMockMode: (mock) => set({ useMockMode: mock }),
    }),
    { name: 'bid-master-settings', storage: createJSONStorage(() => localStorage) }
  )
)
```

### 5.5 数据库 Store

```typescript
// lib/stores/database-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface DatabaseFile {
  id: string
  name: string
  size: number
  type: string
  category: 'source' | 'generated'  // source=上传的原文件, generated=生成的分析报告
  createdAt: string
  downloadUrl?: string  // 下载地址
  metadata?: {
    originalName?: string
    extractionStatus?: 'pending' | 'done' | 'failed'
    elementCount?: number
  }
}

interface DatabaseState {
  files: DatabaseFile[]
  selectedFileIds: string[]
  searchQuery: string
  filterCategory: 'all' | 'source' | 'generated'

  addFile: (file: Omit<DatabaseFile, 'id' | 'createdAt'>) => string
  removeFile: (id: string) => void
  setSelectedFileIds: (ids: string[]) => void
  toggleFileSelection: (id: string) => void
  setSearchQuery: (query: string) => void
  setFilterCategory: (category: 'all' | 'source' | 'generated') => void
  getFilteredFiles: () => DatabaseFile[]
}

export const useDatabaseStore = create<DatabaseState>()(
  persist(
    (set, get) => ({
      files: [],
      selectedFileIds: [],
      searchQuery: '',
      filterCategory: 'all',

      addFile: (data) => {
        const id = crypto.randomUUID()
        set((s) => ({
          files: [{ ...data, id, createdAt: new Date().toISOString() }, ...s.files],
        }))
        return id
      },

      removeFile: (id) => {
        set((s) => ({
          files: s.files.filter((f) => f.id !== id),
          selectedFileIds: s.selectedFileIds.filter((fid) => fid !== id),
        }))
      },

      setSelectedFileIds: (ids) => set({ selectedFileIds: ids }),
      toggleFileSelection: (id) => {
        set((s) => ({
          selectedFileIds: s.selectedFileIds.includes(id)
            ? s.selectedFileIds.filter((fid) => fid !== id)
            : [...s.selectedFileIds, id],
        }))
      },
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilterCategory: (category) => set({ filterCategory: category }),

      getFilteredFiles: () => {
        const { files, searchQuery, filterCategory } = get()
        return files.filter((f) => {
          const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase())
          const matchesCategory = filterCategory === 'all' || f.category === filterCategory
          return matchesSearch && matchesCategory
        })
      },
    }),
    { name: 'bid-master-database', storage: createJSONStorage(() => localStorage) }
  )
)
```

---

## 6. 功能独立原则

### 6.1 三条规则

1. **无阻塞依赖**
   - ❌ 错误：必须配置 API Key 才能测试上传
   - ✅ 正确：文件上传功能无需 AI 配置即可工作

2. **Mock 默认，真实可选**
   - Store 包含 `useMockMode: boolean` 标志
   - 组件检查 Mock 模式并使用相应处理器

3. **Mock 模式可视化**
   - 界面显示 `🎭 演示模式` 徽章
   - 设置页面可切换真实/Mock 模式

### 6.2 Mock 模式配置

```typescript
// 设置页面切换
const toggleMockMode = () => {
  setMockMode(!useMockMode)
  if (!useMockMode) {
    toast.success('已切换到演示模式')
  } else {
    toast.success('已切换到真实 API')
  }
}

// 组件中使用
const handleExtract = async () => {
  const { useMockMode } = useSettingsStore.getState()

  if (useMockMode) {
    await simulateMockExtract()
  } else {
    await callRealAPI()
  }
}
```

---

## 7. Mock 数据

### 7.1 Mock 供应商配置

```typescript
// data/mock/providers.ts
export const MOCK_PROVIDERS = [
  {
    id: 'mock-deepseek',
    provider: 'deepseek',
    modelId: 'deepseek-v4-flash',
    name: 'DeepSeek V4（演示）',
    apiKey: '',  // 空 = Mock 模式
    enabled: true,
    isMock: true,
  },
  {
    id: 'mock-claude',
    provider: 'claude',
    modelId: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6（演示）',
    apiKey: '',
    enabled: true,
    isMock: true,
  },
]
```

### 7.2 Mock 要素提取响应

```typescript
// lib/mock/extract-responses.ts
const MOCK_ELEMENTS = [
  {
    name: '资质要求',
    content: '1. 具有独立法人资格的企业...\n2. 注册资本金不低于 500 万元...\n3. 具有相应的施工资质证书...',
  },
  {
    name: '评标办法',
    content: '综合评估法：\n1. 报价得分 40 分\n2. 技术方案 40 分\n3. 业绩信誉 20 分',
  },
  {
    name: '业绩门槛',
    content: '近三年内完成类似项目不少于 3 个，总合同金额不低于 1000 万元',
  },
  {
    name: '定标方法',
    content: '最低价中标法：在满足招标文件实质性要求的前提下，报价最低的投标单位中标',
  },
  {
    name: '合同条款',
    content: '1. 合同工期：90 日历天\n2. 付款方式：按月进度支付 80%\n3. 质保期：两年',
  },
]

export async function* streamMockExtract() {
  for (const element of MOCK_ELEMENTS) {
    yield { type: 'element', data: element }
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500))
  }
  yield { type: 'done', data: { summary: '提取完成，共 5 个要素' } }
}
```

### 7.3 Mock 文件数据

```typescript
// data/mock/files.ts
export const MOCK_FILES = [
  {
    id: 'file-1',
    name: '某市轨道交通施工招标文件.pdf',
    size: 2048000,
    type: 'application/pdf',
    status: 'done',
    createdAt: '2025-05-10T08:30:00Z',
    elements: MOCK_ELEMENTS,
  },
  {
    id: 'file-2',
    name: '办公楼装修工程招标公告.md',
    size: 512000,
    type: 'text/markdown',
    status: 'done',
    createdAt: '2025-05-09T14:20:00Z',
    elements: MOCK_ELEMENTS,
  },
]
```

---

## 8. 核心功能实现

### 8.1 P0 功能（MVP）

| 功能 | 页面 | 组件 | 说明 |
|------|------|------|------|
| 文件上传 | 首页/提取页 | FileUploader | 拖拽+点击，50MB 限制 |
| 要素提取 | /extract | ExtractPanel | SSE 流式输出 |
| 结果展示 | /extract | ElementList | 五要素卡片展示 |
| 数据管理 | /database | DatabasePanel | 文件列表、下载管理 |
| AI 设置 | /settings | SettingsPanel | 供应商/模型选择 |

### 8.2 P1 功能（v1.0）

| 功能 | 页面 | 组件 | 说明 |
|------|------|------|------|
| 模拟编制 | /simulate | SimulateFlow | 四步引导流程 |
| 开标分析 | /statistics | StatisticsPanel | Excel 解析+统计 |
| 结果对比 | /extract | CompareView | 多文件对比 |
| 报告导出 | 全局 | ExportButton | PDF/Markdown |

### 8.3 页面路由

```
app/
├── (main)/                    # 主布局
│   ├── page.tsx              # 首页
│   ├── extract/
│   │   └── page.tsx          # 要素提取
│   ├── simulate/
│   │   └── page.tsx          # 模拟编制
│   ├── statistics/
│   │   └── page.tsx          # 开标分析
│   ├── database/
│   │   └── page.tsx          # 数据管理
│   └── settings/
│       └── page.tsx          # AI 设置
├── layout.tsx                 # 根布局
└── globals.css               # 全局样式
```

---

## 9. 交互模式

### 9.1 加载状态

| 场景 | 反馈 |
|------|------|
| 文件上传中 | 进度条 + 百分比 |
| 要素提取中 | 骨架屏 + 流式文字 |
| API 测试中 | Spinner + "测试中..." |
| 页面跳转 | 顶部进度条（NProgress） |

### 9.2 反馈模式

| 类型 | 组件 | 持续时间 |
|------|------|---------|
| 成功 | Sonner toast | 3s |
| 错误 | Sonner toast (红色) | 5s |
| 警告 | Sonner toast (黄色) | 4s |
| 信息 | Sonner toast (蓝色) | 3s |

### 9.3 空状态

```
┌─────────────────────────────────────┐
│                                     │
│           📄（图标）                 │
│                                     │
│         还没有上传任何文件           │
│     将招标文件拖拽到此处开始分析      │
│                                     │
│         [选择文件]  或  [拖拽文件]   │
│                                     │
└─────────────────────────────────────┘
```

### 9.4 错误状态

| 场景 | 提示 |
|------|------|
| 文件类型不支持 | "不支持的文件类型，请上传 PDF、Markdown、Word 或 Excel 文件" |
| 文件过大 | "文件大小超过 50MB 限制" |
| AI 连接失败 | "连接失败，请检查 API Key 是否正确" |
| 网络错误 | "网络连接失败，请检查网络后重试" |

---

## 10. 无障碍性

### 10.1 WCAG AA 检查清单

- [ ] 所有交互元素可通过键盘操作
- [ ] 表单输入有对应的 label 标签
- [ ] 颜色对比度符合 4.5:1 要求
- [ ] 图片和图标有 alt 属性或 aria-label
- [ ] 加载状态有 aria-live 区域通知
- [ ] 错误提示与表单字段关联（aria-describedby）
- [ ] 支持屏幕阅读器导航顺序
- [ ] 支持浏览器缩放 200%

### 10.2 键盘导航

| 按键 | 动作 |
|------|------|
| Tab | 切换到下一个焦点元素 |
| Shift+Tab | 切换到上一个焦点元素 |
| Enter | 激活按钮/链接 |
| Escape | 关闭模态框/下拉菜单 |

---

## 11. 扩展点

### 11.1 数据库迁移路径

当前：Zustand + localStorage

目标：PostgreSQL + Prisma

迁移步骤：
1. 定义 Prisma Schema（参考 `spec/dev/db.spec.md`）
2. 创建 API Route 替换 Store 动作
3. 将 `persist` 中间件替换为 API 调用
4. 添加用户认证（如果需要）

### 11.2 API 实现路径

当前：Mock 响应（本地生成）

目标：FastAPI 后端调用 LiteLLM

实现步骤：
1. 实现 `POST /api/extract/element` 接口
2. 替换 Mock 响应为真实 API 调用
3. 添加错误处理和重试逻辑

### 11.3 认证集成路径

当前：无认证（匿名使用）

如需添加认证：
1. 使用 NextAuth.js 或 Clerk
2. 添加 `middleware.ts` 保护路由
3. 将用户 ID 关联到文件存储

---

## 12. 验收检查清单

### 12.1 功能验收

- [ ] 文件可拖拽上传
- [ ] 文件可点击选择上传
- [ ] 上传进度显示正确
- [ ] 不支持的文件类型有错误提示
- [ ] 超过 50MB 的文件有错误提示
- [ ] 要素提取按钮可用
- [ ] SSE 流式输出正常显示
- [ ] 五要素完整展示
- [ ] AI 设置页面可切换供应商
- [ ] AI 设置页面可切换模型
- [ ] Mock 模式标识可见
- [ ] 演示模式可正常提取（无需 API Key）

### 12.2 交互验收

- [ ] 加载状态显示正确
- [ ] 错误提示清晰可读
- [ ] 空状态引导用户操作
- [ ] Toast 反馈及时
- [ ] 页面跳转流畅

### 12.3 响应式验收

- [ ] Mobile (<640px) 单列布局正常
- [ ] Tablet (640-1024px) 双列布局正常
- [ ] Desktop (>1024px) 完整布局正常
- [ ] 所有断点下功能完整可用

### 12.4 无障碍验收

- [ ] 键盘操作完整可用
- [ ] 屏幕阅读器可读取主要内容
- [ ] 颜色对比度符合 AA 标准
- [ ] 表单关联正确

---

**文档版本：** v1.0.0
**创建日期：** 2026-05-10
**维护者：** Bid Master Team