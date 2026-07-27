"use client";

import { useState } from "react";
import { FileText, ArrowLeftRight, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Element {
  name: string;
  content: string;
  confidence?: number;
}

interface CompareViewProps {
  leftFile?: {
    name: string;
    content: string;
    extractedElements?: Record<string, string>;
  };
  rightFile?: {
    name: string;
    content: string;
    extractedElements?: Record<string, string>;
  };
}

export function CompareView({ leftFile, rightFile }: CompareViewProps) {
  const [compareItems, setCompareItems] = useState<{
    name: string;
    leftContent: string;
    rightContent: string;
    isMatch: boolean;
  }[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = async () => {
    if (!leftFile?.extractedElements || !rightFile?.extractedElements) {
      return;
    }

    setIsComparing(true);

    const items: typeof compareItems = [];
    const allKeys = new Set([
      ...Object.keys(leftFile.extractedElements),
      ...Object.keys(rightFile.extractedElements),
    ]);

    allKeys.forEach((key) => {
      const leftValue = leftFile.extractedElements?.[key] || "";
      const rightValue = rightFile.extractedElements?.[key] || "";
      items.push({
        name: key,
        leftContent: leftValue,
        rightContent: rightValue,
        isMatch: leftValue === rightValue,
      });
    });

    setCompareItems(items);
    setIsComparing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            文件对比
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">招标文件 A</label>
              <Input
                value={leftFile?.name || ""}
                placeholder="选择第一个文件"
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">招标文件 B</label>
              <Input
                value={rightFile?.name || ""}
                placeholder="选择第二个文件"
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <Button
            onClick={handleCompare}
            disabled={!leftFile || !rightFile || isComparing}
            className="w-full"
          >
            {isComparing ? "对比中..." : "开始对比"}
          </Button>
        </CardContent>
      </Card>

      {compareItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">对比结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {compareItems.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "border rounded-lg p-3",
                    item.isMatch ? "border-success bg-success-light" : "border-destructive bg-error-light"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{item.name}</span>
                    {item.isMatch ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded">
                      <p className="text-muted-foreground mb-1">A:</p>
                      <p className="truncate">{item.leftContent || "(空)"}</p>
                    </div>
                    <div className="p-2 bg-white rounded">
                      <p className="text-muted-foreground mb-1">B:</p>
                      <p className="truncate">{item.rightContent || "(空)"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
