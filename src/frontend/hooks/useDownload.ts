/**
 * Hook for file download functionality.
 */
import { useCallback, useState } from "react";
import { downloadFile, downloadBlob } from "@/lib/api";

export function useDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(async (fileId: string, filename?: string) => {
    setIsDownloading(true);

    try {
      const blob = await downloadFile(fileId);
      downloadBlob(blob, filename || `${fileId}.pdf`);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    download,
    isDownloading,
  };
}