'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, BookOpen, CheckCircle2, FilePlus2, Loader2, RefreshCw, Send, Trash2, Upload } from 'lucide-react';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TaskProgress } from '@/components/ui/TaskProgress';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
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
import type { KnowledgeBaseDetail, KnowledgeSourceOption, RagCitation, RagExcludedFile, RagIndexJob, RagIndexJobItem, RagQueryResult } from '@/types/knowledge';

const statusLabels: Record<string, string> = {
  not_indexed: '未索引', pending: '等待索引', processing: '索引中', completed: '已完成', failed: '失败', stale: '需重建',
};

export default function KnowledgeDetailPage() {
  const { knowledgeBaseId } = useParams<{ knowledgeBaseId: string }>();
  const requireAuth = useRequireAuth();
  const [detail, setDetail] = useState<KnowledgeBaseDetail | null>(null);
  const [availableFiles, setAvailableFiles] = useState<FileRecord[]>([]);
  const [availableSources, setAvailableSources] = useState<KnowledgeSourceOption[]>([]);
  const [job, setJob] = useState<RagIndexJob | null>(null);
  const [jobItems, setJobItems] = useState<RagIndexJobItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<RagCitation[]>([]);
  const [excluded, setExcluded] = useState<RagExcludedFile[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [isStartingIndex, setIsStartingIndex] = useState(false);
  const [startingForce, setStartingForce] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!requireAuth(`/knowledge/${knowledgeBaseId}`)) return;
    setLoading(true);
    try {
      const [kb, files, sources, activeJob] = await Promise.all([
        getKnowledgeBase(knowledgeBaseId),
        listFiles({ page: 1, page_size: 100 }),
        listAvailableSources(knowledgeBaseId),
        getActiveIndexJob(knowledgeBaseId),
      ]);
      setDetail(kb);
      setAvailableFiles(files.files.filter(file => !kb.files.some(item => item.id === file.id)));
      setAvailableSources(sources);
      if (activeJob?.job) {
        setJob(activeJob.job);
        setJobItems(activeJob.items || []);
        setJobId(activeJob.job.id);
      } else {
        setJobId(null);
      }
      setSelected(current => current.filter(id => kb.files.some(file => file.id === id)));
      setError('');
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, requireAuth]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => abortRef.current?.abort(), []);

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
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, knowledgeBaseId, load]);

  const uploadHook = useFileUpload({
    onSuccess: fileId => { void addKnowledgeFiles(knowledgeBaseId, [fileId]).then(load); },
    onError: setError,
  });

  const queryable = useMemo(() => detail?.files.filter(file => file.index_status === 'completed') || [], [detail]);

  async function addExisting(fileId: string) {
    if (!fileId) return;
    await addKnowledgeFiles(knowledgeBaseId, [fileId]);
    await load();
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        await uploadKnowledgeSource(knowledgeBaseId, file);
        await load();
      } else {
        await uploadHook.upload(file);
      }
    }
    event.target.value = '';
  }

  async function addExistingSource(value: string) {
    const source = availableSources.find(item => `${item.source_type}:${item.source_ref_id}:${item.source_variant}` === value);
    if (!source) return;
    await addKnowledgeSources(knowledgeBaseId, [source]);
    await load();
  }

  async function startIndex(force = false) {
    if (!selected.length || isStartingIndex || jobId) return;
    if (!window.confirm(`将解析 ${selected.length} 个文件并把文本片段发送至 DashScope text-embedding-v4，调用可能产生费用。索引将在后台异步执行，不影响文件预览和其他分析功能。是否继续？`)) return;
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
    await removeKnowledgeFile(knowledgeBaseId, fileId);
    await load();
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || streaming) return;
    setStreaming(true); setAnswer(''); setCitations([]); setExcluded([]); setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const selectedReadyIds = selected.filter(id => queryable.some(file => file.id === id));
      if (selected.length > 0 && selectedReadyIds.length === 0) {
        throw new Error('所选文件尚未完成索引，请选择已完成文件或取消勾选以查询整个知识库。');
      }
      const response = await streamKnowledgeQuery(
        knowledgeBaseId,
        question.trim(),
        selected.length > 0 ? selectedReadyIds : undefined,
        controller.signal,
      );
      await consumeSse(response, eventData => {
        const data = JSON.parse(eventData.data);
        if (eventData.event === 'content') setAnswer(current => current + data.text);
        if (eventData.event === 'citation') setCitations(current => [...current, data as RagCitation]);
        if (eventData.event === 'excluded_files') setExcluded((data.excluded_files || []) as RagExcludedFile[]);
        if (eventData.event === 'done') {
          const result = data as RagQueryResult;
          setAnswer(result.answer); setCitations(result.citations); setExcluded(result.excluded_files);
        }
        if (eventData.event === 'error') setError(data.message || '问答失败');
      });
    } catch (value) {
      if (!controller.signal.aborted) setError(value instanceof Error ? value.message : String(value));
    } finally {
      setStreaming(false); abortRef.current = null;
    }
  }

  if (loading && !detail) return <WorkbenchLayout><div className="flex items-center gap-2 py-12"><Loader2 className="h-4 w-4 animate-spin" />正在加载知识库...</div></WorkbenchLayout>;

  return (
    <WorkbenchLayout>
      <div className="space-y-6 pb-12">
        <PageHeader title={detail?.name || '知识库'} description={detail?.description || '管理文件索引并进行带引用问答。'} />
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        <Card>
          <CardHeader><CardTitle className="text-lg">添加文件</CardTitle><CardDescription>添加文件不会自动建立索引。</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <select className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm" defaultValue="" onChange={event => void addExisting(event.target.value)}>
              <option value="" disabled>选择已有文件</option>
              {availableFiles.map(file => <option key={file.id} value={file.id}>{file.original_name}</option>)}
            </select>
            <select className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm" defaultValue="" onChange={event => void addExistingSource(event.target.value)}>
              <option value="" disabled>引用已有输出</option>
              {availableSources.map(source => <option key={`${source.source_type}:${source.source_ref_id}:${source.source_variant}`} value={`${source.source_type}:${source.source_ref_id}:${source.source_variant}`}>{source.display_name} · {source.provenance_type === 'derived_ai' ? 'AI成果' : source.provenance_type === 'derived_structured' ? '统计结果' : '提取结果'}</option>)}
            </select>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium">
              {uploadHook.isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}上传 PDF/ZIP
              <input hidden type="file" accept=".pdf,.zip" onChange={upload} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">文件与索引</CardTitle><CardDescription>勾选文件后手动开始索引；已完成文件可直接参与问答。</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {job && (
              <div className="space-y-2">
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
                {jobItems.map(item => (
                  <div key={item.id} className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                    <div className="flex justify-between gap-2"><span className="truncate">{item.display_name}</span><span>{Math.round(Number(item.progress_percent || 0))}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, Number(item.progress_percent || 0))}%` }} /></div>
                    <p className="mt-1 text-muted-foreground">{item.progress_message || item.current_stage}{item.error_message ? ` · ${item.error_message}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
            {!detail?.files.length ? <div className="flex items-center gap-2 py-6 text-muted-foreground"><FilePlus2 className="h-5 w-5" />尚未添加文件</div> : detail.files.map(file => (
              <div key={file.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <input type="checkbox" checked={selected.includes(file.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, file.id])] : current.filter(id => id !== file.id))} />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{file.original_name}</p><p className="text-xs text-muted-foreground">{statusLabels[file.index_status]} · {file.chunk_count || 0} 个片段</p>{file.error_message && <p className="text-xs text-destructive">{file.error_message}</p>}</div>
                {file.index_status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : file.index_status === 'failed' ? <AlertTriangle className="h-5 w-5 text-destructive" /> : null}
                <Button variant="ghost" size="icon" onClick={() => void removeFile(file.id)} aria-label="从知识库移除"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button disabled={!selected.length || !!jobId || isStartingIndex} onClick={() => void startIndex(false)}>
                {(jobId || (isStartingIndex && !startingForce)) ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {isStartingIndex && !startingForce ? '正在创建任务' : '开始索引'}
              </Button>
              <Button variant="outline" disabled={!selected.length || !!jobId || isStartingIndex} onClick={() => void startIndex(true)}>
                {isStartingIndex && startingForce ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isStartingIndex && startingForce ? '正在创建任务' : '重建索引'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">问知识库</CardTitle><CardDescription>默认查询全部已完成索引；勾选文件后可限制范围。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={ask} className="flex gap-2"><Input value={question} onChange={event => setQuestion(event.target.value)} placeholder="例如：投标保证金和废标条款分别是什么？" /><Button type="submit" disabled={!question.trim() || !queryable.length || streaming}>{streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}提问</Button></form>
            {streaming && <Button variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>停止生成</Button>}
            {excluded.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">以下文件未参与检索：{excluded.map(item => `${item.file_name}（${statusLabels[item.reason] || item.reason}）`).join('、')}</div>}
            {answer && <div className="rounded-lg border bg-muted/30 p-4 whitespace-pre-wrap leading-7">{answer}</div>}
            {citations.length > 0 && <div className="space-y-2"><h3 className="font-semibold">引用来源</h3>{citations.map(item => <div key={item.chunk_id} className="rounded-lg border p-3 text-sm"><p className="font-medium">[{item.citation_id}] {item.file_name}</p><p className="text-xs text-muted-foreground">页码 {item.page_start ?? '未标注'}{item.page_end && item.page_end !== item.page_start ? `-${item.page_end}` : ''} · {item.section_path || '未标注章节'}</p><p className="mt-2 text-muted-foreground">{item.content_preview}</p></div>)}</div>}
          </CardContent>
        </Card>
      </div>
    </WorkbenchLayout>
  );
}
