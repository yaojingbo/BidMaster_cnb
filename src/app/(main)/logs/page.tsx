'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, RefreshCw, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLogStore, type LogEntry } from '@/stores/log-store';
import { authFetch } from '@/lib/auth-fetch';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/stores/auth-store';

type LevelFilter = 'all' | 'info' | 'warn' | 'error';
type SourceFilter = 'all' | 'frontend' | 'backend';

export default function LogsPage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const frontendLogs = useLogStore(s => s.logs);
  const clearLogs = useLogStore(s => s.clearLogs);
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clearBackendLogs = async () => {
    if (!requireAuth()) return;
    try {
      const res = await authFetch('/api/logs', { method: 'DELETE' });
      if (res.ok) {
        setBackendLogs([]);
        setSelectedIds(new Set());
      }
    } catch {
      // silent
    }
  };

  const fetchBackendLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/logs?limit=200');
      if (res.ok) {
        const data = await res.json();
        setBackendLogs((data.logs || []).map((l: any) => ({ ...l, source: 'backend' })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    fetchBackendLogs();
  }, [authReady, fetchBackendLogs]);

  const allLogs = [...frontendLogs, ...backendLogs]
    .filter(l => levelFilter === 'all' || l.level === levelFilter)
    .filter(l => sourceFilter === 'all' || l.source === sourceFilter)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('zh-CN', { hour12: false });
    } catch {
      return ts;
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour12: false });
    } catch {
      return ts;
    }
  };

  const handleDownload = () => {
    const logsToExport =
      selectedIds.size > 0 ? allLogs.filter(log => selectedIds.has(log.id)) : allLogs;
    const lines = logsToExport.map(
      log =>
        `[${formatDate(log.timestamp)}] [${log.source}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.detail ? '\n  详情: ' + log.detail : ''}`
    );
    const content = lines.join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bid-master-logs_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allLogs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allLogs.map(l => l.id)));
    }
  };

  const levelBadge = (level: string) => {
    const cls =
      {
        info: 'bg-blue-100 text-blue-700',
        warn: 'bg-yellow-100 text-yellow-700',
        error: 'bg-red-100 text-red-700',
      }[level] || 'bg-gray-100 text-gray-700';
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>{level}</span>
    );
  };

  const sourceBadge = (source: string) => {
    const cls =
      source === 'frontend' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700';
    const label = source === 'frontend' ? '前端' : '后端';
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>{label}</span>
    );
  };

  return (
    <WorkbenchLayout>
      <div className="max-w-4xl">
        <PageHeader title="系统日志" description="前后端操作日志与错误记录" />

        <div className="flex items-center gap-3 mb-4">
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value as LevelFilter)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">全部级别</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as SourceFilter)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">全部来源</option>
            <option value="frontend">前端</option>
            <option value="backend">后端</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={handleDownload}
            disabled={allLogs.length === 0}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {selectedIds.size > 0 ? `导出选中 (${selectedIds.size})` : '导出全部'}
          </button>
          <button
            onClick={fetchBackendLogs}
            disabled={loading}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空前端日志
          </button>
          <button
            onClick={clearBackendLogs}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空后端日志
          </button>
        </div>

        <div className="border rounded-lg max-h-[70vh] overflow-y-auto">
          {allLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">暂无日志</div>
          ) : (
            <>
              <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 sticky top-0 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === allLogs.length && allLogs.length > 0}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-gray-300 accent-primary cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0 ? `已选 ${selectedIds.size} 条` : '全选'}
                </span>
              </div>
              <div className="divide-y">
                {allLogs.map(log => {
                  const isExpanded = expandedId === log.id;
                  const hasDetail = !!log.detail;
                  const isSelected = selectedIds.has(log.id);
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'px-4 py-2.5 transition-colors',
                        hasDetail && 'cursor-pointer hover:bg-muted/50',
                        isExpanded && 'bg-muted/30',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            e.stopPropagation();
                            toggleSelect(log.id);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-primary cursor-pointer shrink-0"
                        />
                        <div
                          className="flex items-center gap-2 flex-1 min-w-0"
                          onClick={() => hasDetail && setExpandedId(isExpanded ? null : log.id)}
                        >
                          {hasDetail ? (
                            isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )
                          ) : (
                            <span className="w-3.5 shrink-0" />
                          )}
                          <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
                            {formatTime(log.timestamp)}
                          </span>
                          {sourceBadge(log.source)}
                          {levelBadge(log.level)}
                          <span className="text-xs text-muted-foreground">{log.category}</span>
                          <span className="truncate flex-1">{log.message}</span>
                        </div>
                      </div>
                      {isExpanded && log.detail && (
                        <div className="mt-2 ml-9 border-l-2 border-muted pl-3">
                          <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto whitespace-pre-wrap text-muted-foreground max-h-[300px] overflow-y-auto">
                            {log.detail}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          显示 {allLogs.length} 条日志（前端最多保留 200 条，后端最多 500 条）
        </p>
      </div>
    </WorkbenchLayout>
  );
}
