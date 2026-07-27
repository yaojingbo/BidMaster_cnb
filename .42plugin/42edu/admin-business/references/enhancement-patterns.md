# 管理后台增强能力框架

> 本文档提炼通用的管理后台增强能力模式，可应用于任何业务类型的管理后台生成。

## 能力框架总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    管理后台增强能力框架                           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 0: 实体管理能力 [v3.1 新增]                               │
│  ├── CRUD Operations（增删改查）                                 │
│  ├── Soft Delete（软删除）                                       │
│  └── Action Menu（操作菜单）                                     │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 数据层能力                                             │
│  ├── Seed（测试数据填充）                                        │
│  ├── Import/Export（导入导出）                                   │
│  └── Validation（数据验证）                                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: 操作层能力                                             │
│  ├── Bulk Operations（批量操作）                                 │
│  ├── Advanced Search（高级搜索）                                 │
│  └── Workflow Actions（工作流操作）                              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: 交互层能力                                             │
│  ├── Keyboard Shortcuts（快捷键）                                │
│  ├── Real-time Notifications（实时通知）                         │
│  └── Command Palette（命令面板）                                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: 数据备份能力 [v3.3 新增]                               │
│  ├── Manual Backup（一键备份）                                   │
│  ├── Backup Management（备份管理）                               │
│  ├── Download Backup（下载备份）                                 │
│  ├── Restore Backup（数据恢复）                                  │
│  └── Pre-Restore Safety（恢复安全网）                            │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: 质量保障能力                                           │
│  ├── E2E Test Generation（测试生成）                             │
│  ├── Performance Benchmark（性能基准）                           │
│  └── Accessibility Check（可访问性检查）                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 0: 实体管理能力 [v3.1 新增]

> 管理后台的基础能力，为每个业务实体提供完整的增删改查操作。

### 0.1 CRUD Operations（增删改查）

**价值**: 管理后台的核心功能，支持对业务实体的完整生命周期管理

**标准操作**:
| 操作 | 触发方式 | UI 组件 | Server Action |
|------|----------|---------|---------------|
| 创建 | 页面按钮 | Dialog + Form | `createEntity()` |
| 读取 | 列表/详情页 | Table / Card | `getEntities()` / `getEntityById()` |
| 更新 | 行操作菜单 | Dialog + Form | `updateEntity()` |
| 删除 | 行操作菜单 | AlertDialog | `deleteEntity()` |

**Dialog 表单模式**:
```tsx
// 新增实体对话框
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { createEntity } from "@/lib/admin/actions/entities"

export function AddEntityDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 表单验证
    if (!formData.name.trim()) {
      toast.error("请输入名称")
      return
    }

    setIsLoading(true)
    try {
      const result = await createEntity(formData)
      if (result.success) {
        toast.success("创建成功")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || "创建失败")
      }
    } catch {
      toast.error("创建失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新增
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新增实体</DialogTitle>
            <DialogDescription>创建一个新的实体</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**编辑实体对话框**:
```tsx
// 编辑实体对话框（受控模式）
interface EditEntityDialogProps {
  entity: Entity
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEntityDialog({ entity, open, onOpenChange }: EditEntityDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: entity.name,
    email: entity.email,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await updateEntity(entity.id, formData)
      if (result.success) {
        toast.success("更新成功")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || "更新失败")
      }
    } catch {
      toast.error("更新失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          {/* 表单内容 */}
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### 0.2 Soft Delete（软删除）

**价值**: 数据安全，支持恢复误删数据，满足审计合规要求

**Schema 设计**:
```typescript
// 添加 deletedAt 字段实现软删除
export const entity = sqliteTable("entity", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ... 其他字段
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp" }), // 软删除标记
})
```

**查询过滤**:
```typescript
// 默认排除已删除数据
export async function getEntities(params: { includeDeleted?: boolean } = {}) {
  const { includeDeleted = false } = params

  const conditions = []
  if (!includeDeleted) {
    conditions.push(isNull(entity.deletedAt))
  }

  return db.select().from(entity).where(and(...conditions))
}
```

**删除确认对话框**:
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function DeleteEntityDialog({ entity, open, onOpenChange }: DeleteEntityDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const result = await deleteEntity(entity.id)
      if (result.success) {
        toast.success("删除成功")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || "删除失败")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除？</AlertDialogTitle>
          <AlertDialogDescription>
            您即将删除 <span className="font-medium">{entity.name}</span>。
            此操作为软删除，数据将被保留。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Server Action 实现**:
```typescript
"use server"

export async function deleteEntity(id: string) {
  const admin = await getCurrentAdmin()
  if (!admin) return { success: false, error: "未授权" }

  try {
    const [existing] = await db.select().from(entity).where(eq(entity.id, id)).limit(1)
    if (!existing) return { success: false, error: "实体不存在" }
    if (existing.deletedAt) return { success: false, error: "已被删除" }

    // 软删除：设置 deletedAt
    const now = new Date()
    await db.update(entity)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(entity.id, id))

    // 记录审计日志
    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "delete",
      targetType: "entity",
      targetId: id,
    })

    revalidatePath("/admin/entities")
    return { success: true }
  } catch (error) {
    return { success: false, error: "删除失败" }
  }
}

export async function restoreEntity(id: string) {
  const admin = await getCurrentAdmin()
  if (!admin) return { success: false, error: "未授权" }

  try {
    await db.update(entity)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(entity.id, id))

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "activate",
      targetType: "entity",
      targetId: id,
    })

    revalidatePath("/admin/entities")
    return { success: true }
  } catch (error) {
    return { success: false, error: "恢复失败" }
  }
}
```

---

### 0.3 Action Menu（操作菜单）

**价值**: 统一的行级操作入口，提升操作效率

**DropdownMenu 模式**:
```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
import Link from "next/link"
import { EditEntityDialog } from "./edit-entity-dialog"
import { DeleteEntityDialog } from "./delete-entity-dialog"

interface EntityActionsProps {
  entity: Entity
}

export function EntityActions({ entity }: EntityActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">操作菜单</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/entities/${entity.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditEntityDialog entity={entity} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteEntityDialog entity={entity} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  )
}
```

**列表页集成**:
```tsx
// 在表格中使用操作菜单
<TableRow key={entity.id}>
  <TableCell>{entity.name}</TableCell>
  <TableCell>{maskEmail(entity.email)}</TableCell>
  <TableCell>
    <EntityActions entity={entity} />
  </TableCell>
</TableRow>
```

---

## Layer 1: 数据层能力

### 1.1 Seed（测试数据填充）

**价值**: 消除"空壳系统"问题，即时验证和演示功能

**核心原则**:
| 原则 | 要求 | 说明 |
|------|------|------|
| 数量充足 | ≥100 条/核心实体 | 足够触发分页、搜索、统计 |
| 真实感 | Faker.js + 本地化 | 手机号、地址、姓名符合习惯 |
| 关联完整 | 外键 100% 有效 | 无孤儿数据 |
| 状态分布 | 符合业务比例 | 如订单 60% 已完成 |
| 时间分布 | 模拟增长曲线 | 早期少、近期多 |

**通用实现模式**:
```typescript
// 权重随机选择
function weightedRandom<T>(weights: Record<T, number>): T;

// 渐进式时间生成
function generateCreatedAt(index: number, total: number): Date;

// 关联数据生成
function generateRelations<T>(pool: T[], config: { min: number; max: number }): T[];
```

**适用场景**:
- 新系统演示
- 功能验证测试
- 性能压力测试
- UI/UX 评审

---

### 1.2 Import/Export（导入导出）

**价值**: 数据迁移、批量操作、备份恢复

**通用规范**:
| 功能 | 格式 | 编码 | 说明 |
|------|------|------|------|
| 导出 CSV | `.csv` | UTF-8 BOM | Excel 兼容 |
| 导出 Excel | `.xlsx` | - | 完整格式 |
| 导入 CSV | `.csv` | UTF-8 | 模板 + 验证 |
| 导入 JSON | `.json` | UTF-8 | API 友好 |

**通用实现模式**:
```typescript
// 导出函数签名
async function exportData(
  data: any[],
  format: 'csv' | 'xlsx' | 'json',
  options?: {
    filename?: string;
    columns?: string[];
    mask?: string[]; // 需脱敏的字段
  }
): Promise<Blob>;

// 导入函数签名
async function importData(
  file: File,
  schema: ZodSchema,
  options?: {
    onProgress?: (percent: number) => void;
    onError?: (row: number, error: string) => void;
    dryRun?: boolean; // 预览模式
  }
): Promise<{ success: number; failed: number; errors: ImportError[] }>;
```

---

### 1.3 Validation（数据验证）

**价值**: 确保数据完整性、业务规则一致性

**验证层级**:
```
客户端验证 (Zod Schema)
    ↓
服务端验证 (Server Action)
    ↓
数据库约束 (Drizzle Schema)
```

**通用验证规则**:
| 类型 | 规则 | 示例 |
|------|------|------|
| 必填 | `.min(1)` | 名称不能为空 |
| 格式 | `.regex()` | 手机号格式 |
| 范围 | `.min()/.max()` | 价格 0-999999 |
| 枚举 | `.enum()` | 状态值 |
| 关联 | 自定义 | 外键存在性 |
| 唯一 | 数据库约束 | SKU 唯一 |

---

## Layer 2: 操作层能力

### 2.1 Bulk Operations（批量操作）

**价值**: 提升管理效率，减少重复操作

**标准批量操作**:
| 操作 | 触发条件 | 确认方式 |
|------|----------|----------|
| 批量删除 | 选中 ≥1 条 | 二次确认弹窗 |
| 批量状态变更 | 选中 ≥1 条 | 下拉选择 + 确认 |
| 批量导出 | 选中 ≥1 条 | 直接下载 |
| 批量标签 | 选中 ≥1 条 | 标签选择器 |

**UI 模式**:
```tsx
// 批量操作工具栏（选中时显示）
{selectedRows.length > 0 && (
  <BulkActionBar
    count={selectedRows.length}
    actions={[
      { label: '删除', icon: Trash, onClick: handleBulkDelete, danger: true },
      { label: '导出', icon: Download, onClick: handleBulkExport },
      { label: '状态', icon: RefreshCw, children: statusActions },
    ]}
    onClear={clearSelection}
  />
)}
```

---

### 2.2 Advanced Search（高级搜索）

**价值**: 快速定位数据，提升查询效率

**搜索能力层级**:
| 层级 | 能力 | 实现 |
|------|------|------|
| L1 基础 | 单字段模糊搜索 | `LIKE %keyword%` |
| L2 进阶 | 多字段组合筛选 | `AND/OR` 条件 |
| L3 高级 | 全文搜索 | PostgreSQL `tsvector` |
| L4 智能 | 自然语言查询 | AI 解析 → SQL |

**标准筛选器**:
| 筛选器类型 | 适用字段 | 组件 |
|------------|----------|------|
| 文本搜索 | 名称、描述 | Input |
| 单选筛选 | 状态、类型 | Select |
| 多选筛选 | 标签、分类 | MultiSelect |
| 日期范围 | 创建时间 | DateRangePicker |
| 数值范围 | 价格、数量 | RangeSlider |

**URL 状态同步**:
```typescript
// 使用 nuqs 管理搜索参数
const [search, setSearch] = useQueryState('q');
const [status, setStatus] = useQueryState('status');
const [dateRange, setDateRange] = useQueryState('date', parseAsJson());
```

---

### 2.3 Workflow Actions（工作流操作）

**价值**: 标准化业务流程，减少误操作

**状态机模式**:
```typescript
// 订单状态机示例
const orderStateMachine = {
  pending_payment: {
    transitions: ['paid', 'cancelled'],
    actions: ['催付', '取消订单'],
  },
  paid: {
    transitions: ['shipped', 'refunding'],
    actions: ['发货', '申请退款'],
  },
  shipped: {
    transitions: ['delivered', 'exception'],
    actions: ['确认收货', '标记异常'],
  },
  // ...
};
```

**操作按钮规范**:
| 操作类型 | 颜色 | 确认 | 示例 |
|----------|------|------|------|
| 主要操作 | Primary | 否 | 保存、提交 |
| 次要操作 | Secondary | 否 | 取消、返回 |
| 危险操作 | Destructive | 是 | 删除、拒绝 |
| 成功操作 | Success | 否 | 通过、发布 |

---

## Layer 3: 交互层能力

### 3.1 Keyboard Shortcuts（快捷键）

**价值**: 提升专业用户效率

**标准快捷键映射**:
| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| `⌘ + K` | 命令面板 | 全局 |
| `⌘ + N` | 新建 | 列表页 |
| `⌘ + S` | 保存 | 表单页 |
| `⌘ + F` | 搜索 | 列表页 |
| `⌘ + E` | 导出 | 列表页 |
| `Esc` | 关闭/取消 | 弹窗/表单 |
| `Enter` | 确认 | 弹窗 |
| `↑/↓` | 导航 | 列表/菜单 |

**实现方式**:
```typescript
// 使用 kbar
const actions = [
  { id: 'new', name: '新建', shortcut: ['$mod', 'n'], perform: () => router.push('/new') },
  { id: 'search', name: '搜索', shortcut: ['$mod', 'f'], perform: () => searchRef.current?.focus() },
];
```

---

### 3.2 Real-time Notifications（实时通知）

**价值**: 即时反馈，提升用户体验

**通知类型规范**:
| 类型 | 颜色 | 持续时间 | 场景 |
|------|------|----------|------|
| Success | 绿色 | 3s | 操作成功 |
| Error | 红色 | 5s+ | 操作失败 |
| Warning | 黄色 | 4s | 警告提示 |
| Info | 蓝色 | 3s | 一般信息 |
| Loading | 灰色 | 持续 | 异步操作中 |

**通知内容规范**:
```typescript
// 好的通知
toast.success('订单已发货', {
  description: '运单号: SF1234567890',
  action: { label: '查看', onClick: () => router.push('/orders/123') },
});

// 差的通知
toast.success('操作成功'); // 太模糊
```

---

### 3.3 Command Palette（命令面板）

**价值**: 统一入口，快速访问任意功能

**命令分类**:
| 分类 | 示例命令 |
|------|----------|
| 导航 | 跳转到订单、跳转到设置 |
| 操作 | 新建用户、导出数据 |
| 搜索 | 搜索订单、搜索用户 |
| 主题 | 切换暗色模式 |
| 帮助 | 查看快捷键、联系支持 |

---

## Layer 4: 数据备份能力 [v3.3 新增]

> 完整实现模式详见 `backup-patterns.md`

### 4.1 Manual Backup（一键备份）

**价值**: 关键操作前一键保底，数据安全保障

**实现要点**:
- 使用数据库原生备份 API（SQLite: `backup()`，PostgreSQL: `pg_dump`）
- gzip 压缩减少存储空间
- 生成带时间戳的文件名（`app_20251230_153000.sqlite.gz`）

**关键代码模式**:
```typescript
// SQLite 备份（使用 better-sqlite3）
const db = new Database(DB_PATH, { readonly: true })
await db.backup(tempPath)  // 安全、一致的数据库副本
db.close()

// gzip 压缩
const source = createReadStream(tempPath)
const gzip = createGzip()
const destination = createWriteStream(finalPath)
await pipeline(source, gzip, destination)
```

---

### 4.2 Backup Management（备份管理）

**价值**: 清晰的备份历史，便于管理和查找

**功能**:
| 操作 | 实现方式 | 说明 |
|------|----------|------|
| 列表展示 | 读取备份目录 | 显示文件名、大小、时间 |
| 删除备份 | Server Action | 清理旧备份 |
| 搜索排序 | 按时间倒序 | 最新优先 |

**Server/Client 分离模式**:
```typescript
// ⚠️ 客户端组件不能导入包含 Node.js 模块的代码
// ❌ 错误
import { BackupInfo } from "@/lib/admin/backup"  // 包含 fs 模块

// ✅ 正确：在客户端组件中重新定义类型
export interface BackupInfo {
  filename: string
  size: number
  createdAt: Date
}
```

---

### 4.3 Download Backup（下载备份）

**价值**: 支持异地存储，增加数据安全冗余

**实现方式**: API Route（非 Server Action）
```typescript
// GET /api/admin/backups/[filename]/download
export async function GET(request, { params }) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const stream = createReadStream(filepath)
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
```

---

### 4.4 Restore Backup（数据恢复）

**价值**: 数据丢失可快速恢复，减少业务损失

**恢复流程**:
1. 解压备份文件
2. 验证 SQLite 格式完整性
3. 备份当前数据库（安全网）
4. 替换数据库文件
5. 记录审计日志

**安全检查**:
```typescript
// 路径遍历防护
if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
  throw new Error("无效的文件名")
}

// 文件格式验证
if (!filename.endsWith(".sqlite.gz")) {
  throw new Error("无效的备份文件名")
}

// SQLite 完整性验证
const testDb = new Database(tempPath, { readonly: true })
testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
testDb.close()
```

---

### 4.5 Pre-Restore Safety（恢复安全网）

**价值**: 恢复前自动备份，防止误操作导致数据丢失

**模式**:
```typescript
// 恢复前自动创建当前数据备份
const preRestoreFilename = `pre_restore_${timestamp}.sqlite.gz`
// 创建备份后再执行恢复
return { success: true, preRestoreBackup: preRestoreFilename }
```

---

### 4.6 UI 组件最佳实践

**asChild 模式解决 HTML 嵌套问题**:
```tsx
// ❌ Hydration 错误：<p> 不能嵌套 <p>
<AlertDialogDescription>
  <p>确定要恢复吗？</p>
  <p>当前数据将被覆盖。</p>
</AlertDialogDescription>

// ✅ 正确：使用 asChild 渲染为 div
<AlertDialogDescription asChild>
  <div className="space-y-2 text-sm text-muted-foreground">
    <p>确定要恢复吗？</p>
    <p>当前数据将被覆盖。</p>
  </div>
</AlertDialogDescription>
```

---

### 4.7 审计日志扩展

扩展审计日志支持备份操作：
```typescript
// Schema 扩展
action: text("action", {
  enum: ["create", "update", "delete", ..., "backup", "restore"]
}).notNull(),
targetType: text("targetType", {
  enum: ["skill", "user", ..., "backup"]
}).notNull(),
```

---

## Layer 5: 质量保障能力

### 5.1 E2E Test Generation（测试生成）

**价值**: 自动化回归测试，保障代码质量

**测试覆盖范围**:
| 测试类型 | 覆盖范围 | 工具 |
|----------|----------|------|
| CRUD 测试 | 增删改查流程 | Playwright |
| 权限测试 | 角色访问控制 | Playwright |
| 表单验证 | 字段校验规则 | Vitest |
| API 测试 | Server Actions | Vitest |

**自动生成模板**:
```typescript
// 列表页测试模板
test('{entity}列表页', async ({ page }) => {
  await page.goto('/admin/{entity}');
  await expect(page.getByRole('heading', { name: '{Entity}管理' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  // 分页测试
  await page.getByRole('button', { name: '下一页' }).click();
  // 搜索测试
  await page.getByPlaceholder('搜索').fill('test');
  await expect(page.getByRole('table')).toContainText('test');
});
```

---

### 5.2 Performance Benchmark（性能基准）

**价值**: 确保系统响应速度，识别性能瓶颈

**性能指标**:
| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 列表加载 | < 500ms | Server Timing |
| 表单提交 | < 1s | 用户感知 |
| 页面切换 | < 200ms | Navigation Timing |
| 搜索响应 | < 300ms | API 耗时 |

**自动检测**:
```typescript
// 性能检测中间件
export async function measurePerformance(action: () => Promise<void>, name: string) {
  const start = performance.now();
  await action();
  const duration = performance.now() - start;

  if (duration > 500) {
    console.warn(`[Performance] ${name} took ${duration}ms`);
  }
}
```

---

### 5.3 Accessibility Check（可访问性检查）

**价值**: 确保所有用户可用，符合合规要求

**检查清单**:
| 项目 | 要求 | 检测工具 |
|------|------|----------|
| 键盘导航 | 所有功能可键盘操作 | 手动测试 |
| 颜色对比 | 对比度 ≥ 4.5:1 | axe |
| 标签关联 | 表单字段有 label | axe |
| 焦点可见 | 焦点状态明显 | 手动测试 |
| 屏幕阅读器 | 正确的 ARIA 标签 | NVDA/VoiceOver |

---

## 能力启用矩阵

根据项目复杂度选择启用的能力：

| 能力 | MVP | 标准版 | 企业版 |
|------|-----|--------|--------|
| Seed | ✅ | ✅ | ✅ |
| Import/Export | - | ✅ | ✅ |
| Bulk Operations | - | ✅ | ✅ |
| Advanced Search | - | ✅ | ✅ |
| Keyboard Shortcuts | - | ✅ | ✅ |
| **Data Backup** [v3.3] | - | ✅ | ✅ |
| Command Palette | - | - | ✅ |
| E2E Tests | - | - | ✅ |
| Performance | - | - | ✅ |
| Accessibility | - | - | ✅ |

---

## 套利视角

从 4减4增 框架看增强能力的价值：

| 能力 | 降本策略 | 价值量化 |
|------|----------|----------|
| Seed | 减试错成本 | 省去手动造数据 1-2 天 |
| Import/Export | 减人力成本 | 批量操作效率提升 10x |
| Bulk Operations | 减时间成本 | 批量操作效率提升 10x |
| Advanced Search | 减时间成本 | 查找效率提升 5x |
| Shortcuts | 减时间成本 | 操作效率提升 2x |
| **Data Backup** | 减试错成本 | 关键操作前一键保底，数据恢复省去重建成本 |
| E2E Tests | 减试错成本 | 回归测试自动化 |
