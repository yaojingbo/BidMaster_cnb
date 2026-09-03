'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Plus, Search, Send, Trash2 } from 'lucide-react';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createKnowledgeBase, deleteKnowledgeBase, listKnowledgeBases, queryRag } from '@/lib/knowledge-api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { KnowledgeBaseSummary } from '@/types/knowledge';

export default function KnowledgePage() {
  const requireAuth = useRequireAuth();
  const [items, setItems] = useState<KnowledgeBaseSummary[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

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

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createKnowledgeBase(name.trim(), description.trim());
      setName('');
      setDescription('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('确认删除这个知识库？原始文件不会被删除。')) return;
    await deleteKnowledgeBase(id);
    await load();
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer('');
    try {
      const result = await queryRag(question.trim());
      setAnswer(result.answer);
      setError('');
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setAsking(false);
    }
  }

  return (
    <WorkbenchLayout>
      <div className="space-y-6 pb-12">
        <PageHeader title="知识库" description="组织招投标资料，建立索引并进行带引用的多文件问答。" />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">知识库问答</CardTitle>
            <CardDescription>基于已索引的招投标文档进行语义问答。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={ask} className="flex gap-2">
              <Input value={question} onChange={event => setQuestion(event.target.value)} placeholder="例如：台州市招标文件规律" maxLength={2000} />
              <Button type="submit" disabled={!question.trim() || asking}>
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} 提问
              </Button>
            </form>
            {answer && <div className="mt-4 whitespace-pre-wrap rounded-lg border p-3 text-sm">{answer}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">新建知识库</CardTitle>
            <CardDescription>创建后再添加文件；文件不会自动发送给 Embedding 服务。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <Input value={name} onChange={event => setName(event.target.value)} placeholder="知识库名称" maxLength={200} />
              <Input value={description} onChange={event => setDescription(event.target.value)} placeholder="可选说明" maxLength={2000} />
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} 新建
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索知识库" />
        </div>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />正在加载知识库...</div>
        ) : items.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><BookOpen className="h-10 w-10 text-muted-foreground" /><p className="font-medium">暂无知识库</p><p className="text-sm text-muted-foreground">创建知识库后，可添加已有文件或上传新文件。</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map(item => (
              <Card key={item.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/knowledge/${item.id}`} className="min-w-0 flex-1">
                      <CardTitle className="truncate text-lg hover:text-primary">{item.name}</CardTitle>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => void remove(item.id)} aria-label="删除知识库"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-10">{item.description || '暂无说明'}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>文件 {item.file_count || 0}</span><span>已索引 {item.completed_count || 0}</span>
                  <span>处理中 {item.processing_count || 0}</span><span>失败 {item.failed_count || 0}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </WorkbenchLayout>
  );
}
