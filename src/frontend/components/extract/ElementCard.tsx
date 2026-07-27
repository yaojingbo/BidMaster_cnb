"use client";

import React from "react";
import { FileText, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ElementCardProps {
  name: string;
  content: string;
  confidence?: number;
  isHighlighted?: boolean;
}

export function ElementCard({
  name,
  content,
  confidence,
  isHighlighted,
}: ElementCardProps) {
  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-colors",
        isHighlighted && "border-primary shadow-md"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">{name}</h3>
        </div>
        {confidence !== undefined && (
          <span
            className={cn(
              "text-sm px-2 py-1 rounded",
              confidence >= 90
                ? "bg-success-light text-success"
                : confidence >= 70
                ? "bg-warning-light text-warning"
                : "bg-error-light text-destructive"
            )}
          >
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      <p className="text-muted-foreground">{content}</p>
    </div>
  );
}