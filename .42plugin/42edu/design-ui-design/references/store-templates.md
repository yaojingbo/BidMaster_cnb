# Zustand Store 模板

## 应用状态 Store

```typescript
// lib/stores/app-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AppState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'system',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'app-storage', storage: createJSONStorage(() => localStorage) }
  )
)
```

## 实体数据 Store 模板

```typescript
// lib/stores/entity-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { MOCK_DATA } from '@/data/mock'

interface Entity {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface EntityState {
  items: Entity[]
  currentId: string | null

  // Actions
  addItem: (data: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateItem: (id: string, data: Partial<Entity>) => void
  deleteItem: (id: string) => void
  setCurrentId: (id: string | null) => void
}

export const useEntityStore = create<EntityState>()(
  persist(
    (set, get) => ({
      // 初始化使用 Mock 数据
      items: MOCK_DATA,
      currentId: MOCK_DATA[0]?.id || null,

      addItem: (data) => {
        const id = uuidv4()
        const now = new Date().toISOString()
        set((s) => ({
          items: [{ ...data, id, createdAt: now, updatedAt: now }, ...s.items],
          currentId: id,
        }))
        return id
      },

      updateItem: (id, data) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
          ),
        }))
      },

      deleteItem: (id) => {
        set((s) => ({
          items: s.items.filter((item) => item.id !== id),
          currentId: s.currentId === id ? null : s.currentId,
        }))
      },

      setCurrentId: (id) => set({ currentId: id }),
    }),
    { name: 'entity-storage', storage: createJSONStorage(() => localStorage) }
  )
)
```

## 带 Mock 模式的 Store

```typescript
// lib/stores/chat-store.ts
interface ChatState {
  useMockMode: boolean
  setMockMode: (mock: boolean) => void
  // ... 其他状态
}

// 组件中使用
const handleSend = async (message: string) => {
  const { useMockMode } = useChatStore.getState()

  if (useMockMode) {
    // Mock 响应 - 无需 API 密钥
    await simulateMockAIResponse(message)
  } else {
    // 真实 API 调用
    await callRealAI(message)
  }
}
```

## 状态管理要点

1. **使用 persist 中间件** - 自动同步到 localStorage
2. **Mock 数据初始化** - `items: MOCK_DATA` 而非 `items: []`
3. **Mock 模式标志** - 支持无依赖测试
4. **乐观更新** - 先更新 UI，再同步存储
