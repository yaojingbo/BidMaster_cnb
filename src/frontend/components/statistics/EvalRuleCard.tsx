'use client';

/**
 * 评标基准价设置卡（specs/pm/opening-analysis-eval-rule-prd.md §五）
 * 三层入口共用同一结构化规则对象：预设办法点选 / 贴原文 AI 解析；AI 不碰数值。
 */

import { useState } from 'react';
import { Calculator, FileText, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';

export interface EvalRuleConfig {
  method: string;
  price_field?: 'final_price' | 'bid_price' | null;
  params: Record<string, number | string | null>;
  exclude_bidders?: string[];
  source?: string;
}

interface SuggestResult {
  mappable: boolean;
  reason: string;
  evidence_quote: string;
  unmapped_points: string[];
  rule: EvalRuleConfig | null;
}

interface Props {
  value: EvalRuleConfig | null;
  onChange: (rule: EvalRuleConfig | null) => void;
  parsedMeta: { benchmark_price?: number | null; max_price?: number | null; d_value?: number | null };
}

const METHODS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'arithmetic_mean', label: '算术平均法', desc: '全部有效报价的平均值作基准价' },
  { key: 'mean_discount_k', label: '均值下浮法 (K值)', desc: '平均值 × (1−K%)，K 可读表内 D 值' },
  { key: 'second_average', label: '二次平均法', desc: '先平均，±N% 偏差带内再平均' },
  { key: 'trimmed_mean', label: '去高去低法', desc: '去掉最高/最低各 N 家后取平均' },
  { key: 'weighted_composite', label: '加权复合法', desc: '限价×W% + 均值×(100−W)%（可含标底）' },
  { key: 'median_or_second_low', label: '次低价 / 中位数', desc: '直接以次低价或中位数为基准' },
];

function defaultParams(method: string): Record<string, number | string | null> {
  switch (method) {
    case 'mean_discount_k':
      return { k_pct: null, round_digits: 2 };
    case 'second_average':
      return { deviation_band: 5, round_digits: 2 };
    case 'trimmed_mean':
      return { trim_high: 1, trim_low: 1, round_digits: 2 };
    case 'weighted_composite':
      return { limit_price_weight: 60, floor_weight: 0, floor_price: null, round_digits: 2 };
    case 'median_or_second_low':
      return { pick: 'second_low', round_digits: 2 };
    default:
      return { round_digits: 2 };
  }
}

const numCls =
  'w-full px-2 py-1.5 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary';

export function EvalRuleCard({ value, onChange, parsedMeta }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);

  const activeMethod = value?.method ?? null;

  const selectMethod = (method: string) => {
    if (activeMethod === method && !customOpen) {
      onChange(null); // 再点一次取消启用
      return;
    }
    setCustomOpen(false);
    setSuggestion(null);
    onChange({ method, price_field: value?.price_field ?? null, params: defaultParams(method), exclude_bidders: [], source: 'preset' });
  };

  const patch = (next: Partial<EvalRuleConfig>) => {
    if (!value) return;
    onChange({ ...value, ...next });
  };

  const patchParam = (key: string, v: number | string | null) => {
    if (!value) return;
    onChange({ ...value, params: { ...value.params, [key]: v } });
  };

  const handleSuggest = async () => {
    if (!rawText.trim()) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);
    try {
      const res = await authFetch('/api/statistics/benchmark/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText.trim() }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSuggestion(data.data as SuggestResult);
      } else {
        setSuggestError(data.detail || '解析失败');
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : '解析请求失败');
    } finally {
      setSuggesting(false);
    }
  };

  const adoptSuggestion = () => {
    if (!suggestion?.rule) return;
    setCustomOpen(false);
    onChange({ ...suggestion.rule, source: 'parsed_custom' });
    setSuggestion(null);
    setRawText('');
  };

  const priceFieldSel = value ? (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">计算口径</span>
      <select
        className={numCls}
        value={value.price_field ?? ''}
        onChange={e => patch({ price_field: (e.target.value || null) as EvalRuleConfig['price_field'] })}
      >
        <option value="">自动（有最终报价用最终报价）</option>
        <option value="final_price">最终报价 / 二次报价</option>
        <option value="bid_price">初始投标价</option>
      </select>
    </div>
  ) : null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">评标基准价设置</h3>
        <span className="text-xs text-muted-foreground">可选——不选则沿用表格自带基准价行</span>
        {value && (
          <button onClick={() => onChange(null)} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
            <X className="h-3 w-3" /> 清除规则
          </button>
        )}
      </div>

      {/* 办法选择卡网格：六个预设 + 其他 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {METHODS.map(m => (
          <button
            key={m.key}
            onClick={() => selectMethod(m.key)}
            className={`text-left rounded-lg border p-2.5 transition-colors ${
              activeMethod === m.key && !customOpen
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="text-xs font-medium">{m.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</div>
          </button>
        ))}
        <button
          onClick={() => {
            setCustomOpen(o => !o);
            setSuggestion(null);
          }}
          className={`text-left rounded-lg border p-2.5 transition-colors ${
            customOpen ? 'border-primary bg-primary/10' : 'border-dashed border-border hover:border-primary/40'
          }`}
        >
          <div className="text-xs font-medium flex items-center gap-1">
            <FileText className="h-3 w-3" /> 其他 · 贴原文
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">粘贴评标办法，AI 解析成以上办法+参数</div>
        </button>
      </div>

      {/* 其他：贴原文解析入口 */}
      {customOpen && (
        <div className="space-y-2 border border-dashed border-border rounded-lg p-3">
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={5}
            placeholder="粘贴招标文件中「评标基准价的确定办法」段落原文……"
            className={numCls + ' resize-y'}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSuggest}
              disabled={!rawText.trim() || suggesting}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50 flex items-center gap-1"
            >
              {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              AI 解析
            </button>
            <span className="text-[11px] text-muted-foreground">解析结果仅生成参数草稿，数值一律由服务端确定性计算</span>
          </div>
          {suggestError && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {suggestError}
            </div>
          )}
          {suggestion && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-xs">
              {suggestion.mappable && suggestion.rule ? (
                <>
                  <div className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 已识别为
                    「{METHODS.find(m => m.key === suggestion.rule!.method)?.label ?? suggestion.rule.method}」
                  </div>
                  {suggestion.evidence_quote && (
                    <div className="text-muted-foreground">依据：「{suggestion.evidence_quote}」</div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={adoptSuggestion} className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs">
                      采用该规则
                    </button>
                    <span className="text-muted-foreground">采用后仍可在参数区微调</span>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-start gap-1 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>无法映射到内置办法：{suggestion.reason || '未给出原因'}</span>
                  </div>
                  {suggestion.unmapped_points?.length > 0 && (
                    <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                      {suggestion.unmapped_points.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 参数区：按所选办法动态渲染 */}
      {value && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3">
          {activeMethod === 'mean_discount_k' && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                下浮系数 K%
                {parsedMeta.d_value != null && (
                  <span className="ml-1 text-success">（表内 D 值 {parsedMeta.d_value}，留空则自动使用）</span>
                )}
              </label>
              <input
                type="number" step="any" min="0" max="100"
                className={numCls}
                placeholder={parsedMeta.d_value != null ? String(parsedMeta.d_value) : '如 3 表示下浮 3%'}
                value={(value.params.k_pct as number | null) ?? ''}
                onChange={e => patchParam('k_pct', e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          )}
          {activeMethod === 'second_average' && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">偏差带 ±%</label>
              <input
                type="number" step="any" min="0"
                className={numCls}
                value={(value.params.deviation_band as number) ?? 5}
                onChange={e => patchParam('deviation_band', Number(e.target.value))}
              />
            </div>
          )}
          {activeMethod === 'trimmed_mean' && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">去掉最低 N 家</label>
                <input
                  type="number" step="1" min="0"
                  className={numCls}
                  value={(value.params.trim_low as number) ?? 1}
                  onChange={e => patchParam('trim_low', Math.max(0, Math.floor(Number(e.target.value))))}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">去掉最高 N 家</label>
                <input
                  type="number" step="1" min="0"
                  className={numCls}
                  value={(value.params.trim_high as number) ?? 1}
                  onChange={e => patchParam('trim_high', Math.max(0, Math.floor(Number(e.target.value))))}
                />
              </div>
            </>
          )}
          {activeMethod === 'weighted_composite' && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  最高限价权重 %{parsedMeta.max_price == null && (
                    <span className="ml-1 text-destructive">（表内未见最高限价行）</span>
                  )}
                </label>
                <input
                  type="number" step="any" min="0" max="100"
                  className={numCls}
                  value={(value.params.limit_price_weight as number) ?? 60}
                  onChange={e => patchParam('limit_price_weight', Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">标底权重 %</label>
                  <input
                    type="number" step="any" min="0" max="100"
                    className={numCls}
                    value={(value.params.floor_weight as number) ?? 0}
                    onChange={e => patchParam('floor_weight', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">标底数值</label>
                  <input
                    type="number" step="any"
                    className={numCls}
                    placeholder="未设权重可不填"
                    value={(value.params.floor_price as number | null) ?? ''}
                    onChange={e => patchParam('floor_price', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}
          {activeMethod === 'median_or_second_low' && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">选取方式</label>
              <select
                className={numCls}
                value={(value.params.pick as string) ?? 'second_low'}
                onChange={e => patchParam('pick', e.target.value)}
              >
                <option value="second_low">次低价（低价优先）</option>
                <option value="median">中位数</option>
              </select>
            </div>
          )}
          {priceFieldSel}
          <div className="md:col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">手动剔除无效报价的单位名称（逗号分隔，不填则无）</label>
            <input
              className={numCls}
              placeholder="如：某某建设有限公司, 某某咨询"
              defaultValue=""
              onBlur={e =>
                patch({
                  exclude_bidders: e.target.value
                    .split(/[,，]/)
                    .map(s => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
