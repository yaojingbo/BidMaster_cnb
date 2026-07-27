/**
 * Hook for file upload functionality.
 */
import { useState, useCallback } from "react";
import { useFileStore } from "@/stores/file-store";
import { uploadFile } from "@/lib/api";

interface UseFileUploadOptions {
  onSuccess?: (fileId: string) => void;
  onError?: (error: string) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { addFile, removeFile, updateFileStatus, replaceFileId, setUploading } = useFileStore();

  const upload = useCallback(async (file: File, category: string = "tender") => {
    const tempId = `temp-${Date.now()}`;

    addFile({
      id: tempId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      category,
      status: "uploading",
      createdAt: new Date().toISOString(),
    });

    setUploading(true, 0);
    setUploadingId(tempId);

    try {
      const response = await uploadFile(file, category);

      if (response.success && response.data) {
        // Replace temp ID with real ID from backend
        const realId = response.data.id;
        replaceFileId(tempId, realId);
        updateFileStatus(realId, "ready");

        options.onSuccess?.(realId);
      } else {
        removeFile(tempId);
        options.onError?.(response.error || "Upload failed");
      }
    } catch (error) {
      removeFile(tempId);
      options.onError?.(String(error));
    } finally {
      setUploading(false);
      setUploadingId(null);
    }
  }, [addFile, removeFile, updateFileStatus, replaceFileId, setUploading, options]);

  return {
    upload,
    uploadingId,
    isUploading: uploadingId !== null,
  };
}