"use client";

import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TestResultProps {
  success: boolean;
  message: string;
  latency?: number;
  isLoading?: boolean;
}

export function TestResult({ success, message, latency, isLoading }: TestResultProps) {
  if (isLoading) {
    return (
      <Card className="border-warning bg-warning-light">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-warning" />
          <span className="text-warning">正在测试连接...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(success ? "border-success bg-success-light" : "border-destructive bg-error-light")}>
      <CardContent className="flex items-center gap-3 p-4">
        {success ? (
          <CheckCircle className="h-5 w-5 text-success" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}
        <div className="flex-1">
          <span className={cn(success ? "text-success" : "text-destructive")}>
            {message}
          </span>
          {latency !== undefined && (
            <span className="text-sm text-muted-foreground ml-2">
              (延迟: {latency}ms)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
