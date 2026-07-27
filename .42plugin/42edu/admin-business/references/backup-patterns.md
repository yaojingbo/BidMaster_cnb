# 数据备份能力模式

> 本文档提炼数据备份功能的通用实现模式，适用于 SQLite/PostgreSQL 等数据库的管理后台。

## 功能概览

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 一键备份 | 手动触发数据库备份 | P0 必选 |
| 备份列表 | 查看、管理备份文件 | P0 必选 |
| 下载备份 | 下载备份文件到本地 | P0 必选 |
| 恢复备份 | 从备份文件恢复数据 | P1 推荐 |
| 自动备份 | 定时自动执行备份 | P2 可选 |

---

## 1. 架构设计

### 1.1 目录结构

```
src/
├── lib/admin/
│   ├── backup.ts                    # 备份核心服务（服务端）
│   └── actions/
│       └── backup.ts                # Server Actions
├── app/admin/(dashboard)/backups/
│   ├── page.tsx                     # 备份管理页面
│   └── _components/
│       ├── backup-table.tsx         # 备份列表（客户端）
│       ├── create-backup-button.tsx # 创建备份按钮
│       ├── restore-backup-dialog.tsx
│       └── delete-backup-dialog.tsx
├── app/admin/api/backups/
│   └── [filename]/
│       └── download/
│           └── route.ts             # 下载 API

backups/                             # 备份存储目录
└── app_20251230_153000.sqlite.gz
```

### 1.2 Server/Client 分离原则

**关键模式**：客户端组件不能导入包含 Node.js 模块的服务端代码。

```typescript
// ❌ 错误：客户端组件导入服务端模块
// backup-table.tsx（客户端）
import { formatFileSize, type BackupInfo } from "@/lib/admin/backup"
// 这会导致 "Module not found: Can't resolve 'fs'" 错误

// ✅ 正确：在客户端组件中重新定义
// backup-table.tsx（客户端）
export interface BackupInfo {
  filename: string
  size: number
  createdAt: Date
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

### 1.3 API 设计选择

| 操作 | 实现方式 | 原因 |
|------|----------|------|
| 创建备份 | Server Action | 简洁调用，自动缓存失效 |
| 删除备份 | Server Action | 同上 |
| 恢复备份 | Server Action | 同上 |
| 下载备份 | API Route (GET) | 需要返回文件流 |

---

## 2. 核心实现

### 2.1 备份服务（服务端）

```typescript
// src/lib/admin/backup.ts
import Database from "better-sqlite3"
import { createGzip, createGunzip } from "zlib"
import { pipeline } from "stream/promises"
import { createWriteStream, createReadStream } from "fs"
import { readdir, stat, unlink, mkdir, copyFile } from "fs/promises"
import { join, resolve } from "path"
import { format } from "date-fns"

const DB_PATH = resolve(process.cwd(), "sqlite.db")
const BACKUP_DIR = resolve(process.cwd(), "backups")

export interface BackupInfo {
  filename: string
  size: number
  createdAt: Date
}

export interface BackupResult {
  success: boolean
  filename: string
  size: number
  timestamp: Date
}

/**
 * 创建数据库备份
 * 使用 better-sqlite3 的 backup API + gzip 压缩
 */
export async function createBackup(): Promise<BackupResult> {
  await ensureBackupDir()

  const timestamp = format(new Date(), "yyyyMMdd_HHmmss")
  const tempFilename = `temp_${timestamp}.sqlite`
  const finalFilename = `app_${timestamp}.sqlite.gz`
  const tempPath = join(BACKUP_DIR, tempFilename)
  const finalPath = join(BACKUP_DIR, finalFilename)

  try {
    // 1. 使用 SQLite backup API 创建数据库副本（安全、一致）
    const db = new Database(DB_PATH, { readonly: true })
    await db.backup(tempPath)
    db.close()

    // 2. gzip 压缩
    const source = createReadStream(tempPath)
    const gzip = createGzip()
    const destination = createWriteStream(finalPath)
    await pipeline(source, gzip, destination)

    // 3. 清理临时文件
    await unlink(tempPath)

    const stats = await stat(finalPath)
    return {
      success: true,
      filename: finalFilename,
      size: stats.size,
      timestamp: new Date(),
    }
  } catch (error) {
    try { await unlink(tempPath) } catch {}
    throw error
  }
}

/**
 * 恢复数据库备份
 * 包含验证和自动备份当前数据
 */
export async function restoreBackup(filename: string): Promise<{
  success: boolean
  preRestoreBackup: string
}> {
  // 安全检查
  if (!filename.endsWith(".sqlite.gz")) {
    throw new Error("无效的备份文件名")
  }
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new Error("无效的文件名")
  }

  const backupPath = join(BACKUP_DIR, filename)
  const timestamp = format(new Date(), "yyyyMMdd_HHmmss")
  const tempPath = join(BACKUP_DIR, `restore_temp_${timestamp}.sqlite`)
  const preRestoreFilename = `pre_restore_${timestamp}.sqlite.gz`

  try {
    // 1. 解压备份文件
    const source = createReadStream(backupPath)
    const gunzip = createGunzip()
    const destination = createWriteStream(tempPath)
    await pipeline(source, gunzip, destination)

    // 2. 验证 SQLite 格式
    try {
      const testDb = new Database(tempPath, { readonly: true })
      testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      testDb.close()
    } catch {
      await unlink(tempPath)
      throw new Error("备份文件格式无效或已损坏")
    }

    // 3. 备份当前数据库（安全网）
    const currentDb = new Database(DB_PATH, { readonly: true })
    const currentTempPath = join(BACKUP_DIR, `current_temp_${timestamp}.sqlite`)
    await currentDb.backup(currentTempPath)
    currentDb.close()

    // 压缩当前数据库备份
    const preRestorePath = join(BACKUP_DIR, preRestoreFilename)
    const currentSource = createReadStream(currentTempPath)
    const gzip = createGzip()
    const currentDest = createWriteStream(preRestorePath)
    await pipeline(currentSource, gzip, currentDest)
    await unlink(currentTempPath)

    // 4. 替换数据库文件
    await copyFile(tempPath, DB_PATH)
    await unlink(tempPath)

    return {
      success: true,
      preRestoreBackup: preRestoreFilename,
    }
  } catch (error) {
    try { await unlink(tempPath) } catch {}
    throw error
  }
}
```

### 2.2 Server Actions

```typescript
// src/lib/admin/actions/backup.ts
"use server"

import { revalidatePath } from "next/cache"
import { getCurrentAdmin } from "@/lib/admin/auth"
import { logAudit } from "@/lib/admin/audit"
import {
  createBackup as createBackupService,
  listBackups as listBackupsService,
  deleteBackup as deleteBackupService,
  restoreBackup as restoreBackupService,
} from "@/lib/admin/backup"

export async function createBackupAction() {
  const admin = await getCurrentAdmin()
  if (!admin) return { success: false, error: "未授权访问" }

  try {
    const result = await createBackupService()

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "backup",
      targetType: "backup",
      targetId: result.filename,
    })

    revalidatePath("/admin/backups")
    return { success: true, filename: result.filename }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "创建备份失败" }
  }
}

export async function restoreBackupAction(filename: string) {
  const admin = await getCurrentAdmin()
  if (!admin) return { success: false, error: "未授权访问" }

  try {
    const result = await restoreBackupService(filename)

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "restore",
      targetType: "backup",
      targetId: filename,
      changes: { preRestoreBackup: { old: null, new: result.preRestoreBackup } },
    })

    revalidatePath("/admin/backups")
    revalidatePath("/admin")
    return { success: true, preRestoreBackup: result.preRestoreBackup }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "恢复失败" }
  }
}
```

### 2.3 下载 API Route

```typescript
// src/app/admin/api/backups/[filename]/download/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createReadStream, existsSync } from "fs"
import { stat } from "fs/promises"
import { getCurrentAdmin } from "@/lib/admin/auth"
import { getBackupPath } from "@/lib/admin/backup"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 })
  }

  const { filename } = await params

  try {
    const filepath = getBackupPath(filename)

    if (!existsSync(filepath)) {
      return NextResponse.json({ error: "备份文件不存在" }, { status: 404 })
    }

    const stats = await stat(filepath)
    const stream = createReadStream(filepath)

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stats.size.toString(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}
```

---

## 3. UI 组件模式

### 3.1 危险操作确认对话框

使用 `asChild` 解决 Radix UI 的 HTML 嵌套问题：

```tsx
// ❌ 错误：AlertDialogDescription 渲染为 <p>，内部不能嵌套 <p>
<AlertDialogDescription className="space-y-2">
  <p>你确定要恢复吗？</p>
  <p>当前数据将被覆盖。</p>
</AlertDialogDescription>

// ✅ 正确：使用 asChild 让 AlertDialogDescription 渲染为 div
<AlertDialogDescription asChild>
  <div className="space-y-2 text-sm text-muted-foreground">
    <p>你确定要恢复吗？</p>
    <p className="text-amber-600">当前数据将被覆盖。</p>
  </div>
</AlertDialogDescription>
```

### 3.2 恢复确认对话框

```tsx
"use client"

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
import { AlertTriangle, Loader2 } from "lucide-react"

export function RestoreBackupDialog({ open, onOpenChange, filename }) {
  const [loading, setLoading] = useState(false)

  const handleRestore = async () => {
    setLoading(true)
    try {
      const result = await restoreBackupAction(filename)
      if (result.success) {
        toast.success("数据恢复成功", {
          description: `恢复前的数据已备份为: ${result.preRestoreBackup}`,
        })
        onOpenChange(false)
      } else {
        toast.error(result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>确认恢复数据</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                你确定要从备份 <strong className="font-mono">{filename}</strong> 恢复数据吗？
              </p>
              <p className="text-amber-600 dark:text-amber-500">
                当前数据库中的所有数据将被备份文件中的数据替换。
                恢复前会自动创建当前数据的备份。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestore}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            确认恢复
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### 3.3 空状态展示

```tsx
if (backups.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-1">暂无备份</h3>
      <p className="text-sm text-muted-foreground mb-4">
        点击"创建备份"按钮开始第一次备份
      </p>
    </div>
  )
}
```

---

## 4. 审计日志扩展

### 4.1 Schema 扩展

```typescript
// src/lib/db/admin-schema.ts
export const auditLog = sqliteTable("audit_log", {
  // ...
  action: text("action", {
    enum: [
      "create", "update", "delete", "login", "logout",
      "suspend", "activate",
      "backup", "restore"  // 新增备份操作
    ]
  }).notNull(),
  targetType: text("targetType", {
    enum: [
      "skill", "user", "category", "settings", "admin",
      "backup"  // 新增备份目标类型
    ]
  }).notNull(),
  // ...
})
```

### 4.2 类型定义同步更新

```typescript
// src/lib/admin/audit.ts
interface AuditLogInput {
  actorId: string
  actorName: string
  action: "create" | "update" | "delete" | "login" | "logout" |
          "suspend" | "activate" | "backup" | "restore"
  targetType: "skill" | "user" | "category" | "settings" | "admin" | "backup"
  targetId?: string
  changes?: Record<string, { old: unknown; new: unknown }>
}
```

---

## 5. 安全考虑

### 5.1 路径遍历防护

```typescript
// 防止路径遍历攻击
if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
  throw new Error("无效的文件名")
}

// 验证文件扩展名
if (!filename.endsWith(".sqlite.gz")) {
  throw new Error("无效的备份文件名")
}
```

### 5.2 权限验证

```typescript
// 所有操作都需要管理员权限
const admin = await getCurrentAdmin()
if (!admin) {
  return { success: false, error: "未授权访问" }
}
```

### 5.3 恢复安全网

```typescript
// 恢复前自动备份当前数据，防止误操作
const preRestoreFilename = `pre_restore_${timestamp}.sqlite.gz`
// ... 创建当前数据备份
return { success: true, preRestoreBackup: preRestoreFilename }
```

---

## 6. 套利视角

| 能力 | 降本策略 | 价值量化 |
|------|----------|----------|
| 一键备份 | 减试错成本 | 关键操作前一键保底，省去手动操作 |
| 自动备份 | 减时间成本 | 定时执行，无需人工干预 |
| 恢复功能 | 减试错成本 | 数据丢失可快速恢复，减少损失 |
| 恢复安全网 | 减试错成本 | 恢复前自动备份，二次保底 |

---

## 7. 侧边栏集成

```tsx
// src/components/admin/layout/sidebar.tsx
import { HardDrive } from "lucide-react"

const navItems = [
  // ... 其他菜单项
  {
    title: "审计日志",
    href: "/admin/audit-logs",
    icon: ClipboardList,
  },
  {
    title: "数据备份",
    href: "/admin/backups",
    icon: HardDrive,
  },
  {
    title: "系统设置",
    href: "/admin/settings",
    icon: Settings,
  },
]
```

---

## 8. PostgreSQL 适配

对于 PostgreSQL 数据库，备份逻辑需要调整：

```typescript
// PostgreSQL 备份选项
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function createPostgresBackup(): Promise<BackupResult> {
  const timestamp = format(new Date(), "yyyyMMdd_HHmmss")
  const filename = `app_${timestamp}.sql.gz`
  const filepath = join(BACKUP_DIR, filename)

  // 使用 pg_dump
  const dbUrl = process.env.DATABASE_URL
  await execAsync(`pg_dump "${dbUrl}" | gzip > "${filepath}"`)

  const stats = await stat(filepath)
  return {
    success: true,
    filename,
    size: stats.size,
    timestamp: new Date(),
  }
}
```

---

## 9. 验证清单

生成备份功能后验证：

- [ ] 创建备份成功，文件格式正确（.sqlite.gz）
- [ ] 备份列表显示正确（文件名、大小、时间）
- [ ] 下载功能正常，文件可解压
- [ ] 恢复前有二次确认对话框
- [ ] 恢复前自动创建 pre_restore 备份
- [ ] 恢复后数据正确
- [ ] 所有操作记录审计日志
- [ ] 权限验证正常（未登录拒绝访问）
- [ ] 无 TypeScript 编译错误
- [ ] 无 Hydration 错误
