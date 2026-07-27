/**
 * 持久化任务状态 Store
 *
 * 跟踪三个页面的活跃任务状态，通过 persist 中间件保存到 localStorage，
 * 使得用户在页面间切换时不会丢失正在进行的任务状态。
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

function createDebouncedStorage() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const delay = 300;
  return {
    getItem: (name: string) => localStorage.getItem(name),
    setItem: (name: string, value: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(name, value);
        timer = null;
      }, delay);
    },
    removeItem: (name: string) => localStorage.removeItem(name),
  };
}

// =============================================================================
// 类型定义
// =============================================================================

interface ExtractedElement {
  name: string;
  content: string;
}

interface ExtractTaskState {
  isStreaming: boolean;
  currentPhase: string | null;
  progressMessage: string;
  extractedElements: ExtractedElement[];
  streamRawText: string;
  isDone: boolean;
  errorMessage: string | null;
  selectedFileId: string | null;
  activeTab: string;
  percentage: number | null;
  updatedAt: number;
}

interface SimulateTaskData {
  taskId: string;
  currentStep: number;
  status: string;
  fileIds: string[];
  params: Record<string, string>;
  step1Result: string;
  step2Result: string;
  step3Result: string;
  step4Result: string;
}

interface SimulateTaskState {
  task: SimulateTaskData | null;
  streamContent: string;
  isStreaming: boolean;
  runningStep: number | null;
}

interface StatisticsTaskState {
  result: Record<string, any> | null;
  aiContent: string;
  aiStreaming: boolean;
  uploadedFile: { id: string; name: string } | null;
  analysisTaskId: string | null;
}

interface TaskStore {
  extract: ExtractTaskState | null;
  simulate: SimulateTaskState | null;
  statistics: StatisticsTaskState | null;

  updateExtract: (state: ExtractTaskState) => void;
  clearExtract: () => void;

  updateSimulate: (state: SimulateTaskState) => void;
  clearSimulate: () => void;

  updateStatistics: (state: StatisticsTaskState) => void;
  clearStatistics: () => void;

  /** 检查某个页面的任务是否还在处理中（用于页面挂载时判断） */
  isExtractProcessing: () => boolean;
  isSimulateProcessing: () => boolean;
  isStatisticsProcessing: () => boolean;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      extract: null,
      simulate: null,
      statistics: null,

      updateExtract: (state) => set({ extract: state }),
      clearExtract: () => set({ extract: null }),

      updateSimulate: (state) => set({ simulate: state }),
      clearSimulate: () => set({ simulate: null }),

      updateStatistics: (state) => set({ statistics: state }),
      clearStatistics: () => set({ statistics: null }),

      isExtractProcessing: () => {
        const s = get().extract;
        return s !== null && s.isStreaming && !s.isDone && !s.errorMessage;
      },
      isSimulateProcessing: () => {
        const s = get().simulate;
        return s !== null && s.isStreaming;
      },
      isStatisticsProcessing: () => {
        const s = get().statistics;
        return s !== null && s.aiStreaming;
      },
    }),
    {
      name: "bid-master-task-store",
      version: 1,
      storage: createJSONStorage(() => createDebouncedStorage()),
    }
  )
);

export type {
  ExtractedElement,
  ExtractTaskState,
  SimulateTaskData,
  SimulateTaskState,
  StatisticsTaskState,
};
