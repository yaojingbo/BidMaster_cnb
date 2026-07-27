"use client";

import React, { useCallback, useRef, useState, useId } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export function FileUploader({
  onUpload,
  accept = ".pdf,.md,.doc,.docx,.xlsx,.xls",
  maxSize = 50 * 1024 * 1024,
  className,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        if (file.size > maxSize) {
          alert("文件大小超过 50MB 限制");
          return;
        }
        setIsUploading(true);
        await onUpload(file);
        setIsUploading(false);
      }
    },
    [onUpload, maxSize]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > maxSize) {
          alert("文件大小超过 50MB 限制");
          e.target.value = '';
          return;
        }
        setIsUploading(true);
        await onUpload(file);
        e.target.value = '';
        setIsUploading(false);
      }
    },
    [onUpload, maxSize]
  );

  return (
    <>
      <input
        type="file"
        id={inputId}
        ref={fileInputRef}
        data-testid="file-input"
        className="file-sr-only"
        accept={accept}
        onChange={handleFileSelect}
      />
      <label
        htmlFor={inputId}
        data-testid="upload-area"
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer flex flex-col items-center gap-4",
          isDragging ? "border-primary bg-primary/5" : "hover:border-primary/50",
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="rounded-full bg-primary/10 p-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
        )}
        <div>
          <p className="text-lg font-medium">点击或拖拽文件到此区域</p>
          <p className="text-sm text-muted-foreground">
            支持 PDF、Markdown、Word、Excel（最大 50MB）
          </p>
        </div>
      </label>
    </>
  );
}
