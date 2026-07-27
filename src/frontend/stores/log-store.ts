/**
 * 前端日志 Store
 * 记录 API 调用和错误，persist 到 localStorage，最多 200 条。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LogEntry {
  id: string;
  timestamp: string;
  source: "frontend" | "backend";
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  detail?: string;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (entry: Omit<LogEntry, "id" | "timestamp" | "source">) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 200;

export const useLogStore = create<LogStore>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (entry) =>
        set((state) => {
          const newEntry: LogEntry = {
            ...entry,
            id: Math.random().toString(36).slice(2, 10),
            timestamp: new Date().toISOString(),
            source: "frontend",
          };
          const updated = [newEntry, ...state.logs].slice(0, MAX_LOGS);
          return { logs: updated };
        }),
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: "bid-master-log-store",
      partialize: (state) => ({ logs: state.logs }),
    }
  )
);
