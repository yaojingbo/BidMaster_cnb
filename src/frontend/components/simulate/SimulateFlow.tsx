"use client";

import { useState } from "react";
import { FileText, Settings, Lightbulb, FileCheck, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = "upload" | "configure" | "generate" | "review";

const STEPS: { id: Step; label: string; icon: typeof FileText }[] = [
  { id: "upload", label: "上传参考", icon: FileText },
  { id: "configure", label: "配置参数", icon: Settings },
  { id: "generate", label: "AI 生成", icon: Lightbulb },
  { id: "review", label: "审核导出", icon: FileCheck },
];

export function SimulateFlow() {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [referenceFile, setReferenceFile] = useState<{ name: string; content: string } | null>(null);
  const [config, setConfig] = useState({
    projectType: "",
    budget: "",
    timeline: "",
  });
  const [generatedDoc, setGeneratedDoc] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleFileSelect = () => {
    setReferenceFile({ name: "参考文件.pdf", content: "PDF内容" });
    setCurrentStep("configure");
  };

  const handleConfigNext = () => {
    setCurrentStep("generate");
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setGeneratedDoc("生成的招标文件内容...\n\n# 项目名称\n# 项目编号\n# 招标内容\n# 投标要求");
    setSuggestions([
      "建议补充资格审查条件",
      "建议明确付款方式",
      "建议增加违约责任条款",
    ]);
    setIsGenerating(false);
    setCurrentStep("review");
  };

  const handleExport = () => {
    const blob = new Blob([generatedDoc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simulate_result.md";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>模拟编制</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (isCompleted || step.id === "upload") {
                        setCurrentStep(step.id);
                      }
                    }}
                    disabled={!isCompleted && step.id !== "upload"}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg transition-colors",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && "bg-muted cursor-pointer hover:bg-muted/80",
                      !isActive && !isCompleted && "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={cn("w-12 h-0.5 mx-2", isCompleted ? "bg-primary" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="min-h-[300px]">
            {currentStep === "upload" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  上传一个参考招标文件，AI 将学习其结构和风格，生成新的招标文件。
                </p>
                <div
                  onClick={handleFileSelect}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <FileText className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    点击选择文件 或 拖拽文件到此处
                  </p>
                </div>
              </div>
            )}

            {currentStep === "configure" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">配置新文件的基本参数</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">项目类型</label>
                    <select
                      value={config.projectType}
                      onChange={(e) => setConfig({ ...config, projectType: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="">请选择</option>
                      <option value="工程">工程建设</option>
                      <option value="货物">货物采购</option>
                      <option value="服务">服务咨询</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">预算金额</label>
                    <input
                      type="text"
                      value={config.budget}
                      onChange={(e) => setConfig({ ...config, budget: e.target.value })}
                      placeholder="如：100万元"
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">工期要求</label>
                    <input
                      type="text"
                      value={config.timeline}
                      onChange={(e) => setConfig({ ...config, timeline: e.target.value })}
                      placeholder="如：30日历天"
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <Button onClick={handleConfigNext} className="w-full mt-4">
                  下一步
                </Button>
              </div>
            )}

            {currentStep === "generate" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  AI 正在根据参考文件和配置参数生成招标文件...
                </p>
                <div className="flex items-center justify-center h-[200px]">
                  {isGenerating ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
                      <p className="text-sm text-muted-foreground">生成中，请稍候...</p>
                    </div>
                  ) : (
                    <Button onClick={handleGenerate} className="px-8">
                      开始生成
                    </Button>
                  )}
                </div>
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">审核 AI 生成的招标文件</p>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <pre className="text-sm whitespace-pre-wrap">{generatedDoc}</pre>
                </div>
                {suggestions.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">优化建议</h4>
                    <ul className="space-y-1">
                      {suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button onClick={handleExport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  导出文件
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
