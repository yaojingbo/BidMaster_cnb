"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SimulateStep {
  step: number;
  data: Record<string, string>;
  attachments: string[];
}

interface SimulateStore {
  currentTaskId: string | null;
  currentStep: number;
  steps: SimulateStep[];
  projectType: string;
  budget: string;
  timeline: string;
  generatedDocument: string;
  suggestions: string[];
  isGenerating: boolean;

  setTaskId: (taskId: string) => void;
  setCurrentStep: (step: number) => void;
  updateStepData: (step: number, data: Record<string, string>) => void;
  setProjectType: (type: string) => void;
  setBudget: (budget: string) => void;
  setTimeline: (timeline: string) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGeneratedDocument: (doc: string, suggestions: string[]) => void;
  reset: () => void;
}

const initialState = {
  currentTaskId: null,
  currentStep: 1,
  steps: [
    { step: 1, data: {}, attachments: [] },
    { step: 2, data: {}, attachments: [] },
    { step: 3, data: {}, attachments: [] },
    { step: 4, data: {}, attachments: [] },
  ],
  projectType: "",
  budget: "",
  timeline: "",
  generatedDocument: "",
  suggestions: [],
  isGenerating: false,
};

export const useSimulateStore = create<SimulateStore>()(
  persist(
    (set) => ({
      ...initialState,

      setTaskId: (taskId) => set({ currentTaskId: taskId }),

      setCurrentStep: (step) => set({ currentStep: step }),

      updateStepData: (step, data) =>
        set((state) => ({
          steps: state.steps.map((s) =>
            s.step === step ? { ...s, data: { ...s.data, ...data } } : s
          ),
        })),

      setProjectType: (type) => set({ projectType: type }),
      setBudget: (budget) => set({ budget }),
      setTimeline: (timeline) => set({ timeline }),

      setGenerating: (isGenerating) => set({ isGenerating }),

      setGeneratedDocument: (doc, suggestions) =>
        set({ generatedDocument: doc, suggestions, isGenerating: false }),

      reset: () => set(initialState),
    }),
    {
      name: "simulate-storage",
    }
  )
);
