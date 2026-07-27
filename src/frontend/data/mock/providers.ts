// Frontend mock data for development

export const mockProviders = [
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-v4-flash", "deepseek-v4-pro"] },
  { id: "dashscope", name: "阿里百炼", models: ["qwen-turbo", "qwen-plus"] },
  { id: "zhipu", name: "智谱 AI", models: ["glm-4-flash", "glm-4"] },
  { id: "minimax", name: "MiniMax", models: ["MiniMax-M2.7"] },
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"] },
  { id: "claude", name: "Claude", models: ["claude-sonnet-4"] },
  { id: "ollama", name: "Ollama", models: ["llama3"] },
];

export const mockFiles = [
  {
    id: "file-1",
    name: "招标文件-第一包.pdf",
    size: 1024000,
    mimeType: "application/pdf",
    category: "tender",
    status: "ready" as const,
    createdAt: "2026-05-10T10:00:00Z",
  },
  {
    id: "file-2",
    name: "投标文件-A公司.docx",
    size: 2048000,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "bid",
    status: "ready" as const,
    createdAt: "2026-05-09T15:30:00Z",
  },
];

export const mockElements = [
  { name: "资质要求" as const, content: "投标人须具有建筑工程施工总承包一级资质", confidence: 95 },
  { name: "评标办法" as const, content: "综合评估法，商务标占60%，技术标占40%", confidence: 92 },
  { name: "业绩门槛" as const, content: "近三年内完成过三个以上类似项目", confidence: 88 },
  { name: "定标方法" as const, content: "最低价中标法", confidence: 90 },
  { name: "合同条款" as const, content: "合同工期12个月，付款方式为按月进度支付", confidence: 85 },
];

export const mockStatistics = {
  prices: [1250000, 1180000, 1320000, 1280000, 1150000],
  priceRankings: [
    { bidderId: "bidder_1", price: 1150000, rank: 1 },
    { bidderId: "bidder_2", price: 1180000, rank: 2 },
    { bidderId: "bidder_3", price: 1250000, rank: 3 },
    { bidderId: "bidder_4", price: 1280000, rank: 4 },
    { bidderId: "bidder_5", price: 1320000, rank: 5 },
  ],
  averagePrice: 1236000,
  lowestPrice: 1150000,
  highestPrice: 1320000,
  dispersionCoefficient: 5.2,
  priceChanges: [5.9, -5.6, 3.1, 10.4],
};