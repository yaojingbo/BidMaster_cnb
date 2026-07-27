'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Check, X, Loader2, RotateCcw, Eye, EyeOff, Key, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { getApiKeys, saveApiKey, deleteApiKey, type ApiKeyItem } from '@/lib/api-keys';
import { authFetch } from '@/lib/auth-fetch';
import { useSettingsStore } from '@/stores/settings-store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/stores/auth-store';

interface Provider {
  id: string;
  name: string;
  models: string[];
}

interface TestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  error?: string;
}

export default function SettingsPage() {
  const requireAuth = useRequireAuth();
  const { authReady, isAuthenticated } = useAuthStore();
  const [providers, setProviders] = useState<Provider[]>([]);
  const storeActiveProvider = useSettingsStore(s => s.activeProvider);
  const setStoreActiveProvider = useSettingsStore(s => s.setActiveProvider);
  const [activeProvider, setActiveProviderLocal] = useState(storeActiveProvider);
  const [loading, setLoading] = useState(true);

  const setActiveProvider = useCallback(
    (id: string) => {
      setActiveProviderLocal(id);
      setStoreActiveProvider(id);
    },
    [setStoreActiveProvider]
  );

  // 测试连接
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // 切换供应商
  const [switchingProvider, setSwitchingProvider] = useState<string | null>(null);
  const [switchResult, setSwitchResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // API Key 管理
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [apiKeyResult, setApiKeyResult] = useState<{
    provider: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [savedKeys, setSavedKeys] = useState<ApiKeyItem[]>([]);

  // 型号管理
  const activeModel = useSettingsStore(s => s.activeModel);
  const activeModels = useSettingsStore(s => s.activeModels);
  const setProviderModel = useSettingsStore(s => s.setProviderModel);
  const ocrEngine = useSettingsStore(s => s.ocrEngine);
  const setOcrEngine = useSettingsStore(s => s.setOcrEngine);
  const [modelValues, setModelValues] = useState<Record<string, string>>({});

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/settings/providers');
      const data = await res.json();
      if (data.success && data.data) {
        setProviders(data.data.providers);
      }
    } catch (err) {
      console.error('加载供应商列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSavedKeys = useCallback(async () => {
    try {
      const keys = await getApiKeys();
      setSavedKeys(keys);
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    loadSavedKeys();
  }, [authReady, isAuthenticated, loadSavedKeys]);

  const getPendingModel = useCallback(
    (providerId: string) => modelValues[providerId]?.trim() || activeModels[providerId],
    [activeModels, modelValues]
  );

  // 测试连接
  const handleTest = async (providerId: string) => {
    if (!requireAuth()) return;
    setTestingProvider(providerId);
    setTestResult(null);
    try {
      const res = await authFetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          model: getPendingModel(providerId),
          apiKey: apiKeyValues[providerId]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? `连接成功 (${data.latencyMs}ms)`
          : `连接失败: ${data.error || data.message}`,
        latencyMs: data.latencyMs,
        error: data.error,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `请求失败: ${err instanceof Error ? err.message : '未知错误'}`,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  // 切换供应商
  const handleSwitchProvider = async (providerId: string) => {
    if (!requireAuth()) return;
    setSwitchingProvider(providerId);
    setSwitchResult(null);
    try {
      const res = await authFetch(`/api/settings/providers/${providerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          model: providers.find(p => p.id === providerId)?.models[0] || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveProvider(providerId);
        setSwitchResult({ success: true, message: '供应商切换成功' });
      } else {
        setSwitchResult({ success: false, message: data.message || '切换失败' });
      }
    } catch (err) {
      setSwitchResult({
        success: false,
        message: `请求失败: ${err instanceof Error ? err.message : '未知错误'}`,
      });
    } finally {
      setSwitchingProvider(null);
    }
  };

  // 保存 API Key（保存前验证连接）
  const handleSaveKey = async (providerId: string) => {
    if (!requireAuth()) return;
    const key = apiKeyValues[providerId]?.trim();
    const typedModel = modelValues[providerId]?.trim();
    if (!key && !typedModel) {
      setApiKeyResult({ provider: providerId, success: false, message: '请输入型号或 API Key' });
      return;
    }
    if (!key && !isKeySaved(providerId)) {
      setApiKeyResult({ provider: providerId, success: false, message: '请输入 API Key' });
      return;
    }
    setSavingProvider(providerId);
    setApiKeyResult(null);

    try {
      const model = getPendingModel(providerId);
      const testRes = await authFetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, model, apiKey: key || undefined }),
      });
      const testData = await testRes.json();
      if (!testData.success) {
        setApiKeyResult({
          provider: providerId,
          success: false,
          message: `连接验证失败: ${testData.error || '无法连接'}，请检查型号或 API Key 是否正确`,
        });
        return;
      }

      if (typedModel) {
        setProviderModel(providerId, typedModel);
        setModelValues(prev => ({ ...prev, [providerId]: '' }));
      }

      if (key) {
        await saveApiKey(providerId, key);
        setApiKeyValues(prev => ({ ...prev, [providerId]: '' }));
      }

      setApiKeyResult({
        provider: providerId,
        success: true,
        message: key ? 'API Key 已保存' : '型号已保存',
      });
      await loadSavedKeys();
    } catch (err) {
      setApiKeyResult({
        provider: providerId,
        success: false,
        message: err instanceof Error ? err.message : '保存失败',
      });
    } finally {
      setSavingProvider(null);
    }
  };

  // 删除 API Key
  const handleDeleteKey = async (providerId: string) => {
    if (!requireAuth()) return;
    setDeletingProvider(providerId);
    setApiKeyResult(null);
    try {
      await deleteApiKey(providerId);
      setApiKeyResult({ provider: providerId, success: true, message: 'API Key 已删除' });
      await loadSavedKeys();
    } catch (err) {
      setApiKeyResult({
        provider: providerId,
        success: false,
        message: err instanceof Error ? err.message : '删除失败',
      });
    } finally {
      setDeletingProvider(null);
    }
  };

  const toggleShowKey = (providerId: string) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const isKeySaved = (providerId: string) => savedKeys.some(k => k.provider === providerId);

  const getMaskedKey = (providerId: string) =>
    savedKeys.find(k => k.provider === providerId)?.masked_key;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkbenchLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="AI 设置" />

        {/* 当前供应商 */}
        <div className="rounded-xl border border-border p-6 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">当前供应商</p>
              <p className="text-2xl font-bold">
                {providers.find(p => p.id === activeProvider)?.name || '未选择'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">型号: {activeModel || '默认'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-success/10 text-emerald-800 rounded-full text-sm flex items-center gap-1">
                <Check className="h-4 w-4" />
                已配置
              </span>
            </div>
          </div>
        </div>

        {/* 切换结果提示 */}
        {switchResult && (
          <div
            className={cn(
              'p-4 rounded-lg flex items-center gap-3',
              switchResult.success ? 'bg-success/10' : 'bg-destructive/10'
            )}
          >
            {switchResult.success ? (
              <Check className="h-5 w-5 text-success" />
            ) : (
              <X className="h-5 w-5 text-destructive" />
            )}
            <span className={switchResult.success ? 'text-success' : 'text-destructive'}>
              {switchResult.message}
            </span>
          </div>
        )}

        {/* 供应商列表 */}
        <div className="rounded-xl border border-border">
          <div className="p-4 border-b bg-muted/50">
            <h2 className="font-semibold">切换供应商</h2>
          </div>
          <div className="divide-y">
            {providers.map(provider => (
              <div
                key={provider.id}
                className={cn(
                  'p-4 flex items-center justify-between',
                  activeProvider === provider.id && 'bg-primary/5'
                )}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 shrink-0',
                      activeProvider === provider.id ? 'border-primary bg-primary' : 'border-muted'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {provider.models.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(provider.id)}
                    disabled={testingProvider !== null}
                    className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50 flex items-center gap-1"
                  >
                    {testingProvider === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '测试连接'
                    )}
                  </button>
                  <button
                    onClick={() => handleSwitchProvider(provider.id)}
                    disabled={switchingProvider !== null}
                    className={cn(
                      'px-4 py-1 rounded text-sm disabled:opacity-50',
                      activeProvider === provider.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {switchingProvider === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    ) : activeProvider === provider.id ? (
                      '使用中'
                    ) : (
                      '切换'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div
            className={cn(
              'p-6 rounded-xl border border-border flex items-center justify-between',
              testResult.success ? 'bg-success/10' : 'bg-destructive/10'
            )}
          >
            <div className="flex items-center gap-3">
              {testResult.success ? (
                <Check className="h-5 w-5 text-success" />
              ) : (
                <X className="h-5 w-5 text-destructive" />
              )}
              <span className={testResult.success ? 'text-success' : 'text-destructive'}>
                {testResult.message}
              </span>
            </div>
            <button className="p-1 hover:bg-muted rounded" onClick={() => setTestResult(null)}>
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* API Key 管理 */}
        <div className="rounded-xl border border-border p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key 管理
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            为各 LLM 供应商配置型号和 API Key，加密存储，优先于环境变量使用
          </p>

          {apiKeyResult && (
            <div
              className={cn(
                'p-3 rounded-lg mb-4 flex items-center gap-2 text-sm',
                apiKeyResult.success
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {apiKeyResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {apiKeyResult.message}
            </div>
          )}

          <div className="space-y-3">
            {providers
              .filter(p => p.id !== 'ollama')
              .map(provider => (
                <div
                  key={provider.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                >
                  {/* Provider 名称 */}
                  <div className="w-24 shrink-0">
                    <p className="font-medium text-sm">{provider.name}</p>
                    {isKeySaved(provider.id) && (
                      <p className="text-xs text-emerald-800 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        已配置
                      </p>
                    )}
                    {!isKeySaved(provider.id) && (
                      <p className="text-xs text-muted-foreground">未配置</p>
                    )}
                  </div>

                  {/* 型号输入框 */}
                  <div className="w-40 shrink-0">
                    <input
                      type="text"
                      value={modelValues[provider.id] ?? ''}
                      onChange={e =>
                        setModelValues(prev => ({ ...prev, [provider.id]: e.target.value }))
                      }
                      placeholder={activeModels[provider.id] || '默认型号'}
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Key 输入框 */}
                  <div className="flex-1 relative">
                    <input
                      type={showKeys[provider.id] ? 'text' : 'password'}
                      value={apiKeyValues[provider.id] || ''}
                      onChange={e =>
                        setApiKeyValues(prev => ({ ...prev, [provider.id]: e.target.value }))
                      }
                      placeholder={
                        getMaskedKey(provider.id)
                          ? `已保存: ${getMaskedKey(provider.id)}`
                          : '输入 API Key'
                      }
                      className="w-full px-3 py-2 pr-12 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {/* 显示/隐藏 切换 */}
                    <button
                      type="button"
                      onClick={() => toggleShowKey(provider.id)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      aria-label={showKeys[provider.id] ? `隐藏 ${provider.name} API Key` : `显示 ${provider.name} API Key`}
                    >
                      {showKeys[provider.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={savingProvider !== null || deletingProvider !== null}
                      className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingProvider === provider.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      保存
                    </button>
                    {isKeySaved(provider.id) && (
                      <button
                        onClick={() => handleDeleteKey(provider.id)}
                        disabled={savingProvider !== null || deletingProvider !== null}
                        className="p-2 text-sm text-destructive hover:bg-destructive/10 rounded disabled:opacity-50"
                        title="删除 API Key"
                      >
                        {deletingProvider === provider.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {/* Ollama 提示 */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
              <span className="font-medium w-24 shrink-0">Ollama</span>
              <span className="flex-1">本地服务，无需 API Key</span>
            </div>
          </div>
        </div>

        {/* OCR 引擎（扫描件识别） */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="text-sm font-medium">OCR 引擎（扫描件识别）</h3>
              <p className="text-xs text-muted-foreground mt-1">
                决定图片型 PDF（扫描件）的文字识别方式。切换后立即生效，无需重启服务。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {(
              [
                { value: "auto" as const, label: "智能（推荐）", desc: "本地 OCRmyPDF 优先，失败时自动回退到云端视觉模型" },
                { value: "ocrmypdf" as const, label: "本地 OCRmyPDF", desc: "免费、离线，适合 macOS 扫描 PDF；需安装 Tesseract 中文语言包" },
                { value: "paddleocr" as const, label: "本地 PaddleOCR", desc: "Linux 可选，中文识别强；macOS 不再作为默认方案" },
                { value: "llm" as const, label: "云端视觉模型", desc: "按 token 计费、泛用性好，适合模糊扫描件；需配置 AI Provider API Key" },
              ]
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-col gap-1 p-3 rounded border cursor-pointer transition-colors ${
                  ocrEngine === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ocrEngine"
                    value={opt.value}
                    checked={ocrEngine === opt.value}
                    onChange={() => setOcrEngine(opt.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                <span className="text-xs text-muted-foreground pl-6">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </WorkbenchLayout>
  );
}
