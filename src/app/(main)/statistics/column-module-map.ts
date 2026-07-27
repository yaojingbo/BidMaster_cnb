export interface ModuleAvailability {
  key: string;
  label: string;
  available: boolean;
  description: string;
}

export function getModulesFromColumns(
  selectedInternalColumns: string[],
  meta: { benchmark_price?: number | null; max_price?: number | null },
): ModuleAvailability[] {
  const has = (field: string) => selectedInternalColumns.includes(field);
  const hasAny = (...fields: string[]) => fields.some(has);

  const hasBidPrice = has("bid_price");
  const hasFinal = hasAny("final_price", "remarks");
  const hasScores = hasAny("credit_score", "technical_score", "commercial_score", "total_score");
  const hasBenchmark = meta?.benchmark_price != null;

  return [
    {
      key: "bid_ranking",
      label: "投标价排名",
      available: hasBidPrice,
      description: hasBidPrice ? "按投标价从低到高排序，计算偏离均值比例" : "需要勾选投标价列",
    },
    {
      key: "final_ranking",
      label: "最终报价排名",
      available: hasFinal,
      description: hasFinal ? "按最终报价从低到高排序" : "需要勾选备注列（含最终报价信息）",
    },
    {
      key: "discount",
      label: "降价分析",
      available: hasBidPrice && hasFinal,
      description: hasBidPrice && hasFinal ? "投标价 vs 最终报价降价幅度与策略分类" : "需要投标价和备注列",
    },
    {
      key: "statistics",
      label: "统计分析",
      available: hasBidPrice,
      description: hasBidPrice ? "均值/标准差/离散系数/梯队分布" : "需要勾选投标价列",
    },
    {
      key: "scores",
      label: "评分对比",
      available: hasScores,
      description: hasScores ? "资信/技术/商务/综合评分排名对比" : "需要勾选评分相关列",
    },
    {
      key: "benchmark",
      label: "基准价对比",
      available: hasBenchmark,
      description: hasBenchmark ? "各投标报价与评标基准价的偏离分析" : "表格中未检测到评标基准价数据",
    },
    {
      key: "comprehensive",
      label: "综合分析 (AI)",
      available: true,
      description: "AI 对分析结果进行综合解读与策略建议",
    },
  ];
}
