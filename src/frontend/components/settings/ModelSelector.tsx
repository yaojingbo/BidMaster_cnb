"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AI_PROVIDERS, AIProviderId } from "@/constants/providers";

interface ModelSelectorProps {
  providerId: AIProviderId;
  activeModelId: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelSelector({
  providerId,
  activeModelId,
  onSelectModel,
}: ModelSelectorProps) {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);

  if (!provider) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="mr-2">{provider.icon}</span>
          {provider.name} - 选择模型
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {provider.models.map((model) => {
            const isActive = model.id === activeModelId;

            return (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{model.name}</h4>
                    <p className="text-sm text-muted-foreground">{model.nameZh}</p>
                  </div>
                  {isActive && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
