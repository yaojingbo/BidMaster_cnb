'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Calendar,
  Code2,
  Download,
  Eye,
  FileSearch,
  FileText,
  FileUp,
  FlaskConical,
  Layers3,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import JSZip from 'jszip';
import { cn } from '@/lib/utils';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth-fetch';
import {
  getStats,
  listFiles,
  downloadFile as apiDownloadFile,
  batchDownloadFiles,
  downloadBlob,
  previewFileUrl,
  deleteFile as apiDeleteFile,
  listSimulates,
  deleteSimulate as apiDeleteSimulate,
  listOpenings,
  deleteOpening as apiDeleteOpening,
  listExtracts,
  exportExtractJson,
  exportExtractPdf,
  exportSimulatePdf,
  exportOpeningPdf,
  deleteExtract as apiDeleteExtract,
} from '@/lib/data-api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFileStore } from '@/stores/file-store';
import { useAuthStore } from '@/stores/auth-store';
import type {
  DataStats,
  FileRecord,
  SimulateTaskRecord,
  OpeningResultRecord,
  ExtractResultRecord,
} from '@/lib/data-api';

type DataTab = 'files' | 'extracts' | 'simulates' | 'openings';
type DetailRecord =
  | { type: 'files'; record: FileRecord }
  | { type: 'extracts'; record: ExtractResultRecord }
  | { type: 'simulates'; record: SimulateTaskRecord }
  | { type: 'openings'; record: OpeningResultRecord };

const tabs: { key: DataTab; label: string; desc: string; icon: React.ElementType }[] = [
  { key: 'files', label: '上传文件', desc: '用户上传的原始文件', icon: FileUp },
  { key: 'extracts', label: '要素提取', desc: '结构化提取输出', icon: FileSearch },
  { key: 'simulates', label: '模拟编制', desc: '模拟标书与过程结果', icon: FlaskConical },
  { key: 'openings', label: '开标分析', desc: '报价统计与分析报告', icon: BarChart3 },
];

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'bg-warning/10 text-warning', text: '待处理' },
  step1_convert: { color: 'bg-primary/10 text-primary', text: 'PDF 转换' },
  step2_extract: { color: 'bg-primary/10 text-primary', text: '要素提取' },
  step3_compare: { color: 'bg-primary/10 text-primary', text: '对比分析' },
  step4_simulate: { color: 'bg-primary/10 text-primary', text: '模拟编制' },
  completed: { color: 'bg-success/10 text-success', text: '已完成' },
  failed: { color: 'bg-destructive/10 text-destructive', text: '失败' },
};

const fileTypeColor: Record<string, string> = {
  pdf: 'bg-destructive/10 text-destructive',
  excel: 'bg-success/10 text-success',
  xlsx: 'bg-success/10 text-success',
  xls: 'bg-success/10 text-success',
  csv: 'bg-success/10 text-success',
  markdown: 'bg-primary/10 text-primary',
  md: 'bg-primary/10 text-primary',
  word: 'bg-secondary/10 text-secondary',
  doc: 'bg-secondary/10 text-secondary',
  docx: 'bg-secondary/10 text-secondary',
};

const emptyStats: DataStats = {
  files: 0,
  simulate_tasks: 0,
  opening_results: 0,
  extract_results: 0,
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '-';
  return iso.replace('T', ' ').slice(0, 19);
};

const compactText = (text: string, fallback = '暂无可预览内容') => {
  const normalized = text
    .replace(/[#>*_`|\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
};

const getFileTitle = (file: FileRecord) => file.original_name || file.id;
const getExtractTitle = (result: ExtractResultRecord) => result.name || `提取结果 ${result.id}`;
const getSimulateTitle = (task: SimulateTaskRecord) => task.name || `模拟任务 ${task.task_id}`;
const getOpeningTitle = (result: OpeningResultRecord) => result.name || `开标分析 ${result.id}`;

function generateSimulateMarkdown(task: SimulateTaskRecord): string {
  const lines = Object.entries(task.step_results || {}).map(([key, val]) => {
    const label =
      key === 'step1'
        ? 'Step 1：PDF转换'
        : key === 'step2'
          ? 'Step 2：要素提取'
          : key === 'step3'
            ? 'Step 3：对比分析'
            : 'Step 4：模拟编制';
    const content = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    return `## ${label}\n\n${content}`;
  });
  return `# ${getSimulateTitle(task)}\n\n${lines.join('\n\n')}`;
}

function generateOpeningMarkdown(result: OpeningResultRecord): string {
  const meta = result.meta || {};
  const stats = result.bid_stats || ({} as OpeningResultRecord['bid_stats']);
  const lines = [
    '# 开标分析报告',
    '',
    `- 项目名称：${String(meta.project_name || result.name || result.id)}`,
    `- 项目编号：${String(meta.bid_number || '-')}`,
    `- 投标人数量：${result.bidder_count || 0}`,
    `- 分析时间：${result.created_at || '-'}`,
  ];

  if (result.bid_ranking?.length) {
    lines.push('', '## 投标价排名', '', '| 排名 | 投标人 | 报价 |', '| --- | --- | --- |');
    for (const item of result.bid_ranking) {
      lines.push(`| ${item.rank} | ${item.name} | ${item.price.toLocaleString()} |`);
    }
  }

  if (stats.mean !== undefined) {
    const std = stats.std_dev ?? stats.std;
    lines.push('', '## 统计指标', '', '| 指标 | 值 |', '| --- | --- |');
    lines.push(`| 均值 | ${stats.mean.toLocaleString()} |`);
    if (std !== undefined) lines.push(`| 标准差 | ${std} |`);
    lines.push(`| 离散系数 | ${stats.cv}% |`);
    lines.push(`| 最小值 | ${stats.min?.toLocaleString()} |`);
    lines.push(`| 最大值 | ${stats.max?.toLocaleString()} |`);
    lines.push(`| 极差 | ${stats.range?.toLocaleString()} |`);
  }

  if (result.ai_analysis) {
    lines.push('', '## AI 综合分析', '', result.ai_analysis);
  }

  return lines.join('\n');
}

const getRecordMarkdown = (detail: DetailRecord | null) => {
  if (!detail) return '';
  if (detail.type === 'extracts') return detail.record.content || '';
  if (detail.type === 'simulates') return generateSimulateMarkdown(detail.record);
  if (detail.type === 'openings') return generateOpeningMarkdown(detail.record);
  return `# ${detail.record.original_name}\n\n- 文件类型：${detail.record.type}\n- 文件大小：${formatSize(detail.record.size)}\n- 上传时间：${formatDate(detail.record.created_at)}\n\n原始上传文件请使用预览或下载查看完整内容。`;
};

const getDetailTitle = (detail: DetailRecord) => {
  if (detail.type === 'files') return getFileTitle(detail.record);
  if (detail.type === 'extracts') return getExtractTitle(detail.record);
  if (detail.type === 'simulates') return getSimulateTitle(detail.record);
  return getOpeningTitle(detail.record);
};

export default function DatabasePage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<DataTab>('files');
  const [loadedTabs, setLoadedTabs] = useState<Set<DataTab>>(new Set(['files']));
  const [stats, setStats] = useState<DataStats>(emptyStats);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [markdownMode, setMarkdownMode] = useState(false);
  const [filePreviewText, setFilePreviewText] = useState<Record<string, string>>({});
  const [filePreviewLoadingId, setFilePreviewLoadingId] = useState<string | null>(null);
  const [quickPreview, setQuickPreview] = useState<DetailRecord | null>(null);
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedExtracts, setSelectedExtracts] = useState<Set<string>>(new Set());
  const [selectedSimulates, setSelectedSimulates] = useState<Set<string>>(new Set());
  const [selectedOpenings, setSelectedOpenings] = useState<Set<string>>(new Set());

  const [filesData, setFilesData] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [simulatesData, setSimulatesData] = useState<SimulateTaskRecord[]>([]);
  const [simulatesLoading, setSimulatesLoading] = useState(false);
  const [openingsData, setOpeningsData] = useState<OpeningResultRecord[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState(false);
  const [extractsData, setExtractsData] = useState<ExtractResultRecord[]>([]);
  const [extractsLoading, setExtractsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getStats());
    } catch {
      setStats(emptyStats);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await listFiles({
        page: 1,
        page_size: 100,
        file_type: fileTypeFilter || undefined,
      });
      setFilesData(res.files);
    } catch (err) {
      console.error('加载文件失败:', err);
    } finally {
      setFilesLoading(false);
    }
  }, [fileTypeFilter]);

  const fetchExtracts = useCallback(async () => {
    setExtractsLoading(true);
    try {
      const res = await listExtracts({ page: 1, page_size: 100 });
      setExtractsData(res.results);
    } catch (err) {
      console.error('加载提取结果失败:', err);
    } finally {
      setExtractsLoading(false);
    }
  }, []);

  const fetchSimulates = useCallback(async () => {
    setSimulatesLoading(true);
    try {
      const res = await listSimulates({
        page: 1,
        page_size: 100,
        status: statusFilter || undefined,
      });
      setSimulatesData(res.tasks);
    } catch (err) {
      console.error('加载模拟任务失败:', err);
    } finally {
      setSimulatesLoading(false);
    }
  }, [statusFilter]);

  const fetchOpenings = useCallback(async () => {
    setOpeningsLoading(true);
    try {
      const res = await listOpenings({ page: 1, page_size: 100 });
      setOpeningsData(res.results);
    } catch (err) {
      console.error('加载开标结果失败:', err);
    } finally {
      setOpeningsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    loadStats();
    if (activeTab === 'files') fetchFiles();
    if (activeTab === 'extracts') fetchExtracts();
    if (activeTab === 'simulates') fetchSimulates();
    if (activeTab === 'openings') fetchOpenings();
  }, [activeTab, authReady, fetchExtracts, fetchFiles, fetchOpenings, fetchSimulates, isAuthenticated, loadStats]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (activeTab === 'files') fetchFiles();
  }, [activeTab, authReady, fetchFiles, fileTypeFilter, isAuthenticated]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (activeTab === 'simulates') fetchSimulates();
  }, [activeTab, authReady, fetchSimulates, isAuthenticated, statusFilter]);

  const handleTabChange = (key: DataTab) => {
    setActiveTab(key);
    setSearchKeyword('');
    setMarkdownMode(false);
    setLoadedTabs(prev => new Set(prev).add(key));
  };

  const matchesKeyword = useCallback(
    (title: string, content = '') => {
      const keyword = searchKeyword.trim().toLowerCase();
      if (!keyword) return true;
      return `${title} ${content}`.toLowerCase().includes(keyword);
    },
    [searchKeyword]
  );

  const matchesTime = useCallback(
    (createdAt: string | null) => {
      if (timeFilter === 'all') return true;
      if (!createdAt) return false;
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const days = timeFilter === '7d' ? 7 : 30;
      return now - created <= days * 24 * 60 * 60 * 1000;
    },
    [timeFilter]
  );

  const filteredFiles = useMemo(
    () =>
      filesData.filter(file => matchesKeyword(getFileTitle(file)) && matchesTime(file.created_at)),
    [filesData, matchesKeyword, matchesTime]
  );

  const filteredExtracts = useMemo(
    () =>
      extractsData.filter(
        result =>
          matchesKeyword(getExtractTitle(result), result.content) && matchesTime(result.created_at)
      ),
    [extractsData, matchesKeyword, matchesTime]
  );

  const filteredSimulates = useMemo(
    () =>
      simulatesData.filter(task => {
        const content = generateSimulateMarkdown(task);
        return matchesKeyword(getSimulateTitle(task), content) && matchesTime(task.created_at);
      }),
    [matchesKeyword, matchesTime, simulatesData]
  );

  const filteredOpenings = useMemo(
    () =>
      openingsData.filter(result => {
        const content = generateOpeningMarkdown(result);
        return matchesKeyword(getOpeningTitle(result), content) && matchesTime(result.created_at);
      }),
    [matchesKeyword, matchesTime, openingsData]
  );

  const currentCount =
    activeTab === 'files'
      ? filteredFiles.length
      : activeTab === 'extracts'
        ? filteredExtracts.length
        : activeTab === 'simulates'
          ? filteredSimulates.length
          : filteredOpenings.length;

  const isLoading =
    activeTab === 'files'
      ? filesLoading
      : activeTab === 'extracts'
        ? extractsLoading
        : activeTab === 'simulates'
          ? simulatesLoading
          : openingsLoading;

  const handleDownloadFile = async (file: FileRecord) => {
    if (!requireAuth()) return;
    setDownloadingId(file.id);
    setDownloadError(null);
    try {
      const blob = await apiDownloadFile(file.id);
      downloadBlob(blob, file.original_name);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : '下载失败');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportExtractJson = async (result: ExtractResultRecord) => {
    if (!requireAuth()) return;
    setDownloadingId(result.id);
    setDownloadError(null);
    try {
      const blob = await exportExtractJson(result.id);
      downloadBlob(blob, `extract_${result.id}_${result.template_type}.json`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : '导出 JSON 失败');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportResultPdf = async (record: DetailRecord) => {
    if (!requireAuth() || record.type === 'files') return;
    const id =
      record.type === 'extracts'
        ? record.record.id
        : record.type === 'simulates'
          ? record.record.task_id
          : record.record.id;
    setDownloadingId(id);
    setDownloadError(null);
    try {
      const blob =
        record.type === 'extracts'
          ? await exportExtractPdf(record.record.id)
          : record.type === 'simulates'
            ? await exportSimulatePdf(record.record.task_id)
            : await exportOpeningPdf(record.record.id);
      const title = getDetailTitle(record).replace(/\.pdf$/i, '');
      downloadBlob(blob, `${title}.pdf`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : '导出 PDF 失败');
    } finally {
      setDownloadingId(null);
    }
  };

  const toggleFileSelect = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleAllFilteredFiles = () => {
    setSelectedFiles(prev => {
      if (filteredFiles.length > 0 && filteredFiles.every(file => prev.has(file.id))) {
        return new Set();
      }
      return new Set(filteredFiles.map(file => file.id));
    });
  };

  const handleBatchDownloadFiles = async () => {
    if (!requireAuth()) return;
    if (selectedFiles.size === 0) return;
    setBatchDownloading(true);
    setDownloadError(null);
    try {
      const blob = await batchDownloadFiles(Array.from(selectedFiles));
      downloadBlob(blob, 'files_batch_download.zip');
      setSelectedFiles(new Set());
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : '批量下载失败');
    } finally {
      setBatchDownloading(false);
    }
  };

  const handleBatchDeleteFiles = async () => {
    if (!requireAuth()) return;
    if (selectedFiles.size === 0) return;
    for (const fileId of selectedFiles) {
      try {
        await apiDeleteFile(fileId);
        useFileStore.getState().removeFile(fileId);
      } catch (err) {
        console.error('批量删除文件失败:', err);
      }
    }
    setSelectedFiles(new Set());
    await fetchFiles();
    await loadStats();
  };

  const getSelectionState = () => {
    if (activeTab === 'files') return selectedFiles;
    if (activeTab === 'extracts') return selectedExtracts;
    if (activeTab === 'simulates') return selectedSimulates;
    return selectedOpenings;
  };

  const toggleResultSelect = (id: string) => {
    const update = (prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    };
    if (activeTab === 'extracts') setSelectedExtracts(update);
    if (activeTab === 'simulates') setSelectedSimulates(update);
    if (activeTab === 'openings') setSelectedOpenings(update);
  };

  const toggleAllCurrentResults = () => {
    if (activeTab === 'files') {
      toggleAllFilteredFiles();
      return;
    }
    if (activeTab === 'extracts') {
      setSelectedExtracts(prev =>
        filteredExtracts.length > 0 && filteredExtracts.every(item => prev.has(item.id))
          ? new Set()
          : new Set(filteredExtracts.map(item => item.id))
      );
    }
    if (activeTab === 'simulates') {
      setSelectedSimulates(prev =>
        filteredSimulates.length > 0 && filteredSimulates.every(item => prev.has(item.task_id))
          ? new Set()
          : new Set(filteredSimulates.map(item => item.task_id))
      );
    }
    if (activeTab === 'openings') {
      setSelectedOpenings(prev =>
        filteredOpenings.length > 0 && filteredOpenings.every(item => prev.has(item.id))
          ? new Set()
          : new Set(filteredOpenings.map(item => item.id))
      );
    }
  };

  const currentResultsAllSelected = () => {
    if (activeTab === 'files') {
      return filteredFiles.length > 0 && filteredFiles.every(item => selectedFiles.has(item.id));
    }
    if (activeTab === 'extracts') {
      return filteredExtracts.length > 0 && filteredExtracts.every(item => selectedExtracts.has(item.id));
    }
    if (activeTab === 'simulates') {
      return filteredSimulates.length > 0 && filteredSimulates.every(item => selectedSimulates.has(item.task_id));
    }
    return filteredOpenings.length > 0 && filteredOpenings.every(item => selectedOpenings.has(item.id));
  };

  const handleBatchDeleteResults = async () => {
    if (!requireAuth()) return;
    if (activeTab === 'extracts') {
      for (const id of selectedExtracts) {
        try {
          await apiDeleteExtract(id);
        } catch (err) {
          console.error('批量删除提取结果失败:', err);
        }
      }
      setSelectedExtracts(new Set());
      await fetchExtracts();
    }
    if (activeTab === 'simulates') {
      for (const id of selectedSimulates) {
        try {
          await apiDeleteSimulate(id);
        } catch (err) {
          console.error('批量删除模拟任务失败:', err);
        }
      }
      setSelectedSimulates(new Set());
      await fetchSimulates();
    }
    if (activeTab === 'openings') {
      for (const id of selectedOpenings) {
        try {
          await apiDeleteOpening(id);
        } catch (err) {
          console.error('批量删除开标结果失败:', err);
        }
      }
      setSelectedOpenings(new Set());
      await fetchOpenings();
    }
    await loadStats();
  };

  const canRenderFileAsMarkdown = (file: FileRecord) =>
    ['md', 'markdown', 'txt', 'csv'].includes((file.type || '').toLowerCase());

  const loadFilePreviewText = async (file: FileRecord) => {
    if (!requireAuth()) return '';
    if (filePreviewText[file.id]) return filePreviewText[file.id];
    setFilePreviewLoadingId(file.id);
    setDownloadError(null);
    try {
      const response = await authFetch(previewFileUrl(file.id));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      const text = await response.text();
      setFilePreviewText(prev => ({ ...prev, [file.id]: text }));
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件内容加载失败';
      setDownloadError(message);
      return '';
    } finally {
      setFilePreviewLoadingId(null);
    }
  };

  const handleMarkdownClick = async (record: DetailRecord) => {
    setMarkdownMode(true);
    if (record.type === 'files') {
      await loadFilePreviewText(record.record);
    }
  };

  const getFileMarkdownContent = (file: FileRecord) =>
    filePreviewText[file.id] ||
    `# ${file.original_name}\n\n正在读取文件内容。若文件不是 Markdown、文本或 CSV，请使用原文预览或下载查看。`;

  const downloadMarkdown = (filename: string, markdown: string) => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
  };

  const handleDownloadDetail = (record: DetailRecord) => {
    if (!requireAuth()) return;
    if (record.type === 'files') {
      handleDownloadFile(record.record);
      return;
    }
    const filename =
      record.type === 'extracts'
        ? `extract_${record.record.id}_${record.record.template_type}.md`
        : record.type === 'simulates'
          ? `simulate_${record.record.task_id}.md`
          : `opening_${record.record.id}.md`;
    downloadMarkdown(filename, getRecordMarkdown(record));
  };

  const handleDelete = async (record: DetailRecord) => {
    if (!requireAuth()) return;
    if (record.type === 'files') {
      await apiDeleteFile(record.record.id);
      useFileStore.getState().removeFile(record.record.id);
      await fetchFiles();
    }
    if (record.type === 'extracts') {
      await apiDeleteExtract(record.record.id);
      await fetchExtracts();
    }
    if (record.type === 'simulates') {
      await apiDeleteSimulate(record.record.task_id);
      await fetchSimulates();
    }
    if (record.type === 'openings') {
      await apiDeleteOpening(record.record.id);
      await fetchOpenings();
    }
    await loadStats();
    setDetail(null);
    setQuickPreview(null);
  };

  const handleBatchDownload = async () => {
    if (!requireAuth()) return;
    const zip = new JSZip();
    if (activeTab === 'files') return;
    if (activeTab === 'extracts') {
      const selected = filteredExtracts.filter(item => selectedExtracts.has(item.id));
      for (const item of selected) zip.file(`extract_${item.id}.md`, generateExtractMarkdown(item));
    }
    if (activeTab === 'simulates') {
      const selected = filteredSimulates.filter(item => selectedSimulates.has(item.task_id));
      for (const item of selected) zip.file(`simulate_${item.task_id}.md`, generateSimulateMarkdown(item));
    }
    if (activeTab === 'openings') {
      const selected = filteredOpenings.filter(item => selectedOpenings.has(item.id));
      for (const item of selected) zip.file(`opening_${item.id}.md`, generateOpeningMarkdown(item));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${activeTab}_results.zip`);
    setSelectedExtracts(new Set());
    setSelectedSimulates(new Set());
    setSelectedOpenings(new Set());
  };

  const openDetail = (record: DetailRecord) => {
    setMarkdownMode(false);
    setQuickPreview(null);
    setDetail(record);
  };

  const openPreview = (record: DetailRecord) => {
    if (!requireAuth()) return;
    setMarkdownMode(false);
    setQuickPreview(record);
  };

  const openMarkdownPreview = async (record: DetailRecord) => {
    if (!requireAuth()) return;
    setQuickPreview(record);
    await handleMarkdownClick(record);
  };

  const renderBadge = (label: string, className?: string) => (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        className || 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  );

  const renderCardActions = (record: DetailRecord) => (
    <div className="flex items-center gap-2">
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
        onClick={() => openPreview(record)}
      >
        <Eye className="h-3.5 w-3.5" />
        预览
      </button>
      <button
        className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
        disabled={record.type === 'files' && !canRenderFileAsMarkdown(record.record)}
        onClick={() => openMarkdownPreview(record)}
      >
        Markdown
      </button>
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
        onClick={() => openDetail(record)}
      >
        详情
      </button>
    </div>
  );

  const renderFileCard = (file: FileRecord) => (
    <Card
      key={file.id}
      className="group overflow-hidden rounded-2xl transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={selectedFiles.has(file.id)}
                onChange={() => toggleFileSelect(file.id)}
                onClick={event => event.stopPropagation()}
              />
              <CardTitle className="truncate text-base">{getFileTitle(file)}</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderBadge(
                file.type || 'file',
                fileTypeColor[file.type] || 'bg-muted text-muted-foreground'
              )}
              {renderBadge(formatSize(file.size))}
            </div>
          </div>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => openDetail({ type: 'files', record: file })}
          >
            详情
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="min-h-28 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
          <p>原始上传文件</p>
          <p>文件名：{file.original_name}</p>
          <p>上传时间：{formatDate(file.created_at)}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          {renderCardActions({ type: 'files', record: file })}
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={downloadingId === file.id}
            onClick={() => handleDownloadFile(file)}
          >
            <Download className="h-3.5 w-3.5" />
            下载
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const renderExtractCard = (result: ExtractResultRecord) => (
    <Card
      key={result.id}
      className="group overflow-hidden rounded-2xl transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={selectedExtracts.has(result.id)}
                onChange={() => toggleResultSelect(result.id)}
              />
              <CardTitle className="truncate text-base">{getExtractTitle(result)}</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderBadge(result.template_type)}
              {renderBadge(result.mode, 'bg-primary/10 text-primary')}
              {result.status && renderBadge(result.status)}
            </div>
          </div>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => openDetail({ type: 'extracts', record: result })}
          >
            详情
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="line-clamp-5 min-h-28 rounded-xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
          {compactText(result.content)}
        </div>
        <div className="flex items-center justify-between gap-3">
          {renderCardActions({ type: 'extracts', record: result })}
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              disabled={downloadingId === result.id}
              onClick={() => handleExportExtractJson(result)}
            >
              <Code2 className="h-3.5 w-3.5" />
              JSON
            </button>
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              disabled={downloadingId === result.id}
              onClick={() => handleExportResultPdf({ type: 'extracts', record: result })}
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                downloadMarkdown(`extract_${result.id}_${result.template_type}.md`, result.content)
              }
            >
              <Download className="h-3.5 w-3.5" />
              下载
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSimulateCard = (task: SimulateTaskRecord) => {
    const markdown = generateSimulateMarkdown(task);
    const status = statusMap[task.status] || {
      color: 'bg-muted text-muted-foreground',
      text: task.status,
    };
    return (
      <Card
        key={task.task_id}
        className="group overflow-hidden rounded-2xl transition-all hover:border-primary/30 hover:shadow-sm"
      >
        <CardHeader className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={selectedSimulates.has(task.task_id)}
                  onChange={() => toggleResultSelect(task.task_id)}
                />
                <CardTitle className="truncate text-base">{getSimulateTitle(task)}</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderBadge(status.text, status.color)}
                {renderBadge(`Step ${task.current_step}/4`, 'bg-primary/10 text-primary')}
              </div>
            </div>
            <button
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => openDetail({ type: 'simulates', record: task })}
            >
              详情
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="line-clamp-5 min-h-28 rounded-xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            {compactText(markdown)}
          </div>
          <div className="flex items-center justify-between gap-3">
            {renderCardActions({ type: 'simulates', record: task })}
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                disabled={downloadingId === task.task_id}
                onClick={() => handleExportResultPdf({ type: 'simulates', record: task })}
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => downloadMarkdown(`simulate_${task.task_id}.md`, markdown)}
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOpeningCard = (result: OpeningResultRecord) => {
    const markdown = generateOpeningMarkdown(result);
    return (
      <Card
        key={result.id}
        className="group overflow-hidden rounded-2xl transition-all hover:border-primary/30 hover:shadow-sm"
      >
        <CardHeader className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={selectedOpenings.has(result.id)}
                  onChange={() => toggleResultSelect(result.id)}
                />
                <CardTitle className="truncate text-base">{getOpeningTitle(result)}</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderBadge(`${result.bidder_count || 0} 家投标人`, 'bg-primary/10 text-primary')}
                {renderBadge(result.status || '已生成')}
              </div>
            </div>
            <button
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => openDetail({ type: 'openings', record: result })}
            >
              详情
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="line-clamp-5 min-h-28 rounded-xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            {compactText(markdown)}
          </div>
          <div className="flex items-center justify-between gap-3">
            {renderCardActions({ type: 'openings', record: result })}
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                disabled={downloadingId === result.id}
                onClick={() => handleExportResultPdf({ type: 'openings', record: result })}
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => downloadMarkdown(`opening_${result.id}.md`, markdown)}
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-2xl border border-border bg-muted/40"
            />
          ))}
        </div>
      );
    }

    if (currentCount === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <Layers3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">暂无匹配结果</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            请调整搜索关键词、类型或时间范围后再试。
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {activeTab === 'files' && filteredFiles.map(renderFileCard)}
        {activeTab === 'extracts' && filteredExtracts.map(renderExtractCard)}
        {activeTab === 'simulates' && filteredSimulates.map(renderSimulateCard)}
        {activeTab === 'openings' && filteredOpenings.map(renderOpeningCard)}
      </div>
    );
  };

  const renderDetailContent = (record: DetailRecord) => {
    const markdown = record.type === 'files' ? getFileMarkdownContent(record.record) : getRecordMarkdown(record);
    if (record.type === 'files' && !markdownMode) {
      return (
        <iframe
          title={record.record.original_name}
          src={previewFileUrl(record.record.id)}
          className="h-[calc(100vh-17rem)] w-full rounded-xl border border-border bg-background"
        />
      );
    }

    if (record.type === 'files' && markdownMode && filePreviewLoadingId === record.record.id) {
      return (
        <div className="flex h-[calc(100vh-17rem)] items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground">
          正在读取文件内容...
        </div>
      );
    }

    return markdownMode ? (
      <div className="max-h-[calc(100vh-17rem)] overflow-auto rounded-xl border border-border bg-background p-6">
        <MarkdownPreview content={markdown} />
      </div>
    ) : (
      <pre className="max-h-[calc(100vh-17rem)] overflow-auto rounded-xl border border-border bg-background p-6 text-sm leading-6 whitespace-pre-wrap">
        {markdown}
      </pre>
    );
  };

  const renderDetailPage = (record: DetailRecord) => (
    <WorkbenchLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
            onClick={() => setDetail(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          <div className="flex items-center gap-2">
            <button
              className={cn(
                'inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted',
                !markdownMode && 'bg-muted text-foreground'
              )}
              onClick={() => setMarkdownMode(false)}
            >
              原文
            </button>
            <button
              className={cn(
                'inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50',
                markdownMode && 'bg-muted text-foreground'
              )}
              disabled={record.type === 'files' && !canRenderFileAsMarkdown(record.record)}
              onClick={() => handleMarkdownClick(record)}
            >
              Markdown
            </button>
            {record.type === 'extracts' && (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
                disabled={downloadingId === record.record.id}
                onClick={() => handleExportExtractJson(record.record)}
              >
                <Code2 className="h-4 w-4" />
                导出 JSON
              </button>
            )}
            <button
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => handleDownloadDetail(record)}
            >
              <Download className="h-4 w-4" />
              下载
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            文件管理 / {tabs.find(t => t.key === record.type)?.label}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {getDetailTitle(record)}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">文件信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">类型</p>
                <p className="mt-1 font-medium">{tabs.find(t => t.key === record.type)?.label}</p>
              </div>
              <div>
                <p className="text-muted-foreground">创建时间</p>
                <p className="mt-1 font-medium">
                  {formatDate(
                    record.type === 'files'
                      ? record.record.created_at
                      : record.type === 'extracts'
                        ? record.record.created_at
                        : record.type === 'simulates'
                          ? record.record.created_at
                          : record.record.created_at
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">内容摘要</p>
                <p className="mt-2 leading-6 text-foreground">
                  {compactText(getRecordMarkdown(record), '原始文件请使用右侧预览查看。')}
                </p>
              </div>
              <button
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
                onClick={() =>
                  setConfirmAction({
                    title: '确认删除',
                    message: `确定删除「${getDetailTitle(record)}」？`,
                    onConfirm: () => handleDelete(record),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">完整内容预览</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(
                  record.type === 'files'
                    ? record.record.created_at
                    : record.type === 'extracts'
                      ? record.record.created_at
                      : record.type === 'simulates'
                        ? record.record.created_at
                        : record.record.created_at
                )}
              </div>
            </CardHeader>
            <CardContent>{renderDetailContent(record)}</CardContent>
          </Card>
        </div>
      </div>
    </WorkbenchLayout>
  );

  if (detail) return renderDetailPage(detail);

  return (
    <WorkbenchLayout>
      <div className="w-full space-y-6">
        <PageHeader title="文件管理" description="统一管理上传文件、提取结果、模拟标书与开标报告" />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {tabs.map(tab => {
            const value =
              tab.key === 'files'
                ? stats.files
                : tab.key === 'extracts'
                  ? stats.extract_results
                  : tab.key === 'simulates'
                    ? stats.simulate_tasks
                    : stats.opening_results;
            return (
              <Card key={tab.key} className="rounded-2xl">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <tab.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
                    <p className="text-sm text-muted-foreground">{tab.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => handleTabChange(tab.key)}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchKeyword}
                  onChange={event => setSearchKeyword(event.target.value)}
                  placeholder="搜索文件名、项目名或关键词..."
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <select
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                value={fileTypeFilter}
                onChange={event => setFileTypeFilter(event.target.value)}
                disabled={activeTab !== 'files'}
              >
                <option value="">全部类型</option>
                <option value="pdf">PDF</option>
                <option value="md">Markdown</option>
                <option value="docx">Word</option>
                <option value="xlsx">Excel</option>
                <option value="csv">CSV</option>
              </select>
              <select
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                disabled={activeTab !== 'simulates'}
              >
                <option value="">全部状态</option>
                {Object.entries(statusMap).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.text}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                value={timeFilter}
                onChange={event => setTimeFilter(event.target.value)}
              >
                <option value="all">全部时间</option>
                <option value="7d">最近 7 天</option>
                <option value="30d">最近 30 天</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                当前展示 <strong className="text-foreground">{currentCount}</strong> 条
                {searchKeyword ? `，关键词：${searchKeyword}` : ''}
              </span>
              {activeTab === 'files' && currentCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={toggleAllFilteredFiles}
                  >
                    {filteredFiles.length > 0 && filteredFiles.every(file => selectedFiles.has(file.id))
                      ? '取消全选'
                      : '全选当前'}
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    disabled={selectedFiles.size === 0 || batchDownloading}
                    onClick={handleBatchDownloadFiles}
                  >
                    <Archive className="h-4 w-4" />
                    批量下载{selectedFiles.size > 0 ? `（${selectedFiles.size}）` : ''}
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    disabled={selectedFiles.size === 0}
                    onClick={() =>
                      setConfirmAction({
                        title: '批量删除文件',
                        message: `确定删除选中的 ${selectedFiles.size} 个文件？`,
                        onConfirm: handleBatchDeleteFiles,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    批量删除{selectedFiles.size > 0 ? `（${selectedFiles.size}）` : ''}
                  </button>
                </div>
              )}
              {activeTab !== 'files' && currentCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={toggleAllCurrentResults}
                  >
                    {currentResultsAllSelected() ? '取消全选' : '全选当前'}
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    disabled={getSelectionState().size === 0 || batchDownloading}
                    onClick={handleBatchDownload}
                  >
                    <Archive className="h-4 w-4" />
                    批量下载{getSelectionState().size > 0 ? `（${getSelectionState().size}）` : ''}
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    disabled={getSelectionState().size === 0}
                    onClick={() =>
                      setConfirmAction({
                        title: '批量删除结果',
                        message: `确定删除选中的 ${getSelectionState().size} 条结果？`,
                        onConfirm: handleBatchDeleteResults,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    批量删除{getSelectionState().size > 0 ? `（${getSelectionState().size}）` : ''}
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {downloadError && (
          <div className="flex items-center justify-between rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            <span>{downloadError}</span>
            <button
              className="rounded p-1 hover:bg-destructive/10"
              onClick={() => setDownloadError(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {renderGrid()}

        {quickPreview && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
            <div className="h-full w-full max-w-2xl border-l border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <p className="text-xs text-muted-foreground">快速预览</p>
                  <h3 className="mt-1 max-w-lg truncate text-lg font-semibold text-foreground">
                    {getDetailTitle(quickPreview)}
                  </h3>
                </div>
                <button
                  className="rounded-full p-2 hover:bg-muted"
                  onClick={() => setQuickPreview(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium',
                      !markdownMode
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                    onClick={() => setMarkdownMode(false)}
                  >
                    原文
                  </button>
                  <button
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50',
                      markdownMode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                    disabled={quickPreview.type === 'files' && !canRenderFileAsMarkdown(quickPreview.record)}
                    onClick={() => handleMarkdownClick(quickPreview)}
                  >
                    Markdown
                  </button>
                </div>
                <button
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => openDetail(quickPreview)}
                >
                  打开详情
                </button>
              </div>
              <div className="h-[calc(100vh-8.5rem)] overflow-auto p-5">
                {renderDetailContent(quickPreview)}
              </div>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-foreground">{confirmAction.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {confirmAction.message}
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => setConfirmAction(null)}
                >
                  取消
                </button>
                <button
                  className="rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WorkbenchLayout>
  );
}

function generateExtractMarkdown(result: ExtractResultRecord): string {
  return result.content || '';
}
