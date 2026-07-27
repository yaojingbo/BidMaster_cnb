"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  analysisId: string;
  format?: "pdf" | "excel" | "json";
  onExport?: (format: "pdf" | "excel" | "json") => void;
}

export function ExportButton({ analysisId, format = "pdf", onExport }: ExportButtonProps) {
  const handleExport = () => {
    onExport?.(format);
    window.open(`/api/statistics/export/${analysisId}?format=${format}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Button onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      导出 {format.toUpperCase()}
    </Button>
  );
}
