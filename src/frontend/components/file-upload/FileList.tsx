"use client";

import { FileRow } from "./FileRow";
import { FileItem } from "@/types";

interface FileListProps {
  files: FileItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function FileList({ files, selectedId, onSelect, onDelete }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无文件
      </div>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          isSelected={selectedId === file.id}
          onClick={() => onSelect?.(file.id)}
          onDelete={onDelete ? () => onDelete(file.id) : undefined}
        />
      ))}
    </div>
  );
}