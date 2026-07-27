"use client";

import { FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "ready" | "error";
}

interface FileRowProps {
  file: FileItem;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export function FileRow({ file, isSelected, onClick, onDelete }: FileRowProps) {
  const statusIcon = {
    uploading: <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />,
    processing: <Loader2 className="h-5 w-5 animate-spin text-warning" />,
    ready: <CheckCircle className="h-5 w-5 text-success" />,
    error: <AlertCircle className="h-5 w-5 text-destructive" />,
  };

  const statusText = {
    uploading: "上传中",
    processing: "处理中",
    ready: "就绪",
    error: "错误",
  };

  return (
    <div
      className={cn(
        "p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors",
        isSelected && "bg-primary/5",
        onDelete && "pr-12"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "px-2 py-1 rounded text-xs flex items-center gap-1",
            file.status === "ready" && "bg-success-light text-success",
            file.status === "uploading" && "bg-info-light text-info",
            file.status === "processing" && "bg-warning-light text-warning",
            file.status === "error" && "bg-error-light text-destructive"
          )}
        >
          {statusIcon[file.status]}
          {statusText[file.status]}
        </span>
      </div>
    </div>
  );
}