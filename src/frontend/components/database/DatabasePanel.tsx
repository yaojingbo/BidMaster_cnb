"use client";

import { Database, RefreshCw } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface DatabasePanelProps {
  fileCount: number;
  totalSize: number;
  onRefresh?: () => void;
}

export function DatabasePanel({ fileCount, totalSize, onRefresh }: DatabasePanelProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">存储统计</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-muted rounded"
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-muted/50 rounded">
          <p className="text-2xl font-bold">{fileCount}</p>
          <p className="text-sm text-muted-foreground">文件总数</p>
        </div>
        <div className="p-3 bg-muted/50 rounded">
          <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
          <p className="text-sm text-muted-foreground">存储用量</p>
        </div>
      </div>
    </div>
  );
}