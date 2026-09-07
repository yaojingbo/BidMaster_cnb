"use client";

import { cn } from "@/lib/utils";

interface TabItem {
  key: string;
  label: string;
  icon?: React.ElementType;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-0 overflow-x-auto border-b [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-[1px] transition-colors sm:px-4",
              activeTab === tab.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onTabChange(tab.key)}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
