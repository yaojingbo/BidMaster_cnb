/**
 * File management store using Zustand.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FileUploadResponse } from "@/db/types";

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  category: string;
  status: "uploading" | "processing" | "ready" | "error";
  createdAt: string;
  error?: string;
}

interface FileState {
  files: FileItem[];
  isUploading: boolean;
  uploadProgress: number;

  // Actions
  addFile: (file: FileItem) => void;
  removeFile: (id: string) => void;
  updateFileStatus: (id: string, status: FileItem["status"], error?: string) => void;
  replaceFileId: (oldId: string, newId: string) => void;
  setUploading: (isUploading: boolean, progress?: number) => void;
  clearFiles: () => void;
  syncWithBackend: (backendIds: string[]) => void;
}

export const useFileStore = create<FileState>()(
  persist(
    (set) => ({
      files: [],
      isUploading: false,
      uploadProgress: 0,

      addFile: (file) => set((state) => ({
        // 避免重复添加相同 ID 的文件
        files: state.files.some((f) => f.id === file.id)
          ? state.files
          : [...state.files, file],
      })),

      removeFile: (id) => set((state) => ({
        files: state.files.filter((f) => f.id !== id),
      })),

      updateFileStatus: (id, status, error) => set((state) => ({
        files: state.files.map((f) =>
          f.id === id ? { ...f, status, error } : f
        ),
      })),

      replaceFileId: (oldId, newId) => set((state) => ({
        files: state.files.map((f) =>
          f.id === oldId ? { ...f, id: newId } : f
        ),
      })),

      setUploading: (isUploading, progress = 0) => set(() => ({
        isUploading,
        uploadProgress: progress,
      })),

      clearFiles: () => set(() => ({
        files: [],
        isUploading: false,
        uploadProgress: 0,
      })),

      syncWithBackend: (backendIds) => set((state) => ({
        files: state.files.filter((f) => backendIds.includes(f.id)),
      })),
    }),
    {
      name: "bid-master-file-store",
      onRehydrateStorage: () => (state) => {
        if (state && state.files.length > 0) {
          const seen = new Set<string>();
          const files = state.files.filter((f) => {
            if (f.id.startsWith("temp-") || f.status !== "ready") return false;
            if (seen.has(f.id)) return false;
            seen.add(f.id);
            return true;
          });
          if (files.length !== state.files.length) {
            state.files = files;
          }
        }
      },
    }
  )
);
