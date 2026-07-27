/**
 * Database management store using Zustand.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Task {
  id: string;
  type: "element_extract" | "opening_analysis" | "simulated_doc";
  status: "pending" | "processing" | "done" | "failed";
  documentId: string;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseState {
  tasks: Task[];
  isLoading: boolean;

  // Actions
  addTask: (task: Task) => void;
  removeTask: (id: string) => void;
  updateTaskStatus: (id: string, status: Task["status"]) => void;
  setLoading: (isLoading: boolean) => void;
  clearTasks: () => void;
}

export const useDatabaseStore = create<DatabaseState>()(
  persist(
    (set) => ({
      tasks: [],
      isLoading: false,

      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task],
      })),

      removeTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      })),

      updateTaskStatus: (id, status) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
        ),
      })),

      setLoading: (isLoading) => set(() => ({ isLoading })),

      clearTasks: () => set(() => ({ tasks: [], isLoading: false })),
    }),
    {
      name: "bid-master-database-store",
    }
  )
);