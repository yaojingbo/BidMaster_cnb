/**
 * API client for file uploads and other backend operations.
 */

import { authFetch } from "@/lib/auth-fetch";

interface UploadResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    size: number;
    type: string;
  };
  error?: string;
}

export interface StreamEvent {
  type: "progress" | "element" | "done" | "error";
  message?: string;
  data?: {
    name?: string;
    content?: string;
    confidence?: number;
    summary?: string;
    message?: string;
  };
}

export async function uploadFile(file: File, category: string = "tender"): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  try {
    const response = await authFetch("/api/files/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || `Upload failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    const fileData = result.data || result;
    return {
      success: true,
      data: {
        id: fileData.id,
        name: fileData.name,
        size: fileData.size,
        type: fileData.type,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function listFiles(): Promise<{ files: any[]; total: number }> {
  const response = await authFetch("/api/files/list");
  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.status}`);
  }
  return response.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  const response = await authFetch(`/api/files/${fileId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.status}`);
  }
}

export async function downloadFile(fileId: string): Promise<Blob> {
  const response = await authFetch(`/api/files/${fileId}/download`);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }
  return response.blob();
}

export async function extractElements(
  fileId: string,
  provider: string = "deepseek",
  model?: string
): Promise<Response> {
  const response = await authFetch("/api/extract/element", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileId,
      provider,
      model,
    }),
  });
  return response;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}