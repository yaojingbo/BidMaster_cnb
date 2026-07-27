/**
 * AI settings store using Zustand.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OcrEngine = "auto" | "ocrmypdf" | "paddleocr" | "llm";

interface Provider {
  id: string;
  name: string;
  models: string[];
}

const DEFAULT_MODELS: Record<string, string> = {
  deepseek: "deepseek-chat",
  dashscope: "qwen-turbo",
  zhipu: "glm-4-flash",
  minimax: "MiniMax-M2.7",
  openai: "gpt-4o",
  claude: "claude-sonnet-4-20250514",
  ollama: "llama3",
};

interface SettingsState {
  // Providers
  providers: Provider[];
  activeProvider: string;
  /** current active provider's model (derived, kept in sync for backward compat) */
  activeModel: string;
  /** per-provider model config, keyed by provider id */
  activeModels: Record<string, string>;

  // OCR engine (扫描件识别引擎)
  ocrEngine: OcrEngine;

  // Connection status
  isTesting: boolean;
  lastTestResult: {
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null;

  // Actions
  setProviders: (providers: Provider[]) => void;
  setActiveProvider: (providerId: string) => void;
  setProviderModel: (providerId: string, model: string) => void;
  setOcrEngine: (engine: OcrEngine) => void;
  setTesting: (isTesting: boolean) => void;
  setTestResult: (result: SettingsState["lastTestResult"]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProvider: "deepseek",
      activeModel: DEFAULT_MODELS["deepseek"],
      activeModels: { ...DEFAULT_MODELS },
      ocrEngine: "auto",
      isTesting: false,
      lastTestResult: null,

      setProviders: (providers) => set(() => ({ providers })),

      setActiveProvider: (providerId) => {
        const model = get().activeModels[providerId] || DEFAULT_MODELS[providerId] || "";
        set(() => ({
          activeProvider: providerId,
          activeModel: model,
        }));
      },

      setProviderModel: (providerId, model) => {
        set((state) => ({
          activeModels: { ...state.activeModels, [providerId]: model },
          activeModel: state.activeProvider === providerId ? model : state.activeModel,
        }));
      },

      setOcrEngine: (ocrEngine) => set(() => ({ ocrEngine })),

      setTesting: (isTesting) => set(() => ({ isTesting })),

      setTestResult: (result) => set(() => ({
        lastTestResult: result,
        isTesting: false,
      })),
    }),
    {
      name: "bid-master-settings-store",
      partialize: (state) => ({
        activeProvider: state.activeProvider,
        activeModel: state.activeModel,
        activeModels: state.activeModels,
        ocrEngine: state.ocrEngine,
      }),
    }
  )
);
