/** AI Provider Constants */

export const AI_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    nameZh: "OpenAI",
    icon: "🤖",
    models: [
      { id: "gpt-4o", name: "GPT-4o", nameZh: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", nameZh: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", nameZh: "GPT-4 Turbo" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    nameZh: "Anthropic",
    icon: "🧠",
    models: [
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4", nameZh: "Claude Sonnet 4" },
      { id: "claude-opus-4-7", name: "Claude Opus 4", nameZh: "Claude Opus 4" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4", nameZh: "Claude Haiku 4" },
    ],
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    nameZh: "Azure OpenAI",
    icon: "☁️",
    models: [
      { id: "gpt-4o", name: "GPT-4o", nameZh: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", nameZh: "GPT-4o Mini" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    nameZh: "Google Gemini",
    icon: "💎",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", nameZh: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", nameZh: "Gemini 2.5 Flash" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    nameZh: "Ollama",
    icon: "🦙",
    models: [
      { id: "llama3", name: "Llama 3", nameZh: "Llama 3" },
      { id: "qwen2.5", name: "Qwen 2.5", nameZh: "Qwen 2.5" },
      { id: "deepseek-v3", name: "DeepSeek V3", nameZh: "DeepSeek V3" },
    ],
  },
] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];
export type AIProviderId = AIProvider["id"];
export type AIModelId = string;

export const DEFAULT_PROVIDER: AIProviderId = "openai";
export const DEFAULT_MODEL: AIModelId = "gpt-4o";

/**
 * OCR 引擎（扫描件识别）
 * - auto: macOS 优先 OCRmyPDF + Tesseract，Linux 可用 PaddleOCR，失败时自动回退云端视觉模型
 * - ocrmypdf: 强制本地 OCRmyPDF + Tesseract
 * - paddleocr: 强制本地 PaddleOCR（Linux 可选）
 * - llm: 强制云端多模态视觉模型（按 token 计费、泛用性好）
 */
export const OCR_ENGINES = [
  { id: "auto", name: "智能（推荐）", desc: "本地 OCRmyPDF 优先，自动回退云端" },
  { id: "ocrmypdf", name: "本地 OCRmyPDF", desc: "免费、离线、适合 macOS 扫描 PDF" },
  { id: "paddleocr", name: "本地 PaddleOCR", desc: "Linux 可选，中文识别强" },
  { id: "llm", name: "云端视觉模型", desc: "按 token 计费、泛用性好" },
] as const;

export type OcrEngineId = (typeof OCR_ENGINES)[number]["id"];
