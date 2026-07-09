'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  FileSearch,
  BarChart3,
  Shield,
  Loader2,
  Copy,
  Download,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { PageHeader } from '@/components/layout/PageHeader';
import { TabNavigation } from '@/components/ui/TabNavigation';
import { TaskProgress } from '@/components/ui/TaskProgress';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFileStore } from '@/stores/file-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { mockFiles } from '@/data/mock/providers';
import { listFiles } from '@/lib/data-api';
import { downloadMarkdownPdf } from '@/lib/report-download';
import {
  clearExtractTask,
  runExtractTask,
  stopExtractTask,
  subscribeExtractTask,
} from '@/lib/extract-runner';

// 提取阶段定义
const extractPhases = [
  { key: 'reading', label: '读取文档', icon: FileText },
  { key: 'parsing', label: '解析内容', icon: FileSearch },
  { key: 'analyzing', label: 'AI 分析', icon: Sparkles },
  { key: 'extracting', label: '提取要素', icon: CheckCircle2 },
];

// 要素类别
const elementCategories = [
  {
    group: '基本信息',
    items: [{ id: 'basic_info', label: '项目基本信息' }],
  },
  {
    group: '门槛要求',
    items: [
      { id: 'qualification', label: '资质要求' },
      { id: 'experience', label: '业绩要求' },
      { id: 'personnel', label: '人员要求' },
    ],
  },
  {
    group: '评标办法',
    items: [
      { id: 'evaluation_method', label: '评标办法' },
      { id: 'scoring_details', label: '分值分配与评分细则' },
    ],
  },
  {
    group: '商务条款',
    items: [
      { id: 'selection_method', label: '定标方法' },
      { id: 'contract_terms', label: '合同条款' },
    ],
  },
];

const allElementIds = elementCategories.flatMap(g => g.items.map(i => i.id));

const outputTemplates = [
  { value: 'standard', label: '标准要素' },
  { value: 'brief', label: '简版速查' },
];

interface ExtractedElement {
  name: string;
  content: string;
}

const isRealReadyFile = (file: { id: string; status: string }) =>
  file.status === 'ready' && !file.id.startsWith('temp-');

export default function ExtractPage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('single');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [selectedElements, setSelectedElements] = useState<string[]>(allElementIds);
  const [selectAll, setSelectAll] = useState(true);
  const [thresholdText, setThresholdText] = useState('');

  // SSE 进度状态
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [extractedElements, setExtractedElements] = useState<ExtractedElement[]>([]);
  const [streamRawText, setStreamRawText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [percentage, setPercentage] = useState<number | null>(null);

  useEffect(() => {
    return subscribeExtractTask(saved => {
      if (!saved) return;

      if (saved.selectedFileId?.startsWith('temp-')) {
        clearExtractTask();
        setErrorMessage('文件上传未完成，请重新上传后再提取');
        setIsStreaming(false);
        return;
      }

      if (saved.selectedFileId) setSelectedFileId(saved.selectedFileId);
      setActiveTab(saved.activeTab);
      setIsStreaming(saved.isStreaming);
      setCurrentPhase(saved.currentPhase);
      setProgressMessage(saved.progressMessage);
      setExtractedElements(saved.extractedElements);
      setStreamRawText(saved.streamRawText);
      setIsDone(saved.isDone);
      setErrorMessage(saved.errorMessage);
      setPercentage(saved.percentage ?? null);
    });
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload } = useFileUpload({
    onSuccess: fileId => setSelectedFileId(fileId),
  });
  const { files, addFile } = useFileStore();
  const { activeProvider, activeModel, ocrEngine } = useSettingsStore();

  // 从后端加载真实文件列表
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    listFiles({ page: 1, page_size: 50 })
      .then(res => {
        const backendIds: string[] = [];
        // 将后端文件同步到 fileStore（用于 extract 页面选择文件）
        for (const f of res.files) {
          backendIds.push(f.id);
          addFile({
            id: f.id,
            name: f.original_name,
            size: f.size,
            mimeType: f.type,
            category: 'tender',
            status: 'ready',
            createdAt: f.created_at || new Date().toISOString(),
          });
        }
        // 清除后端已不存在的文件（可能从数据库页删除了）
        useFileStore.getState().syncWithBackend(backendIds);
      })
      .catch(() => {
        /* 静默失败，显示空列表 */
      });
  }, [addFile, authReady, isAuthenticated]);

  const displayFiles = (files.length > 0 ? files : mockFiles).filter(isRealReadyFile);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!requireAuth()) {
      e.target.value = '';
      return;
    }
    if (file) {
      await upload(file);
      e.target.value = '';
    }
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
    if (file) await upload(file);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelectedElements(checked ? allElementIds : []);
  };

  const handleSelectElement = (id: string) => {
    setSelectedElements(prev => {
      const next = prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id];
      setSelectAll(next.length === allElementIds.length);
      return next;
    });
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const readyFiles = displayFiles;

  const resetExtractionState = () => {
    setCurrentPhase(null);
    setProgressMessage('');
    setExtractedElements([]);
    setStreamRawText('');
    setIsDone(false);
    setErrorMessage(null);
    setPercentage(null);
    clearExtractTask();
  };

  const getOcrMaxPages = () => {
    if (ocrEngine === 'ocrmypdf') return null;
    if (ocrEngine === 'llm') return 3;
    return 15;
  };

  const getOcrTimeoutSeconds = () => {
    if (ocrEngine === 'ocrmypdf') return 600;
    if (ocrEngine === 'llm') return 120;
    return 300;
  };

  const handleExtract = async () => {
    if (!requireAuth()) return;
    if (!selectedFileId) return;
    resetExtractionState();
    runExtractTask({
      endpoint: '/api/extract/element',
      activeTab,
      selectedFileId,
      initialMessage: '正在连接服务...',
      body: {
        fileId: selectedFileId,
        provider: activeProvider,
        model: activeModel,
        template_type:
          activeTab === 'batch'
            ? 'batch'
            : activeTab === 'threshold'
              ? 'threshold'
              : selectedTemplate,
        elements: selectedElements,
        mode: activeTab,
        ocr_engine: ocrEngine,
        ocr_max_pages: getOcrMaxPages(),
        ocr_timeout_seconds: getOcrTimeoutSeconds(),
      },
    });
  };

  const handleBatchExtract = async () => {
    if (!requireAuth()) return;
    if (selectedFileIds.length < 2) return;
    resetExtractionState();
    runExtractTask({
      endpoint: '/api/extract/element/batch',
      activeTab,
      selectedFileId,
      initialMessage: `正在连接服务（${selectedFileIds.length} 个文件）...`,
      body: {
        fileIds: selectedFileIds,
        provider: activeProvider,
        model: activeModel,
        elements: selectedElements,
        ocr_engine: ocrEngine,
        ocr_max_pages: getOcrMaxPages(),
        ocr_timeout_seconds: getOcrTimeoutSeconds(),
      },
    });
  };

  const handleThresholdExtract = async () => {
    if (!requireAuth()) return;
    if (!selectedFileId || !thresholdText.trim()) return;
    resetExtractionState();
    runExtractTask({
      endpoint: '/api/extract/element/threshold',
      activeTab,
      selectedFileId,
      initialMessage: '正在连接服务...',
      body: {
        fileId: selectedFileId,
        userQualifications: thresholdText,
        provider: activeProvider,
        model: activeModel,
        ocr_engine: ocrEngine,
        ocr_max_pages: getOcrMaxPages(),
        ocr_timeout_seconds: getOcrTimeoutSeconds(),
      },
    });
  };

  const handleStop = useCallback(() => {
    stopExtractTask();
  }, []);

  const handleCopy = useCallback(
    () => navigator.clipboard.writeText(streamRawText),
    [streamRawText]
  );

  const handleDownload = useCallback(() => {
    const blob = new Blob([streamRawText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extract_result.md';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [streamRawText]);

  const handleDownloadPdf = useCallback(async () => {
    if (!streamRawText.trim() || !isDone || isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      await downloadMarkdownPdf(streamRawText, 'extract_result.pdf', {
        title: '要素提取结果',
        sourceType: 'extract_result',
      });
    } catch {
      alert('PDF 生成失败，请稍后重试或先下载 Markdown。');
    } finally {
      setIsPdfExporting(false);
    }
  }, [isDone, isPdfExporting, streamRawText]);

  const renderPreviewText = useCallback(
    (text: string) => (showMarkdownPreview ? <MarkdownPreview content={text} /> : text),
    [showMarkdownPreview]
  );

  const tabs = [
    { key: 'single', label: '单文件提取', icon: FileSearch },
    { key: 'batch', label: '批量对比', icon: BarChart3 },
    { key: 'threshold', label: '门槛分析', icon: Shield },
  ];

  return (
    <WorkbenchLayout>
      <div className="w-full space-y-6">
        <PageHeader title="要素提取" description="上传招标文件，AI 按用户要求自动提取关键要素" />

        <ResizableSplit
          storageKey="extract-split-width"
          left={(
            <div className="space-y-5">
            {/* Tab 导航 */}
            <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* 上传区域 */}
            <input
              type="file"
              id="extract-file-input"
              ref={fileInputRef}
              data-testid="file-input"
              className="file-sr-only"
              accept=".pdf,.md,.doc,.docx,.xlsx,.xls"
              onChange={handleUpload}
            />
            <label
              htmlFor="extract-file-input"
              tabIndex={0}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center gap-4 bg-card',
                isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              )}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium">点击或拖拽文件到此区域</p>
                <p className="text-sm text-muted-foreground">
                  支持 PDF、Markdown、Word、Excel（最大 50MB）
                </p>
              </div>
            </label>
            {activeTab === 'single' && displayFiles.length > 0 && (
              <div className="space-y-4">
                {/* 左：文件列表 */}
                <div>
                  <div className="rounded-xl border border-border">
                    <div className="p-4 border-b bg-muted/50">
                      <h2 className="font-semibold text-sm">已上传文件</h2>
                    </div>
                    <div className="divide-y">
                      {displayFiles.map(file => (
                        <div
                          key={file.id}
                          data-testid="file-item"
                          data-file-status={file.status}
                          className={cn(
                            'p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors',
                            selectedFileId === file.id && 'bg-primary/5'
                          )}
                          onClick={() => setSelectedFileId(file.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileSearch className="h-4 w-4 text-muted-foreground shrink-0" />
                            <p className="font-medium text-sm truncate">{file.name}</p>
                          </div>
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs shrink-0',
                              file.status === 'ready'
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            )}
                          >
                            {file.status === 'ready' ? '就绪' : '处理中'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 右：选项区 + 操作按钮 */}
                {selectedFileId && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border p-6 bg-card">
                      <label className="text-sm text-muted-foreground mb-2 block">输出模板</label>
                      <select
                        className="border rounded px-3 py-2 w-full"
                        value={selectedTemplate}
                        onChange={e => setSelectedTemplate(e.target.value)}
                      >
                        {outputTemplates.map(t => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-xl border border-border p-6 bg-card">
                      <div className="flex items-center gap-3 mb-4">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={e => handleSelectAll(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="font-medium">提取全部要素</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {elementCategories.map(cat => (
                          <div key={cat.group}>
                            <p className="text-sm text-muted-foreground mb-2">{cat.group}</p>
                            <div className="space-y-2">
                              {cat.items.map(item => (
                                <label key={item.id} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selectedElements.includes(item.id)}
                                    onChange={() => handleSelectElement(item.id)}
                                    className="w-4 h-4"
                                  />
                                  {item.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      data-testid="extract-button"
                      onClick={handleExtract}
                      disabled={isStreaming || selectedElements.length === 0}
                      className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                    >
                      {isStreaming ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          提取中...
                        </>
                      ) : (
                        <>
                          <FileSearch className="h-5 w-5" />
                          开始提取要素
                        </>
                      )}
                    </button>

                    {isStreaming && (
                      <button
                        data-testid="stop-button"
                        onClick={handleStop}
                        className="w-full py-2 border rounded-lg text-muted-foreground hover:bg-muted"
                      >
                        停止提取
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 批量对比 Tab */}
            {activeTab === 'batch' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border">
                  <div className="p-4 border-b bg-muted/50">
                    <h2 className="font-semibold">选择要对比的文件（至少 2 个）</h2>
                  </div>
                  <div className="divide-y">
                    {readyFiles.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        还没有已上传的文件，请先在顶部上传
                      </div>
                    ) : (
                      readyFiles.map(file => (
                        <div
                          key={file.id}
                          className={cn(
                            'p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors',
                            selectedFileIds.includes(file.id) && 'bg-primary/5'
                          )}
                          onClick={() => toggleFileSelection(file.id)}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedFileIds.includes(file.id)}
                              onChange={() => toggleFileSelection(file.id)}
                              className="w-4 h-4"
                              onClick={e => e.stopPropagation()}
                            />
                            <FileSearch className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded text-xs bg-success/10 text-success">
                            就绪
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border p-6 bg-card">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">对比全部要素</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {elementCategories.map(cat => (
                      <div key={cat.group}>
                        <p className="text-sm text-muted-foreground mb-2">{cat.group}</p>
                        <div className="space-y-2">
                          {cat.items.map(item => (
                            <label key={item.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedElements.includes(item.id)}
                                onChange={() => handleSelectElement(item.id)}
                                className="w-4 h-4"
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  data-testid="batch-button"
                  onClick={handleBatchExtract}
                  disabled={
                    isStreaming || selectedFileIds.length < 2 || selectedElements.length === 0
                  }
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      对比分析中...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-5 w-5" />
                      开始批量对比（已选 {selectedFileIds.length} 个文件）
                    </>
                  )}
                </button>

                {isStreaming && (
                  <button
                    onClick={handleStop}
                    className="w-full py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted"
                  >
                    停止分析
                  </button>
                )}
              </div>
            )}

            {/* 门槛分析 Tab */}
            {activeTab === 'threshold' && selectedFileId && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-6 bg-card">
                  <label className="text-sm text-muted-foreground mb-2 block">
                    填写自身资质、业绩条件
                  </label>
                  <textarea
                    data-testid="threshold-textarea"
                    className="w-full border rounded p-3 text-sm min-h-[120px]"
                    placeholder="请输入您的资质、业绩、人员信息，系统将对比招标文件要求进行匹配分析..."
                    value={thresholdText}
                    onChange={e => setThresholdText(e.target.value)}
                  />
                </div>
                <button
                  data-testid="threshold-button"
                  onClick={handleThresholdExtract}
                  disabled={isStreaming || !thresholdText.trim()}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      开始门槛分析
                    </>
                  )}
                </button>

                {isStreaming && (
                  <button
                    onClick={handleStop}
                    className="w-full py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted"
                  >
                    停止分析
                  </button>
                )}
              </div>
            )}

            {/* 门槛分析无需文件选中提示 */}
            {activeTab === 'threshold' && !selectedFileId && (
              <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                请先在顶部上传并选择一个招标文件
              </div>
            )}
          </div>
          )}
          right={(
            <aside className="rounded-2xl border border-border bg-card shadow-sm xl:sticky xl:top-6">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">输出预览</h2>
                <p className="mt-1 text-s text-muted-foreground">
                  任务执行后，提取文本会在这里实时展示
                </p>
              </div>
              {streamRawText && (
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
                    title="复制"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="下载 MD"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!isDone || isPdfExporting}
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
              {(isStreaming || isDone || errorMessage) && (
                <div className="mb-5">
                  <TaskProgress
                    phases={extractPhases}
                    currentPhase={currentPhase}
                    percentage={percentage}
                    message={progressMessage}
                    isActive={isStreaming}
                    isDone={isDone}
                    errorMessage={errorMessage}
                    showStop={isStreaming}
                    onStop={handleStop}
                  />
                </div>
              )}

              {extractedElements.length > 0 && (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-foreground">
                    提取结果（{extractedElements.length} 个要素）
                  </div>
                  <div className="grid gap-4">
                    {extractedElements.map((elem, idx) => (
                      <div
                        key={idx}
                        data-testid="element-card"
                        className="overflow-hidden rounded-xl border border-border bg-background"
                      >
                        <div className="border-b border-border bg-muted/50 px-4 py-3">
                          <span className="font-medium text-sm text-foreground">{elem.name}</span>
                        </div>
                        <div className="p-4">
                          <div
                            className={cn(
                              'markdown-body text-sm leading-relaxed',
                              !showMarkdownPreview && 'whitespace-pre-wrap'
                            )}
                          >
                            {renderPreviewText(elem.content)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {extractedElements.length === 0 && streamRawText && (
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="border-b border-border bg-muted/50 px-4 py-3">
                    <span className="font-medium text-sm text-foreground">分析结果</span>
                  </div>
                  <div className="p-4">
                    <div
                      className={cn(
                        'markdown-body text-sm leading-relaxed',
                        !showMarkdownPreview && 'whitespace-pre-wrap'
                      )}
                    >
                      {renderPreviewText(streamRawText)}
                    </div>
                  </div>
                </div>
              )}

              {!streamRawText && !isStreaming && !errorMessage && (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">等待生成提取结果</p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    左侧选择文件、模板和要素后开始任务，AI 输出会在右侧保持独立预览。
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
