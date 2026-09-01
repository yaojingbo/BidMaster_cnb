'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Upload,
  Loader2,
  CheckCircle,
  Copy,
  Download,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/auth-fetch';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSettingsStore } from '@/stores/settings-store';
import { TaskProgress } from '@/components/ui/TaskProgress';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { getModulesFromColumns } from './column-module-map';
import { EvalRuleCard, type EvalRuleConfig } from '@/components/statistics/EvalRuleCard';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFileStore } from '@/stores/file-store';
import { useTaskStore } from '@/stores/task-store';
import { useAuthStore } from '@/stores/auth-store';
import { downloadMarkdownPdf } from '@/lib/report-download';

interface AvailableModule {
  key: string;
  label: string;
  available: boolean;
  description: string;
}

// 综合分析默认在所有文件中可用
const COMPREHENSIVE_MODULE: AvailableModule = {
  key: 'comprehensive',
  label: '综合分析 (AI)',
  available: true,
  description: 'AI 对分析结果进行综合解读与策略建议',
};

const statisticsPhases = [
  { key: 'connecting', label: '连接服务' },
  { key: 'analyzing', label: 'AI 分析' },
  { key: 'generating', label: '生成报告' },
];

const deriveStatisticsPhase = (percentage: number | null) => {
  if (percentage == null || percentage < 10) return 'connecting';
  if (percentage < 85) return 'analyzing';
  return 'generating';
};

interface AnalysisResult {
  bidder_count: number;
  meta: {
    project_name: string;
    bid_number: string;
    max_price: number | null;
    benchmark_price: number | null;
    d_value: number | null;
  };
  requested_modules: string[];
  bid_ranking: Array<{
    rank: number;
    name: string;
    price: number;
    deviation_pct: number;
    gap_from_lowest: number;
  }> | null;
  final_ranking: Array<{
    rank: number;
    name: string;
    price: number;
    deviation_pct: number;
    gap_from_lowest: number;
  }> | null;
  discount_results: Array<{
    name: string;
    bid_price: number;
    final_price: number;
    discount_amount: number;
    discount_pct: number;
    strategy: string;
  }> | null;
  bid_stats: {
    max: number;
    min: number;
    mean: number;
    std_dev: number;
    cv: number;
    cv_level: string;
    range: number;
    count: number;
  } | null;
  final_stats: {
    max: number;
    min: number;
    mean: number;
    std_dev: number;
    cv: number;
    cv_level: string;
    range: number;
    count: number;
  } | null;
  tiers: Record<string, Array<{ name: string; price: number; deviation_pct: number }>> | null;
  score_ranking: Array<{
    rank: number;
    name: string;
    credit_score: number;
    technical_score: number;
    commercial_score: number;
    total_score: number;
  }> | null;
  benchmark_comparison: Array<{
    name: string;
    price: number;
    deviation_from_benchmark: number;
    deviation_pct: number;
    below_benchmark: boolean;
    total_score: number;
    max_price?: number;
    ratio_to_max_pct?: number;
  }> | null;
  benchmark_calculation?: {
    method?: string;
    method_label?: string;
    price_field?: string;
    source?: string;
    benchmark?: number | null;
    error?: string;
    sheet_benchmark?: number | null;
    inputs?: Record<string, unknown>;
    steps?: Array<{ step: string; detail: string; numbers?: unknown[] }>;
    excluded?: Array<{ name: string; price: number | null; reason: string }>;
  };
  benchmark_basis?: {
    effective: number;
    computed: number | null;
    sheet: number | null;
    origin: 'computed' | 'sheet';
  };
}

export default function StatisticsPage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const [selectAllModules, setSelectAllModules] = useState(false);
  const [availableModules, setAvailableModules] = useState<AvailableModule[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  // 规则选择持久化到 localStorage：页面刷新/重新上传文件都不丢，避免用户误以为没生效
  const EVAL_RULE_KEY = 'bm-statistics-evalRule';
  const [evalRule, setEvalRule] = useState<EvalRuleConfig | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(EVAL_RULE_KEY);
      return raw ? (JSON.parse(raw) as EvalRuleConfig) : null;
    } catch {
      return null;
    }
  });
  const persistEvalRule = (rule: EvalRuleConfig | null) => {
    setEvalRule(rule);
    try {
      localStorage.setItem(EVAL_RULE_KEY, JSON.stringify(rule));
    } catch { /* 忽略存储失败 */ }
  };
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState('comprehensive');
  const { activeProvider, activeModel } = useSettingsStore();
  const [uploadedFile, setUploadedFile] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [aiContent, setAiContent] = useState('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiPercentage, setAiPercentage] = useState<number | null>(null);
  const [analysisTaskId, setAnalysisTaskId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadedFileRef = useRef<File | null>(null);

  // 两级选择状态
  const [selectionStep, setSelectionStep] = useState<1 | 2>(1);

  // AI 分析进度模拟（轮询模式无真实百分比，用时间模拟递增）
  useEffect(() => {
    if (!aiStreaming) return;
    setAiPercentage(prev => (prev === 100 ? 100 : 5));
    const timer = setInterval(() => {
      setAiPercentage(prev => {
        if (prev === null) return 5;
        if (prev >= 90) return prev;
        return Math.min(prev + Math.random() * 3 + 1, 90);
      });
    }, 800);
    return () => clearInterval(timer);
  }, [aiStreaming]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [parsedMeta, setParsedMeta] = useState<Record<string, unknown>>({});

  const getAvailableModulesList = () => [
    ...availableModules.filter(m => m.key !== 'comprehensive'),
    ...(availableModules.some(m => m.key === 'comprehensive') ? [] : [COMPREHENSIVE_MODULE]),
  ];

  const allAvailableKeys = () => availableModules.filter(m => m.available).map(m => m.key);

  // ===========================================================================
  // 持久化：分析结果和 AI 流式状态跨页面保存
  // ===========================================================================

  // 同步状态到 taskStore（防抖，避免高频 localStorage 写入）
  const statSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (result || aiContent || aiStreaming || uploadedFile || analysisTaskId) {
      if (statSyncTimerRef.current) clearTimeout(statSyncTimerRef.current);
      statSyncTimerRef.current = setTimeout(() => {
        useTaskStore.getState().updateStatistics({
          result,
          aiContent,
          aiStreaming,
          uploadedFile,
          analysisTaskId,
        });
      }, 200);
    }
    return () => {
      if (statSyncTimerRef.current) clearTimeout(statSyncTimerRef.current);
    };
  }, [result, aiContent, aiStreaming, uploadedFile, analysisTaskId]);

  // 页面挂载时：恢复上次的分析结果和 AI 内容
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    const saved = useTaskStore.getState().statistics;
    if (!saved) return;

    if (saved.result) setResult(saved.result as AnalysisResult);
    if (saved.uploadedFile) setUploadedFile(saved.uploadedFile);
    if (saved.aiContent) setAiContent(saved.aiContent);

    // 如果之前 AI 分析正在进行且有 taskId，启动轮询恢复
    if (saved.aiStreaming && saved.analysisTaskId) {
      setAnalysisTaskId(saved.analysisTaskId);
      setAiStreaming(true);
      setActiveTab('comprehensive');
      pollAnalysisTask(saved.analysisTaskId);
    } else {
      setAiStreaming(false);
      if (saved.result) {
        const firstModule = saved.result.requested_modules?.[0];
        if (firstModule) setActiveTab(firstModule);
      }
    }

    // 如果已有 AI 内容（分析已完成），切到综合分析 tab
    if (saved.aiContent && !saved.aiStreaming) {
      setActiveTab('comprehensive');
    }
  }, [authReady, isAuthenticated]);

  const pollAnalysisTask = useCallback((taskId: string) => {
    let attempts = 0;
    const maxAttempts = 100; // 3s * 100 = 5 min
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setAiStreaming(false);
        setAiContent(prev => prev + '\n⏱ 轮询超时，请重新执行分析\n');
        setAnalysisTaskId(null);
        return;
      }
      try {
        const res = await authFetch(`/api/statistics/analysis-task/${taskId}`);
        if (!res.ok) {
          clearInterval(interval);
          setAiStreaming(false);
          setAnalysisTaskId(null);
          return;
        }
        const json = await res.json();
        const record = json.data;
        if (record.status === 'completed') {
          clearInterval(interval);
          setAiPercentage(100);
          setAiContent(record.ai_analysis || 'AI 综合分析已完成，暂无报告内容');
          setAiStreaming(false);
          setAnalysisTaskId(null);
          useTaskStore.getState().updateStatistics({
            result,
            aiContent: record.ai_analysis || 'AI 综合分析已完成，暂无报告内容',
            aiStreaming: false,
            uploadedFile,
            analysisTaskId: null,
          });
        } else if (record.status === 'error') {
          clearInterval(interval);
          setAiPercentage(null);
          const errMsg = record.ai_analysis || '分析出错，请重试';
          setAiContent(errMsg);
          setAiStreaming(false);
          setAnalysisTaskId(null);
          useTaskStore.getState().updateStatistics({
            result,
            aiContent: errMsg,
            aiStreaming: false,
            uploadedFile,
            analysisTaskId: null,
          });
        }
        // status === "running" or "partial" → continue polling
      } catch {
        // network error, keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const { upload } = useFileUpload();

  const handleModuleToggle = (key: string) => {
    setSelectedModules(prev => {
      const next = prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key];
      const availKeys = allAvailableKeys();
      setSelectAllModules(
        next.length >= availKeys.length && availKeys.every(k => next.includes(k))
      );
      return next;
    });
  };

  const handleSelectAllModules = (checked: boolean) => {
    setSelectAllModules(checked);
    if (checked) {
      const avail = allAvailableKeys();
      setSelectedModules(avail);
    } else {
      setSelectedModules([]);
    }
  };

  // 解析文件表头，获取可用分析维度
  const parseFileForModules = async (file: File) => {
    setParsing(true);
    setParseError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await authFetch('/api/statistics/parse', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.detail || `解析失败 (HTTP ${res.status})`);
        return;
      }
      if (data.success && data.data) {
        const headers: string[] = data.data.raw_headers || [];
        const mapping: Record<string, string> = data.data.column_mapping || {};
        const meta = data.data.meta || {};

        setRawHeaders(headers);
        setColumnMapping(mapping);
        setSelectedColumns(headers);
        setParsedMeta(meta);

        if (headers.length > 0) {
          setSelectionStep(1);
        } else if (data.data.available_modules) {
          const modules: AvailableModule[] = data.data.available_modules;
          setAvailableModules(modules);
          const availKeys = modules.filter(m => m.available).map(m => m.key);
          setSelectedModules(availKeys);
          setSelectAllModules(true);
          setSelectionStep(2);
        } else {
          setParseError('未能检测到数据表头，请检查文件格式（需要包含「投标人」和「报价」相关列）');
        }
      } else {
        setParseError(data.detail || '文件解析失败，请检查文件格式是否正确');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '网络请求失败，请检查后端服务是否运行');
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!requireAuth()) {
      e.target.value = '';
      return;
    }
    uploadedFileRef.current = file;
    e.target.value = '';

    // 用户新上传文件时清除上次分析结果
    setResult(null);
    setAiContent('');
    setAvailableModules([]);
    setSelectedModules([]);
    setSelectAllModules(false);
    setRawHeaders([]);
    setColumnMapping({});
    setSelectedColumns([]);
    setParsedMeta({});
    setParseError(null);
    setSelectionStep(1);
    useTaskStore.getState().clearStatistics();

    // 同时：上传到后端 + 解析表头获取可用维度
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'opening');

    // 上传文件（获取 fileId 用于后续分析）
    try {
      const res = await authFetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.id || data.success) {
        setUploadedFile({
          id: data.id || data.data?.id || `file-${Date.now()}`,
          name: file.name,
        });
      } else {
        setUploadedFile({ id: `local-${Date.now()}`, name: file.name });
      }
    } catch {
      setUploadedFile({ id: `local-${Date.now()}`, name: file.name });
    }

    // 解析表头，动态生成可用分析维度
    await parseFileForModules(file);
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
    uploadedFileRef.current = file;

    setResult(null);
    setAiContent('');
    setAvailableModules([]);
    setSelectedModules([]);
    setSelectAllModules(false);
    setRawHeaders([]);
    setColumnMapping({});
    setSelectedColumns([]);
    setParsedMeta({});
    setParseError(null);
    setSelectionStep(1);
    useTaskStore.getState().clearStatistics();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'opening');

    try {
      const res = await authFetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.id || data.success) {
        setUploadedFile({
          id: data.id || data.data?.id || `file-${Date.now()}`,
          name: file.name,
        });
      } else {
        setUploadedFile({ id: `local-${Date.now()}`, name: file.name });
      }
    } catch {
      setUploadedFile({ id: `local-${Date.now()}`, name: file.name });
    }

    await parseFileForModules(file);
  };

  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleAnalyze = async (modulesOverride?: string[]) => {
    if (!requireAuth()) return;
    if (!uploadedFile) return;
    let modulesToUse = modulesOverride || selectedModules;
    if (modulesToUse.length === 0) return;
    // 配置了评标规则时，强制启用「基准价」模块（即使表格没有基准价行）
    if (evalRule && !modulesToUse.includes('benchmark')) {
      modulesToUse = [...modulesToUse, 'benchmark'];
    }
    setLoading(true);
    setResult(null);
    setAiContent('');
    setAnalyzeError(null);
    useTaskStore.getState().clearStatistics();

    // 优先使用直接上传分析（更可靠，不依赖 fileId 在加密存储中存在）
    const file = uploadedFileRef.current;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('modules', JSON.stringify(modulesToUse));
      if (evalRule) formData.append('evalRule', JSON.stringify(evalRule));
      try {
        const res = await authFetch('/api/statistics/analyze/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success && data.data) {
          setResult(data.data);
          setActiveTab(data.data.bid_ranking?.length ? 'bid_ranking' : 'statistics');
          return;
        }
        setAnalyzeError(data.detail || '分析失败，请检查文件格式');
      } catch (err) {
        setAnalyzeError(err instanceof Error ? err.message : '分析请求失败');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 如果没有文件引用，尝试用 fileId
    if (!uploadedFile.id.startsWith('local-') && !uploadedFile.id.startsWith('file-')) {
      try {
        const res = await authFetch('/api/statistics/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: uploadedFile.id,
            modules: modulesToUse,
            evalRule: evalRule ?? undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setResult(data.data);
          setActiveTab(data.data.bid_ranking?.length ? 'bid_ranking' : 'statistics');
        } else {
          setAnalyzeError(data.detail || '分析失败，请重新上传文件后重试');
        }
      } catch (err) {
        setAnalyzeError(err instanceof Error ? err.message : '分析请求失败，请重新上传文件后重试');
      }
    } else {
      setAnalyzeError('文件引用已失效，请重新上传文件后重试');
    }
    setLoading(false);
  };

  const handleComprehensive = async () => {
    if (!requireAuth()) return;
    if (!result || !uploadedFile) return;

    setAiContent('');
    setAiPercentage(5);
    setAiStreaming(true);
    setActiveTab('comprehensive');

    try {
      let res: Response;
      const file = uploadedFileRef.current;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('modules', JSON.stringify(selectedModules));
        if (evalRule) formData.append('evalRule', JSON.stringify(evalRule));
        formData.append('provider', activeProvider);
        formData.append('model', activeModel);
        res = await authFetch('/api/statistics/analyze/comprehensive/upload/start', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await authFetch('/api/statistics/analyze/comprehensive/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: uploadedFile.id,
            modules: selectedModules,
            evalRule: evalRule ?? undefined,
            provider: activeProvider,
            model: activeModel,
          }),
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const taskId = data.task_id;
      if (data.cached) {
        setAiContent('已复用同一原始文件的历史 AI 综合分析结果，正在加载内容...');
      }

      setAnalysisTaskId(taskId);
      // 立即持久化，确保切走后能恢复
      useTaskStore.getState().updateStatistics({
        result,
        aiContent: data.cached ? '已复用同一原始文件的历史 AI 综合分析结果，正在加载内容...' : '',
        aiStreaming: true,
        uploadedFile,
        analysisTaskId: taskId,
      });

      // 启动轮询
      pollAnalysisTask(taskId);
    } catch (err) {
      setAiContent(`失败: ${err instanceof Error ? err.message : '未知错误'}\n`);
      setAiStreaming(false);
    }
  };

  const handleCopy = () => navigator.clipboard.writeText(aiContent);
  const handleDownload = () => {
    const blob = new Blob([aiContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comprehensive_analysis.md';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
  const handleDownloadPdf = async () => {
    if (!aiContent.trim() || aiStreaming || isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      await downloadMarkdownPdf(aiContent, 'comprehensive_analysis.pdf', {
        title: '开标分析综合报告',
        sourceType: 'opening_analysis',
        metadata: {
          project_name: result?.meta?.project_name,
          bid_number: result?.meta?.bid_number,
          bidder_count: result?.bidder_count,
        },
      });
    } catch {
      alert('PDF 生成失败，请稍后重试或先下载 Markdown。');
    } finally {
      setIsPdfExporting(false);
    }
  };

  const hasPreview = aiContent || aiStreaming || result;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">正在分析开标数据...</p>
      </div>
    );
  }

  return (
    <WorkbenchLayout>
      <div className="w-full space-y-6">
        <PageHeader
          title="开标分析"
          description="智能解析开标一览表，自动计算报价排名、降价幅度、离散系数"
        />

        <ResizableSplit
          storageKey="statistics-split-width"
          left={(
            <div className="space-y-5">
            {/* 文件上传 */}
            <input
              type="file"
              id="statistics-file-input"
              ref={fileInputRef}
              className="file-sr-only"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
            />
            <label
              htmlFor="statistics-file-input"
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
                <p className="text-lg font-medium">点击或拖拽开标数据文件</p>
                <p className="text-sm text-muted-foreground">支持 Excel (.xlsx/.xls) 和 CSV 格式</p>
              </div>
              {uploadedFile && (
                <p className="mt-3 text-sm text-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  已选择: {uploadedFile.name}
                </p>
              )}
            </label>

            {/* 列选择：勾选后直接分析 */}
            {uploadedFile && rawHeaders.length > 0 && !result && (
              <div className="rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium">选择分析要素</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      检测到以下表头列，请勾选需要参与分析的数据要素
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedColumns.length === rawHeaders.length}
                      onChange={e => setSelectedColumns(e.target.checked ? [...rawHeaders] : [])}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">全选</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {rawHeaders.map((header, idx) => (
                    <label
                      key={`${header}-${idx}`}
                      className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer text-sm border border-transparent hover:border-border transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(header)}
                        onChange={() => {
                          setSelectedColumns(prev =>
                            prev.includes(header)
                              ? prev.filter(h => h !== header)
                              : [...prev, header]
                          );
                        }}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">{header}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 等待解析 */}
            {uploadedFile && availableModules.length === 0 && parsing && (
              <div className="rounded-xl border border-border p-6 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">正在解析文件表头，检测可用分析维度...</span>
              </div>
            )}

            {/* 评标基准价设置：预设办法 / 贴原文解析（specs/pm/opening-analysis-eval-rule-prd.md） */}
            {uploadedFile && rawHeaders.length > 0 && (
              <EvalRuleCard
                value={evalRule}
                onChange={persistEvalRule}
                parsedMeta={parsedMeta as { benchmark_price?: number | null; max_price?: number | null; d_value?: number | null }}
              />
            )}

            {/* 开始/重新分析按钮 */}
            {uploadedFile && rawHeaders.length > 0 && (
              <button
                onClick={() => {
                  const selectedInternal = selectedColumns
                    .map(col => columnMapping[col])
                    .filter(Boolean);
                  const modules = getModulesFromColumns(
                    selectedInternal,
                    parsedMeta as { benchmark_price?: number | null; max_price?: number | null },
                    !!evalRule,
                  );
                  const availKeys = modules.filter(m => m.available).map(m => m.key);
                  setSelectedModules(availKeys);
                  setAvailableModules(modules);
                  handleAnalyze(availKeys);
                }}
                disabled={selectedColumns.length === 0 || loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <BarChart3 className="h-5 w-5" />
                )}
                {result ? '重新分析（按当前规则重算）' : '开始分析'}
              </button>
            )}

            {/* 解析失败提示 */}
            {parseError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive mb-1">文件解析失败</p>
                    <p className="text-destructive/80">{parseError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 分析失败提示 */}
            {analyzeError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive mb-1">分析失败</p>
                    <p className="text-destructive/80">{analyzeError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 分析结果 */}
            {result && (
              <div className="space-y-6">
                {/* 概要信息 */}
                <div className="rounded-xl border border-border p-6 bg-primary/5">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      {result.bidder_count} 家投标单位
                    </span>
                    <span className="text-sm">项目: {result.meta.project_name || '未知'}</span>
                    <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm">
                      已选 {result.requested_modules?.length || selectedModules.length} 个维度
                    </span>
                  </div>
                </div>

                {/* Tab 导航 */}
                <div className="flex border-b gap-0 overflow-x-auto">
                  {[
                    ...getAvailableModulesList().filter(tab => selectedModules.includes(tab.key)),
                    COMPREHENSIVE_MODULE,
                  ].map(tab => (
                    <button
                      key={tab.key}
                      className={cn(
                        'px-3 py-2 text-sm border-b-2 -mb-[1px] transition-colors whitespace-nowrap',
                        activeTab === tab.key
                          ? 'border-primary text-foreground font-medium'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab 内容 */}
                <div>
                  {/* 投标价排名 */}
                  {activeTab === 'bid_ranking' && result.bid_ranking && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-3 text-left">排名</th>
                              <th className="p-3 text-left">投标人</th>
                              <th className="p-3 text-right">报价(万元)</th>
                              <th className="p-3 text-right">偏离均值(%)</th>
                              <th className="p-3 text-right">与最低价差额</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.bid_ranking.map(item => (
                              <tr key={item.rank} className="border-t">
                                <td className="p-3">
                                  <span
                                    className={cn(
                                      'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs',
                                      item.rank === 1
                                        ? 'bg-primary/10 text-primary'
                                        : item.rank === 2
                                          ? 'bg-muted text-muted-foreground'
                                          : item.rank === 3
                                            ? 'bg-warning/10 text-warning'
                                            : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {item.rank}
                                  </span>
                                </td>
                                <td className="p-3 font-medium">{item.name}</td>
                                <td className="p-3 text-right">{item.price.toLocaleString()}</td>
                                <td className="p-3 text-right">
                                  <span
                                    className={
                                      item.deviation_pct > 0 ? 'text-destructive' : 'text-success'
                                    }
                                  >
                                    {item.deviation_pct > 0 ? '+' : ''}
                                    {item.deviation_pct}%
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {item.gap_from_lowest.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 横向柱状图 */}
                      <div className="rounded-xl border border-border p-6">
                        <h3 className="font-semibold mb-3">投标价分布图</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={result.bid_ranking}
                            layout="vertical"
                            margin={{ left: 80 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={80} />
                            <Tooltip formatter={v => `${Number(v).toLocaleString()}万`} />
                            <Bar dataKey="price" name="报价" radius={[0, 4, 4, 0]}>
                              {result.bid_ranking.map((entry, index) => (
                                <Cell key={index} fill={index === 0 ? '#d4727a' : '#c9a0a4'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* 最终报价排名 */}
                  {activeTab === 'final_ranking' && (
                    <div className="space-y-4">
                      {result.final_ranking ? (
                        <>
                          <div className="rounded-xl border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="p-3 text-left">排名</th>
                                  <th className="p-3 text-left">投标人</th>
                                  <th className="p-3 text-right">最终报价(万元)</th>
                                  <th className="p-3 text-right">偏离均值(%)</th>
                                  <th className="p-3 text-right">与最低价差额</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.final_ranking.map(item => (
                                  <tr key={item.rank} className="border-t">
                                    <td className="p-3">
                                      <span
                                        className={cn(
                                          'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs',
                                          item.rank === 1
                                            ? 'bg-primary/10 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                        )}
                                      >
                                        {item.rank}
                                      </span>
                                    </td>
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3 text-right">
                                      {item.price.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">
                                      <span
                                        className={
                                          item.deviation_pct > 0
                                            ? 'text-destructive'
                                            : 'text-success'
                                        }
                                      >
                                        {item.deviation_pct > 0 ? '+' : ''}
                                        {item.deviation_pct}%
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      {item.gap_from_lowest.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="rounded-xl border border-border p-6">
                            <h3 className="font-semibold mb-3">最终报价分布图</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                data={result.final_ranking}
                                layout="vertical"
                                margin={{ left: 80 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={80} />
                                <Tooltip formatter={v => `${Number(v).toLocaleString()}万`} />
                                <Bar
                                  dataKey="price"
                                  name="最终报价"
                                  fill="#a8787e"
                                  radius={[0, 4, 4, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">
                          暂无数据（需要备注栏含最终报价信息）
                        </div>
                      )}
                    </div>
                  )}

                  {/* 降价分析 */}
                  {activeTab === 'discount' && (
                    <div className="space-y-4">
                      {result.discount_results?.length ? (
                        <>
                          <div className="rounded-xl border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="p-3 text-left">投标人</th>
                                  <th className="p-3 text-right">投标价</th>
                                  <th className="p-3 text-right">最终报价</th>
                                  <th className="p-3 text-right">降价额</th>
                                  <th className="p-3 text-right">降幅</th>
                                  <th className="p-3 text-center">策略</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.discount_results.map((item, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3 text-right">
                                      {item.bid_price.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">
                                      {item.final_price.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">
                                      {item.discount_amount.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">{item.discount_pct}%</td>
                                    <td className="p-3 text-center">
                                      <span
                                        className={cn(
                                          'px-2 py-1 rounded text-xs',
                                          item.strategy === '激进'
                                            ? 'bg-destructive/10 text-destructive'
                                            : item.strategy === '适度'
                                              ? 'bg-warning/10 text-warning'
                                              : 'bg-primary/10 text-primary'
                                        )}
                                      >
                                        {item.strategy}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* 混合图 */}
                          <div className="rounded-xl border border-border p-6">
                            <h3 className="font-semibold mb-3">降价分析图</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <ComposedChart data={result.discount_results} margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" unit="%" />
                                <Tooltip />
                                <Legend />
                                <Bar
                                  yAxisId="left"
                                  dataKey="bid_price"
                                  name="投标价"
                                  fill="#d4727a"
                                />
                                <Bar
                                  yAxisId="left"
                                  dataKey="final_price"
                                  name="最终报价"
                                  fill="#a8787e"
                                />
                                <Line
                                  yAxisId="right"
                                  dataKey="discount_pct"
                                  name="降幅%"
                                  stroke="#d4727a"
                                  strokeWidth={2}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">
                          暂无降价数据（需要备注栏含最终报价信息）
                        </div>
                      )}
                    </div>
                  )}

                  {/* 统计分析 */}
                  {activeTab === 'statistics' && result.bid_stats && (
                    <div className="space-y-4">
                      {/* 投标价统计 */}
                      <div className="rounded-xl border border-border p-6">
                        <h3 className="font-semibold mb-3">投标价统计</h3>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                          {[
                            {
                              label: '最高',
                              value: result.bid_stats.max,
                              color: 'text-destructive',
                            },
                            { label: '最低', value: result.bid_stats.min, color: 'text-success' },
                            { label: '均值', value: result.bid_stats.mean },
                            { label: '标准差', value: result.bid_stats.std_dev },
                            {
                              label: '离散系数',
                              value: `${result.bid_stats.cv}%`,
                              extra: result.bid_stats.cv_level,
                            },
                            { label: '极差', value: result.bid_stats.range },
                          ].map(s => (
                            <div key={s.label} className="text-center">
                              <p className="text-xs text-muted-foreground">{s.label}</p>
                              <p className={cn('text-lg font-bold', s.color || '')}>
                                {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                              </p>
                              {s.extra && (
                                <span
                                  className={cn(
                                    'text-xs px-1 rounded',
                                    s.extra === '集中'
                                      ? 'bg-success/10 text-success'
                                      : s.extra === '中等'
                                        ? 'bg-warning/10 text-warning'
                                        : 'bg-destructive/10 text-destructive'
                                  )}
                                >
                                  {s.extra}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 梯队分布 */}
                      {result.tiers && (
                        <div className="rounded-xl border border-border p-6">
                          <h3 className="font-semibold mb-3">梯队分布</h3>
                          <div className="grid grid-cols-3 gap-4">
                            {Object.entries(result.tiers).map(([tier, members]) => (
                              <div key={tier} className="rounded-xl border border-border p-3">
                                <p className="text-sm font-medium mb-2">{tier}</p>
                                {members.length > 0 ? (
                                  <div className="space-y-1">
                                    {members.map(m => (
                                      <p key={m.name} className="text-xs text-muted-foreground">
                                        {m.name}: {m.price.toLocaleString()}万 ({m.deviation_pct}%)
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">无</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 最终报价统计 */}
                      {result.final_stats && (
                        <div className="rounded-xl border border-border p-6">
                          <h3 className="font-semibold mb-3">最终报价统计</h3>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                            {[
                              {
                                label: '最高',
                                value: result.final_stats.max,
                                color: 'text-destructive',
                              },
                              {
                                label: '最低',
                                value: result.final_stats.min,
                                color: 'text-success',
                              },
                              { label: '均值', value: result.final_stats.mean },
                              { label: '标准差', value: result.final_stats.std_dev },
                              {
                                label: '离散系数',
                                value: `${result.final_stats.cv}%`,
                                extra: result.final_stats.cv_level,
                              },
                              { label: '极差', value: result.final_stats.range },
                            ].map(s => (
                              <div key={s.label} className="text-center">
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className={cn('text-lg font-bold', s.color || '')}>
                                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                                </p>
                                {s.extra && (
                                  <span
                                    className={cn(
                                      'text-xs px-1 rounded',
                                      s.extra === '集中'
                                        ? 'bg-success/10 text-success'
                                        : s.extra === '中等'
                                          ? 'bg-warning/10 text-warning'
                                          : 'bg-destructive/10 text-destructive'
                                    )}
                                  >
                                    {s.extra}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 评分对比 */}
                  {activeTab === 'scores' && (
                    <div className="space-y-4">
                      {result.score_ranking?.length ? (
                        <>
                          <div className="rounded-xl border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="p-3 text-left">排名</th>
                                  <th className="p-3 text-left">投标单位</th>
                                  <th className="p-3 text-right">资信标</th>
                                  <th className="p-3 text-right">技术标</th>
                                  <th className="p-3 text-right">商务标</th>
                                  <th className="p-3 text-right font-bold">合计</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.score_ranking.map(item => (
                                  <tr key={item.rank} className="border-t">
                                    <td className="p-3">{item.rank}</td>
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3 text-right">{item.credit_score}</td>
                                    <td className="p-3 text-right">{item.technical_score}</td>
                                    <td className="p-3 text-right">{item.commercial_score}</td>
                                    <td className="p-3 text-right font-bold">{item.total_score}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* 堆叠柱状图 */}
                          <div className="rounded-xl border border-border p-6">
                            <h3 className="font-semibold mb-3">评分对比图</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                data={result.score_ranking}
                                layout="vertical"
                                margin={{ left: 80 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" unit="分" />
                                <YAxis dataKey="name" type="category" width={80} />
                                <Tooltip />
                                <Legend />
                                <Bar
                                  dataKey="credit_score"
                                  name="资信标"
                                  stackId="scores"
                                  fill="#d4727a"
                                />
                                <Bar
                                  dataKey="technical_score"
                                  name="技术标"
                                  stackId="scores"
                                  fill="#c9a0a4"
                                />
                                <Bar
                                  dataKey="commercial_score"
                                  name="商务标"
                                  stackId="scores"
                                  fill="#b08e92"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">
                          暂无评分数据（需要文件中包含评分信息）
                        </div>
                      )}
                    </div>
                  )}

                  {/* 基准价对比 */}
                  {activeTab === 'benchmark' && (
                    <div className="space-y-4">
                      {result.benchmark_comparison || result.benchmark_calculation ? (
                        <>
                          {/* 基准价信息（优先展示按办法计算所得，PRD §七） */}
                          <div className="rounded-xl border border-border p-6 bg-muted/50">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="px-3 py-1 bg-primary/10 text-primary rounded text-sm">
                                评标基准价{result.benchmark_basis?.origin === 'computed' ? '（按办法计算）' : ''}:{' '}
                                {(result.benchmark_basis?.effective ?? result.meta.benchmark_price)?.toLocaleString()}万
                              </span>
                              {result.benchmark_basis?.sheet != null && result.benchmark_basis.origin === 'computed' && (
                                <span className="px-3 py-1 bg-muted text-muted-foreground rounded text-sm">
                                  表内基准价:{' '}
                                  {result.benchmark_basis.sheet.toLocaleString()}万
                                </span>
                              )}
                              {result.benchmark_calculation?.error && (
                                <span className="px-3 py-1 bg-destructive/10 text-destructive rounded text-sm">
                                  规则计算失败：{result.benchmark_calculation.error}
                                </span>
                              )}
                              {result.meta.max_price && (
                                <span className="px-3 py-1 bg-destructive/10 text-destructive rounded text-sm">
                                  最高限价: {result.meta.max_price?.toLocaleString()}万
                                </span>
                              )}
                              {result.meta.d_value && (
                                <span className="px-3 py-1 bg-success/10 text-success rounded text-sm">
                                  D值: {result.meta.d_value}
                                </span>
                              )}
                            </div>
                          </div>

                          {result.benchmark_calculation && !result.benchmark_calculation.error && (
                            <div className="rounded-xl border border-border p-4 space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                计算过程对账{result.benchmark_calculation.method_label ? ` · ${result.benchmark_calculation.method_label}` : ''}
                                <span className="text-xs text-muted-foreground font-normal">
                                  （口径：{result.benchmark_calculation.price_field === 'final_price' ? '最终报价' : result.benchmark_calculation.price_field === 'bid_price' ? '初始投标价' : '自动选择'}）
                                </span>
                              </div>
                              {(result.benchmark_calculation.steps ?? []).map((s, i) => (
                                <div key={i} className="text-xs flex flex-wrap gap-x-2 gap-y-1">
                                  <span className="px-1.5 py-0.5 bg-muted rounded shrink-0">{s.step}</span>
                                  <span className="text-muted-foreground">{s.detail}</span>
                                  {s.numbers && s.numbers.length > 0 && (
                                    <span className="font-mono">{s.numbers.map(n => String(n)).join(' · ')}</span>
                                  )}
                                </div>
                              ))}
                              {(result.benchmark_calculation.excluded ?? []).length > 0 && (
                                <div className="pt-1 text-xs space-y-0.5">
                                  <div className="font-medium">剔除名单（共 {result.benchmark_calculation.excluded!.length} 家）：</div>
                                  {result.benchmark_calculation.excluded!.map((e, i) => (
                                    <div key={i} className="text-muted-foreground pl-3">
                                      · {e.name || '（名称缺失）'}{e.price != null ? `：${e.price}` : ''} —— {e.reason}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="rounded-xl border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="p-3 text-left">投标单位</th>
                                  <th className="p-3 text-right">报价(万元)</th>
                                  <th className="p-3 text-right">偏离基准价</th>
                                  <th className="p-3 text-right">偏离比例(%)</th>
                                  <th className="p-3 text-right">占限价比例(%)</th>
                                  <th className="p-3 text-right">合计得分</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(result.benchmark_comparison ?? []).map((item, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3 text-right">
                                      {item.price.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">
                                      {item.deviation_from_benchmark.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right">
                                      <span
                                        className={
                                          item.below_benchmark ? 'text-success' : 'text-destructive'
                                        }
                                      >
                                        {item.deviation_pct > 0 ? '+' : ''}
                                        {item.deviation_pct}%
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      {item.ratio_to_max_pct ? `${item.ratio_to_max_pct}%` : '-'}
                                    </td>
                                    <td className="p-3 text-right">{item.total_score || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-border p-6 text-center text-muted-foreground">
                          暂无基准价数据——可在分析前的「评标基准价设置」里选择办法让系统按规则计算，或需表格本身含基准价行
                        </div>
                      )}
                    </div>
                  )}

                  {/* 综合分析 */}
                  {activeTab === 'comprehensive' && (
                    <div className="space-y-4">
                      {!aiContent && !aiStreaming && (
                        <button
                          onClick={handleComprehensive}
                          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
                        >
                          <BarChart3 className="h-5 w-5" />
                          生成 AI 综合分析
                        </button>
                      )}

                      {aiStreaming && null}

                      {aiContent && null}
                    </div>
                  )}
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
                  任务执行后，开标分析报告会在这里实时展示
                </p>
              </div>
              {aiContent && (
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
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={aiStreaming || isPdfExporting}
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
              {aiStreaming && (
                <div className="mb-5">
                  <TaskProgress
                    phases={statisticsPhases}
                    currentPhase={deriveStatisticsPhase(aiPercentage)}
                    percentage={aiPercentage === 100 ? 100 : Math.min(aiPercentage ?? 0, 90)}
                    message={`AI 正在分析中（${activeProvider}/${activeModel || 'default'}），大文件可能需要更长时间...`}
                    isActive={aiStreaming && aiPercentage !== 100}
                    isDone={aiPercentage === 100 && !aiStreaming}
                    showStop
                    onStop={() => {
                      abortRef.current?.abort();
                      setAiStreaming(false);
                    }}
                  />
                </div>
              )}

              {aiContent ? (
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="border-b border-border bg-muted/50 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">AI 综合分析</span>
                  </div>
                  <div className="p-4">
                    <div
                      className={cn(
                        'markdown-body text-sm leading-relaxed',
                        !showMarkdownPreview && 'whitespace-pre-wrap'
                      )}
                    >
                      {showMarkdownPreview ? <MarkdownPreview content={aiContent} /> : aiContent}
                    </div>
                  </div>
                </div>
              ) : hasPreview ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">等待生成 AI 综合分析</p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    左侧完成开标数据分析后，可生成 AI 综合分析并在右侧预览。
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">等待生成开标分析结果</p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    左侧上传开标数据文件并开始分析后，结果会在页面中展示。
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
