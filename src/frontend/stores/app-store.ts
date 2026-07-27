/**
 * Global application store using Zustand.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  // UI State
  isSidebarOpen: boolean;
  theme: "light" | "dark";

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      theme: "light",

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "bid-master-app-store",
    }
  )
);