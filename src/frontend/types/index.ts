/**
 * Frontend type definitions.
 */
export type { FileUploadResponse, ProvidersResponse, ApiResponse } from "@/db/types";

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type?: string;
  category?: string;
  status: "uploading" | "processing" | "ready" | "error";
  progress?: number;
  uploadedAt?: string;
}