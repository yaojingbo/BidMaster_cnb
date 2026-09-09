'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  StopCircle,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskProgress } from '@/components/ui/TaskProgress';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useSettingsStore } from '@/stores/settings-store';
import { useAuthStore } from '@/stores/auth-store';
import { listFiles } from '@/lib/data-api';
import {
  addKnowledgeFiles,
  addKnowledgeSources,
  createIndexJob,
  getActiveIndexJob,
  getIndexJob,
  getKnowledgeBase,
  listAvailableSources,
  removeKnowledgeFile,
  streamKnowledgeQuery,
  uploadKnowledgeSource,
} from '@/lib/knowledge-api';
import { consumeSse } from '@/lib/sse-parser';
import type { FileRecord } from '@/lib/data-api';
import type {
  KnowledgeBaseDetail,
  KnowledgeSourceOption,
  RagCitation,
  RagExcludedFile,
  RagIndexJob,
  RagIndexJobItem,
  RagQueryResult,
} from '@/types/knowledge';

const statusLabels: Record<string, string> = {
  not_indexed: '未索引',
  pending: '等待索引',
  processing: '索引中',
  completed: '可问答',
  failed: '索引失败',
  stale: '需重建',
};

const exampleQuestions = [
  '这批文件中的投标保证金要求是什么？',
  '整理主要废标条款，并标注引用来源。',
  '项目评分办法中，商务分和技术分如何分配？',
];

function formatFileSize(size: number) {
  if (!size) return '—';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function statusClass(status: string) {
  if (status === 'completed') return 'bg-primary/10 text-primary';
  if (status === 'failed') return 'bg-destructive/10 text-destructive';
  return 'bg-muted text-muted-foreground';
}

// 多轮问答消息：每条消息保留提问、回答、引用与反馈，避免新提问抹掉上一轮答案
interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  citations: RagCitation[];
  excluded: RagExcludedFile[];
  feedback: 'up' | 'down' | null;
}

// 下载单条问答为 Markdown（问题 + 回答 + 引用来源）
function downloadAnswer(message: ChatMessage) {
  const lines: string[] = [`问题：${message.question}`, '', '回答：', message.answer];
  if (message.citations.length > 0) {
    lines.push('', '引用来源：');
    message.citations.forEach(citation => {
      lines.push(`[${citation.citation_id}] ${citation.file_name}（页码 ${citation.page_start ?? '未标注'}）`);
      if (citation.content_preview) lines.push(`    ${citation.content_preview}`);
    });
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `问答-${message.question.slice(0, 30).replace(/[\\/:*?"<>|]/g, '_')}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function KnowledgeDetailPage() {
  const { knowledgeBaseId } = useParams<{ knowledgeBaseId: string }>();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const user = useAuthStore(state => state.user);
  const [detail, setDetail] = useState<KnowledgeBaseDetail | null>(null);
  const [availableFiles, setAvailableFiles] = useState<FileRecord[]>([]);
  const [availableSources, setAvailableSources] = useState<KnowledgeSourceOption[]>([]);
  const [job, setJob] = useState<RagIndexJob | null>(null);
  const [jobItems, setJobItems] = useState<RagIndexJobItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [isStartingIndex, setIsStartingIndex] = useState(false);
  const [startingForce, setStartingForce] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'files' | 'chat'>('files');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextMessageId = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeProvider = useSettingsStore(state => state.activeProvider);

  const load = useCallback(async () => {
    if (!requireAuth(`/knowledge/${knowledgeBaseId}`)) return;
    setLoading(true);
    try {
      const [knowledgeBase, files, sources, activeJob] = await Promise.all([
        getKnowledgeBase(knowledgeBaseId),
        listFiles({ page: 1, page_size: 100 }),
        listAvailableSources(knowledgeBaseId),
        getActiveIndexJob(knowledgeBaseId),
      ]);
      setDetail(knowledgeBase);
      setAvailableFiles(files.files.filter(file => !knowledgeBase.files.some(item => item.id === file.id)));
      setAvailableSources(sources);
      if (activeJob?.job) {
        setJob(activeJob.job);
        setJobItems(activeJob.items || []);
        setJobId(activeJob.job.id);
      } else {
        setJobId(null);
      }
      setSelected(current => current.filter(id => knowledgeBase.files.some(file => file.id === id)));
      setError('');
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, requireAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // 新消息产生或回答流式更新时，自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const poll = async () => {
      try {
        const data = await getIndexJob(knowledgeBaseId, jobId);
        if (!active) return;
        setDetail(current => current ? { ...current, files: data.files } : current);
        setJob(data.job);
        setJobItems(data.items);
        setError('');
        if (['completed', 'partial_failed', 'failed', 'cancelled'].includes(data.job.status)) {
          setJobId(null);
          await load();
        }
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : String(value));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, knowledgeBaseId, load]);

  const uploadHook = useFileUpload({
    onSuccess: fileId => {
      void addKnowledgeFiles(knowledgeBaseId, [fileId]).then(load);
    },
    onError: setError,
  });

  const queryable = useMemo(
    () => detail?.files.filter(file => file.index_status === 'completed') || [],
    [detail],
  );
  const allSelected = Boolean(detail?.files.length) && selected.length === detail?.files.length;
  const selectedReadyCount = selected.filter(id => queryable.some(file => file.id === id)).length;

  function requireMember() {
    if (user?.role !== 'guest') return true;
    router.push(`/login?callbackUrl=${encodeURIComponent(`/knowledge/${knowledgeBaseId}`)}`);
    return false;
  }

  function openAddDialog() {
    if (requireMember()) setAddOpen(true);
  }

  async function addExisting() {
    if (!selectedExisting || !requireMember()) return;
    try {
      await addKnowledgeFiles(knowledgeBaseId, [selectedExisting]);
      setSelectedExisting('');
      setAddOpen(false);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  async function addExistingSource() {
    if (!selectedSource || !requireMember()) return;
    const source = availableSources.find(
      item => `${item.source_type}:${item.source_ref_id}:${item.source_variant}` === selectedSource,
    );
    if (!source) return;
    try {
      await addKnowledgeSources(knowledgeBaseId, [source]);
      setSelectedSource('');
      setAddOpen(false);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !requireMember()) return;
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        await uploadKnowledgeSource(knowledgeBaseId, file);
        await load();
      } else {
        await uploadHook.upload(file);
      }
      setAddOpen(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      event.target.value = '';
    }
  }

  async function startIndex(force = false) {
    if (!selected.length || isStartingIndex || jobId || !requireMember()) return;
    if (!window.confirm(`将解析 ${selected.length} 个文件并发送文本片段至 Embedding 服务，调用可能产生费用。是否继续？`)) return;
    setIsStartingIndex(true);
    setStartingForce(force);
    setError('');
    try {
      const result = await createIndexJob(knowledgeBaseId, selected, force);
      setJob({
        id: result.job_id,
        requested_file_ids: [...selected],
        status: result.status,
        current_stage: 'validating',
        progress_percent: 0,
        progress_message: '索引任务已创建，正在校验文件',
        total_item_count: selected.length,
        completed_file_count: 0,
        failed_file_count: 0,
        skipped_item_count: 0,
      });
      setJobItems([]);
      setJobId(result.job_id);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setIsStartingIndex(false);
    }
  }

  async function removeFile(fileId: string) {
    if (!requireMember()) return;
    if (!window.confirm('确认从知识库移除这份资料？原始文件不会被删除。')) return;
    try {
      await removeKnowledgeFile(knowledgeBaseId, fileId);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || streaming || !requireMember()) return;
    const prompt = question.trim();
    const messageId = `msg-${nextMessageId.current++}`;
    setQuestion('');
    setStreaming(true);
    setError('');
    // 追加一条新消息（不抹掉历史），回答内容随 SSE 流式更新
    setMessages(current => [
      ...current,
      { id: messageId, question: prompt, answer: '', citations: [], excluded: [], feedback: null },
    ]);
    const patchMessage = (patch: Partial<ChatMessage>) =>
      setMessages(current => current.map(item => (item.id === messageId ? { ...item, ...patch } : item)));
    const appendAnswer = (text: string) =>
      setMessages(current =>
        current.map(item => (item.id === messageId ? { ...item, answer: item.answer + text } : item)),
      );
    const appendCitation = (citation: RagCitation) =>
      setMessages(current =>
        current.map(item => (item.id === messageId ? { ...item, citations: [...item.citations, citation] } : item)),
      );
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const readyIds = selected.filter(id => queryable.some(file => file.id === id));
      if (selected.length > 0 && readyIds.length === 0) {
        throw new Error('所选文件尚未完成索引，请选择可问答文件或取消选择以查询整个知识库。');
      }
      const response = await streamKnowledgeQuery(
        knowledgeBaseId,
        prompt,
        selected.length > 0 ? readyIds : undefined,
        controller.signal,
        activeProvider,
      );
      await consumeSse(response, eventData => {
        const data = JSON.parse(eventData.data);
        if (eventData.event === 'content') appendAnswer(data.text ?? '');
        if (eventData.event === 'citation') appendCitation(data as RagCitation);
        if (eventData.event === 'excluded_files') {
          patchMessage({ excluded: (data.excluded_files || []) as RagExcludedFile[] });
        }
        if (eventData.event === 'done') {
          const result = data as RagQueryResult;
          patchMessage({ answer: result.answer, citations: result.citations, excluded: result.excluded_files });
        }
        if (eventData.event === 'error') setError(data.message || '问答失败');
      });
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof Error ? value.message : String(value));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  // 点赞/点踩反馈：再次点击同一项取消反馈
  function setFeedback(messageId: string, feedback: 'up' | 'down') {
    setMessages(current =>
      current.map(item =>
        item.id === messageId ? { ...item, feedback: item.feedback === feedback ? null : feedback } : item,
      ),
    );
  }

  // 清空对话：中止进行中的流式回答并清空消息列表
  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
  }

  if (loading && !detail) {
    return (
      <WorkbenchLayout>
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />正在加载知识库…
        </div>
      </WorkbenchLayout>
    );
  }

  return (
    <WorkbenchLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex flex-col gap-4">
          <Link href="/knowledge" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />返回知识库
          </Link>
          <PageHeader
            title={detail?.name || '知识库'}
            description={detail?.description || '管理资料索引，并进行带引用的知识问答。'}
            actions={
              <Button onClick={openAddDialog}>
                <FilePlus2 data-icon="inline-start" />添加资料
              </Button>
            }
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span><strong className="font-semibold text-foreground">{detail?.files.length || 0}</strong> 份资料</span>
            <span><strong className="font-semibold text-foreground">{queryable.length}</strong> 份可问答</span>
            {(detail?.processing_count || 0) > 0 && <span className="text-primary">正在建立索引</span>}
            {(detail?.failed_count || 0) > 0 && <span className="text-destructive">{detail?.failed_count} 份索引失败</span>}
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="关闭错误提示"><X className="size-4" /></button>
          </div>
        )}

        <div role="tablist" aria-label="知识库工作区" className="flex overflow-x-auto border-b">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'files'}
            onClick={() => setActiveTab('files')}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <FileText className="size-4" />资料与索引
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{detail?.files.length || 0}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <MessageSquareText className="size-4" />知识问答
          </button>
        </div>

        {activeTab === 'files' ? (
          <section aria-label="资料与索引" className="flex flex-col gap-4">
            {job && (
              <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">索引任务</h2>
                    <p className="mt-1 text-sm text-muted-foreground">任务在后台执行，可以继续浏览其他页面。</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">{Math.round(Number(job.progress_percent || 0))}%</span>
                </div>
                <TaskProgress
                  phases={[
                    { key: 'validating', label: '校验' },
                    { key: 'loading', label: '读取' },
                    { key: 'extracting', label: '解析' },
                    { key: 'chunking', label: '分块' },
                    { key: 'embedding', label: '向量化' },
                    { key: 'persisting', label: '写入' },
                    { key: 'completed', label: '完成' },
                  ]}
                  currentPhase={job.current_stage || null}
                  percentage={Number(job.progress_percent || 0)}
                  message={job.progress_message || `已完成 ${job.completed_file_count}/${job.total_item_count || job.requested_file_ids.length}`}
                  isActive={['pending', 'processing'].includes(job.status)}
                  isDone={job.status === 'completed'}
                  errorMessage={['failed', 'partial_failed'].includes(job.status) ? (job.error_message || '部分文件索引失败') : null}
                />
                {jobItems.length > 0 && (
                  <div className="divide-y rounded-lg bg-muted/40 px-3">
                    {jobItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.display_name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.error_message || item.progress_message || item.current_stage}</p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{Math.round(Number(item.progress_percent || 0))}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="font-semibold">资料</h2>
                  <p className="mt-1 text-sm text-muted-foreground">选择资料后可批量建立或重建索引。</p>
                </div>
                <Button variant="outline" size="sm" onClick={openAddDialog}>
                  <FilePlus2 data-icon="inline-start" />添加资料
                </Button>
              </div>

              {detail?.files.length ? (
                <>
                  <div className="flex flex-col gap-3 border-b bg-muted/20 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">已选择 {selected.length} / {detail.files.length}</span>
                      <span className="hidden text-muted-foreground sm:inline">选择文件后即可批量创建索引</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={allSelected}
                        onClick={() => setSelected(detail.files.map(file => file.id))}
                      >
                        全选 {detail.files.length} 项
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={selected.length === 0}
                        onClick={() => setSelected([])}
                      >
                        全不选
                      </Button>
                      <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!selected.length || Boolean(jobId) || isStartingIndex}
                        onClick={() => void startIndex(true)}
                      >
                        {isStartingIndex && startingForce ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                        重建索引
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selected.length || Boolean(jobId) || isStartingIndex}
                        onClick={() => void startIndex(false)}
                      >
                        {(jobId || (isStartingIndex && !startingForce)) ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <BookOpen data-icon="inline-start" />}
                        创建索引
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    <div className="sticky top-0 hidden grid-cols-[2rem_minmax(0,1fr)_8rem_6rem_3rem] items-center gap-3 border-b bg-card px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : detail.files.map(file => file.id))}
                        aria-label={allSelected ? '取消选择全部资料' : '选择全部资料'}
                        className="size-4 accent-primary"
                      />
                      <span>文件名</span><span>索引状态</span><span>片段</span><span className="sr-only">操作</span>
                    </div>
                    <div className="divide-y">
                      {detail.files.map(file => (
                        <div key={file.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.25rem] items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5 md:grid-cols-[2rem_minmax(0,1fr)_8rem_6rem_3rem] md:items-center">
                          <input
                            type="checkbox"
                            checked={selected.includes(file.id)}
                            onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, file.id])] : current.filter(id => id !== file.id))}
                            aria-label={`选择 ${file.original_name}`}
                            className="mt-1 size-4 accent-primary md:mt-0"
                          />
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <FileText className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{file.original_name}</p>
                              <p className="mt-1 text-xs text-muted-foreground md:hidden">{formatFileSize(file.size)} · {file.chunk_count || 0} 个片段</p>
                              {file.error_message && <p className="mt-1 line-clamp-2 text-xs text-destructive">{file.error_message}</p>}
                            </div>
                          </div>
                          <div className="hidden md:block">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(file.index_status)}`}>{statusLabels[file.index_status]}</span>
                          </div>
                          <span className="hidden text-sm text-muted-foreground md:block">{file.chunk_count || 0}</span>
                          <Button variant="ghost" size="icon" onClick={() => void removeFile(file.id)} aria-label={`移除 ${file.original_name}`}>
                            <Trash2 />
                          </Button>
                          <div className="col-start-2 flex items-center gap-2 md:hidden">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(file.index_status)}`}>{statusLabels[file.index_status]}</span>
                            {file.index_status === 'completed' && <CheckCircle2 className="size-4 text-primary" />}
                            {file.index_status === 'failed' && <AlertTriangle className="size-4 text-destructive" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FilePlus2 className="size-5" /></div>
                  <div>
                    <p className="font-semibold">还没有资料</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">添加已有文件、分析成果，或上传 PDF/ZIP。</p>
                  </div>
                  <Button onClick={openAddDialog}><FilePlus2 data-icon="inline-start" />添加第一份资料</Button>
                </div>
              )}

            </div>
          </section>
        ) : (
          <section aria-label="知识问答" className="mx-auto flex min-h-[560px] w-full max-w-5xl flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="font-semibold">知识问答</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.length > 0 ? `检索已选资料中的 ${selectedReadyCount} 份可问答文件` : `检索全部 ${queryable.length} 份已索引资料`}
                </p>
              </div>
              {selected.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected([])}>恢复全部资料</Button>}
            </div>

            <div className="flex flex-1 flex-col py-6">
              {messages.length === 0 ? (
                <div className="m-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="size-6" /></div>
                  <div>
                    <h3 className="text-lg font-semibold">从资料中找到有依据的答案</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">每个回答都会标注文件、页码和原文片段，便于核对。</p>
                  </div>
                  <div className="grid w-full gap-2 text-left sm:grid-cols-3">
                    {exampleQuestions.map(example => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setQuestion(example)}
                        className="rounded-lg border px-4 py-3 text-sm leading-6 text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {messages.map(message => {
                    const isStreamingThis = message.id === messages[messages.length - 1].id && streaming;
                    const answerDone = Boolean(message.answer) && !isStreamingThis;
                    return (
                      <article key={message.id} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="flex min-w-0 flex-col gap-3">
                          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">
                            {message.question}
                          </div>
                          {(message.answer || isStreamingThis) && (
                            <div className="flex items-start gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-4" /></div>
                              <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-7 text-foreground">
                                {message.answer || <span className="text-muted-foreground">正在检索并组织答案…</span>}
                              </div>
                            </div>
                          )}
                          {message.excluded.length > 0 && (
                            <div className="rounded-lg bg-muted px-4 py-3 text-sm leading-6 text-muted-foreground">
                              未参与检索：{message.excluded.map(item => `${item.file_name}（${statusLabels[item.reason] || item.reason}）`).join('、')}
                            </div>
                          )}
                          {answerDone && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => downloadAnswer(message)}>
                                <Download data-icon="inline-start" />下载回答
                              </Button>
                              <Button
                                type="button"
                                variant={message.feedback === 'up' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => setFeedback(message.id, 'up')}
                                aria-label="回答有帮助"
                                aria-pressed={message.feedback === 'up'}
                              >
                                <ThumbsUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant={message.feedback === 'down' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => setFeedback(message.id, 'down')}
                                aria-label="回答无帮助"
                                aria-pressed={message.feedback === 'down'}
                              >
                                <ThumbsDown className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {message.citations.length > 0 && (
                          <aside className="flex flex-col gap-2 lg:border-l lg:pl-5" aria-label="引用来源">
                            <h3 className="mb-1 text-sm font-semibold">引用来源</h3>
                            {message.citations.map(item => (
                              <article key={item.chunk_id} className="rounded-lg bg-muted/50 p-3 text-sm">
                                <p className="font-medium text-foreground"><span className="mr-1 text-primary">[{item.citation_id}]</span>{item.file_name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  页码 {item.page_start ?? '未标注'}{item.page_end && item.page_end !== item.page_start ? `–${item.page_end}` : ''} · {item.section_path || '未标注章节'}
                                </p>
                                <p className="mt-2 line-clamp-4 text-xs leading-5 text-muted-foreground">{item.content_preview}</p>
                              </article>
                            ))}
                          </aside>
                        )}
                      </article>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={ask} className="sticky bottom-4 rounded-xl border bg-background p-2 shadow-lg">
              <textarea
                value={question}
                onChange={event => setQuestion(event.target.value)}
                onKeyDown={event => {
                  // 回车发送；Shift+回车换行；中文输入法组合态回车不发送
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={queryable.length ? '输入问题，答案将附带资料来源…' : '请先在“资料与索引”中建立索引'}
                rows={2}
                maxLength={2000}
                disabled={!queryable.length}
                className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                aria-label="向知识库提问"
              />
              <div className="flex items-center justify-between gap-3 border-t px-2 pt-2">
                <span className="truncate text-xs text-muted-foreground">{selected.length ? `已选 ${selected.length} 份资料` : '全部已索引资料'}</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={clearChat} disabled={messages.length === 0}>
                    <Trash2 data-icon="inline-start" />清屏
                  </Button>
                  {streaming ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
                      <StopCircle data-icon="inline-start" />停止生成
                    </Button>
                  ) : (
                    <Button type="submit" size="sm" disabled={!question.trim() || !queryable.length}>
                      <Send data-icon="inline-start" />提问
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </section>
        )}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>添加资料</DialogTitle>
              <DialogDescription>添加资料后不会自动建立索引，你可以回到列表中选择并开始索引。</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="existing-file" className="text-sm font-medium">从文件管理选择</label>
                <div className="flex gap-2">
                  <select
                    id="existing-file"
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedExisting}
                    onChange={event => setSelectedExisting(event.target.value)}
                  >
                    <option value="">选择已有文件</option>
                    {availableFiles.map(file => <option key={file.id} value={file.id}>{file.original_name}</option>)}
                  </select>
                  <Button type="button" variant="outline" className="shrink-0" disabled={!selectedExisting} onClick={() => void addExisting()}>添加</Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="existing-source" className="text-sm font-medium">引用已有成果</label>
                <div className="flex gap-2">
                  <select
                    id="existing-source"
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedSource}
                    onChange={event => setSelectedSource(event.target.value)}
                  >
                    <option value="">选择提取、模拟或开标分析成果</option>
                    {availableSources.map(source => (
                      <option
                        key={`${source.source_type}:${source.source_ref_id}:${source.source_variant}`}
                        value={`${source.source_type}:${source.source_ref_id}:${source.source_variant}`}
                      >
                        {source.display_name} · {source.provenance_type === 'derived_ai' ? 'AI 成果' : source.provenance_type === 'derived_structured' ? '统计结果' : '提取结果'}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" className="shrink-0" disabled={!selectedSource} onClick={() => void addExistingSource()}>引用</Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">上传新文件</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadHook.isUploading}
                  className="flex min-h-16 items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadHook.isUploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
                  {uploadHook.isUploading ? '正在上传…' : '选择 PDF 或 ZIP 文件'}
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf,.zip" onChange={upload} className="file-sr-only" />
              </div>
            </div>
            <DialogFooter className="sm:justify-center"><DialogClose asChild><Button type="button" variant="outline">完成</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </WorkbenchLayout>
  );
}
