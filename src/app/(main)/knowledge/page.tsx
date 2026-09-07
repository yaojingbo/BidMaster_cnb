'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleEllipsis,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
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
import { Input } from '@/components/ui/input';
import { createKnowledgeBase, deleteKnowledgeBase, listKnowledgeBases } from '@/lib/knowledge-api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/stores/auth-store';
import type { KnowledgeBaseSummary } from '@/types/knowledge';

function getStatus(item: KnowledgeBaseSummary) {
  if (item.processing_count > 0) return { label: '索引中', tone: 'primary' as const };
  if (item.failed_count > 0) return { label: '部分异常', tone: 'destructive' as const };
  if (item.file_count > 0 && item.completed_count === item.file_count) {
    return { label: '可问答', tone: 'primary' as const };
  }
  if (item.file_count > 0) return { label: '待索引', tone: 'muted' as const };
  return { label: '空知识库', tone: 'muted' as const };
}

export default function KnowledgePage() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const user = useAuthStore(state => state.user);
  const [items, setItems] = useState<KnowledgeBaseSummary[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!requireAuth('/knowledge')) return;
    setLoading(true);
    try {
      setItems(await listKnowledgeBases(search));
      setError('');
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }, [requireAuth, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      items.reduce(
        (current, item) => ({
          files: current.files + (item.file_count || 0),
          indexed: current.indexed + (item.completed_count || 0),
        }),
        { files: 0, indexed: 0 },
      ),
    [items],
  );

  function requireMember() {
    if (user?.role !== 'guest') return true;
    router.push(`/login?callbackUrl=${encodeURIComponent('/knowledge')}`);
    return false;
  }

  function openCreate() {
    if (requireMember()) setCreateOpen(true);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !requireMember()) return;
    setSaving(true);
    try {
      await createKnowledgeBase(name.trim(), description.trim());
      setName('');
      setDescription('');
      setCreateOpen(false);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: KnowledgeBaseSummary) {
    setOpenMenuId(null);
    if (!requireMember()) return;
    if (!window.confirm(`确认删除“${item.name}”？原始文件不会被删除。`)) return;
    try {
      await deleteKnowledgeBase(item.id);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  return (
    <WorkbenchLayout>
      <div className="flex flex-col gap-6 pb-12">
        <PageHeader
          title="知识库"
          description="先整理资料范围，再建立索引并进行有依据的问答。"
          actions={
            <Button onClick={openCreate}>
              <Plus data-icon="inline-start" />
              新建知识库
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span><strong className="font-semibold text-foreground">{items.length}</strong> 个知识库</span>
          <span><strong className="font-semibold text-foreground">{totals.files}</strong> 份资料</span>
          <span><strong className="font-semibold text-foreground">{totals.indexed}</strong> 份可问答</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="搜索名称或说明"
              aria-label="搜索知识库"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="清除搜索"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{loading ? '正在更新…' : `${items.length} 个结果`}</p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section aria-label="知识库列表" className="overflow-visible rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem_3rem] items-center gap-4 border-b px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
            <span>知识库</span>
            <span>资料进度</span>
            <span>状态</span>
            <span className="sr-only">操作</span>
          </div>

          {loading ? (
            <div className="flex flex-col divide-y">
              {[0, 1, 2].map(item => (
                <div key={item} className="flex items-center gap-4 px-4 py-5 sm:px-5">
                  <div className="size-10 animate-pulse rounded-lg bg-muted" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <BookOpen className="size-5" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">{search ? '没有匹配的知识库' : '还没有知识库'}</p>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  {search ? '试试其他关键词，或清除搜索条件。' : '创建一个知识库，把招标文件、分析结果和历史资料组织在一起。'}
                </p>
              </div>
              {search ? (
                <Button variant="outline" onClick={() => setSearch('')}>清除搜索</Button>
              ) : (
                <Button onClick={openCreate}><Plus data-icon="inline-start" />创建第一个知识库</Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {items.map(item => {
                const status = getStatus(item);
                const progress = item.file_count ? Math.round((item.completed_count / item.file_count) * 100) : 0;
                return (
                  <article key={item.id} className="group relative grid gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5 md:grid-cols-[minmax(0,1fr)_9rem_7rem_3rem] md:items-center">
                    <Link href={`/knowledge/${item.id}`} className="flex min-w-0 items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-foreground group-hover:text-primary">{item.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description || '暂无说明'}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground md:hidden">
                          <span>{item.file_count || 0} 份资料</span>
                          <span>{item.completed_count || 0} 份可问答</span>
                        </div>
                      </div>
                    </Link>

                    <div className="hidden flex-col gap-2 md:flex">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.completed_count || 0}/{item.file_count || 0}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:block">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          status.tone === 'destructive'
                            ? 'bg-destructive/10 text-destructive'
                            : status.tone === 'primary'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {status.tone === 'primary' && <CheckCircle2 className="size-3.5" />}
                        {status.label}
                      </span>
                      <Link href={`/knowledge/${item.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary md:hidden">
                        打开 <ArrowRight className="size-4" />
                      </Link>
                    </div>

                    <div className="absolute right-3 top-3 md:relative md:right-auto md:top-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`打开 ${item.name} 的更多操作`}
                        aria-expanded={openMenuId === item.id}
                        onClick={() => setOpenMenuId(current => current === item.id ? null : item.id)}
                      >
                        <CircleEllipsis />
                      </Button>
                      {openMenuId === item.id && (
                        <div className="absolute right-0 top-10 z-10 min-w-40 rounded-lg border bg-popover p-1 shadow-md">
                          <button
                            type="button"
                            onClick={() => void remove(item)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                          >
                            <Trash2 className="size-4" />删除知识库
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建知识库</DialogTitle>
              <DialogDescription>先给资料集合命名，创建后再添加和索引文件。</DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium">
                知识库名称
                <Input
                  autoFocus
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="例如：市政工程投标资料"
                  maxLength={200}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                说明 <span className="font-normal text-muted-foreground">（可选）</span>
                <textarea
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="说明这个知识库包含哪些资料、用于什么场景"
                  maxLength={2000}
                  rows={4}
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose>
                <Button type="submit" disabled={saving || !name.trim()}>
                  {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                  {saving ? '正在创建' : '创建知识库'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </WorkbenchLayout>
  );
}
