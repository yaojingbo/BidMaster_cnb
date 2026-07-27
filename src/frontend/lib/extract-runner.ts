'use client';

import { authFetchSSE } from '@/lib/auth-fetch';
import { useTaskStore, type ExtractedElement, type ExtractTaskState } from '@/stores/task-store';

interface ExtractRunOptions {
  endpoint: string;
  body: Record<string, unknown>;
  activeTab: string;
  selectedFileId: string | null;
  initialMessage: string;
}

type Listener = (state: ExtractTaskState | null) => void;

let state: ExtractTaskState | null = null;
let controller: AbortController | null = null;
let runningPromise: Promise<void> | null = null;
let progressTimer: ReturnType<typeof setInterval> | null = null;
let activeRunId = 0;
const listeners = new Set<Listener>();

const notify = () => {
  for (const listener of listeners) listener(state);
};

const persist = () => {
  if (state) useTaskStore.getState().updateExtract(state);
  else useTaskStore.getState().clearExtract();
  notify();
};

const patchState = (patch: Partial<ExtractTaskState>) => {
  if (!state) return;
  state = { ...state, ...patch, updatedAt: Date.now() };
  persist();
};

const stopProgressTimer = () => {
  if (!progressTimer) return;
  clearInterval(progressTimer);
  progressTimer = null;
};

const derivePhaseFromPercentage = (percentage: number | null | undefined) => {
  const value = percentage ?? 3;
  if (value >= 90) return 'extracting';
  if (value >= 7) return 'analyzing';
  if (value >= 4) return 'parsing';
  return 'reading';
};

const startProgressTimer = () => {
  stopProgressTimer();
  progressTimer = setInterval(() => {
    if (!state?.isStreaming || state.isDone || state.errorMessage) {
      stopProgressTimer();
      return;
    }

    const nextPercentage = Math.min(Math.max(state.percentage ?? 3, 3) + 1, 88);
    const nextPhase = derivePhaseFromPercentage(nextPercentage);
    const patch: Partial<ExtractTaskState> = {
      percentage: nextPercentage,
      currentPhase: nextPhase,
    };

    if (state.progressMessage.startsWith('正在连接服务')) {
      if (nextPhase === 'parsing') patch.progressMessage = '正在解析文档内容...';
      else if (nextPhase === 'analyzing') patch.progressMessage = 'AI 正在分析，请稍候...';
    }

    patchState(patch);
  }, 2000);
};

export function getExtractTaskState() {
  const saved = state || useTaskStore.getState().extract;
  if (saved?.isStreaming) {
    clearExtractTask();
    return null;
  }
  return saved;
}

export function subscribeExtractTask(listener: Listener) {
  listeners.add(listener);
  listener(getExtractTaskState());
  return () => {
    listeners.delete(listener);
  };
}

export function clearExtractTask() {
  activeRunId += 1;
  if (controller) controller.abort();
  stopProgressTimer();
  controller = null;
  runningPromise = null;
  state = null;
  persist();
}

export function stopExtractTask() {
  controller?.abort();
  stopProgressTimer();
  controller = null;
  patchState({ isStreaming: false, progressMessage: '已手动停止' });
}

function processEvent(event: Record<string, unknown>) {
  if (!state) return;

  const patch: Partial<ExtractTaskState> = {};
  if (event.phase) patch.currentPhase = event.phase as string;
  if (event.percentage != null) {
    const nextPercentage = event.percentage as number;
    patch.percentage = nextPercentage;
    if (!event.phase) patch.currentPhase = derivePhaseFromPercentage(nextPercentage);
  }

  if (event.type === 'progress') {
    const message = (event.message as string) || '';
    if (!event.phase) {
      if (message.includes('读取')) {
        patch.currentPhase = 'reading';
        patch.percentage = state.percentage ?? 5;
      } else if (message.includes('分析')) {
        patch.currentPhase = 'analyzing';
        patch.percentage = state.percentage ?? 30;
      } else {
        patch.currentPhase = 'parsing';
        patch.percentage = state.percentage ?? 20;
      }
    }
    patch.progressMessage = message;
  } else if (event.type === 'llm_progress') {
    if (!event.phase) patch.currentPhase = 'analyzing';
    if (event.percentage == null) patch.percentage = state.percentage ?? 32;
    patch.progressMessage = (event.message as string) || 'AI 正在分析...';
  } else if (event.type === 'ocr_progress') {
    if (!event.phase) patch.currentPhase = 'parsing';
    if (event.percentage == null) patch.percentage = state.percentage ?? 12;
    patch.progressMessage = (event.message as string) || 'OCR 正在识别...';
  } else if (event.type === 'element') {
    if (!event.phase) patch.currentPhase = 'extracting';
    if (event.percentage == null) patch.percentage = 90;
    const elem = (event.data || event) as Record<string, unknown>;
    const element: ExtractedElement = {
      name: (elem.name as string) || '未知要素',
      content: (elem.content as string) || '',
    };
    patch.extractedElements = [...state.extractedElements, element];
    patch.streamRawText = `${state.streamRawText}## ${element.name}\n${element.content}\n\n`;
  } else if (event.type === 'done') {
    stopProgressTimer();
    if (!event.phase) patch.currentPhase = 'extracting';
    patch.isDone = true;
    patch.isStreaming = false;
    patch.percentage = 100;
    patch.progressMessage = ((event.data as Record<string, unknown>)?.summary as string) || '提取完成';
  } else if (event.type === 'error') {
    stopProgressTimer();
    patch.isStreaming = false;
    patch.errorMessage = ((event.data as Record<string, unknown>)?.message as string) || '提取失败';
  }

  patchState(patch);
}

async function readSSEStream(response: Response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'done') receivedDone = true;
          processEvent(event);
        } catch {
          // 跳过无法解析的流片段
        }
      }
    }

    buffer += decoder.decode();
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'done') receivedDone = true;
        processEvent(event);
      } catch {
        // 跳过无法解析的流片段
      }
    }
  } catch {
    if (!receivedDone) {
      stopProgressTimer();
      patchState({
        isStreaming: false,
        progressMessage: '连接中断，AI 可能在后台继续处理，请稍后刷新查看结果',
      });
    }
    return;
  }

  if (!receivedDone) {
    stopProgressTimer();
    patchState({
      isStreaming: false,
      progressMessage: '分析可能尚未完成，请稍后刷新查看结果',
    });
  }
}

export function runExtractTask(options: ExtractRunOptions) {
  if (runningPromise) return runningPromise;

  const runId = activeRunId + 1;
  activeRunId = runId;
  controller = new AbortController();
  state = {
    isStreaming: true,
    currentPhase: 'reading',
    progressMessage: options.initialMessage,
    extractedElements: [],
    streamRawText: '',
    isDone: false,
    errorMessage: null,
    selectedFileId: options.selectedFileId,
    activeTab: options.activeTab,
    percentage: 3,
    updatedAt: Date.now(),
  };
  persist();
  startProgressTimer();

  runningPromise = (async () => {
    try {
      const response = await authFetchSSE(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
        signal: controller?.signal,
      });

      if (!response.ok) {
        stopProgressTimer();
        patchState({ errorMessage: `请求失败: HTTP ${response.status}`, isStreaming: false });
        return;
      }

      await readSSEStream(response);
      stopProgressTimer();
      patchState({ isStreaming: false });
    } catch (err) {
      if (runId !== activeRunId) return;
      stopProgressTimer();
      if (err instanceof DOMException && err.name === 'AbortError') {
        patchState({ isStreaming: false, progressMessage: '已手动停止' });
      } else {
        patchState({
          isStreaming: false,
          errorMessage: err instanceof Error ? err.message : '未知错误',
        });
      }
    } finally {
      if (runId === activeRunId) {
        controller = null;
        runningPromise = null;
      }
    }
  })();

  return runningPromise;
}
