"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AI_PROVIDERS, AIProviderId } from "@/constants/providers";

interface ProviderSelectorProps {
  activeProviderId: AIProviderId;
  onSelectProvider: (providerId: AIProviderId) => void;
  onTestProvider?: (providerId: AIProviderId) => void;
  isTesting?: boolean;
}

export function ProviderSelector({
  activeProviderId,
  onSelectProvider,
  onTestProvider,
  isTesting,
}: ProviderSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>选择 AI 供应商</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_PROVIDERS.map((provider) => {
            const isActive = provider.id === activeProviderId;

            return (
              <button
                key={provider.id}
                onClick={() => onSelectProvider(provider.id)}
                className={cn(
                  "relative p-4 rounded-lg border-2 text-left transition-all hover:shadow-md",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-2xl mb-2 block">{provider.icon}</span>
                    <h3 className="font-semibold">{provider.name}</h3>
                    <p className="text-sm text-muted-foreground">{provider.nameZh}</p>
                  </div>
                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {provider.models.slice(0, 3).map((model) => (
                    <span
                      key={model.id}
                      className="text-xs px-2 py-1 bg-muted rounded"
                    >
                      {model.name}
                    </span>
                  ))}
                </div>

                {onTestProvider && !isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTestProvider(provider.id);
                    }}
                    disabled={isTesting}
                    className="mt-3 w-full"
                  >
                    {isTesting ? "测试中..." : "测试连接"}
                  </Button>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
