'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Loader2, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { listFiles, type FileRecord } from '@/lib/data-api';
import {
  addKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  searchKnowledge,
  type KnowledgeDocument,
  type KnowledgeHit,
} from '@/lib/knowledge-api';
import { cn } from '@/lib/utils';

const statusText = { pending: '等待处理', processing: '索引中', ready: '已就绪', failed: '失败' };

export default function KnowledgePage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [documentItems, fileItems] = await Promise.all([
        listKnowledgeDocuments(),
        listFiles({ page: 1, page_size: 100 }),
      ]);
      setDocuments(documentItems);
      setFiles(fileItems.files);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载知识库失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady && isAuthenticated) loadData();
  }, [authReady, isAuthenticated, loadData]);

  const availableFiles = useMemo(() => {
    const indexed = new Set(documents.map(item => item.file_id));
    return files.filter(file => !indexed.has(file.id));
  }, [documents, files]);

  async function handleAdd() {
    if (!selectedFile || !requireAuth()) return;
    setWorkingId(selectedFile);
    setMessage('首次索引会下载本地中文嵌入模型，请稍候。');
    try {
      await addKnowledgeDocument(selectedFile);
      setSelectedFile('');
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '文档入库失败');
    } finally {
      setWorkingId(null);
    }
  }

  async function handleReindex(document: KnowledgeDocument) {
    if (!requireAuth()) return;
    setWorkingId(document.id);
    try {
      await reindexKnowledgeDocument(document.id);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重建索引失败');
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDelete(document: KnowledgeDocument) {
    if (!requireAuth() || !window.confirm(`确认移除“${document.name}”的知识索引？原文件不会被删除。`)) return;
    setWorkingId(document.id);
    try {
      await deleteKnowledgeDocument(document.id);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '移除失败');
    } finally {
      setWorkingId(null);
    }
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value || !requireAuth()) return;
    setSearching(true);
    setMessage(null);
    try {
      setResults(await searchKnowledge(value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '检索失败');
    } finally {
      setSearching(false);
    }
  }

  return (
    <WorkbenchLayout>
      <div className="flex flex-col gap-6 pb-12">
        <PageHeader title="知识库" description="将投标资料转换为可检索的向量知识，快速定位依据与原文片段。" />

        {message && <div className="rounded-lg border bg-muted px-4 py-3 text-sm text-foreground">{message}</div>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" />知识文档</CardTitle>
              <CardDescription>选择已上传文件，使用本地 BGE 模型生成 512 维向量并存入 Neon pgvector。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row">
                <label className="sr-only" htmlFor="knowledge-file">选择文件</label>
                <select
                  id="knowledge-file"
                  value={selectedFile}
                  onChange={event => setSelectedFile(event.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">选择一个尚未入库的文件</option>
                  {availableFiles.map(file => <option key={file.id} value={file.id}>{file.original_name}</option>)}
                </select>
                <Button onClick={handleAdd} disabled={!selectedFile || Boolean(workingId)}>
                  {workingId === selectedFile ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                  开始索引
                </Button>
              </div>

              {loading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />加载中</div>
              ) : documents.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
                  <FileText className="size-8 text-muted-foreground" />
                  <div><p className="font-medium">知识库还是空的</p><p className="text-sm text-muted-foreground">先在文件管理上传资料，再从上方选择入库。</p></div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {documents.map(document => (
                    <article key={document.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium">{document.name}</h3>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs', document.status === 'ready' ? 'bg-success/10 text-success' : document.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>{statusText[document.status]}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{document.chunk_count} 个片段 · {document.embedding_model}</p>
                        {document.error_message && <p className="mt-2 text-sm text-destructive">{document.error_message}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleReindex(document)} disabled={Boolean(workingId)}><RefreshCw data-icon="inline-start" />重建</Button>
                        <Button variant="ghost" size="icon" aria-label={`移除 ${document.name}`} onClick={() => handleDelete(document)} disabled={Boolean(workingId)}><Trash2 /></Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="size-5 text-primary" />语义检索</CardTitle>
              <CardDescription>不依赖精确关键词，按语义相似度查找知识片段。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：项目经理资格要求是什么？" aria-label="知识库检索问题" />
                <Button type="submit" disabled={!query.trim() || searching}>{searching ? <Loader2 className="animate-spin" /> : <Search />}<span className="sr-only">搜索</span></Button>
              </form>
              <div className="flex flex-col gap-3">
                {results.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">输入问题后，匹配片段会显示在这里。</p> : results.map(hit => (
                  <article key={hit.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{hit.name}</p>
                      <span className="shrink-0 text-xs font-medium text-primary">{Math.round(hit.score * 100)}% 匹配</span>
                    </div>
                    <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{hit.content}</p>
                    <p className="mt-3 text-xs text-muted-foreground">片段 #{hit.chunk_index + 1}</p>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </WorkbenchLayout>
  );
}
