'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  FileSearch,
  Plus,
  Loader2,
  Upload,
  Copy,
  Download,
  CheckCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch, authFetchSSE } from '@/lib/auth-fetch';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskProgress } from '@/components/ui/TaskProgress';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFileStore } from '@/stores/file-store';
import { useTaskStore } from '@/stores/task-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useAuthStore } from '@/stores/auth-store';
import { listFiles } from '@/lib/data-api';
import { downloadMarkdownPdf } from '@/lib/report-download';

// 4 步流程定义
const steps = [
  { key: 1, label: 'PDF转换', desc: '将上传文件转换为文本' },
  { key: 2, label: '要素提取', desc: 'AI 提取招标文件关键要素' },
  { key: 3, label: '对比分析', desc: '多维度对比分析' },
  { key: 4, label: '模拟编制', desc: '生成模拟投标文件' },
];

// 模拟编制 SSE 阶段定义
const simulatePhases = [
  { key: 'connecting', label: '连接服务', icon: Loader2 },
  { key: 'reading', label: '读取文档', icon: FileText },
  { key: 'analyzing', label: 'AI 分析', icon: Sparkles },
  { key: 'generating', label: '生成结果', icon: CheckCircle },
  { key: 'completing', label: '完成', icon: CheckCircle },
];

const projectTypes = [
  { value: 'design', label: '设计类' },
  { value: 'construction', label: '施工类' },
  { value: 'equipment', label: '设备类' },
];

const deriveSimPhase = (percentage: number | null) => {
  if (percentage == null) return 'connecting';
  if (percentage >= 95) return 'completing';
  if (percentage >= 60) return 'generating';
  if (percentage >= 25) return 'analyzing';
  if (percentage >= 8) return 'reading';
  return 'connecting';
};

const getStepProgressState = (runningStep: number | null, percentage: number | null) => {
  if (!runningStep) {
    return { phase: null, percentage: null };
  }

  if (runningStep === 1) {
    const value = percentage ?? 18;
    return {
      phase: deriveSimPhase(value),
      percentage: value,
    };
  }

  return {
    phase: deriveSimPhase(percentage),
    percentage,
  };
};

const getStepResult = (task: TaskData | null, runningStep: number | null = null) => {
  if (!task) return '';
  if (runningStep === 1) return task.step1Result;
  if (runningStep === 2) return task.step2Result;
  if (runningStep === 3) return task.step3Result;
  if (runningStep === 4) return task.step4Result;
  return task.step4Result || task.step3Result || task.step2Result || task.step1Result || '';
};

const getStepResultTitle = (task: TaskData | null, runningStep: number | null) => {
  if (runningStep) return `步骤 ${runningStep} 实时输出`;
  if (task?.step4Result) return '模拟编制结果';
  if (task?.step3Result) return '对比分析结果';
  if (task?.step2Result) return '要素提取结果';
  if (task?.step1Result) return 'PDF转换结果';
  return '输出预览';
};

const STEP_STREAM_TITLES: Record<number, string> = {
  1: '文件转换',
  2: '要素提取',
  3: '对比分析',
  4: '模拟编制',
};

const formatStepProgressLine = (stepNum: number, message: string, percentage?: number | null) => {
  const prefix = STEP_STREAM_TITLES[stepNum] || `步骤 ${stepNum}`;
  const progress = percentage == null ? '' : ` ${percentage}%`;
  return `- ${prefix}${progress}：${message}`;
};

const makeStepPreview = (stepNum: number, lines: string[], content: string) => {
  const title = STEP_STREAM_TITLES[stepNum] || `步骤 ${stepNum}`;
  const progressBlock = lines.length > 0 ? `## 执行进度\n${lines.join('\n')}` : '';
  const contentBlock = content.trim() ? `## 实时正文\n${content.trim()}` : '';
  const waitingBlock = contentBlock ? '' : `## 实时正文\n正在等待模型生成可预览内容...`;
  return [`# 步骤 ${stepNum}：${title}`, progressBlock, contentBlock || waitingBlock]
    .filter(Boolean)
    .join('\n\n');
};

const shouldShowContentChunk = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^[{}\[\],:"]+$/.test(trimmed)) return false;
  if (/^```(?:json)?$/i.test(trimmed)) return false;
  return /[一-龥A-Za-z0-9#|*-]/.test(trimmed);
};

interface TaskData {
  taskId: string;
  currentStep: number;
  status: string;
  fileIds: string[];
  params: Record<string, string>;
  step1Result: string;
  step2Result: string;
  step3Result: string;
  step4Result: string;
}

const toTaskData = (data: any): TaskData => ({
  taskId: data.taskId,
  currentStep: data.currentStep,
  status: data.status,
  fileIds: data.fileIds,
  params: data.params || {},
  step1Result: data.step1Result || '',
  step2Result: data.step2Result || '',
  step3Result: data.step3Result || '',
  step4Result: data.step4Result || '',
});

export default function SimulatePage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const { activeProvider, activeModel } = useSettingsStore();
  const [task, setTask] = useState<TaskData | null>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [simPhase, setSimPhase] = useState<string | null>(null);
  const [simPercentage, setSimPercentage] = useState<number | null>(null);
  const [params, setParams] = useState({
    project_name: '',
    project_type: 'design',
    project_scale: '',
    investment_estimate: '',
    region: '',
    special_requirements: '',
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ===========================================================================
  // 持久化：SSE 流式状态跨页面保存
  // ===========================================================================

  // 同步状态到 taskStore（防抖，避免高频 localStorage 写入）
  const simSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopProgressTimer = useCallback(() => {
    if (!progressTimerRef.current) return;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }, []);

  const startProgressTimer = useCallback(() => {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setSimPercentage(prev => {
        const current = prev ?? 3;
        const next = Math.min(current + 2, 88);
        setSimPhase(deriveSimPhase(next));
        return next;
      });
    }, 1800);
  }, [stopProgressTimer]);

  useEffect(() => () => stopProgressTimer(), [stopProgressTimer]);

  useEffect(() => {
    if (task || isStreaming || streamContent) {
      if (simSyncTimerRef.current) clearTimeout(simSyncTimerRef.current);
      simSyncTimerRef.current = setTimeout(() => {
        useTaskStore.getState().updateSimulate({
          task,
          streamContent,
          isStreaming,
          runningStep,
        });
      }, 200);
    }
    return () => {
      if (simSyncTimerRef.current) clearTimeout(simSyncTimerRef.current);
    };
  }, [task, streamContent, isStreaming, runningStep]);

  // 页面挂载时：恢复状态 + 刷新后端任务数据
  const hasRestored = useRef(false);
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (hasRestored.current) return;
    hasRestored.current = true;

    const saved = useTaskStore.getState().simulate;
    if (!saved) return;

    // 如果没有 task，说明是残留数据，直接清除
    if (!saved.task) {
      useTaskStore.getState().clearSimulate();
      return;
    }

    // 验证任务是否属于当前用户（避免跨用户残留数据）
    authFetch(`/api/simulate/${saved.task.taskId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.data) {
          // 任务不存在或不属于当前用户，清除残留数据
          useTaskStore.getState().clearSimulate();
          return;
        }
        const restoredTask = toTaskData(data.data);
        // 恢复任务和流式状态
        setTask(restoredTask);
        setStreamContent(saved.isStreaming ? saved.streamContent || '' : '');
        setIsStreaming(saved.isStreaming || false);
        setRunningStep(saved.runningStep || null);

        // 如果有 streamContent，右侧预览区会自动显示当前步骤内容

        // 如果之前正在处理中 → 轮询后端检查步骤是否已完成
        if (saved.isStreaming && saved.runningStep) {
          let retryCount = 0;
          const maxRetries = 30;
          const poll = () => {
            authFetch(`/api/simulate/${saved.task!.taskId}`)
              .then(r => r.json())
              .then(t => {
                if (t.success && t.data) {
                  const stepResults = [
                    { step: 1, result: t.data.step1Result },
                    { step: 2, result: t.data.step2Result },
                    { step: 3, result: t.data.step3Result },
                    { step: 4, result: t.data.step4Result },
                  ];
                  const completed = stepResults.find(s => s.step === saved.runningStep && s.result);
                  if (completed) {
                    setStreamContent('');
                    setIsStreaming(false);
                    setRunningStep(null);
                    setTask(toTaskData(t.data));
                    useTaskStore.getState().clearSimulate();
                    return;
                  }
                }
                retryCount++;
                if (retryCount < maxRetries) setTimeout(poll, 1000);
              })
              .catch(() => {
                retryCount++;
                if (retryCount < maxRetries) setTimeout(poll, 1000);
              });
          };
          setTimeout(poll, 2000);
        }
      })
      .catch(() => {
        // API 失败，清除残留数据
        useTaskStore.getState().clearSimulate();
      });
  }, [authReady, isAuthenticated]);

  const { upload } = useFileUpload();
  const { files, removeFile, addFile } = useFileStore();
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    const backendIds: string[] = [];
    listFiles({ page: 1, page_size: 50 })
      .then(res => {
        for (const f of res.files) {
          backendIds.push(f.id);
          addFile({
            id: f.id,
            name: f.original_name,
            size: f.size,
            mimeType: f.type,
            category: 'tender',
            status: 'ready',
            createdAt: f.created_at || new Date().toISOString(),
          });
        }
        useFileStore.getState().syncWithBackend(backendIds);
      })
      .catch(() => {
        // 静默失败，页面仍可上传新文件
      });
  }, [addFile, authReady, isAuthenticated]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!requireAuth()) {
      e.target.value = '';
      return;
    }
    setUploadingFile(file.name);
    await upload(file);
    e.target.value = '';
    setUploadingFile(null);
    // 新上传的文件自动勾选（取 store 最新状态）
    const latest = useFileStore.getState().files;
    const newFile = latest[latest.length - 1];
    if (newFile) {
      setSelectedFileIds(prev => new Set([...prev, newFile.id]));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!requireAuth()) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setUploadingFile(file.name);
    await upload(file);
    setUploadingFile(null);
    const latest = useFileStore.getState().files;
    const newFile = latest[latest.length - 1];
    if (newFile) {
      setSelectedFileIds(prev => new Set([...prev, newFile.id]));
    }
  };

  const handleCreateTask = async () => {
    if (!requireAuth()) return;
    const fileIds = [...selectedFileIds];
    if (fileIds.length === 0 || isCreatingTask) return;

    setIsCreatingTask(true);
    setCreateTaskError(null);
    setStreamContent('# 创建模拟任务\n\n正在创建任务，请稍候...');
    try {
      const res = await authFetch('/api/simulate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: fileIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || '创建任务失败');
      }
      setTask(toTaskData(data.data));
      setStreamContent('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建任务失败';
      setCreateTaskError(message);
      setStreamContent(`# 创建模拟任务\n\n创建失败：${message}`);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const streamStep = async (stepNum: number, body?: Record<string, unknown>) => {
    if (!requireAuth()) return;
    if (!task) return;
    setStreamContent(makeStepPreview(stepNum, [], ''));
    setIsStreaming(true);
    setRunningStep(stepNum);
    setSimPhase('connecting');
    setSimPercentage(3);
    startProgressTimer();
    abortRef.current = new AbortController();

    try {
      const res = await authFetchSSE(`/api/simulate/${task.taskId}/step/${stepNum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeProvider, model: activeModel, ...body }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        // Step 1 returns JSON, not SSE
        const json = await res.json();
        if (json.success) {
          setTask(prev =>
            prev ? { ...prev, currentStep: json.data.currentStep, status: json.data.status } : prev
          );
          setSimPhase('completing');
          setSimPercentage(100);
          stopProgressTimer();
          setStreamContent(makeStepPreview(1, [formatStepProgressLine(1, 'PDF转换完成', 100)], ''));
          setRunningStep(null);
          setIsStreaming(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      let finalContent = '';
      let previewBody = '';
      const progressLines: string[] = [];
      const updatePreview = () => setStreamContent(makeStepPreview(stepNum, progressLines, previewBody));

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        if (!res.body) throw new Error('无响应体');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.phase) setSimPhase(event.phase as string);
                if (event.percentage != null) {
                  const percentage = event.percentage as number;
                  setSimPercentage(percentage);
                  if (!event.phase) setSimPhase(deriveSimPhase(percentage));
                }

                if (event.type === 'progress' || event.type === 'llm_progress') {
                  if (event.phase) setSimPhase(event.phase as string);
                  if (event.percentage != null) {
                    const percentage = event.percentage as number;
                    setSimPercentage(percentage);
                    if (!event.phase) setSimPhase(deriveSimPhase(percentage));
                  }
                  if (event.message) {
                    const line = formatStepProgressLine(
                      stepNum,
                      event.message as string,
                      event.percentage as number | null | undefined
                    );
                    if (progressLines[progressLines.length - 1] !== line) {
                      progressLines.push(line);
                      if (progressLines.length > 8) progressLines.shift();
                    }
                    updatePreview();
                  }
                } else if (event.type === 'content') {
                  if (!event.phase) setSimPhase('generating');
                  if (event.percentage == null) setSimPercentage(prev => Math.max(prev ?? 60, 60));
                  const content = String(event.content || '');
                  if (shouldShowContentChunk(content)) {
                    previewBody += content;
                    updatePreview();
                  }
                } else if (event.type === 'done') {
                  setSimPhase('completing');
                  setSimPercentage(100);
                  stopProgressTimer();
                  const summary = event.data?.summary || '步骤完成';
                  const line = formatStepProgressLine(stepNum, summary, 100);
                  if (progressLines[progressLines.length - 1] !== line) progressLines.push(line);
                  if (event.data?.content) {
                    finalContent = event.data.content;
                    previewBody = event.data.content;
                  }
                  updatePreview();
                } else if (event.type === 'error') {
                  progressLines.push(`- 执行失败：${event.data?.message || '未知错误'}`);
                  updatePreview();
                }
              } catch {
                // skip
              }
            }
          }
        }
      } else {
        // JSON response (Step 1)
        const json = await res.json();
        if (json.success) {
          setTask(prev =>
            prev ? { ...prev, currentStep: json.data.currentStep, status: json.data.status } : prev
          );
          setSimPhase('completing');
          setSimPercentage(100);
          stopProgressTimer();
          setStreamContent(makeStepPreview(1, [formatStepProgressLine(1, 'PDF转换完成', 100)], ''));
        }
      }

      stopProgressTimer();
      const completedStep = stepNum;
      const nextTask = await refreshTask();
      const savedContent = nextTask ? getStepResult(nextTask, completedStep) : '';
      if (savedContent) {
        setStreamContent(savedContent);
      } else if (finalContent) {
        setStreamContent(finalContent);
      }
      setIsStreaming(false);
      setRunningStep(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStreamContent(prev => prev + '\n⏹ 已停止\n');
      } else {
        setStreamContent(
          prev => prev + `\n❌ 失败: ${err instanceof Error ? err.message : '未知错误'}\n`
        );
      }
      stopProgressTimer();
      setIsStreaming(false);
      setRunningStep(null);
    }
  };

  const refreshTask = async () => {
    if (!task) return null;
    try {
      const res = await authFetch(`/api/simulate/${task.taskId}`);
      const data = await res.json();
      if (!data.success || !data.data) return null;

      const nextTask = toTaskData(data.data);
      setTask(nextTask);
      return nextTask;
    } catch {
      return null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopProgressTimer();
    setIsStreaming(false);
    setRunningStep(null);
  };

  const copyContent = (text: string) => navigator.clipboard.writeText(text);
  const downloadContent = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
  const handleDownloadPdf = async () => {
    if (!resultContent.trim() || isStreaming || isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      await downloadMarkdownPdf(resultContent, 'simulate_result.pdf', {
        title: '模拟编制结果',
        subtitle: resultTitle,
        sourceType: 'simulate_document',
      });
    } catch {
      alert('PDF 生成失败，请稍后重试或先下载 Markdown。');
    } finally {
      setIsPdfExporting(false);
    }
  };

  const canRunStep = (step: number) => {
    if (!task) return false;
    if (isStreaming) return false;
    if (step === 1) return task.currentStep >= 0;
    return task.currentStep >= step - 1;
  };

  const handleClearTask = async () => {
    if (!requireAuth()) return;
    if (!task) return;
    try {
      await authFetch(`/api/simulate/${task.taskId}`, { method: 'DELETE' });
    } catch {
      // ignore API errors
    }
    setTask(null);
    setStreamContent('');
    setIsStreaming(false);
    setRunningStep(null);
    stopProgressTimer();
    setSimPhase(null);
    setSimPercentage(null);
    useTaskStore.getState().clearSimulate();
  };

  const resultContent = isStreaming ? streamContent : getStepResult(task, runningStep);
  const resultTitle = getStepResultTitle(task, runningStep);
  const progressState = getStepProgressState(runningStep, simPercentage);
  const progressMessage = runningStep
    ? runningStep === 1
      ? '正在转换文件...'
      : `AI 执行中（${activeProvider}/${activeModel || 'default'}）...`
    : '';

  return (
    <WorkbenchLayout>
      <div className="w-full space-y-6">
        <PageHeader title="模拟编制" description="四步引导式生成模拟招标文件" />

        <ResizableSplit
          storageKey="simulate-split-width"
          left={(
            <div className="space-y-5">
            {!task && (
              <>
                <input
                  type="file"
                  id="simulate-file-input"
                  ref={fileInputRef}
                  className="file-sr-only"
                  accept=".pdf,.md,.doc,.docx"
                  onChange={handleUpload}
                />
                <label
                  htmlFor="simulate-file-input"
                  className={cn(
                    'border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer flex flex-col items-center gap-4',
                    isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 p-3">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">点击上传招标文件</p>
                    <p className="text-sm text-muted-foreground">支持 PDF、Markdown、Word 格式</p>
                  </div>
                  {uploadingFile && (
                    <p className="mt-3 text-sm text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      上传中: {uploadingFile}
                    </p>
                  )}
                </label>

                {/* 文件选择列表 */}
                {files.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        参考文档 ({selectedFileIds.size}/{files.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedFileIds(new Set(files.map(f => f.id)))}
                          className="text-xs text-primary hover:underline"
                        >
                          全选
                        </button>
                        <button
                          onClick={() => setSelectedFileIds(new Set())}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          取消全选
                        </button>
                      </div>
                    </div>
                    <div className="divide-y max-h-[240px] overflow-auto">
                      {files.map(file => (
                        <div
                          key={file.id}
                          className="px-3 py-2 flex items-center gap-3 hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFileIds.has(file.id)}
                            onChange={e => {
                              setSelectedFileIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(file.id);
                                else next.delete(file.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {file.size < 1024 * 1024
                              ? `${(file.size / 1024).toFixed(0)}KB`
                              : `${(file.size / 1024 / 1024).toFixed(1)}MB`}
                          </span>
                          <button
                            onClick={() => {
                              removeFile(file.id);
                              setSelectedFileIds(prev => {
                                const next = new Set(prev);
                                next.delete(file.id);
                                return next;
                              });
                            }}
                            className="p-1 text-muted-foreground hover:text-destructive rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreateTask}
                  disabled={selectedFileIds.size === 0 || isCreatingTask}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingTask ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  {isCreatingTask ? '正在创建模拟任务...' : '创建模拟任务'}
                  {!isCreatingTask && selectedFileIds.size > 0 ? `（已选 ${selectedFileIds.size} 个文件）` : ''}
                </button>
                {createTaskError && (
                  <p className="text-xs text-destructive">创建失败：{createTaskError}</p>
                )}
              </>
            )}

            {task && (
              <div className="rounded-xl border border-border p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">任务: {task.taskId}</p>
                    <p className="mt-1 text-sm text-muted-foreground">当前完成到步骤 {task.currentStep}</p>
                  </div>
                  {isStreaming ? (
                    <button
                      onClick={handleStop}
                      className="shrink-0 rounded border border-destructive px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                    >
                      取消任务
                    </button>
                  ) : (
                    <button
                      onClick={handleClearTask}
                      className="shrink-0 rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      重置任务
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {steps.map(step => {
                    const completed = task.currentStep >= step.key;
                    const available = canRunStep(step.key);
                    const running = runningStep === step.key;
                    const buttonLabel =
                      step.key === 1
                        ? '开始转换'
                        : step.key === 2
                          ? '开始提取'
                          : step.key === 3
                            ? '开始对比'
                            : '开始编制';
                    const disabled =
                      !available ||
                      (step.key === 4 &&
                        (!params.project_name || !params.project_type || !params.project_scale));

                    return (
                      <div
                        key={step.key}
                        className={cn(
                          'rounded-xl border border-border bg-card p-4 transition-colors',
                          running && 'border-primary bg-primary/5'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                              completed
                                ? 'bg-success/10 text-success'
                                : available
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {completed ? <CheckCircle className="h-4 w-4" /> : step.key}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h2 className="text-sm font-semibold text-foreground">
                                  步骤 {step.key}: {step.label}
                                </h2>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {step.desc}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  step.key === 4 ? streamStep(4, params) : streamStep(step.key)
                                }
                                disabled={disabled}
                                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                              >
                                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                {buttonLabel}
                              </button>
                            </div>

                            {step.key === 4 && available && !task.step4Result && (
                              <div className="mt-4 grid grid-cols-1 gap-3">
                                <input
                                  className="w-full rounded border px-3 py-2 text-sm"
                                  placeholder="项目名称 *"
                                  value={params.project_name}
                                  onChange={e =>
                                    setParams(p => ({ ...p, project_name: e.target.value }))
                                  }
                                />
                                <select
                                  className="w-full rounded border px-3 py-2 text-sm"
                                  value={params.project_type}
                                  onChange={e =>
                                    setParams(p => ({ ...p, project_type: e.target.value }))
                                  }
                                >
                                  {projectTypes.map(type => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="w-full rounded border px-3 py-2 text-sm"
                                  placeholder="项目规模 *"
                                  value={params.project_scale}
                                  onChange={e =>
                                    setParams(p => ({ ...p, project_scale: e.target.value }))
                                  }
                                />
                                <input
                                  className="w-full rounded border px-3 py-2 text-sm"
                                  placeholder="投资估算（万元）"
                                  value={params.investment_estimate}
                                  onChange={e =>
                                    setParams(p => ({ ...p, investment_estimate: e.target.value }))
                                  }
                                />
                                <input
                                  className="w-full rounded border px-3 py-2 text-sm"
                                  placeholder="所属区域"
                                  value={params.region}
                                  onChange={e => setParams(p => ({ ...p, region: e.target.value }))}
                                />
                                <textarea
                                  className="min-h-[72px] w-full rounded border px-3 py-2 text-sm"
                                  placeholder="特殊要求"
                                  value={params.special_requirements}
                                  onChange={e =>
                                    setParams(p => ({ ...p, special_requirements: e.target.value }))
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}
          right={(
            <aside className="rounded-2xl border border-border bg-card shadow-sm xl:sticky xl:top-6">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">输出预览</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  任务执行后，模拟编制文本会在这里实时展示
                </p>
              </div>
              {resultContent && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setShowMarkdownPreview(prev => !prev)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-muted',
                      showMarkdownPreview
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Markdown 预览"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Markdown
                  </button>
                  <button
                    onClick={() => copyContent(resultContent)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                  <button
                    onClick={() => downloadContent(resultContent, 'simulate_result.md')}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isStreaming || isPdfExporting}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    title="下载 PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {isPdfExporting ? '生成中' : 'PDF'}
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[calc(100vh-12rem)] min-h-[520px] overflow-auto p-5">
              {isStreaming && runningStep && (
                <div className="mb-5">
                  <TaskProgress
                    phases={simulatePhases}
                    currentPhase={progressState.phase}
                    percentage={progressState.percentage}
                    message={progressMessage}
                    isActive={isStreaming}
                    isDone={false}
                    showStop
                    onStop={handleStop}
                  />
                </div>
              )}

              {resultContent ? (
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="border-b border-border bg-muted/50 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{resultTitle}</span>
                  </div>
                  <div className="p-4">
                    <div
                      className={cn(
                        'markdown-body text-sm leading-relaxed',
                        !showMarkdownPreview && 'whitespace-pre-wrap'
                      )}
                    >
                      {showMarkdownPreview ? (
                        <MarkdownPreview content={resultContent} />
                      ) : (
                        resultContent
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <FileSearch className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">等待生成模拟编制结果</p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    左侧创建任务并按步骤执行后，AI 输出会在右侧保持独立预览。
                  </p>
                </div>
              )}
            </div>
          </aside>
          )}
        />
      </div>
    </WorkbenchLayout>
  );
}
