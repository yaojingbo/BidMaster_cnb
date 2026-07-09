'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  FolderSearch,
  Globe2,
  Heart,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/stores/auth-store';
import {
  createProjectSource,
  deleteProjectSource,
  listProjectSources,
  updateProjectSource,
  visitProjectSource,
  type ProjectSource,
  type ProjectSourcePayload,
} from '@/lib/data-api';

const categories = [
  { value: '', label: '全部分类' },
  { value: 'public_resource', label: '公共资源交易平台' },
  { value: 'government_procurement', label: '政府采购' },
  { value: 'enterprise_procurement', label: '企业采购' },
  { value: 'industry', label: '行业平台' },
  { value: 'aggregator', label: '第三方聚合' },
  { value: 'other', label: '其他' },
];

const statusOptions = [
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '停用' },
  { value: 'invalid', label: '疑似失效' },
];

const sortOptions = [
  { value: 'default', label: '常用优先' },
  { value: 'last_visited', label: '最近访问' },
  { value: 'updated', label: '最近更新' },
  { value: 'created', label: '最近创建' },
  { value: 'name', label: '名称排序' },
  { value: 'category', label: '分类排序' },
  { value: 'region', label: '地区排序' },
] as const;

const defaultForm: ProjectSourcePayload = {
  name: '',
  url: '',
  category: 'public_resource',
  region: '',
  tags: [],
  note: '',
  is_favorite: false,
  status: 'active',
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '尚未访问';
  return iso.replace('T', ' ').slice(0, 19);
};

const categoryLabel = (value: string) => categories.find(item => item.value === value)?.label || '其他';
const statusLabel = (value: string) => statusOptions.find(item => item.value === value)?.label || value;

export default function ProjectQueryPage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const [sources, setSources] = useState<ProjectSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<(typeof sortOptions)[number]['value']>('default');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProjectSource | null>(null);
  const [form, setForm] = useState<ProjectSourcePayload>(defaultForm);
  const [tagText, setTagText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProjectSource | null>(null);

  const loadSources = useCallback(async (signal?: AbortSignal) => {
    if (!authReady || !isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listProjectSources(
        {
          page: 1,
          page_size: 100,
          q: q.trim() || undefined,
          category: category || undefined,
          region: region.trim() || undefined,
          is_favorite: favoriteOnly ? true : undefined,
          sort,
        },
        { signal }
      );
      setSources(res.items);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '加载项目查询信息源失败');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [authReady, category, favoriteOnly, isAuthenticated, q, region, sort]);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      loadSources(controller.signal);
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [authReady, isAuthenticated, loadSources, requireAuth]);

  const regions = useMemo(
    () => Array.from(new Set(sources.map(item => item.region).filter(Boolean))).sort(),
    [sources]
  );

  const openCreateForm = () => {
    if (!requireAuth()) return;
    setEditing(null);
    setForm(defaultForm);
    setTagText('');
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (source: ProjectSource) => {
    if (!requireAuth()) return;
    setEditing(source);
    setForm({
      name: source.name,
      url: source.url,
      category: source.category,
      region: source.region || '',
      tags: source.tags || [],
      note: source.note || '',
      is_favorite: source.is_favorite,
      status: source.status,
    });
    setTagText((source.tags || []).join('、'));
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(defaultForm);
    setTagText('');
  };

  const buildPayload = () => ({
    ...form,
    tags: tagText
      .split(/[、,，\s]+/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 10),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireAuth()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editing) {
        await updateProjectSource(editing.id, payload);
      } else {
        await createProjectSource(payload);
      }
      closeForm();
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存信息源失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !requireAuth()) return;
    setError(null);
    try {
      await deleteProjectSource(deleteTarget.id);
      setDeleteTarget(null);
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除信息源失败');
    }
  };

  const handleOpen = async (source: ProjectSource) => {
    if (!requireAuth()) return;
    window.open(source.url, '_blank', 'noopener,noreferrer');
    try {
      const updated = await visitProjectSource(source.id);
      setSources(prev => prev.map(item => (item.id === source.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '访问时间记录失败');
    }
  };

  const toggleFavorite = async (source: ProjectSource) => {
    if (!requireAuth()) return;
    setError(null);
    try {
      const updated = await updateProjectSource(source.id, { is_favorite: !source.is_favorite });
      setSources(prev => prev.map(item => (item.id === source.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新常用状态失败');
    }
  };

  return (
    <WorkbenchLayout>
      <div className="space-y-6">
        <PageHeader
          title="项目查询"
          description="集中管理常用招投标信息来源，作为查找项目信息的工作入口。"
          actions={
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              新增链接
            </button>
          }
        />

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_160px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={event => setQ(event.target.value)}
                placeholder="搜索名称、链接、地区或备注"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              {categories.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              value={region}
              onChange={event => setRegion(event.target.value)}
              list="project-query-regions"
              placeholder="地区"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <datalist id="project-query-regions">
              {regions.map(item => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <select
              value={sort}
              onChange={event => setSort(event.target.value as (typeof sortOptions)[number]['value'])}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              aria-label="排序方式"
            >
              {sortOptions.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFavoriteOnly(value => !value)}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors',
                favoriteOnly
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Heart className={cn('h-4 w-4', favoriteOnly && 'fill-current')} />
              只看常用
            </button>
          </div>
        </section>

        {showForm && (
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{editing ? '编辑信息源' : '新增信息源'}</CardTitle>
              <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">名称</span>
                  <input
                    required
                    value={form.name}
                    onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    placeholder="浙江省公共资源交易服务平台"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">链接</span>
                  <input
                    required
                    value={form.url}
                    onChange={event => setForm(prev => ({ ...prev, url: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    placeholder="https://example.com"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">分类</span>
                  <select
                    value={form.category}
                    onChange={event => setForm(prev => ({ ...prev, category: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    {categories.slice(1).map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">地区</span>
                  <input
                    value={form.region}
                    onChange={event => setForm(prev => ({ ...prev, region: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    placeholder="浙江省"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">标签</span>
                  <input
                    value={tagText}
                    onChange={event => setTagText(event.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    placeholder="建设工程、政府采购"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">状态</span>
                  <select
                    value={form.status}
                    onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    {statusOptions.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-sm font-medium">备注</span>
                  <textarea
                    value={form.note}
                    onChange={event => setForm(prev => ({ ...prev, note: event.target.value }))}
                    className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="例如：每天上午查看公告和澄清答疑"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_favorite}
                    onChange={event => setForm(prev => ({ ...prev, is_favorite: event.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  设为常用
                </label>
                <div className="flex justify-end gap-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          {loading ? (
            <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              信息源加载中...
            </div>
          ) : sources.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <FolderSearch className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">还没有项目查询链接</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                添加公共资源交易平台、政府采购或企业采购平台，后续就能从这里快速进入查询。
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                新增第一个链接
              </button>
            </div>
          ) : (
            sources.map(source => (
              <Card key={source.id} className="rounded-2xl transition-all hover:border-primary/30 hover:shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                        <CardTitle className="truncate text-base">{source.name}</CardTitle>
                        {source.is_favorite && <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{source.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(source)}
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                        source.is_favorite
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      title={source.is_favorite ? '取消常用' : '设为常用'}
                    >
                      <Heart className={cn('h-4 w-4', source.is_favorite && 'fill-current')} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                      {categoryLabel(source.category)}
                    </span>
                    {source.region && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {source.region}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                      {statusLabel(source.status)}
                    </span>
                    {(source.tags || []).map(tag => (
                      <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="min-h-16 rounded-xl bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                    {source.note || '暂无备注'}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>最后访问：{formatDate(source.last_visited_at)}</span>
                    <span>更新：{formatDate(source.updated_at)}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(source)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(source)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpen(source)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      打开网站
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
              <h2 className="text-lg font-semibold">删除信息源</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                确定删除“{deleteTarget.name}”吗？删除后不会影响外部网站，只会移除本平台保存的入口。
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="h-10 rounded-full bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WorkbenchLayout>
  );
}
