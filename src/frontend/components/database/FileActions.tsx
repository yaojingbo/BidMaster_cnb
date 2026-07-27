"use client";

import { Download, Eye, Trash2 } from "lucide-react";

interface FileActionsProps {
  onDownload?: () => void;
  onView?: () => void;
  onDelete?: () => void;
}

export function FileActions({ onDownload, onView, onDelete }: FileActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {onView && (
        <button
          onClick={onView}
          className="p-2 hover:bg-muted rounded"
          title="查看"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      {onDownload && (
        <button
          onClick={onDownload}
          className="p-2 hover:bg-muted rounded"
          title="下载"
        >
          <Download className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="p-2 hover:bg-error-light text-destructive rounded"
          title="删除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}