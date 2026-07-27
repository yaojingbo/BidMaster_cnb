"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DataPreviewTableProps {
  columns: string[];
  data: Record<string, unknown>[];
  maxRows?: number;
}

export function DataPreviewTable({ columns, data, maxRows = 10 }: DataPreviewTableProps) {
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">数据预览</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-left p-2 font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b hover:bg-muted/50">
                  {columns.map((col) => (
                    <td key={col} className="p-2 truncate max-w-[200px]">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <p className="text-sm text-muted-foreground text-center py-2">
              ... 还有 {data.length - maxRows} 行数据
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
