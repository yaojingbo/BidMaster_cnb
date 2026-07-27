"use client";

import { ElementCard } from "./ElementCard";

interface Element {
  name: string;
  content: string;
  confidence?: number;
}

interface ElementListProps {
  elements: Element[];
  highlightedName?: string;
}

export function ElementList({ elements, highlightedName }: ElementListProps) {
  return (
    <div className="space-y-4">
      {elements.map((element, index) => (
        <ElementCard
          key={index}
          name={element.name}
          content={element.content}
          confidence={element.confidence}
          isHighlighted={highlightedName === element.name}
        />
      ))}
    </div>
  );
}