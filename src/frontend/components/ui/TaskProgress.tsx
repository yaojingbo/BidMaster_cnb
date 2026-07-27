"use client";

import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Square } from "lucide-react";

interface TaskProgressPhase {
  key: string;
  label: string;
  icon?: React.ElementType;
}

interface TaskProgressProps {
  phases: TaskProgressPhase[];
  currentPhase: string | null;
  percentage?: number | null;
  message?: string;
  isActive: boolean;
  isDone: boolean;
  errorMessage?: string | null;
  showStop?: boolean;
  onStop?: () => void;
}

export function TaskProgress({
  phases,
  currentPhase,
  percentage,
  message,
  isActive,
  isDone,
  errorMessage,
  showStop,
  onStop,
}: TaskProgressProps) {
  const currentIndex = currentPhase
    ? phases.findIndex((p) => p.key === currentPhase)
    : -1;

  const displayPercentage = isDone
    ? 100
    : errorMessage
      ? (percentage ?? Math.round(((currentIndex + 1) / phases.length) * 100))
      : (percentage ?? null);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      {/* 阶段指示器 */}
      <div className="flex items-center gap-1">
        {phases.map((phase, idx) => {
          const isCompleted = isDone || idx < currentIndex;
          const isCurrent = idx === currentIndex && isActive;
          const isPending = idx > currentIndex || (!isActive && !isDone && idx === currentIndex);
          const Icon = phase.icon;

          return (
            <div key={phase.key} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  isCompleted && "bg-green-100 text-green-700",
                  isCurrent && "bg-blue-100 text-blue-700",
                  isPending && "bg-gray-100 text-gray-400",
                  errorMessage && isCurrent && "bg-red-100 text-red-700",
                )}
              >
                {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                {isCurrent && !errorMessage && <Loader2 className="w-3 h-3 animate-spin" />}
                {isCurrent && errorMessage && <XCircle className="w-3 h-3" />}
                {isPending && Icon && <Icon className="w-3 h-3" />}
                {isPending && !Icon && <span className="w-3 h-3 rounded-full border border-gray-300" />}
                <span>{phase.label}</span>
              </div>
              {idx < phases.length - 1 && (
                <div
                  className={cn(
                    "w-4 h-px",
                    idx < currentIndex ? "bg-green-400" : "bg-gray-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 进度条 + 百分比 */}
      <div className="space-y-1">
        {/* 百分比数字 */}
        {(isActive || isDone || errorMessage) && (
          <div className="flex items-center justify-between">
            <p
              className={cn(
                "text-xs",
                errorMessage ? "text-red-600" : isDone ? "text-green-600" : "text-gray-500",
              )}
            >
              {errorMessage || message || (isDone ? "完成" : "")}
            </p>
            <div className="flex items-center gap-2">
              {showStop && isActive && onStop && (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Square className="w-3 h-3" />
                  停止
                </button>
              )}
              {displayPercentage != null && (
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    errorMessage ? "text-red-600" : isDone ? "text-green-600" : "text-blue-600",
                  )}
                >
                  {Math.round(displayPercentage)}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* 进度色带 */}
        {isActive && !isDone && !errorMessage && (
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            {displayPercentage != null ? (
              <div
                className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 relative"
                style={{ width: `${Math.min(displayPercentage, 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            ) : (
              <div className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 rounded-full animate-progress-indeterminate" />
            )}
          </div>
        )}

        {/* 完成进度条 */}
        {isDone && !errorMessage && (
          <div className="w-full h-2.5 bg-green-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full w-full transition-all duration-500" />
          </div>
        )}

        {/* 错误进度条 */}
        {errorMessage && (
          <div className="w-full h-2.5 bg-red-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-300"
              style={{ width: `${displayPercentage ?? 50}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
